import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { UserIcon } from '../icons/UserIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { ManualAssetClient } from '../../types';
import { describeServiceBalance, getServiceBalanceLabel } from '../../utils/serviceBalances';
type ManualAssetClientsPanelProps = {
    subtleText: string;
    fieldBase: string;
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    onOpenCreateModal: () => void;
    filteredClients: ManualAssetClient[];
    assetId: string;
    clientBalances: Map<string, number>;
    onSelectClient: (client: ManualAssetClient) => void;
    onOpenEditModal: (client: ManualAssetClient) => void;
    onDeleteClient: (clientId: string) => void;
};
export function ManualAssetClientsPanel({ subtleText, fieldBase, searchQuery, setSearchQuery, onOpenCreateModal, filteredClients, assetId, clientBalances, onSelectClient, onOpenEditModal, onDeleteClient }: ManualAssetClientsPanelProps) {
    return (<div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col items-center justify-between gap-3 border-b border-border p-3 sm:flex-row">
        <div className="relative w-full sm:w-auto flex-1">
          <SearchIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${subtleText}`}/>
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9" placeholder="Rechercher un client..."/>
        </div>
        <Button onClick={onOpenCreateModal} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-dark sm:w-auto">
          <PlusIcon className="w-4 h-4"/> Nouveau Client
        </Button>
      </div>

      <div className="divide-y divide-neutral-100">
        {filteredClients.length > 0 ? (filteredClients.map((client) => {
            const balance = clientBalances.get(`${assetId}_${client.id}`) || 0;
            const balanceView = describeServiceBalance(balance);
            const balanceSemantic = balanceView.kind === 'to_receive'
                ? 'profit'
                : balanceView.kind === 'client_advance'
                    ? 'loss'
                    : 'plain';
            const initial = (client.fullName || '?').charAt(0).toUpperCase();
            return (<div key={client.id}>
                <SwipeableListItem onEdit={() => onOpenEditModal(client)} onDelete={() => onDeleteClient(client.id)}>
                  <div className="flex min-h-touch cursor-pointer items-center justify-between gap-3 bg-surface p-4 transition-colors hover:bg-neutral-50" onClick={() => onSelectClient(client)}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-base font-bold text-secondary">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{client.fullName}</div>
                        <div dir={client.phone ? 'ltr' : undefined} className={`text-xs ${subtleText}`}>{client.phone || 'Pas de telephone'}</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <CurrencyAmount value={balanceView.amount} currency="DZD" semantic={balanceSemantic} size="lg" decimals={0}/>
                      <div className={`text-xs ${subtleText}`}>
                        {getServiceBalanceLabel(balanceView.kind)}
                      </div>
                    </div>
                  </div>
                </SwipeableListItem>
              </div>);
        })) : (<EmptyState icon={<UserIcon className="w-6 h-6"/>} title="Aucun client trouve." subtitle="Ajoutez un client pour commencer le suivi."/>)}
      </div>
    </div>);
}
