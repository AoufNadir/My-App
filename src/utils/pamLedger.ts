import type { LockedBatch, PortfolioStats, Tx } from '../types';
export type PamCurrency = 'USDT' | 'EUR';
export type PamLedgerWarningCode = 'stored_mismatch' | 'oversell' | 'manual_total_present' | 'quantity_only_adjustment' | 'uncosted_quantity_sold' | 'legacy_fallback' | 'eur_conversion_related' | 'missing_buy_total';
export type PamLedgerWarningSeverity = 'info' | 'warning' | 'high';
export interface PamLedgerOptions {
    toleranceDzd?: number;
    zeroEpsilon?: number;
    conversionWindowMs?: number;
    /** Clock used to evaluate buy.lockedUntil (24h restriction). Defaults to Date.now(). */
    nowMs?: number;
    /**
     * USDT bought with EUR from this time on costs what leaves the EUR stock: the EUR
     * quantity times the EUR PAM of the ledger at that moment, not the total saved at
     * entry. Defaults to EUR_FUNDED_COST_RULE_FROM_TS.
     */
    eurFundedCostFromTs?: number;
}
/** 0: every USDT purchase paid in EUR follows the EUR PAM of the ledger. */
export const EUR_FUNDED_COST_RULE_FROM_TS = 0;
export interface PamLedgerEurFundedBuy {
    buyTxId: string;
    withdrawalTxId: string;
    timestamp: number;
    eurQuantity: number;
    /** EUR PAM of the ledger just before the EUR left the stock. */
    eurAvgBuy: number;
    /** Total saved on the buy at entry. */
    storedTotal: number;
    /** Cost the ledger gives the USDT: eurQuantity x eurAvgBuy when the rule applies. */
    ledgerCost: number;
    applied: boolean;
}
export interface PamLedgerFlags {
    storedMismatch: boolean;
    oversell: boolean;
    manualTotalPresent: boolean;
    quantityOnlyAdjustment: boolean;
    uncostedQuantitySold: boolean;
    legacyFallback: boolean;
    eurConversionRelated: boolean;
}
export interface PamLedgerStats {
    purchasedQty: number;
    costBasis: number;
    avgBuy: number;
    totalProfit: number;
    available: number;
}
export interface PamLedgerWarning {
    txId: string;
    currency: PamCurrency;
    code: PamLedgerWarningCode;
    severity: PamLedgerWarningSeverity;
    message: string;
}
export interface PamLedgerOperationRow {
    txId: string;
    tx: Tx;
    index: number;
    type: Tx['type'];
    currency: PamCurrency;
    date: string;
    time: string;
    timestamp: number;
    quantity: number;
    quantityChange: number;
    costBasisChange: number;
    statsBefore: PamLedgerStats;
    statsAfter: PamLedgerStats;
    flags: PamLedgerFlags;
    warnings: PamLedgerWarning[];
}
export interface PamLedgerSellProfitRow extends PamLedgerOperationRow {
    type: 'sell';
    settlementCurrency: 'DZD' | 'EUR';
    sellPrice: number;
    sellPriceEur: number | null;
    sellTotal: number;
    saleValueEur: number | null;
    saleValueDzd: number;
    eurToDzdRateAtSale: number | null;
    historicalAvgBuy: number;
    soldCostDzd: number;
    profitMarginPercent: number | null;
    costedQuantityBeforeSell: number;
    quantityWithoutCostBasis: number;
    storedProfit: number | null;
    hasStoredProfit: boolean;
    derivedProfit: number;
    difference: number | null;
}
export interface PamLedgerResult {
    portfolioStats: PortfolioStats;
    operationRows: PamLedgerOperationRow[];
    sellProfitRows: PamLedgerSellProfitRow[];
    profitByTxId: Record<string, PamLedgerSellProfitRow>;
    totals: {
        derivedProfit: number;
        storedProfit: number;
        difference: number;
        byCurrency: Record<PamCurrency, {
            derivedProfit: number;
            storedProfit: number;
            difference: number;
        }>;
    };
    warnings: PamLedgerWarning[];
    /** USDT purchases paid with EUR through a linked EUR withdrawal. */
    eurFundedBuys: PamLedgerEurFundedBuy[];
}
type WorkingStats = {
    purchasedQty: number;
    costBasis: number;
    totalProfit: number;
    available: number;
    locked: number;
    lockedBatches: LockedBatch[];
};
type InternalTx = Tx & {
    __ledgerIndex: number;
};
const DEFAULT_TOLERANCE_DZD = 1;
const DEFAULT_ZERO_EPSILON = 0.005;
const DEFAULT_CONVERSION_WINDOW_MS = 60000;
const CURRENCIES: PamCurrency[] = ['USDT', 'EUR'];
function round2(value: number): number {
    return Number(Number(value || 0).toFixed(2));
}
function round4(value: number): number {
    return Number(Number(value || 0).toFixed(4));
}
function normalizeZero(value: number, zeroEpsilon: number): number {
    const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
    return Object.is(safe, -0) || Math.abs(safe) < zeroEpsilon ? 0 : round2(safe);
}
function asNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function isFinitePositive(value: unknown): boolean {
    return Number.isFinite(Number(value)) && Number(value) > 0;
}
function createWorkingStats(): WorkingStats {
    return { purchasedQty: 0, costBasis: 0, totalProfit: 0, available: 0, locked: 0, lockedBatches: [] };
}
function toLedgerStats(stats: WorkingStats, zeroEpsilon: number): PamLedgerStats {
    const purchasedQty = normalizeZero(stats.purchasedQty, zeroEpsilon);
    const costBasis = purchasedQty === 0 ? 0 : normalizeZero(stats.costBasis, zeroEpsilon);
    const avgBuy = purchasedQty > 0 ? costBasis / purchasedQty : 0;
    return {
        purchasedQty,
        costBasis,
        avgBuy: normalizeZero(avgBuy, zeroEpsilon),
        totalProfit: normalizeZero(stats.totalProfit, zeroEpsilon),
        available: normalizeZero(stats.available, zeroEpsilon),
    };
}
function normalizeCurrency(currency: unknown): PamCurrency {
    return currency === 'EUR' ? 'EUR' : 'USDT';
}
function getTxId(tx: Tx, index: number): string {
    return tx.id || `(row-${index + 1})`;
}
function getTxQuantity(tx: Tx): number {
    // FIX-9 hybrid (Q2 final 2026-05-09): UI/handlers force integer entry for new data,
    // but the ledger keeps round2 here so historical decimal quantities (e.g. EUR↔USDT
    // conversions like 1760.644418872267) preserve their derived PAM profit. Required
    // for the jGd0 reference (derivedProfit = 849).
    return round2(Math.abs(asNumber(tx.quantity, 0)));
}
function sortTransactions(transactions: Tx[]): InternalTx[] {
    return transactions
        .map((tx, index) => ({ ...tx, currency: normalizeCurrency(tx.currency), __ledgerIndex: index }))
        .sort((a, b) => {
        const timestampDiff = asNumber(a.timestamp, 0) - asNumber(b.timestamp, 0);
        if (timestampDiff !== 0)
            return timestampDiff;
        return a.__ledgerIndex - b.__ledgerIndex;
    }) as InternalTx[];
}
function createFlags(): PamLedgerFlags {
    return {
        storedMismatch: false,
        oversell: false,
        manualTotalPresent: false,
        quantityOnlyAdjustment: false,
        uncostedQuantitySold: false,
        legacyFallback: false,
        eurConversionRelated: false,
    };
}
function makeWarning(txId: string, currency: PamCurrency, code: PamLedgerWarningCode, severity: PamLedgerWarningSeverity, message: string): PamLedgerWarning {
    return { txId, currency, code, severity, message };
}
function hasConversionNote(tx: Tx): boolean {
    return String(tx.notes || '').toLowerCase().includes('achat de');
}
function findEurConversionRelatedTxIds(transactions: InternalTx[], conversionWindowMs: number): Set<string> {
    const relatedIds = new Set<string>();
    const eurWithdrawals = transactions.filter((tx) => (normalizeCurrency(tx.currency) === 'EUR'
        && tx.type === 'Retrait Manuel'
        && (hasConversionNote(tx) || Boolean(tx.linkedTxId))));
    const usdtBuys = transactions.filter((tx) => normalizeCurrency(tx.currency) === 'USDT' && tx.type === 'buy');
    for (const withdrawal of eurWithdrawals) {
        const withdrawalId = getTxId(withdrawal, withdrawal.__ledgerIndex);
        const linkedBuy = usdtBuys.find((buy) => {
            const buyId = getTxId(buy, buy.__ledgerIndex);
            const linked = withdrawal.linkedTxId === buyId || buy.linkedTxId === withdrawalId;
            const nearInTime = Math.abs(asNumber(buy.timestamp) - asNumber(withdrawal.timestamp)) <= conversionWindowMs;
            return linked || nearInTime;
        });
        if (linkedBuy) {
            relatedIds.add(withdrawalId);
            relatedIds.add(getTxId(linkedBuy, linkedBuy.__ledgerIndex));
        }
    }
    return relatedIds;
}
/**
 * USDT buys paid with EUR (a linked EUR "Retrait Manuel" carries the buy id) and the EUR
 * PAM at the moment that EUR left the stock. The EUR stock never depends on USDT rows, so
 * a ledger of the EUR rows alone gives that PAM even when an old edit moved the EUR row
 * after the buy.
 */
function findEurFundedBuys(transactions: InternalTx[], options: PamLedgerOptions, fromTs: number): Map<string, PamLedgerEurFundedBuy> {
    const result = new Map<string, PamLedgerEurFundedBuy>();
    const usdtBuysById = new Map<string, InternalTx>();
    for (const tx of transactions) {
        if (tx.type === 'buy' && normalizeCurrency(tx.currency) === 'USDT' && tx.id)
            usdtBuysById.set(tx.id, tx);
    }
    const withdrawalsByBuyId = new Map<string, InternalTx[]>();
    for (const tx of transactions) {
        if (tx.type !== 'Retrait Manuel' || normalizeCurrency(tx.currency) !== 'EUR' || !tx.linkedTxId || !usdtBuysById.has(tx.linkedTxId))
            continue;
        withdrawalsByBuyId.set(tx.linkedTxId, [...(withdrawalsByBuyId.get(tx.linkedTxId) || []), tx]);
    }
    if (withdrawalsByBuyId.size === 0)
        return result;
    const eurRows = transactions.filter((tx) => normalizeCurrency(tx.currency) === 'EUR');
    const eurLedger = computePamLedger(eurRows, { ...options, eurFundedCostFromTs: Number.POSITIVE_INFINITY });
    const eurRowById = new Map(eurLedger.operationRows.map((row) => [row.txId, row]));
    for (const [buyId, withdrawals] of withdrawalsByBuyId) {
        // One EUR row per conversion; anything else keeps the saved total.
        if (withdrawals.length !== 1)
            continue;
        const withdrawal = withdrawals[0];
        const buy = usdtBuysById.get(buyId)!;
        const eurRow = eurRowById.get(getTxId(withdrawal, withdrawal.__ledgerIndex));
        if (!eurRow)
            continue;
        const { costBasis, purchasedQty } = eurRow.statsBefore;
        const eurAvgBuy = purchasedQty > 0 ? costBasis / purchasedQty : 0;
        const storedTotal = round2(asNumber(buy.total, 0));
        const timestamp = asNumber(buy.timestamp, 0);
        const applied = timestamp >= fromTs && eurAvgBuy > 0;
        result.set(buyId, {
            buyTxId: buyId,
            withdrawalTxId: eurRow.txId,
            timestamp,
            eurQuantity: eurRow.quantity,
            eurAvgBuy: round4(eurAvgBuy),
            storedTotal,
            ledgerCost: applied ? round2(eurRow.quantity * eurAvgBuy) : storedTotal,
            applied,
        });
    }
    return result;
}
function buildPortfolioStats(statsByCurrency: Record<PamCurrency, WorkingStats>, zeroEpsilon: number): PortfolioStats {
    const usdt = toLedgerStats(statsByCurrency.USDT, zeroEpsilon);
    const eur = toLedgerStats(statsByCurrency.EUR, zeroEpsilon);
    return {
        usdt: { ...usdt, locked: normalizeZero(statsByCurrency.USDT.locked, zeroEpsilon), lockedBatches: statsByCurrency.USDT.lockedBatches },
        eur: { ...eur, locked: normalizeZero(statsByCurrency.EUR.locked, zeroEpsilon), lockedBatches: statsByCurrency.EUR.lockedBatches },
    };
}
export function computePamLedger(transactions: Tx[], options: PamLedgerOptions = {}): PamLedgerResult {
    const toleranceDzd = options.toleranceDzd ?? DEFAULT_TOLERANCE_DZD;
    const zeroEpsilon = options.zeroEpsilon ?? DEFAULT_ZERO_EPSILON;
    const conversionWindowMs = options.conversionWindowMs ?? DEFAULT_CONVERSION_WINDOW_MS;
    const nowMs = options.nowMs ?? Date.now();
    const orderedTransactions = sortTransactions(transactions);
    const eurConversionRelatedIds = findEurConversionRelatedTxIds(orderedTransactions, conversionWindowMs);
    const eurFundedBuys = findEurFundedBuys(orderedTransactions, { ...options, nowMs }, options.eurFundedCostFromTs ?? EUR_FUNDED_COST_RULE_FROM_TS);
    const statsByCurrency: Record<PamCurrency, WorkingStats> = {
        USDT: createWorkingStats(),
        EUR: createWorkingStats(),
    };
    const operationRows: PamLedgerOperationRow[] = [];
    const sellProfitRows: PamLedgerSellProfitRow[] = [];
    const profitByTxId: Record<string, PamLedgerSellProfitRow> = {};
    const warnings: PamLedgerWarning[] = [];
    const seenEurConversionBuy: Record<PamCurrency, boolean> = { USDT: false, EUR: false };
    for (const tx of orderedTransactions) {
        const txId = getTxId(tx, tx.__ledgerIndex);
        const currency = normalizeCurrency(tx.currency);
        const stats = statsByCurrency[currency];
        const quantity = getTxQuantity(tx);
        if (quantity <= 0)
            continue;
        const flags = createFlags();
        const rowWarnings: PamLedgerWarning[] = [];
        const statsBefore = toLedgerStats(stats, zeroEpsilon);
        let quantityChange = 0;
        let costBasisChange = 0;
        let sellRowData: Omit<PamLedgerSellProfitRow, keyof PamLedgerOperationRow> | null = null;
        if (eurConversionRelatedIds.has(txId) || (tx.type === 'sell' && seenEurConversionBuy[currency])) {
            flags.eurConversionRelated = true;
            rowWarnings.push(makeWarning(txId, currency, 'eur_conversion_related', 'info', 'Transaction is linked to, or follows, an observed EUR -> USDT conversion in the ledger history.'));
        }
        if (tx.type === 'Ajout Manuel' && !isFinitePositive(tx.total)) {
            flags.quantityOnlyAdjustment = true;
            rowWarnings.push(makeWarning(txId, currency, 'quantity_only_adjustment', 'info', 'Manual stock adjustment changes quantity without adding cost basis.'));
        }
        if (tx.type === 'sell') {
            const avgBefore = statsBefore.purchasedQty > 0 ? statsBefore.costBasis / statsBefore.purchasedQty : 0;
            const sellPrice = asNumber(tx.sell, 0);
            const settlementCurrency = currency === 'USDT' && tx.settlementCurrency === 'EUR' ? 'EUR' : 'DZD';
            const sellPriceEur = settlementCurrency === 'EUR' && isFinitePositive(tx.sellPriceEur)
                ? asNumber(tx.sellPriceEur)
                : null;
            const saleValueEur = settlementCurrency === 'EUR' && isFinitePositive(tx.saleValueEur)
                ? asNumber(tx.saleValueEur)
                : (settlementCurrency === 'EUR' && sellPriceEur !== null ? quantity * sellPriceEur : null);
            const eurToDzdRateAtSale = settlementCurrency === 'EUR' && isFinitePositive(tx.eurToDzdRateAtSale)
                ? asNumber(tx.eurToDzdRateAtSale)
                : null;
            const formulaSellTotal = quantity * sellPrice;
            const txTotal = asNumber(tx.total, 0);
            flags.manualTotalPresent = isFinitePositive(tx.total) && Math.abs(txTotal - formulaSellTotal) > toleranceDzd;
            const sellTotal = flags.manualTotalPresent ? txTotal : formulaSellTotal;
            const effectiveSellPrice = quantity > 0 ? sellTotal / quantity : sellPrice;
            const quantityWithoutCostBasis = Math.max(0, quantity - statsBefore.purchasedQty);
            flags.oversell = quantity > statsBefore.available + zeroEpsilon;
            flags.uncostedQuantitySold = quantityWithoutCostBasis > zeroEpsilon;
            flags.legacyFallback = statsBefore.purchasedQty <= zeroEpsilon || !isFinitePositive(effectiveSellPrice);
            const derivedProfit = flags.legacyFallback && !isFinitePositive(effectiveSellPrice)
                ? 0
                : round2((effectiveSellPrice - avgBefore) * quantity);
            const soldCostDzd = round2(avgBefore * quantity);
            const profitMarginPercent = soldCostDzd > 0 ? round2((derivedProfit / soldCostDzd) * 100) : null;
            const hasStoredProfit = Number.isFinite(Number(tx.profit));
            const storedProfit = hasStoredProfit ? round2(asNumber(tx.profit)) : null;
            const difference = storedProfit === null ? null : round2(storedProfit - derivedProfit);
            flags.storedMismatch = difference !== null && Math.abs(difference) > toleranceDzd;
            if (flags.manualTotalPresent) {
                rowWarnings.push(makeWarning(txId, currency, 'manual_total_present', 'info', 'Sell total differs from quantity x sell price and is used as sale revenue.'));
            }
            if (flags.oversell) {
                rowWarnings.push(makeWarning(txId, currency, 'oversell', 'high', 'Sell quantity exceeds available historical stock before the transaction.'));
            }
            if (flags.uncostedQuantitySold) {
                rowWarnings.push(makeWarning(txId, currency, 'uncosted_quantity_sold', flags.oversell ? 'high' : 'warning', 'Sell quantity includes units without historical cost basis, usually from quantity-only manual stock adjustments or stock gaps.'));
            }
            if (flags.legacyFallback) {
                rowWarnings.push(makeWarning(txId, currency, 'legacy_fallback', 'warning', 'Historical PAM has missing cost basis or invalid sell revenue before this sell.'));
            }
            if (flags.storedMismatch) {
                rowWarnings.push(makeWarning(txId, currency, 'stored_mismatch', Math.abs(difference || 0) > 1000 ? 'high' : 'warning', 'Stored tx.profit differs from historical derived PAM profit.'));
            }
            sellRowData = {
                settlementCurrency,
                sellPrice: round2(sellPrice),
                sellPriceEur: sellPriceEur === null ? null : round4(sellPriceEur),
                sellTotal: round2(sellTotal),
                saleValueEur: saleValueEur === null ? null : round2(saleValueEur),
                saleValueDzd: round2(sellTotal),
                eurToDzdRateAtSale: eurToDzdRateAtSale === null ? null : round2(eurToDzdRateAtSale),
                historicalAvgBuy: round2(avgBefore),
                soldCostDzd,
                profitMarginPercent,
                costedQuantityBeforeSell: statsBefore.purchasedQty,
                quantityWithoutCostBasis: round2(quantityWithoutCostBasis),
                storedProfit,
                hasStoredProfit,
                derivedProfit,
                difference,
            };
            stats.totalProfit = round2(stats.totalProfit + derivedProfit);
        }
        if (tx.type === 'buy' || tx.type === 'Ajout Manuel') {
            const isStillLocked = tx.type === 'buy' && isFinitePositive(tx.lockedUntil) && Number(tx.lockedUntil) > nowMs;
            if (isStillLocked) {
                stats.locked = round2(stats.locked + quantity);
                stats.lockedBatches.push({ txId: tx.id, quantity, lockedUntil: Number(tx.lockedUntil) });
            } else {
                stats.available = round2(stats.available + quantity);
            }
            quantityChange = quantity;
        }
        else {
            stats.available = round2(stats.available - quantity);
            quantityChange = -quantity;
        }
        if (tx.type === 'Ajout Manuel' && isFinitePositive(tx.total)) {
            const total = round2(asNumber(tx.total));
            stats.purchasedQty = round2(stats.purchasedQty + quantity);
            stats.costBasis = round2(stats.costBasis + total);
            costBasisChange = total;
        }
        else if (tx.type === 'buy') {
            const eurFundedBuy = currency === 'USDT' ? eurFundedBuys.get(txId) : undefined;
            const total = eurFundedBuy ? eurFundedBuy.ledgerCost : round2(asNumber(tx.total, 0));
            stats.purchasedQty = round2(stats.purchasedQty + quantity);
            stats.costBasis = round2(stats.costBasis + total);
            costBasisChange = total;
            if (!isFinitePositive(total)) {
                rowWarnings.push(makeWarning(txId, currency, 'missing_buy_total', 'warning', 'Buy transaction does not add a positive cost basis.'));
            }
        }
        else if (tx.type === 'sell' || tx.type === 'Retrait Manuel') {
            const avgBuy = statsBefore.purchasedQty > 0 ? statsBefore.costBasis / statsBefore.purchasedQty : 0;
            const removedQty = Math.min(quantity, statsBefore.purchasedQty);
            const removedCost = round2(removedQty * avgBuy);
            stats.purchasedQty = round2(stats.purchasedQty - removedQty);
            stats.costBasis = round2(stats.costBasis - removedCost);
            costBasisChange = -removedCost;
            if (stats.purchasedQty < 0.00001) {
                stats.purchasedQty = 0;
                stats.costBasis = 0;
            }
        }
        // Mirror useAppData's in-loop reset: only wipe cost basis when BOTH
        // available and locked have drained, otherwise a freshly locked buy
        // followed by a sell of older stock would erase the locked batch's basis.
        if (Math.abs(stats.available) < zeroEpsilon && stats.locked < zeroEpsilon) {
            stats.available = 0;
            stats.purchasedQty = 0;
            stats.costBasis = 0;
        }
        const statsAfter = toLedgerStats(stats, zeroEpsilon);
        const operationRow: PamLedgerOperationRow = {
            txId,
            tx,
            index: tx.__ledgerIndex,
            type: tx.type,
            currency,
            date: tx.date,
            time: tx.time,
            timestamp: asNumber(tx.timestamp, 0),
            quantity,
            quantityChange: round2(quantityChange),
            costBasisChange: round2(costBasisChange),
            statsBefore,
            statsAfter,
            flags,
            warnings: rowWarnings,
        };
        operationRows.push(operationRow);
        warnings.push(...rowWarnings);
        if (sellRowData) {
            const sellProfitRow: PamLedgerSellProfitRow = {
                ...operationRow,
                ...sellRowData,
                type: 'sell',
            };
            sellProfitRows.push(sellProfitRow);
            profitByTxId[txId] = sellProfitRow;
        }
        if (eurConversionRelatedIds.has(txId) && tx.type === 'buy' && currency === 'USDT') {
            seenEurConversionBuy.USDT = true;
        }
    }
    for (const currency of CURRENCIES) {
        const stats = statsByCurrency[currency];
        stats.available = normalizeZero(stats.available, zeroEpsilon);
        stats.locked = normalizeZero(stats.locked, zeroEpsilon);
        if (stats.available === 0 && stats.locked === 0) {
            stats.purchasedQty = 0;
            stats.costBasis = 0;
        }
        stats.purchasedQty = normalizeZero(stats.purchasedQty, zeroEpsilon);
        stats.costBasis = stats.purchasedQty === 0 ? 0 : normalizeZero(stats.costBasis, zeroEpsilon);
        stats.totalProfit = normalizeZero(stats.totalProfit, zeroEpsilon);
    }
    const byCurrency = CURRENCIES.reduce((acc, currency) => {
        const rows = sellProfitRows.filter((row) => row.currency === currency);
        const derivedProfit = round2(rows.reduce((sum, row) => sum + row.derivedProfit, 0));
        const storedProfit = round2(rows.reduce((sum, row) => sum + (row.storedProfit || 0), 0));
        acc[currency] = {
            derivedProfit,
            storedProfit,
            difference: round2(storedProfit - derivedProfit),
        };
        return acc;
    }, {} as PamLedgerResult['totals']['byCurrency']);
    const derivedProfit = round2(CURRENCIES.reduce((sum, currency) => sum + byCurrency[currency].derivedProfit, 0));
    const storedProfit = round2(CURRENCIES.reduce((sum, currency) => sum + byCurrency[currency].storedProfit, 0));
    return {
        portfolioStats: buildPortfolioStats(statsByCurrency, zeroEpsilon),
        operationRows,
        sellProfitRows,
        profitByTxId,
        totals: {
            derivedProfit,
            storedProfit,
            difference: round2(storedProfit - derivedProfit),
            byCurrency,
        },
        warnings,
        eurFundedBuys: [...eurFundedBuys.values()],
    };
}
export interface EurFundedCostImpact {
    /** USDT purchases paid in EUR whose cost follows the EUR PAM. */
    buyCount: number;
    /** Purchases whose cost moved by 1 DZD or more. */
    changedBuyCount: number;
    /** Cost of those USDT minus the totals saved at entry. */
    costChangeDzd: number;
    /** Cumulative trading profit minus what the saved totals gave. */
    profitChangeDzd: number;
    usdtAvgBuyWithSavedTotals: number;
    usdtAvgBuy: number;
}
/** What the EUR PAM rule changes compared with the totals saved at entry; null when nothing moves. */
export function summarizeEurFundedCostImpact(transactions: Tx[], options: PamLedgerOptions = {}): EurFundedCostImpact | null {
    const nowMs = options.nowMs ?? Date.now();
    const ledger = computePamLedger(transactions, { ...options, nowMs });
    const applied = ledger.eurFundedBuys.filter((buy) => buy.applied);
    if (!applied.some((buy) => Math.abs(buy.ledgerCost - buy.storedTotal) >= 0.01))
        return null;
    const withSavedTotals = computePamLedger(transactions, { ...options, nowMs, eurFundedCostFromTs: Number.POSITIVE_INFINITY });
    return {
        buyCount: applied.length,
        changedBuyCount: applied.filter((buy) => Math.abs(buy.ledgerCost - buy.storedTotal) >= 1).length,
        costChangeDzd: round2(applied.reduce((sum, buy) => sum + buy.ledgerCost - buy.storedTotal, 0)),
        profitChangeDzd: round2(ledger.totals.derivedProfit - withSavedTotals.totals.derivedProfit),
        usdtAvgBuyWithSavedTotals: withSavedTotals.portfolioStats.usdt.avgBuy,
        usdtAvgBuy: ledger.portfolioStats.usdt.avgBuy,
    };
}
