import { useMemo } from 'react';
import { Investor, InvestorTransaction, Tx } from '../types';

export function useInvestorEconomics(
    investors: Investor[],
    investorTransactions: InvestorTransaction[],
    transactions: Tx[],
    managerFeePercentage: string
) {
    const derivedInvestors = useMemo(() => {
        const mgrFeePercent = parseFloat(managerFeePercentage) || 0;

        // 1. Initialize stats for all investors
        const investorStats = investors.map(inv => ({
            ...inv,
            entryTs: new Date(inv.entryDate).getTime(),
            totalEarned: 0,
            totalWithdrawn: 0,
            totalReinvested: 0
        }));

        // 2. Chronological processing of profit-generating transactions
        const sellTxs = transactions
            .filter(tx => tx.type === 'sell' && tx.currency === 'USDT' && (tx.profit || 0) !== 0)
            .sort((a, b) => a.timestamp - b.timestamp);

        sellTxs.forEach(tx => {
            const txTs = tx.timestamp;
            const rawProfit = tx.profit || 0;
            const exploitableProfit = rawProfit * (1 - mgrFeePercent / 100);

            // A. Find eligible investors
            const eligibleInvestors = investorStats.filter(s => s.entryTs <= txTs);

            // B. Calculate respective capital at that moment
            const capitals = eligibleInvestors.map(s => {
                const invCapTxs = investorTransactions.filter(itx => itx.investorId === s.id && itx.timestamp <= txTs);
                let cap = 0;
                invCapTxs.forEach(itx => {
                    if (itx.type === 'deposit_capital' || itx.type === 'reinvest_profit') cap += itx.amount;
                    else if (itx.type === 'withdraw_capital') cap -= itx.amount;
                });
                return { id: s.id, cap };
            });

            const totalCapAtTx = capitals.reduce((sum, c) => sum + c.cap, 0);

            // C. Distribute profit
            if (totalCapAtTx > 0) {
                capitals.forEach(c => {
                    const share = c.cap / totalCapAtTx;
                    const shareProfit = exploitableProfit * share;
                    const stats = investorStats.find(s => s.id === c.id)!;
                    stats.totalEarned += shareProfit;
                });
            }
        });

        // 3. Calculate total withdrawals and reinvestments
        investorTransactions.forEach(tx => {
            const stats = investorStats.find(s => s.id === tx.investorId);
            if (!stats) return;

            if (tx.type === 'withdraw_profit') {
                stats.totalWithdrawn += tx.amount;
            } else if (tx.type === 'reinvest_profit') {
                stats.totalReinvested += tx.amount;
            }
        });

        // 4. Final mapping
        const totalCurrentCapital = investors.reduce((sum, i) => sum + i.capitalInvested, 0);

        return investorStats.map(s => ({
            ...s,
            totalProfit: s.totalEarned,
            availableProfit: Math.max(0, s.totalEarned - s.totalWithdrawn - s.totalReinvested),
            withdrawnProfit: s.totalWithdrawn,
            sharePercentage: totalCurrentCapital > 0 ? s.capitalInvested / totalCurrentCapital : 0
        }));
    }, [investors, investorTransactions, transactions, managerFeePercentage]);

    return { derivedInvestors };
}
