import { memo, useState } from 'react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { MoneyField } from '../ui/MoneyField';
import { Textarea } from '../ui/Textarea';
import { useAuthLock } from '../../hooks/useAuthLock';
import { CheckIcon } from '../icons/CheckIcon';
import { LockIcon } from '../icons/LockIcon';
import { FormCard } from '../ui/FormCard';

type MainUtilityDialogsProps = Record<string, any>;

type PinMessage = { text: string; tone: 'error' | 'success' };

function PinSettings({ t }: { t: (key: string) => any }) {
    const { pinEnabled, setPin, disablePin, lock } = useAuthLock();
    const [draft, setDraft] = useState('');
    const [confirm, setConfirm] = useState('');
    const [msg, setMsg] = useState<PinMessage | null>(null);

    const handleSetPin = async () => {
        setMsg(null);
        if (draft.length < 4) {
            setMsg({ text: t('settings.pinTooShort'), tone: 'error' });
            return;
        }
        if (draft !== confirm) {
            setMsg({ text: t('settings.pinMismatch'), tone: 'error' });
            return;
        }
        await setPin(draft);
        setDraft('');
        setConfirm('');
        setMsg({ text: t('settings.pinEnabledMessage'), tone: 'success' });
    };

    const handleDisable = () => {
        disablePin();
        setMsg({ text: t('settings.pinDisabledMessage'), tone: 'success' });
    };

    return (
        <FormCard
            title={t('settings.pinTitle')}
            description={pinEnabled ? t('settings.pinActiveDetail') : t('settings.pinDescription')}
            aside={pinEnabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-financial-profit-bg px-2 py-0.5 text-financial-profit">
                    <CheckIcon aria-hidden="true" className="h-3.5 w-3.5"/>
                    {t('settings.pinActive')}
                </span>
            ) : undefined}
        >
            {pinEnabled ? (
                <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={lock}>
                        <LockIcon aria-hidden="true" className="h-4 w-4"/>
                        {t('settings.lockNow')}
                    </Button>
                    <Button type="button" onClick={handleDisable} className="border border-financial-loss/30 bg-surface text-financial-loss hover:bg-financial-loss-bg active:bg-financial-loss-bg">
                        {t('settings.disablePin')}
                    </Button>
                </div>
            ) : (
                <>
                    <Input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoComplete="off"
                        aria-label={t('settings.newPin')}
                        placeholder={t('settings.newPin')}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
                        dir="ltr"
                    />
                    <Input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoComplete="off"
                        aria-label={t('settings.confirmPin')}
                        placeholder={t('settings.confirmPin')}
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value.replace(/\D/g, ''))}
                        dir="ltr"
                    />
                    <Button type="button" onClick={handleSetPin} className="w-full">
                        {t('settings.enablePin')}
                    </Button>
                </>
            )}
            {msg && (
                <p role="status" className={`text-xs font-semibold ${msg.tone === 'error' ? 'text-financial-loss' : 'text-financial-profit'}`}>
                    {msg.text}
                </p>
            )}
        </FormCard>
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
                <ModalHeader onClose={closeSettings}>
                    <ModalTitle className="text-base sm:text-lg">{t('settings.securityTitle')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
                    <PinSettings t={t} />

                    <FormCard title={t('settings.backupTitle')} description={t('settings.backupDescription')}>
                        <Button
                            type="button"
                            variant="outline"
                            size="md"
                            className="w-full font-semibold gap-2"
                            onClick={() => typeof handleExportBackup === 'function' && handleExportBackup()}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                            {t('settings.backupDownload')}
                        </Button>
                    </FormCard>
                </ModalContent>
                <ModalFooter>
                    <Button type="button" variant="outline" className="w-full" onClick={closeSettings}>{t('common.close')}</Button>
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
                <ModalHeader onClose={closeCreateAsset}>
                    <ModalTitle className="text-base sm:text-lg">{t('transactions.newManualAsset')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                    <Input
                        label={t('transactions.assetName')}
                        value={newAssetName}
                        onChange={(event) => setNewAssetName(event.target.value)}
                        placeholder={t('services.servicePlaceholder') as string}
                    />
                    <Input
                        label={t('transactions.descriptionOptional')}
                        value={newAssetDescription}
                        onChange={(event) => setNewAssetDescription(event.target.value)}
                    />
                </ModalContent>
                <ModalFooter>
                    <Button type="button" variant="outline" onClick={closeCreateAsset}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="button" onClick={handleCreateAsset}>
                        {t('transactions.create')}
                    </Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={isTreasuryCardModalOpen} onClose={closeTreasuryCard} className="max-w-md bg-surface text-neutral-900">
                <ModalHeader onClose={closeTreasuryCard}>
                    <ModalTitle className="text-base sm:text-lg">
                        {editingTreasuryCard ? t('transactions.editCard') : t('transactions.addCard')}
                    </ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                    <Input
                        label={t('transactions.cardNameSource')}
                        value={treasuryCardName}
                        onChange={(event) => setTreasuryCardName(event.target.value)}
                        placeholder={t('transactions.cardNamePlaceholder')}
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
                        placeholder={t('transactions.cardNotesPlaceholder')}
                    />
                </ModalContent>
                <ModalFooter>
                    <Button type="button" variant="outline" onClick={closeTreasuryCard}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="button" onClick={handleSaveTreasuryCard} loading={isSaving}>
                        {isSaving ? t('common.saving') : (editingTreasuryCard ? t('transactions.update') : t('transactions.add'))}
                    </Button>
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
