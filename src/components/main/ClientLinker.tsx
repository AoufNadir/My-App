import { memo } from 'react';
import { Label } from '../ui/Label';
import { SearchableSelect } from '../ui/SearchableSelect';
import { CheckIcon } from '../icons/CheckIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { UserIcon } from '../icons/UserIcon';
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
    /** null: nothing chosen yet (V13-1, never chosen for the user) */
    clientPaymentStatus: PaymentStatus | null;
    /** The way this client usually pays, shown as a hint only */
    usualChannel?: 'cash' | 'baridi' | null;
    setClientPaymentStatus: (status: PaymentStatus) => void;
    errorMessage?: string;
    hasError?: boolean;
    errorMessageDzd?: string;
    hasErrorDzd?: boolean;
    allowBaridiDzdLink?: boolean;
    hidePaymentStatus?: boolean;
    hideLinkedDzdClient?: boolean;
};
// V13-1: three cards, the colours of the « where does the money go » strip. None is chosen for the user.
const PAYMENT_CARDS = [
    { id: 'credit' as const, label: 'transactions.credit', hint: 'transactions.paymentCreditHint', icon: UserIcon, on: 'border-financial-debt bg-financial-debt-bg', iconOn: 'bg-surface text-financial-debt', text: 'text-financial-debt', dot: 'border-financial-debt bg-financial-debt' },
    { id: 'baridi' as const, label: 'transactions.settledBaridi', hint: 'transactions.paymentBaridiHint', icon: CreditCardIcon, on: 'border-primary bg-primary/5', iconOn: 'bg-surface text-primary', text: 'text-primary', dot: 'border-primary bg-primary' },
    { id: 'cash' as const, label: 'transactions.settledCash', hint: 'transactions.paymentCashHint', icon: BanknotesIcon, on: 'border-financial-profit bg-financial-profit-bg', iconOn: 'bg-surface text-financial-profit', text: 'text-financial-profit', dot: 'border-financial-profit bg-financial-profit' },
];
const getClientName = (client: ClientDzd) => {
    if (client.fullName && client.fullName.trim())
        return client.fullName;
    return client.nom || '';
};
function ClientLinkerComponent({ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus, errorMessage, hasError, errorMessageDzd, hasErrorDzd, allowBaridiDzdLink = false, hidePaymentStatus = false, hideLinkedDzdClient = false, usualChannel = null }: ClientLinkerProps) {
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
                    <div role="radiogroup" aria-label={t('transactions.paymentStatus') as string} className="grid gap-2">
                        {PAYMENT_CARDS.map((card) => {
                            const on = clientPaymentStatus === card.id;
                            const Icon = card.icon;
                            return (<button key={card.id} type="button" role="radio" aria-checked={on} onClick={() => setClientPaymentStatus(card.id)} className={`flex w-full items-center gap-3 rounded-card border-2 px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${on ? card.on : 'border-border bg-surface hover:bg-surface-muted'}`}>
                                <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? card.iconOn : 'bg-surface-muted text-neutral-500'}`}><Icon className="h-5 w-5"/></span>
                                <span className="min-w-0 flex-1">
                                    <span className={`block text-sm font-bold ${on ? card.text : 'text-neutral-900'}`}>{t(card.label)}</span>
                                    <span className="block text-xs text-neutral-600">{t(card.hint)}</span>
                                </span>
                                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? `${card.dot} text-white` : 'border-border-strong'}`}>{on && <CheckIcon className="h-3 w-3"/>}</span>
                            </button>);
                        })}
                    </div>
                    {!clientPaymentStatus && <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">{t('transactions.paymentChoose')}</p>}
                    {usualChannel && <p className="mt-1 text-xs text-neutral-500">{(t('transactions.paymentUsual') as string).replace('{channel}', t(usualChannel === 'baridi' ? 'transactions.settledBaridi' : 'transactions.settledCash') as string)}</p>}
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
    && prev.hideLinkedDzdClient === next.hideLinkedDzdClient
    && prev.usualChannel === next.usualChannel);
export const ClientLinker = memo(ClientLinkerComponent, areClientLinkerPropsEqual);
