import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalDescription } from '../ui/Modal';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { Label } from '../ui/Label';
import { CurrencyAmount } from '../financial/CurrencyAmount';
type CommissionEditorModalProps = {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    onChange: (v: string) => void;
    managerFeeAmount: number;
};
export function CommissionEditorModal({ isOpen, onClose, value, onChange, managerFeeAmount }: CommissionEditorModalProps) {
    const fieldBase = 'min-h-touch rounded-lg border border-border-strong bg-surface px-3 py-2 text-end text-lg font-bold text-neutral-900';
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface">
        <ModalHeader onClose={onClose} className="border-b border-border px-4 py-3 sm:px-5">
          <ModalTitle className="text-base sm:text-lg">Commission Gerant</ModalTitle>
          <ModalDescription className="text-neutral-500">
            Definissez le pourcentage preleve sur le profit total.
          </ModalDescription>
        </ModalHeader>

        <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <Label>Pourcentage</Label>
            <div className="mt-2 flex items-stretch gap-2">
              <div className="flex-1">
                <NumberInput value={value} onChange={(e) => onChange(e.target.value)} className={fieldBase} placeholder="20"/>
              </div>
              <div className="flex min-h-touch items-center justify-center rounded-lg bg-neutral-100 px-4 text-lg font-bold text-neutral-700">
                %
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
            <p className="text-xs font-semibold uppercase text-neutral-500">
              Prelevement estime
            </p>
            <p className="mt-1">
              <CurrencyAmount value={managerFeeAmount} currency="DZD" size="xl" decimals={2}/>
            </p>
          </div>
        </ModalContent>

        <ModalFooter className="border-t border-border px-4 py-3 sm:px-5">
          <div className="flex w-full">
            <Button onClick={onClose} className="w-full rounded-xl bg-primary py-3 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark">
              Fermer
            </Button>
          </div>
        </ModalFooter>
    </Modal>);
}
