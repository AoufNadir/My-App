import { fromCents, toCents } from '../utils/money';
import { validateAccountingOperation } from './integrity';
import type {
    AccountingOperationDraft,
    AccountingOperationStatus,
    ExternalInvestorProfitShare,
    LedgerAccount,
    LedgerPosting,
    ProfitAllocationSnapshot,
} from './types';

export type InvestorShadowWallet = 'Caisse' | 'BaridiMob' | 'USDT' | 'EUR' | 'none';

export type InvestorShadowKind =
    | 'investor_initial_capital'
    | 'investor_capital_top_up'
    | 'investor_capital_withdrawal'
    | 'profit_allocation'
    | 'profit_payout'
    | 'profit_reinvestment'
    | 'personal_advance'
    | 'personal_advance_reconcile'
    | 'personal_expense';

type ShadowBase = {
    operationId: string;
    actorUid: string;
    effectiveAt: number;
    investorId: string;
    isManager: boolean;
    reason?: string;
};

type CapitalIntent = ShadowBase & {
    kind: 'investor_initial_capital' | 'investor_capital_top_up' | 'investor_capital_withdrawal';
    amountDzd: number;
    wallet: InvestorShadowWallet;
};

export type ProfitAllocationIntent = Omit<ShadowBase, 'investorId' | 'isManager'> & {
    kind: 'profit_allocation';
    projectProfitDzd: number;
    managerId: string;
    managerFeePercentage: number;
    eligibleInvestorCapital: Array<{ investorId: string; capitalDzd: number; isManager: boolean }>;
};

export type ProfitPayoutIntent = ShadowBase & {
    kind: 'profit_payout';
    amountDzd: number;
    availableProfitBeforeDzd: number;
    wallet: Exclude<InvestorShadowWallet, 'none'>;
};

export type ProfitReinvestmentIntent = ShadowBase & {
    kind: 'profit_reinvestment';
    amountDzd: number;
    availableProfitBeforeDzd: number;
};

export type PersonalAdvanceIntent = ShadowBase & {
    kind: 'personal_advance';
    amountDzd: number;
    wallet: Exclude<InvestorShadowWallet, 'none'>;
};

export type PersonalExpenseIntent = ShadowBase & {
    kind: 'personal_expense';
    amountDzd: number;
    profitAmountDzd: number;
    capitalAmountDzd: number;
    wallet: Exclude<InvestorShadowWallet, 'none'>;
};

export type PersonalAdvanceReconcileIntent = ShadowBase & {
    kind: 'personal_advance_reconcile';
    advanceAmountDzd: number;
    returnedAmountDzd: number;
    profitAmountDzd: number;
    capitalAmountDzd: number;
    wallet: Exclude<InvestorShadowWallet, 'none'>;
};

export type InvestorShadowIntent = CapitalIntent
    | ProfitAllocationIntent
    | ProfitPayoutIntent
    | ProfitReinvestmentIntent
    | PersonalAdvanceIntent
    | PersonalExpenseIntent
    | PersonalAdvanceReconcileIntent;

export type InvestorShadowEffects = {
    capitalDeltasDzd: Record<string, number>;
    profitDueDeltasDzd: Record<string, number>;
    profitPayoutsDzd: Record<string, number>;
    reinvestmentsDzd: Record<string, number>;
    personalExpenseProfitDzd: number;
    personalExpenseCapitalDzd: number;
    managerAdvanceDzd: number;
    cashDeltasDzd: Record<Exclude<InvestorShadowWallet, 'none'>, number>;
};

export type LegacyInvestorShadowFacts = Omit<Partial<InvestorShadowEffects>, 'cashDeltasDzd'> & {
    capitalDeltasDzd?: Record<string, number>;
    profitDueDeltasDzd?: Record<string, number>;
    profitPayoutsDzd?: Record<string, number>;
    reinvestmentsDzd?: Record<string, number>;
    cashDeltasDzd?: Partial<InvestorShadowEffects['cashDeltasDzd']>;
    warnings?: readonly string[];
};

export type InvestorShadowResult = {
    intent: InvestorShadowIntent;
    draft: AccountingOperationDraft;
    ledgerEffects: InvestorShadowEffects;
    legacyFacts: LegacyInvestorShadowFacts;
    integrityErrors: string[];
    mismatches: string[];
    matches: boolean;
};

const WALLETS: readonly Exclude<InvestorShadowWallet, 'none'>[] = ['Caisse', 'BaridiMob', 'USDT', 'EUR'];

const money = (value: number): number => fromCents(toCents(value));

function positive(value: number): boolean {
    return Number.isFinite(value) && toCents(value) > 0;
}

function same(left: number, right: number): boolean {
    return toCents(left) === toCents(right);
}

function accountForWallet(wallet: Exclude<InvestorShadowWallet, 'none'>): LedgerAccount {
    if (wallet === 'Caisse') return 'asset.cash.caisse';
    if (wallet === 'BaridiMob') return 'asset.cash.baridimob';
    return `asset.portfolio.${wallet.toLowerCase()}` as LedgerAccount;
}

function capitalAccount(isManager: boolean): LedgerAccount {
    return isManager ? 'equity.manager_capital' : 'liability.investor_capital';
}

function profitAccount(isManager: boolean): LedgerAccount {
    return isManager ? 'equity.manager_profit_due' : 'liability.investor_profit_due';
}

function assertIdentity(intent: Pick<InvestorShadowIntent, 'operationId' | 'actorUid' | 'effectiveAt'>): void {
    if (!intent.operationId.trim() || !intent.actorUid.trim() || !Number.isFinite(intent.effectiveAt) || intent.effectiveAt <= 0) {
        throw new Error('Investor shadow operation identity is invalid.');
    }
}

function emptyEffects(): InvestorShadowEffects {
    return {
        capitalDeltasDzd: {},
        profitDueDeltasDzd: {},
        profitPayoutsDzd: {},
        reinvestmentsDzd: {},
        personalExpenseProfitDzd: 0,
        personalExpenseCapitalDzd: 0,
        managerAdvanceDzd: 0,
        cashDeltasDzd: { Caisse: 0, BaridiMob: 0, USDT: 0, EUR: 0 },
    };
}

function addEffect(target: Record<string, number>, id: string, amount: number): void {
    target[id] = money((target[id] || 0) + amount);
}

function deterministicShares(totalDzd: number, capitals: Array<{ investorId: string; capitalDzd: number }>): ExternalInvestorProfitShare[] {
    const totalCents = toCents(totalDzd);
    const eligible = capitals
        .filter((entry) => positive(entry.capitalDzd))
        .sort((left, right) => left.investorId.localeCompare(right.investorId));
    const denominator = eligible.reduce((sum, entry) => sum + toCents(entry.capitalDzd), 0);
    if (!eligible.length || denominator <= 0) return [];
    const sign = totalCents < 0 ? -1 : 1;
    const absoluteTotal = Math.abs(totalCents);
    const raw = eligible.map((entry) => {
        const numerator = absoluteTotal * toCents(entry.capitalDzd);
        const base = Math.floor(numerator / denominator);
        return { investorId: entry.investorId, base, remainder: numerator % denominator };
    });
    let remaining = absoluteTotal - raw.reduce((sum, entry) => sum + entry.base, 0);
    raw.sort((left, right) => right.remainder - left.remainder || left.investorId.localeCompare(right.investorId));
    for (let index = 0; remaining > 0; index = (index + 1) % raw.length, remaining -= 1) raw[index].base += 1;
    return raw
        .sort((left, right) => left.investorId.localeCompare(right.investorId))
        .map((entry) => ({ investorId: entry.investorId, amountDzd: fromCents(sign * entry.base) }));
}

/**
 * Historical allocation snapshot. The current manager rate and current
 * capitals are inputs only for the operation's own effectiveAt; the caller
 * must supply the historical values. All DZD rounding is deterministic to
 * 0.01 and allocation always exactly reconciles to project profit.
 */
export function createInvestorProfitAllocationSnapshot(intent: ProfitAllocationIntent): ProfitAllocationSnapshot {
    if (!intent.managerId.trim()) throw new Error('Profit allocation requires one manager.');
    if (!Number.isFinite(intent.projectProfitDzd) || !Number.isFinite(intent.managerFeePercentage)
        || intent.managerFeePercentage < 0 || intent.managerFeePercentage > 100) {
        throw new Error('Profit allocation inputs are invalid.');
    }
    const eligible = intent.eligibleInvestorCapital
        .filter((entry) => positive(entry.capitalDzd))
        .map((entry) => ({ ...entry, capitalDzd: money(entry.capitalDzd) }))
        .sort((left, right) => left.investorId.localeCompare(right.investorId));
    const projectProfitDzd = money(intent.projectProfitDzd);
    if (!eligible.length) {
        return {
            projectProfitDzd,
            managerFeeDzd: projectProfitDzd,
            managerCapitalDzd: 0,
            externalInvestorShares: [],
            managerFeePercentage: intent.managerFeePercentage,
            eligibleInvestorCapital: [],
        };
    }
    const poolDzd = money(projectProfitDzd * (1 - intent.managerFeePercentage / 100));
    const shares = deterministicShares(poolDzd, eligible);
    const managerCapitalDzd = shares.find((share) => share.investorId === intent.managerId)?.amountDzd || 0;
    const externalInvestorShares = shares.filter((share) => share.investorId !== intent.managerId);
    const externalTotalCents = externalInvestorShares.reduce((sum, share) => sum + toCents(share.amountDzd), 0);
    const managerFeeDzd = fromCents(toCents(projectProfitDzd) - toCents(managerCapitalDzd) - externalTotalCents);
    return {
        projectProfitDzd,
        managerFeeDzd,
        managerCapitalDzd,
        externalInvestorShares,
        managerFeePercentage: intent.managerFeePercentage,
        eligibleInvestorCapital: eligible.map((entry) => ({ investorId: entry.investorId, capitalDzd: entry.capitalDzd })),
    };
}

function makeDraft(intent: InvestorShadowIntent, kind: AccountingOperationDraft['kind'], postings: LedgerPosting[], effects: InvestorShadowEffects, profitAllocation?: ProfitAllocationSnapshot): AccountingOperationDraft {
    return {
        operationId: intent.operationId,
        accountingVersion: 2,
        kind,
        status: 'posted',
        effectiveAt: intent.effectiveAt,
        actorUid: intent.actorUid,
        reason: intent.reason || `investorsV2 shadow: ${intent.kind}`,
        postings,
        projections: [],
        ...(profitAllocation ? { profitAllocation } : {}),
        metadata: { mode: 'shadow', domain: 'investorsV2', shadowKind: intent.kind, effects },
    };
}

/** Pure Investor V2 draft builder. It has no Firebase, clock, random ID, or diagnostic side effect. */
export function buildInvestorShadowDraft(intent: InvestorShadowIntent): AccountingOperationDraft {
    assertIdentity(intent);
    const effects = emptyEffects();
    let postings: LedgerPosting[];
    let kind: AccountingOperationDraft['kind'];
    let allocation: ProfitAllocationSnapshot | undefined;

    switch (intent.kind) {
        case 'investor_initial_capital':
        case 'investor_capital_top_up':
        case 'investor_capital_withdrawal': {
            if (!positive(intent.amountDzd)) throw new Error('Capital movement requires a positive amount.');
            const amount = money(intent.amountDzd);
            const account = capitalAccount(intent.isManager);
            const isWithdrawal = intent.kind === 'investor_capital_withdrawal';
            if (intent.wallet === 'none') {
                if (intent.kind !== 'investor_initial_capital') throw new Error('Only opening capital may use a non-cash declared balance.');
                postings = [
                    { id: 'opening-balance', account: 'asset.opening_balance', side: 'debit', amountDzd: amount },
                    { id: 'opening-capital', account, side: 'credit', amountDzd: amount, investorId: intent.investorId },
                ];
            }
            else {
                const cash = accountForWallet(intent.wallet);
                postings = isWithdrawal
                    ? [
                        { id: 'capital-withdrawal', account, side: 'debit', amountDzd: amount, investorId: intent.investorId },
                        { id: 'capital-cash', account: cash, side: 'credit', amountDzd: amount },
                    ]
                    : [
                        { id: 'capital-cash', account: cash, side: 'debit', amountDzd: amount },
                        { id: 'capital-deposit', account, side: 'credit', amountDzd: amount, investorId: intent.investorId },
                    ];
                effects.cashDeltasDzd[intent.wallet] = isWithdrawal ? -amount : amount;
            }
            addEffect(effects.capitalDeltasDzd, intent.investorId, isWithdrawal ? -amount : amount);
            kind = isWithdrawal ? 'investor_capital_withdrawal' : 'investor_capital_deposit';
            break;
        }
        case 'profit_allocation': {
            allocation = createInvestorProfitAllocationSnapshot(intent);
            const allocationIsGain = allocation.projectProfitDzd >= 0;
            postings = [{
                id: 'project-profit-allocation',
                account: 'equity.project_profit_allocation',
                side: allocationIsGain ? 'debit' : 'credit',
                amountDzd: Math.abs(allocation.projectProfitDzd),
            }];
            const allocationPosting = (id: string, account: LedgerAccount, amountDzd: number, investorId: string) => ({
                id,
                account,
                side: (allocationIsGain ? 'credit' : 'debit') as 'debit' | 'credit',
                amountDzd: Math.abs(amountDzd),
                investorId,
            });
            if (allocation.managerFeeDzd !== 0) {
                postings.push(allocationPosting('manager-fee', 'equity.manager_profit_due', allocation.managerFeeDzd, intent.managerId));
                addEffect(effects.profitDueDeltasDzd, intent.managerId, allocation.managerFeeDzd);
            }
            if (allocation.managerCapitalDzd !== 0) {
                postings.push(allocationPosting('manager-capital-profit', 'equity.manager_profit_due', allocation.managerCapitalDzd, intent.managerId));
                addEffect(effects.profitDueDeltasDzd, intent.managerId, allocation.managerCapitalDzd);
            }
            allocation.externalInvestorShares.forEach((share) => {
                postings.push(allocationPosting(`investor-profit:${share.investorId}`, 'liability.investor_profit_due', share.amountDzd, share.investorId));
                addEffect(effects.profitDueDeltasDzd, share.investorId, share.amountDzd);
            });
            kind = 'investor_profit_allocation';
            break;
        }
        case 'profit_payout': {
            if (!positive(intent.amountDzd) || toCents(intent.amountDzd) > toCents(intent.availableProfitBeforeDzd)) {
                throw new Error('Profit payout exceeds available profit.');
            }
            const amount = money(intent.amountDzd);
            postings = [
                { id: 'profit-payout-due', account: profitAccount(intent.isManager), side: 'debit', amountDzd: amount, investorId: intent.investorId },
                { id: 'profit-payout-cash', account: accountForWallet(intent.wallet), side: 'credit', amountDzd: amount },
            ];
            addEffect(effects.profitDueDeltasDzd, intent.investorId, -amount);
            addEffect(effects.profitPayoutsDzd, intent.investorId, amount);
            effects.cashDeltasDzd[intent.wallet] = -amount;
            kind = 'investor_profit_withdrawal';
            break;
        }
        case 'profit_reinvestment': {
            if (!positive(intent.amountDzd) || toCents(intent.amountDzd) > toCents(intent.availableProfitBeforeDzd)) {
                throw new Error('Profit reinvestment exceeds available profit.');
            }
            const amount = money(intent.amountDzd);
            postings = [
                { id: 'reinvest-profit-due', account: profitAccount(intent.isManager), side: 'debit', amountDzd: amount, investorId: intent.investorId },
                { id: 'reinvest-capital', account: capitalAccount(intent.isManager), side: 'credit', amountDzd: amount, investorId: intent.investorId },
            ];
            addEffect(effects.profitDueDeltasDzd, intent.investorId, -amount);
            addEffect(effects.capitalDeltasDzd, intent.investorId, amount);
            addEffect(effects.reinvestmentsDzd, intent.investorId, amount);
            kind = 'investor_profit_reinvestment';
            break;
        }
        case 'personal_advance': {
            if (!intent.isManager || !positive(intent.amountDzd)) throw new Error('Personal advance requires a manager and a positive amount.');
            const amount = money(intent.amountDzd);
            postings = [
                { id: 'manager-advance', account: 'asset.manager_advance', side: 'debit', amountDzd: amount, investorId: intent.investorId },
                { id: 'advance-cash', account: accountForWallet(intent.wallet), side: 'credit', amountDzd: amount },
            ];
            effects.managerAdvanceDzd = amount;
            effects.cashDeltasDzd[intent.wallet] = -amount;
            kind = 'personal_expense';
            break;
        }
        case 'personal_expense': {
            if (!intent.isManager || !positive(intent.amountDzd)
                || !same(intent.amountDzd, money(intent.profitAmountDzd + intent.capitalAmountDzd))
                || intent.profitAmountDzd < 0 || intent.capitalAmountDzd < 0) {
                throw new Error('Personal expense funding is invalid.');
            }
            postings = [];
            if (positive(intent.profitAmountDzd)) postings.push({ id: 'personal-expense-profit', account: 'equity.manager_profit_due', side: 'debit', amountDzd: money(intent.profitAmountDzd), investorId: intent.investorId });
            if (positive(intent.capitalAmountDzd)) postings.push({ id: 'personal-expense-capital', account: 'equity.manager_capital', side: 'debit', amountDzd: money(intent.capitalAmountDzd), investorId: intent.investorId });
            postings.push({ id: 'personal-expense-cash', account: accountForWallet(intent.wallet), side: 'credit', amountDzd: money(intent.amountDzd) });
            effects.personalExpenseProfitDzd = money(intent.profitAmountDzd);
            effects.personalExpenseCapitalDzd = money(intent.capitalAmountDzd);
            addEffect(effects.profitDueDeltasDzd, intent.investorId, -intent.profitAmountDzd);
            addEffect(effects.capitalDeltasDzd, intent.investorId, -intent.capitalAmountDzd);
            effects.cashDeltasDzd[intent.wallet] = -money(intent.amountDzd);
            kind = 'personal_expense';
            break;
        }
        case 'personal_advance_reconcile': {
            if (!intent.isManager || !positive(intent.advanceAmountDzd) || intent.returnedAmountDzd < 0
                || !same(intent.advanceAmountDzd, money(intent.returnedAmountDzd + intent.profitAmountDzd + intent.capitalAmountDzd))) {
                throw new Error('Personal advance reconciliation does not balance.');
            }
            const returned = money(intent.returnedAmountDzd);
            postings = [];
            if (positive(returned)) postings.push({ id: 'advance-return-cash', account: accountForWallet(intent.wallet), side: 'debit', amountDzd: returned });
            if (positive(intent.profitAmountDzd)) postings.push({ id: 'advance-spent-profit', account: 'equity.manager_profit_due', side: 'debit', amountDzd: money(intent.profitAmountDzd), investorId: intent.investorId });
            if (positive(intent.capitalAmountDzd)) postings.push({ id: 'advance-spent-capital', account: 'equity.manager_capital', side: 'debit', amountDzd: money(intent.capitalAmountDzd), investorId: intent.investorId });
            postings.push({ id: 'advance-close', account: 'asset.manager_advance', side: 'credit', amountDzd: money(intent.advanceAmountDzd), investorId: intent.investorId });
            effects.managerAdvanceDzd = -money(intent.advanceAmountDzd);
            effects.cashDeltasDzd[intent.wallet] = returned;
            effects.personalExpenseProfitDzd = money(intent.profitAmountDzd);
            effects.personalExpenseCapitalDzd = money(intent.capitalAmountDzd);
            addEffect(effects.profitDueDeltasDzd, intent.investorId, -intent.profitAmountDzd);
            addEffect(effects.capitalDeltasDzd, intent.investorId, -intent.capitalAmountDzd);
            kind = 'personal_expense';
            break;
        }
    }
    return makeDraft(intent, kind!, postings!, effects, allocation);
}

export function getInvestorLedgerEffects(draft: Pick<AccountingOperationDraft, 'postings'>): InvestorShadowEffects {
    const effects = emptyEffects();
    draft.postings.forEach((posting) => {
        const id = posting.investorId;
        const debitPositive = posting.side === 'debit' ? 1 : -1;
        const creditPositive = posting.side === 'credit' ? 1 : -1;
        if (id && (posting.account === 'equity.manager_capital' || posting.account === 'liability.investor_capital')) addEffect(effects.capitalDeltasDzd, id, creditPositive * posting.amountDzd);
        if (id && (posting.account === 'equity.manager_profit_due' || posting.account === 'liability.investor_profit_due')) addEffect(effects.profitDueDeltasDzd, id, creditPositive * posting.amountDzd);
        if (posting.account === 'asset.manager_advance') effects.managerAdvanceDzd = money(effects.managerAdvanceDzd + debitPositive * posting.amountDzd);
        WALLETS.forEach((wallet) => {
            if (posting.account === accountForWallet(wallet)) effects.cashDeltasDzd[wallet] = money(effects.cashDeltasDzd[wallet] + debitPositive * posting.amountDzd);
        });
    });
    return effects;
}

function compareRecord(label: string, legacy: Record<string, number> | undefined, ledger: Record<string, number>, mismatches: string[]): void {
    if (!legacy) return;
    const ids = new Set([...Object.keys(legacy), ...Object.keys(ledger)]);
    [...ids].sort().forEach((id) => {
        if (!same(legacy[id] || 0, ledger[id] || 0)) mismatches.push(`${label} ${id}: Legacy ${legacy[id] || 0} != V2 ${ledger[id] || 0}.`);
    });
}

function compareNumber(label: string, legacy: number | undefined, ledger: number, mismatches: string[]): void {
    if (legacy !== undefined && !same(legacy, ledger)) mismatches.push(`${label}: Legacy ${legacy} != V2 ${ledger}.`);
}

/** Pure Legacy-versus-Shadow comparison. A mismatch remains diagnostic only. */
export function compareInvestorShadow(intent: InvestorShadowIntent, legacyFacts: LegacyInvestorShadowFacts = {}): InvestorShadowResult {
    const draft = buildInvestorShadowDraft(intent);
    const ledgerEffects = getInvestorLedgerEffects(draft);
    if (intent.kind === 'profit_payout') addEffect(ledgerEffects.profitPayoutsDzd, intent.investorId, intent.amountDzd);
    if (intent.kind === 'profit_reinvestment') addEffect(ledgerEffects.reinvestmentsDzd, intent.investorId, intent.amountDzd);
    if (intent.kind === 'personal_advance') ledgerEffects.managerAdvanceDzd = money(intent.amountDzd);
    if (intent.kind === 'personal_expense') {
        ledgerEffects.personalExpenseProfitDzd = money(intent.profitAmountDzd);
        ledgerEffects.personalExpenseCapitalDzd = money(intent.capitalAmountDzd);
    }
    if (intent.kind === 'personal_advance_reconcile') {
        ledgerEffects.personalExpenseProfitDzd = money(intent.profitAmountDzd);
        ledgerEffects.personalExpenseCapitalDzd = money(intent.capitalAmountDzd);
    }
    const integrityErrors = validateAccountingOperation(draft);
    const mismatches: string[] = [];
    compareRecord('Capital', legacyFacts.capitalDeltasDzd, ledgerEffects.capitalDeltasDzd, mismatches);
    compareRecord('Profit due', legacyFacts.profitDueDeltasDzd, ledgerEffects.profitDueDeltasDzd, mismatches);
    compareRecord('Profit payout', legacyFacts.profitPayoutsDzd, ledgerEffects.profitPayoutsDzd, mismatches);
    compareRecord('Reinvestment', legacyFacts.reinvestmentsDzd, ledgerEffects.reinvestmentsDzd, mismatches);
    WALLETS.forEach((wallet) => compareNumber(`${wallet} cash`, legacyFacts.cashDeltasDzd?.[wallet], ledgerEffects.cashDeltasDzd[wallet], mismatches));
    compareNumber('Personal expense profit', legacyFacts.personalExpenseProfitDzd, ledgerEffects.personalExpenseProfitDzd, mismatches);
    compareNumber('Personal expense capital', legacyFacts.personalExpenseCapitalDzd, ledgerEffects.personalExpenseCapitalDzd, mismatches);
    compareNumber('Manager advance', legacyFacts.managerAdvanceDzd, ledgerEffects.managerAdvanceDzd, mismatches);
    if (legacyFacts.warnings?.length) mismatches.push(...legacyFacts.warnings);
    if (integrityErrors.length) mismatches.push(...integrityErrors);
    return { intent, draft, ledgerEffects, legacyFacts, integrityErrors, mismatches, matches: mismatches.length === 0 };
}

/** Future V2 cancellation shape. Shadow only; the original remains immutable. */
export function buildInvestorShadowReversalDraft(original: AccountingOperationDraft, args: { operationId: string; actorUid: string; effectiveAt: number; reason?: string }): AccountingOperationDraft {
    if (original.status !== 'posted') throw new Error('Only a posted operation can be reversed.');
    const status: AccountingOperationStatus = 'reversal';
    return {
        operationId: args.operationId,
        accountingVersion: 2,
        kind: 'reversal',
        status,
        effectiveAt: args.effectiveAt,
        actorUid: args.actorUid,
        reason: args.reason || `Reversal of ${original.operationId}`,
        reversalOf: original.operationId,
        postings: original.postings.map((posting) => ({ ...posting, id: `reversal:${posting.id}`, side: posting.side === 'debit' ? 'credit' : 'debit' })),
        projections: [],
        metadata: { mode: 'shadow', domain: 'investorsV2', immutable: true, reversalOf: original.operationId },
    };
}
