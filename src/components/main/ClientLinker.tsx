import { memo } from 'react';
import { Label } from '../ui/Label';
import { SearchableSelect } from '../ui/SearchableSelect';
import { SegmentedControl } from '../ui/SegmentedControl';
import { PlusIcon } from '../icons/PlusIcon';
import type { ClientDzd } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { selectableClients } from '../../utils/clientRegistry';
type PaymentStatus = 'credit' | 'baridi' | 'cash';
type ClientLinkerProps = {
    linkedClientId: string;
    setLinkedClientId: (clientId: string) => void;
    linkedClientDzdId: string;
    setLinkedClientDzdId: (clientId: string) => void;
    openClientModal: (client: ClientDzd | null) => void;
    clientsDzd: ClientDzd[];
    fieldBase: string;
    clientPaymentStatus: PaymentStatus;
    setClientPaymentStatus: (status: PaymentStatus) => void;
    errorMessage?: string;
    hasError?: boolean;
    errorMessageDzd?: string;
    hasErrorDzd?: boolean;
    allowBaridiDzdLink?: boolean;
    hidePaymentStatus?: boolean;
    hideLinkedDzdClient?: boolean;
};
const getClientName = (client: ClientDzd) => {
    if (client.fullName && client.fullName.trim())
        return client.fullName;
    return client.nom || '';
};
function ClientLinkerComponent({ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus, errorMessage, hasError, errorMessageDzd, hasErrorDzd, allowBaridiDzdLink = false, hidePaymentStatus = false, hideLinkedDzdClient = false }: ClientLinkerProps) {
    const { t } = useLanguage();
    const hasPrimaryClient = Boolean(linkedClientId && linkedClientId !== 'none');
    const showLinkedDzdClient = !hideLinkedDzdClient && hasPrimaryClient && (clientPaymentStatus === 'cash' || (allowBaridiDzdLink && clientPaymentStatus === 'baridi'));
    const settlementTargetLabel = clientPaymentStatus === 'baridi' ? t('transactions.baridiSettlementTarget') as string : t('transactions.cashSettlementTarget') as string;
    const settlementWalletLabel = clientPaymentStatus === 'baridi' ? t('transactions.baridi') as string : t('transactions.cash') as string;
    const clientOptions = selectableClients(clientsDzd, [linkedClientId, linkedClientDzdId]).map((client) => ({
        value: client.id,
        label: getClientName(client)
    }));
    return (<div className="space-y-3">
            <div>
                <Label htmlFor="primary_client_buy">{t('transactions.primaryClient')}</Label>
                <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-grow">
                        <SearchableSelect id="primary_client_buy" value={linkedClientId} onChange={setLinkedClientId} options={clientOptions} fieldClassName={`${fieldBase} focus:ring-primary rounded-xl ${hasError ? 'border-danger ring-1 ring-danger' : ''}`} searchPlaceholder={t('transactions.searchClient') as string} emptyOptionLabel={t('transactions.noClient') as string} emptyValue="none" noResultsLabel={t('transactions.noClientFound') as string} clearable clearLabel={t('transactions.clearClient') as string}/>
                    </div>
                    <button type="button" onClick={() => openClientModal(null)} aria-label={t('common.newClient') as string} title={t('common.newClient') as string} className="inline-flex h-touch w-touch shrink-0 items-center justify-center rounded-button border border-border-strong bg-surface text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-light">
                        <PlusIcon aria-hidden="true" className="h-5 w-5"/>
                    </button>
                </div>
                {errorMessage && <p className="mt-1 text-xs font-medium text-danger">{errorMessage}</p>}
            </div>

            {hasPrimaryClient && !hidePaymentStatus && (<div>
                    <Label>{t('transactions.paymentStatus')}</Label>
                    <SegmentedControl size="md" ariaLabel={t('transactions.paymentStatus') as string} value={clientPaymentStatus} onChange={(status) => setClientPaymentStatus(status)} options={[
                        { id: 'credit', label: t('transactions.credit'), tone: 'debt' },
                        { id: 'baridi', label: t('transactions.settledBaridi'), tone: 'primary' },
                        { id: 'cash', label: t('transactions.settledCash'), tone: 'profit' },
                    ]}/>
                </div>)}

            {showLinkedDzdClient && (<div>
                    <Label htmlFor="link_client_dzd_cash">{t('transactions.linkDzdClient')}</Label>
                    <SearchableSelect id="link_client_dzd_cash" value={linkedClientDzdId} onChange={setLinkedClientDzdId} options={clientOptions} fieldClassName={`${fieldBase} focus:ring-primary rounded-xl ${hasErrorDzd ? 'border-danger ring-1 ring-danger' : ''}`} searchPlaceholder={t('transactions.searchClient') as string} emptyOptionLabel={settlementTargetLabel} emptyValue="none" noResultsLabel={t('transactions.noClientFound') as string} clearable clearLabel={t('transactions.clearClient') as string}/>
                    {errorMessageDzd && <p className="mt-1 text-xs font-medium text-danger">{errorMessageDzd}</p>}
                    {!errorMessageDzd && (<p className="mt-1 text-xs text-neutral-500">
                            {(t('transactions.walletFallback') as string).replace('{wallet}', settlementWalletLabel)}
                        </p>)}
                </div>)}
        </div>);
}
const areClientLinkerPropsEqual = (prev: ClientLinkerProps, next: ClientLinkerProps) => (prev.linkedClientId === next.linkedClientId
    && prev.linkedClientDzdId === next.linkedClientDzdId
    && prev.clientsDzd === next.clientsDzd
    && prev.fieldBase === next.fieldBase
    && true
    && prev.clientPaymentStatus === next.clientPaymentStatus
    && prev.errorMessage === next.errorMessage
    && prev.hasError === next.hasError
    && prev.errorMessageDzd === next.errorMessageDzd
    && prev.hasErrorDzd === next.hasErrorDzd
    && prev.allowBaridiDzdLink === next.allowBaridiDzdLink
    && prev.hidePaymentStatus === next.hidePaymentStatus
    && prev.hideLinkedDzdClient === next.hideLinkedDzdClient);
export const ClientLinker = memo(ClientLinkerComponent, areClientLinkerPropsEqual);
