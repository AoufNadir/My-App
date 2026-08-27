const DEFAULT_TOLERANCE_DZD = 1;
const DEFAULT_ZERO_EPSILON = 0.005;
const DEFAULT_CONVERSION_WINDOW_MS = 60_000;
const CURRENCIES = ['USDT', 'EUR'];
function round2(value) {
    return Number(Number(value || 0).toFixed(2));
}
function normalizeZero(value, zeroEpsilon) {
    const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
    return Object.is(safe, -0) || Math.abs(safe) < zeroEpsilon ? 0 : round2(safe);
}
function asNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function isFinitePositive(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0;
}
function createWorkingStats() {
    return { purchasedQty: 0, costBasis: 0, totalProfit: 0, available: 0 };
}
function toLedgerStats(stats, zeroEpsilon) {
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
function normalizeCurrency(currency) {
    return currency === 'EUR' ? 'EUR' : 'USDT';
}
function getTxId(tx, index) {
    return tx.id || `(row-${index + 1})`;
}
function getTxQuantity(tx) {
    return round2(Math.abs(asNumber(tx.quantity, 0)));
}
function sortTransactions(transactions) {
    return transactions
        .map((tx, index) => ({ ...tx, currency: normalizeCurrency(tx.currency), __ledgerIndex: index }))
        .sort((a, b) => {
        const timestampDiff = asNumber(a.timestamp, 0) - asNumber(b.timestamp, 0);
        if (timestampDiff !== 0)
            return timestampDiff;
        return a.__ledgerIndex - b.__ledgerIndex;
    });
}
function createFlags() {
    return {
        storedMismatch: false,
        oversell: false,
        manualTotalPresent: false,
        quantityOnlyAdjustment: false,
        legacyFallback: false,
        eurConversionRelated: false,
    };
}
function makeWarning(txId, currency, code, severity, message) {
    return { txId, currency, code, severity, message };
}
function hasConversionNote(tx) {
    return String(tx.notes || '').toLowerCase().includes('achat de');
}
function findEurConversionRelatedTxIds(transactions, conversionWindowMs) {
    const relatedIds = new Set();
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
function buildPortfolioStats(statsByCurrency, zeroEpsilon) {
    const usdt = toLedgerStats(statsByCurrency.USDT, zeroEpsilon);
    const eur = toLedgerStats(statsByCurrency.EUR, zeroEpsilon);
    return { usdt, eur };
}
export function computePamLedger(transactions, options = {}) {
    const toleranceDzd = options.toleranceDzd ?? DEFAULT_TOLERANCE_DZD;
    const zeroEpsilon = options.zeroEpsilon ?? DEFAULT_ZERO_EPSILON;
    const conversionWindowMs = options.conversionWindowMs ?? DEFAULT_CONVERSION_WINDOW_MS;
    const orderedTransactions = sortTransactions(transactions);
    const eurConversionRelatedIds = findEurConversionRelatedTxIds(orderedTransactions, conversionWindowMs);
    const statsByCurrency = {
        USDT: createWorkingStats(),
        EUR: createWorkingStats(),
    };
    const operationRows = [];
    const sellProfitRows = [];
    const profitByTxId = {};
    const warnings = [];
    const seenEurConversionBuy = { USDT: false, EUR: false };
    for (const tx of orderedTransactions) {
        const txId = getTxId(tx, tx.__ledgerIndex);
        const currency = normalizeCurrency(tx.currency);
        const stats = statsByCurrency[currency];
        const quantity = getTxQuantity(tx);
        if (quantity <= 0)
            continue;
        const flags = createFlags();
        const rowWarnings = [];
        const statsBefore = toLedgerStats(stats, zeroEpsilon);
        let quantityChange = 0;
        let costBasisChange = 0;
        let sellRowData = null;
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
            const formulaSellTotal = quantity * sellPrice;
            const txTotal = asNumber(tx.total, 0);
            flags.manualTotalPresent = isFinitePositive(tx.total) && Math.abs(txTotal - formulaSellTotal) > toleranceDzd;
            const sellTotal = flags.manualTotalPresent ? txTotal : formulaSellTotal;
            const effectiveSellPrice = quantity > 0 ? sellTotal / quantity : sellPrice;
            flags.oversell = quantity > statsBefore.purchasedQty + zeroEpsilon || quantity > statsBefore.available + zeroEpsilon;
            flags.legacyFallback = statsBefore.purchasedQty <= zeroEpsilon || !isFinitePositive(effectiveSellPrice);
            const derivedProfit = flags.legacyFallback && !isFinitePositive(effectiveSellPrice)
                ? 0
                : round2((effectiveSellPrice - avgBefore) * quantity);
            const hasStoredProfit = Number.isFinite(Number(tx.profit));
            const storedProfit = hasStoredProfit ? round2(asNumber(tx.profit)) : null;
            const difference = storedProfit === null ? null : round2(storedProfit - derivedProfit);
            flags.storedMismatch = difference !== null && Math.abs(difference) > toleranceDzd;
            if (flags.manualTotalPresent) {
                rowWarnings.push(makeWarning(txId, currency, 'manual_total_present', 'info', 'Sell total differs from quantity x sell price and is used as sale revenue.'));
            }
            if (flags.oversell) {
                rowWarnings.push(makeWarning(txId, currency, 'oversell', 'high', 'Sell quantity exceeds available or costed historical stock before the transaction.'));
            }
            if (flags.legacyFallback) {
                rowWarnings.push(makeWarning(txId, currency, 'legacy_fallback', 'warning', 'Historical PAM has missing cost basis or invalid sell revenue before this sell.'));
            }
            if (flags.storedMismatch) {
                rowWarnings.push(makeWarning(txId, currency, 'stored_mismatch', Math.abs(difference || 0) > 1000 ? 'high' : 'warning', 'Stored tx.profit differs from historical derived PAM profit.'));
            }
            sellRowData = {
                sellPrice: round2(sellPrice),
                sellTotal: round2(sellTotal),
                historicalAvgBuy: round2(avgBefore),
                costedQuantityBeforeSell: statsBefore.purchasedQty,
                storedProfit,
                hasStoredProfit,
                derivedProfit,
                difference,
            };
            stats.totalProfit = round2(stats.totalProfit + derivedProfit);
        }
        if (tx.type === 'buy' || tx.type === 'Ajout Manuel') {
            stats.available = round2(stats.available + quantity);
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
            const total = round2(asNumber(tx.total, 0));
            stats.purchasedQty = round2(stats.purchasedQty + quantity);
            stats.costBasis = round2(stats.costBasis + total);
            costBasisChange = total;
            if (!isFinitePositive(tx.total)) {
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
        if (Math.abs(stats.available) < zeroEpsilon) {
            stats.available = 0;
            stats.purchasedQty = 0;
            stats.costBasis = 0;
        }
        const statsAfter = toLedgerStats(stats, zeroEpsilon);
        const operationRow = {
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
            const sellProfitRow = {
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
        if (stats.available === 0) {
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
    }, {});
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
    };
}
