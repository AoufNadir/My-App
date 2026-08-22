import React, { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalDescription } from '../ui/Modal';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { Label } from '../ui/Label';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { parseManagerFeePercentage } from '../../hooks/useSettings';
type CommissionEditorModalProps = {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    onSave: (v: string) => Promise<void>;
    managerFeeAmount: number;
};
export function CommissionEditorModal({ isOpen, onClose, value, onSave, managerFeeAmount }: CommissionEditorModalProps) {
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
            setError(err instanceof Error ? err.message : 'Taux invalide.');
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            await onSave(draftValue);
        } catch (err) {
            console.error('Error saving manager commission:', err);
            setError("Impossible d'enregistrer le taux. Reessayez.");
            setIsSaving(false);
        }
    };
    const fieldBase = 'min-h-touch rounded-lg border border-border-strong bg-surface px-3 py-2 text-end text-lg font-bold text-neutral-900';
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface">
        <ModalHeader onClose={onClose} className="border-b border-border px-4 py-3 sm:px-5">
          <ModalTitle className="text-base sm:text-lg">Taux actuel du gérant</ModalTitle>
          <ModalDescription className="text-neutral-500">
            Le taux saisi s'applique seulement aux operations apres l'enregistrement.
          </ModalDescription>
        </ModalHeader>

        <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <Label>Pourcentage</Label>
            <div className="mt-2 flex items-stretch gap-2">
              <div className="flex-1">
                <NumberInput value={draftValue} onChange={(e) => {
            setDraftValue(e.target.value);
            setError('');
        }} className={fieldBase} placeholder="30" disabled={isSaving}/>
              </div>
              <div className="flex min-h-touch items-center justify-center rounded-lg bg-neutral-100 px-4 text-lg font-bold text-neutral-700">
                %
              </div>
            </div>
            {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
          </div>

          <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
            <p className="text-xs font-semibold uppercase text-neutral-500">
              Part gerant actuelle
            </p>
            <p className="mt-1">
              <CurrencyAmount value={managerFeeAmount} currency="DZD" size="xl" decimals={2}/>
            </p>
          </div>
        </ModalContent>

        <ModalFooter className="border-t border-border px-4 py-3 sm:px-5">
          <div className="grid w-full grid-cols-2 gap-3">
            <Button onClick={onClose} variant="outline" disabled={isSaving} className="w-full rounded-xl py-3 font-bold">
              Annuler
            </Button>
            <Button onClick={handleSave} loading={isSaving} className="w-full rounded-xl bg-primary py-3 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark">
              Enregistrer
            </Button>
          </div>
        </ModalFooter>
    </Modal>);
}
