import assert from 'node:assert/strict';

import { buildInvestorCapitalReconciliation, calculateManagerOwnerCapital, investorResetForDeletedRow } from './managerCapital';
import { deriveInvestorEconomics } from '../hooks/useInvestorEconomics';
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

const managerWithExpenseExcess = investor({
    id: 'manager-3',
    entryDate: new Date(1000).toISOString(),
    initialCapital: 1000,
    totalProfit: 100,
});

const expenseExcess = calculateManagerOwnerCapital({
    investor: managerWithExpenseExcess,
    investorTransactions: [
        investorTx({ id: 'expense-capital-part', investorId: 'manager-3', type: 'withdraw_capital', origin: 'personal_expense', amount: 50, timestamp: 2000, linkedTreasuryTxId: 'expense-1' }),
        investorTx({ id: 'real-capital-withdrawal', investorId: 'manager-3', type: 'withdraw_capital', origin: 'capital_movement', amount: 20, timestamp: 3000 }),
    ],
    personalExpenses: [
        personalExpense({ id: 'expense-1', amount: 150, timestamp: 2000 }),
    ],
});

assertMoney(expenseExcess.personalExpensesChargedToProfit, 100);
assertMoney(expenseExcess.personalExpensesChargedToCapital, 50);
assertMoney(expenseExcess.retainedProfit, 0);
assertMoney(expenseExcess.capitalWithdrawals, 20, 'Personal-expense capital rows are excluded from real capital withdrawals');
assertMoney(expenseExcess.ownerCapital, 930, 'Capital propre subtracts the expense excess only once plus real capital withdrawals');

const investorWithMutatedProfileCapital = investor({
    id: 'legacy-opening',
    entryDate: new Date(1000).toISOString(),
    // Historical reinvestment code could overwrite this field. The opening
    // deposit below remains the reliable opening-capital record.
    initialCapital: 5000,
    totalProfit: 0,
});

const openingCapitalAudit = buildInvestorCapitalReconciliation(investorWithMutatedProfileCapital, [
    investorTx({ id: 'opening', investorId: 'legacy-opening', type: 'deposit_capital', amount: 1000, timestamp: 1000, notes: 'Capital Initial' }),
    investorTx({ id: 'top-up', investorId: 'legacy-opening', type: 'deposit_capital', origin: 'capital_movement', amount: 200, timestamp: 2000, notes: 'Ajout de capital' }),
    // Same amount as the opening capital is still a real top-up when it does
    // not carry the exact opening-capital signature.
    investorTx({ id: 'same-amount-top-up', investorId: 'legacy-opening', type: 'deposit_capital', amount: 1000, timestamp: 3000, notes: 'Apport complémentaire' }),
]);

assertMoney(openingCapitalAudit.declaredInitialCapital, 5000);
assertMoney(openingCapitalAudit.openingCapital, 1000, 'Opening deposit is authoritative when the profile field was historically overwritten');
assert.equal(openingCapitalAudit.openingSource, 'initial_transaction');
assert.deepEqual(openingCapitalAudit.deposits.map((row) => row.classification), ['initial', 'real_top_up', 'real_top_up']);
assertMoney(openingCapitalAudit.realCapitalAdditions, 1200);
assertMoney(openingCapitalAudit.currentCapital, 2200, 'Opening capital is counted once, then only real top-ups are added');
assertMoney(openingCapitalAudit.legacyCurrentCapital, 7200, 'Diagnostic preserves the old double-counted outcome');
assertMoney(openingCapitalAudit.differenceFromLegacy, -5000);

// Deleting an investor's "Capital Initial" row deletes its Caisse deposit too, so the
// capital it stands for must go with it: otherwise the capital falls back to the profile's
// initialCapital and the project owes money it no longer holds.
{
    const external = investor({ id: 'a', isManager: false, initialCapital: 500000, capitalInvested: 500000 });
    const opening = investorTx({ id: 'dep', investorId: 'a', type: 'deposit_capital', amount: 500000, origin: 'initial_capital', notes: 'Capital Initial', paymentSource: 'Caisse', linkedTreasuryTxId: 'cash-in', timestamp: 1001 });
    const topUp = investorTx({ id: 'top-up', investorId: 'a', type: 'deposit_capital', amount: 100000, timestamp: 5000 });
    const capitalOf = (profile: Investor, rows: InvestorTransaction[]) => deriveInvestorEconomics({ investors: [profile], investorTransactions: rows, transactions: [], managerFeePercentage: '30' }).derivedInvestors[0].capitalInvested;

    assertMoney(capitalOf(external, [opening, topUp]), 600000);
    const reset = investorResetForDeletedRow(opening, external, [opening, topUp]);
    assert.deepEqual(reset, { initialCapital: 0 });
    assertMoney(capitalOf({ ...external, ...reset }, [topUp]), 100000, 'The deleted 500 000 leaves the capital with its cash');

    // Other rows, and an opening row that still has a twin, leave the profile alone.
    assert.equal(investorResetForDeletedRow(topUp, external, [opening, topUp]), null);
    const twin = { ...opening, id: 'dep-2' };
    assert.equal(investorResetForDeletedRow(opening, external, [opening, twin]), null);
}

console.log('managerCapital tests passed');
