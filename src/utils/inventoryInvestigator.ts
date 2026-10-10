import { fromCents, toCents } from './money';
import {
    isDzdAccount,
    lastMatchingCheck,
    type InventoryAccount,
    type InventoryCheck,
    type InventoryRow,
} from './inventoryCheck';

/**
 * The investigator (V5-3): reads the gaps of an inventory and suggests where the mistake may be.
 * Suggestions only. Nothing here writes a balance or touches a profit; every fix goes through the
 * windows that already exist (edit an operation, record a sale, record a transfer).
 */

export type InvestigatorTreasuryTx = {
    id: string;
    timestamp: number;
    date?: string;
    time?: string;
    type?: string;
    source?: string;
    destination?: string;
    amount?: number;
    origin?: string;
    linkedTxId?: string;
};

export type InvestigatorPortfolioTx = {
    id: string;
    timestamp: number;
    date?: string;
    time?: string;
    type?: string;
    currency?: string;
    quantity?: number;
    price?: number;
    sell?: number;
    origin?: string;
    settlementCurrency?: string;
    purchaseFundingCurrency?: string;
};

export type InvestigatorInput = {
    /** The accounts counted, compared with the books (compareInventory) */
    rows: readonly InventoryRow[];
    /** Saved inventories, any order */
    checks: readonly InventoryCheck[];
    treasuryTransactions: readonly InvestigatorTreasuryTx[];
    portfolioTransactions: readonly InvestigatorPortfolioTx[];
    now: number;
};

export type CashAccount = 'caisse' | 'baridi';
export type AssetCurrency = 'USDT' | 'EUR';

/** Two gaps that cancel out, to the dinar: one operation went to the wrong box, or a transfer is missing. */
export const EQUAL_OPPOSITE_TOLERANCE_CENTS = 100;
/** How many operations a suggestion lists. */
export const INVESTIGATOR_LIST_LIMIT = 8;
/** Recent trades that tell what a normal price looks like. */
export const PRICE_WINDOW_DAYS = 45;
export const PRICE_MIN_TRADES = 3;
/** A price this close outside the recent range still counts as normal. */
export const PRICE_MARGIN = 0.015;

const DAY_MS = 24 * 60 * 60 * 1000;

export type CandidateLink = { type: 'buy' | 'sell'; currency: AssetCurrency; quantity: number };

export type WrongChannelCandidate = {
    tx: InvestigatorTreasuryTx;
    /** The box this operation should have been recorded in */
    shouldBe: CashAccount;
    /** The USDT or EUR operation it belongs to, when it has one */
    linked?: CandidateLink;
};

/** The books and the real boxes differ by the same amount in opposite directions. */
export type WrongChannelSuggestion = {
    kind: 'wrongChannel';
    /** The amount of the gap, in dinars (positive) */
    amount: number;
    /** The box whose books are above what was counted */
    booksAbove: CashAccount;
    /** The box whose books are below what was counted */
    booksBelow: CashAccount;
    /** Time of the last inventory at which one of the two boxes matched; null when none did */
    since: number | null;
    sinceDate: string | null;
    candidates: WrongChannelCandidate[];
    /** The same gap would come from this transfer if it was never recorded */
    transfer: { amount: number; from: CashAccount; to: CashAccount };
};

export type PriceReference = { count: number; min: number; max: number };

/** A USDT or EUR gap that a gap in the cash boxes answers: a sale or a purchase never recorded. */
export type TradeSuggestion = {
    kind: 'unrecordedSale' | 'unrecordedPurchase';
    currency: AssetCurrency;
    quantity: number;
    dzdAmount: number;
    /** Dinars per unit, to two decimals */
    unitPrice: number;
    /** The box that received (sale) or paid (purchase) the money */
    channel: CashAccount;
    /** Both boxes moved: the gap is split between them */
    splitChannels: boolean;
    recent: PriceReference | null;
    /** Whether the price is close to the recent trades; null when there are too few to tell */
    plausible: boolean | null;
};

export type InvestigatorOperation = {
    source: 'treasury' | 'portfolio';
    id: string;
    timestamp: number;
    date: string;
    time: string;
    type: string;
    /** Dinars for the cash boxes, units for USDT and EUR (always positive) */
    amount: number;
    /** Positive adds to the account, negative removes from it, zero when unknown (a transfer between the boxes) */
    direction: 1 | -1 | 0;
};

/** A gap nothing above explained: the operations made since the account last matched are where to look. */
export type UnexplainedSuggestion = {
    kind: 'unexplained';
    account: InventoryAccount;
    gap: number;
    since: number | null;
    sinceDate: string | null;
    /** How many operations touched the account since */
    count: number;
    /** The newest ones, newest first */
    operations: InvestigatorOperation[];
};

export type InventorySuggestion = WrongChannelSuggestion | TradeSuggestion | UnexplainedSuggestion;

const centsOf = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? toCents(n) : 0;
};

const accountOfWallet = (raw: unknown): CashAccount | null => {
    const value = String(raw ?? '').toLowerCase();
    if (value.includes('caisse'))
        return 'caisse';
    if (value.includes('baridi'))
        return 'baridi';
    return null;
};

/** A plain movement of a cash box: an operation, never a correction the owner already made. */
const isOperationMovement = (tx: InvestigatorTreasuryTx): boolean =>
    tx.origin !== 'balance_edit' && Number.isFinite(Number(tx.amount)) && Number(tx.amount) > 0;

function linkOf(tx: InvestigatorTreasuryTx, portfolioById: Map<string, InvestigatorPortfolioTx>): CandidateLink | undefined {
    if (!tx.linkedTxId)
        return undefined;
    const linked = portfolioById.get(tx.linkedTxId);
    if (!linked || (linked.type !== 'buy' && linked.type !== 'sell'))
        return undefined;
    const currency = linked.currency === 'EUR' ? 'EUR' : linked.currency === 'USDT' ? 'USDT' : null;
    return currency ? { type: linked.type, currency, quantity: Number(linked.quantity) || 0 } : undefined;
}

function sinceOf(checks: readonly InventoryCheck[], accounts: readonly InventoryAccount[]): { timestamp: number | null; date: string | null } {
    let best: InventoryCheck | null = null;
    for (const account of accounts) {
        const check = lastMatchingCheck(checks, account);
        if (check && (!best || check.timestamp > best.timestamp))
            best = check;
    }
    return best ? { timestamp: best.timestamp, date: best.date || null } : { timestamp: null, date: null };
}

function wrongChannel(input: InvestigatorInput, byAccount: Map<InventoryAccount, InventoryRow>, portfolioById: Map<string, InvestigatorPortfolioTx>): WrongChannelSuggestion | null {
    const caisse = byAccount.get('caisse');
    const baridi = byAccount.get('baridi');
    if (!caisse || !baridi || caisse.status === 'match' || baridi.status === 'match')
        return null;
    const gapCaisse = toCents(caisse.gap);
    const gapBaridi = toCents(baridi.gap);
    if (Math.abs(gapCaisse + gapBaridi) > EQUAL_OPPOSITE_TOLERANCE_CENTS || Math.sign(gapCaisse) === Math.sign(gapBaridi))
        return null;
    const booksAbove: CashAccount = gapCaisse < 0 ? 'caisse' : 'baridi';
    const booksBelow: CashAccount = booksAbove === 'caisse' ? 'baridi' : 'caisse';
    const amountCents = Math.max(Math.abs(gapCaisse), Math.abs(gapBaridi));
    const since = sinceOf(input.checks, ['caisse', 'baridi']);

    const candidates: WrongChannelCandidate[] = [];
    for (const tx of [...input.treasuryTransactions].sort((a, b) => b.timestamp - a.timestamp)) {
        if (!isOperationMovement(tx) || (since.timestamp !== null && tx.timestamp <= since.timestamp))
            continue;
        if (Math.abs(centsOf(tx.amount) - amountCents) > EQUAL_OPPOSITE_TOLERANCE_CENTS)
            continue;
        const wallet = accountOfWallet(tx.source);
        // Money in recorded where the books are too high, or money out recorded where they are too low.
        const shouldBe = tx.type === 'Ajout' && wallet === booksAbove ? booksBelow
            : tx.type === 'Retrait' && wallet === booksBelow ? booksAbove
                : null;
        if (!shouldBe)
            continue;
        const linked = linkOf(tx, portfolioById);
        candidates.push({ tx, shouldBe, ...(linked ? { linked } : {}) });
        if (candidates.length >= INVESTIGATOR_LIST_LIMIT)
            break;
    }
    return {
        kind: 'wrongChannel',
        amount: fromCents(amountCents),
        booksAbove,
        booksBelow,
        since: since.timestamp,
        sinceDate: since.date,
        candidates,
        transfer: { amount: fromCents(amountCents), from: booksAbove, to: booksBelow },
    };
}

function priceReference(input: InvestigatorInput, currency: AssetCurrency, side: 'sell' | 'buy'): PriceReference | null {
    const from = input.now - PRICE_WINDOW_DAYS * DAY_MS;
    const prices: number[] = [];
    for (const tx of [...input.portfolioTransactions].sort((a, b) => b.timestamp - a.timestamp)) {
        if (tx.type !== side || tx.currency !== currency || tx.timestamp < from || tx.timestamp > input.now || tx.origin)
            continue;
        if (tx.settlementCurrency === 'EUR' || tx.purchaseFundingCurrency === 'EUR')
            continue;
        const price = Number(side === 'sell' ? tx.sell : tx.price);
        if (Number.isFinite(price) && price > 0)
            prices.push(price);
        if (prices.length >= 15)
            break;
    }
    if (prices.length < PRICE_MIN_TRADES)
        return null;
    return { count: prices.length, min: Math.min(...prices), max: Math.max(...prices) };
}

function trade(input: InvestigatorInput, row: InventoryRow, byAccount: Map<InventoryAccount, InventoryRow>): TradeSuggestion | null {
    const currency: AssetCurrency = row.account === 'eur' ? 'EUR' : 'USDT';
    const quantityCents = Math.abs(toCents(row.gap));
    // The cash boxes counted: their gaps add up to what the sale brought in or the purchase took out.
    const cash = (['caisse', 'baridi'] as const).map((account) => byAccount.get(account)).filter((r): r is InventoryRow => Boolean(r));
    if (cash.length === 0 || quantityCents === 0)
        return null;
    const totalCents = cash.reduce((sum, r) => sum + toCents(r.gap), 0);
    const sale = row.status === 'short';
    // A sale lowers the asset and raises the cash; a purchase does the opposite.
    if (sale ? totalCents <= EQUAL_OPPOSITE_TOLERANCE_CENTS : totalCents >= -EQUAL_OPPOSITE_TOLERANCE_CENTS)
        return null;
    const dzdCents = Math.abs(totalCents);
    const mover = cash.filter((r) => (sale ? toCents(r.gap) > 0 : toCents(r.gap) < 0));
    const channelRow = [...mover].sort((a, b) => Math.abs(toCents(b.gap)) - Math.abs(toCents(a.gap)))[0];
    if (!channelRow)
        return null;
    const unitPrice = Math.round((dzdCents / quantityCents) * 100) / 100;
    const recent = priceReference(input, currency, sale ? 'sell' : 'buy');
    const plausible = recent ? unitPrice >= recent.min * (1 - PRICE_MARGIN) && unitPrice <= recent.max * (1 + PRICE_MARGIN) : null;
    return {
        kind: sale ? 'unrecordedSale' : 'unrecordedPurchase',
        currency,
        quantity: fromCents(quantityCents),
        dzdAmount: fromCents(dzdCents),
        unitPrice,
        channel: channelRow.account as CashAccount,
        splitChannels: mover.length > 1,
        recent,
        plausible,
    };
}

function operationsSince(input: InvestigatorInput, account: InventoryAccount, since: number | null): { count: number; operations: InvestigatorOperation[] } {
    const all: InvestigatorOperation[] = [];
    if (isDzdAccount(account)) {
        for (const tx of input.treasuryTransactions) {
            if (!isOperationMovement(tx) || (since !== null && tx.timestamp <= since))
                continue;
            const isTransfer = tx.type === 'Transfer';
            const touches = isTransfer
                ? accountOfWallet(tx.source) === account || accountOfWallet(tx.destination) === account
                : accountOfWallet(tx.source) === account;
            if (!touches)
                continue;
            const direction: 1 | -1 | 0 = isTransfer
                ? (accountOfWallet(tx.destination) === account ? 1 : -1)
                : tx.type === 'Ajout' || tx.type === 'Adjustment (+)' ? 1 : tx.type === 'Retrait' || tx.type === 'Adjustment (-)' ? -1 : 0;
            all.push({ source: 'treasury', id: tx.id, timestamp: tx.timestamp, date: tx.date ?? '', time: tx.time ?? '', type: String(tx.type ?? ''), amount: Number(tx.amount), direction });
        }
    }
    else {
        const currency = account === 'eur' ? 'EUR' : 'USDT';
        for (const tx of input.portfolioTransactions) {
            if (tx.currency !== currency || tx.origin === 'balance_edit' || (since !== null && tx.timestamp <= since))
                continue;
            const quantity = Number(tx.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0)
                continue;
            const direction: 1 | -1 = tx.type === 'buy' || tx.type === 'Ajout Manuel' ? 1 : -1;
            all.push({ source: 'portfolio', id: tx.id, timestamp: tx.timestamp, date: tx.date ?? '', time: tx.time ?? '', type: String(tx.type ?? ''), amount: quantity, direction });
        }
    }
    all.sort((a, b) => b.timestamp - a.timestamp);
    return { count: all.length, operations: all.slice(0, INVESTIGATOR_LIST_LIMIT) };
}

/**
 * The suggestions for one inventory, most telling first: a gap that cancels another, a gap in USDT
 * or EUR that the cash boxes answer, then, for every gap still unexplained, the operations made
 * since the account last matched.
 */
export function investigateInventory(input: InvestigatorInput): InventorySuggestion[] {
    const byAccount = new Map<InventoryAccount, InventoryRow>();
    for (const row of input.rows)
        byAccount.set(row.account, row);
    const gaps = input.rows.filter((row) => row.status !== 'match');
    if (gaps.length === 0)
        return [];
    const portfolioById = new Map(input.portfolioTransactions.map((tx) => [tx.id, tx] as const));
    const suggestions: InventorySuggestion[] = [];
    const explained = new Set<InventoryAccount>();

    const channel = wrongChannel(input, byAccount, portfolioById);
    if (channel) {
        suggestions.push(channel);
        explained.add('caisse');
        explained.add('baridi');
    }

    // A single asset gap can be matched with the cash boxes; two at once cannot be told apart.
    const assetGaps = gaps.filter((row) => !isDzdAccount(row.account));
    if (assetGaps.length === 1 && !channel) {
        const found = trade(input, assetGaps[0], byAccount);
        if (found) {
            suggestions.push(found);
            explained.add(assetGaps[0].account);
            for (const account of ['caisse', 'baridi'] as const) {
                const row = byAccount.get(account);
                if (row && row.status !== 'match')
                    explained.add(account);
            }
        }
    }

    for (const row of gaps) {
        if (explained.has(row.account))
            continue;
        const since = sinceOf(input.checks, [row.account]);
        const { count, operations } = operationsSince(input, row.account, since.timestamp);
        suggestions.push({ kind: 'unexplained', account: row.account, gap: row.gap, since: since.timestamp, sinceDate: since.date, count, operations });
    }
    return suggestions;
}
