import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { NumberInput } from '../components/ui/NumberInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { Trash2Icon } from '../components/icons/Trash2Icon';
import { SwipeableListItem } from '../components/ui/SwipeableListItem';
import { ManualAssetClient, ManualAssetTransaction } from '../types';

type ManualClientPageProps = {
    client: ManualAssetClient;
    transactions: ManualAssetTransaction[];
    balance: number;
    onBack: () => void;
    onAddTransaction: (data: Omit<ManualAssetTransaction, 'id'>) => void;
    onUpdateTransaction: (txId: string, data: Omit<ManualAssetTransaction, 'id'>) => void;
    onDeleteTransaction: (txId: string) => void;
    isDark: boolean;
    cardBase: string;
    fieldBase: string;
    subtleText: string;
};

export function ManualClientPage({
    client,
    transactions,
    balance,
    onBack,
    onAddTransaction,
    onUpdateTransaction,
    onDeleteTransaction,
    isDark,
    cardBase,
    fieldBase,
    subtleText
}: ManualClientPageProps) {
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<ManualAssetTransaction | null>(null);
    const [txType, setTxType] = useState<'service' | 'payment_received'>('service');
    const [amount, setAmount] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [notes, setNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'baridi' | 'credit'>('cash');

    const openEditModal = (tx: ManualAssetTransaction) => {
        setEditingTx(tx);
        setTxType(tx.type as 'service' | 'payment_received');
        setAmount(Math.abs(tx.amount).toString());
        setNotes(tx.notes || '');
        if (tx.type === 'service') {
            setServiceType(tx.serviceType || '');
        } else {
            setPaymentMethod(tx.paymentMethod || 'cash');
        }
        setIsTxModalOpen(true);
    };

    const handleSaveTx = () => {
        // Fix: Robust number parsing (handle spaces and commas)
        const cleanAmount = amount.replace(/\s/g, '').replace(',', '.');
        const val = parseFloat(cleanAmount);
        if (isNaN(val) || val <= 0) return;

        // Logic:
        // Service (Income for us, Debt for client) -> Negative Balance (Client owes us)
        // Payment Received -> Positive Amount (Client Debt decreases / Balance increases)

        let finalAmount = val;
        if (txType === 'service') {
            finalAmount = -val;
        }
        // payment_received -> Positive

        const now = new Date();
        const payload: any = {
            actifId: client.assetId,
            clientId: client.id,
            type: txType,
            amount: finalAmount,
            date: editingTx ? editingTx.date : now.toLocaleDateString('fr-FR'),
            time: editingTx ? editingTx.time : now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: editingTx ? editingTx.timestamp : now.getTime(),
            notes: notes
        };

        if (txType === 'service') payload.serviceType = serviceType;
        if (txType !== 'service') payload.paymentMethod = paymentMethod;

        if (editingTx) {
            onUpdateTransaction(editingTx.id, payload);
        } else {
            onAddTransaction(payload);
        }

        setIsTxModalOpen(false);
        setEditingTx(null);
        setAmount('');
        setNotes('');
        setServiceType('');
    };

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button onClick={onBack} className={`p-2 rounded-full ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                    <ArrowLeftIcon className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{client.fullName}</h1>
                    <p className={`text-sm ${subtleText}`}>{client.phone || 'Détails du client'}</p>
                </div>
            </div>

            {/* Balance Card */}
            <div className={`p-6 rounded-2xl border text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`text-sm font-medium mb-2 ${subtleText}`}>Solde Actuel</div>
                <div className={`text-4xl font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-lg text-gray-500">DZD</span>
                </div>
                <p className={`text-xs mt-2 ${subtleText}`}>
                    {balance < 0 ? "Le client vous doit de l'argent" : balance > 0 ? "Vous devez de l'argent au client" : "Compte soldé"}
                </p>
            </div>

            {/* Operations List */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Historique</h3>
                    <Button onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2">
                        <PlusIcon className="w-4 h-4" /> Opération
                    </Button>
                </div>

                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {transactions.length > 0 ? (
                        transactions.map(tx => (
                            <div key={tx.id}>
                                <SwipeableListItem
                                    onEdit={() => openEditModal(tx)}
                                    onDelete={() => onDeleteTransaction(tx.id)}
                                >
                                    <div className="p-4 flex items-center justify-between transition-colors">
                                        <div>
                                            <div className="font-bold text-sm">
                                                {tx.type === 'service' ? `Service: ${tx.serviceType || 'Autre'}` :
                                                    tx.type === 'payment_received' ? 'Règlement Reçu' :
                                                        tx.type === 'adjustment' ? 'Ajustement Solde' : 'Opération'}
                                            </div>
                                            <div className={`text-xs ${subtleText}`}>
                                                {tx.date} à {tx.time} • {tx.notes || 'Pas de notes'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className={`font-bold ${tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                </SwipeableListItem>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center opacity-50">Aucune opération.</div>
                    )}
                </div>
            </div>

            {/* New Transaction Modal */}
            <Dialog isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsTxModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{editingTx ? 'Modifier l\'Opération' : 'Nouvelle Opération'}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div>
                        <Label>Type d'Opération</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setTxType('service')}
                                className={`p-3 rounded-xl border font-bold text-sm transition-all ${txType === 'service' ? 'bg-indigo-600 text-white border-indigo-600' : `${fieldBase} opacity-70`}`}
                            >
                                Service / Vente
                            </button>
                            <button
                                onClick={() => setTxType('payment_received')}
                                className={`p-3 rounded-xl border font-bold text-sm transition-all ${txType === 'payment_received' ? 'bg-green-600 text-white border-green-600' : `${fieldBase} opacity-70`}`}
                            >
                                Règlement Reçu
                            </button>
                        </div>
                    </div>

                    {txType === 'service' && (
                        <div>
                            <Label>Type de Service</Label>
                            <Input value={serviceType} onChange={e => setServiceType(e.target.value)} className={fieldBase} placeholder="Ex: Conception, Impression..." />
                        </div>
                    )}

                    <div>
                        <Label>Montant (DZD)</Label>
                        <NumberInput value={amount} onChange={e => setAmount(e.target.value)} className={`${fieldBase} text-center text-2xl font-bold`} placeholder="0.00" />
                    </div>

                    {txType !== 'service' && (
                        <div>
                            <Label>Mode de Paiement</Label>
                            <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className={fieldBase}>
                                <option value="cash">Espèces</option>
                                <option value="baridi">BaridiMob</option>
                            </Select>
                        </div>
                    )}

                    <div>
                        <Label>Notes</Label>
                        <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={handleSaveTx} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">Confirmer</Button>
                </DialogFooter>
            </Dialog>
        </motion.div>
    );
}
