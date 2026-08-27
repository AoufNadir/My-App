import { fromCents, toCents } from '../utils/money';
import {
    ACCOUNTING_TOLERANCE_DZD,
    type AccountingIntegrityReport,
    type AccountingOperation,
    type AccountingOperationDraft,
    type InvariantResult,
    type LedgerAccount,
    type LedgerPosting,
} from './types';

type AccountFamily = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

function accountFamily(account: LedgerAccount): AccountFamily {
    return account.split('.')[0] as AccountFamily;
}

function isNormalDebit(account: LedgerAccount): boolean {
    const family = accountFamily(account);
    return family === 'asset' || family === 'expense';
}

function postingBalanceCents(posting: LedgerPosting): number {
    const amount = toCents(posting.amountDzd);
    const isNormal = isNormalDebit(posting.account) ? posting.side === 'debit' : posting.side === 'credit';
    return isNormal ? amount : -amount;
}

function postingDebitsCents(posting: LedgerPosting): number {
    return posting.side === 'debit' ? toCents(posting.amountDzd) : 0;
}

function postingCreditsCents(posting: LedgerPosting): number {
    return posting.side === 'credit' ? toCents(posting.amountDzd) : 0;
}

function isFinitePositive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

function allocationDifferenceCents(operation: Pick<AccountingOperationDraft, 'profitAllocation'>): number {
    const allocation = operation.profitAllocation;
    if (!allocation) return 0;
    const external = allocation.externalInvestorShares
        .reduce((sum, share) => sum + toCents(share.amountDzd), 0);
    return toCents(allocation.projectProfitDzd)
        - toCents(allocation.managerFeeDzd)
        - toCents(allocation.managerCapitalDzd)
        - external;
}

export function validateAccountingOperation(operation: AccountingOperationDraft): string[] {
    const errors: string[] = [];
    if (!operation.operationId.trim()) errors.push('operationId is required.');
    if (!operation.actorUid.trim()) errors.push('actorUid is required.');
    if (!Number.isFinite(operation.effectiveAt) || operation.effectiveAt <= 0) errors.push('effectiveAt is invalid.');
    if (operation.postings.length < 2) errors.push('At least two ledger postings are required.');
    if (operation.kind === 'reversal' && (!operation.reversalOf || operation.reversalOf === operation.operationId)) {
        errors.push('A reversal requires a different reversalOf operation id.');
    }
    if (operation.kind !== 'reversal' && operation.reversalOf) {
        errors.push('Only a reversal may set reversalOf.');
    }
    if (operation.kind === 'reversal' && operation.status !== 'reversal') {
        errors.push('A reversal must have reversal status.');
    }
    if (operation.kind !== 'reversal' && operation.status !== 'posted') {
        errors.push('A non-reversal must have posted status.');
    }

    const postingIds = new Set<string>();
    let debits = 0;
    let credits = 0;
    for (const posting of operation.postings) {
        if (!posting.id.trim() || postingIds.has(posting.id)) errors.push('Posting ids must be unique.');
        postingIds.add(posting.id);
        if (!posting.account.includes('.')) errors.push(`Posting ${posting.id} has an invalid account.`);
        if (!isFinitePositive(posting.amountDzd)) errors.push(`Posting ${posting.id} has an invalid amount.`);
        if (posting.quantity !== undefined && !isFinitePositive(posting.quantity)) errors.push(`Posting ${posting.id} has an invalid quantity.`);
        if (posting.unitRateDzd !== undefined && !isFinitePositive(posting.unitRateDzd)) errors.push(`Posting ${posting.id} has an invalid unit rate.`);
        debits += postingDebitsCents(posting);
        credits += postingCreditsCents(posting);
    }
    if (Math.abs(debits - credits) > toCents(ACCOUNTING_TOLERANCE_DZD)) {
        errors.push('Ledger debits and credits are not balanced.');
    }

    const projectionIds = new Set<string>();
    for (const projection of operation.projections) {
        const key = `${projection.collection}/${projection.id}`;
        if (!projection.collection || !projection.id || projectionIds.has(key)) errors.push('Projection references must be unique and complete.');
        projectionIds.add(key);
        if (!projection.id.startsWith(`${operation.operationId}:`)) errors.push('Projection ids must be derived from operationId.');
    }

    if (operation.profitAllocation) {
        const allocation = operation.profitAllocation;
        if (!Number.isFinite(allocation.managerFeePercentage) || allocation.managerFeePercentage < 0 || allocation.managerFeePercentage > 100) {
            errors.push('The manager fee snapshot is invalid.');
        }
        if (Math.abs(allocationDifferenceCents(operation)) > toCents(ACCOUNTING_TOLERANCE_DZD)) {
            errors.push('Project profit allocation is not balanced.');
        }
        const investorIds = new Set<string>();
        allocation.externalInvestorShares.forEach((share) => {
            if (!share.investorId || investorIds.has(share.investorId) || !Number.isFinite(share.amountDzd)) {
                errors.push('External investor profit shares are invalid.');
            }
            investorIds.add(share.investorId);
        });
    }
    return errors;
}

export function areReversalPostingsExact(original: AccountingOperation, reversal: AccountingOperationDraft): boolean {
    if (reversal.kind !== 'reversal' || reversal.reversalOf !== original.operationId || original.postings.length !== reversal.postings.length) {
        return false;
    }
    const originalRows = [...original.postings]
        .map((posting) => `${posting.account}|${posting.side}|${toCents(posting.amountDzd)}|${posting.currency || 'DZD'}|${posting.quantity ?? ''}`)
        .sort();
    const reversalRows = [...reversal.postings]
        .map((posting) => `${posting.account}|${posting.side === 'debit' ? 'credit' : 'debit'}|${toCents(posting.amountDzd)}|${posting.currency || 'DZD'}|${posting.quantity ?? ''}`)
        .sort();
    return originalRows.every((row, index) => row === reversalRows[index]);
}

function zeroReport(): AccountingIntegrityReport {
    return {
        ok: true,
        toleranceDzd: ACCOUNTING_TOLERANCE_DZD,
        assetsDzd: 0,
        liabilitiesDzd: 0,
        ownerEquityDzd: 0,
        projectProfitDzd: 0,
        managerFeeDzd: 0,
        managerCapitalDzd: 0,
        externalInvestorProfitDzd: 0,
        failures: [],
    };
}

/**
 * Reconciles the v2 source-of-truth ledger. Liability totals intentionally use
 * every `liability.*` account so future payables/custody accounts cannot be
 * silently excluded from the balance-sheet invariant.
 */
export function reconcileAccountingOperations(operations: AccountingOperation[]): AccountingIntegrityReport {
    const report = zeroReport();
    const failures: InvariantResult[] = [];
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let income = 0;
    let expenses = 0;

    for (const operation of operations) {
        const structuralErrors = validateAccountingOperation(operation);
        if (structuralErrors.length > 0) {
            failures.push({
                code: 'operation_invalid',
                differenceDzd: 0,
                operationIds: [operation.operationId],
                message: structuralErrors.join(' '),
            });
        }
        for (const posting of operation.postings) {
            const balance = postingBalanceCents(posting);
            switch (accountFamily(posting.account)) {
                case 'asset': assets += balance; break;
                case 'liability': liabilities += balance; break;
                case 'equity': equity += balance; break;
                case 'income': income += balance; break;
                case 'expense': expenses += balance; break;
            }
        }
        const allocation = operation.profitAllocation;
        if (allocation) {
            report.projectProfitDzd += toCents(allocation.projectProfitDzd);
            report.managerFeeDzd += toCents(allocation.managerFeeDzd);
            report.managerCapitalDzd += toCents(allocation.managerCapitalDzd);
            report.externalInvestorProfitDzd += allocation.externalInvestorShares
                .reduce((sum, share) => sum + toCents(share.amountDzd), 0);
        }
    }

    const profitFromPnl = income - expenses;
    const ownerEquity = equity + profitFromPnl;
    const balanceDifference = assets - liabilities - ownerEquity;
    const allocationDifference = report.projectProfitDzd
        - report.managerFeeDzd
        - report.managerCapitalDzd
        - report.externalInvestorProfitDzd;
    const tolerance = toCents(ACCOUNTING_TOLERANCE_DZD);
    const operationIds = operations.map((operation) => operation.operationId);

    if (Math.abs(balanceDifference) > tolerance) {
        failures.push({
            code: 'balance_sheet_not_reconciled',
            differenceDzd: fromCents(balanceDifference),
            operationIds,
            message: 'Assets do not equal owner equity plus all liabilities.',
        });
    }
    if (Math.abs(allocationDifference) > tolerance) {
        failures.push({
            code: 'project_profit_not_allocated',
            differenceDzd: fromCents(allocationDifference),
            operationIds,
            message: 'Project profit does not equal manager fee, manager capital share, and external investor shares.',
        });
    }
    if (report.projectProfitDzd !== 0 && Math.abs(profitFromPnl - report.projectProfitDzd) > tolerance) {
        failures.push({
            code: 'profit_and_loss_not_reconciled',
            differenceDzd: fromCents(profitFromPnl - report.projectProfitDzd),
            operationIds,
            message: 'Ledger profit and saved profit-allocation snapshots differ.',
        });
    }

    report.assetsDzd = fromCents(assets);
    report.liabilitiesDzd = fromCents(liabilities);
    report.ownerEquityDzd = fromCents(ownerEquity);
    report.projectProfitDzd = fromCents(report.projectProfitDzd);
    report.managerFeeDzd = fromCents(report.managerFeeDzd);
    report.managerCapitalDzd = fromCents(report.managerCapitalDzd);
    report.externalInvestorProfitDzd = fromCents(report.externalInvestorProfitDzd);
    report.failures = failures;
    report.ok = failures.length === 0;
    return report;
}
