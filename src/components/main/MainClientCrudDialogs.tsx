import { memo } from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../ui/Modal';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
type MainClientCrudDialogsProps = Record<string, any>;
const CLIENT_GROUPS = ['Retail', 'Gros compte', 'OTC', 'Particulier', 'Entreprise', 'Autre'];

function MainClientCrudDialogsComponent({ txToDelete, setTxToDelete, t, handleDeleteConfirm, clientTxToDelete, setClientTxToDelete, handleDeleteClientTxConfirm, isClientModalOpen, setIsClientModalOpen, editingClient, clientFullName, setClientFullName, clientPhone, setClientPhone, clientRedotpayId, setClientRedotpayId, clientBinanceEmail, setClientBinanceEmail, clientNotes, setClientNotes, clientCreditLimit, setClientCreditLimit, clientGroup, setClientGroup, clientIsFournisseur, setClientIsFournisseur, initialBalance, setInitialBalance, handleSaveClient, clientToDelete, clientDeleteMode, setClientToDelete, handleDeleteClient }: MainClientCrudDialogsProps) {
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
                : "Ce client a un historique d'activité. Si vous confirmez, son historique sera supprimé et il disparaîtra des rapports.";
    const clientDeleteWarning = isBlockedClientDelete
        ? "Le client ne peut pas être supprimé tant que son solde n'est pas à zéro."
        : isBalanceOnlyClientDelete
            ? "Son solde client sera retiré de la valeur nette du projet. L'investisseur reste dans Investisseurs."
            : isClientOnlyCleanupDelete
                ? "Les comptes Investisseurs ne seront pas modifiés."
                : "Cette action est irréversible et supprimera aussi les éléments liés au client.";
    const headerClass = 'sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5';
    const footerClass = 'sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5';
    const cancelBtn = 'flex-1 py-3 rounded-xl font-bold transition-colors bg-neutral-100 text-neutral-700 hover:bg-neutral-200';
    const dangerBtn = 'flex-1 bg-danger hover:opacity-95 text-white font-bold py-3 rounded-xl shadow-sm transition-colors';
    const primaryBtn = 'flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl shadow-sm transition-colors';
    return (<>
            {/* Delete portfolio tx confirmation */}
            <Modal isOpen={txToDelete !== null} onClose={() => setTxToDelete(null)} className="max-w-sm bg-surface">
                <ModalHeader onClose={() => setTxToDelete(null)} className={headerClass}>
                    <ModalTitle className="text-base sm:text-lg">{t('transactions.deleteTransaction')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="px-4 py-4 sm:px-5">
                    <p className="text-sm text-neutral-700">{t('transactions.confirmDeleteTx')}</p>
                    <p className="text-xs text-financial-loss font-medium mt-2">{t('transactions.irreversibleAction')}</p>
                </ModalContent>
                <ModalFooter className={footerClass}>
                    <div className="flex gap-2 w-full">
                        <Button onClick={() => setTxToDelete(null)} className={cancelBtn}>{t('common.cancel')}</Button>
                        <Button onClick={handleDeleteConfirm} className={dangerBtn}>{t('common.delete')}</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/* Delete client tx confirmation */}
            <Modal isOpen={clientTxToDelete !== null} onClose={() => setClientTxToDelete(null)} className="max-w-sm bg-surface">
                <ModalHeader onClose={() => setClientTxToDelete(null)} className={headerClass}>
                    <ModalTitle className="text-base sm:text-lg">{t('transactions.deleteTransaction')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="px-4 py-4 sm:px-5">
                    <p className="text-sm text-neutral-700">{t('transactions.confirmDeleteTx')}</p>
                    <p className="text-xs text-financial-loss font-medium mt-2">{t('transactions.irreversibleAction')}</p>
                </ModalContent>
                <ModalFooter className={footerClass}>
                    <div className="flex gap-2 w-full">
                        <Button onClick={() => setClientTxToDelete(null)} className={cancelBtn}>{t('common.cancel')}</Button>
                        <Button onClick={handleDeleteClientTxConfirm} className={dangerBtn}>{t('common.delete')}</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/* Create/Edit Client */}
            <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} className="max-w-md bg-surface">
                <ModalHeader onClose={() => setIsClientModalOpen(false)} className={headerClass}>
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
                            <p className="text-[11px] text-neutral-400 mt-0.5">Aucune fiche de dette — exclu du classement client</p>
                        </div>
                        <button type="button"
                            onClick={() => setClientIsFournisseur(!clientIsFournisseur)}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${clientIsFournisseur ? 'bg-secondary' : 'bg-neutral-300'}`}
                            aria-pressed={clientIsFournisseur}>
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${clientIsFournisseur ? 'translate-x-5' : 'translate-x-0'}`}/>
                        </button>
                    </div>
                    <div>
                        <Label>Notes privées</Label>
                        <Textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} className="mt-1 resize-none text-sm" rows={3} placeholder="Préférences, disponibilités, remarques importantes…"/>
                    </div>
                    <div>
                        <Label>{t('clients.creditLimit')} (DZD)</Label>
                        <NumberInput value={clientCreditLimit} onChange={e => setClientCreditLimit(e.target.value)} className="mt-1" placeholder="Ex: 50 000 (0 = illimité)"/>
                        <p className="mt-1 text-[11px] text-neutral-400">{t('clients.creditLimitHint')}</p>
                    </div>
                    {!editingClient && (<div>
                            <Label>{t('transactions.initialBalance')} ({t('common.dinar')})</Label>
                            <NumberInput value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className="mt-1" placeholder="0.00"/>
                        </div>)}
                </ModalContent>
                <ModalFooter className={footerClass}>
                    <div className="flex gap-2 w-full">
                        <Button onClick={() => setIsClientModalOpen(false)} className={cancelBtn}>{t('common.cancel')}</Button>
                        <Button onClick={handleSaveClient} className={primaryBtn}>{t('common.save')}</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/* Delete client confirmation */}
            <Modal isOpen={clientToDelete !== null} onClose={() => setClientToDelete(null)} className="max-w-sm bg-surface">
                <ModalHeader onClose={() => setClientToDelete(null)} className={headerClass}>
                    <ModalTitle className="text-base sm:text-lg">{clientDeleteTitle}</ModalTitle>
                </ModalHeader>
                <ModalContent className="px-4 py-4 sm:px-5">
                    <p className="text-sm text-neutral-700">{clientDeleteMessage}</p>
                    <p className="text-xs text-financial-loss font-medium mt-2">{clientDeleteWarning}</p>
                </ModalContent>
                <ModalFooter className={footerClass}>
                    <div className="flex gap-2 w-full">
                        <Button onClick={() => setClientToDelete(null)} className={cancelBtn}>{t('common.cancel')}</Button>
                        {!isBlockedClientDelete && (<Button onClick={handleDeleteClient} className={dangerBtn}>{t('transactions.confirmDelete')}</Button>)}
                    </div>
                </ModalFooter>
            </Modal>
        </>);
}
const areMainClientCrudDialogsPropsEqual = (prev: MainClientCrudDialogsProps, next: MainClientCrudDialogsProps) => {
    const prevTxDeleteOpen = prev.txToDelete !== null;
    const nextTxDeleteOpen = next.txToDelete !== null;
    const prevClientTxDeleteOpen = prev.clientTxToDelete !== null;
    const nextClientTxDeleteOpen = next.clientTxToDelete !== null;
    const prevClientDeleteOpen = prev.clientToDelete !== null;
    const nextClientDeleteOpen = next.clientToDelete !== null;
    if (prevTxDeleteOpen !== nextTxDeleteOpen
        || prevClientTxDeleteOpen !== nextClientTxDeleteOpen
        || prev.isClientModalOpen !== next.isClientModalOpen
        || prevClientDeleteOpen !== nextClientDeleteOpen) {
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
            && prev.initialBalance === next.initialBalance);
    }
    return true;
};
export const MainClientCrudDialogs = memo(MainClientCrudDialogsComponent, areMainClientCrudDialogsPropsEqual);
