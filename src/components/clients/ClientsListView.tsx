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
const CLIENT_SORT_LABELS: Record<ClientSortMode, string> = {
    all: 'Tous',
    advances: 'Avances',
    debts: 'Dettes',
    debts_oldest_highest: 'Dettes anciennes',
    zero_balance: 'Solde Nul'
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
    vip:        { label: 'VIP',        dot: 'bg-amber-400',   chipCls: 'border-amber-200 text-amber-700 bg-amber-50',     badgeCls: 'bg-amber-50 text-amber-700 border-amber-200' },
    regular:    { label: 'Régulier',   dot: 'bg-primary',     chipCls: 'border-primary/25 text-primary bg-primary/5',     badgeCls: 'bg-primary/8 text-primary border-primary/20' },
    petit:      { label: 'Petit',      dot: 'bg-orange-400',  chipCls: 'border-orange-200 text-orange-700 bg-orange-50',  badgeCls: 'bg-orange-50 text-orange-700 border-orange-200' },
    new:        { label: 'Nouveau',    dot: 'bg-neutral-400', chipCls: 'border-neutral-200 text-neutral-600 bg-neutral-50', badgeCls: 'bg-neutral-50 text-neutral-500 border-neutral-200' },
    inactive:   { label: 'Inactif',   dot: 'bg-neutral-300', chipCls: 'border-neutral-200 text-neutral-400 bg-white',    badgeCls: 'bg-white text-neutral-400 border-neutral-200' },
    fournisseur:{ label: 'Fournisseur',dot: 'bg-teal-400',    chipCls: 'border-teal-200 text-teal-700 bg-teal-50',       badgeCls: 'bg-teal-50 text-teal-700 border-teal-200' },
};

export function ClientsListView({ openClientModal, clientSearchQuery, setClientSearchQuery, clientSortMode, setClientSortMode, filteredClientsDzd, clientBalances, getClientFullName, handleTouchStart, handleTouchEnd, setClientToDelete, setSelectedClientId, overdueDebtClients, clientLoyaltyMap, clientPrevMonthVolume, clientLastSellDate, handleZeroOutBalance, onImportClients }: ClientsListViewProps) {
    const INITIAL_VISIBLE_CLIENTS = 80;
    const LOAD_MORE_CLIENTS = 80;
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
        if (days === 0) return 'auj.';
        if (days === 1) return 'hier';
        return `il y a ${days}j`;
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
              {overdueCount} client{overdueCount > 1 ? 's' : ''} en retard de paiement
            </p>
            <p className="mt-0.5 text-xs text-danger/70">
              Dette impayée depuis plus de 7 jours — appuyez pour voir le détail
            </p>
          </div>
        </button>)}

      <HeroKpiCard accent="sky" icon={<UsersIcon className="w-5 h-5"/>} primaryLabel="Total Clients" primaryValue={filteredClientsDzd.length} primaryCurrency={null} primarySemantic="plain" secondary={[
            { label: 'Dettes', value: clientsWithDebt, currency: null, semantic: 'plain' },
            { label: 'Avances', value: clientsWithAdvance, currency: null, semantic: 'plain' },
            { label: 'En retard', value: overdueCount, display: overdueDisplay }
        ]}/>

      <Card>
        <CardHeader className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionHeading icon={<UsersIcon className="w-4 h-4"/>}>
                Liste des Clients
              </SectionHeading>
              <span className="text-sm text-neutral-500">{filteredClientsDzd.length}</span>
            </div>

            <div className="flex w-full gap-2">
              <Button onClick={() => openClientModal(null)} variant="outline" size="md" className="flex-1 font-bold">
                <UserIcon className="w-5 h-5"/>
                <span>Nouveau Client</span>
              </Button>
              <Button onClick={() => exportClientsPdf(filteredClientsDzd, clientBalances, getClientFullName)} variant="outline" size="icon" aria-label="Exporter PDF" title="Exporter la liste en PDF" className="shrink-0">
                <DownloadCloudIcon className="w-5 h-5"/>
              </Button>
              {onImportClients && (<Button onClick={() => setImportOpen(true)} variant="outline" size="icon" aria-label="Importer un CSV" className="shrink-0 font-bold">
                  <UploadCloudIcon className="w-5 h-5"/>
                </Button>)}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          <div className="flex gap-2 mb-4">
            <Input type="text" placeholder="Rechercher un client..." value={clientSearchQuery} onChange={(e) => setClientSearchQuery(e.target.value)} className="flex-grow"/>
          </div>
          {/* Tier filter — dropdown */}
          {clientLoyaltyMap && tierCounts.size > 0 && (
            <Dropdown trigger={(
              <button type="button" className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors w-full ${activeTierFilter ? LOYALTY_CONFIG[activeTierFilter as TierKey].chipCls : 'border-border bg-white text-neutral-600 hover:border-neutral-300'}`}>
                {activeTierFilter ? (
                  <>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${LOYALTY_CONFIG[activeTierFilter as TierKey].dot}`}/>
                    {LOYALTY_CONFIG[activeTierFilter as TierKey].label}
                    <span className="font-bold text-[12px]">{tierCounts.get(activeTierFilter) || 0}</span>
                    <span className="ml-auto text-xs opacity-50">×</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full shrink-0 bg-neutral-300"/>
                    Toutes les catégories
                    <span className="ml-auto text-neutral-400 text-xs">{filteredClientsDzd.length}</span>
                  </>
                )}
              </button>
            )}>
              <DropdownItem onClick={() => setActiveTierFilter(null)} isActive={!activeTierFilter}>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-neutral-300"/>Toutes <span className="ml-auto text-neutral-400 text-xs">{filteredClientsDzd.length}</span></span>
              </DropdownItem>
              {(['vip', 'regular', 'petit', 'new', 'inactive', 'fournisseur'] as TierKey[])
                .filter(t => (tierCounts.get(t) || 0) > 0)
                .map(t => (
                  <DropdownItem key={t} onClick={() => setActiveTierFilter(activeTierFilter === t ? null : t)} isActive={activeTierFilter === t}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${LOYALTY_CONFIG[t].dot}`}/>
                      {LOYALTY_CONFIG[t].label}
                      <span className="ml-auto text-neutral-400 text-xs font-bold">{tierCounts.get(t)}</span>
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

          <Dropdown trigger={(<Button variant="tab" size="md" className="w-full font-semibold">
                <FilterIcon className="w-4 h-4"/>
                <span>{CLIENT_SORT_LABELS[clientSortMode]}</span>
              </Button>)}>
            <DropdownItem onClick={() => setClientSortMode('all')} isActive={clientSortMode === 'all'}>Tous</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('advances')} isActive={clientSortMode === 'advances'}>Avances (+)</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('debts')} isActive={clientSortMode === 'debts'}>Dettes (-)</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('debts_oldest_highest')} isActive={clientSortMode === 'debts_oldest_highest'}>Dettes anciennes</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('zero_balance')} isActive={clientSortMode === 'zero_balance'}>Solde Nul</DropdownItem>
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
                              {overdue.daysOverdue}j
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
                              {tierCfg.label}
                            </span>
                          )}
                          {!isFournisseur && prevVol > 0 && (
                            <span dir="ltr" className="text-[12px] text-neutral-500 font-medium">
                              {prevVol >= 1000 ? `${(prevVol/1000).toFixed(1)}k` : Math.round(prevVol)} U/mois
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
                          {balance < 0 ? 'دين' : balance > 0 ? 'رصيد' : ''}
                        </span>
                        {handleZeroOutBalance && balance !== 0 && (
                          <button type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setSolderTarget({ clientId: client.id, name: fullName, balance });
                            }}
                            className="mt-1 text-[10px] font-semibold text-neutral-500 hover:text-primary border border-neutral-200 hover:border-primary/30 rounded-lg px-2 py-0.5 transition-colors bg-white">
                            Solder
                          </button>
                        )}
                      </div>
                    </div>
                  </SwipeableListItem>);
            })}
            </div>) : (<EmptyState icon={<UsersIcon className="w-5 h-5"/>} title="Aucun client trouvé" subtitle="Ajoutez un client ou modifiez votre recherche."/>)}
        </CardContent>
        {hiddenClientCount > 0 && (<CardContent className="px-4 pb-4 pt-3">
            <Button onClick={() => setVisibleClientCount((prev) => prev + LOAD_MORE_CLIENTS)} variant="outline" className="w-full rounded-xl px-4 py-3 font-semibold bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
              Afficher plus ({Math.min(hiddenClientCount, LOAD_MORE_CLIENTS)})
            </Button>
            <p className="mt-2 text-center text-xs text-neutral-500">
              {visibleClients.length} / {filteredClientsDzd.length}
            </p>
          </CardContent>)}
      </Card>

      {onImportClients && (<CsvImportSheet isOpen={importOpen} onClose={() => setImportOpen(false)} title="Importer des clients" fields={CLIENT_IMPORT_FIELDS} onConfirm={onImportClients}/>)}

      <OverdueDebtsModal isOpen={isOverdueModalOpen} onClose={() => setIsOverdueModalOpen(false)} overdueDebtors={overdueDebtClients} onOpenClient={setSelectedClientId}/>

      {/* Solder confirmation modal */}
      {solderTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSolderTarget(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
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
              <p className="text-base font-bold text-neutral-900">Effacer le solde résiduel</p>
              <p className="text-sm text-neutral-500">{solderTarget.name}</p>
              <p className={`text-2xl font-extrabold tabular-nums ${solderTarget.balance < 0 ? 'text-financial-loss' : 'text-financial-profit'}`}>
                {Math.abs(solderTarget.balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
              </p>
              <p className="text-[12px] text-neutral-400">
                Un enregistrement de régularisation sera créé sans affecter la trésorerie.
              </p>
            </div>
            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button type="button" onClick={() => setSolderTarget(null)}
                className="rounded-xl border border-border py-3 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors">
                Annuler
              </button>
              <button type="button"
                onClick={() => {
                  if (handleZeroOutBalance) handleZeroOutBalance(solderTarget.clientId, solderTarget.balance);
                  setSolderTarget(null);
                }}
                className="rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors shadow-sm">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>);
}
