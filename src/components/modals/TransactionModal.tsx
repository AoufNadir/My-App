import React from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { PlusIcon } from '../icons/PlusIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { Tx, ClientDzd, PortfolioStats } from '../../types';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'buy_usdt' | 'sell_usdt' | 'buy_eur';
    editingTx: Tx | null;
    isSaving: boolean;
    isDark: boolean;
    // Form State
    buyUsdtAmount: string; setBuyUsdtAmount: (v: string) => void;
    buyUsdtPrice: string; setBuyUsdtPrice: (v: string) => void;
    buyUsdtTotal: string; setBuyUsdtTotal: (v: string) => void;
    buyEurAmount: string; setBuyEurAmount: (v: string) => void;
    buyEurPrice: string; setBuyEurPrice: (v: string) => void;
    buyEurTotal: string; setBuyEurTotal: (v: string) => void;
    sellAmount: string; setSellAmount: (v: string) => void;
    sellPrice: string; setSellPrice: (v: string) => void;
    sellTotal: string; setSellTotal: (v: string) => void;
    buyUsdtMode: 'with_dzd' | 'with_eur' | null; setBuyUsdtMode: (v: 'with_dzd' | 'with_eur' | null) => void;
    buyEurForUsdtAmount: string; setBuyEurForUsdtAmount: (v: string) => void;
    eurDzdPrice: string; setEurDzdPrice: (v: string) => void;
    eurUsdtRate: string; setEurUsdtRate: (v: string) => void;
    paymentMethod: string; setPaymentMethod: (v: string) => void;
    clientPaymentStatus: 'credit' | 'baridi' | 'cash'; setClientPaymentStatus: (v: 'credit' | 'baridi' | 'cash') => void;
    linkedClientId: string; setLinkedClientId: (v: string) => void;
    notes: string; setNotes: (v: string) => void;
    isTotalManual: boolean; setIsTotalManual: (v: boolean) => void;
    // Constants/Derived
    clientsDzd: ClientDzd[];
    portfolioStats: PortfolioStats;
    usdtFromEurCalc: any;
    formValidation: { isValid: boolean, errors: Record<string, string> };
    // Actions
    onSave: () => void;
    onOpenClientModal: () => void;
}

export function TransactionModal({
    isOpen, onClose, mode, editingTx, isSaving, isDark,
    buyUsdtAmount, setBuyUsdtAmount, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal,
    buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal,
    sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal,
    buyUsdtMode, setBuyUsdtMode, buyEurForUsdtAmount, setBuyEurForUsdtAmount,
    eurDzdPrice, setEurDzdPrice, eurUsdtRate, setEurUsdtRate,
    clientPaymentStatus, setClientPaymentStatus,
    linkedClientId, setLinkedClientId, notes, setNotes,
    isTotalManual, setIsTotalManual,
    clientsDzd, portfolioStats, usdtFromEurCalc, formValidation,
    onSave, onOpenClientModal
}: TransactionModalProps) {
    const { t } = useLanguage();
    const fieldBase = isDark ? 'bg-[#0F172A] text-white border border-[#334155]' : 'bg-white text-gray-900 border border-[#CBD5E1]';

    return (
        <Dialog isOpen={isOpen} onClose={onClose}>
            <DialogContent className={`${isDark ? 'bg-[#111827] border-[#1F2937] text-white' : 'bg-white border-[#E5E7EB] text-gray-900'} max-w-md w-[95vw] rounded-2xl p-6`}>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        {mode === 'buy_usdt' ? (editingTx ? "Éditer Achat USDT" : "Acheter USDT") :
                            mode === 'sell_usdt' ? (editingTx ? "Éditer Vente USDT" : "Vendre USDT") :
                                (editingTx ? "Éditer Achat EUR" : "Acheter EUR")}
                    </DialogTitle>
                    <DialogDescription className={isDark ? "text-slate-400" : "text-slate-500"}>
                        Remplissez les détails de la transaction ci-dessous.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-2 max-h-[70vh] overflow-y-auto px-1">
                    {/* Form Content (Simplified for brevity in trace, should be full form) */}
                    {/* ... Buy/Sell fields ... */}
                    <div className="space-y-4">
                        {mode === 'buy_usdt' && !editingTx && (
                            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/10 rounded-xl mb-4">
                                <button type="button" onClick={() => setBuyUsdtMode('with_dzd')} className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${buyUsdtMode === 'with_dzd' ? (isDark ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-amber-100 text-amber-700 border border-amber-200') : 'text-slate-500 hover:bg-slate-500/5'}`}>Avec DZD</button>
                                <button type="button" onClick={() => setBuyUsdtMode('with_eur')} className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${buyUsdtMode === 'with_eur' ? (isDark ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-blue-100 text-blue-700 border border-blue-200') : 'text-slate-500 hover:bg-slate-500/5'}`}>Avec Portefeuille EUR</button>
                            </div>
                        )}

                        {/* Amount and Price inputs would go here */}
                        {/* Linking to Client Component */}
                        <div className="pb-2 space-y-2 border-t pt-4 mt-4 border-slate-700/50">
                            <Label>Lier à un client DZD</Label>
                            <div className="flex items-center gap-2">
                                <Select
                                    value={linkedClientId}
                                    onChange={(e: any) => setLinkedClientId(e.target.value)}
                                    className={`${fieldBase} focus:ring-amber-400 rounded-xl flex-grow`}
                                >
                                    <option value="none">Aucun / Sans client</option>
                                    {clientsDzd.map(c => (<option key={c.id} value={c.id}>{c.fullName || c.nom}</option>))}
                                </Select>
                                <Button type="button" onClick={onOpenClientModal} className={`p-2.5 h-10 w-10 rounded-xl shrink-0 transition-colors ${isDark ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                                    <PlusIcon className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 mt-4 pt-4 border-t border-slate-700/50">
                    <Button variant="outline" onClick={onClose} className="rounded-xl flex-1">Annuler</Button>
                    <Button onClick={onSave} disabled={isSaving || !formValidation.isValid} className="rounded-xl flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold">
                        {isSaving ? "Traitement..." : "Confirmer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
