import { fromCents, toCents } from '../utils/money';
import { validateAccountingOperation } from './integrity';
import type { AccountingOperationDraft, LedgerAccount, LedgerPosting } from './types';

export type ServiceCashWallet = 'Caisse' | 'BaridiMob';
export type ServiceAssetWallet = 'USDT' | 'EUR';
export type ServicePurchaseWallet = ServiceCashWallet | ServiceAssetWallet | 'Credit';
export type ServiceSaleWallet = ServiceCashWallet | ServiceAssetWallet | 'Credit';
export type ServiceShadowKind = 'digital_service_sale' | 'manual_service_sale';

type AssetValue = {
    wallet: ServiceAssetWallet;
    quantity: number;
    /** Economic DZD value agreed for the service leg. */
    amountDzd: number;
};

type AssetPayment = AssetValue & {
    /** Portfolio PAM carrying value for the exact quantity removed. */
    assetCostBasisDzd: number;
};

type CashPayment = {
    wallet: ServiceCashWallet;
    amountDzd: number;
};

type CreditPurchase = { wallet: 'Credit'; amountDzd: number; supplierId?: string };
type CreditSale = { wallet: 'Credit'; amountDzd: number; clientId: string };
type ServicePurchasePayment = CashPayment | AssetPayment | CreditPurchase;
type ServiceSaleReceipt = CashPayment | AssetValue | CreditSale;

export type DirectServiceFee = (CashPayment | AssetPayment) & { amountDzd: number };

export type ServiceShadowIntent = {
    operationId: string;
    actorUid: string;
    effectiveAt: number;
    kind: ServiceShadowKind;
    clientId: string;
    serviceName?: string;
    purchase: ServicePurchasePayment;
    sale: ServiceSaleReceipt;
    directFees?: DirectServiceFee[];
    reason?: string;
};

export type ServiceShadowEffects = {
    serviceRevenueDzd: number;
    serviceCostDzd: number;
    directFeesDzd: number;
    serviceProfitDzd: number;
    fxGainLossDzd: number;
    cashDeltasDzd: Record<ServiceCashWallet, number>;
    portfolioValueDeltasDzd: Record<ServiceAssetWallet, number>;
    clientReceivableDzd: number;
    supplierPayableDzd: number;
};

export type LegacyServiceShadowFacts = Omit<Partial<ServiceShadowEffects>, 'cashDeltasDzd' | 'portfolioValueDeltasDzd'> & {
    cashDeltasDzd?: Partial<ServiceShadowEffects['cashDeltasDzd']>;
    portfolioValueDeltasDzd?: Partial<ServiceShadowEffects['portfolioValueDeltasDzd']>;
    warnings?: readonly string[];
};

export type ServiceShadowResult = {
    intent: ServiceShadowIntent;
    draft: AccountingOperationDraft;
    ledgerEffects: ServiceShadowEffects;
    legacyFacts: LegacyServiceShadowFacts;
    integrityErrors: string[];
    mismatches: string[];
    matches: boolean;
};

const CASH_WALLETS: readonly ServiceCashWallet[] = ['Caisse', 'BaridiMob'];
const ASSET_WALLETS: readonly ServiceAssetWallet[] = ['USDT', 'EUR'];
const money = (value: number) => fromCents(toCents(value));

function positive(value: number): boolean {
    return Number.isFinite(value) && toCents(value) > 0;
}

function walletAccount(wallet: ServiceCashWallet | ServiceAssetWallet): LedgerAccount {
    if (wallet === 'Caisse') return 'asset.cash.caisse';
    if (wallet === 'BaridiMob') return 'asset.cash.baridimob';
    return `asset.portfolio.${wallet.toLowerCase()}` as LedgerAccount;
}

function isAssetValue(payment: ServicePurchasePayment | ServiceSaleReceipt | DirectServiceFee): payment is AssetValue | AssetPayment {
    return payment.wallet === 'USDT' || payment.wallet === 'EUR';
}

function isAssetPurchase(payment: ServicePurchasePayment): payment is AssetPayment {
    return payment.wallet === 'USDT' || payment.wallet === 'EUR';
}

function isAssetFee(fee: DirectServiceFee): fee is AssetPayment {
    return fee.wallet === 'USDT' || fee.wallet === 'EUR';
}

function assertIdentity(intent: ServiceShadowIntent): void {
    if (!intent.operationId.trim() || !intent.actorUid.trim() || !intent.clientId.trim() || !Number.isFinite(intent.effectiveAt) || intent.effectiveAt <= 0) {
        throw new Error('Service shadow operation identity is invalid.');
    }
}

function assertEconomicPurchase(payment: ServicePurchasePayment): void {
    if (!positive(payment.amountDzd)) throw new Error('Service payment requires a positive DZD value.');
    if (isAssetPurchase(payment) && !positive(payment.quantity)) {
        throw new Error('Asset service payment requires a positive quantity.');
    }
    if (isAssetPurchase(payment) && !positive(payment.assetCostBasisDzd)) {
        throw new Error('Asset service payment requires positive quantity and PAM cost basis.');
    }
    if (payment.wallet === 'Credit' && !payment.supplierId) throw new Error('Credit service purchase requires an explicit supplier.');
}

function assertEconomicSale(receipt: ServiceSaleReceipt): void {
    if (!positive(receipt.amountDzd)) throw new Error('Service receipt requires a positive DZD value.');
    if (isAssetValue(receipt) && !positive(receipt.quantity)) throw new Error('Asset service receipt requires a positive quantity.');
    if (receipt.wallet === 'Credit' && !receipt.clientId) throw new Error('Credit service sale requires an explicit client.');
}

function emptyEffects(): ServiceShadowEffects {
    return {
        serviceRevenueDzd: 0,
        serviceCostDzd: 0,
        directFeesDzd: 0,
        serviceProfitDzd: 0,
        fxGainLossDzd: 0,
        cashDeltasDzd: { Caisse: 0, BaridiMob: 0 },
        portfolioValueDeltasDzd: { USDT: 0, EUR: 0 },
        clientReceivableDzd: 0,
        supplierPayableDzd: 0,
    };
}

function addFxPosting(postings: LedgerPosting[], id: string, economicValueDzd: number, basisDzd: number): number {
    const difference = money(economicValueDzd - basisDzd);
    if (difference > 0) postings.push({ id: `${id}:fx-gain`, account: 'income.fx_gain', side: 'credit', amountDzd: difference });
    if (difference < 0) postings.push({ id: `${id}:fx-loss`, account: 'expense.fx_loss', side: 'debit', amountDzd: Math.abs(difference) });
    return difference;
}

function paymentCreditPostings(payment: ServicePurchasePayment, postings: LedgerPosting[], effects: ServiceShadowEffects): void {
    const value = money(payment.amountDzd);
    if (payment.wallet === 'Credit') {
        postings.push({ id: 'purchase-payable', account: 'liability.supplier_payable', side: 'credit', amountDzd: value });
        effects.supplierPayableDzd = money(effects.supplierPayableDzd + value);
        return;
    }
    if (isAssetPurchase(payment)) {
        const basis = money(payment.assetCostBasisDzd);
        postings.push({ id: 'purchase-portfolio', account: walletAccount(payment.wallet), side: 'credit', amountDzd: basis, currency: payment.wallet, quantity: payment.quantity });
        effects.portfolioValueDeltasDzd[payment.wallet] = money(effects.portfolioValueDeltasDzd[payment.wallet] - basis);
        effects.fxGainLossDzd = money(effects.fxGainLossDzd + addFxPosting(postings, 'purchase', value, basis));
        return;
    }
    postings.push({ id: 'purchase-cash', account: walletAccount(payment.wallet), side: 'credit', amountDzd: value });
    effects.cashDeltasDzd[payment.wallet] = money(effects.cashDeltasDzd[payment.wallet] - value);
}

function saleDebitPostings(receipt: ServiceSaleReceipt, postings: LedgerPosting[], effects: ServiceShadowEffects): void {
    const value = money(receipt.amountDzd);
    if (receipt.wallet === 'Credit') {
        postings.push({ id: 'sale-receivable', account: 'asset.receivable.client', side: 'debit', amountDzd: value, clientId: receipt.clientId });
        effects.clientReceivableDzd = money(effects.clientReceivableDzd + value);
        return;
    }
    if (isAssetValue(receipt)) {
        postings.push({ id: 'sale-portfolio', account: walletAccount(receipt.wallet), side: 'debit', amountDzd: value, currency: receipt.wallet, quantity: receipt.quantity });
        effects.portfolioValueDeltasDzd[receipt.wallet] = money(effects.portfolioValueDeltasDzd[receipt.wallet] + value);
        return;
    }
    postings.push({ id: 'sale-cash', account: walletAccount(receipt.wallet), side: 'debit', amountDzd: value });
    effects.cashDeltasDzd[receipt.wallet] = money(effects.cashDeltasDzd[receipt.wallet] + value);
}

function feePostings(fee: DirectServiceFee, index: number, postings: LedgerPosting[], effects: ServiceShadowEffects): void {
    const value = money(fee.amountDzd);
    if (!positive(value)) throw new Error('Direct service fee requires a positive amount.');
    postings.push({ id: `fee:${index}`, account: 'expense.service_direct_fee', side: 'debit', amountDzd: value });
    effects.directFeesDzd = money(effects.directFeesDzd + value);
    if (isAssetFee(fee)) {
        const basis = money(fee.assetCostBasisDzd);
        postings.push({ id: `fee:${index}:portfolio`, account: walletAccount(fee.wallet), side: 'credit', amountDzd: basis, currency: fee.wallet, quantity: fee.quantity });
        effects.portfolioValueDeltasDzd[fee.wallet] = money(effects.portfolioValueDeltasDzd[fee.wallet] - basis);
        effects.fxGainLossDzd = money(effects.fxGainLossDzd + addFxPosting(postings, `fee:${index}`, value, basis));
    }
    else {
        postings.push({ id: `fee:${index}:cash`, account: walletAccount(fee.wallet), side: 'credit', amountDzd: value });
        effects.cashDeltasDzd[fee.wallet] = money(effects.cashDeltasDzd[fee.wallet] - value);
    }
}

/**
 * Pure service operation builder. A purchase creates service inventory, never
 * service profit. Profit is recognised only on the sale leg as revenue minus
 * service cost and direct fees. Asset-PAM differences are FX only.
 */
export function buildServiceShadowDraft(intent: ServiceShadowIntent): AccountingOperationDraft {
    assertIdentity(intent);
    assertEconomicPurchase(intent.purchase);
    assertEconomicSale(intent.sale);
    if (intent.sale.wallet === 'Credit' && intent.sale.clientId !== intent.clientId) throw new Error('Credit service sale must belong to the operation client.');
    const effects = emptyEffects();
    const purchaseCost = money(intent.purchase.amountDzd);
    const revenue = money(intent.sale.amountDzd);
    const postings: LedgerPosting[] = [
        { id: 'purchase-service-inventory', account: 'asset.service_inventory', side: 'debit', amountDzd: purchaseCost },
    ];
    effects.serviceCostDzd = purchaseCost;
    paymentCreditPostings(intent.purchase, postings, effects);
    saleDebitPostings(intent.sale, postings, effects);
    postings.push({ id: 'sale-service-inventory', account: 'asset.service_inventory', side: 'credit', amountDzd: purchaseCost });
    const grossMargin = money(revenue - purchaseCost);
    if (grossMargin >= 0) postings.push({ id: 'service-margin', account: 'income.digital_service_sale', side: 'credit', amountDzd: grossMargin });
    else postings.push({ id: 'service-loss', account: 'expense.digital_service_sale_loss', side: 'debit', amountDzd: Math.abs(grossMargin) });
    effects.serviceRevenueDzd = revenue;
    (intent.directFees || []).forEach((fee, index) => feePostings(fee, index, postings, effects));
    effects.serviceProfitDzd = money(revenue - purchaseCost - effects.directFeesDzd);
    return {
        operationId: intent.operationId,
        accountingVersion: 2,
        kind: 'digital_service_sale',
        status: 'posted',
        effectiveAt: intent.effectiveAt,
        actorUid: intent.actorUid,
        reason: intent.reason || `servicesV2 shadow: ${intent.kind}`,
        postings,
        projections: [],
        metadata: { mode: 'shadow', domain: 'servicesV2', shadowKind: intent.kind, effects },
    };
}

export function getServiceLedgerEffects(draft: Pick<AccountingOperationDraft, 'metadata'>): ServiceShadowEffects {
    const effects = draft.metadata?.effects as ServiceShadowEffects | undefined;
    if (!effects) throw new Error('Service shadow draft is missing its explicit effects.');
    return effects;
}

function compareNumber(label: string, legacy: number | undefined, shadow: number, mismatches: string[]): void {
    if (legacy !== undefined && toCents(legacy) !== toCents(shadow)) mismatches.push(`${label}: Legacy ${legacy} != V2 ${shadow}.`);
}

function compareWallets<T extends string>(label: string, legacy: Partial<Record<T, number>> | undefined, shadow: Record<T, number>, wallets: readonly T[], mismatches: string[]): void {
    if (!legacy) return;
    wallets.forEach((wallet) => compareNumber(`${label} ${wallet}`, legacy[wallet], shadow[wallet], mismatches));
}

/** Pure composite comparison; mismatches are diagnostics and never block Legacy. */
export function compareServiceShadow(intent: ServiceShadowIntent, legacyFacts: LegacyServiceShadowFacts = {}): ServiceShadowResult {
    const draft = buildServiceShadowDraft(intent);
    const ledgerEffects = getServiceLedgerEffects(draft);
    const integrityErrors = validateAccountingOperation(draft);
    const mismatches: string[] = [];
    compareNumber('Service revenue', legacyFacts.serviceRevenueDzd, ledgerEffects.serviceRevenueDzd, mismatches);
    compareNumber('Service cost', legacyFacts.serviceCostDzd, ledgerEffects.serviceCostDzd, mismatches);
    compareNumber('Direct service fees', legacyFacts.directFeesDzd, ledgerEffects.directFeesDzd, mismatches);
    compareNumber('Service profit', legacyFacts.serviceProfitDzd, ledgerEffects.serviceProfitDzd, mismatches);
    compareNumber('FX gain/loss', legacyFacts.fxGainLossDzd, ledgerEffects.fxGainLossDzd, mismatches);
    compareNumber('Client receivable', legacyFacts.clientReceivableDzd, ledgerEffects.clientReceivableDzd, mismatches);
    compareNumber('Supplier payable', legacyFacts.supplierPayableDzd, ledgerEffects.supplierPayableDzd, mismatches);
    compareWallets('Cash', legacyFacts.cashDeltasDzd, ledgerEffects.cashDeltasDzd, CASH_WALLETS, mismatches);
    compareWallets('Portfolio', legacyFacts.portfolioValueDeltasDzd, ledgerEffects.portfolioValueDeltasDzd, ASSET_WALLETS, mismatches);
    if (legacyFacts.warnings?.length) mismatches.push(...legacyFacts.warnings);
    if (integrityErrors.length) mismatches.push(...integrityErrors);
    return { intent, draft, ledgerEffects, legacyFacts, integrityErrors, mismatches, matches: mismatches.length === 0 };
}
