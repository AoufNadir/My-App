import { useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Badge } from '../components/ui/Badge';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { SwipeableListItem } from '../components/ui/SwipeableListItem';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import type { ManualAsset, ManualAssetClient, ManualAssetTransaction } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
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
    return (<div className="anim-page-in space-y-4">
      <PageHeader title={t('services.title') as string} subtitle={`${serviceRows.length} service${serviceRows.length > 1 ? 's' : ''}`} className="-mx-4 sm:mx-0 sm:rounded-lg" actions={(<Button onClick={onOpenCreateManualAsset} className="gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            <PlusIcon className="w-4 h-4"/>
            <span className="hidden sm:inline">{t('services.newService')}</span>
          </Button>)}/>

      <HeroKpiCard accent="sky" icon={<BriefcaseIcon className="w-5 h-5"/>} primaryLabel={t('services.toReceive') as string} primaryValue={totals.amountToReceive} primaryCurrency="DZD" primarySemantic="profit" secondary={[
            { label: t('services.capitalImpact') as string, value: totals.netCapitalImpact, currency: 'DZD', semantic: 'auto' },
            { label: t('transactions.paymentReceived') as string, value: totals.cashReceived, currency: 'DZD' },
            { label: t('services.clients') as string, value: totals.clientsCount, currency: null }
        ]}/>

      <Card>
        <CardHeader className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionHeading icon={<BriefcaseIcon className="w-4 h-4"/>}>
                {t('services.title')}
              </SectionHeading>
              <Badge variant="secondary" size="sm">{serviceRows.length}</Badge>
            </div>
            <Button onClick={onOpenCreateManualAsset} variant="outline" className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-neutral-700 transition-all hover:bg-neutral-50 active:scale-[0.98]">
              <PlusIcon className="w-5 h-5"/>
              <span>{t('services.newService')}</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {serviceRows.length > 0 ? (<div className="divide-y divide-neutral-100">
              {serviceRows.map((row) => {
                const initial = (row.asset.name || '?').charAt(0).toUpperCase();
                const subInfo = `${row.clientsCount} client${row.clientsCount > 1 ? 's' : ''} · ${row.servicesCount} service${row.servicesCount > 1 ? 's' : ''}`;
                return (<SwipeableListItem key={row.asset.id} onDelete={() => onDeleteManualAsset(row.asset.id)}>
                    <div onClick={() => onOpenManualAsset(row.asset)} className="flex min-h-touch w-full cursor-pointer items-center gap-3 bg-surface p-4 transition-colors hover:bg-neutral-50">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-base font-bold text-secondary">
                        {initial}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="truncate text-base font-semibold">{row.asset.name}</p>
                        <p className="truncate text-xs text-neutral-500 mt-0.5">{subInfo}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <div className="text-end">
                          <CurrencyAmount value={row.netCapitalImpact} currency="DZD" semantic="auto" size="md" decimals={0} showSign/>
                          {row.amountToReceive > 0 && (<p className="text-xs text-neutral-500">{t('services.toReceive')}</p>)}
                        </div>
                        <ChevronRightIcon className="w-5 h-5 text-neutral-400"/>
                      </div>
                    </div>
                  </SwipeableListItem>);
            })}
            </div>) : (<EmptyState icon={<BriefcaseIcon className="w-6 h-6"/>} title={t('services.title') as string} subtitle={t('services.newService') as string} action={(<Button onClick={onOpenCreateManualAsset} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-white hover:bg-primary-dark">
                  <PlusIcon className="w-4 h-4"/>
                  {t('services.newService')}
                </Button>)}/>)}
        </CardContent>
      </Card>
    </div>);
}
