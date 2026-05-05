/**
 * Pure financial calculation functions extracted for testability and centralization.
 * These functions contain NO React/Firebase dependencies.
 */

// ─── Helpers ─────────────────────────────────────────────────────────

export const round2 = (value: number): number => Number(value.toFixed(2));

export const normalizeZero = (value: number): number =>
    Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : round2(value);

// ─── PAM (Prix d'Achat Moyen) ────────────────────────────────────────

export interface CurrencyStats {
    costBasis: number;
    purchasedQty: number;
    available: number;
    totalProfit: number;
    avgBuy: number;
}

export interface PortfolioStatsResult {
    usdt: CurrencyStats;
    eur: CurrencyStats;
}

export interface TxRecord {
    type: 'buy' | 'sell' | 'Ajout Manuel' | 'Retrait Manuel';
    currency: 'USDT' | 'EUR';
    quantity: number;
    total?: number;
    sell?: number;
    profit?: number;
}

export function computePortfolioStats(transactions: TxRecord[]): PortfolioStatsResult {
    const createInitialStats = (): CurrencyStats => ({
        costBasis: 0, purchasedQty: 0, available: 0, totalProfit: 0, avgBuy: 0,
    });

    let usdtStats = createInitialStats();
    let eurStats = createInitialStats();

    for (const tx of transactions) {
        const stats = tx.currency === 'USDT' ? usdtStats : eurStats;
        const txQuantity = round2(Math.abs(Number(tx.quantity || 0)));
        const txTotal = round2(Number(tx.total || 0));
        if (txQuantity <= 0) continue;

        // Update available quantity
        if (tx.type === 'buy' || tx.type === 'Ajout Manuel') {
            stats.available = round2(stats.available + txQuantity);
        } else {
            stats.available = round2(stats.available - txQuantity);
        }

        // Update cost basis & profit
        if (tx.type === 'Ajout Manuel' && txTotal > 0) {
            stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
            stats.costBasis = round2(stats.costBasis + txTotal);
        } else if (tx.type === 'buy') {
            stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
            stats.costBasis = round2(stats.costBasis + txTotal);
        } else if (tx.type === 'sell' || tx.type === 'Retrait Manuel') {
            const avgBuy = stats.purchasedQty > 0 ? stats.costBasis / stats.purchasedQty : 0;
            const removedQty = Math.min(txQuantity, stats.purchasedQty);

            // Track realized profit for sell transactions
            if (tx.type === 'sell') {
                const sellPrice = Number(tx.sell);
                if (removedQty > 0 && Number.isFinite(sellPrice) && sellPrice > 0) {
                    const realized = (sellPrice - avgBuy) * removedQty;
                    if (tx.currency === 'USDT') {
                        usdtStats.totalProfit = round2(usdtStats.totalProfit + realized);
                    } else {
                        eurStats.totalProfit = round2(eurStats.totalProfit + realized);
                    }
                } else {
                    // Fallback for legacy rows
                    if (tx.currency === 'USDT') {
                        usdtStats.totalProfit = round2(usdtStats.totalProfit + Number(tx.profit || 0));
                    } else {
                        eurStats.totalProfit = round2(eurStats.totalProfit + Number(tx.profit || 0));
                    }
                }
            }

            stats.purchasedQty = round2(stats.purchasedQty - removedQty);
            stats.costBasis = round2(stats.costBasis - removedQty * avgBuy);
            if (stats.purchasedQty < 0.00001) {
                stats.purchasedQty = 0;
                stats.costBasis = 0;
            }
        }
    }

    // Normalize
    usdtStats.available = normalizeZero(usdtStats.available);
    eurStats.available = normalizeZero(eurStats.available);

    if (usdtStats.available === 0) { usdtStats.purchasedQty = 0; usdtStats.costBasis = 0; }
    if (eurStats.available === 0) { eurStats.purchasedQty = 0; eurStats.costBasis = 0; }

    usdtStats.purchasedQty = normalizeZero(usdtStats.purchasedQty);
    eurStats.purchasedQty = normalizeZero(eurStats.purchasedQty);
    usdtStats.costBasis = normalizeZero(usdtStats.costBasis);
    eurStats.costBasis = normalizeZero(eurStats.costBasis);

    if (usdtStats.purchasedQty === 0) usdtStats.costBasis = 0;
    if (eurStats.purchasedQty === 0) eurStats.costBasis = 0;

    usdtStats.avgBuy = usdtStats.purchasedQty > 0 ? usdtStats.costBasis / usdtStats.purchasedQty : 0;
    eurStats.avgBuy = eurStats.purchasedQty > 0 ? eurStats.costBasis / eurStats.purchasedQty : 0;
    usdtStats.avgBuy = normalizeZero(usdtStats.avgBuy);
    eurStats.avgBuy = normalizeZero(eurStats.avgBuy);
    usdtStats.totalProfit = normalizeZero(usdtStats.totalProfit);
    eurStats.totalProfit = normalizeZero(eurStats.totalProfit);

    return { usdt: usdtStats, eur: eurStats };
}

// ─── Client Balance ──────────────────────────────────────────────────

export interface ClientTxRecord {
    clientId: string;
    montant: number;
    affectsBalance?: boolean;
}

export function computeClientBalances(
    clientIds: string[],
    transactions: ClientTxRecord[]
): Map<string, number> {
    const balances = new Map<string, number>();
    clientIds.forEach(id => balances.set(id, 0));
    transactions.forEach(tx => {
        if (tx.affectsBalance === false) return;
        balances.set(tx.clientId, (balances.get(tx.clientId) || 0) + tx.montant);
    });
    return balances;
}

// ─── Investor Profit Distribution ────────────────────────────────────

export interface InvestorRecord {
    id: string;
    entryDate: string;
    capitalInvested: number;
    initialCapital: number;
    isActive: boolean;
}

export interface InvestorTxRecord {
    investorId: string;
    type: 'deposit_capital' | 'withdraw_capital' | 'reinvest_profit' | 'withdraw_profit' | 'profit_distribution';
    amount: number;
    timestamp: number;
}

export interface SellTxRecord {
    profit: number;
    timestamp: number;
}

export interface DerivedInvestorResult {
    id: string;
    capitalInvested: number;
    sharePercentage: number;
    totalProfit: number;
    availableProfit: number;
    withdrawnProfit: number;
    reinvestedProfit: number;
}

export function computeInvestorProfits(
    investors: InvestorRecord[],
    investorTransactions: InvestorTxRecord[],
    sellTransactions: SellTxRecord[],
    managerFeePercentage: number
): DerivedInvestorResult[] {
    const toMs = (value: any): number => {
        if (typeof value === 'number') return value;
        if (value && typeof value.toMillis === 'function') return value.toMillis();
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const managerFeeRatio = Math.max(0, Math.min(1, managerFeePercentage / 100));

    // Pre-group transactions by investor
    const txByInvestor = new Map<string, InvestorTxRecord[]>();
    for (const tx of investorTransactions) {
        const list = txByInvestor.get(tx.investorId) || [];
        list.push(tx);
        txByInvestor.set(tx.investorId, list);
    }

    // Build investor base
    const investorsBase = investors.map(inv => {
        const myTxs = txByInvestor.get(inv.id) || [];
        const movementTxs = myTxs.filter(tx =>
            tx.type === 'deposit_capital' ||
            tx.type === 'reinvest_profit' ||
            tx.type === 'withdraw_capital'
        );

        const currentCapitalFromMovements = movementTxs.reduce((sum, tx) => {
            if (tx.type === 'withdraw_capital') return sum - tx.amount;
            return sum + tx.amount;
        }, 0);

        const withdrawnProfit = myTxs
            .filter(tx => tx.type === 'withdraw_profit')
            .reduce((sum, tx) => sum + tx.amount, 0);
        const reinvestedProfit = myTxs
            .filter(tx => tx.type === 'reinvest_profit')
            .reduce((sum, tx) => sum + tx.amount, 0);

        return {
            ...inv,
            entryTs: toMs(inv.entryDate),
            txs: myTxs,
            hasCapitalMovements: movementTxs.length > 0,
            capitalInvested: movementTxs.length > 0 ? currentCapitalFromMovements : inv.initialCapital,
            withdrawnProfit,
            reinvestedProfit,
        };
    });

    // Capital at a given timestamp
    const capitalAtTs = (inv: typeof investorsBase[number], ts: number): number => {
        const movementsUntilTs = inv.txs.filter(tx =>
            toMs(tx.timestamp) <= ts &&
            (tx.type === 'deposit_capital' || tx.type === 'reinvest_profit' || tx.type === 'withdraw_capital')
        );

        if (movementsUntilTs.length === 0) {
            return inv.hasCapitalMovements ? 0 : inv.initialCapital;
        }

        return movementsUntilTs.reduce((sum, tx) => {
            if (tx.type === 'withdraw_capital') return sum - tx.amount;
            return sum + tx.amount;
        }, 0);
    };

    // Distribute profits chronologically
    const distributedProfitByInvestor = new Map<string, number>();
    for (const inv of investorsBase) distributedProfitByInvestor.set(inv.id, 0);

    const sortedSellTxs = [...sellTransactions].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));

    for (const sellTx of sortedSellTxs) {
        const sellTs = toMs(sellTx.timestamp);
        const distributableProfit = (sellTx.profit || 0) * (1 - managerFeeRatio);

        const eligible = investorsBase
            .filter(inv => inv.entryTs <= sellTs)
            .map(inv => ({ id: inv.id, cap: Math.max(0, capitalAtTs(inv, sellTs)) }))
            .filter(item => item.cap > 0);

        const totalCapAtSell = eligible.reduce((sum, item) => sum + item.cap, 0);
        if (totalCapAtSell <= 0) continue;

        for (const item of eligible) {
            const share = item.cap / totalCapAtSell;
            distributedProfitByInvestor.set(
                item.id,
                (distributedProfitByInvestor.get(item.id) || 0) + distributableProfit * share
            );
        }
    }

    // Compute final results
    const totalCurrentCapital = investorsBase.reduce((sum, inv) => {
        if (!inv.isActive || inv.capitalInvested <= 0) return sum;
        return sum + inv.capitalInvested;
    }, 0);

    return investorsBase.map(inv => {
        const currentShare = inv.isActive && totalCurrentCapital > 0
            ? Math.max(0, inv.capitalInvested) / totalCurrentCapital
            : 0;
        const totalProfit = distributedProfitByInvestor.get(inv.id) || 0;
        const availableProfit = totalProfit - inv.withdrawnProfit - inv.reinvestedProfit;

        return {
            id: inv.id,
            capitalInvested: inv.capitalInvested,
            sharePercentage: currentShare,
            totalProfit,
            availableProfit,
            withdrawnProfit: inv.withdrawnProfit,
            reinvestedProfit: inv.reinvestedProfit,
        };
    });
}

// ─── EUR → USDT Conversion ──────────────────────────────────────────

export interface EurToUsdtResult {
    usdtQty: number;
    usdtPriceDzd: number;
    totalCostDzd: number;
}

export function computeEurToUsdt(
    eurQty: number,
    eurDzdPrice: number,
    eurUsdtRate: number
): EurToUsdtResult {
    if (eurUsdtRate <= 0 || eurQty <= 0 || eurDzdPrice <= 0) {
        return { usdtQty: 0, usdtPriceDzd: 0, totalCostDzd: 0 };
    }
    const usdtQty = eurQty / eurUsdtRate;
    const usdtPriceDzd = eurDzdPrice * eurUsdtRate;
    const totalCostDzd = usdtQty * usdtPriceDzd;
    return { usdtQty, usdtPriceDzd, totalCostDzd };
}

// ─── Linked Client Map ───────────────────────────────────────────────

export interface ClientTxLink {
    clientId: string;
    linkedTxId?: string;
    linkRole?: 'primary' | 'dzd_receiver';
    timestamp: number;
}

export function buildLinkedClientMap(
    clientTransactions: ClientTxLink[]
): Map<string, { clientId: string; timestamp: number; isSecondary: boolean }> {
    const map = new Map<string, { clientId: string; timestamp: number; isSecondary: boolean }>();
    for (const row of clientTransactions) {
        if (!row.linkedTxId || !row.clientId) continue;
        const isSecondary = row.linkRole === 'dzd_receiver';
        const existing = map.get(row.linkedTxId);
        if (!existing) {
            map.set(row.linkedTxId, { clientId: row.clientId, timestamp: row.timestamp, isSecondary });
            continue;
        }
        if (existing.isSecondary && !isSecondary) {
            map.set(row.linkedTxId, { clientId: row.clientId, timestamp: row.timestamp, isSecondary });
            continue;
        }
        if (existing.isSecondary === isSecondary && row.timestamp > existing.timestamp) {
            map.set(row.linkedTxId, { clientId: row.clientId, timestamp: row.timestamp, isSecondary });
        }
    }
    return map;
}
