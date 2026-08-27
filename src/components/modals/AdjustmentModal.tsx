import React from 'react';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useLanguage } from '../../contexts/LanguageContext';
import { ClientDzd, TreasuryTx } from '../../types';
interface AdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    adjustmentTab: 'add' | 'subtract';
    setAdjustmentTab: (v: 'add' | 'subtract') => void;
    adjustmentAsset: string;
    setAdjustmentAsset: (v: string) => void;
    adjustmentAmount: string;
    setAdjustmentAmount: (v: string) => void;
    adjustmentPrice: string;
    setAdjustmentPrice: (v: string) => void;
    adjustmentNote: string;
    setAdjustmentNote: (v: string) => void;
    adjustmentClientId: string;
    setAdjustmentClientId: (v: string) => void;
    editingTreasuryTx: TreasuryTx | null;
    clientsDzd: ClientDzd[];
    onSave: () => void;
}
export function AdjustmentModal({ isOpen, onClose, isSaving, adjustmentTab, setAdjustmentTab, adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount, adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote, adjustmentClientId, setAdjustmentClientId, editingTreasuryTx, clientsDzd, onSave }: AdjustmentModalProps) {
    const { t } = useLanguage();
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
                <ModalHeader onClose={onClose}>
                    <ModalTitle className="text-2xl font-bold">
                        {editingTreasuryTx ? "Modifier l'ajustement" : t('dashboard.adjustBalances')}
                    </ModalTitle>
                    <ModalDescription className="text-neutral-500">
                        Ajuster manuellement les soldes du système.
                    </ModalDescription>
                </ModalHeader>

                <ModalContent className="my-2 max-h-[70vh] space-y-4 overflow-y-auto px-6">
                    {/* Adjustment Form Content */}
                    {/* ... Tabs for Add/Subtract ... */}
                    {/* ... Asset Selection ... */}
                    {/* ... Amount/Price Inputs ... */}
                    {/* ... Notes and Client Linking ... */}
                </ModalContent>

                <ModalFooter className="mt-4 gap-2 border-t border-border pt-4">
                    <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
                    <Button onClick={onSave} disabled={isSaving} className="flex-1 font-bold">
                        {isSaving ? "Traitement..." : "Confirmer"}
                    </Button>
                </ModalFooter>
        </Modal>);
}
