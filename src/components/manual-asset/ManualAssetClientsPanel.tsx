import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { UserIcon } from '../icons/UserIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { ManualAssetClient } from '../../types';
import { formatDzd } from '../../pages/shared/pageFormat';

type ManualAssetClientsPanelProps = {
  isDark: boolean;
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

export function ManualAssetClientsPanel({
  isDark,
  subtleText,
  fieldBase,
  searchQuery,
  setSearchQuery,
  onOpenCreateModal,
  filteredClients,
  assetId,
  clientBalances,
  onSelectClient,
  onOpenEditModal,
  onDeleteClient
}: ManualAssetClientsPanelProps) {
  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-auto flex-1">
          <SearchIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${subtleText}`} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${fieldBase} pl-9 w-full`}
            placeholder="Rechercher un client..."
          />
        </div>
        <Button onClick={onOpenCreateModal} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2">
          <PlusIcon className="w-5 h-5" /> Nouveau Client
        </Button>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {filteredClients.length > 0 ? (
          filteredClients.map((client) => {
            const balance = clientBalances.get(`${assetId}_${client.id}`) || 0;
            return (
              <div key={client.id}>
                <SwipeableListItem
                  onEdit={() => onOpenEditModal(client)}
                  onDelete={() => onDeleteClient(client.id)}
                >
                  <div
                    className="p-4 flex items-center justify-between transition-colors cursor-pointer"
                    onClick={() => onSelectClient(client)}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold">{client.fullName}</div>
                        <div className={`text-xs ${subtleText}`}>{client.phone || 'Pas de telephone'}</div>
                      </div>
                    </div>
                    <div className={`text-right font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatDzd(balance, { min: 2, max: 2 })}
                    </div>
                  </div>
                </SwipeableListItem>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center opacity-50">Aucun client trouve.</div>
        )}
      </div>
    </div>
  );
}
