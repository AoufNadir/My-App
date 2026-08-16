import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { CurrencyAmount } from './CurrencyAmount';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { UsersIcon } from '../icons/UsersIcon';
import type { ManagerProfitBreakdown } from '../../hooks/useInvestorEconomics';
import { useLanguage } from '../../contexts/LanguageContext';

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
                <Metric label={t('investors.ownerProfitWithdrawn') as string} value={breakdown.withdrawnProfit} semantic="plain" />
                <Metric label={t('investors.ownerProfitAvailable') as string} value={breakdown.availableProfit} />
            </CardContent>
            <p className="px-4 pb-4 text-[11px] text-neutral-400">
                {t('investors.projectNetProfit') as string}: <CurrencyAmount value={breakdown.projectNetProfit} currency="DZD" semantic="plain" size="sm" decimals={0} />
                {' · '}{t('investors.deliveryExpenses') as string}: <CurrencyAmount value={breakdown.totalDeliveryExpenses} currency="DZD" semantic="plain" size="sm" decimals={0} />
            </p>
        </Card>
    );
}
