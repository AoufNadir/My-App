import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { CurrencyAmount } from './CurrencyAmount';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import type { ManagerProfitBreakdown } from '../../hooks/useInvestorEconomics';
import { useLanguage } from '../../contexts/LanguageContext';
import type { OwnerCapitalReconciliation, PeriodAmountSummary } from '../../utils/financialAudit';

export type OwnerProfitPeriods = {
    today: number;
    week: number;
    month: number;
    year: number;
};

function Metric({ label, value, semantic = 'auto' }: { label: string; value: number; semantic?: 'auto' | 'plain' }) {
    return (
        <div className="min-w-0 rounded-xl bg-neutral-50 px-3 py-3">
            <p className="truncate text-[11px] font-semibold text-neutral-500">{label}</p>
            <div className="mt-1">
                <CurrencyAmount value={value} currency="DZD" semantic={semantic} size="lg" decimals={0} />
            </div>
        </div>
    );
}

export function OwnerProfitPeriodSummary({ periods }: { periods: OwnerProfitPeriods }) {
    const { t } = useLanguage();
    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <SectionHeading icon={<BriefcaseIcon className="h-4 w-4" />}>
                    {t('dashboard.ownerProfitSummary') as string}
                </SectionHeading>
                <p className="mt-1 text-xs text-neutral-500">{t('dashboard.ownerProfitSummaryHint') as string}</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 p-4 pt-2 sm:grid-cols-4">
                <Metric label={t('dashboard.ownerProfitToday') as string} value={periods.today} />
                <Metric label={t('dashboard.ownerProfitWeek') as string} value={periods.week} />
                <Metric label={t('dashboard.ownerProfitMonth') as string} value={periods.month} />
                <Metric label={t('dashboard.ownerProfitYear') as string} value={periods.year} />
            </CardContent>
        </Card>
    );
}

export function OwnerProfitBreakdownCard({ breakdown }: { breakdown: ManagerProfitBreakdown }) {
    const { t } = useLanguage();
    const rate = breakdown.managerFeePercentage.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <SectionHeading icon={<UsersIcon className="h-4 w-4" />}>
                    {t('investors.ownerProfitBreakdown') as string}
                </SectionHeading>
                <p className="mt-1 text-xs text-neutral-500">{t('investors.ownerProfitBreakdownHint') as string}</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 p-4 pt-2">
                <Metric label={`${t('investors.ideaShare') as string} (${rate}%)`} value={breakdown.ideaShareProfit} />
                <Metric label={t('investors.personalCapitalShare') as string} value={breakdown.personalCapitalProfit} />
                <Metric label={t('investors.personalTotalProfit') as string} value={breakdown.ownerTotalProfit} />
                <Metric label={t('investors.externalInvestorsShare') as string} value={breakdown.externalInvestorsProfit} semantic="plain" />
                <Metric label={t('investors.profitWithdrawals') as string} value={breakdown.profitWithdrawals} semantic="plain" />
                <Metric label={t('investors.personalExpenses') as string} value={breakdown.personalExpenses} semantic="plain" />
                <Metric label={t('investors.reinvestedProfit') as string} value={breakdown.reinvestedProfit} semantic="plain" />
                <Metric label={t('investors.ownerProfitAvailable') as string} value={breakdown.displayAvailableProfit} />
            </CardContent>
            {breakdown.profitDeficit > 0.005 && (
                <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-financial-loss">
                    <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{t('investors.profitDeficit') as string}: <CurrencyAmount value={breakdown.profitDeficit} currency="DZD" semantic="loss" size="sm" decimals={0} /></span>
                </div>
            )}
            <p className="px-4 pb-4 text-[11px] text-neutral-400">
                {t('investors.projectNetProfit') as string}: <CurrencyAmount value={breakdown.projectNetProfit} currency="DZD" semantic="plain" size="sm" decimals={0} />
                {' · '}{t('investors.deliveryExpenses') as string}: <CurrencyAmount value={breakdown.totalDeliveryExpenses} currency="DZD" semantic="plain" size="sm" decimals={0} />
            </p>
        </Card>
    );
}

export type FinancialAuditData = {
    projectStartLabel: string;
    personalExpenseSummary: PeriodAmountSummary;
    deliveryExpenseSummary: PeriodAmountSummary;
    capitalReconciliation: OwnerCapitalReconciliation;
};

export function FinancialAuditCard({ breakdown, audit }: { breakdown: ManagerProfitBreakdown; audit: FinancialAuditData }) {
    const { t } = useLanguage();
    const reconciliation = audit.capitalReconciliation;
    const differenceIsMaterial = Math.abs(reconciliation.difference) > 0.5;
    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <SectionHeading icon={<BriefcaseIcon className="h-4 w-4" />}>
                    {t('dashboard.financialAudit') as string}
                </SectionHeading>
                <p className="mt-1 text-xs text-neutral-500">{t('dashboard.financialAuditHint') as string}</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-3">
                <Metric label={t('dashboard.ownerProfitTotal') as string} value={breakdown.ownerTotalProfit} />
                <Metric label={t('dashboard.personalExpensesSinceStart') as string} value={audit.personalExpenseSummary.sinceStart} semantic="plain" />
                <Metric label={t('investors.ownerProfitAvailable') as string} value={breakdown.displayAvailableProfit} />
            </CardContent>
            <details className="border-t border-border px-4 py-3">
                <summary className="cursor-pointer text-xs font-semibold text-neutral-600">{t('dashboard.auditDetails') as string}</summary>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <AuditRow label={t('dashboard.profitWithdrawals') as string} value={breakdown.profitWithdrawals} />
                    <AuditRow label={t('dashboard.reinvestedProfit') as string} value={breakdown.reinvestedProfit} />
                    <AuditRow label={t('dashboard.personalExpensesThisYear') as string} value={audit.personalExpenseSummary.year} />
                    <AuditRow label={t('dashboard.deliveryExpensesSinceStart') as string} value={audit.deliveryExpenseSummary.sinceStart} />
                    <AuditRow label={t('dashboard.deliveryExpensesThisYear') as string} value={audit.deliveryExpenseSummary.year} />
                    <div className="col-span-2 border-t border-border pt-3">
                        <p className="mb-2 font-semibold text-neutral-600">{t('dashboard.capitalReconciliation') as string}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <AuditRow label={t('dashboard.openingCapital') as string} value={reconciliation.openingCapital} />
                            <AuditRow label={t('dashboard.expectedOwnerCapital') as string} value={reconciliation.expectedCapital} />
                            <AuditRow label={t('dashboard.actualOwnerCapital') as string} value={reconciliation.actualCapital} />
                            <AuditRow label={t('dashboard.capitalDifference') as string} value={reconciliation.difference} semantic={differenceIsMaterial ? 'loss' : 'plain'} />
                        </div>
                        <p className="mt-2 text-[11px] text-neutral-400">
                            {t('dashboard.projectStart') as string}: {audit.projectStartLabel} · {t('dashboard.capitalDifferenceHint') as string}
                        </p>
                    </div>
                </div>
            </details>
        </Card>
    );
}

function AuditRow({ label, value, semantic = 'plain' }: { label: string; value: number; semantic?: 'plain' | 'loss' }) {
    return (
        <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-neutral-500">{label}</span>
            <CurrencyAmount value={value} currency="DZD" semantic={semantic} size="sm" decimals={0} />
        </div>
    );
}
