import fs from 'node:fs';
import path from 'node:path';
import { computePamLedger } from '../src/utils/pamLedger.js';
const EXPORT_FILES = [
    'logs/pam-reconciliation/usdt_txs_3MICyQy1HqY6mz59246bPbXBGB12.json',
    'logs/pam-reconciliation/usdt_txs_JIz5y9XWhuc1hsoL3uOFjQ338cb2.json',
];
const TOLERANCE = 0.01;
const ROUNDING_TOLERANCE = 1;
function round2(value) {
    return Number(Number(value || 0).toFixed(2));
}
function normalizeZero(value) {
    return Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : round2(value);
}
function asNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function decodeFirestoreValue(value) {
    if (!value || typeof value !== 'object')
        return value;
    if ('stringValue' in value)
        return value.stringValue;
    if ('integerValue' in value)
        return Number(value.integerValue);
    if ('doubleValue' in value)
        return Number(value.doubleValue);
    if ('booleanValue' in value)
        return Boolean(value.booleanValue);
    if ('timestampValue' in value)
        return new Date(value.timestampValue).getTime();
    if ('nullValue' in value)
        return null;
    if ('arrayValue' in value)
        return (value.arrayValue?.values || []).map(decodeFirestoreValue);
    if ('mapValue' in value)
        return decodeFirestoreFields(value.mapValue?.fields || {});
    return value;
}
function decodeFirestoreFields(fields) {
    const out = {};
    for (const [key, value] of Object.entries(fields || {})) {
        out[key] = decodeFirestoreValue(value);
    }
    return out;
}
function normalizeTx(raw, index) {
    const tx = { ...raw };
    if (!tx.id && tx.name)
        tx.id = String(tx.name).split('/').pop();
    if (tx.usd !== undefined && tx.quantity === undefined)
        tx.quantity = tx.usd;
    return {
        id: String(tx.id || `(row-${index + 1})`),
        type: String(tx.type || ''),
        quantity: asNumber(tx.quantity, 0),
        price: tx.price === undefined ? undefined : asNumber(tx.price),
        sell: tx.sell === undefined ? undefined : asNumber(tx.sell),
        total: tx.total === undefined ? undefined : asNumber(tx.total),
        profit: tx.profit === undefined ? undefined : asNumber(tx.profit),
        date: String(tx.date || ''),
        time: String(tx.time || ''),
        timestamp: asNumber(tx.timestamp, 0),
        notes: tx.notes === undefined ? undefined : String(tx.notes),
        tags: Array.isArray(tx.tags) ? tx.tags.map(String) : undefined,
        currency: tx.currency === 'EUR' ? 'EUR' : 'USDT',
        linkedTxId: tx.linkedTxId === undefined ? undefined : String(tx.linkedTxId),
        linkedClientId: tx.linkedClientId === undefined ? undefined : String(tx.linkedClientId),
        linkedClientDzdId: tx.linkedClientDzdId === undefined ? undefined : String(tx.linkedClientDzdId),
        clientPaymentStatus: tx.clientPaymentStatus,
        paymentMethod: tx.paymentMethod,
    };
}
function extractTransactions(input) {
    let rows;
    if (Array.isArray(input))
        rows = input;
    else if (Array.isArray(input?.transactions))
        rows = input.transactions;
    else if (Array.isArray(input?.usdt_txs))
        rows = input.usdt_txs;
    else if (Array.isArray(input?.usdtTxs))
        rows = input.usdtTxs;
    else if (Array.isArray(input?.documents)) {
        rows = input.documents.map((doc) => ({
            id: String(doc.name || '').split('/').pop(),
            ...decodeFirestoreFields(doc.fields || {}),
        }));
    }
    if (!rows) {
        throw new Error('Unsupported export shape.');
    }
    return rows.map(normalizeTx).sort((a, b) => asNumber(a.timestamp) - asNumber(b.timestamp));
}
function createInitialStats() {
    return { costBasis: 0, purchasedQty: 0, available: 0, totalProfit: 0, avgBuy: 0 };
}
function computeUseAppDataPortfolioStats(transactions) {
    const usdtStats = createInitialStats();
    const eurStats = createInitialStats();
    for (const tx of transactions) {
        const stats = tx.currency === 'EUR' ? eurStats : usdtStats;
        const txQuantity = round2(Math.abs(Number(tx.quantity || 0)));
        const txTotal = round2(Number(tx.total || 0));
        if (txQuantity <= 0)
            continue;
        if (tx.type === 'buy' || tx.type === 'Ajout Manuel') {
            stats.available = round2(stats.available + txQuantity);
        }
        else {
            stats.available = round2(stats.available - txQuantity);
        }
        if (tx.type === 'Ajout Manuel' && txTotal > 0) {
            stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
            stats.costBasis = round2(stats.costBasis + txTotal);
        }
        else if (tx.type === 'buy') {
            stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
            stats.costBasis = round2(stats.costBasis + txTotal);
        }
        else if (tx.type === 'sell' || tx.type === 'Retrait Manuel') {
            const avgBuy = stats.purchasedQty > 0 ? stats.costBasis / stats.purchasedQty : 0;
            const removedQty = Math.min(txQuantity, stats.purchasedQty);
            if (tx.type === 'sell') {
                const sellPrice = Number(tx.sell);
                if (removedQty > 0 && Number.isFinite(sellPrice) && sellPrice > 0) {
                    const realized = (sellPrice - avgBuy) * removedQty;
                    stats.totalProfit = round2(stats.totalProfit + realized);
                }
                else {
                    stats.totalProfit = round2(stats.totalProfit + Number(tx.profit || 0));
                }
            }
            stats.purchasedQty = round2(stats.purchasedQty - removedQty);
            stats.costBasis = round2(stats.costBasis - (removedQty * avgBuy));
            if (stats.purchasedQty < 0.00001) {
                stats.purchasedQty = 0;
                stats.costBasis = 0;
            }
        }
        if (Math.abs(stats.available) < 0.005) {
            stats.available = 0;
            stats.purchasedQty = 0;
            stats.costBasis = 0;
        }
    }
    usdtStats.available = normalizeZero(usdtStats.available);
    eurStats.available = normalizeZero(eurStats.available);
    if (usdtStats.available === 0) {
        usdtStats.purchasedQty = 0;
        usdtStats.costBasis = 0;
    }
    if (eurStats.available === 0) {
        eurStats.purchasedQty = 0;
        eurStats.costBasis = 0;
    }
    usdtStats.purchasedQty = normalizeZero(usdtStats.purchasedQty);
    eurStats.purchasedQty = normalizeZero(eurStats.purchasedQty);
    usdtStats.costBasis = normalizeZero(usdtStats.costBasis);
    eurStats.costBasis = normalizeZero(eurStats.costBasis);
    if (usdtStats.purchasedQty === 0)
        usdtStats.costBasis = 0;
    if (eurStats.purchasedQty === 0)
        eurStats.costBasis = 0;
    usdtStats.avgBuy = usdtStats.purchasedQty > 0 ? usdtStats.costBasis / usdtStats.purchasedQty : 0;
    eurStats.avgBuy = eurStats.purchasedQty > 0 ? eurStats.costBasis / eurStats.purchasedQty : 0;
    usdtStats.avgBuy = normalizeZero(usdtStats.avgBuy);
    eurStats.avgBuy = normalizeZero(eurStats.avgBuy);
    usdtStats.totalProfit = normalizeZero(usdtStats.totalProfit);
    eurStats.totalProfit = normalizeZero(eurStats.totalProfit);
    return { usdt: usdtStats, eur: eurStats };
}
function classifyDifference(diff, source, currency, ledgerWarnings) {
    const absDiff = Math.abs(diff);
    if (absDiff <= TOLERANCE) {
        return { status: 'match', reason: 'No material difference.' };
    }
    if (absDiff <= ROUNDING_TOLERANCE) {
        return { status: 'rounding_only', reason: 'Difference is within rounding tolerance.' };
    }
    if (ledgerWarnings.includes('oversell')) {
        return {
            status: 'actual_difference',
            reason: 'Ledger contains sell rows where quantity exceeds costed stock; usually caused by quantity-only stock adjustments or historical stock gaps.',
        };
    }
    if (ledgerWarnings.includes('legacy_fallback')) {
        return { status: 'legacy_fallback_difference', reason: 'Ledger contains legacy fallback warnings.' };
    }
    if (ledgerWarnings.includes('quantity_only_adjustment')) {
        return { status: 'manual_adjustment_related', reason: 'Ledger contains quantity-only manual stock adjustments.' };
    }
    if (ledgerWarnings.includes('eur_conversion_related')) {
        return { status: 'eur_conversion_related', reason: 'Ledger contains EUR -> USDT conversion-related rows.' };
    }
    if (currency !== 'ALL' && source.includes('combined')) {
        return { status: 'chronological_order_difference', reason: 'Combined multi-user exports can create cross-wallet chronological ambiguity.' };
    }
    return { status: 'actual_difference', reason: 'Difference needs manual accounting review.' };
}
function makeRow(source, currency, metric, currentUseAppData, pamLedger, ledgerWarnings) {
    const difference = round2((pamLedger || 0) - (currentUseAppData || 0));
    const classification = classifyDifference(difference, source, currency, ledgerWarnings);
    return {
        source,
        currency,
        metric,
        currentUseAppData,
        pamLedger,
        difference,
        status: classification.status,
        reason: classification.reason,
    };
}
function compareFile(filePath) {
    const input = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const transactions = extractTransactions(input);
    const useAppDataStats = computeUseAppDataPortfolioStats(transactions);
    const ledger = computePamLedger(transactions);
    const warningCodes = Array.from(new Set(ledger.warnings.map((warning) => warning.code)));
    const source = path.basename(filePath);
    const rows = [];
    for (const currency of ['USDT', 'EUR']) {
        const current = currency === 'USDT' ? useAppDataStats.usdt : useAppDataStats.eur;
        const next = currency === 'USDT' ? ledger.portfolioStats.usdt : ledger.portfolioStats.eur;
        rows.push(makeRow(source, currency, 'available', current.available, next.available, warningCodes));
        rows.push(makeRow(source, currency, 'costBasis', current.costBasis, next.costBasis, warningCodes));
        rows.push(makeRow(source, currency, 'avgBuy', current.avgBuy, next.avgBuy, warningCodes));
        rows.push(makeRow(source, currency, 'totalProfit', current.totalProfit, next.totalProfit, warningCodes));
    }
    const currentTotalProfit = round2(useAppDataStats.usdt.totalProfit + useAppDataStats.eur.totalProfit);
    rows.push(makeRow(source, 'ALL', 'derivedProfitTotal', currentTotalProfit, ledger.totals.derivedProfit, warningCodes));
    rows.push(makeRow(source, 'ALL', 'storedProfitTotal', null, ledger.totals.storedProfit, warningCodes));
    rows.push(makeRow(source, 'ALL', 'differenceTotal', null, ledger.totals.difference, warningCodes));
    return {
        source,
        txCount: transactions.length,
        sellCount: ledger.sellProfitRows.length,
        warningCodes,
        rows,
    };
}
function main() {
    const missing = EXPORT_FILES.filter((filePath) => !fs.existsSync(filePath));
    if (missing.length > 0) {
        throw new Error(`Missing export files: ${missing.join(', ')}`);
    }
    const comparisons = EXPORT_FILES.map(compareFile);
    const materialDifferences = comparisons.flatMap((comparison) => (comparison.rows.filter((row) => (row.metric !== 'storedProfitTotal'
        && row.metric !== 'differenceTotal'
        && Math.abs(row.difference) > ROUNDING_TOLERANCE))));
    console.log(JSON.stringify({
        comparisons,
        summary: {
            filesCompared: comparisons.length,
            materialDifferenceCount: materialDifferences.length,
            materialDifferences,
        },
    }, null, 2));
}
main();
