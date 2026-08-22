import assert from 'node:assert/strict';

import { calculateManagerOwnerCapital } from './managerCapital';
import type { Investor, InvestorTransaction, TreasuryTx } from '../types';

function investor(input: Partial<Investor> & Pick<Investor, 'id'>): Investor {
    return {
        name: input.id,
        entryDate: new Date(1000).toISOString(),
        capitalInvested: 0,
        initialCapital: 0,
        sharePercentage: 0,
        totalProfit: 0,
        withdrawnProfit: 0,
        availableProfit: 0,
        isActive: true,
        isManager: true,
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

function personalExpense(input: Partial<TreasuryTx> & Pick<TreasuryTx, 'id' | 'amount' | 'timestamp'>): TreasuryTx {
    return {
        date: '01/01/2026',
        time: '10:00',
        type: 'Retrait',
        source: 'Caisse',
        origin: 'personal_expense',
        ...input,
    } as TreasuryTx;
}

function assertMoney(actual: number, expected: number, message?: string): void {
    assert.equal(Number(actual.toFixed(2)), expected, message);
}

const manager = investor({
    id: 'manager',
    initialCapital: 0,
    totalProfit: 1502220,
});

const example = calculateManagerOwnerCapital({
    investor: manager,
    investorTransactions: [
        investorTx({ id: 'legacy-withdraw-profit', investorId: 'manager', type: 'withdraw_profit', amount: 4131, timestamp: 2000 }),
    ],
    personalExpenses: [
        personalExpense({ id: 'personal-expense-total', amount: 543824, timestamp: 3000 }),
    ],
});

assertMoney(example.retainedProfit, 958396, 'Bénéfices conservés = profit personnel total - dépenses personnelles');
assertMoney(example.ownerCapital, 958396, 'Capital propre follows retained profit when initial capital is zero');

const managerWithCapitalMovements = investor({
    id: 'manager-2',
    entryDate: new Date(1000).toISOString(),
    initialCapital: 100000,
    totalProfit: 1000,
});

const withCapitalMovements = calculateManagerOwnerCapital({
    investor: managerWithCapitalMovements,
    investorTransactions: [
        investorTx({ id: 'initial', investorId: 'manager-2', type: 'deposit_capital', amount: 100000, timestamp: 1000, notes: 'Capital Initial' }),
        investorTx({ id: 'added', investorId: 'manager-2', type: 'deposit_capital', amount: 25000, timestamp: 2000, notes: 'Ajout réel' }),
        investorTx({ id: 'withdrawn', investorId: 'manager-2', type: 'withdraw_capital', amount: 10000, timestamp: 3000 }),
        investorTx({ id: 'legacy-profit-withdrawal', investorId: 'manager-2', type: 'withdraw_profit', amount: 999, timestamp: 4000 }),
        investorTx({ id: 'legacy-reinvest', investorId: 'manager-2', type: 'reinvest_profit', amount: 5000, timestamp: 5000 }),
    ],
    personalExpenses: [
        personalExpense({ id: 'spent', amount: 200, timestamp: 3500 }),
    ],
});

assertMoney(withCapitalMovements.retainedProfit, 800);
assertMoney(withCapitalMovements.capitalAdditions, 25000, 'Initial capital deposit is not double-counted as an addition');
assertMoney(withCapitalMovements.capitalWithdrawals, 10000);
assertMoney(withCapitalMovements.ownerCapital, 115800, 'Capital propre = initial + retained + additions - withdrawals');
assertMoney(withCapitalMovements.personalProfitTotal, 1000, 'Capital movements do not change historical personal profit');

console.log('managerCapital tests passed');
