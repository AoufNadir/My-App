import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';

type MainInvestorDialogsProps = Record<string, any>;

export function MainInvestorDialogs({
    isInvestorModalOpen,
    setIsInvestorModalOpen,
    editingInvestor,
    handleSaveInvestor,
    investorName,
    setInvestorName,
    fieldBase,
    investorInitialCapital,
    setInvestorInitialCapital,
    investorNotes,
    setInvestorNotes,
    isManager,
    setIsManager,
    derivedInvestors,
    selectedInvestorId,
    isInvestorTxModalOpen,
    setIsInvestorTxModalOpen,
    investorTxType,
    investorTxAmount,
    setInvestorTxAmount,
    subtleText,
    investorTxNotes,
    setInvestorTxNotes,
    handleInvestorTransaction,
    cardBase,
    isDark,
    t,
    investorToDelete,
    setInvestorToDelete,
    handleDeleteInvestor,
    investorTxToDelete,
    setInvestorTxToDelete,
    handleDeleteInvestorTx,
    isReinvestModalOpen,
    setIsReinvestModalOpen,
    reinvestInput,
    setReinvestInput,
    handleReinvestProfit,
    setAlert
}: MainInvestorDialogsProps) {
    return (
        <>
            {/* INVESTOR CREATION / EDIT MODAL */}
            <Dialog isOpen={isInvestorModalOpen} onClose={() => setIsInvestorModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsInvestorModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{editingInvestor ? "Modifier Investisseur" : "Nouvel Investisseur"}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveInvestor();
                    }}>
                        <div>
                            <Label>Nom Complet</Label>
                            <Input value={investorName} onChange={e => setInvestorName(e.target.value)} className={fieldBase} placeholder="Nom de l'investisseur" required />
                        </div>
                        {!editingInvestor && (
                            <div>
                                <Label>Capital Initial (DZD)</Label>
                                <NumberInput value={investorInitialCapital} onChange={e => setInvestorInitialCapital(e.target.value)} className={fieldBase} placeholder="0.00" />
                            </div>
                        )}
                        {/* Share Percentage Removed - Auto Calculated */}
                        <div>
                            <Label>Notes (Optionnel)</Label>
                            <Input value={investorNotes} onChange={e => setInvestorNotes(e.target.value)} className={fieldBase} placeholder="Notes..." />
                        </div>

                        <div className="flex items-center gap-2 mt-4 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10">
                            <input
                                type="checkbox"
                                id="isManager"
                                checked={isManager}
                                onChange={e => setIsManager(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="isManager" className="text-sm font-medium cursor-pointer select-none">
                                Cet investisseur est le Gérant
                            </label>
                        </div>

                        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl mt-4">
                            {editingInvestor ? "Mettre à jour" : "Créer Investisseur"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* INVESTOR TRANSACTION MODAL */}
            {(() => {
                const selectedInv = derivedInvestors.find(i => i.id === selectedInvestorId);
                let availableProfit = 0;
                let showAvailability = false;

                if (isInvestorTxModalOpen && selectedInv && investorTxType === 'withdraw_profit') {
                    showAvailability = true;
                    availableProfit = selectedInv.availableProfit || 0;
                }

                return (
                    <Dialog isOpen={isInvestorTxModalOpen} onClose={() => setIsInvestorTxModalOpen(false)} className={`${cardBase} max-w-md`}>
                        <DialogHeader onClose={() => setIsInvestorTxModalOpen(false)} isDark={isDark}>
                            <DialogTitle>
                                {investorTxType === 'deposit_capital' ? 'Dépôt Capital' :
                                    investorTxType === 'withdraw_capital' ? 'Retrait Capital' :
                                        investorTxType === 'profit_distribution' ? 'Distribution Profit' : 'Retrait Profit'}
                            </DialogTitle>
                        </DialogHeader>
                        <DialogContent className="px-6 pb-6 space-y-4">
                            <div>
                                <Label>Montant (DZD)</Label>
                                <NumberInput value={investorTxAmount} onChange={e => setInvestorTxAmount(e.target.value)} className={fieldBase} placeholder="0.00" />
                                {showAvailability && (
                                    <div className={`text-xs mt-1 text-right ${availableProfit > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        Disponible: {availableProfit.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD
                                    </div>
                                )}
                            </div>
                            <div>
                                <Label>Notes</Label>
                                <Input value={investorTxNotes} onChange={e => setInvestorTxNotes(e.target.value)} className={fieldBase} />
                            </div>
                        </DialogContent>
                        <DialogFooter>
                            <Button
                                onClick={handleInvestorTransaction}
                                disabled={showAvailability && availableProfit <= 0}
                                className={`w-full text-white font-bold py-3 rounded-xl ${showAvailability && availableProfit <= 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                Confirmer
                            </Button>
                        </DialogFooter>
                    </Dialog>
                );
            })()}

            {/* INVESTOR DELETE CONFIRMATION */}
            <Dialog isOpen={investorToDelete !== null} onClose={() => setInvestorToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">Êtes-vous sûr de vouloir supprimer cet investisseur ?</p>
                    <p className="text-xs text-red-500 font-bold mt-2">Cette action est irréversible.</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setInvestorToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={() => handleDeleteInvestor(investorToDelete?.id)} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>

            {/* INVESTOR TRANSACTION DELETE CONFIRMATION */}
            <Dialog isOpen={investorTxToDelete !== null} onClose={() => setInvestorTxToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">Êtes-vous sûr de vouloir supprimer cette transaction ?</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setInvestorTxToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteInvestorTx} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>

            {/* REINVEST PROFIT MODAL */}
            {isReinvestModalOpen && (
                <Dialog isOpen={isReinvestModalOpen} onClose={() => setIsReinvestModalOpen(false)} className={`${cardBase} max-w-md`}>
                    <DialogHeader onClose={() => setIsReinvestModalOpen(false)} isDark={isDark}>
                        <DialogTitle>Réinvestir les bénéfices</DialogTitle>
                    </DialogHeader>
                    <DialogContent className="px-6 pb-6 space-y-4">
                        <div>
                            <Label>Montant à réinvestir (DZD)</Label>
                            <NumberInput
                                value={reinvestInput}
                                onChange={e => setReinvestInput(e.target.value)}
                                className={`${fieldBase} text-xl font-bold text-center h-14`}
                                placeholder="0.00"
                            />
                            <div className="flex justify-between items-center mt-2 px-1">
                                <span className={`text-xs ${subtleText}`}>Disponible:</span>
                                <span className="text-xs font-bold text-indigo-500">
                                    {(derivedInvestors.find(i => i.id === selectedInvestorId)?.availableProfit || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <button
                                onClick={() => {
                                    const avail = derivedInvestors.find(i => i.id === selectedInvestorId)?.availableProfit || 0;
                                    setReinvestInput(avail.toFixed(2));
                                }}
                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}
                            >
                                Tout Réinvestir
                            </button>
                            <button
                                onClick={() => {
                                    const avail = (derivedInvestors.find(i => i.id === selectedInvestorId)?.availableProfit || 0) / 2;
                                    setReinvestInput(avail.toFixed(2));
                                }}
                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                            >
                                Moitié (50%)
                            </button>
                        </div>
                    </DialogContent>
                    <DialogFooter>
                        <div className="flex gap-3 w-full">
                            <Button onClick={() => setIsReinvestModalOpen(false)} className={`flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>Annuler</Button>
                            <Button
                                onClick={() => {
                                    const amt = parseFloat(reinvestInput);
                                    if (!isNaN(amt) && amt > 0) {
                                        handleReinvestProfit(selectedInvestorId!, amt);
                                        setIsReinvestModalOpen(false);
                                    } else {
                                        setAlert("⚠️ Montant invalide.");
                                    }
                                }}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                            >
                                Confirmer
                            </Button>
                        </div>
                    </DialogFooter>
                </Dialog>
            )}
        </>
    );
}
