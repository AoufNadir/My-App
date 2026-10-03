import { Fragment } from 'react';
import { SectionCard } from '../cards';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { SearchField } from '../ui/SearchField';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { UserPlusIcon } from '../icons/UserPlusIcon';
import { UserIcon } from '../icons/UserIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { ManualAssetClient } from '../../types';
import { describeServiceBalance, getServiceBalanceLabel } from '../../utils/serviceBalances';
import { getNameInitials } from '../../utils/nameUtils';
import { useLanguage } from '../../contexts/LanguageContext';
type ManualAssetClientsPanelProps = {
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
export function ManualAssetClientsPanel({ searchQuery, setSearchQuery, onOpenCreateModal, filteredClients, assetId, clientBalances, onSelectClient, onOpenEditModal, onDeleteClient }: ManualAssetClientsPanelProps) {
    const { t } = useLanguage();
    return (<>
      <SearchField value={searchQuery} onChange={setSearchQuery} placeholder={t('reports.searchClient') as string} clearLabel={t('transactions.clearSearch') as string}/>

      <SectionCard flush title={t('services.clients')} actions={(<Button onClick={onOpenCreateModal} variant="ghost" size="sm" className="gap-1 px-2 font-bold text-primary dark:text-primary-light">
          <UserPlusIcon className="h-4 w-4"/>
          <span>{t('common.newClient')}</span>
        </Button>)}>
        {filteredClients.length > 0 ? (<div>
            {filteredClients.map((client) => {
                const balance = clientBalances.get(`${assetId}_${client.id}`) || 0;
                const balanceView = describeServiceBalance(balance);
                const balanceColor = balanceView.kind === 'to_receive' ? 'text-financial-profit' : balanceView.kind === 'client_advance' ? 'text-financial-loss' : 'text-neutral-500';
                return (<Fragment key={client.id}>
                  <SwipeableListItem onEdit={() => onOpenEditModal(client)} onDelete={() => onDeleteClient(client.id)}>
                    <div onClick={() => onSelectClient(client)} className="relative z-10 flex w-full cursor-pointer items-center gap-3 border-t border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-muted">
                      {/* The row opens the client; this button gives it to the keyboard. */}
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-button text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[13px] font-bold text-neutral-600">
                          {getNameInitials(client.fullName || '?')}
                        </span>
                        <span className="min-w-0 flex-1">
                          {/* Name and balance share the first line; phone and balance label use the full width below. */}
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0 break-words pt-0.5 text-[15px] font-semibold leading-snug text-neutral-900">{client.fullName}</span>
                            <span className="shrink-0">
                              <CurrencyAmount value={balanceView.amount} currency="DZD" semantic="plain" size="md" decimals={0} className={`font-semibold ${balanceColor}`}/>
                            </span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs">
                            <span dir={client.phone ? 'ltr' : undefined} className="text-neutral-500">{client.phone || t('clients.noPhone')}</span>
                            <span className={`font-semibold ${balanceColor}`}>{getServiceBalanceLabel(balanceView.kind, t)}</span>
                          </span>
                        </span>
                      </button>
                      <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>
                    </div>
                  </SwipeableListItem>
                </Fragment>);
            })}
          </div>) : (<EmptyState icon={<UserIcon className="h-5 w-5"/>} title={t('reports.noClientFound') as string} subtitle={t('services.firstClientOperation') as string}/>)}
      </SectionCard>
    </>);
}
