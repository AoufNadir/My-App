import { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';

type MainUtilityDialogsProps = Record<string, any>;

function MainUtilityDialogsComponent({
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    cardBase,
    isDark,
    t,
    suggestedProfitMargin,
    setSuggestedProfitMargin,
    suggestedSellingPrice,
    setSuggestedSellingPrice,
    suggestedSellingPriceEur,
    setSuggestedSellingPriceEur,
    portfolioStats,
    fieldBase,
    subtleText,
    setIsResetModalOpen,
    userDocRef,
    setAlert,
    isResetModalOpen,
    handleGlobalReset,
    isCreateAssetModalOpen,
    setIsCreateAssetModalOpen,
    newAssetName,
    setNewAssetName,
    newAssetDescription,
    setNewAssetDescription,
    handleCreateAsset,
    isTreasuryCardModalOpen,
    setIsTreasuryCardModalOpen,
    editingTreasuryCard,
    treasuryCardName,
    setTreasuryCardName,
    treasuryCardValue,
    setTreasuryCardValue,
    treasuryCardNotes,
    setTreasuryCardNotes,
    handleSaveTreasuryCard,
    isSaving,
    treasuryCardToDelete,
    setTreasuryCardToDelete,
    handleDeleteTreasuryCard,
    treasuryTxToDelete,
    setTreasuryTxToDelete,
    handleDeleteTreasuryTxConfirm
}: MainUtilityDialogsProps) {
    return (
        <>
            <Dialog isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsSettingsModalOpen(false)} isDark={isDark}><DialogTitle>Parametres de Vente</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div>
                        <Label>{t('portfolio.margin')} ({t('common.dinar')})</Label>
                        <div className="relative">
                            <NumberInput
                                value={suggestedProfitMargin}
                                onChange={e => {
                                    const newMargin = e.target.value;
                                    setSuggestedProfitMargin(newMargin);

                                    // Update selling price based on margin (with 2 decimal precision)
                                    const marginNum = parseFloat(newMargin) || 0;
                                    const avgBuyPrice = portfolioStats.usdt.avgBuy || 0;
                                    const newSellingPrice = avgBuyPrice + marginNum;
                                    // FIX: Round to 2 decimals
                                    setSuggestedSellingPrice(newSellingPrice > 0 ? parseFloat(newSellingPrice.toFixed(2)).toString() : '');
                                }}
                                className={`${fieldBase} text-center text-2xl font-bold`}
                                placeholder="2.00"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{t('common.dinar')}</span>
                        </div>
                        <p className={`text-xs mt-2 ${subtleText}`}>Cette marge est utilisée pour calculer le prix de vente suggéré.</p>
                    </div>

                    <div>
                        <Label>{t('transactions.sellPrice')} ({t('common.dinar')})</Label>
                        <div className="relative">
                            <NumberInput
                                value={suggestedSellingPrice}
                                onChange={e => {
                                    const newSellingPrice = e.target.value;
                                    setSuggestedSellingPrice(newSellingPrice);

                                    // Update margin based on selling price (with 2 decimal precision)
                                    const sellingPriceNum = parseFloat(newSellingPrice) || 0;
                                    const avgBuyPrice = portfolioStats.usdt.avgBuy || 0;
                                    const newMargin = sellingPriceNum - avgBuyPrice;
                                    // FIX: Round to 2 decimals
                                    setSuggestedProfitMargin(newMargin >= 0 ? parseFloat(newMargin.toFixed(2)).toString() : '0');
                                }}
                                className={`${fieldBase} text-center text-2xl font-bold`}
                                placeholder="0.00"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{t('common.dinar')}</span>
                        </div>
                        <p className={`text-xs mt-2 ${subtleText}`}>
                            {t('portfolio.avgBuyPriceUsdt')}: {(portfolioStats.usdt.avgBuy || 0).toFixed(2)} {t('common.dinar')}
                        </p>
                    </div>

                    <div>
                        <Label>Prix de vente EUR ({t('common.dinar')})</Label>
                        <div className="relative">
                            <NumberInput
                                value={suggestedSellingPriceEur}
                                onChange={e => {
                                    setSuggestedSellingPriceEur(e.target.value);
                                }}
                                className={`${fieldBase} text-center text-2xl font-bold`}
                                placeholder="0.00"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{t('common.dinar')}</span>
                        </div>
                        <p className={`text-xs mt-2 ${subtleText}`}>
                            {t('portfolio.avgBuyPriceEur')}: {(portfolioStats.eur.avgBuy || 0).toFixed(2)} {t('common.dinar')}
                        </p>
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button
                        onClick={async () => {
                            // Save to Firestore with 2 decimal precision
                            try {
                                const marginToSave = parseFloat(parseFloat(suggestedProfitMargin).toFixed(2)) || 2;
                                const sellPriceToSave = parseFloat(parseFloat(suggestedSellingPrice).toFixed(2)) || 0;
                                const sellPriceEurToSave = parseFloat(parseFloat(suggestedSellingPriceEur).toFixed(2)) || 0;

                                console.log('Saving settings:', { marginToSave, sellPriceToSave, sellPriceEurToSave });

                                // Use set with merge=true to create document if it doesn't exist
                                await userDocRef.set({
                                    suggestedProfitMargin: marginToSave,
                                    suggestedSellingPrice: sellPriceToSave,
                                    suggestedSellingPriceEur: sellPriceEurToSave,
                                    settingsUpdatedAt: Date.now()
                                }, { merge: true });

                                console.log('Settings saved successfully');
                                setAlert('✅ ' + t('common.settingsSaved'));
                                setIsSettingsModalOpen(false);
                            } catch (e: any) {
                                console.error('Error saving settings:', e);
                                console.error('Error details:', e.message, e.code);
                                setAlert('❌ ' + t('common.error') + ': ' + (e.message || 'Erreur inconnue'));
                            }
                        }}
                        className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl"
                    >
                        {t('common.save')}
                    </Button>
                </DialogFooter>
            </Dialog>

            {/* RESET CONFIRMATION MODAL */}
            <Dialog isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.resetConfirmTitle')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-red-500 font-bold mb-2">{t('common.resetWarning')}</p>
                    <p>{t('common.resetConfirmBody')}</p>
                    <p className="mt-2">{t('common.areYouSure')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setIsResetModalOpen(false)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleGlobalReset} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">{t('common.resetYes')}</Button>
                </DialogFooter>
            </Dialog>

            {/* NEW: CREATE MANUAL ASSET MODAL */}
            <Dialog isOpen={isCreateAssetModalOpen} onClose={() => setIsCreateAssetModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsCreateAssetModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{t('transactions.newManualAsset')}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div>
                        <Label>{t('transactions.assetName')}</Label>
                        <Input value={newAssetName} onChange={e => setNewAssetName(e.target.value)} className={fieldBase} placeholder="Ex: Impression, Conception..." />
                    </div>
                    <div>
                        <Label>{t('transactions.descriptionOptional')}</Label>
                        <Input value={newAssetDescription} onChange={e => setNewAssetDescription(e.target.value)} className={fieldBase} />
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => {
                        handleCreateAsset();
                    }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">{t('transactions.create')}</Button>
                </DialogFooter>
            </Dialog>

            {/* TREASURY CARD MODAL */}
            <Dialog isOpen={isTreasuryCardModalOpen} onClose={() => setIsTreasuryCardModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsTreasuryCardModalOpen(false)} isDark={isDark}><DialogTitle>{editingTreasuryCard ? t('transactions.editCard') : t('transactions.addCard')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div><Label>{t('transactions.cardNameSource')}</Label><Input value={treasuryCardName} onChange={e => setTreasuryCardName(e.target.value)} className={fieldBase} placeholder="Ex: Coffre Fort" /></div>
                    <div><Label>{t('transactions.valueDzd')}</Label><NumberInput value={treasuryCardValue} onChange={e => setTreasuryCardValue(e.target.value)} className={fieldBase} placeholder="0.00" /></div>
                    <div>
                        <Label>{t('common.notes')}</Label>
                        <textarea
                            value={treasuryCardNotes}
                            onChange={e => setTreasuryCardNotes(e.target.value)}
                            rows={4}
                            className={`${fieldBase} min-h-[110px] w-full resize-y`}
                            placeholder="Details de l'investissement, remarques, infos importantes..."
                        />
                    </div>
                </DialogContent>
                <DialogFooter><Button onClick={handleSaveTreasuryCard} disabled={isSaving} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">{isSaving ? t('common.saving') : (editingTreasuryCard ? t('transactions.update') : t('transactions.add'))}</Button></DialogFooter>
            </Dialog>

            {/* DELETE TREASURY CARD CONFIRMATION */}
            <Dialog isOpen={treasuryCardToDelete !== null} onClose={() => setTreasuryCardToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('common.areYouSure')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setTreasuryCardToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteTreasuryCard} disabled={isSaving} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{isSaving ? t('common.deleting') : t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>

            <Dialog isOpen={treasuryTxToDelete !== null} onClose={() => setTreasuryTxToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('transactions.deleteTransaction')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('transactions.confirmDeleteTx')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setTreasuryTxToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteTreasuryTxConfirm} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>
        </>
    );
}

const areMainUtilityDialogsPropsEqual = (prev: MainUtilityDialogsProps, next: MainUtilityDialogsProps) => {
    const prevTreasuryCardDeleteOpen = prev.treasuryCardToDelete !== null;
    const nextTreasuryCardDeleteOpen = next.treasuryCardToDelete !== null;
    const prevTreasuryTxDeleteOpen = prev.treasuryTxToDelete !== null;
    const nextTreasuryTxDeleteOpen = next.treasuryTxToDelete !== null;

    if (
        prev.isSettingsModalOpen !== next.isSettingsModalOpen
        || prev.isResetModalOpen !== next.isResetModalOpen
        || prev.isCreateAssetModalOpen !== next.isCreateAssetModalOpen
        || prev.isTreasuryCardModalOpen !== next.isTreasuryCardModalOpen
        || prevTreasuryCardDeleteOpen !== nextTreasuryCardDeleteOpen
        || prevTreasuryTxDeleteOpen !== nextTreasuryTxDeleteOpen
    ) {
        return false;
    }

    if (next.isSettingsModalOpen) {
        const sameSettings =
            prev.suggestedProfitMargin === next.suggestedProfitMargin
            && prev.suggestedSellingPrice === next.suggestedSellingPrice
            && prev.suggestedSellingPriceEur === next.suggestedSellingPriceEur
            && prev.portfolioStats === next.portfolioStats
            && prev.fieldBase === next.fieldBase
            && prev.subtleText === next.subtleText
            && prev.isDark === next.isDark
            && prev.cardBase === next.cardBase;
        if (!sameSettings) return false;
    }

    if (next.isCreateAssetModalOpen) {
        const sameCreateAsset =
            prev.newAssetName === next.newAssetName
            && prev.newAssetDescription === next.newAssetDescription
            && prev.fieldBase === next.fieldBase
            && prev.isDark === next.isDark
            && prev.cardBase === next.cardBase;
        if (!sameCreateAsset) return false;
    }

    if (next.isTreasuryCardModalOpen) {
        const sameCardModal =
            prev.editingTreasuryCard === next.editingTreasuryCard
            && prev.treasuryCardName === next.treasuryCardName
            && prev.treasuryCardValue === next.treasuryCardValue
            && prev.treasuryCardNotes === next.treasuryCardNotes
            && prev.isSaving === next.isSaving
            && prev.fieldBase === next.fieldBase
            && prev.isDark === next.isDark
            && prev.cardBase === next.cardBase;
        if (!sameCardModal) return false;
    }

    if (nextTreasuryCardDeleteOpen && (prev.treasuryCardToDelete !== next.treasuryCardToDelete || prev.isSaving !== next.isSaving)) {
        return false;
    }

    if (nextTreasuryTxDeleteOpen && prev.treasuryTxToDelete !== next.treasuryTxToDelete) {
        return false;
    }

    return true;
};

export const MainUtilityDialogs = memo(MainUtilityDialogsComponent, areMainUtilityDialogsPropsEqual);
