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
    onImportClients?: (rows: Record<string, string>[]) => Promise<void>;
};
export function ClientsListView({ openClientModal, clientSearchQuery, setClientSearchQuery, clientSortMode, setClientSortMode, filteredClientsDzd, clientBalances, getClientFullName, handleTouchStart, handleTouchEnd, setClientToDelete, setSelectedClientId, overdueDebtClients, onImportClients }: ClientsListViewProps) {
    const INITIAL_VISIBLE_CLIENTS = 80;
    const LOAD_MORE_CLIENTS = 80;
    const [visibleClientCount, setVisibleClientCount] = useState(INITIAL_VISIBLE_CLIENTS);
    const [importOpen, setImportOpen] = useState(false);
    const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
    useEffect(() => {
        setVisibleClientCount(INITIAL_VISIBLE_CLIENTS);
    }, [filteredClientsDzd]);
    const visibleClients = useMemo(() => filteredClientsDzd.slice(0, visibleClientCount), [filteredClientsDzd, visibleClientCount]);
    const hiddenClientCount = Math.max(0, filteredClientsDzd.length - visibleClientCount);
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
                return (<SwipeableListItem key={client.id} onEdit={() => openClientModal(client)} onDelete={() => setClientToDelete(client)}>
                    <div onTouchStart={() => handleTouchStart(client)} onTouchEnd={handleTouchEnd} onContextMenu={(e) => { e.preventDefault(); handleTouchStart(client); }} className="flex items-center gap-3 p-4 cursor-pointer w-full relative z-10 bg-surface hover:bg-neutral-50 transition-colors" 
                    // Technical exception: content-visibility keeps long client lists responsive.
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '76px' }} onClick={() => setSelectedClientId(client.id)}>
                      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserIcon className="w-5 h-5"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-neutral-900">{fullName}</p>
                          {overdue && (<span className="shrink-0 inline-flex items-center gap-0.5 text-financial-loss" title={`${overdue.daysOverdue} jours de retard`}>
                              <AlertTriangleIcon className="w-3.5 h-3.5"/>
                              <span className="text-xs font-bold">{overdue.daysOverdue}j</span>
                            </span>)}
                          {(() => {
                            const limit = client.creditLimit;
                            if (!limit || limit <= 0) return null;
                            const debt = -(clientBalances.get(client.id) || 0);
                            if (debt <= limit) return null;
                            return (<span className="shrink-0 text-warning" title={`Seuil dépassé: ${Math.round(debt).toLocaleString('fr-FR')} / ${Math.round(limit).toLocaleString('fr-FR')} DZD`}>
                                <AlertTriangleIcon className="w-3.5 h-3.5"/>
                              </span>);
                          })()}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        {balance !== 0 && (<CurrencyAmount value={Math.abs(balance)} currency="DZD" size="md" className={balance < 0 ? 'text-financial-debt' : 'text-financial-profit'}/>)}
                        <span className={`text-[10px] font-medium ${balance < 0 ? 'text-financial-debt' : balance > 0 ? 'text-financial-profit' : 'text-neutral-400'}`}>
                          {balance < 0 ? 'دين' : balance > 0 ? 'رصيد' : 'متعادل'}
                        </span>
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
    </div>);
}
