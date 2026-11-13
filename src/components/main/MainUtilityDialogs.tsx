import { memo, useEffect, useState } from 'react';
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
import { NotificationSettings } from './NotificationSettings';
import { CurrencyVisibilitySettings } from './CurrencyVisibilitySettings';
import { HabitsSettings } from './HabitsSettings';
import { SettingsSection } from './SettingsSection';

type MainUtilityDialogsProps = Record<string, any>;

type LockMessage = { text: string; tone: 'error' | 'success' };

// V14-1: one switch: lock with the fingerprint or the face of this phone. No PIN any more.
function BiometricLockSettings({ t }: { t: (key: string) => any }) {
    const { enabled, enable, disable, lock, available } = useAuthLock();
    const [supported, setSupported] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<LockMessage | null>(null);
    useEffect(() => {
        let alive = true;
        void available().then((ok) => { if (alive) setSupported(ok); });
        return () => { alive = false; };
    }, [available]);
    const toggle = async () => {
        setMsg(null);
        if (enabled) {
            disable();
            setMsg({ text: t('settings.bioOff'), tone: 'success' });
            return;
        }
        setBusy(true);
        const ok = await enable();
        setBusy(false);
        setMsg(ok ? { text: t('settings.bioOn'), tone: 'success' } : { text: t('settings.bioFailed'), tone: 'error' });
    };
    return (<FormCard description={t('settings.bioDescription')}>
        {supported === false && !enabled
            ? <p className="text-xs font-semibold text-financial-loss">{t('settings.bioUnsupported')}</p>
            : (<label className="flex min-h-12 items-center justify-between gap-3">
                <span className="text-sm font-semibold text-neutral-900">{t('settings.bioSwitch')}</span>
                <button type="button" role="switch" aria-checked={enabled} disabled={busy} onClick={toggle} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-neutral-300'} disabled:opacity-60`}>
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? 'start-[1.375rem]' : 'start-0.5'}`}/>
                </button>
            </label>)}
        {enabled && (<Button type="button" variant="outline" onClick={lock} className="w-full">
                <LockIcon aria-hidden="true" className="h-4 w-4"/>
                {t('settings.lockNow')}
            </Button>)}
        {msg && <p role="status" className={`text-xs font-semibold ${msg.tone === 'error' ? 'text-financial-loss' : 'text-financial-profit'}`}>{msg.text}</p>}
    </FormCard>);
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
    // V14-1: one section open at a time, all folded when the window opens.
    const [openSection, setOpenSection] = useState<string | null>(null);
    const toggleSection = (id: string) => setOpenSection((current) => (current === id ? null : id));
    const { enabled: lockEnabled } = useAuthLock();
    const closeTreasuryCard = () => setIsTreasuryCardModalOpen(false);

    return (
        <>
            <Modal isOpen={isSettingsModalOpen} onClose={closeSettings} className="max-w-sm bg-surface text-neutral-900">
                <ModalHeader onClose={closeSettings}>
                    <ModalTitle className="text-base sm:text-lg">{t('settings.settingsTitle')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
                    <SettingsSection title={t('settings.secLock')} summary={lockEnabled ? t('settings.bioActive') : t('settings.bioInactive')} icon={<LockIcon className="h-4 w-4"/>} open={openSection === 'lock'} onToggle={() => toggleSection('lock')}>
                        <BiometricLockSettings t={t} />
                    </SettingsSection>
                    <SettingsSection title={t('settings.notifTitle')} summary={t('settings.secNotifSummary')} icon={<span className="text-sm font-bold">!</span>} open={openSection === 'notif'} onToggle={() => toggleSection('notif')}>
                        <NotificationSettings />
                    </SettingsSection>
                    {userDocRef && (<SettingsSection title={t('settings.secCurrencies')} summary={t('settings.secCurrenciesSummary')} icon={<span className="text-sm font-bold">¤</span>} open={openSection === 'currencies'} onToggle={() => toggleSection('currencies')}>
                        <CurrencyVisibilitySettings userDocRef={userDocRef} />
                    </SettingsSection>)}
                    {userDocRef && (<SettingsSection title={t('settings.secHabits')} summary={t('settings.secHabitsSummary')} icon={<CheckIcon className="h-4 w-4"/>} open={openSection === 'habits'} onToggle={() => toggleSection('habits')}>
                        <HabitsSettings userDocRef={userDocRef} />
                    </SettingsSection>)}
                    <SettingsSection title={t('settings.backupTitle')} summary={t('settings.secBackupSummary')} icon={<span className="text-sm font-bold">↓</span>} open={openSection === 'backup'} onToggle={() => toggleSection('backup')}>
                        <FormCard description={t('settings.backupDescription')}>
                            <Button type="button" variant="outline" size="md" className="w-full gap-2 font-semibold" onClick={() => typeof handleExportBackup === 'function' && handleExportBackup()}>
                                {t('settings.backupDownload')}
                            </Button>
                        </FormCard>
                    </SettingsSection>
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
        || prev.isTreasuryCardModalOpen !== next.isTreasuryCardModalOpen
        || prevTreasuryCardDeleteOpen !== nextTreasuryCardDeleteOpen
        || prevTreasuryTxDeleteOpen !== nextTreasuryTxDeleteOpen) {
        return false;
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
