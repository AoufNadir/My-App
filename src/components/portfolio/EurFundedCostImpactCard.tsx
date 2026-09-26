import { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SectionHeading } from '../ui/SectionHeading';
import { WalletIcon } from '../icons/WalletIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { summarizeEurFundedCostImpact } from '../../utils/pamLedger';
import type { Tx } from '../../types';

/**
 * USDT bought with EUR costs what left the EUR stock (EUR PAM of the ledger), not the total
 * saved at entry. Shows how much that moves the cost, the cumulative profit and the PAM.
 */
export function EurFundedCostImpactCard({ transactions }: { transactions: Tx[] }) {
    const { t } = useLanguage();
    const impact = useMemo(() => summarizeEurFundedCostImpact(transactions), [transactions]);
    if (!impact || (Math.abs(impact.costChangeDzd) < 1 && Math.abs(impact.profitChangeDzd) < 1))
        return null;
    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <SectionHeading icon={<WalletIcon className="h-4 w-4" />}>
                    {t('portfolio.eurFundedCostTitle') as string}
                </SectionHeading>
                <p className="mt-1 text-xs text-neutral-500">
                    {String(t('portfolio.eurFundedCostHint')).replace('{count}', String(impact.changedBuyCount))}
                </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 p-4 pt-2 text-sm">
                <span className="text-neutral-500">{t('portfolio.eurFundedCostChange') as string}</span>
                <CurrencyAmount value={impact.costChangeDzd} currency="DZD" semantic="plain" size="sm" decimals={0} />
                <span className="text-neutral-500">{t('portfolio.eurFundedProfitChange') as string}</span>
                <CurrencyAmount value={impact.profitChangeDzd} currency="DZD" semantic="auto" size="sm" decimals={0} />
                <span className="text-neutral-500">{t('portfolio.eurFundedPamBefore') as string}</span>
                <CurrencyAmount value={impact.usdtAvgBuyWithSavedTotals} currency="DZD" semantic="plain" size="sm" decimals={2} />
                <span className="text-neutral-500">{t('portfolio.currentPam') as string}</span>
                <CurrencyAmount value={impact.usdtAvgBuy} currency="DZD" semantic="plain" size="sm" decimals={2} />
            </CardContent>
        </Card>
    );
}
