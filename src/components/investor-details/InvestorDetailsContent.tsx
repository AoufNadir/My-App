import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { SectionHeading } from '../ui/SectionHeading';
import { Tabs } from '../ui/Tabs';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { HeroKpiCard } from '../ui/HeroKpiCard';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { PlusIcon } from '../icons/PlusIcon';
import { MinusIcon } from '../icons/MinusIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { UserIcon } from '../icons/UserIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { Investor, InvestorTransaction } from '../../types';
import { formatNumber } from '../../pages/shared/pageFormat';
type InvestorDetailsContentProps = {
    investor: Investor;
    orderedTransactions: InvestorTransaction[];
    activeTab: 'overview' | 'history';
    setActiveTab: (tab: 'overview' | 'history') => void;
    onAddCapital: () => void;
    onWithdrawCapital: () => void;
    onWithdrawProfit: () => void;
    onReinvestProfit: () => void;
    onDeleteTransaction: (tx: InvestorTransaction) => void;
};
type TxMeta = { label: string; isPositive: boolean; icon: React.ReactNode };
function getTxMeta(tx: InvestorTransaction): TxMeta {
    switch (tx.type) {
        case 'profit_distribution':
            return { label: 'Distribution de Profit', isPositive: true, icon: <PlusIcon className="w-4 h-4"/> };
        case 'withdraw_profit':
            return { label: 'Retrait de Bénéfices', isPositive: false, icon: <WalletIcon className="w-4 h-4"/> };
        case 'reinvest_profit':
            return { label: 'Réinvestissement', isPositive: true, icon: <PlusIcon className="w-4 h-4"/> };
        case 'deposit_capital':
            return { label: 'Ajout de Capital', isPositive: true, icon: <PlusIcon className="w-4 h-4"/> };
        default:
            return { label: 'Retrait de Capital', isPositive: false, icon: <MinusIcon className="w-4 h-4"/> };
    }
}
function diffDaysSince(entryDate: string): number {
    const start = new Date(entryDate).getTime();
    if (!Number.isFinite(start)) return 0;
    return Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)));
}
export function InvestorDetailsContent({ investor, orderedTransactions, activeTab, setActiveTab, onAddCapital, onWithdrawCapital, onWithdrawProfit, onReinvestProfit, onDeleteTransaction }: InvestorDetailsContentProps) {
    const currentTotalProfit = investor.totalProfit || 0;
    const currentAvailable = investor.availableProfit || 0;
    const currentWithdrawn = investor.withdrawnProfit || 0;
    const sharePercentDisplay = formatNumber((investor.sharePercentage || 0) * 100, { min: 2, max: 2 });
    const roiDisplay = (investor as any).roi !== null && (investor as any).roi !== undefined
        ? formatNumber((investor as any).roi, { min: 2, max: 2 })
        : null;
    const canReinvest = currentAvailable > 0.01;
    const investmentDays = useMemo(() => diffDaysSince(investor.entryDate), [investor.entryDate]);
    const formattedEntryDate = useMemo(() => new Date(investor.entryDate).toLocaleDateString('fr-FR'), [investor.entryDate]);
    const primaryActionClass = 'flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-sm transition-transform hover:bg-primary-dark active:scale-95';
    const secondaryActionClass = 'flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-100 py-3 text-sm font-bold text-neutral-700 transition-transform hover:bg-neutral-200 active:scale-95';
    return (<>
      <HeroKpiCard accent="sky" icon={<UserIcon className="w-5 h-5"/>} primaryLabel="Capital Investi" primaryValue={investor.capitalInvested} primaryCurrency="DZD" primarySemantic="plain" secondary={[
            { label: 'Profit disponible', value: currentAvailable, currency: 'DZD', semantic: 'auto' },
            { label: 'Total gagné', value: currentTotalProfit, currency: 'DZD', semantic: 'auto' },
            { label: 'Total retiré', value: currentWithdrawn, currency: 'DZD', semantic: 'plain' },
            {
                label: 'Part du fonds',
                value: 0,
                display: (<span className="text-lg font-semibold">
                <bdi>{sharePercentDisplay}</bdi>
                <span className="ms-1 text-[0.85em] opacity-70 font-normal">%</span>
              </span>),
            },
            {
                label: 'ROI',
                value: 0,
                display: roiDisplay !== null ? (<span className={`text-lg font-semibold ${(investor as any).roi > 0 ? 'text-financial-profit' : (investor as any).roi < 0 ? 'text-financial-loss' : 'text-neutral-500'}`}>
                  <bdi>{(investor as any).roi > 0 ? '+' : ''}{roiDisplay}</bdi>
                  <span className="ms-1 text-[0.85em] opacity-70 font-normal">%</span>
                </span>) : <span className="text-lg text-neutral-400">—</span>
            }
        ]}/>

      <Card>
        <CardHeader className="p-4 pb-3">
          <SectionHeading icon={<WalletIcon className="w-4 h-4"/>}>Actions</SectionHeading>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={onAddCapital} className={primaryActionClass}>
              <PlusIcon className="w-4 h-4"/> Ajouter Capital
            </Button>
            <Button onClick={onWithdrawCapital} className={secondaryActionClass}>
              <MinusIcon className="w-4 h-4"/> Retirer Capital
            </Button>
            <Button onClick={onWithdrawProfit} className={secondaryActionClass}>
              <WalletIcon className="w-4 h-4"/> Retirer Bénéfices
            </Button>
            <Button onClick={onReinvestProfit} disabled={!canReinvest} className={`${primaryActionClass} ${!canReinvest ? 'cursor-not-allowed opacity-40 hover:bg-primary' : ''}`}>
              <PlusIcon className="w-4 h-4"/> Réinvestir
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs tabs={[
            { id: 'overview', label: 'Aperçu' },
            { id: 'history', label: 'Historique', badge: orderedTransactions.length }
        ]} activeTab={activeTab} onChange={(id) => setActiveTab(id as 'overview' | 'history')} variant="underline"/>

      {activeTab === 'overview' && (<div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <SectionHeading icon={<InfoIcon className="w-4 h-4"/>}>Informations</SectionHeading>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-neutral-100">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="text-sm text-neutral-500">Statut</span>
                <span className="flex items-center gap-2 text-base font-semibold">
                  <Badge variant={investor.isActive ? 'success' : 'neutral'}>{investor.isActive ? 'Actif' : 'Inactif'}</Badge>
                  {investor.isManager && (<Badge variant="warning">Gérant</Badge>)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="text-sm text-neutral-500">Date d'entrée</span>
                <span className="text-base font-semibold">{formattedEntryDate}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="text-sm text-neutral-500">Durée d'investissement</span>
                <span className="text-base font-semibold">
                  {investmentDays} <span className="text-sm font-normal text-neutral-500">jours</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="text-sm text-neutral-500">Part du fonds</span>
                <span className="text-base font-semibold">
                  <bdi>{sharePercentDisplay}</bdi>
                  <span className="ms-1 text-[0.85em] opacity-70 font-normal">%</span>
                </span>
              </div>
            </CardContent>
          </Card>

          {investor.notes && (<Card>
              <CardHeader className="p-4 pb-2">
                <SectionHeading icon={<InfoIcon className="w-4 h-4"/>}>Notes</SectionHeading>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-700">{investor.notes}</p>
              </CardContent>
            </Card>)}
        </div>)}

      {activeTab === 'history' && (<Card>
          <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
            <SectionHeading icon={<FileSpreadsheetIcon className="w-4 h-4"/>}>Historique</SectionHeading>
            <span className="text-sm text-neutral-500">{orderedTransactions.length} opérations</span>
          </CardHeader>
          <CardContent className="p-0">
            {orderedTransactions.length === 0 ? (<EmptyState icon={<FileSpreadsheetIcon className="w-5 h-5"/>} title="Aucune transaction."/>) : (<div className="divide-y divide-neutral-100">
                {orderedTransactions.map((tx) => {
                    const meta = getTxMeta(tx);
                    const signedAmount = (meta.isPositive ? 1 : -1) * Math.abs(tx.amount);
                    return (<React.Fragment key={tx.id}>
                      <SwipeableListItem onDelete={() => onDeleteTransaction(tx)}>
                        <div className="flex w-full items-center justify-between gap-3 bg-surface px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                              {meta.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-semibold truncate">{meta.label}</p>
                              <p className="text-xs text-neutral-500">{tx.date} à {tx.time}</p>
                              {tx.notes && <p className="text-xs text-neutral-500 mt-0.5 truncate">{tx.notes}</p>}
                            </div>
                          </div>
                          <div className="shrink-0 text-end">
                            <CurrencyAmount value={signedAmount} currency="DZD" semantic="auto" size="lg" showSign decimals={0}/>
                          </div>
                        </div>
                      </SwipeableListItem>
                    </React.Fragment>);
                })}
              </div>)}
          </CardContent>
        </Card>)}
    </>);
}
