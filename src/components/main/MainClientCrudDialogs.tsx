import { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';

type MainClientCrudDialogsProps = Record<string, any>;

function MainClientCrudDialogsComponent({
    txToDelete,
    setTxToDelete,
    cardBase,
    isDark,
    t,
    handleDeleteConfirm,
    clientTxToDelete,
    setClientTxToDelete,
    handleDeleteClientTxConfirm,
    isClientModalOpen,
    setIsClientModalOpen,
    editingClient,
    clientFullName,
    setClientFullName,
    clientPhone,
    setClientPhone,
    clientRedotpayId,
    setClientRedotpayId,
    clientBinanceEmail,
    setClientBinanceEmail,
    initialBalance,
    setInitialBalance,
    fieldBase,
    handleSaveClient,
    clientToDelete,
    clientDeleteMode,
    setClientToDelete,
    handleDeleteClient
}: MainClientCrudDialogsProps) {
    const isBlockedClientDelete = clientDeleteMode === 'blocked';
    const clientDeleteTitle = isBlockedClientDelete ? 'Suppression impossible' : 'Attention avant suppression';
    const clientDeleteMessage = isBlockedClientDelete
        ? 'Ce client a encore un solde actif (dette ou avance). Reglez d abord sa situation avant de le supprimer.'
        : 'Ce client a un historique d activite. Si vous confirmez, son historique client sera supprime et il disparaitra des rapports mensuels et annuels.';
    const clientDeleteWarning = isBlockedClientDelete
        ? 'Le client ne peut pas etre supprime tant que son solde n est pas a zero.'
        : 'Cette action est irreversible et supprimera aussi les elements lies au client dans cet espace.';

    return (
        <>
            <Dialog isOpen={txToDelete !== null} onClose={() => setTxToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('transactions.deleteTransaction')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('transactions.confirmDeleteTx')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setTxToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteConfirm} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>
            <Dialog isOpen={clientTxToDelete !== null} onClose={() => setClientTxToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('transactions.deleteTransaction')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('transactions.confirmDeleteTx')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setClientTxToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteClientTxConfirm} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>
            <Dialog isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsClientModalOpen(false)} isDark={isDark}><DialogTitle>{editingClient ? t('transactions.editClient') : t('transactions.newClient')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div><Label>{t('transactions.fullName')}</Label><Input value={clientFullName} onChange={e => setClientFullName(e.target.value)} className={fieldBase} /></div>
                    <div><Label>{t('transactions.phone')}</Label><Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={fieldBase} /></div>
                    <div><Label>RedotPay ID</Label><Input value={clientRedotpayId} onChange={e => setClientRedotpayId(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Binance Email</Label><Input value={clientBinanceEmail} onChange={e => setClientBinanceEmail(e.target.value)} className={fieldBase} /></div>

                    {!editingClient && <div><Label>{t('transactions.initialBalance')} ({t('common.dinar')})</Label><NumberInput value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className={fieldBase} placeholder="0.00" /></div>}
                </DialogContent>
                <DialogFooter><Button onClick={handleSaveClient} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl">{t('common.save')}</Button></DialogFooter>
            </Dialog>

            <Dialog isOpen={clientToDelete !== null} onClose={() => setClientToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{clientDeleteTitle}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{clientDeleteMessage}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{clientDeleteWarning}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setClientToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    {!isBlockedClientDelete && (
                        <Button onClick={handleDeleteClient} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">{t('transactions.confirmDelete')}</Button>
                    )}
                </DialogFooter>
            </Dialog>
        </>
    );
}

const areMainClientCrudDialogsPropsEqual = (prev: MainClientCrudDialogsProps, next: MainClientCrudDialogsProps) => {
    const prevTxDeleteOpen = prev.txToDelete !== null;
    const nextTxDeleteOpen = next.txToDelete !== null;
    const prevClientTxDeleteOpen = prev.clientTxToDelete !== null;
    const nextClientTxDeleteOpen = next.clientTxToDelete !== null;
    const prevClientDeleteOpen = prev.clientToDelete !== null;
    const nextClientDeleteOpen = next.clientToDelete !== null;

    if (
        prevTxDeleteOpen !== nextTxDeleteOpen
        || prevClientTxDeleteOpen !== nextClientTxDeleteOpen
        || prev.isClientModalOpen !== next.isClientModalOpen
        || prevClientDeleteOpen !== nextClientDeleteOpen
    ) {
        return false;
    }

    if (nextTxDeleteOpen && prev.txToDelete !== next.txToDelete) return false;
    if (nextClientTxDeleteOpen && prev.clientTxToDelete !== next.clientTxToDelete) return false;
    if (nextClientDeleteOpen && prev.clientToDelete !== next.clientToDelete) return false;
    if (prev.clientDeleteMode !== next.clientDeleteMode) return false;

    if (next.isClientModalOpen) {
        return (
            prev.editingClient === next.editingClient
            && prev.clientFullName === next.clientFullName
            && prev.clientPhone === next.clientPhone
            && prev.clientRedotpayId === next.clientRedotpayId
            && prev.clientBinanceEmail === next.clientBinanceEmail
            && prev.initialBalance === next.initialBalance
            && prev.fieldBase === next.fieldBase
            && prev.isDark === next.isDark
            && prev.cardBase === next.cardBase
        );
    }

    return true;
};

export const MainClientCrudDialogs = memo(MainClientCrudDialogsComponent, areMainClientCrudDialogsPropsEqual);
