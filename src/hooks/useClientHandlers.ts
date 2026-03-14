import { useState } from 'react';
import { db, fieldValueDelete, type FirestoreDocumentReference } from '../firebase';
import { ClientDzd, ClientTransactionDzd, TreasuryTx } from '../types';
import { now, parseAndEvaluate } from '../utils';

type ClientDeleteMode = 'history' | 'blocked';

const CLIENT_DELETE_EPSILON = 0.01;

export function useClientHandlers(
    userDocRef: FirestoreDocumentReference,
    clientsDzd: ClientDzd[],
    clientTransactionsDzd: ClientTransactionDzd[],
    clientBalances: Map<string, number>,
    treasuryTransactions: TreasuryTx[],
    setAlert: (msg: string) => void
) {
    const [isSaving, setIsSaving] = useState(false);

    // Modal & Form State
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ClientDzd | null>(null);
    const [clientToDelete, setClientToDelete] = useState<ClientDzd | null>(null);
    const [clientDeleteMode, setClientDeleteMode] = useState<ClientDeleteMode | null>(null);

    const [clientFullName, setClientFullName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [initialBalance, setInitialBalance] = useState('');
    const [clientRedotpayId, setClientRedotpayId] = useState('');
    const [clientBinanceEmail, setClientBinanceEmail] = useState('');
    const [clientBalanceInput, setClientBalanceInput] = useState('');

    const openClientModal = (client: ClientDzd | null = null) => {
        setEditingClient(client);
        if (client) {
            setClientFullName(client.fullName || '');
            setClientPhone(client.phone || '');
            setClientRedotpayId(client.redotpayId || '');
            setClientBinanceEmail(client.binanceEmail || '');
            const currentBal = clientBalances.get(client.id) || 0;
            setClientBalanceInput(currentBal.toString());
            setInitialBalance('');
        } else {
            setClientFullName('');
            setClientPhone('');
            setClientRedotpayId('');
            setClientBinanceEmail('');
            setClientBalanceInput('');
            setInitialBalance('0');
        }
        setIsClientModalOpen(true);
    };

    const closeClientModal = () => {
        setIsClientModalOpen(false);
        setEditingClient(null);
    };

    const closeClientDeleteDialog = () => {
        setClientToDelete(null);
        setClientDeleteMode(null);
    };

    const handleSaveClient = async () => {
        if (!clientFullName.trim()) { setAlert('âš ï¸ Nom requis.'); return; }
        setIsSaving(true);
        try {
            const data: any = {
                fullName: clientFullName.trim(),
                phone: clientPhone.trim(),
                redotpayId: clientRedotpayId.trim(),
                binanceEmail: clientBinanceEmail.trim(),
                nom: clientFullName.trim()
            };

            if (editingClient) {
                await userDocRef.collection('dzd_clients').doc(editingClient.id).update(data);
                const currentBal = clientBalances.get(editingClient.id) || 0;
                const newBal = parseAndEvaluate(clientBalanceInput);
                if (!isNaN(newBal) && Math.abs(newBal - currentBal) > 0.01) {
                    const { date, time, timestamp } = now();
                    await userDocRef.collection('dzd_client_txs').add({
                        clientId: editingClient.id, timestamp, date, time,
                        montant: newBal - currentBal, type: 'Ajustement Solde',
                        notes: 'Mise Ã  jour manuelle du solde', paymentMethod: 'CrÃ©dit'
                    });
                }
                setAlert('âœ… Client modifiÃ©.');
            } else {
                const duplicate = clientsDzd.find(c =>
                    (data.fullName && c.fullName?.toLowerCase() === data.fullName.toLowerCase()) ||
                    (data.phone && c.phone === data.phone)
                );
                if (duplicate) { setAlert('âš ï¸ Ce client existe dÃ©jÃ .'); setIsSaving(false); return; }

                const ref = await userDocRef.collection('dzd_clients').add(data);
                const initBal = parseAndEvaluate(initialBalance);
                if (initBal !== 0 && !isNaN(initBal)) {
                    const { date, time, timestamp } = now();
                    await userDocRef.collection('dzd_client_txs').add({
                        clientId: ref.id, timestamp, date, time,
                        type: 'Solde Initial', montant: initBal, notes: 'Solde initial', paymentMethod: 'CrÃ©dit'
                    });
                }
                setAlert('âœ… Client ajoutÃ©.');
            }
            closeClientModal();
            return true;
        } catch (e) {
            console.error(e);
            setAlert('âŒ Erreur.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const findTransferCounterpart = (tx: ClientTransactionDzd) => {
        if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant') return null;

        const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
        const counterpartAmount = -tx.montant;
        const candidates = clientTransactionsDzd.filter((candidate) =>
            candidate.id !== tx.id
            && candidate.clientId !== tx.clientId
            && candidate.type === counterpartType
            && candidate.date === tx.date
            && candidate.time === tx.time
            && Math.abs(candidate.montant - counterpartAmount) <= CLIENT_DELETE_EPSILON
            && Math.abs(candidate.timestamp - tx.timestamp) <= 1
        );

        if (candidates.length === 0) return null;

        return [...candidates].sort(
            (left, right) => Math.abs(left.timestamp - tx.timestamp) - Math.abs(right.timestamp - tx.timestamp)
        )[0];
    };

    const commitDeleteRefs = async (deleteRefs: Array<{ collection: string; id: string }>) => {
        let batch = db.batch();
        let operationsCount = 0;

        for (const refInfo of deleteRefs) {
            batch.delete(userDocRef.collection(refInfo.collection).doc(refInfo.id));
            operationsCount += 1;

            if (operationsCount >= 400) {
                await batch.commit();
                batch = db.batch();
                operationsCount = 0;
            }
        }

        if (operationsCount > 0) {
            await batch.commit();
        }
    };

    const requestClientDelete = async (client: ClientDzd | null) => {
        if (!client || isSaving) return false;

        const balance = clientBalances.get(client.id) || 0;
        if (Math.abs(balance) > CLIENT_DELETE_EPSILON) {
            setClientToDelete(client);
            setClientDeleteMode('blocked');
            return false;
        }

        const clientHistory = clientTransactionsDzd.filter((tx) => tx.clientId === client.id);
        if (clientHistory.length === 0) {
            setIsSaving(true);
            try {
                await userDocRef.collection('dzd_clients').doc(client.id).delete();
                setAlert('Client supprime avec succes.');
                closeClientDeleteDialog();
                return true;
            } catch (e) {
                console.error(e);
                setAlert('Erreur lors de la suppression du client.');
                return false;
            } finally {
                setIsSaving(false);
            }
        }

        setClientToDelete(client);
        setClientDeleteMode('history');
        return false;
    };

    const handleDeleteClient = async () => {
        if (!clientToDelete || clientDeleteMode !== 'history' || isSaving) return false;

        setIsSaving(true);
        try {
            const clientTxIdsToDelete = new Set<string>();
            const treasuryTxIdsToDelete = new Set<string>();
            const treasuryTxIds = new Set(treasuryTransactions.map((tx) => tx.id));
            const clientHistory = clientTransactionsDzd.filter((tx) => tx.clientId === clientToDelete.id);

            for (const tx of clientHistory) {
                clientTxIdsToDelete.add(tx.id);

                const transferCounterpart = findTransferCounterpart(tx);
                if (transferCounterpart) {
                    clientTxIdsToDelete.add(transferCounterpart.id);
                }

                if (tx.linkedTxId && treasuryTxIds.has(tx.linkedTxId)) {
                    treasuryTxIdsToDelete.add(tx.linkedTxId);
                }
            }

            for (const treasuryTx of treasuryTransactions) {
                if (treasuryTx.linkedTxId && clientTxIdsToDelete.has(treasuryTx.linkedTxId)) {
                    treasuryTxIdsToDelete.add(treasuryTx.id);
                }
            }

            const deleteRefs: Array<{ collection: string; id: string }> = [
                { collection: 'dzd_clients', id: clientToDelete.id },
                ...Array.from(clientTxIdsToDelete, (id) => ({ collection: 'dzd_client_txs', id })),
                ...Array.from(treasuryTxIdsToDelete, (id) => ({ collection: 'treasury_txs', id }))
            ];

            await commitDeleteRefs(deleteRefs);
            setAlert('Client et historique supprimes avec succes.');
            closeClientDeleteDialog();
            return true;
        } catch (e) {
            console.error(e);
            setAlert('Erreur lors de la suppression de l historique du client.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    // Client Tx
    const [isClientTxModalOpen, setIsClientTxModalOpen] = useState(false);
    const [editingClientTx, setEditingClientTx] = useState<ClientTransactionDzd | null>(null);
    const [clientTxToDelete, setClientTxToDelete] = useState<ClientTransactionDzd | null>(null);
    const [clientTxAmount, setClientTxAmount] = useState('');
    const [clientTxType, setClientTxType] = useState('RÃ¨glement ReÃ§u');
    const [clientTxNotes, setClientTxNotes] = useState('');
    const [clientTxSource, setClientTxSource] = useState('Caisse');
    const [clientPaymentStatus, setClientPaymentStatus] = useState<'credit' | 'cash' | 'baridi'>('credit');
    const [linkedClientId, setLinkedClientId] = useState('none');

    // USDT/EUR related fields for client tx modal
    const [clientTxUsdtAmount, setClientTxUsdtAmount] = useState('');
    const [clientTxSellPrice, setClientTxSellPrice] = useState('');
    const [clientTxEurAmount, setClientTxEurAmount] = useState('');
    const [clientTxEurPrice, setClientTxEurPrice] = useState('');

    const openClientTxModal = (tx: ClientTransactionDzd | null = null, presetType?: string, selectedClientId?: string) => {
        setEditingClientTx(tx);
        if (tx) {
            setClientTxAmount(Math.abs(tx.montant).toString());
            setClientTxType(tx.type);
            setClientTxNotes(tx.notes || '');
            setClientTxSource(tx.paymentMethod === 'BaridiMob' ? 'BaridiMob' : 'Caisse');
            if (tx.paymentMethod === 'CrÃ©dit' || !tx.paymentMethod) setClientPaymentStatus('credit');
            else if (tx.paymentMethod === 'EspÃ¨ces') setClientPaymentStatus('cash');
            else if (tx.paymentMethod === 'BaridiMob') setClientPaymentStatus('baridi');

            setClientTxUsdtAmount('');
            setClientTxSellPrice('');
            setClientTxEurAmount('');
            setClientTxEurPrice('');
        } else {
            setClientTxAmount('');
            setClientTxType(presetType || 'RÃ¨glement ReÃ§u');
            setClientTxNotes('');
            setClientTxSource('Caisse');
            setClientPaymentStatus('credit');
            setLinkedClientId(selectedClientId || 'none');

            setClientTxUsdtAmount('');
            setClientTxSellPrice('');
            setClientTxEurAmount('');
            setClientTxEurPrice('');
        }
        setIsClientTxModalOpen(true);
    };

    const handleSaveClientTx = async (selectedClientId: string | null) => {
        const targetClientId = linkedClientId !== 'none' ? linkedClientId : selectedClientId;
        if (!targetClientId || targetClientId === 'none') { setAlert('âš ï¸ Veuillez sÃ©lectionner un client.'); return; }
        const amount = parseAndEvaluate(clientTxAmount);
        if (isNaN(amount)) { setAlert('âš ï¸ Montant invalide.'); return; }

        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();
            const paymentMethodMap = { credit: 'CrÃ©dit', cash: 'EspÃ¨ces', baridi: 'BaridiMob' };
            const montant = (clientTxType === 'RÃ¨glement ReÃ§u') ? amount : -amount;
            const paymentMethod = paymentMethodMap[clientPaymentStatus];

            if (editingClientTx) {
                batch.update(userDocRef.collection('dzd_client_txs').doc(editingClientTx.id), {
                    montant, notes: clientTxNotes.trim(), paymentMethod, date, time, timestamp
                });

                if (editingClientTx.linkedTxId) {
                    const treasuryRef = userDocRef.collection('treasury_txs').doc(editingClientTx.linkedTxId);
                    if (clientPaymentStatus === 'credit') {
                        batch.delete(treasuryRef);
                        batch.update(userDocRef.collection('dzd_client_txs').doc(editingClientTx.id), { linkedTxId: fieldValueDelete() });
                    } else {
                        const tType = (clientTxType === 'RÃ¨glement ReÃ§u') ? 'Ajout' : 'Retrait';
                        batch.update(treasuryRef, {
                            amount, type: tType, source: clientPaymentStatus === 'cash' ? 'Caisse' : 'BaridiMob',
                            notes: `Client: ${clientFullName} - ${clientTxNotes.trim()}`, date, time, timestamp
                        });
                    }
                } else if (clientPaymentStatus !== 'credit') {
                    const treasuryRef = userDocRef.collection('treasury_txs').doc();
                    const tType = (clientTxType === 'RÃ¨glement ReÃ§u') ? 'Ajout' : 'Retrait';
                    batch.set(treasuryRef, {
                        timestamp, date, time, type: tType, source: clientPaymentStatus === 'cash' ? 'Caisse' : 'BaridiMob',
                        amount, notes: `Client: ${clientFullName} - ${clientTxNotes.trim()}`, linkedTxId: editingClientTx.id, origin: 'client_tx'
                    });
                    batch.update(userDocRef.collection('dzd_client_txs').doc(editingClientTx.id), { linkedTxId: treasuryRef.id });
                }

                setAlert('âœ… Transaction mise Ã  jour.');
            } else {
                const clientTxRef = userDocRef.collection('dzd_client_txs').doc();
                batch.set(clientTxRef, {
                    clientId: targetClientId, timestamp, date, time,
                    montant, type: clientTxType, notes: clientTxNotes.trim(),
                    paymentMethod
                });

                if (clientPaymentStatus !== 'credit') {
                    const treasuryRef = userDocRef.collection('treasury_txs').doc();
                    const tType = (clientTxType === 'RÃ¨glement ReÃ§u') ? 'Ajout' : 'Retrait';
                    batch.set(treasuryRef, {
                        timestamp, date, time, type: tType, source: clientPaymentStatus === 'cash' ? 'Caisse' : 'BaridiMob',
                        amount, notes: `Client: ${clientFullName} - ${clientTxNotes.trim()}`, linkedTxId: clientTxRef.id, origin: 'client_tx'
                    });
                    batch.update(clientTxRef, { linkedTxId: treasuryRef.id });
                }
                setAlert('âœ… Transaction ajoutÃ©e.');
            }
            await batch.commit();
            setIsClientTxModalOpen(false);
            setEditingClientTx(null);
            return true;
        } catch (e) { setAlert('âŒ Erreur.'); return false; } finally { setIsSaving(false); }
    };

    const handleDeleteClientTx = async (applyTransactionDelete: Function) => {
        if (!clientTxToDelete) return;
        if (clientTxToDelete.origin === 'adjustment') {
            setAlert('âš ï¸ Impossible de supprimer : Transaction liÃ©e Ã  un ajustement.');
            setClientTxToDelete(null);
            return;
        }
        setIsSaving(true);
        try {
            const result = await applyTransactionDelete(clientTxToDelete.id, 'client_tx', userDocRef);
            if (result.success) setAlert('âœ… SupprimÃ©.');
            else setAlert('âŒ Erreur.');
        } catch (e) { setAlert('âŒ Erreur.'); } finally { setIsSaving(false); setClientTxToDelete(null); }
    };

    return {
        isSaving, isClientModalOpen, setIsClientModalOpen, editingClient, setEditingClient, clientToDelete, clientDeleteMode,
        clientFullName, setClientFullName, clientPhone, setClientPhone,
        initialBalance, setInitialBalance, clientRedotpayId, setClientRedotpayId,
        clientBinanceEmail, setClientBinanceEmail, clientBalanceInput, setClientBalanceInput,
        openClientModal, closeClientModal, requestClientDelete, closeClientDeleteDialog, handleSaveClient, handleDeleteClient,
        isClientTxModalOpen, setIsClientTxModalOpen, editingClientTx, setEditingClientTx,
        clientTxToDelete, setClientTxToDelete, clientTxAmount, setClientTxAmount,
        clientTxType, setClientTxType, clientTxNotes, setClientTxNotes,
        clientTxSource, setClientTxSource, clientPaymentStatus, setClientPaymentStatus,
        linkedClientId, setLinkedClientId, openClientTxModal, handleSaveClientTx, handleDeleteClientTx,
        clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice,
        clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice
    };
}
