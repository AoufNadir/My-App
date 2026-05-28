import React from 'react';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
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
    // Form State
    buyUsdtAmount: string;
    setBuyUsdtAmount: (v: string) => void;
    buyUsdtPrice: string;
    setBuyUsdtPrice: (v: string) => void;
    buyUsdtTotal: string;
    setBuyUsdtTotal: (v: string) => void;
    buyEurAmount: string;
    setBuyEurAmount: (v: string) => void;
    buyEurPrice: string;
    setBuyEurPrice: (v: string) => void;
    buyEurTotal: string;
    setBuyEurTotal: (v: string) => void;
    sellAmount: string;
    setSellAmount: (v: string) => void;
    sellPrice: string;
    setSellPrice: (v: string) => void;
    sellTotal: string;
    setSellTotal: (v: string) => void;
    buyUsdtMode: 'with_dzd' | 'with_eur' | null;
    setBuyUsdtMode: (v: 'with_dzd' | 'with_eur' | null) => void;
    buyEurForUsdtAmount: string;
    setBuyEurForUsdtAmount: (v: string) => void;
    eurDzdPrice: string;
    setEurDzdPrice: (v: string) => void;
    eurUsdtRate: string;
    setEurUsdtRate: (v: string) => void;
    paymentMethod: string;
    setPaymentMethod: (v: string) => void;
    clientPaymentStatus: 'credit' | 'baridi' | 'cash';
    setClientPaymentStatus: (v: 'credit' | 'baridi' | 'cash') => void;
    linkedClientId: string;
    setLinkedClientId: (v: string) => void;
    notes: string;
    setNotes: (v: string) => void;
    isTotalManual: boolean;
    setIsTotalManual: (v: boolean) => void;
    // Constants/Derived
    clientsDzd: ClientDzd[];
    portfolioStats: PortfolioStats;
    usdtFromEurCalc: any;
    formValidation: {
        isValid: boolean;
        errors: Record<string, string>;
    };
    // Actions
    onSave: () => void;
    onOpenClientModal: () => void;
}
export function TransactionModal({ isOpen, onClose, mode, editingTx, isSaving, buyUsdtAmount, setBuyUsdtAmount, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal, buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal, sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal, buyUsdtMode, setBuyUsdtMode, buyEurForUsdtAmount, setBuyEurForUsdtAmount, eurDzdPrice, setEurDzdPrice, eurUsdtRate, setEurUsdtRate, clientPaymentStatus, setClientPaymentStatus, linkedClientId, setLinkedClientId, notes, setNotes, isTotalManual, setIsTotalManual, clientsDzd, portfolioStats, usdtFromEurCalc, formValidation, onSave, onOpenClientModal }: TransactionModalProps) {
    const { t } = useLanguage();
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
                <ModalHeader onClose={onClose}>
                    <ModalTitle className="flex items-center gap-2 text-2xl font-bold">
                        {mode === 'buy_usdt' ? (editingTx ? "Éditer Achat USDT" : "Acheter USDT") :
            mode === 'sell_usdt' ? (editingTx ? "Éditer Vente USDT" : "Vendre USDT") :
                (editingTx ? "Éditer Achat EUR" : "Acheter EUR")}
                    </ModalTitle>
                    <ModalDescription className="text-neutral-500">
                        Remplissez les détails de la transaction ci-dessous.
                    </ModalDescription>
                </ModalHeader>

                <ModalContent className="my-2 max-h-[70vh] space-y-4 overflow-y-auto px-6">
                    {/* Form Content (Simplified for brevity in trace, should be full form) */}
                    {/* ... Buy/Sell fields ... */}
                    <div className="space-y-4">
                        {mode === 'buy_usdt' && !editingTx && (<div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-surface-muted p-1">
                                <button type="button" onClick={() => setBuyUsdtMode('with_dzd')} className={`min-h-touch rounded-md px-3 py-2 text-sm font-bold transition-all ${buyUsdtMode === 'with_dzd' ? 'border border-warning/20 bg-warning-bg text-warning' : 'text-neutral-500 hover:bg-neutral-100'}`}>Avec DZD</button>
                                <button type="button" onClick={() => setBuyUsdtMode('with_eur')} className={`min-h-touch rounded-md px-3 py-2 text-sm font-bold transition-all ${buyUsdtMode === 'with_eur' ? 'border border-primary/20 bg-primary/10 text-primary' : 'text-neutral-500 hover:bg-neutral-100'}`}>Avec Portefeuille EUR</button>
                            </div>)}

                        {/* Amount and Price inputs would go here */}
                        {/* Linking to Client Component */}
                        <div className="mt-4 space-y-2 border-t border-border pb-2 pt-4">
                            <Label>Lier à un client DZD</Label>
                            <div className="flex items-center gap-2">
                                <Select value={linkedClientId} onChange={(e: any) => setLinkedClientId(e.target.value)} className="flex-grow rounded-lg">
                                    <option value="none">Aucun / Sans client</option>
                                    {clientsDzd.map(c => (<option key={c.id} value={c.id}>{c.fullName || c.nom}</option>))}
                                </Select>
                                <Button type="button" onClick={onOpenClientModal} variant="outline" className="h-touch w-touch shrink-0 p-2.5">
                                    <PlusIcon className="w-5 h-5"/>
                                </Button>
                            </div>
                        </div>
                    </div>
                </ModalContent>

                <ModalFooter className="mt-4 gap-2 border-t border-border pt-4">
                    <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
                    <Button onClick={onSave} disabled={isSaving || !formValidation.isValid} className="flex-1 font-bold">
                        {isSaving ? "Traitement..." : "Confirmer"}
                    </Button>
                </ModalFooter>
        </Modal>);
}
