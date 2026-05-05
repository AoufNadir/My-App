import { describe, it, expect } from 'vitest';
import {
    round2,
    normalizeZero,
    computePortfolioStats,
    computeClientBalances,
    computeInvestorProfits,
    computeEurToUsdt,
    buildLinkedClientMap,
    type TxRecord,
    type ClientTxRecord,
    type InvestorRecord,
    type InvestorTxRecord,
    type SellTxRecord,
} from '../financialCalculations';

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

describe('round2', () => {
    it('rounds to 2 decimal places', () => {
        expect(round2(1.005)).toBe(1);
        expect(round2(1.125)).toBe(1.13);
        expect(round2(100)).toBe(100);
    });
});

describe('normalizeZero', () => {
    it('converts -0 to 0', () => {
        expect(normalizeZero(-0)).toBe(0);
    });
    it('converts tiny values to 0', () => {
        expect(normalizeZero(0.004)).toBe(0);
        expect(normalizeZero(-0.004)).toBe(0);
    });
    it('keeps normal values', () => {
        expect(normalizeZero(1.23)).toBe(1.23);
        expect(normalizeZero(-5.67)).toBe(-5.67);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// PAM / Portfolio Stats
// ═══════════════════════════════════════════════════════════════════════

describe('computePortfolioStats', () => {
    it('computes correct PAM for a single buy', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 100, total: 20000 },
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(100);
        expect(result.usdt.avgBuy).toBe(200);
        expect(result.usdt.costBasis).toBe(20000);
        expect(result.usdt.purchasedQty).toBe(100);
    });

    it('computes weighted average for multiple buys', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 100, total: 20000 }, // 200/unit
            { type: 'buy', currency: 'USDT', quantity: 50, total: 12500 },  // 250/unit
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(150);
        expect(result.usdt.purchasedQty).toBe(150);
        expect(result.usdt.costBasis).toBe(32500);
        // avgBuy = 32500 / 150 ≈ 216.67
        expect(result.usdt.avgBuy).toBeCloseTo(216.67, 1);
    });

    it('computes profit on sell correctly', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 100, total: 20000 }, // PAM = 200
            { type: 'sell', currency: 'USDT', quantity: 50, sell: 210 },     // profit = (210-200)*50 = 500
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(50);
        expect(result.usdt.purchasedQty).toBe(50);
        expect(result.usdt.totalProfit).toBe(500);
        expect(result.usdt.avgBuy).toBe(200); // unchanged after sell
    });

    it('resets PAM when stock reaches zero', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 100, total: 20000 },
            { type: 'sell', currency: 'USDT', quantity: 100, sell: 210 },
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(0);
        expect(result.usdt.purchasedQty).toBe(0);
        expect(result.usdt.costBasis).toBe(0);
        expect(result.usdt.avgBuy).toBe(0);
        expect(result.usdt.totalProfit).toBe(1000); // (210-200)*100
    });

    it('starts fresh PAM after zero stock', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 100, total: 20000 },
            { type: 'sell', currency: 'USDT', quantity: 100, sell: 210 },
            { type: 'buy', currency: 'USDT', quantity: 50, total: 12000 }, // new PAM = 240
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(50);
        expect(result.usdt.avgBuy).toBe(240);
        expect(result.usdt.costBasis).toBe(12000);
    });

    it('handles EUR transactions separately', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 100, total: 20000 },
            { type: 'buy', currency: 'EUR', quantity: 50, total: 12500 },
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(100);
        expect(result.usdt.avgBuy).toBe(200);
        expect(result.eur.available).toBe(50);
        expect(result.eur.avgBuy).toBe(250);
    });

    it('handles Ajout Manuel with total', () => {
        const txs: TxRecord[] = [
            { type: 'Ajout Manuel', currency: 'USDT', quantity: 100, total: 20000 },
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(100);
        expect(result.usdt.avgBuy).toBe(200);
    });

    it('handles Ajout Manuel without total (no cost basis)', () => {
        const txs: TxRecord[] = [
            { type: 'Ajout Manuel', currency: 'USDT', quantity: 100, total: 0 },
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(100);
        expect(result.usdt.purchasedQty).toBe(0);
        expect(result.usdt.costBasis).toBe(0);
        expect(result.usdt.avgBuy).toBe(0);
    });

    it('handles Retrait Manuel', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 100, total: 20000 },
            { type: 'Retrait Manuel', currency: 'USDT', quantity: 30 },
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(70);
        expect(result.usdt.purchasedQty).toBe(70);
        // avgBuy should remain 200
        expect(result.usdt.avgBuy).toBe(200);
    });

    it('handles zero quantity transactions', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 0, total: 0 },
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.available).toBe(0);
    });

    it('handles selling more than purchased quantity gracefully', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 50, total: 10000 },
            { type: 'sell', currency: 'USDT', quantity: 80, sell: 210 },
        ];
        const result = computePortfolioStats(txs);
        // available goes negative
        expect(result.usdt.available).toBe(-30);
        // purchasedQty should be 0 (min clamp)
        expect(result.usdt.purchasedQty).toBe(0);
        // profit only on 50 (removedQty = min(80, 50) = 50)
        expect(result.usdt.totalProfit).toBe(round2((210 - 200) * 50));
    });

    it('tracks EUR sell profit', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'EUR', quantity: 100, total: 25000 }, // PAM = 250
            { type: 'sell', currency: 'EUR', quantity: 50, sell: 260 },    // profit = (260-250)*50 = 500
        ];
        const result = computePortfolioStats(txs);
        expect(result.eur.totalProfit).toBe(500);
    });

    it('uses fallback profit when sell price is missing', () => {
        const txs: TxRecord[] = [
            { type: 'buy', currency: 'USDT', quantity: 100, total: 20000 },
            { type: 'sell', currency: 'USDT', quantity: 50, sell: 0, profit: 300 },
        ];
        const result = computePortfolioStats(txs);
        expect(result.usdt.totalProfit).toBe(300);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// Client Balance
// ═══════════════════════════════════════════════════════════════════════

describe('computeClientBalances', () => {
    it('computes balances from transactions', () => {
        const txs: ClientTxRecord[] = [
            { clientId: 'c1', montant: 1000, affectsBalance: true },
            { clientId: 'c1', montant: -500 },
            { clientId: 'c2', montant: -200 },
        ];
        const result = computeClientBalances(['c1', 'c2'], txs);
        expect(result.get('c1')).toBe(500);
        expect(result.get('c2')).toBe(-200);
    });

    it('ignores affectsBalance=false', () => {
        const txs: ClientTxRecord[] = [
            { clientId: 'c1', montant: 1000, affectsBalance: false },
            { clientId: 'c1', montant: -500 },
        ];
        const result = computeClientBalances(['c1'], txs);
        expect(result.get('c1')).toBe(-500);
    });

    it('initializes clients with zero balance', () => {
        const result = computeClientBalances(['c1', 'c2'], []);
        expect(result.get('c1')).toBe(0);
        expect(result.get('c2')).toBe(0);
    });

    it('handles client overpayment (positive balance)', () => {
        const txs: ClientTxRecord[] = [
            { clientId: 'c1', montant: -1000 }, // debt
            { clientId: 'c1', montant: 1500 },  // overpayment
        ];
        const result = computeClientBalances(['c1'], txs);
        expect(result.get('c1')).toBe(500); // advance
    });
});

// ═══════════════════════════════════════════════════════════════════════
// Investor Profit Distribution
// ═══════════════════════════════════════════════════════════════════════

describe('computeInvestorProfits', () => {
    const baseDate = '2024-01-01T00:00:00Z';
    const laterDate = '2024-06-01T00:00:00Z';

    it('distributes profit proportionally to capital', () => {
        const investors: InvestorRecord[] = [
            { id: 'inv1', entryDate: baseDate, capitalInvested: 100000, initialCapital: 100000, isActive: true },
            { id: 'inv2', entryDate: baseDate, capitalInvested: 50000, initialCapital: 50000, isActive: true },
        ];
        const invTxs: InvestorTxRecord[] = [
            { investorId: 'inv1', type: 'deposit_capital', amount: 100000, timestamp: new Date(baseDate).getTime() },
            { investorId: 'inv2', type: 'deposit_capital', amount: 50000, timestamp: new Date(baseDate).getTime() },
        ];
        const sellTxs: SellTxRecord[] = [
            { profit: 1500, timestamp: new Date(laterDate).getTime() },
        ];

        const result = computeInvestorProfits(investors, invTxs, sellTxs, 20);
        // Manager fee = 20% of 1500 = 300. Distributable = 1200
        // inv1: 100k/150k * 1200 = 800
        // inv2: 50k/150k * 1200 = 400
        expect(result[0].totalProfit).toBeCloseTo(800, 1);
        expect(result[1].totalProfit).toBeCloseTo(400, 1);
    });

    it('excludes investors who entered after sell date', () => {
        const investors: InvestorRecord[] = [
            { id: 'inv1', entryDate: baseDate, capitalInvested: 100000, initialCapital: 100000, isActive: true },
            { id: 'inv2', entryDate: '2024-07-01T00:00:00Z', capitalInvested: 50000, initialCapital: 50000, isActive: true },
        ];
        const invTxs: InvestorTxRecord[] = [
            { investorId: 'inv1', type: 'deposit_capital', amount: 100000, timestamp: new Date(baseDate).getTime() },
            { investorId: 'inv2', type: 'deposit_capital', amount: 50000, timestamp: new Date('2024-07-01').getTime() },
        ];
        const sellTxs: SellTxRecord[] = [
            { profit: 1000, timestamp: new Date(laterDate).getTime() },
        ];

        const result = computeInvestorProfits(investors, invTxs, sellTxs, 0);
        // Only inv1 is eligible
        expect(result[0].totalProfit).toBe(1000);
        expect(result[1].totalProfit).toBe(0);
    });

    it('applies manager fee correctly', () => {
        const investors: InvestorRecord[] = [
            { id: 'inv1', entryDate: baseDate, capitalInvested: 100000, initialCapital: 100000, isActive: true },
        ];
        const invTxs: InvestorTxRecord[] = [
            { investorId: 'inv1', type: 'deposit_capital', amount: 100000, timestamp: new Date(baseDate).getTime() },
        ];
        const sellTxs: SellTxRecord[] = [
            { profit: 1000, timestamp: new Date(laterDate).getTime() },
        ];

        const result = computeInvestorProfits(investors, invTxs, sellTxs, 25);
        // Fee = 25%, distributable = 750
        expect(result[0].totalProfit).toBe(750);
    });

    it('computes available profit after withdrawals', () => {
        const investors: InvestorRecord[] = [
            { id: 'inv1', entryDate: baseDate, capitalInvested: 100000, initialCapital: 100000, isActive: true },
        ];
        const invTxs: InvestorTxRecord[] = [
            { investorId: 'inv1', type: 'deposit_capital', amount: 100000, timestamp: new Date(baseDate).getTime() },
            { investorId: 'inv1', type: 'withdraw_profit', amount: 200, timestamp: new Date('2024-08-01').getTime() },
        ];
        const sellTxs: SellTxRecord[] = [
            { profit: 1000, timestamp: new Date(laterDate).getTime() },
        ];

        const result = computeInvestorProfits(investors, invTxs, sellTxs, 0);
        expect(result[0].totalProfit).toBe(1000);
        expect(result[0].availableProfit).toBe(800);
        expect(result[0].withdrawnProfit).toBe(200);
    });

    it('prevents negative capital from receiving profits', () => {
        const investors: InvestorRecord[] = [
            { id: 'inv1', entryDate: baseDate, capitalInvested: 0, initialCapital: 100000, isActive: true },
        ];
        const invTxs: InvestorTxRecord[] = [
            { investorId: 'inv1', type: 'deposit_capital', amount: 100000, timestamp: new Date(baseDate).getTime() },
            { investorId: 'inv1', type: 'withdraw_capital', amount: 120000, timestamp: new Date('2024-03-01').getTime() },
        ];
        const sellTxs: SellTxRecord[] = [
            { profit: 1000, timestamp: new Date(laterDate).getTime() },
        ];

        const result = computeInvestorProfits(investors, invTxs, sellTxs, 0);
        // Capital at sell time = 100000 - 120000 = -20000, clamped to 0
        expect(result[0].totalProfit).toBe(0);
    });

    it('handles empty sell transactions', () => {
        const investors: InvestorRecord[] = [
            { id: 'inv1', entryDate: baseDate, capitalInvested: 100000, initialCapital: 100000, isActive: true },
        ];
        const invTxs: InvestorTxRecord[] = [
            { investorId: 'inv1', type: 'deposit_capital', amount: 100000, timestamp: new Date(baseDate).getTime() },
        ];

        const result = computeInvestorProfits(investors, invTxs, [], 0);
        expect(result[0].totalProfit).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// EUR → USDT Conversion
// ═══════════════════════════════════════════════════════════════════════

describe('computeEurToUsdt', () => {
    it('converts correctly', () => {
        // 100 EUR, EUR at 250 DZD, rate 0.95 EUR/USDT
        const result = computeEurToUsdt(100, 250, 0.95);
        expect(result.usdtQty).toBeCloseTo(105.26, 1);
        expect(result.usdtPriceDzd).toBeCloseTo(237.5, 1);
        // total should equal eurQty * eurDzdPrice = 25000
        expect(result.totalCostDzd).toBeCloseTo(25000, 0);
    });

    it('handles zero rate', () => {
        const result = computeEurToUsdt(100, 250, 0);
        expect(result.usdtQty).toBe(0);
    });

    it('handles zero quantity', () => {
        const result = computeEurToUsdt(0, 250, 0.95);
        expect(result.usdtQty).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// buildLinkedClientMap
// ═══════════════════════════════════════════════════════════════════════

describe('buildLinkedClientMap', () => {
    it('maps linked transactions to clients', () => {
        const txs = [
            { clientId: 'c1', linkedTxId: 'tx1', timestamp: 1000 },
            { clientId: 'c2', linkedTxId: 'tx2', timestamp: 2000 },
        ];
        const map = buildLinkedClientMap(txs);
        expect(map.get('tx1')?.clientId).toBe('c1');
        expect(map.get('tx2')?.clientId).toBe('c2');
    });

    it('prefers primary over secondary', () => {
        const txs = [
            { clientId: 'c1', linkedTxId: 'tx1', linkRole: 'dzd_receiver' as const, timestamp: 1000 },
            { clientId: 'c2', linkedTxId: 'tx1', linkRole: 'primary' as const, timestamp: 900 },
        ];
        const map = buildLinkedClientMap(txs);
        expect(map.get('tx1')?.clientId).toBe('c2');
    });

    it('skips entries without linkedTxId', () => {
        const txs = [
            { clientId: 'c1', timestamp: 1000 },
        ];
        const map = buildLinkedClientMap(txs);
        expect(map.size).toBe(0);
    });
});
