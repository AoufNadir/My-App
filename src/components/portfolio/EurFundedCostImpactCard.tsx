import { useMemo, type ReactNode } from 'react';
import { SectionCard } from '../cards';
import { CurrencyAmount } from '../financial/CurrencyAmount';
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
    const rows: Array<{ label: string; value: ReactNode }> = [
        { label: t('portfolio.eurFundedCostChange'), value: <CurrencyAmount value={impact.costChangeDzd} currency="DZD" semantic="plain" size="sm" decimals={0}/> },
        { label: t('portfolio.eurFundedProfitChange'), value: <CurrencyAmount value={impact.profitChangeDzd} currency="DZD" semantic="auto" size="sm" decimals={0}/> },
        { label: t('portfolio.eurFundedPamBefore'), value: <CurrencyAmount value={impact.usdtAvgBuyWithSavedTotals} currency="DZD" semantic="plain" size="sm" decimals={2}/> },
        { label: t('portfolio.currentPam'), value: <CurrencyAmount value={impact.usdtAvgBuy} currency="DZD" semantic="plain" size="sm" decimals={2}/> },
    ];
    return (<SectionCard title={t('portfolio.eurFundedCostTitle')}>
      <p className="text-xs text-neutral-500">
        {String(t('portfolio.eurFundedCostHint')).replace('{count}', String(impact.changedBuyCount))}
      </p>
      <dl className="mt-2 divide-y divide-border">
        {rows.map((row) => (<div key={row.label} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="min-w-0 text-[13px] text-neutral-600">{row.label}</dt>
            <dd className="shrink-0">{row.value}</dd>
          </div>))}
      </dl>
    </SectionCard>);
}
