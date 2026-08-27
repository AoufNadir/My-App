import { useMemo, useState } from 'react';
import { ManualAssetClient, ManualAssetTransaction } from '../types';
type TransactionType = 'service' | 'payment_received';
type PaymentMethod = 'cash' | 'baridi' | 'credit';
type UseManualClientTransactionManagerArgs = {
    client: ManualAssetClient;
    transactions: ManualAssetTransaction[];
    onAddTransaction: (data: Omit<ManualAssetTransaction, 'id'>) => void;
    onUpdateTransaction: (txId: string, data: Omit<ManualAssetTransaction, 'id'>) => void;
};
function parsePositiveAmount(value: string): number | null {
    const normalized = value.replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return null;
    return parsed;
}
export function useManualClientTransactionManager({ client, transactions, onAddTransaction, onUpdateTransaction }: UseManualClientTransactionManagerArgs) {
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<ManualAssetTransaction | null>(null);
    const [txType, setTxType] = useState<TransactionType>('service');
    const [amount, setAmount] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [notes, setNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const orderedTransactions = useMemo(() => [...transactions].sort((a, b) => b.timestamp - a.timestamp), [transactions]);
    const resetTransactionForm = () => {
        setEditingTx(null);
        setTxType('service');
        setAmount('');
        setServiceType('');
        setNotes('');
        setPaymentMethod('cash');
    };
    const closeTransactionModal = () => {
        setIsTxModalOpen(false);
        resetTransactionForm();
    };
    const openCreateModal = () => {
        resetTransactionForm();
        setIsTxModalOpen(true);
    };
    const openEditModal = (tx: ManualAssetTransaction) => {
        setEditingTx(tx);
        setTxType(tx.type as TransactionType);
        setAmount(Math.abs(tx.amount).toString());
        setNotes(tx.notes || '');
        setServiceType(tx.type === 'service' ? (tx.serviceType || '') : '');
        setPaymentMethod((tx.paymentMethod || 'cash') as PaymentMethod);
        setIsTxModalOpen(true);
    };
    const handleSaveTx = () => {
        const parsedAmount = parsePositiveAmount(amount);
        if (!parsedAmount)
            return;
        const signedAmount = txType === 'service' ? -parsedAmount : parsedAmount;
        const now = new Date();
        const payload: Omit<ManualAssetTransaction, 'id'> = {
            actifId: client.assetId,
            clientId: client.id,
            type: txType,
            amount: signedAmount,
            date: editingTx ? editingTx.date : now.toLocaleDateString('fr-FR'),
            time: editingTx ? editingTx.time : now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: editingTx ? editingTx.timestamp : now.getTime(),
            notes
        };
        if (txType === 'service') {
            payload.serviceType = serviceType;
        }
        else {
            payload.paymentMethod = paymentMethod;
        }
        if (editingTx) {
            onUpdateTransaction(editingTx.id, payload);
        }
        else {
            onAddTransaction(payload);
        }
        closeTransactionModal();
    };
    return {
        orderedTransactions,
        isTxModalOpen,
        editingTx,
        txType,
        setTxType,
        amount,
        setAmount,
        serviceType,
        setServiceType,
        notes,
        setNotes,
        paymentMethod,
        setPaymentMethod,
        openCreateModal,
        openEditModal,
        closeTransactionModal,
        handleSaveTx
    };
}
