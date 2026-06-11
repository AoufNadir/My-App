import { memo, useEffect, useState } from 'react';
export const MONTHLY_GOAL_KEY = 'app_monthly_profit_goal';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { MoneyField } from '../ui/MoneyField';
import { Textarea } from '../ui/Textarea';
import { useAuthLock } from '../../hooks/useAuthLock';

type MainUtilityDialogsProps = Record<string, any>;

function PinSettings({}: {}) {
    const { pinEnabled, setPin, disablePin, lock } = useAuthLock();
    const [draft, setDraft] = useState('');
    const [confirm, setConfirm] = useState('');
    const [msg, setMsg] = useState<string | null>(null);

    const handleSetPin = async () => {
        setMsg(null);
        if (draft.length < 4) {
            setMsg('Le code doit contenir au moins 4 chiffres.');
            return;
        }
        if (draft !== confirm) {
            setMsg('Les codes ne correspondent pas.');
            return;
        }
        await setPin(draft);
        setDraft('');
        setConfirm('');
        setMsg('Code PIN active.');
    };

    const handleDisable = () => {
        disablePin();
        setMsg('Code PIN desactive.');
    };

    return (
        <div>
            <Label>Verrouillage par code PIN</Label>
            {pinEnabled ? (
                <div className="mt-2 rounded-lg bg-surface-muted p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="text-sm">
                            <p className="font-semibold text-neutral-900">PIN actif</p>
                            <p className="text-xs text-neutral-500">Verrouillage automatique apres 3 minutes d'inactivite.</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={lock}>Verrouiller</Button>
                            <Button type="button" variant="danger" size="sm" onClick={handleDisable}>Desactiver</Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mt-2 space-y-2">
                    <Input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="Nouveau code (4-6 chiffres)"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
                        dir="ltr"
                    />
                    <Input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="Confirmer le code"
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value.replace(/\D/g, ''))}
                        dir="ltr"
                    />
                    <Button type="button" onClick={handleSetPin} className="w-full">
                        Activer le verrouillage
                    </Button>
                </div>
            )}
            {msg && <p className="mt-2 text-xs text-neutral-600">{msg}</p>}
        </div>
    );
}

function MainUtilityDialogsComponent({
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    t,
    suggestedProfitMargin,
    setSuggestedProfitMargin,
    suggestedSellingPrice,
    setSuggestedSellingPrice,
    suggestedUsdtEurSellPrice,
    setSuggestedUsdtEurSellPrice,
    suggestedSellingPriceEur,
    setSuggestedSellingPriceEur,
    portfolioStats,
    setIsResetModalOpen,
    userDocRef,
    setAlert,
    isResetModalOpen,
    handleGlobalReset,
    handleExportBackup,
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
    handleDeleteTreasuryTxConfirm,
}: MainUtilityDialogsProps) {
    const closeSettings = () => setIsSettingsModalOpen(false);
    const closeCreateAsset = () => setIsCreateAssetModalOpen(false);
    const closeTreasuryCard = () => setIsTreasuryCardModalOpen(false);

    const [monthlyGoalDraft, setMonthlyGoalDraft] = useState('');
    const [minGoalDraft, setMinGoalDraft] = useState('');
    const [tierVipDraft, setTierVipDraft] = useState('');
    const [tierRegularDraft, setTierRegularDraft] = useState('');
    const [tierPetitDraft, setTierPetitDraft] = useState('');

    useEffect(() => {
        if (isSettingsModalOpen) {
            const stored = localStorage.getItem(MONTHLY_GOAL_KEY);
            setMonthlyGoalDraft(stored ? String(Math.round(Number(stored))) : '');
            const storedMin = localStorage.getItem('app_min_monthly_goal');
            setMinGoalDraft(storedMin ? String(Math.round(Number(storedMin))) : '');
            setTierVipDraft(localStorage.getItem('app_tier_vip') || '5000');
            setTierRegularDraft(localStorage.getItem('app_tier_regular') || '1000');
            setTierPetitDraft(localStorage.getItem('app_tier_petit') || '150');
        }
    }, [isSettingsModalOpen]);

    const handleSaveSettings = async () => {
        const goalValue = parseFloat(monthlyGoalDraft) || 0;
        if (goalValue > 0) {
            localStorage.setItem(MONTHLY_GOAL_KEY, String(goalValue));
        } else {
            localStorage.removeItem(MONTHLY_GOAL_KEY);
        }
        window.dispatchEvent(new StorageEvent('storage', { key: MONTHLY_GOAL_KEY, newValue: goalValue > 0 ? String(goalValue) : null }));

        // Minimum monthly goal
        const minGoalValue = parseFloat(minGoalDraft) || 0;
        if (minGoalValue > 0) localStorage.setItem('app_min_monthly_goal', String(minGoalValue));
        else localStorage.removeItem('app_min_monthly_goal');
        window.dispatchEvent(new StorageEvent('storage', { key: 'app_min_monthly_goal', newValue: minGoalValue > 0 ? String(minGoalValue) : null }));

        // Tier thresholds
        const saveThreshold = (key: string, val: string, def: number) => {
            const n = parseFloat(val) || def;
            localStorage.setItem(key, String(n));
            window.dispatchEvent(new StorageEvent('storage', { key, newValue: String(n) }));
        };
        saveThreshold('app_tier_vip',     tierVipDraft,     5000);
        saveThreshold('app_tier_regular', tierRegularDraft, 1000);
        saveThreshold('app_tier_petit',   tierPetitDraft,   150);

        try {
            const marginToSave = parseFloat(parseFloat(suggestedProfitMargin).toFixed(2)) || 2;
            const sellPriceToSave = parseFloat(parseFloat(suggestedSellingPrice).toFixed(2)) || 0;
            const usdtEurSellPriceToSave = parseFloat(parseFloat(suggestedUsdtEurSellPrice).toFixed(4)) || 0;
            const sellPriceEurToSave = parseFloat(parseFloat(suggestedSellingPriceEur).toFixed(2)) || 0;

            await userDocRef.set({
                suggestedProfitMargin: marginToSave,
                suggestedSellingPrice: sellPriceToSave,
                suggestedUsdtEurSellPrice: usdtEurSellPriceToSave,
                suggestedSellingPriceEur: sellPriceEurToSave,
                settingsUpdatedAt: Date.now(),
            }, { merge: true });

            setAlert('✅ ' + t('common.settingsSaved'));
            setIsSettingsModalOpen(false);
        } catch (e: any) {
            console.error('Error saving settings:', e);
            setAlert('❌ ' + t('common.error') + ': ' + (e.message || 'Erreur inconnue'));
        }
    };

    return (
        <>
            <Modal isOpen={isSettingsModalOpen} onClose={closeSettings} className="max-w-sm bg-surface text-neutral-900">
                <ModalHeader onClose={closeSettings} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                    <ModalTitle className="text-base sm:text-lg">{t('settings.salesSettings')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                    <MoneyField
                        label={t('settings.salePriceUsdtDzd')}
                        value={suggestedSellingPrice}
                        onChange={setSuggestedSellingPrice}
                        currency="DZD"
                        placeholder="250.00"
                        hint={t('settings.usedForTransactionsAndSimulator')}
                    />

                    <MoneyField
                        label={t('settings.salePriceUsdtEur')}
                        value={suggestedUsdtEurSellPrice}
                        onChange={setSuggestedUsdtEurSellPrice}
                        currency="EUR"
                        placeholder="0.8650"
                    />

                    <MoneyField
                        label={t('settings.salePriceEurDzd')}
                        value={suggestedSellingPriceEur}
                        onChange={setSuggestedSellingPriceEur}
                        currency="DZD"
                        placeholder="0.00"
                        hint={`${t('portfolio.avgBuyPriceEur')}: ${(portfolioStats.eur.avgBuy || 0).toFixed(2)} ${t('common.dinar')}`}
                    />

                    <MoneyField
                        label={t('settings.defaultMarginDzd')}
                        value={suggestedProfitMargin}
                        onChange={setSuggestedProfitMargin}
                        currency="DZD"
                        placeholder="2.00"
                    />

                    <PinSettings />

                    {/* Monthly goals */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Objectifs mensuels</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Objectif ambitieux (DZD)</Label>
                                <MoneyField
                                    label=""
                                    value={monthlyGoalDraft}
                                    onChange={setMonthlyGoalDraft}
                                    currency="DZD"
                                    placeholder="Ex: 200 000"
                                    hint="Barre de progression Dashboard"
                                />
                            </div>
                            <div>
                                <Label>Plancher obligatoire (DZD)</Label>
                                <MoneyField
                                    label=""
                                    value={minGoalDraft}
                                    onChange={setMinGoalDraft}
                                    currency="DZD"
                                    placeholder="Ex: 100 000"
                                    hint="Défaut: 65% de l'objectif"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tier thresholds */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Seuils de classification client <span className="font-normal normal-case">(USDT/mois précédent)</span></p>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <Label>VIP (min)</Label>
                                <MoneyField label="" value={tierVipDraft} onChange={setTierVipDraft} currency="USDT" placeholder="5000" hint="> ce seuil = VIP"/>
                            </div>
                            <div>
                                <Label>Régulier (min)</Label>
                                <MoneyField label="" value={tierRegularDraft} onChange={setTierRegularDraft} currency="USDT" placeholder="1000" hint="Régulier → VIP"/>
                            </div>
                            <div>
                                <Label>Petit (min)</Label>
                                <MoneyField label="" value={tierPetitDraft} onChange={setTierPetitDraft} currency="USDT" placeholder="150" hint="Petit → Régulier"/>
                            </div>
                        </div>
                        <p className="text-[10px] text-neutral-400">
                            Nouveau = &lt; {tierPetitDraft || '150'} USDT ou sans historique
                        </p>
                    </div>


                    {/* Backup section */}
                    <div className="rounded-xl border border-border bg-surface-muted p-3 space-y-2">
                        <p className="text-xs font-bold uppercase text-neutral-500 tracking-wide">Sauvegarde des données</p>
                        <p className="text-[11px] text-neutral-400 leading-relaxed">
                            Exporte toutes vos données (transactions, clients, investisseurs, trésorerie…) en fichier JSON.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="md"
                            className="w-full font-semibold gap-2"
                            onClick={() => typeof handleExportBackup === 'function' && handleExportBackup()}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                            Télécharger sauvegarde JSON
                        </Button>
                    </div>
                </ModalContent>
                <ModalFooter className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                    <div className="flex w-full gap-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={closeSettings}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="button" className="flex-1" onClick={handleSaveSettings}>
                            {t('common.save')}
                        </Button>
                    </div>
                </ModalFooter>
            </Modal>

            <ConfirmDialog
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
                onConfirm={handleGlobalReset}
                title={t('common.resetConfirmTitle')}
                description={`${t('common.resetWarning')} ${t('common.resetConfirmBody')} ${t('common.areYouSure')}`}
                confirmLabel={t('common.resetYes')}
                cancelLabel={t('common.cancel')}
                variant="danger"
            />

            <Modal isOpen={isCreateAssetModalOpen} onClose={closeCreateAsset} className="max-w-md bg-surface text-neutral-900">
                <ModalHeader onClose={closeCreateAsset} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                    <ModalTitle className="text-base sm:text-lg">{t('transactions.newManualAsset')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                    <Input
                        label={t('transactions.assetName')}
                        value={newAssetName}
                        onChange={(event) => setNewAssetName(event.target.value)}
                        placeholder="Ex: Impression, Conception..."
                    />
                    <Input
                        label={t('transactions.descriptionOptional')}
                        value={newAssetDescription}
                        onChange={(event) => setNewAssetDescription(event.target.value)}
                    />
                </ModalContent>
                <ModalFooter className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                    <div className="flex w-full gap-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={closeCreateAsset}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="button" className="flex-1" onClick={handleCreateAsset}>
                            {t('transactions.create')}
                        </Button>
                    </div>
                </ModalFooter>
            </Modal>

            <Modal isOpen={isTreasuryCardModalOpen} onClose={closeTreasuryCard} className="max-w-md bg-surface text-neutral-900">
                <ModalHeader onClose={closeTreasuryCard} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                    <ModalTitle className="text-base sm:text-lg">
                        {editingTreasuryCard ? t('transactions.editCard') : t('transactions.addCard')}
                    </ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                    <Input
                        label={t('transactions.cardNameSource')}
                        value={treasuryCardName}
                        onChange={(event) => setTreasuryCardName(event.target.value)}
                        placeholder="Ex: Coffre Fort"
                    />
                    <MoneyField
                        label={t('transactions.valueDzd')}
                        value={treasuryCardValue}
                        onChange={setTreasuryCardValue}
                        currency="DZD"
                        placeholder="0.00"
                    />
                    <Textarea
                        label={t('common.notes')}
                        value={treasuryCardNotes}
                        onChange={(event) => setTreasuryCardNotes(event.target.value)}
                        rows={4}
                        placeholder="Details de l'investissement, remarques, infos importantes..."
                    />
                </ModalContent>
                <ModalFooter className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                    <div className="flex w-full gap-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={closeTreasuryCard}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="button" className="flex-1" onClick={handleSaveTreasuryCard} loading={isSaving}>
                            {isSaving ? t('common.saving') : (editingTreasuryCard ? t('transactions.update') : t('transactions.add'))}
                        </Button>
                    </div>
                </ModalFooter>
            </Modal>

            <ConfirmDialog
                isOpen={treasuryCardToDelete !== null}
                onClose={() => setTreasuryCardToDelete(null)}
                onConfirm={handleDeleteTreasuryCard}
                title={t('common.confirmDelete')}
                description={`${t('common.areYouSure')} ${t('transactions.irreversibleAction')}`}
                confirmLabel={isSaving ? t('common.deleting') : t('common.delete')}
                cancelLabel={t('common.cancel')}
                variant="danger"
                loading={isSaving}
            />

            <ConfirmDialog
                isOpen={treasuryTxToDelete !== null}
                onClose={() => setTreasuryTxToDelete(null)}
                onConfirm={handleDeleteTreasuryTxConfirm}
                title={t('transactions.deleteTransaction')}
                description={`${t('transactions.confirmDeleteTx')} ${t('transactions.irreversibleAction')}`}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                variant="danger"
            />
        </>
    );
}

const areMainUtilityDialogsPropsEqual = (prev: MainUtilityDialogsProps, next: MainUtilityDialogsProps) => {
    const prevTreasuryCardDeleteOpen = prev.treasuryCardToDelete !== null;
    const nextTreasuryCardDeleteOpen = next.treasuryCardToDelete !== null;
    const prevTreasuryTxDeleteOpen = prev.treasuryTxToDelete !== null;
    const nextTreasuryTxDeleteOpen = next.treasuryTxToDelete !== null;
    if (prev.isSettingsModalOpen !== next.isSettingsModalOpen
        || prev.isResetModalOpen !== next.isResetModalOpen
        || prev.isCreateAssetModalOpen !== next.isCreateAssetModalOpen
        || prev.isTreasuryCardModalOpen !== next.isTreasuryCardModalOpen
        || prevTreasuryCardDeleteOpen !== nextTreasuryCardDeleteOpen
        || prevTreasuryTxDeleteOpen !== nextTreasuryTxDeleteOpen) {
        return false;
    }
    if (next.isSettingsModalOpen) {
        const sameSettings = prev.suggestedProfitMargin === next.suggestedProfitMargin
            && prev.suggestedSellingPrice === next.suggestedSellingPrice
            && prev.suggestedUsdtEurSellPrice === next.suggestedUsdtEurSellPrice
            && prev.suggestedSellingPriceEur === next.suggestedSellingPriceEur
            && prev.portfolioStats === next.portfolioStats;
        if (!sameSettings) {
            return false;
        }
    }
    if (next.isCreateAssetModalOpen) {
        const sameCreateAsset = prev.newAssetName === next.newAssetName
            && prev.newAssetDescription === next.newAssetDescription
            && true;
        if (!sameCreateAsset) {
            return false;
        }
    }
    if (next.isTreasuryCardModalOpen) {
        const sameCardModal = prev.editingTreasuryCard === next.editingTreasuryCard
            && prev.treasuryCardName === next.treasuryCardName
            && prev.treasuryCardValue === next.treasuryCardValue
            && prev.treasuryCardNotes === next.treasuryCardNotes
            && prev.isSaving === next.isSaving
            && true;
        if (!sameCardModal) {
            return false;
        }
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
