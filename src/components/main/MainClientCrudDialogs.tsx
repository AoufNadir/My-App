import { memo } from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../ui/Modal';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NumberInput } from '../ui/NumberInput';
import type { ClientDuplicateField, ClientDuplicateMatch } from '../../utils/clientRegistry';
type MainClientCrudDialogsProps = Record<string, any>;
const CLIENT_GROUPS = ['Retail', 'Gros compte', 'OTC', 'Particulier', 'Entreprise', 'Autre'];
const DUPLICATE_FIELD_LABELS: Record<ClientDuplicateField, string> = {
    name: 'Même nom',
    phone: 'Même téléphone',
    redotpayId: 'Même RedotPay ID',
    binanceEmail: 'Même email Binance',
};

function MainClientCrudDialogsComponent({ txToDelete, setTxToDelete, t, handleDeleteConfirm, clientTxToDelete, setClientTxToDelete, handleDeleteClientTxConfirm, isClientModalOpen, setIsClientModalOpen, editingClient, clientFullName, setClientFullName, clientPhone, setClientPhone, clientRedotpayId, setClientRedotpayId, clientBinanceEmail, setClientBinanceEmail, clientNotes, setClientNotes, clientCreditLimit, setClientCreditLimit, clientGroup, setClientGroup, clientIsFournisseur, setClientIsFournisseur, initialBalance, setInitialBalance, handleSaveClient, clientDuplicateMatches, confirmSaveClientDespiteDuplicates, cancelClientDuplicateWarning, restoreArchivedClient, closeClientModal, clientToDelete, clientDeleteMode, setClientToDelete, handleDeleteClient, isSaving = false }: MainClientCrudDialogsProps) {
    const duplicateMatches: ClientDuplicateMatch[] = clientDuplicateMatches || [];
    const isBlockedClientDelete = clientDeleteMode === 'blocked';
    const isBalanceOnlyClientDelete = clientDeleteMode === 'balance_only';
    const isClientOnlyCleanupDelete = clientDeleteMode === 'client_only_cleanup';
    const clientDeleteTitle = isBlockedClientDelete
        ? 'Suppression impossible'
        : isBalanceOnlyClientDelete
            ? 'Supprimer ce doublon client ?'
            : isClientOnlyCleanupDelete
                ? 'Retirer de Clients seulement ?'
                : 'Attention avant suppression';
    const clientDeleteMessage = isBlockedClientDelete
        ? "Ce client a encore un solde actif (dette ou avance). Réglez d'abord sa situation avant de le supprimer."
        : isBalanceOnlyClientDelete
            ? "Ce client a seulement un solde manuel ou initial, sans opération de vente/achat liée. Vous pouvez le supprimer s'il s'agit d'un doublon d'investisseur."
            : isClientOnlyCleanupDelete
                ? "Ce nom existe aussi dans Investisseurs. La suppression retirera seulement sa fiche et son historique de Clients quotidiens."
                : "Ce client a un historique d'activité. Il disparaîtra de l'application (liste, recherche, nouvelles opérations). Ses anciennes opérations restent dans l'historique pour garder les comptes justes.";
    const clientDeleteWarning = isBlockedClientDelete
        ? "Le client ne peut pas être supprimé tant que son solde n'est pas à zéro."
        : isBalanceOnlyClientDelete
            ? "Son solde client sera retiré de la valeur nette du projet. L'investisseur reste dans Investisseurs."
            : isClientOnlyCleanupDelete
                ? "Les comptes Investisseurs ne seront pas modifiés."
                : "Le client ne pourra plus être choisi dans une nouvelle opération.";
    return (<>
            {/* Delete portfolio tx confirmation */}
            <ConfirmDialog isOpen={txToDelete !== null} onClose={() => setTxToDelete(null)} onConfirm={handleDeleteConfirm} title={t('transactions.deleteTransaction')} description={t('transactions.confirmDeleteTx')} note={t('transactions.irreversibleAction')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}/>

            {/* Delete client tx confirmation */}
            <ConfirmDialog isOpen={clientTxToDelete !== null} onClose={() => setClientTxToDelete(null)} onConfirm={handleDeleteClientTxConfirm} title={t('transactions.deleteTransaction')} description={t('transactions.confirmDeleteTx')} note={t('transactions.irreversibleAction')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}/>

            {/* Create/Edit Client */}
            <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} className="max-w-md bg-surface">
                <ModalHeader onClose={() => setIsClientModalOpen(false)}>
                    <ModalTitle className="text-base sm:text-lg">{editingClient ? t('transactions.editClient') : t('transactions.newClient')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
                    <div><Label>{t('transactions.fullName')}</Label><Input value={clientFullName} onChange={e => setClientFullName(e.target.value)} className="mt-1"/></div>
                    <div><Label>{t('transactions.phone')}</Label><Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="mt-1"/></div>
                    <div><Label>RedotPay ID</Label><Input value={clientRedotpayId} onChange={e => setClientRedotpayId(e.target.value)} className="mt-1"/></div>
                    <div><Label>Binance Email</Label><Input value={clientBinanceEmail} onChange={e => setClientBinanceEmail(e.target.value)} className="mt-1"/></div>
                    <div>
                        <Label>Groupe / Catégorie</Label>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {CLIENT_GROUPS.map(g => (
                                <button key={g} type="button"
                                    onClick={() => setClientGroup(clientGroup === g ? '' : g)}
                                    className={`rounded-full px-3 py-1 text-xs font-bold border transition-colors ${clientGroup === g ? 'bg-primary text-white border-primary' : 'border-border text-neutral-600 hover:border-primary/50 hover:text-primary'}`}>
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Fournisseur toggle */}
                    <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-neutral-700">Ce contact est un fournisseur</p>
                            <p className="text-xs text-neutral-400 mt-0.5">Aucune fiche de dette — exclu du classement client</p>
                        </div>
                        <button type="button"
                            onClick={() => setClientIsFournisseur(!clientIsFournisseur)}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${clientIsFournisseur ? 'bg-secondary' : 'bg-neutral-300'}`}
                            aria-pressed={clientIsFournisseur}>
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${clientIsFournisseur ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}/>
                        </button>
                    </div>
                    <div>
                        <Label>Notes privées</Label>
                        <Textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} className="mt-1 resize-none text-sm" rows={3} placeholder="Préférences, disponibilités, remarques importantes…"/>
                    </div>
                    <div>
                        <Label>{t('clients.creditLimit')} (DZD)</Label>
                        <NumberInput value={clientCreditLimit} onChange={e => setClientCreditLimit(e.target.value)} className="mt-1" placeholder="Ex: 50 000 (0 = illimité)"/>
                        <p className="mt-1 text-xs text-neutral-400">{t('clients.creditLimitHint')}</p>
                    </div>
                    {!editingClient && (<div>
                            <Label>{t('transactions.initialBalance')} ({t('common.dinar')})</Label>
                            <NumberInput value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className="mt-1" placeholder="0.00"/>
                        </div>)}
                </ModalContent>
                <ModalFooter>
                    <Button onClick={() => setIsClientModalOpen(false)} variant="outline">{t('common.cancel')}</Button>
                    <Button onClick={handleSaveClient} disabled={isSaving}>{t('common.save')}</Button>
                </ModalFooter>
            </Modal>

            {/* Duplicate client warning */}
            <Modal isOpen={isClientModalOpen && duplicateMatches.length > 0} onClose={cancelClientDuplicateWarning} className="max-w-sm bg-surface">
                <ModalHeader onClose={cancelClientDuplicateWarning}>
                    <ModalTitle className="text-base sm:text-lg">Ce client existe peut-être déjà</ModalTitle>
                </ModalHeader>
                <ModalContent className="px-4 py-4 sm:px-5 space-y-2">
                    {duplicateMatches.map(({ client, fields, archived }) => (<div key={client.id} className="rounded-xl border border-border bg-surface-muted px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-neutral-800">{client.fullName || client.nom}</p>
                                {archived && (<span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-bold text-neutral-600">Supprimé</span>)}
                            </div>
                            <p className="text-xs text-neutral-500">{[client.phone, client.redotpayId, client.binanceEmail].filter(Boolean).join(' · ')}</p>
                            <p className="mt-1 text-xs font-semibold text-warning">{fields.map((field) => DUPLICATE_FIELD_LABELS[field]).join(' · ')}</p>
                            {archived && (<Button onClick={() => restoreArchivedClient(client.id)} disabled={isSaving} className="mt-2 w-full rounded-lg bg-primary/10 py-2 text-xs font-bold text-primary hover:bg-primary/20">Restaurer ce client</Button>)}
                        </div>))}
                </ModalContent>
                <ModalFooter>
                    <Button onClick={closeClientModal} variant="outline">Utiliser l'existant</Button>
                    <Button onClick={confirmSaveClientDespiteDuplicates} disabled={isSaving}>Enregistrer quand même</Button>
                </ModalFooter>
            </Modal>

            {/* Delete client confirmation */}
            <ConfirmDialog isOpen={clientToDelete !== null} onClose={() => setClientToDelete(null)} onConfirm={handleDeleteClient} title={clientDeleteTitle} description={clientDeleteMessage} note={clientDeleteWarning} confirmLabel={t('transactions.confirmDelete')} cancelLabel={t('common.cancel')} hideConfirm={isBlockedClientDelete}/>
        </>);
}
export const areMainClientCrudDialogsPropsEqual = (prev: MainClientCrudDialogsProps, next: MainClientCrudDialogsProps) => {
    const prevTxDeleteOpen = prev.txToDelete !== null;
    const nextTxDeleteOpen = next.txToDelete !== null;
    const prevClientTxDeleteOpen = prev.clientTxToDelete !== null;
    const nextClientTxDeleteOpen = next.clientTxToDelete !== null;
    const prevClientDeleteOpen = prev.clientToDelete !== null;
    const nextClientDeleteOpen = next.clientToDelete !== null;
    if (prevTxDeleteOpen !== nextTxDeleteOpen
        || prevClientTxDeleteOpen !== nextClientTxDeleteOpen
        || prev.isClientModalOpen !== next.isClientModalOpen
        || prevClientDeleteOpen !== nextClientDeleteOpen
        || prev.isSaving !== next.isSaving) {
        return false;
    }
    if (nextTxDeleteOpen && prev.txToDelete !== next.txToDelete)
        return false;
    if (nextClientTxDeleteOpen && prev.clientTxToDelete !== next.clientTxToDelete)
        return false;
    if (nextClientDeleteOpen && prev.clientToDelete !== next.clientToDelete)
        return false;
    if (prev.clientDeleteMode !== next.clientDeleteMode)
        return false;
    if (next.isClientModalOpen) {
        return (prev.editingClient === next.editingClient
            && prev.clientFullName === next.clientFullName
            && prev.clientPhone === next.clientPhone
            && prev.clientRedotpayId === next.clientRedotpayId
            && prev.clientBinanceEmail === next.clientBinanceEmail
            && prev.clientNotes === next.clientNotes
            && prev.clientCreditLimit === next.clientCreditLimit
            && prev.clientGroup === next.clientGroup
            && prev.clientIsFournisseur === next.clientIsFournisseur
            && prev.initialBalance === next.initialBalance
            && prev.clientDuplicateMatches === next.clientDuplicateMatches);
    }
    return true;
};
export const MainClientCrudDialogs = memo(MainClientCrudDialogsComponent, areMainClientCrudDialogsPropsEqual);
