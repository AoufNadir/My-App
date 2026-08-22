import assert from 'node:assert/strict';

import { deriveInvestorEconomics, getManagerFeeAt, type ManagerFeeHistoryEntry } from './useInvestorEconomics';
import { formatManagerFeePercentage, parseManagerFeePercentage } from './useSettings';
import type { Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';

function tx(input: Partial<Tx> & Pick<Tx, 'id' | 'type' | 'quantity' | 'timestamp'>): Tx {
    return {
        date: '01/01/2026',
        time: '10:00',
        currency: 'USDT',
        ...input,
    } as Tx;
}

function investor(input: Partial<Investor> & Pick<Investor, 'id'>): Investor {
    const capital = input.initialCapital ?? input.capitalInvested ?? 0;
    return {
        name: input.id,
        entryDate: new Date(0).toISOString(),
        capitalInvested: capital,
        initialCapital: capital,
        sharePercentage: 0,
        totalProfit: 0,
        withdrawnProfit: 0,
        availableProfit: 0,
        isActive: true,
        ...input,
    } as Investor;
}

function investorTx(input: Partial<InvestorTransaction> & Pick<InvestorTransaction, 'id' | 'investorId' | 'type' | 'amount' | 'timestamp'>): InvestorTransaction {
    return {
        date: '01/01/2026',
        time: '10:00',
        notes: '',
        ...input,
    } as InvestorTransaction;
}

function deliveryExpense(input: Partial<TreasuryTx> & Pick<TreasuryTx, 'id' | 'timestamp' | 'amount'>): TreasuryTx {
    return {
        date: '01/01/2026',
        time: '10:00',
        type: 'Retrait',
        source: 'Caisse',
        origin: 'delivery_expense',
        ...input,
    } as TreasuryTx;
}

function personalExpense(input: Partial<TreasuryTx> & Pick<TreasuryTx, 'id' | 'timestamp' | 'amount'>): TreasuryTx {
    return {
        date: '01/01/2026',
        time: '10:00',
        type: 'Retrait',
        source: 'Caisse',
        origin: 'personal_expense',
        ...input,
    } as TreasuryTx;
}

function emptyInvestorTransactions(): InvestorTransaction[] {
    return [];
}

function assertMoney(actual: number, expected: number, message?: string): void {
    assert.equal(Number(actual.toFixed(2)), expected, message);
}

function test(name: string, fn: () => void): void {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}

const baseInvestors = [
    investor({ id: 'manager', name: 'Manager', isManager: true, initialCapital: 0 }),
    investor({ id: 'rostom', name: 'Rostom', initialCapital: 100000, entryDate: new Date(0).toISOString() }),
];

function buyAndTwoSells(): Tx[] {
    return [
        tx({ id: 'buy-1', type: 'buy', quantity: 200, price: 200, total: 40000, timestamp: 1000 }),
        tx({ id: 'sell-old', type: 'sell', quantity: 100, sell: 250, timestamp: 2000 }),
        tx({ id: 'sell-new', type: 'sell', quantity: 100, sell: 250, timestamp: 4000 }),
    ];
}

function derive(history: ManagerFeeHistoryEntry[], transactions: Tx[] = buyAndTwoSells()) {
    return deriveInvestorEconomics({
        investors: baseInvestors,
        investorTransactions: emptyInvestorTransactions(),
        transactions,
        managerFeePercentage: String(history.at(-1)?.percentage ?? 30),
        managerFeeHistory: history,
    });
}

test('manager fee history keeps old profits at legacy 30 percent after changing to 20', () => {
    const result = derive([{ percentage: 20, effectiveFrom: 3000 }]);

    assertMoney(result.totals.derivedProfit, 10000);
    assertMoney(result.totals.managerShare, 2500, 'old sell uses 30% and new sell uses 20%');
    assertMoney(result.totals.investorShare, 7500);
    assertMoney(result.derivedInvestors.find((item) => item.id === 'rostom')?.totalProfit || 0, 7500);
});

test('a new sell after the 20 percent effective date uses 20 percent', () => {
    const result = derive([{ percentage: 20, effectiveFrom: 3000 }], [
        tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
        tx({ id: 'sell-new', type: 'sell', quantity: 100, sell: 250, timestamp: 4000 }),
    ]);

    assertMoney(result.totals.managerShare, 1000);
    assertMoney(result.totals.investorShare, 4000);
});

test('later 10 or 40 percent changes do not rewrite earlier periods', () => {
    const beforeLaterChanges = derive([{ percentage: 20, effectiveFrom: 3000 }]);
    const afterLaterChanges = derive([
        { percentage: 20, effectiveFrom: 3000 },
        { percentage: 10, effectiveFrom: 5000 },
        { percentage: 40, effectiveFrom: 7000 },
    ]);

    assertMoney(afterLaterChanges.totals.managerShare, beforeLaterChanges.totals.managerShare);
    assertMoney(afterLaterChanges.totals.investorShare, beforeLaterChanges.totals.investorShare);
});

test('a sell after a later 40 percent change uses 40 percent', () => {
    const result = derive([
        { percentage: 20, effectiveFrom: 3000 },
        { percentage: 40, effectiveFrom: 5000 },
    ], [
        tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
        tx({ id: 'sell-after-40', type: 'sell', quantity: 100, sell: 250, timestamp: 6000 }),
    ]);

    assertMoney(result.totals.managerShare, 2000);
    assertMoney(result.totals.investorShare, 3000);
});

test('manager fee input preserves valid values instead of forcing 30', () => {
    assert.equal(parseManagerFeePercentage('20'), 20);
    assert.equal(parseManagerFeePercentage('10'), 10);
    assert.equal(parseManagerFeePercentage('40'), 40);
    assert.equal(formatManagerFeePercentage(20), '20');
    assert.throws(() => parseManagerFeePercentage('-1'));
    assert.throws(() => parseManagerFeePercentage('101'));
});

test('Rostom and Karim only receive profit for periods where they were investors', () => {
    const investors = [
        investor({ id: 'manager', name: 'Manager', isManager: true, initialCapital: 0 }),
        investor({ id: 'rostom', name: 'Rostom', initialCapital: 100000, entryDate: new Date(0).toISOString() }),
        investor({ id: 'karim', name: 'Karim', initialCapital: 100000, entryDate: new Date(3000).toISOString() }),
    ];
    const result = deriveInvestorEconomics({
        investors,
        investorTransactions: emptyInvestorTransactions(),
        transactions: buyAndTwoSells(),
        managerFeePercentage: '20',
        managerFeeHistory: [{ percentage: 20, effectiveFrom: 3000 }],
    });

    assertMoney(result.derivedInvestors.find((item) => item.id === 'rostom')?.totalProfit || 0, 5500);
    assertMoney(result.derivedInvestors.find((item) => item.id === 'karim')?.totalProfit || 0, 2000);
    assertMoney(result.totals.managerShare, 2500);
});

test('manager available profit ignores legacy profit withdrawals and uses personal expenses only', () => {
    const investors = [
        investor({ id: 'manager', name: 'Manager', isManager: true, initialCapital: 100000, entryDate: new Date(0).toISOString() }),
    ];
    const result = deriveInvestorEconomics({
        investors,
        investorTransactions: [
            investorTx({ id: 'legacy-withdraw-profit', investorId: 'manager', type: 'withdraw_profit', amount: 4131, timestamp: 3000 }),
            investorTx({ id: 'legacy-reinvest', investorId: 'manager', type: 'reinvest_profit', amount: 500, timestamp: 3500 }),
        ],
        transactions: [
            tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
            tx({ id: 'sell-1', type: 'sell', quantity: 100, sell: 250, timestamp: 2000 }),
        ],
        managerFeePercentage: '30',
        managerFeeHistory: [],
        personalExpenses: [
            personalExpense({ id: 'spent', amount: 1000, timestamp: 3200 }),
        ],
    });
    const manager = result.derivedInvestors.find((item) => item.id === 'manager');

    assertMoney(manager?.totalProfit || 0, 5000);
    assertMoney(manager?.withdrawnProfit || 0, 1000, 'Manager withdrawnProfit is sourced from personal expenses');
    assertMoney(manager?.reinvestedProfit || 0, 0, 'Manager manual reinvest rows do not reduce retained profit');
    assertMoney(manager?.availableProfit || 0, 4000);
    assertMoney(manager?.capitalInvested || 0, 104000, 'Manager capital is initial capital plus retained personal profit');
});

test('old delivery expense keeps the historical manager fee burden', () => {
    const beforeLaterChanges = deriveInvestorEconomics({
        investors: baseInvestors,
        investorTransactions: emptyInvestorTransactions(),
        transactions: [],
        managerFeePercentage: '20',
        managerFeeHistory: [{ percentage: 20, effectiveFrom: 3000 }],
        deliveryExpenses: [deliveryExpense({ id: 'delivery-old', amount: 1000, timestamp: 2000 })],
    });
    const afterLaterChanges = deriveInvestorEconomics({
        investors: baseInvestors,
        investorTransactions: emptyInvestorTransactions(),
        transactions: [],
        managerFeePercentage: '40',
        managerFeeHistory: [
            { percentage: 20, effectiveFrom: 3000 },
            { percentage: 40, effectiveFrom: 5000 },
        ],
        deliveryExpenses: [deliveryExpense({ id: 'delivery-old', amount: 1000, timestamp: 2000 })],
    });

    assertMoney(beforeLaterChanges.totals.managerShare, -300);
    assertMoney(beforeLaterChanges.totals.investorShare, -700);
    assertMoney(afterLaterChanges.totals.managerShare, beforeLaterChanges.totals.managerShare);
    assertMoney(afterLaterChanges.totals.investorShare, beforeLaterChanges.totals.investorShare);
});

test('getManagerFeeAt returns legacy 30 before first saved fee change', () => {
    const history = [
        { percentage: 20, effectiveFrom: 3000 },
        { percentage: 10, effectiveFrom: 5000 },
    ];

    assert.equal(getManagerFeeAt(2000, history), 30);
    assert.equal(getManagerFeeAt(3000, history), 20);
    assert.equal(getManagerFeeAt(6000, history), 10);
});

console.log('useInvestorEconomics manager fee history tests passed');
