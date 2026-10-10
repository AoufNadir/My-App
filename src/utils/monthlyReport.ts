import type { ClientDzd, ClientTransactionDzd, Tx } from '../types';
import type { PamLedgerResult } from './pamLedger';

// The monthly report's numbers (V3-6). They are the numbers of the old printed report
// (buildMonthlyPdfReport in pdfReports.ts), computed the same way: the sheet only writes them. The
// words (operation names, « client inconnu ») are left to the sheet, which writes them in the
// report's language; here a name that cannot be found is `'unknown'`.

type PortfolioSnapshot = {
    usdt: { available: number; avgBuy: number; totalProfit: number };
    eur: { available: number; avgBuy: number; totalProfit: number };
};

export type MonthlyReportInput = {
    /** 0 = January */
    month: number;
    year: number;
    transactions: ReadonlyArray<Tx>;
    clientTransactions: ReadonlyArray<ClientTransactionDzd>;
    clients: ReadonlyArray<ClientDzd>;
    getClientName: (client: ClientDzd) => string;
    portfolioStats: PortfolioSnapshot;
    pamLedger?: PamLedgerResult;
    profitByTxId?: PamLedgerResult['profitByTxId'];
};

/** A client as the old report named him: by name, « Client inconnu » when the name is lost, « Non lié » without a client. */
export type MonthlyClientRef = { name: string } | 'unknown' | 'unlinked';

export type MonthlyRankingRow = {
    clientId: string;
    client: { name: string } | 'unknown';
    buyVolumeUsdt: number;
    sellVolumeUsdt: number;
    totalVolumeUsdt: number;
    realizedProfit: number;
    txCount: number;
};

export type MonthlyPortfolioRow = {
    id: string;
    timestamp: number;
    type: Tx['type'];
    currency: string;
    /** A USDT sale paid in euros: its price and note carry the euro figures */
    usdtSaleSettledInEur: boolean;
    client: MonthlyClientRef;
    quantity: number;
    unitPrice: number;
    total: number;
    /** Sales only */
    profit: number | null;
    /** What the user wrote, empty when nothing */
    notes: string;
    /** Only for a USDT sale paid in euros */
    euroSettlement: { saleValueEur: number; eurToDzdRate: number } | null;
};

export type MonthlyClientMovementRow = {
    id: string;
    timestamp: number;
    client: { name: string } | 'unknown';
    type: ClientTransactionDzd['type'];
    amount: number;
    /** What the user wrote */
    notes: string;
    /** The other client of a transfer; undefined when none or when his name is lost */
    counterpartName: string | undefined;
};

export type MonthlyUncostedRow = {
    timestamp: number;
    txId: string;
    currency: string;
    quantity: number;
    quantityWithoutCostBasis: number;
    derivedProfit: number;
};

export type MonthlyReport = {
    month: number;
    year: number;
    reference: string;
    realizedProfit: number;
    /** Portfolio operations and client movements of the month */
    operationCount: number;
    topProfitableClient: { name: string } | 'unknown' | null;
    usdtBought: number;
    usdtSold: number;
    eurBought: number;
    eurSold: number;
    /** All sales to date, USDT and EUR */
    cumulativeProfit: number;
    /** USDT purchases of the month (as the old report counted them) */
    buyCount: number;
    /** Sales of the month, any currency */
    sellCount: number;
    clientMovementCount: number;
    portfolio: { usdtAvailable: number; usdtAvgBuy: number; eurAvailable: number; eurAvgBuy: number };
    /** Sales of the month that sold more than the stock had a cost for; null when none */
    uncosted: { currency: string; count: number; quantityWithoutCostBasis: number; rows: MonthlyUncostedRow[]; hidden: number } | null;
    ranking: { rows: MonthlyRankingRow[]; hidden: number };
    portfolioOperations: { rows: MonthlyPortfolioRow[]; hidden: number };
    clientMovements: { rows: MonthlyClientMovementRow[]; hidden: number };
};

/** How many rows each list of the report shows; the others are counted under it. */
export const MONTHLY_LIMITS = { uncosted: 8, ranking: 10, operations: 25, clientMovements: 25 } as const;

/** « Client inconnu »: how the old report ordered clients whose name is lost, in the ranking's last tie-break. */
const UNKNOWN_SORT_NAME = 'Client inconnu';

function linkedClients(clientTransactions: ReadonlyArray<ClientTransactionDzd>) {
    const map = new Map<string, { clientId: string; timestamp: number; isSecondary: boolean }>();
    for (const row of clientTransactions) {
        if (!row.linkedTxId || !row.clientId)
            continue;
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
        if (existing.isSecondary === isSecondary && row.timestamp > existing.timestamp)
            map.set(row.linkedTxId, { clientId: row.clientId, timestamp: row.timestamp, isSecondary });
    }
    return map;
}

/** The other side of a client-to-client transfer. */
function transferCounterpart(tx: ClientTransactionDzd, all: ReadonlyArray<ClientTransactionDzd>) {
    if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant')
        return null;
    if (tx.linkedTxId) {
        const linked = all.find((candidate) => candidate.id === tx.linkedTxId);
        if (linked)
            return linked;
    }
    const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
    const counterpartAmount = -Number(tx.montant || 0);
    return all
        .filter((candidate) => candidate.id !== tx.id
        && candidate.clientId !== tx.clientId
        && candidate.type === counterpartType
        && candidate.date === tx.date
        && candidate.time === tx.time
        && Math.abs(Number(candidate.montant || 0) - counterpartAmount) <= 0.01
        && Math.abs(Number(candidate.timestamp || 0) - Number(tx.timestamp || 0)) <= 2000)
        .sort((left, right) => Math.abs(Number(left.timestamp || 0) - Number(tx.timestamp || 0))
        - Math.abs(Number(right.timestamp || 0) - Number(tx.timestamp || 0)))[0] || null;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** M-202610: the month, as the client report names a month. */
export const monthlyReportReference = (month: number, year: number) => `M-${year}${pad2(month + 1)}`;

/** ProDigital_Rapport-mensuel_2026-10.pdf */
export const monthlyReportFileName = (month: number, year: number) => `ProDigital_Rapport-mensuel_${year}-${pad2(month + 1)}.pdf`;

export function buildMonthlyReport(input: MonthlyReportInput): MonthlyReport {
    const startTs = new Date(input.year, input.month, 1).getTime();
    const endTs = new Date(input.year, input.month + 1, 0, 23, 59, 59, 999).getTime();
    const periodTxs = input.transactions.filter((tx) => tx.timestamp >= startTs && tx.timestamp <= endTs);
    const profitByTxId = input.profitByTxId || input.pamLedger?.profitByTxId;
    const realizedOf = (tx: Tx): number => {
        if (tx.type !== 'sell')
            return 0;
        const derivedProfit = tx.id ? profitByTxId?.[tx.id]?.derivedProfit : undefined;
        return Number(derivedProfit ?? 0);
    };

    const periodSellProfitRows = input.pamLedger?.sellProfitRows.filter((row) => row.timestamp >= startTs && row.timestamp <= endTs) || [];
    const uncostedRows = periodSellProfitRows.filter((row) => row.flags.uncostedQuantitySold && row.quantityWithoutCostBasis > 0);
    const uncosted: MonthlyReport['uncosted'] = uncostedRows.length === 0 ? null : {
        currency: uncostedRows[0]?.currency || 'USDT',
        count: uncostedRows.length,
        quantityWithoutCostBasis: uncostedRows.reduce((sum, row) => sum + row.quantityWithoutCostBasis, 0),
        rows: uncostedRows.slice(0, MONTHLY_LIMITS.uncosted).map((row) => ({
            timestamp: row.timestamp,
            txId: row.txId,
            currency: row.currency,
            quantity: row.quantity,
            quantityWithoutCostBasis: row.quantityWithoutCostBasis,
            derivedProfit: row.derivedProfit,
        })),
        hidden: uncostedRows.length - Math.min(uncostedRows.length, MONTHLY_LIMITS.uncosted),
    };

    const cumulativeProfit = Number(input.portfolioStats.usdt.totalProfit || 0) + Number(input.portfolioStats.eur.totalProfit || 0);
    let usdtBought = 0;
    let usdtSold = 0;
    let eurBought = 0;
    let eurSold = 0;
    let realizedProfit = 0;
    let buyCount = 0;
    let sellCount = 0;
    for (const tx of periodTxs) {
        if (tx.currency === 'USDT' && tx.type === 'buy') {
            usdtBought += tx.quantity;
            buyCount += 1;
        }
        if (tx.currency === 'USDT' && tx.type === 'sell')
            usdtSold += tx.quantity;
        if (tx.currency === 'EUR' && tx.type === 'buy')
            eurBought += tx.quantity;
        if (tx.currency === 'EUR' && tx.type === 'sell')
            eurSold += tx.quantity;
        if (tx.type === 'sell') {
            realizedProfit += realizedOf(tx);
            sellCount += 1;
        }
    }

    const clientNameById = new Map<string, string>();
    input.clients.forEach((client) => clientNameById.set(client.id, input.getClientName(client)));
    const nameOf = (clientId: string): { name: string } | 'unknown' => {
        const name = clientNameById.get(clientId);
        return name ? { name } : 'unknown';
    };
    const sortName = (client: { name: string } | 'unknown') => (client === 'unknown' ? UNKNOWN_SORT_NAME : client.name);
    const linkedClientMap = linkedClients(input.clientTransactions);

    const ranksByClient = new Map<string, MonthlyRankingRow>();
    for (const tx of periodTxs) {
        if (tx.type !== 'buy' && tx.type !== 'sell')
            continue;
        if (!tx.id)
            continue;
        const linked = linkedClientMap.get(tx.id);
        if (!linked)
            continue;
        if (!ranksByClient.has(linked.clientId)) {
            ranksByClient.set(linked.clientId, {
                clientId: linked.clientId,
                client: nameOf(linked.clientId),
                buyVolumeUsdt: 0,
                sellVolumeUsdt: 0,
                totalVolumeUsdt: 0,
                realizedProfit: 0,
                txCount: 0,
            });
        }
        const row = ranksByClient.get(linked.clientId)!;
        if (tx.type === 'buy' && tx.currency === 'USDT')
            row.buyVolumeUsdt += tx.quantity;
        if (tx.type === 'sell') {
            if (tx.currency === 'USDT')
                row.sellVolumeUsdt += tx.quantity;
            row.realizedProfit += realizedOf(tx);
        }
        row.txCount += 1;
    }
    const rankedRows = Array.from(ranksByClient.values())
        .map((row) => ({ ...row, totalVolumeUsdt: row.buyVolumeUsdt + row.sellVolumeUsdt }))
        .sort((a, b) => {
        if (b.totalVolumeUsdt !== a.totalVolumeUsdt)
            return b.totalVolumeUsdt - a.totalVolumeUsdt;
        if (b.realizedProfit !== a.realizedProfit)
            return b.realizedProfit - a.realizedProfit;
        return sortName(a.client).localeCompare(sortName(b.client), 'fr');
    });
    const topRows = rankedRows.slice(0, MONTHLY_LIMITS.ranking);
    const topProfitableClient = [...rankedRows]
        .filter((row) => row.realizedProfit !== 0)
        .sort((a, b) => {
        if (b.realizedProfit !== a.realizedProfit)
            return b.realizedProfit - a.realizedProfit;
        return b.totalVolumeUsdt - a.totalVolumeUsdt;
    })[0];

    const sortedPeriodTxs = [...periodTxs].sort((a, b) => b.timestamp - a.timestamp);
    const portfolioPreview = sortedPeriodTxs.slice(0, MONTHLY_LIMITS.operations);
    const periodClientRows = input.clientTransactions
        .filter((row) => row.timestamp >= startTs && row.timestamp <= endTs)
        .sort((a, b) => b.timestamp - a.timestamp);
    const clientMovementPreview = periodClientRows.slice(0, MONTHLY_LIMITS.clientMovements);

    const portfolioRows: MonthlyPortfolioRow[] = portfolioPreview.map((row) => {
        const linkedClientId = row.id ? linkedClientMap.get(row.id)?.clientId : undefined;
        const usdtSaleSettledInEur = row.type === 'sell' && row.currency === 'USDT' && row.settlementCurrency === 'EUR';
        const unitPrice = row.type === 'sell'
            ? Number(usdtSaleSettledInEur ? row.sellPriceEur || 0 : row.sell || 0)
            : Number(row.price || 0);
        return {
            id: row.id,
            timestamp: row.timestamp,
            type: row.type,
            currency: row.currency,
            usdtSaleSettledInEur,
            client: linkedClientId ? nameOf(linkedClientId) : 'unlinked',
            quantity: row.quantity,
            unitPrice,
            total: Number(typeof row.total === 'number' ? row.total : row.quantity * unitPrice),
            profit: row.type === 'sell' ? realizedOf(row) : null,
            notes: row.notes || '',
            euroSettlement: usdtSaleSettledInEur ? { saleValueEur: Number(row.saleValueEur || 0), eurToDzdRate: Number(row.eurToDzdRateAtSale || 0) } : null,
        };
    });

    const movementRows: MonthlyClientMovementRow[] = clientMovementPreview.map((row) => {
        const counterpart = transferCounterpart(row, input.clientTransactions);
        const counterpartName = counterpart ? clientNameById.get(counterpart.clientId) || undefined : undefined;
        return {
            id: row.id,
            timestamp: row.timestamp,
            client: nameOf(row.clientId),
            type: row.type,
            amount: Number(row.montant || 0),
            notes: row.notes || '',
            counterpartName,
        };
    });

    return {
        month: input.month,
        year: input.year,
        reference: monthlyReportReference(input.month, input.year),
        realizedProfit,
        operationCount: periodTxs.length + periodClientRows.length,
        topProfitableClient: topProfitableClient ? topProfitableClient.client : null,
        usdtBought,
        usdtSold,
        eurBought,
        eurSold,
        cumulativeProfit,
        buyCount,
        sellCount,
        clientMovementCount: periodClientRows.length,
        portfolio: {
            usdtAvailable: input.portfolioStats.usdt.available,
            usdtAvgBuy: input.portfolioStats.usdt.avgBuy,
            eurAvailable: input.portfolioStats.eur.available,
            eurAvgBuy: input.portfolioStats.eur.avgBuy,
        },
        uncosted,
        ranking: { rows: topRows, hidden: Math.max(0, rankedRows.length - topRows.length) },
        portfolioOperations: { rows: portfolioRows, hidden: Math.max(0, sortedPeriodTxs.length - portfolioRows.length) },
        clientMovements: { rows: movementRows, hidden: Math.max(0, periodClientRows.length - movementRows.length) },
    };
}
