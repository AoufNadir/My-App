import assert from 'node:assert/strict';

import { deriveInvestorEconomics, getManagerFeeAt, getManagerProfitBreakdown, reconcileManagerProfitBreakdown, type ManagerFeeHistoryEntry } from './useInvestorEconomics';
import { formatManagerFeePercentage, normalizeStoredManagerFeePercentage, parseManagerFeePercentage } from './useSettings';
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
    assert.equal(normalizeStoredManagerFeePercentage('20'), '20');
    assert.equal(normalizeStoredManagerFeePercentage(null), '30');
    assert.throws(() => parseManagerFeePercentage('-1'));
    assert.throws(() => parseManagerFeePercentage('101'));
});

test('owner capital reconciliation keeps the balance sheet capital and exposes a historical variance', () => {
    const base = getManagerProfitBreakdown(deriveInvestorEconomics({
        investors: [investor({ id: 'manager', name: 'Manager', isManager: true })],
        investorTransactions: [],
        transactions: [],
        managerFeePercentage: '30',
    }), '30');
    const result = reconcileManagerProfitBreakdown({
        breakdown: {
            ...base,
            tradingOwnerProfit: 1_502_220,
            ownerTotalProfit: 1_502_220,
            personalExpenses: 0,
            currentPersonalExpenses: 543_824,
            totalPersonalExpenses: 543_824,
        },
        openingCapital: 2_008_843,
        actualOwnerCapital: 2_967_307,
    });

    assertMoney(result.historicalOwnerCapital, 2_967_239);
    assertMoney(result.actualOwnerCapital, 2_967_307, 'Balance-sheet capital remains the displayed capital');
    assertMoney(result.ownerCapitalReconciliationDifference, 68, 'The source variance remains explicit instead of being hidden');
});

test('initial capital remains part of capitalAtTs when a later top-up deposit exists', () => {
    const investors = [
        investor({ id: 'aouf', name: 'Aouf', initialCapital: 1000, entryDate: new Date(0).toISOString() }),
        investor({ id: 'rostom', name: 'Rostom', initialCapital: 1000, entryDate: new Date(0).toISOString() }),
    ];
    const result = deriveInvestorEconomics({
        investors,
        investorTransactions: [
            investorTx({ id: 'aouf-initial', investorId: 'aouf', type: 'deposit_capital', origin: 'initial_capital', amount: 1000, timestamp: 0 }),
            investorTx({ id: 'aouf-top-up', investorId: 'aouf', type: 'deposit_capital', origin: 'capital_movement', amount: 1000, timestamp: 3000, notes: 'Ajout réel' }),
        ],
        transactions: [
            tx({ id: 'buy-1', type: 'buy', quantity: 20, price: 100, total: 2000, timestamp: 1000 }),
            tx({ id: 'sell-before-top-up', type: 'sell', quantity: 10, sell: 150, timestamp: 2000 }),
            tx({ id: 'sell-after-top-up', type: 'sell', quantity: 10, sell: 150, timestamp: 4000 }),
        ],
        managerFeePercentage: '0',
        managerFeeHistory: undefined,
    });

    const aouf = result.derivedInvestors.find((item) => item.id === 'aouf');
    const rostom = result.derivedInvestors.find((item) => item.id === 'rostom');

    assertMoney(aouf?.capitalInvested || 0, 2000, 'Initial capital plus real top-up are both kept');
    assertMoney(rostom?.capitalInvested || 0, 1000);
    assertMoney(aouf?.totalProfit || 0, 583.33, 'Aouf receives 50% before top-up and 66.67% after top-up');
    assertMoney(rostom?.totalProfit || 0, 416.67);
});

test('a legacy opening deposit prevents double-counting a historically mutated initialCapital field', () => {
    const investors = [
        investor({ id: 'manager', name: 'Manager', isManager: true, initialCapital: 5000, entryDate: new Date(1000).toISOString() }),
        investor({ id: 'dalal', name: 'Dalal', initialCapital: 1000, entryDate: new Date(1000).toISOString() }),
    ];
    const result = deriveInvestorEconomics({
        investors,
        investorTransactions: [
            investorTx({ id: 'manager-opening', investorId: 'manager', type: 'deposit_capital', amount: 1000, timestamp: 1000, notes: 'Capital Initial' }),
        ],
        transactions: [
            tx({ id: 'buy-1', type: 'buy', quantity: 20, price: 100, total: 2000, timestamp: 1000 }),
            tx({ id: 'sell-1', type: 'sell', quantity: 20, sell: 150, timestamp: 2000 }),
        ],
        managerFeePercentage: '0',
        managerFeeHistory: undefined,
    });

    const manager = result.derivedInvestors.find((item) => item.id === 'manager');
    const dalal = result.derivedInvestors.find((item) => item.id === 'dalal');
    assertMoney(manager?.capitalInvested || 0, 1500, 'Manager capital uses the 1,000 DZD opening record plus retained profit, not the overwritten 5,000 DZD profile field');
    assertMoney(dalal?.capitalInvested || 0, 1000);
    assertMoney(manager?.totalProfit || 0, 500, 'Historic profit uses the corrected 1,000 / 1,000 capital split');
    assertMoney(dalal?.totalProfit || 0, 500, 'Correcting capital does not give Dalal a distorted historic share');
});

test('25 then 50 percent applies each manager rate only to sells after its effective date', () => {
    const investors = [
        investor({ id: 'manager', name: 'Manager', isManager: true, initialCapital: 1000, entryDate: new Date(0).toISOString() }),
        investor({ id: 'rostom', name: 'Rostom', initialCapital: 1000, entryDate: new Date(0).toISOString() }),
    ];
    const history = [
        { percentage: 25, effectiveFrom: 1500 },
        { percentage: 50, effectiveFrom: 3000 },
    ];
    const result = deriveInvestorEconomics({
        investors,
        investorTransactions: [],
        transactions: [
            tx({ id: 'buy-1', type: 'buy', quantity: 200, price: 100, total: 20000, timestamp: 1000 }),
            tx({ id: 'sell-at-25', type: 'sell', quantity: 100, sell: 150, timestamp: 2000 }),
            tx({ id: 'sell-at-50', type: 'sell', quantity: 100, sell: 150, timestamp: 4000 }),
        ],
        managerFeePercentage: '50',
        managerFeeHistory: history,
    });
    const manager = result.derivedInvestors.find((item) => item.id === 'manager');
    const rostom = result.derivedInvestors.find((item) => item.id === 'rostom');

    assertMoney(result.totals.derivedProfit, 10000);
    assertMoney(result.totals.managerShare, 3750, 'Manager receives 1,250 at 25% then 2,500 at 50%');
    assertMoney(result.totals.investorShare, 6250, 'Investor pool is 3,750 at 25% then 2,500 at 50%');
    assertMoney(manager?.totalProfit || 0, 6875, 'Manager also receives their proportional investor-pool share');
    assertMoney(rostom?.totalProfit || 0, 3125, 'Rostom receives only the pool remaining after each historic rate');

    const withoutSecondSale = deriveInvestorEconomics({
        investors,
        investorTransactions: [],
        transactions: [
            tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 100, total: 10000, timestamp: 1000 }),
            tx({ id: 'sell-at-25', type: 'sell', quantity: 100, sell: 150, timestamp: 2000 }),
        ],
        managerFeePercentage: '50',
        managerFeeHistory: history,
    });
    assertMoney(withoutSecondSale.totals.managerShare, 1250, 'Saving 50% alone never rewrites the sale that happened at 25%');
    assertMoney(withoutSecondSale.derivedInvestors.find((item) => item.id === 'rostom')?.totalProfit || 0, 1875);
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

test('an investor entering after historic profit receives zero from the past and participates only after entry', () => {
    const beforeEntry = Date.UTC(2026, 7, 19, 12);
    const entryAt = Date.UTC(2026, 7, 20, 9);
    const afterEntry = Date.UTC(2026, 7, 21, 12);
    const result = deriveInvestorEconomics({
        investors: [
            investor({ id: 'manager', name: 'Manager', isManager: true, initialCapital: 1000, entryDate: new Date(0).toISOString() }),
            investor({ id: 'new-investor', name: 'Investor A', initialCapital: 1000, entryDate: new Date(entryAt).toISOString() }),
        ],
        investorTransactions: [],
        transactions: [
            tx({ id: 'buy', type: 'buy', quantity: 200, price: 100, total: 20000, timestamp: beforeEntry - 1_000 }),
            tx({ id: 'sell-before-entry', type: 'sell', quantity: 100, sell: 150, timestamp: beforeEntry }),
            tx({ id: 'sell-after-entry', type: 'sell', quantity: 100, sell: 150, timestamp: afterEntry }),
        ],
        managerFeePercentage: '0',
    });

    const newInvestor = result.derivedInvestors.find((item) => item.id === 'new-investor');
    const manager = result.derivedInvestors.find((item) => item.id === 'manager');
    assertMoney(newInvestor?.totalProfit || 0, 2500, 'Investor A receives only half of the sale after 20/08, never the historic sale');
    assertMoney(manager?.totalProfit || 0, 7500, 'The manager keeps the full historic profit plus their post-entry share');
});

test('current inactive status does not remove an investor from historic profit allocation', () => {
    const result = deriveInvestorEconomics({
        investors: [
            investor({ id: 'manager', name: 'Manager', isManager: true, initialCapital: 1000, entryDate: new Date(0).toISOString() }),
            investor({ id: 'former-investor', name: 'Former investor', initialCapital: 1000, entryDate: new Date(0).toISOString(), isActive: false }),
        ],
        investorTransactions: [],
        transactions: [
            tx({ id: 'buy', type: 'buy', quantity: 100, price: 100, total: 10000, timestamp: 1_000 }),
            tx({ id: 'sell', type: 'sell', quantity: 100, sell: 150, timestamp: 2_000 }),
        ],
        managerFeePercentage: '0',
    });

    assertMoney(result.derivedInvestors.find((item) => item.id === 'former-investor')?.totalProfit || 0, 2500);
});

test('a later capital withdrawal changes only allocations after its timestamp', () => {
    const investors = [
        investor({ id: 'manager', name: 'Manager', isManager: true, initialCapital: 1000, entryDate: new Date(0).toISOString() }),
        investor({ id: 'aouf', name: 'Aouf', initialCapital: 1000, entryDate: new Date(0).toISOString() }),
    ];
    const historicalOnly = deriveInvestorEconomics({
        investors,
        investorTransactions: [investorTx({ id: 'later-withdrawal', investorId: 'aouf', type: 'withdraw_capital', amount: 500, timestamp: 3_000 })],
        transactions: [
            tx({ id: 'buy', type: 'buy', quantity: 100, price: 100, total: 10000, timestamp: 1_000 }),
            tx({ id: 'sell-before-withdrawal', type: 'sell', quantity: 100, sell: 150, timestamp: 2_000 }),
        ],
        managerFeePercentage: '0',
    });
    const fullHistory = deriveInvestorEconomics({
        investors,
        investorTransactions: [investorTx({ id: 'later-withdrawal', investorId: 'aouf', type: 'withdraw_capital', amount: 500, timestamp: 3_000 })],
        transactions: [
            tx({ id: 'buy', type: 'buy', quantity: 200, price: 100, total: 20000, timestamp: 1_000 }),
            tx({ id: 'sell-before-withdrawal', type: 'sell', quantity: 100, sell: 150, timestamp: 2_000 }),
            tx({ id: 'sell-after-withdrawal', type: 'sell', quantity: 100, sell: 150, timestamp: 4_000 }),
        ],
        managerFeePercentage: '0',
    });

    assertMoney(historicalOnly.derivedInvestors.find((item) => item.id === 'aouf')?.totalProfit || 0, 2500, 'Future withdrawal cannot rewrite the older 50/50 sale');
    assertMoney(fullHistory.derivedInvestors.find((item) => item.id === 'aouf')?.totalProfit || 0, 4166.67, 'The later sale uses 500 / 1,500 capital only after the withdrawal');
});

test('total profit remains historical while available profit reflects an independent withdrawal balance', () => {
    const result = deriveInvestorEconomics({
        investors: [investor({ id: 'aouf', name: 'Aouf', initialCapital: 1000, entryDate: new Date(0).toISOString() })],
        investorTransactions: [investorTx({ id: 'withdrawn', investorId: 'aouf', type: 'withdraw_profit', amount: 6000, timestamp: 3_000 })],
        transactions: [
            tx({ id: 'buy', type: 'buy', quantity: 100, price: 100, total: 10000, timestamp: 1_000 }),
            tx({ id: 'sell', type: 'sell', quantity: 100, sell: 150, timestamp: 2_000 }),
        ],
        managerFeePercentage: '0',
    });
    const aouf = result.derivedInvestors[0];

    assertMoney(aouf.totalProfit, 5000, 'Historic entitlement never changes');
    assertMoney(aouf.availableProfit, -1000, 'Available balance can be negative and remains separate');
    assertMoney(aouf.displayAvailableProfit, -1000, 'The display-only amount does not change accounting');
});

test('displayed investor profits add up to the rounded financial summary', () => {
    const result = deriveInvestorEconomics({
        investors: [
            investor({ id: 'a', initialCapital: 1 }),
            investor({ id: 'b', initialCapital: 1 }),
            investor({ id: 'c', initialCapital: 1 }),
        ],
        investorTransactions: [],
        transactions: [
            tx({ id: 'buy', type: 'buy', quantity: 3, price: 100, total: 300, timestamp: 1_000 }),
            tx({ id: 'sell', type: 'sell', quantity: 3, sell: 133.33, timestamp: 2_000 }),
        ],
        managerFeePercentage: '0',
    });
    const displayTotal = result.derivedInvestors.reduce((sum, investor) => sum + investor.displayAvailableProfit, 0);

    assertMoney(result.totals.investorShare, 99.99);
    assert.equal(displayTotal, 100, 'The visible rows use the same rounded source as the visible total');
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
