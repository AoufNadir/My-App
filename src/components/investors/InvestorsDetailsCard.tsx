import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SparklesIcon } from '../icons/SparklesIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import type { CapitalSnapshot } from '../../utils/capitalSnapshot';
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
    capitalSnapshot?: CapitalSnapshot;
    managerFeePercentage: string;
    onOpenCommissionEditor: () => void;
    reconciliationDifference?: number;
};
function DetailSection({ children }: { children: React.ReactNode }) {
    return (
      <div className="bg-neutral-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
        {children}
      </div>
    );
}
function DetailRow({ label, value, semantic = 'auto', hideWhenZero = false }: { label: string; value: number; semantic?: 'auto' | 'loss' | 'plain'; hideWhenZero?: boolean }) {
    if (hideWhenZero && Math.abs(value) < 0.005)
        return null;
    return (<div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-sm text-neutral-500">{label}</span>
      <CurrencyAmount value={value} currency="DZD" semantic={semantic} size="lg" decimals={0}/>
    </div>);
}
export function InvestorsDetailsCard({ stats, capitalSnapshot, managerFeePercentage, onOpenCommissionEditor, reconciliationDifference = 0 }: InvestorsDetailsCardProps) {
    const hasDeliveryExpenses = (stats.totalDeliveryExpenses ?? 0) > 0;
    const hasReconciliationIssue = Math.abs(reconciliationDifference) > 0.05;
    const displayPercentage = managerFeePercentage?.trim() ? managerFeePercentage : '0';
    return (<Card>
      <CardHeader className="p-4 pb-3">
        <SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>
          Synthèse financière
        </SectionHeading>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-neutral-100">
        {capitalSnapshot && (<>
            <DetailSection>Actifs du projet</DetailSection>
            <DetailRow label="Capital projet" value={capitalSnapshot.totalCapital} semantic="plain"/>
            <DetailRow label="Caisse + BaridiMob" value={capitalSnapshot.cashTotal} semantic="plain"/>
            <DetailRow label="Stock portefeuille" value={capitalSnapshot.stockValue} semantic="plain"/>
            <DetailRow label="Solde net clients" value={capitalSnapshot.netClientPosition} semantic="auto"/>
            <DetailRow label="Cartes" value={capitalSnapshot.treasuryCardsTotal} semantic="plain" hideWhenZero/>
            <DetailRow label="Services" value={capitalSnapshot.servicesCapitalImpact} semantic="auto" hideWhenZero/>
          </>)}
        <DetailSection>Investisseurs et profits</DetailSection>
        <DetailRow label="Capital investi" value={stats.totalCapital} semantic="plain"/>
        <DetailRow label="Profits investisseurs à payer" value={stats.totalAvailable} semantic="auto"/>
        {capitalSnapshot && (<>
            <DetailSection>Part nette</DetailSection>
            <DetailRow label="Capital propre" value={capitalSnapshot.netOwnedCapital} semantic="plain"/>
          </>)}
        <DetailSection>Résultat</DetailSection>
        <DetailRow label="Part gérant" value={stats.managerFee} semantic="auto"/>
        {!hasDeliveryExpenses && (<DetailRow label="Profit net réparti" value={stats.totalProfitDistributed} semantic="auto"/>)}

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
      {hasReconciliationIssue && (<div className="mx-4 mb-4 flex items-start gap-2 rounded-xl bg-danger-bg px-3 py-2.5">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger"/>
          <div>
            <p className="text-xs font-bold text-danger">Écart de réconciliation détecté</p>
            <p className="mt-0.5 text-xs text-danger/80">
              Différence: <span dir="ltr" className="font-mono">{reconciliationDifference.toFixed(2)} DZD</span> — la somme des parts ne correspond pas au profit total.
            </p>
          </div>
        </div>)}
    </Card>);
}
