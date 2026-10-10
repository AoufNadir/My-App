import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FilterChips, type FilterChip } from '../ui/FilterChips';
import { SearchField } from '../ui/SearchField';
import { AlertCard, SectionCard } from '../cards';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { UserPlusIcon } from '../icons/UserPlusIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { UploadCloudIcon } from '../icons/UploadCloudIcon';
import { DownloadCloudIcon } from '../icons/DownloadCloudIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { CsvImportSheet, type CsvFieldSpec } from '../import/CsvImportSheet';
import { ClientDzd, OverdueDebtClient } from '../../types';
import { OverdueDebtsModal } from './OverdueDebtsModal';
import { useLanguage } from '../../contexts/LanguageContext';
import { useHeaderActionsSlot } from '../main/headerActionsSlot';
import { formatNumber } from '../../pages/shared/pageFormat';
import { getNameInitials } from '../../utils/nameUtils';
import type { ClientListInput } from '../../utils/listReports';

const ClientListDialog = lazy(() => import('../reports/documents/DocumentReportDialogs').then((module) => ({ default: module.ClientListDialog })));
// The French labels stay as aliases, so a file exported in French maps itself in either language.
const CLIENT_IMPORT_FIELDS: Array<Omit<CsvFieldSpec, 'label'> & { labelKey: string }> = [
    { key: 'fullName', labelKey: 'transactions.fullName', required: true, aliases: ['nom complet', 'name', 'nom', 'fullname'] },
    { key: 'phone', labelKey: 'transactions.phone', aliases: ['téléphone', 'phone', 'tel', 'mobile'] },
    { key: 'binanceEmail', labelKey: 'clients.importFieldBinance', aliases: ['email binance', 'email', 'binance'] },
    { key: 'redotpayId', labelKey: 'Redotpay ID', aliases: ['redotpay id', 'redotpay', 'redot'] },
    { key: 'initialBalance', labelKey: 'clients.importFieldInitialBalance', aliases: ['solde initial (dzd)', 'solde', 'balance', 'initial'] }
];
type ClientSortMode = 'all' | 'advances' | 'debts' | 'debts_oldest_highest' | 'zero_balance';
type ClientsListViewProps = {
    openClientModal: (client: ClientDzd | null) => void;
    clientSearchQuery: string;
    setClientSearchQuery: (query: string) => void;
    clientSortMode: ClientSortMode;
    setClientSortMode: (mode: ClientSortMode) => void;
    filteredClientsDzd: ClientDzd[];
    /** Active clients matching the search, before the debt/advance filter: the chips count these */
    searchedClientsDzd?: ClientDzd[];
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
// Each category keeps its colour as a dot; the text stays in the page's text colour (readable at night).
const LOYALTY_CONFIG: Record<TierKey, { label: string; dot: string }> = {
    vip: { label: 'clients.tierVip', dot: 'bg-amber-400' },
    regular: { label: 'clients.tierRegular', dot: 'bg-primary' },
    petit: { label: 'clients.tierPetit', dot: 'bg-orange-400' },
    new: { label: 'clients.tierNew', dot: 'bg-neutral-400' },
    inactive: { label: 'clients.tierInactive', dot: 'bg-neutral-300' },
    fournisseur: { label: 'clients.tierFournisseur', dot: 'bg-teal-400' },
};
const TIER_ORDER: TierKey[] = ['vip', 'regular', 'petit', 'new', 'inactive', 'fournisseur'];
type QuickFilter = ClientSortMode | 'overdue';
const formatCount = (value: number) => formatNumber(value, { min: 0, max: 0 });
export function ClientsListView({ openClientModal, clientSearchQuery, setClientSearchQuery, clientSortMode, setClientSortMode, filteredClientsDzd, searchedClientsDzd, clientBalances, getClientFullName, handleTouchStart, handleTouchEnd, setClientToDelete, setSelectedClientId, overdueDebtClients, clientLoyaltyMap, clientPrevMonthVolume, clientLastSellDate, handleZeroOutBalance, onImportClients }: ClientsListViewProps) {
    const { t } = useLanguage();
    const headerActionsSlot = useHeaderActionsSlot();
    const INITIAL_VISIBLE_CLIENTS = 50;
    const LOAD_MORE_CLIENTS = 50;
    const [visibleClientCount, setVisibleClientCount] = useState(INITIAL_VISIBLE_CLIENTS);
    const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
    const [activeTierFilter, setActiveTierFilter] = useState<string | null>(null);
    const [overdueOnly, setOverdueOnly] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
    const [solderTarget, setSolderTarget] = useState<{ clientId: string; name: string; balance: number } | null>(null);
    useEffect(() => {
        setVisibleClientCount(INITIAL_VISIBLE_CLIENTS);
    }, [filteredClientsDzd, activeTierFilter, activeGroupFilter, overdueOnly]);

    // Tier counts (for the category picker)
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

    const overdueByClientId = useMemo(() => new Map(overdueDebtClients.map((client) => [client.clientId, client])), [overdueDebtClients]);
    // Chain: late payers → tier filter → group filter → visible
    const listedClients = useMemo(() =>
        overdueOnly ? filteredClientsDzd.filter((client) => overdueByClientId.has(client.id)) : filteredClientsDzd,
        [filteredClientsDzd, overdueOnly, overdueByClientId]
    );
    const tierFilteredClients = useMemo(() =>
        activeTierFilter && clientLoyaltyMap
            ? listedClients.filter(c => (clientLoyaltyMap.get(c.id) ?? 'inactive') === (activeTierFilter as TierKey))
            : listedClients,
        [listedClients, activeTierFilter, clientLoyaltyMap]
    );
    const groupFilteredClients = useMemo(() =>
        activeGroupFilter ? tierFilteredClients.filter(c => c.group === activeGroupFilter) : tierFilteredClients,
        [tierFilteredClients, activeGroupFilter]
    );
    const visibleClients = useMemo(() => groupFilteredClients.slice(0, visibleClientCount), [groupFilteredClients, visibleClientCount]);
    const hiddenClientCount = Math.max(0, groupFilteredClients.length - visibleClientCount);
    // The chips count the searched clients, so that switching one on never empties the others.
    const countedClients = searchedClientsDzd ?? filteredClientsDzd;
    const clientsWithDebt = useMemo(() => countedClients.filter((client) => (clientBalances.get(client.id) || 0) < 0).length, [countedClients, clientBalances]);
    const clientsWithAdvance = useMemo(() => countedClients.filter((client) => (clientBalances.get(client.id) || 0) > 0).length, [countedClients, clientBalances]);
    const overdueCount = overdueDebtClients.length;
    const hasOverdue = overdueCount > 0;

    const activeQuickFilter: QuickFilter = overdueOnly ? 'overdue' : clientSortMode;
    const quickFilters: FilterChip[] = [
        { id: 'all', label: t('clients.sortAll') as string },
        { id: 'debts', label: t('clients.sortDebts') as string, count: formatCount(clientsWithDebt) },
        { id: 'advances', label: t('clients.sortAdvances') as string, count: formatCount(clientsWithAdvance) },
        { id: 'overdue', label: t('clients.lateShort') as string, count: formatCount(overdueCount), urgent: hasOverdue },
        { id: 'debts_oldest_highest', label: t('clients.sortDebtsOldest') as string },
        { id: 'zero_balance', label: t('clients.zeroBalance') as string },
    ];
    const selectQuickFilter = (id: string) => {
        if (id === 'overdue') {
            setOverdueOnly(!overdueOnly);
            if (!overdueOnly && clientSortMode !== 'all') setClientSortMode('all');
            return;
        }
        setOverdueOnly(false);
        setClientSortMode(id === clientSortMode && !overdueOnly ? 'all' : id as ClientSortMode);
    };

    // The client list report: its rows are fixed when the window opens.
    const [listReport, setListReport] = useState<ClientListInput[] | null>(null);
    const exportPdf = () => setListReport(filteredClientsDzd.map((client) => ({
        name: getClientFullName(client),
        phone: client.phone,
        email: client.binanceEmail,
        redotpay: client.redotpayId,
        balance: clientBalances.get(client.id) || 0,
    })));
    const importFields = useMemo<CsvFieldSpec[]>(() => CLIENT_IMPORT_FIELDS.map(({ labelKey, ...field }) => ({ ...field, label: labelKey.includes('.') ? t(labelKey) as string : labelKey })), [t]);
    const headerIconClass = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95';
    const activeTier = activeTierFilter ? LOYALTY_CONFIG[activeTierFilter as TierKey] : null;

    return (<div className="anim-page-in flex flex-col gap-3">
      {hasOverdue && (<AlertCard tone="danger" title={`${overdueCount} ${t('clients.latePayment')}`} detail={t('clients.lateBanner') as string} onAction={() => setIsOverdueModalOpen(true)} actionLabel={t('dashboard.viewAction') as string}/>)}

      {/* Phones get these three in the header, next to search. */}
      <div className="hidden gap-2 sm:flex">
        <Button onClick={() => openClientModal(null)} variant="primary" size="md" className="font-bold">
          <UserPlusIcon className="h-4 w-4"/>
          <span>{t('transactions.newClient')}</span>
        </Button>
        <Button onClick={exportPdf} variant="outline" size="md" className="font-semibold">
          <DownloadCloudIcon className="h-4 w-4"/>
          <span>{t('clients.exportPdfList')}</span>
        </Button>
        {onImportClients && (<Button onClick={() => setImportOpen(true)} variant="outline" size="md" className="font-semibold">
          <UploadCloudIcon className="h-4 w-4"/>
          <span>{t('clients.importCsv')}</span>
        </Button>)}
      </div>
      {headerActionsSlot && createPortal(<>
          <button type="button" onClick={() => openClientModal(null)} className={headerIconClass} title={t('transactions.newClient') as string} aria-label={t('transactions.newClient') as string}>
            <UserPlusIcon className="h-[22px] w-[22px]"/>
          </button>
          <button type="button" onClick={exportPdf} className={headerIconClass} title={t('clients.exportPdfList') as string} aria-label={t('clients.exportPdfList') as string}>
            <DownloadCloudIcon className="h-[22px] w-[22px]"/>
          </button>
          {onImportClients && (<button type="button" onClick={() => setImportOpen(true)} className={headerIconClass} title={t('clients.importCsv') as string} aria-label={t('clients.importCsv') as string}>
              <UploadCloudIcon className="h-[22px] w-[22px]"/>
            </button>)}
        </>, headerActionsSlot)}

      <SearchField value={clientSearchQuery} onChange={setClientSearchQuery} placeholder={t('transactions.searchClient') as string} clearLabel={t('transactions.clearSearch') as string}/>

      <FilterChips chips={quickFilters} activeIds={[activeQuickFilter]} onToggle={selectQuickFilter} label={t('clients.filterAction') as string}/>

      {/* Category and group: only when the clients have them */}
      {((clientLoyaltyMap && tierCounts.size > 0) || availableGroups.length > 0) && (<div className="flex flex-wrap items-center gap-2">
          {clientLoyaltyMap && tierCounts.size > 0 && (<Dropdown align="start" trigger={(<button type="button" aria-haspopup="menu" className={`inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors ${activeTier ? 'border-primary bg-primary/10 text-neutral-900' : 'border-border bg-surface text-neutral-700 hover:border-border-strong'}`}>
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${activeTier ? activeTier.dot : 'bg-neutral-300'}`}/>
                  <span className="min-w-0 truncate">{activeTier ? t(activeTier.label) : t('clients.allCategories')}</span>
                  <span dir="ltr" className="text-xs font-bold text-neutral-500">{activeTierFilter ? (tierCounts.get(activeTierFilter) || 0) : filteredClientsDzd.length}</span>
                  <ChevronRightIcon aria-hidden="true" className="h-3.5 w-3.5 rotate-90 text-neutral-400"/>
                </button>)}>
              <DropdownItem onClick={() => setActiveTierFilter(null)} isActive={!activeTierFilter}>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-neutral-300"/>{t('clients.allWord')} <span className="ms-auto text-xs opacity-70">{filteredClientsDzd.length}</span></span>
              </DropdownItem>
              {TIER_ORDER
                .filter(tierKey => (tierCounts.get(tierKey) || 0) > 0)
                .map(tierKey => (
                  <DropdownItem key={tierKey} onClick={() => setActiveTierFilter(activeTierFilter === tierKey ? null : tierKey)} isActive={activeTierFilter === tierKey}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${LOYALTY_CONFIG[tierKey].dot}`}/>
                      {t(LOYALTY_CONFIG[tierKey].label)}
                      <span className="ms-auto text-xs font-bold opacity-70">{tierCounts.get(tierKey)}</span>
                    </span>
                  </DropdownItem>
                ))}
            </Dropdown>)}
          {availableGroups.map(g => (<button key={g} type="button" aria-pressed={activeGroupFilter === g} onClick={() => setActiveGroupFilter(activeGroupFilter === g ? null : g)} className={`relative inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] ${activeGroupFilter === g ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-neutral-600 hover:border-border-strong hover:text-neutral-900'}`}>
              {g}
            </button>))}
        </div>)}

      <SectionCard flush title={<>{t('clients.clientsList')} <span className="font-semibold text-neutral-500">· <bdi>{groupFilteredClients.length}</bdi></span></>}>
        {groupFilteredClients.length > 0 ? (<div>
            {visibleClients.map((client) => {
                const balance = clientBalances.get(client.id) || 0;
                const overdue = overdueByClientId.get(client.id);
                const fullName = getClientFullName(client);
                const tier = clientLoyaltyMap?.get(client.id) as TierKey | undefined;
                const tierCfg = tier ? LOYALTY_CONFIG[tier] : null;
                const prevVol = clientPrevMonthVolume?.get(client.id) || 0;
                const lastSell = clientLastSellDate?.get(client.id) || 0;
                const isFournisseur = tier === 'fournisseur';
                const limit = client.creditLimit;
                const overLimit = Boolean(limit && limit > 0 && -balance > limit);
                const balanceColor = balance < 0 ? 'text-financial-debt' : balance > 0 ? 'text-financial-profit' : 'text-neutral-400';

                return (<SwipeableListItem key={client.id} onEdit={() => openClientModal(client)} onDelete={() => setClientToDelete(client)}>
                    <div onTouchStart={() => handleTouchStart(client)} onTouchEnd={handleTouchEnd} onContextMenu={(e) => { e.preventDefault(); handleTouchStart(client); }} onClick={() => setSelectedClientId(client.id)}
                    className="relative z-10 flex w-full cursor-pointer items-center gap-3 border-t border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-muted"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '72px' }}>
                      {/* The row opens the client; this button gives it to the keyboard. */}
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-button">
                        <span aria-hidden="true" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[13px] font-bold text-neutral-600">
                          {getNameInitials(fullName)}
                          {tierCfg && <span className={`absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-surface ${tierCfg.dot}`}/>}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[15px] font-semibold leading-snug text-neutral-900">{fullName}</span>
                            {overdue && (<span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-financial-loss-bg px-1.5 text-xs font-bold text-financial-loss">
                                <AlertTriangleIcon aria-hidden="true" className="h-3 w-3"/>
                                {overdue.daysOverdue}{t('common.dayShort')}
                              </span>)}
                            {overLimit && <AlertTriangleIcon aria-label={t('clients.creditLimitExceeded') as string} className="h-3.5 w-3.5 shrink-0 text-warning"/>}
                          </span>
                          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                            {tierCfg && <span className="font-semibold text-neutral-600">{t(tierCfg.label)}</span>}
                            {!isFournisseur && prevVol > 0 && (<span dir="ltr" className="font-medium">
                                {prevVol >= 1000 ? `${(prevVol/1000).toFixed(1)}k` : Math.round(prevVol)} {t('clients.perMonthUnit')}
                              </span>)}
                            {!isFournisseur && lastSell > 0 && <span>{fmtRelDate(lastSell)}</span>}
                            {client.group && <span className="rounded-md bg-surface-muted px-1.5 font-medium text-neutral-600">{client.group}</span>}
                          </span>
                        </span>
                      </button>

                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        {balance !== 0 && (<CurrencyAmount value={Math.abs(balance)} currency="DZD" size="md" className={`font-semibold ${balanceColor}`}/>)}
                        {balance !== 0 && (<span className={`text-xs font-semibold ${balanceColor}`}>
                            {balance < 0 ? t('finance.debt') : t('finance.advance')}
                          </span>)}
                        {handleZeroOutBalance && balance !== 0 && (<button type="button" onClick={e => {
                                e.stopPropagation();
                                setSolderTarget({ clientId: client.id, name: fullName, balance });
                            }} className="relative mt-1 min-h-8 rounded-button border border-border-strong bg-surface px-3 text-[13px] font-semibold text-neutral-700 transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            {t('clients.solder')}
                          </button>)}
                      </div>
                    </div>
                  </SwipeableListItem>);
            })}
          </div>) : (<EmptyState icon={<UsersIcon className="h-5 w-5"/>} title={t('emptyStates.clients.title')} subtitle={t('emptyStates.clients.subtitle')} action={!clientSearchQuery.trim() ? (<Button onClick={() => openClientModal(null)} variant="primary" size="md" className="font-bold">
                <UserPlusIcon className="h-4 w-4"/>
                <span>{t('transactions.newClient')}</span>
              </Button>) : undefined}/>)}
        {hiddenClientCount > 0 && (<div className="border-t border-border px-4 py-3">
            <Button onClick={() => setVisibleClientCount((prev) => prev + LOAD_MORE_CLIENTS)} variant="outline" className="w-full font-semibold">
              {t('transactions.showMore')} ({Math.min(hiddenClientCount, LOAD_MORE_CLIENTS)})
            </Button>
            <p className="mt-2 text-center text-xs text-neutral-500" dir="ltr">
              {visibleClients.length} / {groupFilteredClients.length}
            </p>
          </div>)}
      </SectionCard>

      {onImportClients && (<CsvImportSheet isOpen={importOpen} onClose={() => setImportOpen(false)} title={t('clients.importClients')} fields={importFields} onConfirm={onImportClients}/>)}

      {listReport && (<Suspense fallback={null}>
          <ClientListDialog onClose={() => setListReport(null)} rows={listReport}/>
        </Suspense>)}

      <OverdueDebtsModal isOpen={isOverdueModalOpen} onClose={() => setIsOverdueModalOpen(false)} overdueDebtors={overdueDebtClients} onOpenClient={setSelectedClientId}/>

      {/* Solder confirmation */}
      <ConfirmDialog isOpen={solderTarget !== null} onClose={() => setSolderTarget(null)} onConfirm={() => {
            if (solderTarget && handleZeroOutBalance)
                handleZeroOutBalance(solderTarget.clientId, solderTarget.balance);
            setSolderTarget(null);
        }} variant="primary" title={t('clients.clearResidualTitle')} description={solderTarget ? (<>
            <span className="block text-neutral-500">{solderTarget.name}</span>
            <span dir="ltr" className={`my-1 block text-2xl font-extrabold tabular-nums ${solderTarget.balance < 0 ? 'text-financial-loss' : 'text-financial-profit'}`}>
              {Math.abs(solderTarget.balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
            </span>
            <span className="block text-xs text-neutral-500">{t('clients.clearResidualBody')}</span>
          </>) : null} note={solderTarget && solderTarget.balance < 0 ? t('clients.clearDebtLossBody') : undefined} confirmLabel={t('common.confirm')} cancelLabel={t('common.cancel')}/>
    </div>);
}
