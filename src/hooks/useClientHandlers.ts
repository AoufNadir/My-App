import { useState } from 'react';
import { db, fieldValueDelete, type FirestoreDocumentReference } from '../firebase';
import { ClientDzd, ClientTransactionDzd, Investor, TreasuryTx } from '../types';
import { now, parseAndEvaluate } from '../utils';
import { normalizeLedgerLabel } from '../utils/financialUx';
type ClientDeleteMode = 'history' | 'balance_only' | 'client_only_cleanup' | 'blocked';
const CLIENT_DELETE_EPSILON = 0.01;
const CLIENT_TX_PAYMENT_RECEIVED = 'Règlement Reçu';
const CLIENT_TX_PAYMENT_MADE = 'Paiement Effectué';
const normalizeClientTxType = (value: string) => {
    const normalized = normalizeLedgerLabel(value || '');
    if (normalized === CLIENT_TX_PAYMENT_RECEIVED)
        return CLIENT_TX_PAYMENT_RECEIVED;
    if (normalized === CLIENT_TX_PAYMENT_MADE)
        return CLIENT_TX_PAYMENT_MADE;
    return normalized;
};
const normalizeForDeleteCheck = (value: string | undefined) => (normalizeLedgerLabel(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim());
const normalizePersonName = (value: string | undefined) => ((value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim());
const getClientNameForMatching = (client: ClientDzd) => (client.fullName || [client.nom, client.prenom].filter(Boolean).join(' '));
export function useClientHandlers(userDocRef: FirestoreDocumentReference, clientsDzd: ClientDzd[], clientTransactionsDzd: ClientTransactionDzd[], clientBalances: Map<string, number>, treasuryTransactions: TreasuryTx[], treasuryStats: {
    caisse: number;
    baridi: number;
}, investors: Investor[], setAlert: (msg: string) => void) {
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
    const [clientNotes, setClientNotes] = useState('');
    const [clientCreditLimit, setClientCreditLimit] = useState('');
    const [clientGroup, setClientGroup] = useState('');
    const [clientBalanceInput, setClientBalanceInput] = useState('');
    const [clientIsFournisseur, setClientIsFournisseur] = useState(false);
    const openClientModal = (client: ClientDzd | null = null) => {
        setEditingClient(client);
        if (client) {
            setClientFullName(client.fullName || '');
            setClientPhone(client.phone || '');
            setClientRedotpayId(client.redotpayId || '');
            setClientBinanceEmail(client.binanceEmail || '');
            setClientNotes(client.notes || '');
            setClientCreditLimit(client.creditLimit ? String(client.creditLimit) : '');
            setClientGroup(client.group || '');
            setClientIsFournisseur(client.isFournisseur || false);
            const currentBal = clientBalances.get(client.id) || 0;
            setClientBalanceInput(currentBal.toString());
            setInitialBalance('');
        }
        else {
            setClientFullName('');
            setClientPhone('');
            setClientRedotpayId('');
            setClientBinanceEmail('');
            setClientNotes('');
            setClientCreditLimit('');
            setClientGroup('');
            setClientIsFournisseur(false);
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
        if (!clientFullName.trim()) {
            setAlert('⚠️ Nom requis.');
            return;
        }
        setIsSaving(true);
        try {
            const parsedLimit = parseFloat(clientCreditLimit) || 0;
            const data: any = {
                fullName: clientFullName.trim(),
                phone: clientPhone.trim(),
                redotpayId: clientRedotpayId.trim(),
                binanceEmail: clientBinanceEmail.trim(),
                notes: clientNotes.trim() || null,
                creditLimit: parsedLimit > 0 ? parsedLimit : null,
                group: clientGroup.trim() || null,
                isFournisseur: clientIsFournisseur || null,
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
            }
            else {
                const duplicate = clientsDzd.find(c => (data.fullName && c.fullName?.toLowerCase() === data.fullName.toLowerCase()) ||
                    (data.phone && c.phone === data.phone));
                if (duplicate) {
                    setAlert('⚠️ Ce client existe déjà.');
                    setIsSaving(false);
                    return;
                }
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
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const findTransferCounterpart = (tx: ClientTransactionDzd) => {
        if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant')
            return null;
        const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
        const counterpartAmount = -tx.montant;
        const candidates = clientTransactionsDzd.filter((candidate) => candidate.id !== tx.id
            && candidate.clientId !== tx.clientId
            && candidate.type === counterpartType
            && candidate.date === tx.date
            && candidate.time === tx.time
            && Math.abs(candidate.montant - counterpartAmount) <= CLIENT_DELETE_EPSILON
            && Math.abs(candidate.timestamp - tx.timestamp) <= 1);
        if (candidates.length === 0)
            return null;
        return [...candidates].sort((left, right) => Math.abs(left.timestamp - tx.timestamp) - Math.abs(right.timestamp - tx.timestamp))[0];
    };
    const isBalanceOnlyClientHistory = (clientHistory: ClientTransactionDzd[]) => {
        if (clientHistory.length === 0)
            return false;
        const treasuryLinkedClientTxIds = new Set(treasuryTransactions
            .map((tx) => tx.linkedTxId)
            .filter((id): id is string => Boolean(id)));
        const businessTypes = new Set([
            'reglement recu',
            'paiement effectue',
            'vente usdt',
            'vente eur',
            'achat eur',
            'transfert entrant',
            'transfert sortant'
        ]);
        return clientHistory.every((tx) => {
            if (tx.linkedTxId || treasuryLinkedClientTxIds.has(tx.id))
                return false;
            const type = normalizeForDeleteCheck(tx.type);
            const notes = normalizeForDeleteCheck(tx.notes);
            if (businessTypes.has(type))
                return false;
            return type.includes('solde')
                || type.includes('initial')
                || type.includes('ajustement')
                || type.includes('adjustment')
                || type.includes('balance')
                || notes.includes('solde initial')
                || notes.includes('mise a jour manuelle')
                || notes.includes('import csv');
        });
    };
    const isDuplicateInvestorClient = (client: ClientDzd) => {
        const clientName = normalizePersonName(getClientNameForMatching(client));
        if (!clientName)
            return false;
        return investors.some((investor) => normalizePersonName(investor.name) === clientName);
    };
    const commitDeleteRefs = async (deleteRefs: Array<{
        collection: string;
        id: string;
    }>) => {
        let batch = db.batch();
        let operationsCount = 0;
        const flushIfNeeded = async () => {
            if (operationsCount < 400)
                return;
            await batch.commit();
            batch = db.batch();
            operationsCount = 0;
        };
        for (const refInfo of deleteRefs) {
            batch.delete(userDocRef.collection(refInfo.collection).doc(refInfo.id));
            operationsCount += 1;
            await flushIfNeeded();
        }
        if (operationsCount > 0) {
            await batch.commit();
        }
    };
    const requestClientDelete = async (client: ClientDzd | null) => {
        if (!client || isSaving)
            return false;
        const balance = clientBalances.get(client.id) || 0;
        const clientHistory = clientTransactionsDzd.filter((tx) => tx.clientId === client.id);
        if (Math.abs(balance) > CLIENT_DELETE_EPSILON) {
            setClientToDelete(client);
            setClientDeleteMode(isBalanceOnlyClientHistory(clientHistory)
                ? 'balance_only'
                : isDuplicateInvestorClient(client)
                    ? 'client_only_cleanup'
                    : 'blocked');
            return false;
        }
        if (clientHistory.length === 0) {
            setIsSaving(true);
            try {
                await commitDeleteRefs([{ collection: 'dzd_clients', id: client.id }]);
                setAlert('Client supprime avec succes.');
                closeClientDeleteDialog();
                return true;
            }
            catch (e) {
                console.error(e);
                setAlert('Erreur lors de la suppression du client.');
                return false;
            }
            finally {
                setIsSaving(false);
            }
        }
        setClientToDelete(client);
        setClientDeleteMode('history');
        return false;
    };
    const handleDeleteClient = async () => {
        if (!clientToDelete || clientDeleteMode === 'blocked' || isSaving)
            return false;
        setIsSaving(true);
        try {
            const clientTxIdsToDelete = new Set<string>();
            const treasuryTxIdsToDelete = new Set<string>();
            const treasuryTxIds = new Set(treasuryTransactions.map((tx) => tx.id));
            const clientHistory = clientTransactionsDzd.filter((tx) => tx.clientId === clientToDelete.id);
            if (clientDeleteMode === 'client_only_cleanup') {
                await commitDeleteRefs([
                    { collection: 'dzd_clients', id: clientToDelete.id },
                    ...clientHistory.map((tx) => ({ collection: 'dzd_client_txs', id: tx.id }))
                ]);
                setAlert('Client supprime des clients quotidiens seulement.');
                closeClientDeleteDialog();
                return true;
            }
            if (clientDeleteMode === 'balance_only' && !isBalanceOnlyClientHistory(clientHistory)) {
                setClientDeleteMode('blocked');
                setAlert("Suppression bloquee: ce client contient maintenant une operation liee.");
                return false;
            }
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
            const deleteRefs: Array<{
                collection: string;
                id: string;
            }> = [
                { collection: 'dzd_clients', id: clientToDelete.id },
                ...Array.from(clientTxIdsToDelete, (id) => ({ collection: 'dzd_client_txs', id })),
                ...Array.from(treasuryTxIdsToDelete, (id) => ({ collection: 'treasury_txs', id }))
            ];
            await commitDeleteRefs(deleteRefs);
            setAlert('Client et historique supprimes avec succes.');
            closeClientDeleteDialog();
            return true;
        }
        catch (e) {
            console.error(e);
            setAlert('Erreur lors de la suppression de l historique du client.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    // Client Tx
    const [isClientTxModalOpen, setIsClientTxModalOpen] = useState(false);
    const [editingClientTx, setEditingClientTx] = useState<ClientTransactionDzd | null>(null);
    const [clientTxToDelete, setClientTxToDelete] = useState<ClientTransactionDzd | null>(null);
    const [clientTxAmount, setClientTxAmount] = useState('');
    const [clientTxType, setClientTxType] = useState(CLIENT_TX_PAYMENT_RECEIVED);
    const [clientTxNotes, setClientTxNotes] = useState('');
    const [clientTxSource, setClientTxSource] = useState('Caisse');
    const [clientPaymentStatus, setClientPaymentStatus] = useState<'credit' | 'cash' | 'baridi'>('cash');
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
            setClientTxType(normalizeClientTxType(tx.type));
            setClientTxNotes(tx.notes || '');
            const existingPaymentMethod = tx.paymentMethod as string | undefined;
            setClientTxSource(existingPaymentMethod === 'BaridiMob' ? 'BaridiMob' : 'Caisse');
            if (existingPaymentMethod === 'Crédit' || existingPaymentMethod === 'CrÃ©dit' || !existingPaymentMethod)
                setClientPaymentStatus('cash');
            else if (existingPaymentMethod === 'Espèces' || existingPaymentMethod === 'EspÃ¨ces')
                setClientPaymentStatus('cash');
            else if (existingPaymentMethod === 'BaridiMob')
                setClientPaymentStatus('baridi');
            setClientTxUsdtAmount('');
            setClientTxSellPrice('');
            setClientTxEurAmount('');
            setClientTxEurPrice('');
        }
        else {
            setClientTxAmount('');
            setClientTxType(normalizeClientTxType(presetType || CLIENT_TX_PAYMENT_RECEIVED));
            setClientTxNotes('');
            setClientTxSource('Caisse');
            setClientPaymentStatus('cash');
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
        if (!targetClientId || targetClientId === 'none') {
            setAlert('⚠️ Veuillez sélectionner un client.');
            return;
        }
        const amount = parseAndEvaluate(clientTxAmount);
        const targetClientName = clientsDzd.find((client) => client.id === targetClientId)?.fullName
            || clientFullName.trim()
            || 'Client';
        if (isNaN(amount)) {
            setAlert('⚠️ Montant invalide.');
            return;
        }
        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();
            const paymentMethodMap = { credit: 'Crédit', cash: 'Espèces', baridi: 'BaridiMob' };
            const normalizedClientTxType = normalizeClientTxType(clientTxType);
            const isPaymentReceived = normalizedClientTxType === CLIENT_TX_PAYMENT_RECEIVED;
            const isClientSettlementTx = normalizedClientTxType === CLIENT_TX_PAYMENT_RECEIVED || normalizedClientTxType === CLIENT_TX_PAYMENT_MADE;
            const effectiveClientPaymentStatus = isClientSettlementTx && clientPaymentStatus === 'credit' ? 'cash' : clientPaymentStatus;
            if ((normalizedClientTxType === CLIENT_TX_PAYMENT_RECEIVED || normalizedClientTxType === CLIENT_TX_PAYMENT_MADE) && amount <= 0) {
                setAlert('⚠️ Entrez un montant positif.');
                return;
            }
            const montant = isPaymentReceived ? amount : -amount;
            const paymentMethod = paymentMethodMap[effectiveClientPaymentStatus];
            const walletSource = effectiveClientPaymentStatus === 'cash' ? 'Caisse' : 'BaridiMob';
            const treasuryTxType = isPaymentReceived ? 'Ajout' : 'Retrait';
            if (effectiveClientPaymentStatus !== 'credit' && !isPaymentReceived) {
                const linkedTreasuryTx = editingClientTx?.linkedTxId
                    ? treasuryTransactions.find(tx => tx.id === editingClientTx.linkedTxId)
                    : null;
                const currentWalletBalance = walletSource === 'Caisse'
                    ? Number(treasuryStats?.caisse || 0)
                    : Number(treasuryStats?.baridi || 0);
                const existingLinkedEffect = linkedTreasuryTx?.source === walletSource
                    ? (linkedTreasuryTx.type === 'Ajout' || linkedTreasuryTx.type === 'Adjustment (+)'
                        ? Number(linkedTreasuryTx.amount || 0)
                        : linkedTreasuryTx.type === 'Retrait' || linkedTreasuryTx.type === 'Adjustment (-)'
                            ? -Number(linkedTreasuryTx.amount || 0)
                            : 0)
                    : 0;
                const editableWalletBalance = currentWalletBalance - existingLinkedEffect;
                if (amount > editableWalletBalance + CLIENT_DELETE_EPSILON) {
                    setAlert(walletSource === 'Caisse' ? '⚠️ Solde Caisse insuffisant.' : '⚠️ Solde BaridiMob insuffisant.');
                    return;
                }
            }
            if (editingClientTx) {
                const clientTxRef = userDocRef.collection('dzd_client_txs').doc(editingClientTx.id);
                const clientTxPayload: any = {
                    montant, type: normalizedClientTxType, notes: clientTxNotes.trim(), paymentMethod, date, time, timestamp
                };
                if (editingClientTx.linkedTxId) {
                    const treasuryRef = userDocRef.collection('treasury_txs').doc(editingClientTx.linkedTxId);
                    if (effectiveClientPaymentStatus === 'credit') {
                        batch.delete(treasuryRef);
                        clientTxPayload.linkedTxId = fieldValueDelete();
                    }
                    else {
                        batch.update(treasuryRef, {
                            amount, type: treasuryTxType, source: walletSource,
                            notes: `Client: ${targetClientName} - ${clientTxNotes.trim()}`, date, time, timestamp, origin: 'client_tx'
                        });
                    }
                }
                else if (effectiveClientPaymentStatus !== 'credit') {
                    const treasuryRef = userDocRef.collection('treasury_txs').doc();
                    clientTxPayload.linkedTxId = treasuryRef.id;
                    batch.set(treasuryRef, {
                        timestamp, date, time, type: treasuryTxType, source: walletSource,
                        amount, notes: `Client: ${targetClientName} - ${clientTxNotes.trim()}`, linkedTxId: editingClientTx.id, origin: 'client_tx'
                    });
                }
                batch.update(clientTxRef, clientTxPayload);
                setAlert('✅ Transaction mise à jour.');
            }
            else {
                const clientTxRef = userDocRef.collection('dzd_client_txs').doc();
                const clientTxPayload: any = {
                    clientId: targetClientId, timestamp, date, time,
                    montant, type: normalizedClientTxType, notes: clientTxNotes.trim(),
                    paymentMethod
                };
                if (effectiveClientPaymentStatus !== 'credit') {
                    const treasuryRef = userDocRef.collection('treasury_txs').doc();
                    clientTxPayload.linkedTxId = treasuryRef.id;
                    batch.set(treasuryRef, {
                        timestamp, date, time, type: treasuryTxType, source: walletSource,
                        amount, notes: `Client: ${targetClientName} - ${clientTxNotes.trim()}`, linkedTxId: clientTxRef.id, origin: 'client_tx'
                    });
                }
                batch.set(clientTxRef, clientTxPayload);
                setAlert('✅ Transaction ajoutée.');
            }
            await batch.commit();
            setIsClientTxModalOpen(false);
            setEditingClientTx(null);
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeleteClientTx = async (applyTransactionDelete: Function) => {
        if (!clientTxToDelete)
            return;
        setIsSaving(true);
        try {
            const result = await applyTransactionDelete(clientTxToDelete.id, 'client_tx', userDocRef);
            if (result.success)
                setAlert('✅ Supprimé.');
            else
                setAlert('❌ Erreur.');
        }
        catch (e) {
            setAlert('❌ Erreur.');
        }
        finally {
            setIsSaving(false);
            setClientTxToDelete(null);
        }
    };
    // Zero out a small residual balance — creates an audit entry without touching treasury
    const handleZeroOutBalance = async (clientId: string, balance: number) => {
        if (Math.abs(balance) < 0.001) return;
        const { date, time, timestamp } = now();
        // balance < 0 → client owes us → create a credit (remise de dette)
        // balance > 0 → we owe client → create a debit (remise d'avance)
        const montant = -balance; // opposite sign zeroes the balance
        try {
            await userDocRef.collection('dzd_client_txs').add({
                clientId,
                timestamp, date, time,
                type: 'Remise solde',
                montant,
                notes: `Effacement solde résiduel (${balance > 0 ? '+' : ''}${balance.toFixed(2)} DZD)`,
                paymentMethod: 'Remise',
            });
            setAlert('✅ Solde effacé.');
        } catch {
            setAlert('❌ Erreur lors de l\'effacement.');
        }
    };

    return {
        isSaving, isClientModalOpen, setIsClientModalOpen, editingClient, setEditingClient, clientToDelete, clientDeleteMode,
        clientFullName, setClientFullName, clientPhone, setClientPhone,
        initialBalance, setInitialBalance, clientRedotpayId, setClientRedotpayId,
        clientBinanceEmail, setClientBinanceEmail, clientNotes, setClientNotes, clientCreditLimit, setClientCreditLimit, clientGroup, setClientGroup, clientIsFournisseur, setClientIsFournisseur, clientBalanceInput, setClientBalanceInput,
        openClientModal, closeClientModal, requestClientDelete, closeClientDeleteDialog, handleSaveClient, handleDeleteClient, handleZeroOutBalance,
        isClientTxModalOpen, setIsClientTxModalOpen, editingClientTx, setEditingClientTx,
        clientTxToDelete, setClientTxToDelete, clientTxAmount, setClientTxAmount,
        clientTxType, setClientTxType, clientTxNotes, setClientTxNotes,
        clientTxSource, setClientTxSource, clientPaymentStatus, setClientPaymentStatus,
        linkedClientId, setLinkedClientId, openClientTxModal, handleSaveClientTx, handleDeleteClientTx,
        clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice,
        clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice
    };
}
