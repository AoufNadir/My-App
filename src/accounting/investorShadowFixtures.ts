import {
    buildInvestorShadowDraft,
    createInvestorProfitAllocationSnapshot,
    type InvestorShadowIntent,
} from './investorShadow';
import { validateAccountingOperation } from './integrity';

const base = { actorUid: 'fixture-user', effectiveAt: 1_760_000_000_000 };

export const INVESTOR_SHADOW_FIXTURES: Array<{ name: string; intent: InvestorShadowIntent; expected: { capital?: number; cash?: number; profitDue?: number } }> = [
    {
        name: 'external opening capital cash',
        intent: { ...base, operationId: 'fixture:investor:opening', kind: 'investor_initial_capital', investorId: 'external', isManager: false, amountDzd: 1_000, wallet: 'Caisse' },
        expected: { capital: 1_000, cash: 1_000 },
    },
    {
        name: 'manager initial declared capital',
        intent: { ...base, operationId: 'fixture:investor:manager-opening', kind: 'investor_initial_capital', investorId: 'manager', isManager: true, amountDzd: 500, wallet: 'none' },
        expected: { capital: 500 },
    },
    {
        name: 'partial profit payout',
        intent: { ...base, operationId: 'fixture:investor:payout', kind: 'profit_payout', investorId: 'external', isManager: false, amountDzd: 20, availableProfitBeforeDzd: 52.5, wallet: 'Caisse' },
        expected: { profitDue: -20, cash: -20 },
    },
    {
        name: 'profit reinvestment no cash',
        intent: { ...base, operationId: 'fixture:investor:reinvest', kind: 'profit_reinvestment', investorId: 'external', isManager: false, amountDzd: 32.5, availableProfitBeforeDzd: 32.5 },
        expected: { capital: 32.5, profitDue: -32.5 },
    },
    {
        name: 'personal advance settled with return',
        intent: { ...base, operationId: 'fixture:investor:advance-settle', kind: 'personal_advance_reconcile', investorId: 'manager', isManager: true, advanceAmountDzd: 100, returnedAmountDzd: 30, profitAmountDzd: 50, capitalAmountDzd: 20, wallet: 'Caisse' },
        expected: { capital: -20, cash: 30, profitDue: -50 },
    },
];

export function assertInvestorShadowFixtures(): void {
    for (const fixture of INVESTOR_SHADOW_FIXTURES) {
        const draft = buildInvestorShadowDraft(fixture.intent);
        const errors = validateAccountingOperation(draft);
        if (errors.length) throw new Error(`${fixture.name}: ${errors.join(' | ')}`);
    }
    const allocation = createInvestorProfitAllocationSnapshot({
        ...base,
        operationId: 'fixture:investor:allocation',
        kind: 'profit_allocation',
        managerId: 'manager',
        projectProfitDzd: 100,
        managerFeePercentage: 30,
        eligibleInvestorCapital: [
            { investorId: 'manager', capitalDzd: 100, isManager: true },
            { investorId: 'external', capitalDzd: 300, isManager: false },
        ],
    });
    if (allocation.managerFeeDzd !== 30 || allocation.managerCapitalDzd !== 17.5 || allocation.externalInvestorShares[0]?.amountDzd !== 52.5) {
        throw new Error('Independent allocation fixture did not allocate 30/70 historically.');
    }
}
