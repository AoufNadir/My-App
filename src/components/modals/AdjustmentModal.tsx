import React from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { useLanguage } from '../../contexts/LanguageContext';
import { ClientDzd, TreasuryTx } from '../../types';

interface AdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    isDark: boolean;
    adjustmentTab: 'add' | 'subtract'; setAdjustmentTab: (v: 'add' | 'subtract') => void;
    adjustmentAsset: string; setAdjustmentAsset: (v: string) => void;
    adjustmentAmount: string; setAdjustmentAmount: (v: string) => void;
    adjustmentPrice: string; setAdjustmentPrice: (v: string) => void;
    adjustmentNote: string; setAdjustmentNote: (v: string) => void;
    adjustmentClientId: string; setAdjustmentClientId: (v: string) => void;
    editingTreasuryTx: TreasuryTx | null;
    clientsDzd: ClientDzd[];
    onSave: () => void;
}

export function AdjustmentModal({
    isOpen, onClose, isSaving, isDark,
    adjustmentTab, setAdjustmentTab,
    adjustmentAsset, setAdjustmentAsset,
    adjustmentAmount, setAdjustmentAmount,
    adjustmentPrice, setAdjustmentPrice,
    adjustmentNote, setAdjustmentNote,
    adjustmentClientId, setAdjustmentClientId,
    editingTreasuryTx, clientsDzd, onSave
}: AdjustmentModalProps) {
    const { t } = useLanguage();
    const fieldBase = isDark ? 'bg-[#0F172A] text-white border border-[#334155]' : 'bg-white text-gray-900 border border-[#CBD5E1]';

    return (
        <Dialog isOpen={isOpen} onClose={onClose}>
            <DialogContent className={`${isDark ? 'bg-[#111827] border-[#1F2937] text-white' : 'bg-white border-[#E5E7EB] text-gray-900'} max-w-md w-[95vw] rounded-2xl p-6`}>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">
                        {editingTreasuryTx ? "Modifier l'ajustement" : t('dashboard.adjustBalances')}
                    </DialogTitle>
                    <DialogDescription className={isDark ? "text-slate-400" : "text-slate-500"}>
                        Ajuster manuellement les soldes du système.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-2 max-h-[70vh] overflow-y-auto px-1">
                    {/* Adjustment Form Content */}
                    {/* ... Tabs for Add/Subtract ... */}
                    {/* ... Asset Selection ... */}
                    {/* ... Amount/Price Inputs ... */}
                    {/* ... Notes and Client Linking ... */}
                </div>

                <DialogFooter className="gap-2 mt-4 pt-4 border-t border-slate-700/50">
                    <Button variant="outline" onClick={onClose} className="rounded-xl flex-1">Annuler</Button>
                    <Button onClick={onSave} disabled={isSaving} className="rounded-xl flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold">
                        {isSaving ? "Traitement..." : "Confirmer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
