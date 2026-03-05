import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { FilterIcon } from '../icons/FilterIcon';
import { UserIcon } from '../icons/UserIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { ClientDzd, OverdueDebtClient } from '../../types';
import { formatDzd } from '../../pages/shared/pageFormat';
import { OverdueDebtsPanel } from './OverdueDebtsPanel';

type ClientSortMode = 'all' | 'advances' | 'debts' | 'zero_balance';

const CLIENT_SORT_LABELS: Record<ClientSortMode, string> = {
  all: 'Tous',
  advances: 'Avances',
  debts: 'Dettes',
  zero_balance: 'Solde Nul'
};

type ClientsListViewProps = {
  cardBase: string;
  fieldBase: string;
  isDark: boolean;
  subtleText: string;
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
};

export function ClientsListView({
  cardBase,
  fieldBase,
  isDark,
  subtleText,
  openClientModal,
  clientSearchQuery,
  setClientSearchQuery,
  clientSortMode,
  setClientSortMode,
  filteredClientsDzd,
  clientBalances,
  getClientFullName,
  handleTouchStart,
  handleTouchEnd,
  setClientToDelete,
  setSelectedClientId,
  overdueDebtClients
}: ClientsListViewProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {overdueDebtClients.length > 0 && (
        <div className="mb-4">
          <OverdueDebtsPanel
            overdueDebtors={overdueDebtClients}
            cardBase={cardBase}
            subtleText={subtleText}
            isDark={isDark}
            onOpenClient={setSelectedClientId}
          />
        </div>
      )}

      <Card className={cardBase}>
        <CardHeader className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <UnifiedTitle
                as="h2"
                isDark={isDark}
                variant="section"
                icon={<UsersIcon className="w-4 h-4" />}
              >
                Liste des Clients
              </UnifiedTitle>
            </div>

            <div className={`flex items-center gap-3 p-3.5 rounded-xl border shadow-sm transition-all ${isDark ? 'bg-gradient-to-r from-slate-800/80 to-slate-800/50 border-slate-700/50' : 'bg-gradient-to-r from-indigo-50/50 to-white border-indigo-100/50'}`}>
              <div className={`p-2.5 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                <UserIcon className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              </div>
              <div className="flex-1">
                <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Nombre de Clients
                </p>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {filteredClientsDzd.length}
                </p>
              </div>
            </div>

            <div className="w-full">
              <Button onClick={() => openClientModal(null)} className={`w-full py-3 rounded-xl font-bold border transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <UserIcon className="w-5 h-5" />
                <span>Nouveau Client</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          <div className="flex gap-2 mb-4">
            <Input
              type="text"
              placeholder="Rechercher un client..."
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              className={`${fieldBase} flex-grow`}
            />
          </div>
          <Dropdown
            isDark={isDark}
            trigger={(
              <Button className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}>
                <FilterIcon className="w-4 h-4" />
                <span>{CLIENT_SORT_LABELS[clientSortMode]}</span>
              </Button>
            )}
          >
            <DropdownItem onClick={() => setClientSortMode('all')} isActive={clientSortMode === 'all'}>Tous</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('advances')} isActive={clientSortMode === 'advances'}>Avances (+)</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('debts')} isActive={clientSortMode === 'debts'}>Dettes (-)</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('zero_balance')} isActive={clientSortMode === 'zero_balance'}>Solde Nul</DropdownItem>
          </Dropdown>
        </CardContent>

        <CardContent className="p-0">
          {filteredClientsDzd.length > 0 ? (
            <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              {filteredClientsDzd.map((client) => {
                const balance = clientBalances.get(client.id) || 0;
                return (
                  <SwipeableListItem
                    key={client.id}
                    onEdit={() => openClientModal(client)}
                    onDelete={() => setClientToDelete(client)}
                  >
                    <div
                      onTouchStart={() => handleTouchStart(client)}
                      onTouchEnd={handleTouchEnd}
                      onContextMenu={(e) => { e.preventDefault(); handleTouchStart(client); }}
                      className={`flex items-center gap-3 p-4 cursor-pointer w-full relative z-10 ${isDark ? 'bg-[#111827]' : 'bg-white'}`}
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <div className={`p-2 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-bold truncate">{getClientFullName(client)}</p>
                        <p className={`text-xs ${subtleText} truncate`}>{client.phone || 'Pas de numero'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${balance > 0 ? 'text-green-400' : balance < 0 ? 'text-red-400' : ''}`}>
                          {formatDzd(balance, { min: 2, max: 2 })}
                        </p>
                      </div>
                    </div>
                  </SwipeableListItem>
                );
              })}
            </div>
          ) : (
            <p className={`text-center py-8 ${subtleText}`}>Aucun client trouve.</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
