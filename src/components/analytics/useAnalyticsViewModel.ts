import { useMemo } from 'react';
import { Tx, ClientDzd, ClientTransactionDzd } from '../../types';
import { computePamLedger } from '../../utils/pamLedger';
import { CalculatedStats, MonthlyClientRank, MonthlyClientRanking } from './analyticsTypes';
type UseAnalyticsViewModelParams = {
    transactions: Tx[];
    usdtReportMonth: number;
    usdtReportYear: number;
    clientTransactionsDzd: ClientTransactionDzd[];
    clientsDzd: ClientDzd[];
    getClientFullName: (client: ClientDzd) => string;
    t: (key: string) => string;
};
export function useAnalyticsViewModel({ transactions, usdtReportMonth, usdtReportYear, clientTransactionsDzd, clientsDzd, getClientFullName, t }: UseAnalyticsViewModelParams) {
    const pamLedger = useMemo(() => computePamLedger(transactions), [transactions]);
    const calculatedStats = useMemo<CalculatedStats>(() => {
        let volUsdtBought = 0;
        let volUsdtSold = 0;
        let volEurBought = 0;
        let volEurSold = 0;
        let realizedProfit = 0;
        const startDate = new Date(usdtReportYear, usdtReportMonth, 1).getTime();
        const endDate = new Date(usdtReportYear, usdtReportMonth + 1, 0, 23, 59, 59).getTime();
        transactions.forEach(tx => {
            if (tx.timestamp >= startDate && tx.timestamp <= endDate) {
                if (tx.currency === 'USDT') {
                    if (tx.type === 'buy') {
                        volUsdtBought += tx.quantity;
                    }
                    else if (tx.type === 'sell') {
                        volUsdtSold += tx.quantity;
                    }
                }
                else if (tx.currency === 'EUR') {
                    if (tx.type === 'buy') {
                        volEurBought += tx.quantity;
                    }
                    else if (tx.type === 'sell') {
                        volEurSold += tx.quantity;
                    }
                }
                if (tx.type === 'sell') {
                    realizedProfit += pamLedger.profitByTxId[tx.id]?.derivedProfit || 0;
                }
            }
        });
        return { volUsdtBought, volUsdtSold, volEurBought, volEurSold, realizedProfit };
    }, [transactions, usdtReportMonth, usdtReportYear, pamLedger]);
    const heatmapData = useMemo(() => {
        const salesByDay = new Map<number, number>();
        const startDate = new Date(usdtReportYear, usdtReportMonth, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(usdtReportYear, usdtReportMonth + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();
        transactions.forEach(tx => {
            if (tx.type === 'sell' && tx.timestamp >= startTimestamp && tx.timestamp <= endTimestamp) {
                const txDate = new Date(tx.timestamp);
                const day = txDate.getDate();
                const currentProfit = salesByDay.get(day) || 0;
                const profit = pamLedger.profitByTxId[tx.id]?.derivedProfit || 0;
                salesByDay.set(day, currentProfit + profit);
            }
        });
        return salesByDay;
    }, [transactions, usdtReportMonth, usdtReportYear, pamLedger]);
    const monthlyClientRanking = useMemo<MonthlyClientRanking>(() => {
        const startDate = new Date(usdtReportYear, usdtReportMonth, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(usdtReportYear, usdtReportMonth + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();
        const txClientMap = new Map<string, {
            clientId: string;
            timestamp: number;
            isSecondary: boolean;
        }>();
        clientTransactionsDzd.forEach((clientTx) => {
            if (!clientTx.linkedTxId || !clientTx.clientId)
                return;
            const isSecondary = clientTx.linkRole === 'dzd_receiver';
            const existing = txClientMap.get(clientTx.linkedTxId);
            if (!existing) {
                txClientMap.set(clientTx.linkedTxId, { clientId: clientTx.clientId, timestamp: clientTx.timestamp, isSecondary });
                return;
            }
            if (existing.isSecondary && !isSecondary) {
                txClientMap.set(clientTx.linkedTxId, { clientId: clientTx.clientId, timestamp: clientTx.timestamp, isSecondary });
                return;
            }
            if (existing.isSecondary === isSecondary && clientTx.timestamp > existing.timestamp) {
                txClientMap.set(clientTx.linkedTxId, { clientId: clientTx.clientId, timestamp: clientTx.timestamp, isSecondary });
            }
        });
        const clientNameById = new Map<string, string>();
        clientsDzd.forEach((client) => {
            clientNameById.set(client.id, getClientFullName(client));
        });
        const ranksByClient = new Map<string, MonthlyClientRank>();
        transactions.forEach((tx) => {
            if (tx.type !== 'buy' && tx.type !== 'sell')
                return;
            if (!tx.id || tx.timestamp < startTimestamp || tx.timestamp > endTimestamp)
                return;
            const linkedClient = txClientMap.get(tx.id);
            if (!linkedClient)
                return;
            const clientId = linkedClient.clientId;
            if (!ranksByClient.has(clientId)) {
                ranksByClient.set(clientId, {
                    clientId,
                    clientName: clientNameById.get(clientId) || t('portfolio.unknownClient'),
                    buyVolumeUsdt: 0,
                    sellVolumeUsdt: 0,
                    totalVolumeUsdt: 0,
                    realizedProfit: 0,
                    txCount: 0,
                    sellCount: 0
                });
            }
            const row = ranksByClient.get(clientId)!;
            const qty = Number(tx.quantity || 0);
            if (tx.type === 'buy' && tx.currency === 'USDT')
                row.buyVolumeUsdt += qty;
            if (tx.type === 'sell') {
                if (tx.currency === 'USDT')
                    row.sellVolumeUsdt += qty;
                row.realizedProfit += pamLedger.profitByTxId[tx.id]?.derivedProfit || 0;
                row.sellCount += 1;
            }
            row.txCount += 1;
        });
        const rankedRows = Array.from(ranksByClient.values())
            .map((row) => ({
            ...row,
            totalVolumeUsdt: row.buyVolumeUsdt + row.sellVolumeUsdt
        }))
            .sort((a, b) => {
            if (b.totalVolumeUsdt !== a.totalVolumeUsdt)
                return b.totalVolumeUsdt - a.totalVolumeUsdt;
            if (b.realizedProfit !== a.realizedProfit)
                return b.realizedProfit - a.realizedProfit;
            return a.clientName.localeCompare(b.clientName, 'fr');
        });
        const topTradedClient = rankedRows.length > 0 ? rankedRows[0] : null;
        const topProfitableCandidates = rankedRows.filter((row) => row.sellCount > 0);
        const topProfitableClient = topProfitableCandidates.length > 0
            ? [...topProfitableCandidates].sort((a, b) => {
                if (b.realizedProfit !== a.realizedProfit)
                    return b.realizedProfit - a.realizedProfit;
                if (b.totalVolumeUsdt !== a.totalVolumeUsdt)
                    return b.totalVolumeUsdt - a.totalVolumeUsdt;
                return a.clientName.localeCompare(b.clientName, 'fr');
            })[0]
            : null;
        return { rankedRows, topTradedClient, topProfitableClient };
    }, [transactions, clientTransactionsDzd, clientsDzd, getClientFullName, usdtReportMonth, usdtReportYear, t, pamLedger]);
    return {
        calculatedStats,
        heatmapData,
        monthlyClientRanking
    };
}
