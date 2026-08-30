import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { SectionHeading } from '../ui/SectionHeading';
import { HeroKpiCard } from '../ui/HeroKpiCard';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { FilterIcon } from '../icons/FilterIcon';
import { UserIcon } from '../icons/UserIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { UploadCloudIcon } from '../icons/UploadCloudIcon';
import { DownloadCloudIcon } from '../icons/DownloadCloudIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { CsvImportSheet, type CsvFieldSpec } from '../import/CsvImportSheet';
import { ClientDzd, OverdueDebtClient } from '../../types';
import { OverdueDebtsModal } from './OverdueDebtsModal';
import { useLanguage } from '../../contexts/LanguageContext';

async function exportClientsPdf(clients: ClientDzd[], balances: Map<string, number>, getName: (c: ClientDzd) => string) {
    const { buildClientListPdf, openPdfPrintWindow } = await import('../../utils/pdfReports');
    const rows = clients.map((c) => ({
        name: getName(c),
        phone: c.phone,
        email: c.binanceEmail,
        redotpay: c.redotpayId,
        balance: balances.get(c.id) || 0,
    }));
    const report = buildClientListPdf(rows);
    openPdfPrintWindow(report);
}
const CLIENT_IMPORT_FIELDS: CsvFieldSpec[] = [
    { key: 'fullName', label: 'Nom complet', required: true, aliases: ['name', 'nom', 'fullname'] },
    { key: 'phone', label: 'Téléphone', aliases: ['phone', 'tel', 'mobile'] },
    { key: 'binanceEmail', label: 'Email Binance', aliases: ['email', 'binance'] },
    { key: 'redotpayId', label: 'Redotpay ID', aliases: ['redotpay', 'redot'] },
    { key: 'initialBalance', label: 'Solde initial (DZD)', aliases: ['solde', 'balance', 'initial'] }
];
type ClientSortMode = 'all' | 'advances' | 'debts' | 'debts_oldest_highest' | 'zero_balance';
const CLIENT_SORT_LABEL_KEYS: Record<ClientSortMode, string> = {
    all: 'clients.sortAll',
    advances: 'clients.sortAdvances',
    debts: 'clients.sortDebts',
    debts_oldest_highest: 'clients.sortDebtsOldest',
    zero_balance: 'clients.zeroBalance'
};
type ClientsListViewProps = {
    openClientModal: (client: ClientDzd | null) => void;
    clientSearchQuery: string;
    setClientSearchQuery: (query: string) => void;
    clientSortMode: ClientSortMode;
    setClientSortMode: (mode: ClientSortMode) => void;
    filteredClientsDzd: ClientDzd[];
    clientBalances: Map<string, number>;
    getClientFullName: (client: ClientDzd) => string;
    handleTouchStart: (client: ClientDzd) => void;
    handleTouchEnd: () => void;
    setClientToDelete: (client: ClientDzd | null) => void;
    setSelectedClientId: (id: string | null) => void;
    overdueDebtClients: OverdueDebtClient[];
    clientLoyaltyMap?: Map<string, 'vip' | 'regular' | 'petit' | 'new' | 'inactive' | 'fournisseur'>;
    clientPrevMonthVolume?: Map<string, number>;
    clientLastSellDate?: Map<string, number>;
    handleZeroOutBalance?: (clientId: string, balance: number) => Promise<void>;
    onImportClients?: (rows: Record<string, string>[]) => Promise<void>;
};

type TierKey = 'vip' | 'regular' | 'petit' | 'new' | 'inactive' | 'fournisseur';
const LOYALTY_CONFIG: Record<TierKey, { label: string; dot: string; chipCls: string; badgeCls: string }> = {
    vip:        { label: 'clients.tierVip',        dot: 'bg-amber-400',   chipCls: 'border-amber-200 text-amber-700 bg-amber-50',     badgeCls: 'bg-amber-50 text-amber-700 border-amber-200' },
    regular:    { label: 'clients.tierRegular',    dot: 'bg-primary',     chipCls: 'border-primary/25 text-primary bg-primary/5',     badgeCls: 'bg-primary/8 text-primary border-primary/20' },
    petit:      { label: 'clients.tierPetit',      dot: 'bg-orange-400',  chipCls: 'border-orange-200 text-orange-700 bg-orange-50',  badgeCls: 'bg-orange-50 text-orange-700 border-orange-200' },
    new:        { label: 'clients.tierNew',        dot: 'bg-neutral-400', chipCls: 'border-neutral-200 text-neutral-600 bg-neutral-50', badgeCls: 'bg-neutral-50 text-neutral-500 border-neutral-200' },
    inactive:   { label: 'clients.tierInactive',   dot: 'bg-neutral-300', chipCls: 'border-neutral-200 text-neutral-400 bg-surface', badgeCls: 'bg-surface text-neutral-400 border-neutral-200' },
    fournisseur:{ label: 'clients.tierFournisseur',dot: 'bg-teal-400',    chipCls: 'border-teal-200 text-teal-700 bg-teal-50',       badgeCls: 'bg-teal-50 text-teal-700 border-teal-200' },
};

export function ClientsListView({ openClientModal, clientSearchQuery, setClientSearchQuery, clientSortMode, setClientSortMode, filteredClientsDzd, clientBalances, getClientFullName, handleTouchStart, handleTouchEnd, setClientToDelete, setSelectedClientId, overdueDebtClients, clientLoyaltyMap, clientPrevMonthVolume, clientLastSellDate, handleZeroOutBalance, onImportClients }: ClientsListViewProps) {
    const { t } = useLanguage();
    const INITIAL_VISIBLE_CLIENTS = 50;
    const LOAD_MORE_CLIENTS = 50;
    const [visibleClientCount, setVisibleClientCount] = useState(INITIAL_VISIBLE_CLIENTS);
    const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
    const [activeTierFilter, setActiveTierFilter] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
    const [solderTarget, setSolderTarget] = useState<{ clientId: string; name: string; balance: number } | null>(null);
    useEffect(() => {
        setVisibleClientCount(INITIAL_VISIBLE_CLIENTS);
    }, [filteredClientsDzd, activeTierFilter, activeGroupFilter]);

    // Tier counts (for chip badges)
    const tierCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (!clientLoyaltyMap) return counts;
        for (const client of filteredClientsDzd) {
            const tier = clientLoyaltyMap.get(client.id) ?? 'inactive';
            counts.set(tier, (counts.get(tier) || 0) + 1);
        }
        return counts;
    }, [filteredClientsDzd, clientLoyaltyMap]);

    // Format last sell date
    const fmtRelDate = (ts: number) => {
        const days = Math.floor((Date.now() - ts) / 86_400_000);
        if (days === 0) return t('clients.relToday');
        if (days === 1) return t('clients.relYesterday');
        return `${t('clients.agoWord')} ${days} ${t('clients.daysWord')}`;
    };

    // Available groups
    const availableGroups = useMemo(() => {
        const groups = new Set<string>();
        filteredClientsDzd.forEach(c => { if (c.group) groups.add(c.group); });
        return Array.from(groups).sort();
    }, [filteredClientsDzd]);

    // Chain: tier filter → group filter → visible
    const tierFilteredClients = useMemo(() =>
        activeTierFilter && clientLoyaltyMap
            ? filteredClientsDzd.filter(c => (clientLoyaltyMap.get(c.id) ?? 'inactive') === (activeTierFilter as TierKey))
            : filteredClientsDzd,
        [filteredClientsDzd, activeTierFilter, clientLoyaltyMap]
    );
    const groupFilteredClients = useMemo(() =>
        activeGroupFilter ? tierFilteredClients.filter(c => c.group === activeGroupFilter) : tierFilteredClients,
        [tierFilteredClients, activeGroupFilter]
    );
    const visibleClients = useMemo(() => groupFilteredClients.slice(0, visibleClientCount), [groupFilteredClients, visibleClientCount]);
    const hiddenClientCount = Math.max(0, groupFilteredClients.length - visibleClientCount);
    const overdueByClientId = useMemo(() => new Map(overdueDebtClients.map((client) => [client.clientId, client])), [overdueDebtClients]);
    const clientsWithDebt = useMemo(() => filteredClientsDzd.filter((client) => (clientBalances.get(client.id) || 0) < 0).length, [filteredClientsDzd, clientBalances]);
    const clientsWithAdvance = useMemo(() => filteredClientsDzd.filter((client) => (clientBalances.get(client.id) || 0) > 0).length, [filteredClientsDzd, clientBalances]);
    const overdueCount = overdueDebtClients.length;
    const hasOverdue = overdueCount > 0;
    const overdueDisplay = (<button type="button" onClick={() => setIsOverdueModalOpen(true)} className={`flex items-baseline gap-1 text-lg font-semibold transition-opacity hover:opacity-80 ${hasOverdue ? 'text-financial-loss' : 'text-neutral-500'}`}>
      <span className="inline-flex items-center gap-1">
        {hasOverdue && <AlertTriangleIcon className="w-3.5 h-3.5"/>}
        <bdi>{overdueCount}</bdi>
      </span>
    </button>);
    return (<div className="space-y-4">
      {hasOverdue && (<button type="button" onClick={() => setIsOverdueModalOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-start transition-opacity hover:opacity-90 active:scale-[0.99]">
          <AlertTriangleIcon className="h-5 w-5 shrink-0 text-danger"/>
          <div className="min-w-0">
            <p className="text-sm font-bold text-danger">
              {overdueCount} {t('clients.latePayment')}
            </p>
            <p className="mt-0.5 text-xs text-danger/70">
              {t('clients.lateBanner')}
            </p>
          </div>
        </button>)}

      <HeroKpiCard accent="sky" icon={<UsersIcon className="w-5 h-5"/>} primaryLabel={t('clients.listOverview') as string} primaryValue={filteredClientsDzd.length} primaryCurrency={null} primarySemantic="plain" secondary={[
            { label: t('clients.sortDebts') as string, value: clientsWithDebt, currency: null, semantic: 'plain' },
            { label: t('clients.sortAdvances') as string, value: clientsWithAdvance, currency: null, semantic: 'plain' },
            { label: t('clients.lateShort') as string, value: overdueCount, display: overdueDisplay }
        ]}/>

      <div className="flex gap-2">
        <Button onClick={() => openClientModal(null)} variant="primary" size="lg" className="flex-1 font-bold">
          <UserIcon className="w-5 h-5"/>
          <span>{t('transactions.newClient')}</span>
        </Button>
        <Button onClick={() => exportClientsPdf(filteredClientsDzd, clientBalances, getClientFullName)} variant="outline" size="icon" aria-label={t('clients.exportPdfList')} title={t('clients.exportPdfList')} className="shrink-0">
          <DownloadCloudIcon className="w-5 h-5"/>
        </Button>
        {onImportClients && (<Button onClick={() => setImportOpen(true)} variant="outline" size="icon" aria-label={t('clients.importCsv')} title={t('clients.importCsv')} className="shrink-0">
          <UploadCloudIcon className="w-5 h-5"/>
        </Button>)}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 p-4 pb-3">
          <SectionHeading icon={<UsersIcon className="w-4 h-4"/>}>
            {t('clients.clientsList')}
          </SectionHeading>
          <span className="shrink-0 text-sm text-neutral-500">{filteredClientsDzd.length}</span>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          <Input type="text" placeholder={t('transactions.searchClient')} value={clientSearchQuery} onChange={(e) => setClientSearchQuery(e.target.value)} className="w-full"/>

          {/* Tier filter — dropdown */}
          {clientLoyaltyMap && tierCounts.size > 0 && (
            <Dropdown trigger={(
              <button type="button" className={`mt-3 flex min-h-touch w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${activeTierFilter ? LOYALTY_CONFIG[activeTierFilter as TierKey].chipCls : 'border-border bg-surface text-neutral-600 hover:border-neutral-300'}`}>
                {activeTierFilter ? <>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${LOYALTY_CONFIG[activeTierFilter as TierKey].dot}`}/>
                  <span className="min-w-0 truncate">{t(LOYALTY_CONFIG[activeTierFilter as TierKey].label)}</span>
                  <span className="text-[12px] font-bold">{tierCounts.get(activeTierFilter) || 0}</span>
                  <span className="ms-auto text-xs opacity-50">×</span>
                </> : <>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-300"/>
                  <span className="min-w-0 truncate">{t('clients.allCategories')}</span>
                  <span className="ms-auto text-xs text-neutral-400">{filteredClientsDzd.length}</span>
                </>}
              </button>
            )}>
              <DropdownItem onClick={() => setActiveTierFilter(null)} isActive={!activeTierFilter}>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-neutral-300"/>{t('clients.allWord')} <span className="ms-auto text-xs text-neutral-400">{filteredClientsDzd.length}</span></span>
              </DropdownItem>
              {(['vip', 'regular', 'petit', 'new', 'inactive', 'fournisseur'] as TierKey[])
                .filter(tierKey => (tierCounts.get(tierKey) || 0) > 0)
                .map(tierKey => (
                  <DropdownItem key={tierKey} onClick={() => setActiveTierFilter(activeTierFilter === tierKey ? null : tierKey)} isActive={activeTierFilter === tierKey}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${LOYALTY_CONFIG[tierKey].dot}`}/>
                      {t(LOYALTY_CONFIG[tierKey].label)}
                      <span className="ms-auto text-neutral-400 text-xs font-bold">{tierCounts.get(tierKey)}</span>
                    </span>
                  </DropdownItem>
                ))
              }
            </Dropdown>
          )}

          {/* Group filter chips */}
          {availableGroups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availableGroups.map(g => (
                <button key={g} type="button"
                    onClick={() => setActiveGroupFilter(activeGroupFilter === g ? null : g)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold border transition-colors ${activeGroupFilter === g ? 'bg-primary text-white border-primary' : 'border-border text-neutral-500 hover:border-primary/50 hover:text-primary'}`}>
                    {g} {activeGroupFilter === g && '×'}
                </button>
              ))}
            </div>
          )}

          <Dropdown trigger={(<Button variant="outline" size="md" className="mt-3 w-full justify-start rounded-lg border-border bg-neutral-100 font-semibold text-neutral-800 hover:bg-neutral-200">
                <FilterIcon className="w-4 h-4"/>
                <span className="min-w-0 truncate">{t('clients.filterAction')}</span>
                <span className="ms-auto text-xs text-neutral-500">{t(CLIENT_SORT_LABEL_KEYS[clientSortMode])}</span>
              </Button>)}>
            <DropdownItem onClick={() => setClientSortMode('all')} isActive={clientSortMode === 'all'}>{t('clients.sortAll')}</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('advances')} isActive={clientSortMode === 'advances'}>{t('clients.sortAdvances')} (+)</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('debts')} isActive={clientSortMode === 'debts'}>{t('clients.sortDebts')} (-)</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('debts_oldest_highest')} isActive={clientSortMode === 'debts_oldest_highest'}>{t('clients.sortDebtsOldest')}</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('zero_balance')} isActive={clientSortMode === 'zero_balance'}>{t('clients.zeroBalance')}</DropdownItem>
          </Dropdown>
        </CardContent>

        <CardContent className="p-0">
          {filteredClientsDzd.length > 0 ? (<div className="divide-y divide-neutral-100">
              {visibleClients.map((client) => {
                const balance = clientBalances.get(client.id) || 0;
                const overdue = overdueByClientId.get(client.id);
                const fullName = getClientFullName(client);
                const tier = clientLoyaltyMap?.get(client.id) as TierKey | undefined;
                const tierCfg = tier ? LOYALTY_CONFIG[tier] : null;
                const prevVol = clientPrevMonthVolume?.get(client.id) || 0;
                const lastSell = clientLastSellDate?.get(client.id) || 0;
                const isFournisseur = tier === 'fournisseur';

                return (<SwipeableListItem key={client.id} onEdit={() => openClientModal(client)} onDelete={() => setClientToDelete(client)}>
                    <div onTouchStart={() => handleTouchStart(client)} onTouchEnd={handleTouchEnd} onContextMenu={(e) => { e.preventDefault(); handleTouchStart(client); }}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer w-full relative z-10 bg-surface hover:bg-neutral-50 transition-colors"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '72px' }} onClick={() => setSelectedClientId(client.id)}>

                      {/* Left: tier color indicator */}
                      <div className={`shrink-0 w-1 self-stretch rounded-full ${tierCfg ? tierCfg.dot : 'bg-neutral-200'}`}/>

                      {/* Center: name + meta */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: name + alerts */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="truncate text-[15px] font-semibold text-neutral-900 leading-snug">{fullName}</p>
                          {overdue && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-financial-loss text-[11px] font-bold">
                              <AlertTriangleIcon className="w-3 h-3"/>
                              {overdue.daysOverdue}{t('common.dayShort')}
                            </span>
                          )}
                          {(() => {
                            const limit = client.creditLimit;
                            if (!limit || limit <= 0) return null;
                            const debt = -(clientBalances.get(client.id) || 0);
                            if (debt <= limit) return null;
                            return <span className="shrink-0 text-warning"><AlertTriangleIcon className="w-3 h-3"/></span>;
                          })()}
                        </div>

                        {/* Row 2: tier badge + meta — bigger & cleaner */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {tierCfg && (
                            <span className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold border ${tierCfg.badgeCls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${tierCfg.dot}`}/>
                              {t(tierCfg.label)}
                            </span>
                          )}
                          {!isFournisseur && prevVol > 0 && (
                            <span dir="ltr" className="text-[12px] text-neutral-500 font-medium">
                              {prevVol >= 1000 ? `${(prevVol/1000).toFixed(1)}k` : Math.round(prevVol)} {t('clients.perMonthUnit')}
                            </span>
                          )}
                          {!isFournisseur && lastSell > 0 && (
                            <span className="text-[11px] text-neutral-400">{fmtRelDate(lastSell)}</span>
                          )}
                          {client.group && (
                            <span className="rounded-lg px-2 py-0.5 text-[11px] font-medium bg-neutral-100 text-neutral-500 border border-neutral-200">
                              {client.group}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: balance + Solder */}
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        {balance !== 0 && (
                          <CurrencyAmount value={Math.abs(balance)} currency="DZD" size="md"
                            className={balance < 0 ? 'text-financial-loss' : 'text-financial-profit'}/>
                        )}
                        <span className={`text-[11px] font-semibold ${balance < 0 ? 'text-financial-loss' : balance > 0 ? 'text-financial-profit' : 'text-neutral-400'}`}>
                          {balance < 0 ? t('finance.debt') : balance > 0 ? t('finance.advance') : ''}
                        </span>
                        {handleZeroOutBalance && balance !== 0 && (
                          <button type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setSolderTarget({ clientId: client.id, name: fullName, balance });
                            }}
                            className="mt-1 text-[10px] font-semibold text-neutral-500 hover:text-primary border border-neutral-200 hover:border-primary/30 rounded-lg px-2 py-0.5 transition-colors bg-surface">
                            {t('clients.solder')}
                          </button>
                        )}
                      </div>
                    </div>
                  </SwipeableListItem>);
            })}
            </div>) : (<EmptyState icon={<UsersIcon className="w-5 h-5"/>} title={t('emptyStates.clients.title')} subtitle={t('emptyStates.clients.subtitle')}/>)}
        </CardContent>
        {hiddenClientCount > 0 && (<CardContent className="px-4 pb-4 pt-3">
            <Button onClick={() => setVisibleClientCount((prev) => prev + LOAD_MORE_CLIENTS)} variant="outline" className="w-full rounded-xl px-4 py-3 font-semibold bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
              {t('transactions.showMore')} ({Math.min(hiddenClientCount, LOAD_MORE_CLIENTS)})
            </Button>
            <p className="mt-2 text-center text-xs text-neutral-500">
              {visibleClients.length} / {filteredClientsDzd.length}
            </p>
          </CardContent>)}
      </Card>

      {onImportClients && (<CsvImportSheet isOpen={importOpen} onClose={() => setImportOpen(false)} title={t('clients.importClients')} fields={CLIENT_IMPORT_FIELDS} onConfirm={onImportClients}/>)}

      <OverdueDebtsModal isOpen={isOverdueModalOpen} onClose={() => setIsOverdueModalOpen(false)} overdueDebtors={overdueDebtClients} onOpenClient={setSelectedClientId}/>

      {/* Solder confirmation modal */}
      {solderTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSolderTarget(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
          <div className="relative w-full max-w-sm rounded-2xl bg-surface shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
                </svg>
              </div>
            </div>
            {/* Content */}
            <div className="text-center space-y-1.5">
              <p className="text-base font-bold text-neutral-900">{t('clients.clearResidualTitle')}</p>
              <p className="text-sm text-neutral-500">{solderTarget.name}</p>
              <p className={`text-2xl font-extrabold tabular-nums ${solderTarget.balance < 0 ? 'text-financial-loss' : 'text-financial-profit'}`}>
                {Math.abs(solderTarget.balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
              </p>
              <p className="text-[12px] text-neutral-400">
                {t('clients.clearResidualBody')}
              </p>
            </div>
            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button type="button" onClick={() => setSolderTarget(null)}
                className="rounded-xl border border-border py-3 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button type="button"
                onClick={() => {
                  if (handleZeroOutBalance) handleZeroOutBalance(solderTarget.clientId, solderTarget.balance);
                  setSolderTarget(null);
                }}
                className="rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors shadow-sm">
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>);
}
