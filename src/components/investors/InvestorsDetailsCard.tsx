import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SparklesIcon } from '../icons/SparklesIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
type InvestorsStats = {
    totalCapital: number;
    totalProfitDistributed: number;
    totalAvailable: number;
    managerFee: number;
    totalWithdrawn: number;
    totalDeliveryExpenses?: number;
    netDistributableProfit?: number;
};
type InvestorsDetailsCardProps = {
    stats: InvestorsStats;
    managerFeePercentage: string;
    onOpenCommissionEditor: () => void;
};
function DetailRow({ label, value, semantic = 'auto' }: { label: string; value: number; semantic?: 'auto' | 'loss' | 'plain' }) {
    return (<div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-sm text-neutral-500">{label}</span>
      <CurrencyAmount value={value} currency="DZD" semantic={semantic} size="lg" decimals={0}/>
    </div>);
}
export function InvestorsDetailsCard({ stats, managerFeePercentage, onOpenCommissionEditor }: InvestorsDetailsCardProps) {
    const hasDeliveryExpenses = (stats.totalDeliveryExpenses ?? 0) > 0;
    const displayPercentage = managerFeePercentage?.trim() ? managerFeePercentage : '0';
    return (<Card>
      <CardHeader className="p-4 pb-3">
        <SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>
          Détails Financiers
        </SectionHeading>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-neutral-100">
        <DetailRow label="Profit distribué" value={stats.totalProfitDistributed} semantic="auto"/>
        <DetailRow label="Profit disponible" value={stats.totalAvailable} semantic="auto"/>
        <DetailRow label="Fee gérant" value={stats.managerFee} semantic="auto"/>

        <button type="button" onClick={onOpenCommissionEditor} className="flex min-h-touch w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="text-sm text-neutral-500">Commission gérant</span>
          <span className="flex items-center gap-2">
            <span dir="ltr" className="text-base font-semibold">
              <bdi>{displayPercentage}</bdi>
              <span className="ms-1 text-[0.85em] opacity-70 font-normal">%</span>
            </span>
            <ChevronRightIcon className="w-4 h-4 text-neutral-400"/>
          </span>
        </button>

        {hasDeliveryExpenses && (<>
            <DetailRow label="Frais de livraison" value={stats.totalDeliveryExpenses || 0} semantic="loss"/>
            <DetailRow label="Bénéfice net distribuable" value={stats.netDistributableProfit || 0} semantic="auto"/>
          </>)}
      </CardContent>
    </Card>);
}
