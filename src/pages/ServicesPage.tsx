import { Fragment, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HeroCard, SectionCard, StatTile } from '../components/cards';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { SwipeableListItem } from '../components/ui/SwipeableListItem';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { useHeaderActionsSlot } from '../components/main/headerActionsSlot';
import type { ManualAsset, ManualAssetClient, ManualAssetTransaction } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getNameInitials } from '../utils/nameUtils';
type ServicesPageProps = {
    manualAssets: ManualAsset[];
    manualAssetClients: ManualAssetClient[];
    manualAssetTransactions: ManualAssetTransaction[];
    assetClientBalances: Map<string, number>;
    onOpenManualAsset: (asset: ManualAsset) => void;
    onOpenCreateManualAsset: () => void;
    onDeleteManualAsset: (assetId: string) => void;
};
type ServiceStats = {
    asset: ManualAsset;
    clientsCount: number;
    servicesCount: number;
    serviceRevenue: number;
    cashReceived: number;
    amountToReceive: number;
    clientAdvances: number;
    netCapitalImpact: number;
};
function isServiceLike(tx: ManualAssetTransaction) {
    return tx.type === 'service' || tx.type === 'invoice';
}
function buildServiceStats(asset: ManualAsset, clients: ManualAssetClient[], transactions: ManualAssetTransaction[], assetClientBalances: Map<string, number>): ServiceStats {
    const assetClients = clients.filter((client) => client.assetId === asset.id);
    const assetTransactions = transactions.filter((tx) => tx.actifId === asset.id);
    let amountToReceive = 0;
    let clientAdvances = 0;
    for (const client of assetClients) {
        const balance = assetClientBalances.get(`${asset.id}_${client.id}`) || 0;
        if (balance < -0.005) amountToReceive += Math.abs(balance);
        else if (balance > 0.005) clientAdvances += balance;
    }
    const serviceRevenue = assetTransactions.reduce((sum, tx) => sum + (isServiceLike(tx) ? Math.abs(Number(tx.amount || 0)) : 0), 0);
    const cashReceived = assetTransactions.reduce((sum, tx) => sum + (tx.type === 'payment_received' ? Math.abs(Number(tx.amount || 0)) : 0), 0);
    return { asset, clientsCount: assetClients.length, servicesCount: assetTransactions.filter(isServiceLike).length, serviceRevenue, cashReceived, amountToReceive, clientAdvances, netCapitalImpact: amountToReceive - clientAdvances };
}
export function ServicesPage({ manualAssets, manualAssetClients, manualAssetTransactions, assetClientBalances, onOpenManualAsset, onOpenCreateManualAsset, onDeleteManualAsset }: ServicesPageProps) {
    const { t } = useLanguage();
    const serviceRows = useMemo(() => manualAssets
        .filter((asset) => asset.archived !== true)
        .map((asset) => buildServiceStats(asset, manualAssetClients, manualAssetTransactions, assetClientBalances))
        .sort((left, right) => {
            if (right.netCapitalImpact !== left.netCapitalImpact) return right.netCapitalImpact - left.netCapitalImpact;
            return left.asset.name.localeCompare(right.asset.name, 'fr');
        }), [manualAssets, manualAssetClients, manualAssetTransactions, assetClientBalances]);
    const totals = useMemo(() => serviceRows.reduce((acc, row) => ({
        amountToReceive: acc.amountToReceive + row.amountToReceive,
        clientAdvances: acc.clientAdvances + row.clientAdvances,
        cashReceived: acc.cashReceived + row.cashReceived,
        netCapitalImpact: acc.netCapitalImpact + row.netCapitalImpact,
        clientsCount: acc.clientsCount + row.clientsCount
    }), { amountToReceive: 0, clientAdvances: 0, cashReceived: 0, netCapitalImpact: 0, clientsCount: 0 }), [serviceRows]);
    const headerActionsSlot = useHeaderActionsSlot();
    const newServiceLabel = t('services.newService') as string;
    // "3 clients · 4 services": plural from 2 on, as before.
    const countOf = (count: number, one: string, many: string) => `${count} ${t(count > 1 ? many : one)}`;
    return (<div className="anim-page-in flex flex-col gap-3">
      {/* Phones get this one in the header. */}
      <div className="hidden gap-2 sm:flex">
        <Button onClick={onOpenCreateManualAsset} variant="primary" size="md" className="font-bold">
          <PlusIcon className="h-4 w-4"/>
          <span>{newServiceLabel}</span>
        </Button>
      </div>
      {headerActionsSlot && createPortal(<button type="button" onClick={onOpenCreateManualAsset} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95" title={newServiceLabel} aria-label={newServiceLabel}>
          <PlusIcon className="h-[22px] w-[22px]"/>
        </button>, headerActionsSlot)}

      <HeroCard label={t('services.toReceive')} value={totals.amountToReceive} semantic="profit" secondary={{ label: t('services.capitalImpact'), value: totals.netCapitalImpact, semantic: 'auto' }}/>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label={t('transactions.paymentReceived') as string} value={totals.cashReceived}/>
        <StatTile label={t('services.clients') as string} value={totals.clientsCount} currency={null}/>
      </div>

      <SectionCard flush title={<>{t('services.title')} <span className="font-semibold text-neutral-500">· <bdi>{serviceRows.length}</bdi></span></>}>
        {serviceRows.length > 0 ? (<div>
            {serviceRows.map((row) => (<Fragment key={row.asset.id}>
                <SwipeableListItem onDelete={() => onDeleteManualAsset(row.asset.id)}>
                  <div onClick={() => onOpenManualAsset(row.asset)} className="relative z-10 flex w-full cursor-pointer items-center gap-3 border-t border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-muted">
                    {/* The row opens the service; this button gives it to the keyboard. */}
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-button text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-[13px] font-bold text-financial-dzd">
                        {getNameInitials(row.asset.name || '?')}
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* Name and amount share the first line; counts and label use the full width below. */}
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0 break-words pt-0.5 text-[15px] font-semibold leading-snug text-neutral-900">{row.asset.name}</span>
                          <span className="shrink-0">
                            <CurrencyAmount value={row.netCapitalImpact} currency="DZD" semantic="auto" size="md" decimals={0} showSign className="font-semibold"/>
                          </span>
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-500">
                          <span>{countOf(row.clientsCount, 'services.clientOne', 'services.clientMany')} · {countOf(row.servicesCount, 'services.serviceOne', 'services.serviceMany')}</span>
                          {row.amountToReceive > 0 && (<span className="font-semibold text-financial-profit">{t('services.toReceive')}</span>)}
                        </span>
                      </span>
                    </button>
                    <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>
                  </div>
                </SwipeableListItem>
              </Fragment>))}
          </div>) : (<EmptyState icon={<BriefcaseIcon className="h-5 w-5"/>} title={t('services.title') as string} subtitle={newServiceLabel} action={(<Button onClick={onOpenCreateManualAsset} variant="primary" size="md" className="font-bold">
                <PlusIcon className="h-4 w-4"/>
                <span>{newServiceLabel}</span>
              </Button>)}/>)}
      </SectionCard>
    </div>);
}
