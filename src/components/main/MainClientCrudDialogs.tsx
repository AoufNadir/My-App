import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';

type MainClientCrudDialogsProps = Record<string, any>;

export function MainClientCrudDialogs({
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
    setClientToDelete,
    handleDeleteClient
}: MainClientCrudDialogsProps) {
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
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('transactions.confirmDeleteClient')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setClientToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteClient} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">{t('transactions.confirmDelete')}</Button>
                </DialogFooter>
            </Dialog>
        </>
    );
}
