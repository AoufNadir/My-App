import { fromCents, toCents } from '../utils/money';
import { validateAccountingOperation } from './integrity';
import type {
    AccountingOperationDraft,
    AccountingOperationStatus,
    FinancialOperationKind,
    LedgerAccount,
    LedgerPosting,
} from './types';

export type ClientWallet = 'Caisse' | 'BaridiMob';

/** Minimal Legacy row shape deliberately kept independent from Firebase types. */
export type LegacyClientTransactionRow = {
    id: string;
    clientId: string;
    timestamp: number;
    montant: number;
    type?: string;
    paymentMethod?: string;
    creditDueDate?: string;
    affectsBalance?: boolean;
};

export type ClientPositionLot = {
    sourceTxId: string;
    /** The original client, retained when a lot moves between clients. */
    originClientId: string;
    timestamp: number;
    dueTimestamp: number;
    dueDate?: string;
    remainingDzd: number;
};

export type ClientPositionSnapshot = {
    clientId: string;
    effectiveAt: number;
    /** Legacy client balance: positive = advance/payable, negative = receivable. */
    balanceDzd: number;
    receivableDzd: number;
    advanceDzd: number;
    receivableLots: ClientPositionLot[];
    advanceLots: ClientPositionLot[];
};

export type ClientRevenueAccount =
    | 'income.portfolio_sale'
    | 'income.digital_service_sale'
    | 'income.purchase_order_sale';

export type ClientCorrectionCounterpart =
    | 'equity.client_opening_balance'
    | 'equity.client_balance_correction';

export type ClientShadowKind =
    | 'client_initial_balance'
    | 'client_balance_adjustment'
    | 'client_cash_receipt'
    | 'client_cash_payout'
    | 'client_receivable_transfer'
    | 'client_advance_transfer'
    | 'client_credit_sale'
    | 'client_credit_purchase'
    | 'client_service_credit_sale'
    | 'client_order_credit_sale'
    | 'client_write_off_receivable'
    | 'client_advance_cancellation';

type ClientShadowBase = {
    operationId: string;
    actorUid: string;
    effectiveAt: number;
    reason?: string;
};

type ClientPositionIntentBase = ClientShadowBase & {
    clientId: string;
    amountDzd: number;
    positionBefore: ClientPositionSnapshot;
};

export type ClientInitialBalanceIntent = ClientPositionIntentBase & {
    kind: 'client_initial_balance';
    counterpartAccount: 'equity.client_opening_balance';
};

export type ClientBalanceAdjustmentIntent = ClientPositionIntentBase & {
    kind: 'client_balance_adjustment';
    counterpartAccount: 'equity.client_balance_correction';
};

export type ClientCashReceiptIntent = ClientPositionIntentBase & {
    kind: 'client_cash_receipt';
    wallet: ClientWallet;
};

export type ClientCashPayoutIntent = ClientPositionIntentBase & {
    kind: 'client_cash_payout';
    wallet: ClientWallet;
};

type ClientTransferBase = ClientShadowBase & {
    fromClientId: string;
    toClientId: string;
    amountDzd: number;
    fromPositionBefore: ClientPositionSnapshot;
    toPositionBefore: ClientPositionSnapshot;
};

export type ClientReceivableTransferIntent = ClientTransferBase & {
    kind: 'client_receivable_transfer';
};

export type ClientAdvanceTransferIntent = ClientTransferBase & {
    kind: 'client_advance_transfer';
};

export type ClientCreditSaleIntent = ClientPositionIntentBase & {
    kind: 'client_credit_sale' | 'client_service_credit_sale' | 'client_order_credit_sale';
    revenueAccount: ClientRevenueAccount;
};

export type ClientCreditPurchaseIntent = ClientShadowBase & {
    kind: 'client_credit_purchase';
    amountDzd: number;
    /** client_payable is valid only where the counterparty is a real client. */
    counterparty: { kind: 'client'; id: string } | { kind: 'supplier' | 'external'; id?: string };
};

export type ClientWriteOffReceivableIntent = ClientPositionIntentBase & {
    kind: 'client_write_off_receivable';
};

export type ClientAdvanceCancellationIntent = ClientPositionIntentBase & {
    kind: 'client_advance_cancellation';
};

export type ClientShadowIntent =
    | ClientInitialBalanceIntent
    | ClientBalanceAdjustmentIntent
    | ClientCashReceiptIntent
    | ClientCashPayoutIntent
    | ClientReceivableTransferIntent
    | ClientAdvanceTransferIntent
    | ClientCreditSaleIntent
    | ClientCreditPurchaseIntent
    | ClientWriteOffReceivableIntent
    | ClientAdvanceCancellationIntent;

export type ClientShadowEffects = {
    clientDeltas: Record<string, number>;
    cashDeltasDzd: Record<ClientWallet, number>;
    receivableDzd: number;
    clientAdvanceDzd: number;
    clientPayableDzd: number;
    supplierPayableDzd: number;
};

export type LegacyClientShadowFacts = Omit<Partial<ClientShadowEffects>, 'clientDeltas' | 'cashDeltasDzd'> & {
    clientDeltas?: Record<string, number>;
    cashDeltasDzd?: Partial<ClientShadowEffects['cashDeltasDzd']>;
    warnings?: readonly string[];
};

export type ClientShadowResult = {
    intent: ClientShadowIntent;
    draft: AccountingOperationDraft;
    ledgerEffects: ClientShadowEffects;
    legacyFacts: LegacyClientShadowFacts;
    integrityErrors: string[];
    mismatches: string[];
    matches: boolean;
};

const DAY_MS = 86_400_000;
const WALLETS: readonly ClientWallet[] = ['Caisse', 'BaridiMob'];

const dzd = (value: number) => fromCents(toCents(value));
const positive = (value: number) => Number.isFinite(value) && value > 0;

function walletAccount(wallet: ClientWallet): LedgerAccount {
    return wallet === 'Caisse' ? 'asset.cash.caisse' : 'asset.cash.baridimob';
}

function parseDueTimestamp(value: string | undefined, fallback: number): number {
    if (value) {
        const parsed = Date.parse(`${value}T23:59:59`);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback + 7 * DAY_MS;
}

function assertBase(intent: Pick<ClientShadowIntent, 'operationId' | 'actorUid' | 'effectiveAt'>): void {
    if (!intent.operationId.trim() || !intent.actorUid.trim() || !Number.isFinite(intent.effectiveAt) || intent.effectiveAt <= 0) {
        throw new Error('Client shadow operation identity is invalid.');
    }
}

function assertPosition(position: ClientPositionSnapshot, clientId: string): void {
    if (position.clientId !== clientId || !Number.isFinite(position.balanceDzd) || !Number.isFinite(position.receivableDzd)
        || !Number.isFinite(position.advanceDzd) || position.receivableDzd < 0 || position.advanceDzd < 0) {
        throw new Error('Client shadow position snapshot is invalid.');
    }
}

function assertReasonAndCounterpart(intent: ClientInitialBalanceIntent | ClientBalanceAdjustmentIntent): void {
    if (!intent.reason?.trim()) throw new Error('A Client initial balance or adjustment requires a reason.');
    if (!intent.counterpartAccount) throw new Error('A Client initial balance or adjustment requires an explicit counterpart account.');
}

function normalizedLots(lots: readonly ClientPositionLot[]): ClientPositionLot[] {
    return lots
        .filter((lot) => positive(lot.remainingDzd))
        .map((lot) => ({ ...lot, remainingDzd: dzd(lot.remainingDzd) }));
}

function consumeLots(lots: readonly ClientPositionLot[], amountDzd: number): ClientPositionLot[] {
    let remainingCents = toCents(amountDzd);
    const moved: ClientPositionLot[] = [];
    for (const lot of normalizedLots(lots)) {
        if (remainingCents <= 0) break;
        const movedCents = Math.min(toCents(lot.remainingDzd), remainingCents);
        if (movedCents <= 0) continue;
        moved.push({ ...lot, remainingDzd: fromCents(movedCents) });
        remainingCents -= movedCents;
    }
    if (remainingCents > 0) throw new Error('Client transfer exceeds the available FIFO position.');
    return moved;
}

/**
 * Pure Legacy snapshot. Positive entries settle receivables FIFO then become
 * advances. Negative entries settle advances FIFO then become receivables.
 * Provenance follows the lot when it moves to another client in V2.
 */
export function buildClientPositionSnapshot(
    rows: readonly LegacyClientTransactionRow[],
    clientId: string,
    effectiveAt = Number.MAX_SAFE_INTEGER,
): ClientPositionSnapshot {
    const receivableLots: ClientPositionLot[] = [];
    const advanceLots: ClientPositionLot[] = [];
    let balanceCents = 0;
    const sorted = rows
        .filter((row) => row.clientId === clientId && row.affectsBalance !== false && row.timestamp <= effectiveAt)
        .slice()
        .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));

    for (const row of sorted) {
        const amountCents = toCents(Number(row.montant || 0));
        if (!amountCents) continue;
        balanceCents += amountCents;
        if (amountCents > 0) {
            let payment = amountCents;
            while (payment > 0 && receivableLots.length > 0) {
                const oldest = receivableLots[0];
                const used = Math.min(payment, toCents(oldest.remainingDzd));
                oldest.remainingDzd = fromCents(toCents(oldest.remainingDzd) - used);
                payment -= used;
                if (!toCents(oldest.remainingDzd)) receivableLots.shift();
            }
            if (payment > 0) {
                advanceLots.push({
                    sourceTxId: row.id,
                    originClientId: row.clientId,
                    timestamp: row.timestamp,
                    dueTimestamp: row.timestamp,
                    remainingDzd: fromCents(payment),
                });
            }
            continue;
        }

        let debt = Math.abs(amountCents);
        while (debt > 0 && advanceLots.length > 0) {
            const oldest = advanceLots[0];
            const used = Math.min(debt, toCents(oldest.remainingDzd));
            oldest.remainingDzd = fromCents(toCents(oldest.remainingDzd) - used);
            debt -= used;
            if (!toCents(oldest.remainingDzd)) advanceLots.shift();
        }
        if (debt > 0) {
            receivableLots.push({
                sourceTxId: row.id,
                originClientId: row.clientId,
                timestamp: row.timestamp,
                dueTimestamp: parseDueTimestamp(row.creditDueDate, row.timestamp),
                dueDate: row.creditDueDate,
                remainingDzd: fromCents(debt),
            });
        }
    }

    const receivableDzd = dzd(receivableLots.reduce((sum, lot) => sum + lot.remainingDzd, 0));
    const advanceDzd = dzd(advanceLots.reduce((sum, lot) => sum + lot.remainingDzd, 0));
    return {
        clientId,
        effectiveAt,
        balanceDzd: fromCents(balanceCents),
        receivableDzd,
        advanceDzd,
        receivableLots: normalizedLots(receivableLots),
        advanceLots: normalizedLots(advanceLots),
    };
}

const emptyEffects = (): ClientShadowEffects => ({
    clientDeltas: {},
    cashDeltasDzd: { Caisse: 0, BaridiMob: 0 },
    receivableDzd: 0,
    clientAdvanceDzd: 0,
    clientPayableDzd: 0,
    supplierPayableDzd: 0,
});

function clientPosting(id: string, account: LedgerAccount, side: 'debit' | 'credit', amountDzd: number, clientId?: string): LedgerPosting {
    return { id, account, side, amountDzd: dzd(amountDzd), ...(clientId ? { clientId } : {}) };
}

function draftKind(intent: ClientShadowIntent): FinancialOperationKind {
    switch (intent.kind) {
        case 'client_initial_balance':
        case 'client_balance_adjustment': return 'correction';
        case 'client_cash_receipt':
        case 'client_cash_payout': return 'client_settlement';
        case 'client_receivable_transfer':
        case 'client_advance_transfer': return 'client_transfer';
        case 'client_write_off_receivable':
        case 'client_advance_cancellation': return 'client_write_off';
        case 'client_service_credit_sale': return 'digital_service_sale';
        case 'client_order_credit_sale': return 'order_completion';
        case 'client_credit_sale': return 'portfolio_sell';
        case 'client_credit_purchase': return 'portfolio_buy';
    }
}

function projectionIds(intent: ClientShadowIntent): string[] {
    if (intent.kind === 'client_receivable_transfer' || intent.kind === 'client_advance_transfer') {
        return [intent.fromClientId, intent.toClientId];
    }
    if (intent.kind === 'client_credit_purchase') return intent.counterparty.kind === 'client' ? [intent.counterparty.id] : [];
    return [intent.clientId];
}

function makeDraft(intent: ClientShadowIntent, postings: LedgerPosting[], metadata: Record<string, unknown>): AccountingOperationDraft {
    return {
        operationId: intent.operationId,
        accountingVersion: 2,
        kind: draftKind(intent),
        status: 'posted',
        effectiveAt: intent.effectiveAt,
        actorUid: intent.actorUid,
        ...(intent.reason?.trim() ? { reason: intent.reason.trim() } : {}),
        postings,
        projections: projectionIds(intent).map((clientId) => ({ collection: 'client_positions', id: `${intent.operationId}:client:${clientId}` })),
        metadata: { mode: 'shadow', domain: 'clientsV2', ...metadata },
    };
}

function settlementPostings(
    clientId: string,
    amountDzd: number,
    position: ClientPositionSnapshot,
    direction: 'receipt' | 'payout',
    wallet: ClientWallet,
): LedgerPosting[] {
    const amount = dzd(amountDzd);
    const coverage = direction === 'receipt' ? Math.min(amount, position.receivableDzd) : Math.min(amount, position.advanceDzd);
    const excess = dzd(amount - coverage);
    const cashSide = direction === 'receipt' ? 'debit' : 'credit';
    const positionSide = direction === 'receipt' ? 'credit' : 'debit';
    const positionAccount = direction === 'receipt' ? 'asset.receivable.client' : 'liability.client_advance';
    const overflowAccount = direction === 'receipt' ? 'liability.client_advance' : 'asset.receivable.client';
    const postings: LedgerPosting[] = [
        { id: 'cash', account: walletAccount(wallet), side: cashSide, amountDzd: amount },
    ];
    if (coverage > 0) postings.push(clientPosting('position-settlement', positionAccount, positionSide, coverage, clientId));
    if (excess > 0) postings.push(clientPosting('position-overflow', overflowAccount, positionSide, excess, clientId));
    return postings;
}

function creditSalePostings(intent: ClientCreditSaleIntent): LedgerPosting[] {
    const amount = dzd(intent.amountDzd);
    const advanceUsed = Math.min(amount, intent.positionBefore.advanceDzd);
    const receivableCreated = dzd(amount - advanceUsed);
    const postings: LedgerPosting[] = [];
    if (advanceUsed > 0) postings.push(clientPosting('sale-advance-used', 'liability.client_advance', 'debit', advanceUsed, intent.clientId));
    if (receivableCreated > 0) postings.push(clientPosting('sale-receivable', 'asset.receivable.client', 'debit', receivableCreated, intent.clientId));
    postings.push({ id: 'sale-revenue', account: intent.revenueAccount, side: 'credit', amountDzd: amount, clientId: intent.clientId });
    return postings;
}

/**
 * Pure Client V2 Draft builder. It has no Firestore write, clock, generated
 * id, or observer dependency. A caller may safely catch failures in Shadow.
 */
export function buildClientShadowDraft(intent: ClientShadowIntent): AccountingOperationDraft {
    assertBase(intent);
    let postings: LedgerPosting[];
    let metadata: Record<string, unknown> = {};

    switch (intent.kind) {
        case 'client_initial_balance':
        case 'client_balance_adjustment': {
            assertPosition(intent.positionBefore, intent.clientId);
            assertReasonAndCounterpart(intent);
            if (!Number.isFinite(intent.amountDzd) || !toCents(intent.amountDzd)) throw new Error('Client balance correction requires a non-zero amount.');
            const amount = Math.abs(dzd(intent.amountDzd));
            const increasesAdvance = intent.amountDzd > 0;
            const covered = increasesAdvance
                ? Math.min(amount, intent.positionBefore.receivableDzd)
                : Math.min(amount, intent.positionBefore.advanceDzd);
            const overflow = dzd(amount - covered);
            const positionPostings: LedgerPosting[] = [];
            if (covered > 0) {
                positionPostings.push(clientPosting(
                    'correction-settlement',
                    increasesAdvance ? 'asset.receivable.client' : 'liability.client_advance',
                    increasesAdvance ? 'credit' : 'debit',
                    covered,
                    intent.clientId,
                ));
            }
            if (overflow > 0) {
                positionPostings.push(clientPosting(
                    increasesAdvance ? 'client-advance' : 'client-receivable',
                    increasesAdvance ? 'liability.client_advance' : 'asset.receivable.client',
                    increasesAdvance ? 'credit' : 'debit',
                    overflow,
                    intent.clientId,
                ));
            }
            postings = [...positionPostings, { id: 'counterpart', account: intent.counterpartAccount, side: increasesAdvance ? 'debit' : 'credit', amountDzd: amount }];
            metadata = { correction: true, counterpartAccount: intent.counterpartAccount, legacyBalanceDeltaDzd: dzd(intent.amountDzd) };
            break;
        }
        case 'client_cash_receipt':
        case 'client_cash_payout': {
            assertPosition(intent.positionBefore, intent.clientId);
            if (!positive(intent.amountDzd)) throw new Error('Client cash settlement requires a positive amount.');
            postings = settlementPostings(intent.clientId, intent.amountDzd, intent.positionBefore, intent.kind === 'client_cash_receipt' ? 'receipt' : 'payout', intent.wallet);
            break;
        }
        case 'client_receivable_transfer': {
            assertPosition(intent.fromPositionBefore, intent.fromClientId);
            assertPosition(intent.toPositionBefore, intent.toClientId);
            if (!positive(intent.amountDzd) || intent.fromClientId === intent.toClientId) throw new Error('Client receivable transfer requires two clients and a positive amount.');
            if (toCents(intent.amountDzd) > toCents(intent.fromPositionBefore.receivableDzd)) throw new Error('Client receivable transfer exceeds source receivable.');
            const lots = consumeLots(intent.fromPositionBefore.receivableLots, intent.amountDzd);
            postings = [
                clientPosting('receivable-to', 'asset.receivable.client', 'debit', intent.amountDzd, intent.toClientId),
                clientPosting('receivable-from', 'asset.receivable.client', 'credit', intent.amountDzd, intent.fromClientId),
            ];
            metadata = { fifoLots: lots, preservesProjectReceivable: true };
            break;
        }
        case 'client_advance_transfer': {
            assertPosition(intent.fromPositionBefore, intent.fromClientId);
            assertPosition(intent.toPositionBefore, intent.toClientId);
            if (!positive(intent.amountDzd) || intent.fromClientId === intent.toClientId) throw new Error('Client advance transfer requires two clients and a positive amount.');
            if (toCents(intent.amountDzd) > toCents(intent.fromPositionBefore.advanceDzd)) throw new Error('Client advance transfer exceeds source advance.');
            const lots = consumeLots(intent.fromPositionBefore.advanceLots, intent.amountDzd);
            postings = [
                clientPosting('advance-from', 'liability.client_advance', 'debit', intent.amountDzd, intent.fromClientId),
                clientPosting('advance-to', 'liability.client_advance', 'credit', intent.amountDzd, intent.toClientId),
            ];
            metadata = { fifoLots: lots, preservesProjectAdvance: true };
            break;
        }
        case 'client_credit_sale':
        case 'client_service_credit_sale':
        case 'client_order_credit_sale': {
            assertPosition(intent.positionBefore, intent.clientId);
            if (!positive(intent.amountDzd)) throw new Error('Client credit sale requires a positive amount.');
            postings = creditSalePostings(intent);
            break;
        }
        case 'client_credit_purchase': {
            if (!positive(intent.amountDzd)) throw new Error('Client credit purchase requires a positive amount.');
            const payableAccount: LedgerAccount = intent.counterparty.kind === 'client'
                ? 'liability.client_payable'
                : intent.counterparty.kind === 'supplier'
                    ? 'liability.supplier_payable'
                    : 'liability.counterparty_payable';
            if (intent.counterparty.kind === 'client' && !intent.counterparty.id.trim()) throw new Error('Client credit purchase requires a real client id.');
            postings = [
                { id: 'credit-purchase-clearing', account: 'asset.clearing.credit_purchase', side: 'debit', amountDzd: dzd(intent.amountDzd) },
                clientPosting('credit-purchase-payable', payableAccount, 'credit', intent.amountDzd, intent.counterparty.kind === 'client' ? intent.counterparty.id : undefined),
            ];
            metadata = { counterparty: intent.counterparty };
            break;
        }
        case 'client_write_off_receivable': {
            assertPosition(intent.positionBefore, intent.clientId);
            if (!positive(intent.amountDzd) || toCents(intent.amountDzd) > toCents(intent.positionBefore.receivableDzd)) throw new Error('Client receivable write-off exceeds the open receivable.');
            if (!intent.reason?.trim()) throw new Error('Client receivable write-off requires a reason.');
            postings = [
                { id: 'write-off-expense', account: 'expense.client_receivable_write_off', side: 'debit', amountDzd: dzd(intent.amountDzd) },
                clientPosting('write-off-receivable', 'asset.receivable.client', 'credit', intent.amountDzd, intent.clientId),
            ];
            metadata = { writeOff: 'receivable' };
            break;
        }
        case 'client_advance_cancellation': {
            assertPosition(intent.positionBefore, intent.clientId);
            if (!positive(intent.amountDzd) || toCents(intent.amountDzd) > toCents(intent.positionBefore.advanceDzd)) throw new Error('Client advance cancellation exceeds the open advance.');
            if (!intent.reason?.trim()) throw new Error('Client advance cancellation requires a reason.');
            postings = [
                clientPosting('advance-cancellation', 'liability.client_advance', 'debit', intent.amountDzd, intent.clientId),
                { id: 'advance-release-income', account: 'income.client_advance_release', side: 'credit', amountDzd: dzd(intent.amountDzd) },
            ];
            metadata = { writeOff: 'advance_cancellation' };
            break;
        }
    }
    return makeDraft(intent, postings!, metadata);
}

export function getClientLedgerEffects(draft: Pick<AccountingOperationDraft, 'postings'>): ClientShadowEffects {
    const effects = emptyEffects();
    const addClient = (id: string | undefined, value: number) => {
        if (!id) return;
        effects.clientDeltas[id] = dzd((effects.clientDeltas[id] || 0) + value);
    };
    for (const posting of draft.postings) {
        const assetSign = posting.side === 'debit' ? 1 : -1;
        if (posting.account === 'asset.cash.caisse') effects.cashDeltasDzd.Caisse += assetSign * posting.amountDzd;
        if (posting.account === 'asset.cash.baridimob') effects.cashDeltasDzd.BaridiMob += assetSign * posting.amountDzd;
        if (posting.account === 'asset.receivable.client') {
            effects.receivableDzd += assetSign * posting.amountDzd;
            addClient(posting.clientId, posting.side === 'debit' ? -posting.amountDzd : posting.amountDzd);
        }
        if (posting.account === 'liability.client_advance') {
            const sign = posting.side === 'credit' ? 1 : -1;
            effects.clientAdvanceDzd += sign * posting.amountDzd;
            addClient(posting.clientId, sign * posting.amountDzd);
        }
        if (posting.account === 'liability.client_payable') {
            const sign = posting.side === 'credit' ? 1 : -1;
            effects.clientPayableDzd += sign * posting.amountDzd;
            addClient(posting.clientId, sign * posting.amountDzd);
        }
        if (posting.account === 'liability.supplier_payable' || posting.account === 'liability.counterparty_payable') {
            effects.supplierPayableDzd += posting.side === 'credit' ? posting.amountDzd : -posting.amountDzd;
        }
    }
    WALLETS.forEach((wallet) => { effects.cashDeltasDzd[wallet] = dzd(effects.cashDeltasDzd[wallet]); });
    Object.keys(effects.clientDeltas).forEach((id) => { effects.clientDeltas[id] = dzd(effects.clientDeltas[id]); });
    effects.receivableDzd = dzd(effects.receivableDzd);
    effects.clientAdvanceDzd = dzd(effects.clientAdvanceDzd);
    effects.clientPayableDzd = dzd(effects.clientPayableDzd);
    effects.supplierPayableDzd = dzd(effects.supplierPayableDzd);
    return effects;
}

function compareNumber(label: string, legacy: number | undefined, ledger: number, mismatches: string[]): void {
    if (legacy === undefined) return;
    if (toCents(legacy) !== toCents(ledger)) mismatches.push(`${label}: Legacy ${legacy} != V2 ${ledger}.`);
}

/** Pure comparison. Partial Legacy facts intentionally let each writer report only observed effects. */
export function compareClientShadow(intent: ClientShadowIntent, legacyFacts: LegacyClientShadowFacts = {}): ClientShadowResult {
    const draft = buildClientShadowDraft(intent);
    const ledgerEffects = getClientLedgerEffects(draft);
    const integrityErrors = validateAccountingOperation(draft);
    const mismatches: string[] = [];
    Object.entries(legacyFacts.clientDeltas || {}).forEach(([clientId, amount]) => compareNumber(`Client ${clientId}`, amount, ledgerEffects.clientDeltas[clientId] || 0, mismatches));
    WALLETS.forEach((wallet) => compareNumber(`${wallet} cash`, legacyFacts.cashDeltasDzd?.[wallet], ledgerEffects.cashDeltasDzd[wallet], mismatches));
    compareNumber('Client receivable', legacyFacts.receivableDzd, ledgerEffects.receivableDzd, mismatches);
    compareNumber('Client advance', legacyFacts.clientAdvanceDzd, ledgerEffects.clientAdvanceDzd, mismatches);
    compareNumber('Client payable', legacyFacts.clientPayableDzd, ledgerEffects.clientPayableDzd, mismatches);
    compareNumber('Supplier/counterparty payable', legacyFacts.supplierPayableDzd, ledgerEffects.supplierPayableDzd, mismatches);
    if (legacyFacts.warnings?.length) mismatches.push(...legacyFacts.warnings);
    if (integrityErrors.length) mismatches.push(...integrityErrors);
    return { intent, draft, ledgerEffects, legacyFacts, integrityErrors, mismatches, matches: mismatches.length === 0 };
}

/** Future V2 cancellation shape. It is immutable, linked, and never writes in Shadow. */
export function buildClientShadowReversalDraft(original: AccountingOperationDraft, args: {
    operationId: string;
    actorUid: string;
    effectiveAt: number;
    reason?: string;
}): AccountingOperationDraft {
    if (original.status !== 'posted') throw new Error('Only a posted operation can be reversed.');
    const status: AccountingOperationStatus = 'reversal';
    return {
        operationId: args.operationId,
        accountingVersion: 2,
        kind: 'reversal',
        status,
        effectiveAt: args.effectiveAt,
        actorUid: args.actorUid,
        reason: args.reason || `Reversal of ${original.operationId}`,
        reversalOf: original.operationId,
        postings: original.postings.map((posting) => ({
            ...posting,
            id: `reversal:${posting.id}`,
            side: posting.side === 'debit' ? 'credit' : 'debit',
        })),
        projections: [],
        metadata: { mode: 'shadow', domain: 'clientsV2', immutable: true, reversalOf: original.operationId },
    };
}
