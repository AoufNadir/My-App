import { useState } from 'react';
import { db, fieldValueDelete, type FirestoreDocumentReference } from '../firebase';
import { ClientDzd, ClientTransactionDzd } from '../types';
import { now, parseAndEvaluate } from '../utils';

export function useClientHandlers(
    userDocRef: FirestoreDocumentReference,
    clientsDzd: ClientDzd[],
    clientBalances: Map<string, number>,
    setAlert: (msg: string) => void
) {
    const [isSaving, setIsSaving] = useState(false);

    // Modal & Form State
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ClientDzd | null>(null);
    const [clientToDelete, setClientToDelete] = useState<ClientDzd | null>(null);

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

    const handleSaveClient = async () => {
        if (!clientFullName.trim()) { setAlert('⚠️ Nom requis.'); return; }
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
                        notes: 'Mise à jour manuelle du solde', paymentMethod: 'Crédit'
                    });
                }
                setAlert('✅ Client modifié.');
            } else {
                const duplicate = clientsDzd.find(c =>
                    (data.fullName && c.fullName?.toLowerCase() === data.fullName.toLowerCase()) ||
                    (data.phone && c.phone === data.phone)
                );
                if (duplicate) { setAlert('⚠️ Ce client existe déjà.'); setIsSaving(false); return; }

                const ref = await userDocRef.collection('dzd_clients').add(data);
                const initBal = parseAndEvaluate(initialBalance);
                if (initBal !== 0 && !isNaN(initBal)) {
                    const { date, time, timestamp } = now();
                    await userDocRef.collection('dzd_client_txs').add({
                        clientId: ref.id, timestamp, date, time,
                        type: 'Solde Initial', montant: initBal, notes: 'Solde initial', paymentMethod: 'Crédit'
                    });
                }
                setAlert('✅ Client ajouté.');
            }
            closeClientModal();
            return true;
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClient = async (clientId: string) => {
        const bal = clientBalances.get(clientId) || 0;
        if (Math.abs(bal) > 0.01) {
            setAlert("⚠️ Impossible de supprimer : Solde non nul.");
            return;
        }
        try {
            await userDocRef.collection('dzd_clients').doc(clientId).delete();
            setAlert('✅ Client supprimé.');
            setClientToDelete(null);
            return true;
        } catch (e) {
            setAlert('❌ Erreur.');
            return false;
        }
    };

    // Client Tx
    const [isClientTxModalOpen, setIsClientTxModalOpen] = useState(false);
    const [editingClientTx, setEditingClientTx] = useState<ClientTransactionDzd | null>(null);
    const [clientTxToDelete, setClientTxToDelete] = useState<ClientTransactionDzd | null>(null);
    const [clientTxAmount, setClientTxAmount] = useState('');
    const [clientTxType, setClientTxType] = useState('Règlement Reçu');
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
            if (tx.paymentMethod === 'Crédit' || !tx.paymentMethod) setClientPaymentStatus('credit');
            else if (tx.paymentMethod === 'Espèces') setClientPaymentStatus('cash');
            else if (tx.paymentMethod === 'BaridiMob') setClientPaymentStatus('baridi');

            setClientTxUsdtAmount('');
            setClientTxSellPrice('');
            setClientTxEurAmount('');
            setClientTxEurPrice('');
        } else {
            setClientTxAmount('');
            setClientTxType(presetType || 'Règlement Reçu');
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
        if (!targetClientId || targetClientId === 'none') { setAlert('⚠️ Veuillez sélectionner un client.'); return; }
        const amount = parseAndEvaluate(clientTxAmount);
        if (isNaN(amount)) { setAlert('⚠️ Montant invalide.'); return; }

        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();
            const paymentMethodMap = { credit: 'Crédit', cash: 'Espèces', baridi: 'BaridiMob' };
            const montant = (clientTxType === 'Règlement Reçu') ? amount : -amount;
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
                        const tType = (clientTxType === 'Règlement Reçu') ? 'Ajout' : 'Retrait';
                        batch.update(treasuryRef, {
                            amount, type: tType, source: clientPaymentStatus === 'cash' ? 'Caisse' : 'BaridiMob',
                            notes: `Client: ${clientFullName} - ${clientTxNotes.trim()}`, date, time, timestamp
                        });
                    }
                } else if (clientPaymentStatus !== 'credit') {
                    const treasuryRef = userDocRef.collection('treasury_txs').doc();
                    const tType = (clientTxType === 'Règlement Reçu') ? 'Ajout' : 'Retrait';
                    batch.set(treasuryRef, {
                        timestamp, date, time, type: tType, source: clientPaymentStatus === 'cash' ? 'Caisse' : 'BaridiMob',
                        amount, notes: `Client: ${clientFullName} - ${clientTxNotes.trim()}`, linkedTxId: editingClientTx.id, origin: 'client_tx'
                    });
                    batch.update(userDocRef.collection('dzd_client_txs').doc(editingClientTx.id), { linkedTxId: treasuryRef.id });
                }

                setAlert('✅ Transaction mise à jour.');
            } else {
                const clientTxRef = userDocRef.collection('dzd_client_txs').doc();
                batch.set(clientTxRef, {
                    clientId: targetClientId, timestamp, date, time,
                    montant, type: clientTxType, notes: clientTxNotes.trim(),
                    paymentMethod
                });

                if (clientPaymentStatus !== 'credit') {
                    const treasuryRef = userDocRef.collection('treasury_txs').doc();
                    const tType = (clientTxType === 'Règlement Reçu') ? 'Ajout' : 'Retrait';
                    batch.set(treasuryRef, {
                        timestamp, date, time, type: tType, source: clientPaymentStatus === 'cash' ? 'Caisse' : 'BaridiMob',
                        amount, notes: `Client: ${clientFullName} - ${clientTxNotes.trim()}`, linkedTxId: clientTxRef.id, origin: 'client_tx'
                    });
                    batch.update(clientTxRef, { linkedTxId: treasuryRef.id });
                }
                setAlert('✅ Transaction ajoutée.');
            }
            await batch.commit();
            setIsClientTxModalOpen(false);
            setEditingClientTx(null);
            return true;
        } catch (e) { setAlert('❌ Erreur.'); return false; } finally { setIsSaving(false); }
    };

    const handleDeleteClientTx = async (applyTransactionDelete: Function) => {
        if (!clientTxToDelete) return;
        if (clientTxToDelete.origin === 'adjustment') {
            setAlert('⚠️ Impossible de supprimer : Transaction liée à un ajustement.');
            setClientTxToDelete(null);
            return;
        }
        setIsSaving(true);
        try {
            const result = await applyTransactionDelete(clientTxToDelete.id, 'client_tx', userDocRef);
            if (result.success) setAlert('✅ Supprimé.');
            else setAlert('❌ Erreur.');
        } catch (e) { setAlert('❌ Erreur.'); } finally { setIsSaving(false); setClientTxToDelete(null); }
    };

    return {
        isSaving, isClientModalOpen, setIsClientModalOpen, editingClient, setEditingClient, clientToDelete, setClientToDelete,
        clientFullName, setClientFullName, clientPhone, setClientPhone,
        initialBalance, setInitialBalance, clientRedotpayId, setClientRedotpayId,
        clientBinanceEmail, setClientBinanceEmail, clientBalanceInput, setClientBalanceInput,
        openClientModal, closeClientModal, handleSaveClient, handleDeleteClient,
        isClientTxModalOpen, setIsClientTxModalOpen, editingClientTx, setEditingClientTx,
        clientTxToDelete, setClientTxToDelete, clientTxAmount, setClientTxAmount,
        clientTxType, setClientTxType, clientTxNotes, setClientTxNotes,
        clientTxSource, setClientTxSource, clientPaymentStatus, setClientPaymentStatus,
        linkedClientId, setLinkedClientId, openClientTxModal, handleSaveClientTx, handleDeleteClientTx,
        clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice,
        clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice
    };
}
