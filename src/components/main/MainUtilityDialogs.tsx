import { memo, useState } from 'react';
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

    return (
        <>
            <Modal isOpen={isSettingsModalOpen} onClose={closeSettings} className="max-w-sm bg-surface text-neutral-900">
                <ModalHeader onClose={closeSettings} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                    <ModalTitle className="text-base sm:text-lg">{t('settings.salesSettings')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                    <PinSettings />

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
                    <Button type="button" variant="outline" className="w-full" onClick={closeSettings}>{t('common.cancel')}</Button>
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
