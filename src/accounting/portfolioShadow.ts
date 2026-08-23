import { fromCents, toCents } from '../utils/money';
import { validateAccountingOperation } from './integrity';
import type {
    AccountingOperationDraft,
    AccountingOperationStatus,
    FinancialOperationKind,
    LedgerAccount,
    LedgerPosting,
} from './types';

/**
 * V2 keeps asset quantities in 1e-8 atoms internally. DZD remains cent based;
 * two decimal digits are a Legacy/display convention, never a V2 quantity
 * constraint.
 */
export const PORTFOLIO_QUANTITY_SCALE = 100_000_000;
export const PORTFOLIO_EXCHANGE_TOLERANCE_DZD = 0.01;

export type PortfolioCurrency = 'USDT' | 'EUR';
export type PortfolioWallet = 'Caisse' | 'BaridiMob';
export type PortfolioLocation = 'main' | 'locked';

export type PortfolioInventoryState = {
    /** Physical quantity currently held in this currency across all locations. */
    quantity: number;
    /** Quantity that currently carries a DZD cost basis. */
    costedQuantity: number;
    /** DZD historical cost basis for `costedQuantity`. */
    costBasisDzd: number;
};

/**
 * Explicit opening state passed to every V2 Portfolio operation. Keeping the
 * PAM beside quantity and cost basis makes the accounting input auditable and
 * prevents a writer from silently using today's portfolio state for history.
 */
export type PortfolioOpeningSnapshot = PortfolioInventoryState & {
    pamBeforeDzd: number;
};

export type PortfolioShadowKind =
    | 'portfolio_purchase_cash'
    | 'portfolio_purchase_credit'
    | 'portfolio_sale_cash'
    | 'portfolio_sale_credit'
    | 'portfolio_exchange_eur_to_usdt'
    | 'portfolio_exchange_usdt_to_eur'
    | 'portfolio_manual_add'
    | 'portfolio_manual_remove'
    | 'portfolio_project_expense_asset'
    | 'portfolio_personal_advance_asset'
    | 'portfolio_personal_expense_asset'
    | 'portfolio_personal_advance_return_asset'
    | 'portfolio_digital_service_purchase_asset'
    | 'portfolio_digital_service_sale_asset'
    | 'portfolio_order_sale_cash'
    | 'portfolio_order_sale_credit'
    | 'portfolio_fee_cash'
    | 'portfolio_fee_asset'
    | 'portfolio_asset_transfer';

type PortfolioShadowBase = {
    operationId: string;
    actorUid: string;
    effectiveAt: number;
    currency: PortfolioCurrency;
    quantity: number;
    inventoryBefore: PortfolioInventoryState;
    clientId?: string;
    reason?: string;
};

export type PortfolioPurchaseCashIntent = PortfolioShadowBase & {
    kind: 'portfolio_purchase_cash';
    wallet: PortfolioWallet;
    valueDzd: number;
};

export type PortfolioPurchaseCreditIntent = PortfolioShadowBase & {
    kind: 'portfolio_purchase_credit';
    valueDzd: number;
};

type PortfolioSaleBase = PortfolioShadowBase & {
    proceedsDzd: number;
};

export type PortfolioSaleCashIntent = PortfolioSaleBase & {
    kind: 'portfolio_sale_cash' | 'portfolio_order_sale_cash';
    wallet: PortfolioWallet;
};

export type PortfolioSaleCreditIntent = PortfolioSaleBase & {
    kind: 'portfolio_sale_credit' | 'portfolio_order_sale_credit';
};

export type PortfolioExchangeIntent = Omit<PortfolioShadowBase, 'currency' | 'quantity' | 'inventoryBefore'> & {
    kind: 'portfolio_exchange_eur_to_usdt' | 'portfolio_exchange_usdt_to_eur';
    fromCurrency: PortfolioCurrency;
    toCurrency: PortfolioCurrency;
    quantityOut: number;
    quantityIn: number;
    fromInventoryBefore: PortfolioInventoryState;
    /** Canonical DZD value for both exchange legs. */
    exchangeValueDzd: number;
    /** DZD value implied by the source-side quote. */
    fromQuotedValueDzd: number;
    /** DZD value implied by the destination-side quote. */
    toQuotedValueDzd: number;
};

export type PortfolioManualAddIntent = PortfolioShadowBase & {
    kind: 'portfolio_manual_add' | 'portfolio_personal_advance_return_asset' | 'portfolio_digital_service_sale_asset';
    valueDzd: number;
};

export type PortfolioNonSaleRemovalIntent = PortfolioShadowBase & {
    kind:
        | 'portfolio_manual_remove'
        | 'portfolio_project_expense_asset'
        | 'portfolio_personal_advance_asset'
        | 'portfolio_personal_expense_asset'
        | 'portfolio_digital_service_purchase_asset'
        | 'portfolio_fee_asset';
};

export type PortfolioFeeCashIntent = Omit<PortfolioShadowBase, 'currency' | 'quantity' | 'inventoryBefore'> & {
    kind: 'portfolio_fee_cash';
    wallet: PortfolioWallet;
    amountDzd: number;
};

export type PortfolioAssetTransferIntent = PortfolioShadowBase & {
    kind: 'portfolio_asset_transfer';
    fromLocation: PortfolioLocation;
    toLocation: PortfolioLocation;
};

export type PortfolioShadowIntent =
    | PortfolioPurchaseCashIntent
    | PortfolioPurchaseCreditIntent
    | PortfolioSaleCashIntent
    | PortfolioSaleCreditIntent
    | PortfolioExchangeIntent
    | PortfolioManualAddIntent
    | PortfolioNonSaleRemovalIntent
    | PortfolioFeeCashIntent
    | PortfolioAssetTransferIntent;

export type PortfolioEffects = {
    quantityDeltas: Record<PortfolioCurrency, number>;
    costBasisDeltasDzd: Record<PortfolioCurrency, number>;
    cashDeltasDzd: Record<PortfolioWallet, number>;
    clientReceivableDzd: number;
    clientPayableDzd: number;
    realizedTradingProfitDzd: number;
    fxGainLossDzd: number;
};

export type LegacyPortfolioShadowFacts = Omit<Partial<PortfolioEffects>, 'quantityDeltas' | 'costBasisDeltasDzd' | 'cashDeltasDzd'> & {
    quantityDeltas?: Partial<PortfolioEffects['quantityDeltas']>;
    costBasisDeltasDzd?: Partial<PortfolioEffects['costBasisDeltasDzd']>;
    cashDeltasDzd?: Partial<PortfolioEffects['cashDeltasDzd']>;
    /** The Legacy result is allowed to report a known data-quality gap. */
    warnings?: readonly string[];
};

export type PortfolioShadowResult = {
    intent: PortfolioShadowIntent;
    draft: AccountingOperationDraft;
    ledgerEffects: PortfolioEffects;
    legacyFacts: LegacyPortfolioShadowFacts;
    integrityErrors: string[];
    mismatches: string[];
    matches: boolean;
};

const CURRENCIES: readonly PortfolioCurrency[] = ['USDT', 'EUR'];
const WALLETS: readonly PortfolioWallet[] = ['Caisse', 'BaridiMob'];

const emptyEffects = (): PortfolioEffects => ({
    quantityDeltas: { USDT: 0, EUR: 0 },
    costBasisDeltasDzd: { USDT: 0, EUR: 0 },
    cashDeltasDzd: { Caisse: 0, BaridiMob: 0 },
    clientReceivableDzd: 0,
    clientPayableDzd: 0,
    realizedTradingProfitDzd: 0,
    fxGainLossDzd: 0,
});

function quantityAtoms(quantity: number): number {
    return Math.round(quantity * PORTFOLIO_QUANTITY_SCALE);
}

function fromQuantityAtoms(atoms: number): number {
    return atoms / PORTFOLIO_QUANTITY_SCALE;
}

function normalizedQuantity(quantity: number): number {
    return fromQuantityAtoms(quantityAtoms(quantity));
}

function normalizedDzd(value: number): number {
    return fromCents(toCents(value));
}

function sameDzd(left: number, right: number): boolean {
    return Math.abs(toCents(left) - toCents(right)) <= toCents(PORTFOLIO_EXCHANGE_TOLERANCE_DZD);
}

function currencyAccount(currency: PortfolioCurrency, location: PortfolioLocation = 'main'): LedgerAccount {
    const suffix = location === 'main' ? '' : `.${location}`;
    return `asset.portfolio.${currency.toLowerCase()}${suffix}` as LedgerAccount;
}

function walletAccount(wallet: PortfolioWallet): LedgerAccount {
    return wallet === 'Caisse' ? 'asset.cash.caisse' : 'asset.cash.baridimob';
}

function isFinitePositive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

function assertBase(intent: Pick<PortfolioShadowIntent, 'operationId' | 'actorUid' | 'effectiveAt'>): void {
    if (!intent.operationId.trim() || !intent.actorUid.trim() || !Number.isFinite(intent.effectiveAt) || intent.effectiveAt <= 0) {
        throw new Error('Portfolio shadow operation identity is invalid.');
    }
}

function assertInventory(inventory: PortfolioInventoryState, quantityOut = 0): void {
    if (!Number.isFinite(inventory.quantity) || !Number.isFinite(inventory.costedQuantity) || !Number.isFinite(inventory.costBasisDzd)
        || inventory.quantity < 0 || inventory.costedQuantity < 0 || inventory.costBasisDzd < 0) {
        throw new Error('Portfolio shadow inventory is invalid.');
    }
    if (quantityAtoms(quantityOut) > quantityAtoms(inventory.quantity)) {
        throw new Error('Portfolio shadow quantity exceeds physical inventory.');
    }
    if (quantityAtoms(quantityOut) > quantityAtoms(inventory.costedQuantity)) {
        throw new Error('Portfolio shadow quantity exceeds costed inventory. Legacy uncosted stock must be corrected before V2.');
    }
}

/** PAM immediately before the operation. It is never rounded to display precision. */
export function getPortfolioPamBefore(inventory: PortfolioInventoryState): number {
    assertInventory(inventory);
    return inventory.costedQuantity === 0 ? 0 : inventory.costBasisDzd / inventory.costedQuantity;
}

/** Creates a validated, precision-preserving opening snapshot for one asset. */
export function createPortfolioOpeningSnapshot(inventory: PortfolioInventoryState): PortfolioOpeningSnapshot {
    assertInventory(inventory);
    const quantity = normalizedQuantity(inventory.quantity);
    const costedQuantity = normalizedQuantity(inventory.costedQuantity);
    const costBasisDzd = normalizedDzd(inventory.costBasisDzd);
    return {
        quantity,
        costedQuantity,
        costBasisDzd,
        pamBeforeDzd: costedQuantity === 0 ? 0 : costBasisDzd / costedQuantity,
    };
}

/**
 * Applies a Draft's aggregate effect to one Portfolio currency in memory.
 * It is pure and used only by tests/diagnostics during Shadow. When the last
 * costed unit leaves the asset, the cost basis is set to exactly zero rather
 * than retaining a rounding residue.
 */
export function applyPortfolioInventoryEffects(
    inventory: PortfolioInventoryState,
    effects: Pick<PortfolioEffects, 'quantityDeltas' | 'costBasisDeltasDzd'>,
    currency: PortfolioCurrency,
): PortfolioInventoryState {
    assertInventory(inventory);
    const nextQuantityAtoms = quantityAtoms(inventory.quantity) + quantityAtoms(effects.quantityDeltas[currency]);
    const nextCostedAtoms = quantityAtoms(inventory.costedQuantity) + quantityAtoms(effects.quantityDeltas[currency]);
    const nextCostBasisCents = toCents(inventory.costBasisDzd) + toCents(effects.costBasisDeltasDzd[currency]);
    if (nextQuantityAtoms < 0 || nextCostedAtoms < 0 || nextCostBasisCents < 0) {
        throw new Error('Portfolio effect would create negative inventory or cost basis.');
    }
    if (nextQuantityAtoms === 0) {
        return { quantity: 0, costedQuantity: 0, costBasisDzd: 0 };
    }
    if (nextCostedAtoms === 0) {
        return { quantity: fromQuantityAtoms(nextQuantityAtoms), costedQuantity: 0, costBasisDzd: 0 };
    }
    return {
        quantity: fromQuantityAtoms(nextQuantityAtoms),
        costedQuantity: fromQuantityAtoms(nextCostedAtoms),
        costBasisDzd: fromCents(nextCostBasisCents),
    };
}

function removedCostDzd(inventory: PortfolioInventoryState, quantity: number): number {
    assertInventory(inventory, quantity);
    return normalizedDzd(getPortfolioPamBefore(inventory) * normalizedQuantity(quantity));
}

function assetPosting(
    id: string,
    currency: PortfolioCurrency,
    side: 'debit' | 'credit',
    amountDzd: number,
    quantity: number,
    unitRateDzd: number,
    location: PortfolioLocation = 'main',
): LedgerPosting {
    return {
        id,
        account: currencyAccount(currency, location),
        side,
        amountDzd,
        currency,
        quantity: normalizedQuantity(quantity),
        unitRateDzd,
    };
}

function clientPosting(id: string, account: LedgerAccount, side: 'debit' | 'credit', amountDzd: number, clientId?: string): LedgerPosting {
    return { id, account, side, amountDzd, ...(clientId ? { clientId } : {}) };
}

function shadowKindOperationKind(kind: PortfolioShadowKind): FinancialOperationKind {
    switch (kind) {
        case 'portfolio_purchase_cash':
        case 'portfolio_purchase_credit':
            return 'portfolio_buy';
        case 'portfolio_sale_cash':
        case 'portfolio_sale_credit':
        case 'portfolio_order_sale_cash':
        case 'portfolio_order_sale_credit':
            return 'portfolio_sell';
        case 'portfolio_exchange_eur_to_usdt':
        case 'portfolio_exchange_usdt_to_eur':
            return 'portfolio_exchange';
        case 'portfolio_manual_add':
        case 'portfolio_manual_remove':
            return 'portfolio_adjustment';
        case 'portfolio_project_expense_asset':
        case 'portfolio_personal_advance_asset':
        case 'portfolio_personal_expense_asset':
        case 'portfolio_digital_service_purchase_asset':
            return 'portfolio_non_sale_removal';
        case 'portfolio_personal_advance_return_asset':
            return 'personal_expense';
        case 'portfolio_digital_service_sale_asset':
            return 'digital_service_sale';
        case 'portfolio_fee_cash':
        case 'portfolio_fee_asset':
            return 'portfolio_fee';
        case 'portfolio_asset_transfer':
            return 'manual_asset_transaction';
    }
}

function removalCounterpart(kind: PortfolioNonSaleRemovalIntent['kind']): LedgerAccount {
    switch (kind) {
        case 'portfolio_manual_remove': return 'expense.portfolio_adjustment';
        case 'portfolio_project_expense_asset': return 'expense.project';
        case 'portfolio_personal_advance_asset': return 'asset.manager_advance';
        case 'portfolio_personal_expense_asset': return 'expense.personal';
        case 'portfolio_digital_service_purchase_asset': return 'asset.service_inventory';
        case 'portfolio_fee_asset': return 'expense.trading_fee';
    }
}

function additionCounterpart(kind: PortfolioManualAddIntent['kind']): LedgerAccount {
    switch (kind) {
        case 'portfolio_manual_add': return 'equity.portfolio_adjustment';
        case 'portfolio_personal_advance_return_asset': return 'asset.manager_advance';
        case 'portfolio_digital_service_sale_asset': return 'income.digital_service_sale';
    }
}

function makeDraft(intent: PortfolioShadowIntent, postings: LedgerPosting[], effects: PortfolioEffects): AccountingOperationDraft {
    return {
        operationId: intent.operationId,
        accountingVersion: 2,
        kind: shadowKindOperationKind(intent.kind),
        status: 'posted',
        effectiveAt: intent.effectiveAt,
        actorUid: intent.actorUid,
        reason: intent.reason || `portfolioV2 shadow: ${intent.kind}`,
        postings,
        projections: [],
        metadata: {
            mode: 'shadow',
            domain: 'portfolioV2',
            shadowKind: intent.kind,
            effects,
            quantityPrecision: PORTFOLIO_QUANTITY_SCALE,
        },
    };
}

function saleDraft(intent: PortfolioSaleCashIntent | PortfolioSaleCreditIntent): { postings: LedgerPosting[]; effects: PortfolioEffects } {
    if (!isFinitePositive(intent.quantity) || !isFinitePositive(intent.proceedsDzd)) {
        throw new Error('Portfolio sale requires positive quantity and proceeds.');
    }
    const quantity = normalizedQuantity(intent.quantity);
    const cost = removedCostDzd(intent.inventoryBefore, quantity);
    const proceeds = normalizedDzd(intent.proceedsDzd);
    const pamBefore = getPortfolioPamBefore(intent.inventoryBefore);
    const profit = normalizedDzd(proceeds - cost);
    const postings: LedgerPosting[] = [];
    const effects = emptyEffects();
    effects.quantityDeltas[intent.currency] = -quantity;
    effects.costBasisDeltasDzd[intent.currency] = -cost;
    effects.realizedTradingProfitDzd = profit;

    if (intent.kind === 'portfolio_sale_cash' || intent.kind === 'portfolio_order_sale_cash') {
        postings.push({ id: 'sale-proceeds', account: walletAccount(intent.wallet), side: 'debit', amountDzd: proceeds });
        effects.cashDeltasDzd[intent.wallet] = proceeds;
    }
    else {
        postings.push(clientPosting('sale-receivable', 'asset.receivable.client', 'debit', proceeds, intent.clientId));
        effects.clientReceivableDzd = proceeds;
    }
    postings.push(assetPosting('sale-cost', intent.currency, 'credit', cost, quantity, pamBefore));
    if (profit >= 0) {
        if (profit > 0) postings.push({ id: 'sale-profit', account: 'income.portfolio_sale', side: 'credit', amountDzd: profit });
    }
    else {
        postings.push({ id: 'sale-loss', account: 'expense.portfolio_sale_loss', side: 'debit', amountDzd: Math.abs(profit) });
    }
    return { postings, effects };
}

/**
 * Pure Portfolio V2 draft builder. It deliberately contains no Firestore,
 * clock, random-id, storage, or diagnostic imports. A failed build is only
 * observed by the caller and cannot block the existing Legacy write.
 */
export function buildPortfolioShadowDraft(intent: PortfolioShadowIntent): AccountingOperationDraft {
    assertBase(intent);
    const effects = emptyEffects();
    let postings: LedgerPosting[];

    switch (intent.kind) {
        case 'portfolio_purchase_cash': {
            if (!isFinitePositive(intent.quantity) || !isFinitePositive(intent.valueDzd)) throw new Error('Portfolio cash purchase requires positive quantity and value.');
            assertInventory(intent.inventoryBefore);
            const quantity = normalizedQuantity(intent.quantity);
            const value = normalizedDzd(intent.valueDzd);
            postings = [
                assetPosting('purchase-asset', intent.currency, 'debit', value, quantity, value / quantity),
                { id: 'purchase-cash', account: walletAccount(intent.wallet), side: 'credit', amountDzd: value },
            ];
            effects.quantityDeltas[intent.currency] = quantity;
            effects.costBasisDeltasDzd[intent.currency] = value;
            effects.cashDeltasDzd[intent.wallet] = -value;
            break;
        }
        case 'portfolio_purchase_credit': {
            if (!isFinitePositive(intent.quantity) || !isFinitePositive(intent.valueDzd)) throw new Error('Portfolio credit purchase requires positive quantity and value.');
            assertInventory(intent.inventoryBefore);
            const quantity = normalizedQuantity(intent.quantity);
            const value = normalizedDzd(intent.valueDzd);
            postings = [
                assetPosting('purchase-asset', intent.currency, 'debit', value, quantity, value / quantity),
                clientPosting('purchase-payable', 'liability.client_payable', 'credit', value, intent.clientId),
            ];
            effects.quantityDeltas[intent.currency] = quantity;
            effects.costBasisDeltasDzd[intent.currency] = value;
            effects.clientPayableDzd = value;
            break;
        }
        case 'portfolio_sale_cash':
        case 'portfolio_order_sale_cash':
        case 'portfolio_sale_credit':
        case 'portfolio_order_sale_credit': {
            const sale = saleDraft(intent);
            postings = sale.postings;
            const saleEffects = sale.effects;
            Object.assign(effects.quantityDeltas, saleEffects.quantityDeltas);
            Object.assign(effects.costBasisDeltasDzd, saleEffects.costBasisDeltasDzd);
            Object.assign(effects.cashDeltasDzd, saleEffects.cashDeltasDzd);
            effects.clientReceivableDzd = saleEffects.clientReceivableDzd;
            effects.realizedTradingProfitDzd = saleEffects.realizedTradingProfitDzd;
            break;
        }
        case 'portfolio_exchange_eur_to_usdt':
        case 'portfolio_exchange_usdt_to_eur': {
            if (intent.fromCurrency === intent.toCurrency || !isFinitePositive(intent.quantityOut) || !isFinitePositive(intent.quantityIn)
                || !isFinitePositive(intent.exchangeValueDzd) || !isFinitePositive(intent.fromQuotedValueDzd) || !isFinitePositive(intent.toQuotedValueDzd)) {
                throw new Error('Portfolio exchange requires two currencies, positive quantities, and quoted DZD values.');
            }
            if (!sameDzd(intent.exchangeValueDzd, intent.fromQuotedValueDzd) || !sameDzd(intent.exchangeValueDzd, intent.toQuotedValueDzd)) {
                throw new Error(`Portfolio exchange quotes differ from exchangeValueDzd by more than ${PORTFOLIO_EXCHANGE_TOLERANCE_DZD} DZD.`);
            }
            const quantityOut = normalizedQuantity(intent.quantityOut);
            const quantityIn = normalizedQuantity(intent.quantityIn);
            const sourceCost = removedCostDzd(intent.fromInventoryBefore, quantityOut);
            const exchangeValue = normalizedDzd(intent.exchangeValueDzd);
            const pamBefore = getPortfolioPamBefore(intent.fromInventoryBefore);
            const fxGainLoss = normalizedDzd(exchangeValue - sourceCost);
            postings = [
                assetPosting('exchange-in', intent.toCurrency, 'debit', exchangeValue, quantityIn, exchangeValue / quantityIn),
                assetPosting('exchange-out', intent.fromCurrency, 'credit', sourceCost, quantityOut, pamBefore),
            ];
            if (fxGainLoss > 0) postings.push({ id: 'exchange-fx-gain', account: 'income.fx_gain', side: 'credit', amountDzd: fxGainLoss });
            if (fxGainLoss < 0) postings.push({ id: 'exchange-fx-loss', account: 'expense.fx_loss', side: 'debit', amountDzd: Math.abs(fxGainLoss) });
            effects.quantityDeltas[intent.fromCurrency] = -quantityOut;
            effects.quantityDeltas[intent.toCurrency] = quantityIn;
            effects.costBasisDeltasDzd[intent.fromCurrency] = -sourceCost;
            effects.costBasisDeltasDzd[intent.toCurrency] = exchangeValue;
            effects.fxGainLossDzd = fxGainLoss;
            break;
        }
        case 'portfolio_manual_add':
        case 'portfolio_personal_advance_return_asset':
        case 'portfolio_digital_service_sale_asset': {
            if (!isFinitePositive(intent.quantity) || !isFinitePositive(intent.valueDzd)) throw new Error('Portfolio addition requires a positive quantity and known DZD value.');
            assertInventory(intent.inventoryBefore);
            const quantity = normalizedQuantity(intent.quantity);
            const value = normalizedDzd(intent.valueDzd);
            postings = [
                assetPosting('portfolio-in', intent.currency, 'debit', value, quantity, value / quantity),
                { id: 'addition-counterpart', account: additionCounterpart(intent.kind), side: intent.kind === 'portfolio_personal_advance_return_asset' ? 'credit' : 'credit', amountDzd: value },
            ];
            effects.quantityDeltas[intent.currency] = quantity;
            effects.costBasisDeltasDzd[intent.currency] = value;
            break;
        }
        case 'portfolio_manual_remove':
        case 'portfolio_project_expense_asset':
        case 'portfolio_personal_advance_asset':
        case 'portfolio_personal_expense_asset':
        case 'portfolio_digital_service_purchase_asset':
        case 'portfolio_fee_asset': {
            if (!isFinitePositive(intent.quantity)) throw new Error('Portfolio non-sale removal requires a positive quantity.');
            const quantity = normalizedQuantity(intent.quantity);
            const cost = removedCostDzd(intent.inventoryBefore, quantity);
            const pamBefore = getPortfolioPamBefore(intent.inventoryBefore);
            postings = [
                { id: 'removal-counterpart', account: removalCounterpart(intent.kind), side: 'debit', amountDzd: cost },
                assetPosting('portfolio-out', intent.currency, 'credit', cost, quantity, pamBefore),
            ];
            effects.quantityDeltas[intent.currency] = -quantity;
            effects.costBasisDeltasDzd[intent.currency] = -cost;
            // Explicit invariant: this is a cost-basis removal, never trading P&L.
            effects.realizedTradingProfitDzd = 0;
            break;
        }
        case 'portfolio_fee_cash': {
            if (!isFinitePositive(intent.amountDzd)) throw new Error('Portfolio cash fee requires a positive amount.');
            const amount = normalizedDzd(intent.amountDzd);
            postings = [
                { id: 'fee-expense', account: 'expense.trading_fee', side: 'debit', amountDzd: amount },
                { id: 'fee-cash', account: walletAccount(intent.wallet), side: 'credit', amountDzd: amount },
            ];
            effects.cashDeltasDzd[intent.wallet] = -amount;
            break;
        }
        case 'portfolio_asset_transfer': {
            if (!isFinitePositive(intent.quantity) || intent.fromLocation === intent.toLocation) throw new Error('Portfolio transfer requires a quantity and two locations.');
            const quantity = normalizedQuantity(intent.quantity);
            const cost = removedCostDzd(intent.inventoryBefore, quantity);
            const pamBefore = getPortfolioPamBefore(intent.inventoryBefore);
            postings = [
                assetPosting('transfer-in', intent.currency, 'debit', cost, quantity, pamBefore, intent.toLocation),
                assetPosting('transfer-out', intent.currency, 'credit', cost, quantity, pamBefore, intent.fromLocation),
            ];
            // This is one asset moved between locations; portfolio total is unchanged.
            break;
        }
    }
    return makeDraft(intent, postings, effects);
}

export function getPortfolioLedgerEffects(draft: Pick<AccountingOperationDraft, 'postings'>): PortfolioEffects {
    const effects = emptyEffects();
    for (const posting of draft.postings) {
        const sign = posting.side === 'debit' ? 1 : -1;
        if (posting.account === 'asset.portfolio.usdt' || posting.account === 'asset.portfolio.usdt.locked') {
            effects.quantityDeltas.USDT += sign * (posting.quantity || 0);
            effects.costBasisDeltasDzd.USDT += sign * posting.amountDzd;
        }
        if (posting.account === 'asset.portfolio.eur' || posting.account === 'asset.portfolio.eur.locked') {
            effects.quantityDeltas.EUR += sign * (posting.quantity || 0);
            effects.costBasisDeltasDzd.EUR += sign * posting.amountDzd;
        }
        if (posting.account === 'asset.cash.caisse') effects.cashDeltasDzd.Caisse += sign * posting.amountDzd;
        if (posting.account === 'asset.cash.baridimob') effects.cashDeltasDzd.BaridiMob += sign * posting.amountDzd;
        if (posting.account === 'asset.receivable.client') effects.clientReceivableDzd += sign * posting.amountDzd;
        if (posting.account === 'liability.client_payable') effects.clientPayableDzd += posting.side === 'credit' ? posting.amountDzd : -posting.amountDzd;
        if (posting.account === 'income.portfolio_sale') effects.realizedTradingProfitDzd += posting.amountDzd;
        if (posting.account === 'expense.portfolio_sale_loss') effects.realizedTradingProfitDzd -= posting.amountDzd;
        if (posting.account === 'income.fx_gain') effects.fxGainLossDzd += posting.amountDzd;
        if (posting.account === 'expense.fx_loss') effects.fxGainLossDzd -= posting.amountDzd;
    }
    CURRENCIES.forEach((currency) => {
        effects.quantityDeltas[currency] = normalizedQuantity(effects.quantityDeltas[currency]);
        effects.costBasisDeltasDzd[currency] = normalizedDzd(effects.costBasisDeltasDzd[currency]);
    });
    WALLETS.forEach((wallet) => { effects.cashDeltasDzd[wallet] = normalizedDzd(effects.cashDeltasDzd[wallet]); });
    effects.clientReceivableDzd = normalizedDzd(effects.clientReceivableDzd);
    effects.clientPayableDzd = normalizedDzd(effects.clientPayableDzd);
    effects.realizedTradingProfitDzd = normalizedDzd(effects.realizedTradingProfitDzd);
    effects.fxGainLossDzd = normalizedDzd(effects.fxGainLossDzd);
    return effects;
}

function compareNumber(label: string, legacy: number | undefined, ledger: number, mismatches: string[], quantity = false): void {
    if (legacy === undefined) return;
    const matches = quantity
        ? quantityAtoms(legacy) === quantityAtoms(ledger)
        : toCents(legacy) === toCents(ledger);
    if (!matches) mismatches.push(`${label}: Legacy ${legacy} != V2 ${ledger}.`);
}

/** Pure Legacy-versus-V2 comparison; partial Legacy facts are intentional. */
export function comparePortfolioShadow(intent: PortfolioShadowIntent, legacyFacts: LegacyPortfolioShadowFacts = {}): PortfolioShadowResult {
    const draft = buildPortfolioShadowDraft(intent);
    const ledgerEffects = getPortfolioLedgerEffects(draft);
    const integrityErrors = validateAccountingOperation(draft);
    const mismatches: string[] = [];
    CURRENCIES.forEach((currency) => {
        compareNumber(`${currency} quantity`, legacyFacts.quantityDeltas?.[currency], ledgerEffects.quantityDeltas[currency], mismatches, true);
        compareNumber(`${currency} cost basis`, legacyFacts.costBasisDeltasDzd?.[currency], ledgerEffects.costBasisDeltasDzd[currency], mismatches);
    });
    WALLETS.forEach((wallet) => compareNumber(`${wallet} cash`, legacyFacts.cashDeltasDzd?.[wallet], ledgerEffects.cashDeltasDzd[wallet], mismatches));
    compareNumber('Client receivable', legacyFacts.clientReceivableDzd, ledgerEffects.clientReceivableDzd, mismatches);
    compareNumber('Client payable', legacyFacts.clientPayableDzd, ledgerEffects.clientPayableDzd, mismatches);
    compareNumber('Trading profit', legacyFacts.realizedTradingProfitDzd, ledgerEffects.realizedTradingProfitDzd, mismatches);
    compareNumber('FX gain/loss', legacyFacts.fxGainLossDzd, ledgerEffects.fxGainLossDzd, mismatches);
    if (legacyFacts.warnings?.length) mismatches.push(...legacyFacts.warnings);
    if (integrityErrors.length) mismatches.push(...integrityErrors);
    return { intent, draft, ledgerEffects, legacyFacts, integrityErrors, mismatches, matches: mismatches.length === 0 };
}

/** Future V2 correction shape. It only builds an immutable inverse; it never writes. */
export function buildPortfolioShadowReversalDraft(original: AccountingOperationDraft, args: {
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
        metadata: { mode: 'shadow', domain: 'portfolioV2', immutable: true, reversalOf: original.operationId },
    };
}
