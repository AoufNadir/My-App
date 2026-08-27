import { memo } from 'react';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { SearchableSelect } from '../ui/SearchableSelect';
import { PlusIcon } from '../icons/PlusIcon';
import type { ClientDzd } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
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
    const settlementWalletLabel = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
    const clientOptions = clientsDzd.map((client) => ({
        value: client.id,
        label: getClientName(client)
    }));
    return (<div className="pb-2 space-y-2">
            <div>
                <Label htmlFor="primary_client_buy">{t('transactions.primaryClient')}</Label>
                <div className="flex items-center gap-2">
                    <div className="flex-grow">
                        <SearchableSelect id="primary_client_buy" value={linkedClientId} onChange={setLinkedClientId} options={clientOptions} fieldClassName={`${fieldBase} focus:ring-primary rounded-xl ${hasError ? 'border-danger ring-1 ring-danger' : ''}`} searchPlaceholder={t('transactions.searchClient') as string} emptyOptionLabel={t('transactions.noClient') as string} emptyValue="none" noResultsLabel={t('transactions.noClientFound') as string} clearable clearLabel={t('transactions.clearClient') as string}/>
                    </div>
                    <Button type="button" onClick={() => openClientModal(null)} className="p-2.5 h-touch w-touch rounded-xl shrink-0 transition-colors bg-warning-bg text-warning hover:bg-warning/10">
                        <PlusIcon className="w-5 h-5"/>
                    </Button>
                </div>
                {errorMessage && <p className="text-danger text-xs mt-1">{errorMessage}</p>}
            </div>

            {hasPrimaryClient && !hidePaymentStatus && (<div>
                    <Label>{t('transactions.paymentStatus')}</Label>
                    <div className="grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => setClientPaymentStatus('credit')} className={`min-h-touch py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'credit' ? ('bg-warning-bg border-warning text-warning') : ('border-border text-neutral-500 hover:bg-neutral-50')}`}>
                            {t('transactions.credit')}
                        </button>
                        <button type="button" onClick={() => setClientPaymentStatus('baridi')} className={`min-h-touch py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'baridi' ? ('bg-info-bg border-info text-info') : ('border-border text-neutral-500 hover:bg-neutral-50')}`}>
                            {t('transactions.settledBaridi')}
                        </button>
                        <button type="button" onClick={() => setClientPaymentStatus('cash')} className={`min-h-touch py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'cash' ? ('bg-success-bg border-success text-success') : ('border-border text-neutral-500 hover:bg-neutral-50')}`}>
                            {t('transactions.settledCash')}
                        </button>
                    </div>
                </div>)}

            {showLinkedDzdClient && (<div>
                    <Label htmlFor="link_client_dzd_cash">{t('transactions.linkDzdClient')}</Label>
                    <SearchableSelect id="link_client_dzd_cash" value={linkedClientDzdId} onChange={setLinkedClientDzdId} options={clientOptions} fieldClassName={`${fieldBase} focus:ring-primary rounded-xl ${hasErrorDzd ? 'border-danger ring-1 ring-danger' : ''}`} searchPlaceholder={t('transactions.searchClient') as string} emptyOptionLabel={settlementTargetLabel} emptyValue="none" noResultsLabel={t('transactions.noClientFound') as string} clearable clearLabel={t('transactions.clearClient') as string}/>
                    {errorMessageDzd && <p className="text-danger text-xs mt-1">{errorMessageDzd}</p>}
                    {!errorMessageDzd && (<p className="text-xs mt-1 text-neutral-500">
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
