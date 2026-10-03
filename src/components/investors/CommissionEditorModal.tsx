import React, { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalDescription } from '../ui/Modal';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { Label } from '../ui/Label';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { parseManagerFeePercentage } from '../../hooks/useSettings';
import { useLanguage } from '../../contexts/LanguageContext';
type CommissionEditorModalProps = {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    onSave: (v: string) => Promise<void>;
    managerFeeAmount: number;
};
export function CommissionEditorModal({ isOpen, onClose, value, onSave, managerFeeAmount }: CommissionEditorModalProps) {
    const { t } = useLanguage();
    const [draftValue, setDraftValue] = useState(value);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => {
        if (!isOpen)
            return;
        setDraftValue(value);
        setError('');
        setIsSaving(false);
    }, [isOpen, value]);
    const handleSave = async () => {
        try {
            parseManagerFeePercentage(draftValue);
        } catch (err) {
            setError(t('investors.rateRange') as string);
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            await onSave(draftValue);
        } catch (err) {
            console.error('Error saving manager commission:', err);
            setError(t('investors.rateSaveError') as string);
            setIsSaving(false);
        }
    };
    const fieldBase = 'min-h-touch rounded-button border border-border-strong bg-surface px-3 py-2 text-end text-lg font-bold text-neutral-900';
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface">
        <ModalHeader onClose={onClose}>
          <ModalTitle className="text-base sm:text-lg">{t('investors.managerCommissionRate')}</ModalTitle>
          <ModalDescription className="text-neutral-500">
            {t('investors.rateAppliesHint')}
          </ModalDescription>
        </ModalHeader>

        <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <Label htmlFor="manager-commission-rate">{t('investors.percentage')}</Label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1">
                <NumberInput id="manager-commission-rate" value={draftValue} onChange={(e) => {
            setDraftValue(e.target.value);
            setError('');
        }} className={fieldBase} placeholder="30" disabled={isSaving}/>
              </div>
              <div aria-hidden="true" className="flex min-h-touch items-center justify-center rounded-button bg-surface-muted px-4 text-lg font-bold text-neutral-700">
                %
              </div>
            </div>
            {error && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p>}
          </div>

          <div className="rounded-card border border-border bg-surface-muted px-3 py-2.5">
            <p className="text-xs font-semibold text-neutral-500">{t('investors.currentManagerShare')}</p>
            <p className="mt-1">
              <CurrencyAmount value={managerFeeAmount} currency="DZD" semantic="plain" size="xl" decimals={2}/>
            </p>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button onClick={onClose} variant="outline" disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            {t('common.save')}
          </Button>
        </ModalFooter>
    </Modal>);
}
