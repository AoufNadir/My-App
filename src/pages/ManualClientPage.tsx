import React from 'react';
import { ManualAssetClient, ManualAssetTransaction } from '../types';
import { ManualClientTransactionsPanel } from '../components/manual-client/ManualClientTransactionsPanel';
import { ManualClientTransactionDialog } from '../components/manual-client/ManualClientTransactionDialog';
import { ManualClientHeaderStats } from '../components/manual-client/ManualClientHeaderStats';
import { useManualClientTransactionManager } from '../hooks/useManualClientTransactionManager';
type ManualClientPageProps = {
    client: ManualAssetClient;
    transactions: ManualAssetTransaction[];
    balance: number;
    onBack: () => void;
    onAddTransaction: (data: Omit<ManualAssetTransaction, 'id'>) => void;
    onUpdateTransaction: (txId: string, data: Omit<ManualAssetTransaction, 'id'>) => void;
    onDeleteTransaction: (txId: string) => void;
};
export function ManualClientPage({ client, transactions, balance, onBack, onAddTransaction, onUpdateTransaction, onDeleteTransaction }: ManualClientPageProps) {
    const { orderedTransactions, isTxModalOpen, editingTx, txType, setTxType, amount, setAmount, serviceType, setServiceType, notes, setNotes, paymentMethod, setPaymentMethod, openCreateModal, openEditModal, closeTransactionModal, handleSaveTx } = useManualClientTransactionManager({
        client,
        transactions,
        onAddTransaction,
        onUpdateTransaction
    });
    return (<div className="anim-page-in space-y-4">
      <ManualClientHeaderStats clientName={client.fullName} clientPhone={client.phone} balance={balance} onBack={onBack}/>
      <ManualClientTransactionsPanel orderedTransactions={orderedTransactions} onOpenCreateModal={openCreateModal} onOpenEditModal={openEditModal} onDeleteTransaction={onDeleteTransaction}/>
      <ManualClientTransactionDialog isTxModalOpen={isTxModalOpen} editingTx={editingTx} txType={txType} setTxType={setTxType} amount={amount} setAmount={setAmount} serviceType={serviceType} setServiceType={setServiceType} notes={notes} setNotes={setNotes} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} currentBalance={balance} onClose={closeTransactionModal} onSave={handleSaveTx}/>
    </div>);
}
