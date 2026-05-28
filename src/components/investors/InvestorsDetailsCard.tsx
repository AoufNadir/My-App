import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { MoneyText, type MoneySemantic } from '../ui/MoneyText';
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
    cardBase: string;
    subtleText: string;
    stats: InvestorsStats;
    managerFeePercentage: string;
    onOpenCommissionEditor: () => void;
};
type DetailRowProps = {
    label: string;
    value: number;
    semantic?: MoneySemantic;
    subtleText: string;
};
function DetailRow({ label, value, semantic = 'auto', subtleText }: DetailRowProps) {
    return (<div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className={`text-sm ${subtleText || 'text-neutral-500'}`}>{label}</span>
      <MoneyText value={value} currency="DZD" semantic={semantic} size="lg"/>
    </div>);
}
export function InvestorsDetailsCard({ cardBase, subtleText, stats, managerFeePercentage, onOpenCommissionEditor }: InvestorsDetailsCardProps) {
    const hasDeliveryExpenses = (stats.totalDeliveryExpenses ?? 0) > 0;
    const displayPercentage = managerFeePercentage?.trim() ? managerFeePercentage : '0';
    return (<Card className={cardBase}>
      <CardHeader className="p-4 pb-3">
        <SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>
          Details Financiers
        </SectionHeading>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-neutral-100">
        <DetailRow label="Profit distribue" value={stats.totalProfitDistributed} semantic="auto" subtleText={subtleText}/>
        <DetailRow label="Profit disponible" value={stats.totalAvailable} semantic="auto" subtleText={subtleText}/>
        <DetailRow label="Fee gerant" value={stats.managerFee} semantic="auto" subtleText={subtleText}/>

        <button type="button" onClick={onOpenCommissionEditor} className="flex min-h-touch w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className={`text-sm ${subtleText || 'text-neutral-500'}`}>Commission gerant</span>
          <span className="flex items-center gap-2">
            <span dir="ltr" className="text-base font-semibold">
              <bdi>{displayPercentage}</bdi>
              <span className="ms-1 text-[0.85em] opacity-70 font-normal">%</span>
            </span>
            <ChevronRightIcon className={`w-4 h-4 ${subtleText || 'text-neutral-500'}`}/>
          </span>
        </button>

        {hasDeliveryExpenses && (<>
            <DetailRow label="Frais de livraison" value={stats.totalDeliveryExpenses || 0} semantic="loss" subtleText={subtleText}/>
            <DetailRow label="Benefice net distribuable" value={stats.netDistributableProfit || 0} semantic="auto" subtleText={subtleText}/>
          </>)}
      </CardContent>
    </Card>);
}
