import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { CurrencyAmount } from './CurrencyAmount';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { SectionCard } from '../cards';
import type { ManagerProfitBreakdown } from '../../hooks/useInvestorEconomics';
import { useLanguage } from '../../contexts/LanguageContext';

function Metric({ label, value, semantic = 'auto' }: { label: string; value: number; semantic?: 'auto' | 'plain' }) {
    return (
        <div className="min-w-0 rounded-xl border border-border bg-surface-muted px-3 py-3">
            <p className="mb-2 truncate text-xs font-semibold text-neutral-500">{label}</p>
            <div>
                <CurrencyAmount value={value} currency="DZD" semantic={semantic} size="lg" decimals={0} />
            </div>
        </div>
    );
}

/** A figure of the owner's breakdown: the whole label (up to two lines), then the amount. */
function BreakdownMetric({ label, value, semantic = 'auto' }: { label: string; value: number; semantic?: 'auto' | 'plain' }) {
    return (
        <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
            <p className="line-clamp-2 break-words text-xs font-semibold leading-snug text-neutral-500">{label}</p>
            <CurrencyAmount value={value} currency="DZD" semantic={semantic} size="md" decimals={0} className="mt-0.5 block font-semibold" />
        </div>
    );
}

function BreakdownPercentage({ label, value }: { label: string; value: number }) {
    const formatted = Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    return (
        <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
            <p className="line-clamp-2 break-words text-xs font-semibold leading-snug text-neutral-500">{label}</p>
            <p dir="ltr" className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900 rtl:text-right">
                {formatted}<span className="ms-1 text-[length:max(0.82em,12px)] font-normal opacity-65">%</span>
            </p>
        </div>
    );
}

export function OwnerProfitBreakdownCard({ breakdown }: { breakdown: ManagerProfitBreakdown }) {
    const { t } = useLanguage();
    return (
        <SectionCard title={t('investors.ownerProfitBreakdown') as string}>
            <p className="-mt-1 mb-3 text-xs text-neutral-500">{t('investors.ownerProfitBreakdownHint') as string}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <BreakdownMetric label={t('investors.ideaShare') as string} value={breakdown.ideaShareProfit} />
                <BreakdownPercentage label={t('investors.managerCommissionRate') as string} value={breakdown.managerFeePercentage} />
                <BreakdownMetric label={t('investors.personalCapitalShare') as string} value={breakdown.personalCapitalProfit} />
                <BreakdownMetric label={t('investors.serviceProfit') as string} value={breakdown.serviceProfit} />
                <BreakdownMetric label={t('investors.personalTotalProfit') as string} value={breakdown.ownerTotalProfit} />
                <BreakdownMetric label={t('investors.profitsReinvestedInCapital') as string} value={breakdown.retainedProfit} />
                <BreakdownMetric label={t('investors.externalInvestorsShare') as string} value={breakdown.externalInvestorsProfit} semantic="plain" />
                <BreakdownMetric label={t('investors.openingCapital') as string} value={breakdown.openingCapital} semantic="plain" />
                <BreakdownMetric label={t('investors.historicalPersonalExpenses') as string} value={breakdown.personalExpenses} semantic="plain" />
                <BreakdownMetric label={t('investors.currentPersonalExpenses') as string} value={breakdown.currentPersonalExpenses} semantic="plain" />
                <BreakdownMetric label={t('investors.totalPersonalExpenses') as string} value={breakdown.totalPersonalExpenses} semantic="plain" />
                <BreakdownMetric label={t('investors.personalExpensesChargedToCapital') as string} value={breakdown.personalExpensesChargedToCapital} semantic="plain" />
                <BreakdownMetric label={t('investors.capitalFromBalanceSheet') as string} value={breakdown.actualOwnerCapital} semantic="plain" />
                <BreakdownMetric label={t('investors.capitalFromHistory') as string} value={breakdown.historicalOwnerCapital} semantic="plain" />
            </div>
            {Math.abs(breakdown.ownerCapitalReconciliationDifference) >= 0.005 && (
                <div className="mt-3 flex items-start gap-2 rounded-button bg-financial-loss-bg px-3 py-2.5">
                    <AlertTriangleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-financial-loss" />
                    <p className="min-w-0 text-xs leading-relaxed text-neutral-700">
                        <span className="font-bold text-neutral-900">{t('investors.ownerCapitalReconciliationDifference') as string}: </span><CurrencyAmount value={breakdown.ownerCapitalReconciliationDifference} currency="DZD" semantic="loss" size="sm" decimals={0} className="font-semibold" />
                        {' '}{t('investors.ownerCapitalReconciliationHint') as string}
                    </p>
                </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                {t('investors.projectNetProfit') as string}: <CurrencyAmount value={breakdown.projectNetProfit} currency="DZD" semantic="plain" size="sm" decimals={0} />
                {' · '}{t('investors.deliveryExpenses') as string}: <CurrencyAmount value={breakdown.totalDeliveryExpenses} currency="DZD" semantic="plain" size="sm" decimals={0} />
                {(breakdown.totalDebtWriteOffs ?? 0) > 0 && (<>
                    {' · '}{t('investors.debtWriteOffs') as string}: <CurrencyAmount value={breakdown.totalDebtWriteOffs ?? 0} currency="DZD" semantic="plain" size="sm" decimals={0} />
                </>)}
            </p>
        </SectionCard>
    );
}

export type FinancialAuditData = {
    openingCapital: number;
    tradingOwnerProfit: number;
    serviceProfit: number;
    historicalPersonalExpenses: number;
    currentPersonalExpenses: number;
    totalPersonalExpenses: number;
    deliveryExpensesSinceStart: number;
    actualOwnerCapital: number;
};

export function FinancialAuditCard({ breakdown, audit }: { breakdown: ManagerProfitBreakdown; audit: FinancialAuditData }) {
    const { t } = useLanguage();
    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <SectionHeading icon={<BriefcaseIcon className="h-4 w-4" />}>
                    {t('dashboard.financialAudit') as string}
                </SectionHeading>
                <p className="mt-1 text-xs text-neutral-500">{t('dashboard.financialAuditHint') as string}</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-2 lg:grid-cols-6">
                <Metric label={t('dashboard.openingCapital') as string} value={audit.openingCapital} semantic="plain" />
                <Metric label={t('investors.capitalFromBalanceSheet') as string} value={audit.actualOwnerCapital} semantic="plain" />
                <Metric label={t('dashboard.ownerProfitTotal') as string} value={breakdown.ownerTotalProfit} />
                <Metric label={t('dashboard.serviceProfit') as string} value={audit.serviceProfit} />
                <Metric label={t('dashboard.historicalPersonalExpenses') as string} value={audit.historicalPersonalExpenses} semantic="plain" />
                <Metric label={t('dashboard.totalPersonalExpenses') as string} value={audit.totalPersonalExpenses} semantic="plain" />
            </CardContent>
            <details className="border-t border-border px-4 py-3">
                <summary className="cursor-pointer text-xs font-semibold text-neutral-600">{t('dashboard.auditDetails') as string}</summary>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <AuditRow label={t('dashboard.openingCapital') as string} value={audit.openingCapital} />
                    <AuditRow label={t('investors.capitalFromBalanceSheet') as string} value={breakdown.actualOwnerCapital} />
                    <AuditRow label={t('investors.capitalFromHistory') as string} value={breakdown.historicalOwnerCapital} />
                    <AuditRow label={t('investors.ownerCapitalReconciliationDifference') as string} value={breakdown.ownerCapitalReconciliationDifference} semantic="loss" />
                    <AuditRow label={t('dashboard.tradingOwnerProfit') as string} value={audit.tradingOwnerProfit} />
                    <AuditRow label={t('dashboard.serviceProfit') as string} value={audit.serviceProfit} />
                    <AuditRow label={t('investors.profitsReinvestedInCapital') as string} value={breakdown.retainedProfit} />
                    <AuditRow label={t('investors.personalExpensesChargedToProfit') as string} value={breakdown.personalExpensesChargedToProfit} />
                    <AuditRow label={t('investors.personalExpensesChargedToCapital') as string} value={breakdown.personalExpensesChargedToCapital} />
                    <AuditRow label={t('dashboard.historicalPersonalExpenses') as string} value={audit.historicalPersonalExpenses} />
                    <AuditRow label={t('dashboard.currentPersonalExpenses') as string} value={audit.currentPersonalExpenses} />
                    <AuditRow label={t('dashboard.totalPersonalExpenses') as string} value={audit.totalPersonalExpenses} />
                    <AuditRow label={t('dashboard.deliveryExpensesSinceStart') as string} value={audit.deliveryExpensesSinceStart} />
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
