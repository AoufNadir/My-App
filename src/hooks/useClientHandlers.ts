import { useState } from 'react';
import { db, fieldValueDelete, type FirestoreDocumentReference } from '../firebase';
import { ClientDzd, ClientTransactionDzd, Investor, TreasuryTx } from '../types';
import { now, parseAndEvaluate } from '../utils';
import { normalizeLedgerLabel } from '../utils/financialUx';
import { recordTreasuryShadow } from '../accounting/treasuryShadowDiagnostics';
import { recordClientShadow } from '../accounting/clientShadowDiagnostics';
import { clientPositionFromLegacyRows } from '../accounting/clientShadowLegacyAdapter';
import { mustPrepareWriterReadModelDelta } from '../readModels/preparedWriterDeltas';
import { commitLegacyWithReadModelDeltas } from '../readModels/productionSummaryWriter';
import { buildClientBalanceTransferDelta, combineClientPositionDeltas, transitionClientBalanceDelta, type ClientPositionDelta } from '../readModels/readModelDeltas';
import { readClientTxLegacy } from '../readModels/legacyReadDelta';
import { LEGACY_EDIT_SOURCE_NOT_FOUND } from '../transactionService';
import { logTxLifecycle, logTxLifecycleError } from '../utils/txLifecycleDebug';
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
    const activeClientTodayDelta = (clientId: string, timestamp: number) => {
        const day = new Date(timestamp);
        day.setHours(0, 0, 0, 0);
        const dayStart = day.getTime();
        const dayEnd = dayStart + 86_400_000 - 1;
        return clientTransactionsDzd.some((tx) => tx.clientId === clientId && tx.timestamp >= dayStart && tx.timestamp <= dayEnd)
            ? 0
            : 1;
    };
    const balanceTransitionForClient = (clientId: string, amountDelta: number): ClientPositionDelta => {
        const before = clientBalances.get(clientId) || 0;
        return transitionClientBalanceDelta(before, before + amountDelta);
    };
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
            const batch = db.batch();
            let readModelDelta: ReturnType<typeof mustPrepareWriterReadModelDelta> | null = null;
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
                batch.update(userDocRef.collection('dzd_clients').doc(editingClient.id), data);
                const currentBal = clientBalances.get(editingClient.id) || 0;
                const newBal = parseAndEvaluate(clientBalanceInput);
                if (!isNaN(newBal) && Math.abs(newBal - currentBal) > 0.01) {
                    const { date, time, timestamp } = now();
                    const amountDzd = newBal - currentBal;
                    recordClientShadow({
                        operationId: `shadow:client-balance-adjustment:${editingClient.id}:${timestamp}`,
                        actorUid: userDocRef.id,
                        effectiveAt: timestamp,
                        kind: 'client_balance_adjustment',
                        clientId: editingClient.id,
                        amountDzd,
                        positionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, editingClient.id, timestamp),
                        reason: 'Mise à jour manuelle du solde',
                        counterpartAccount: 'equity.client_balance_correction',
                    }, { clientDeltas: { [editingClient.id]: amountDzd } });
                    const clientTxRef = userDocRef.collection('dzd_client_txs').doc();
                    batch.set(clientTxRef, {
                        clientId: editingClient.id, timestamp, date, time,
                        montant: amountDzd, type: 'Ajustement Solde',
                        notes: 'Mise à jour manuelle du solde', paymentMethod: 'Crédit'
                    });
                    readModelDelta = mustPrepareWriterReadModelDelta('clients.initial-adjustment-remise', {
                        operationId: `legacy:clients.initial-adjustment-remise:${clientTxRef.id}`,
                        effectiveAt: timestamp,
                        payload: { type: 'client_balance_update', clientId: editingClient.id, txId: clientTxRef.id, amountDzd },
                        affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                        clients: transitionClientBalanceDelta(currentBal, newBal),
                        recentOperation: {
                            operationId: `legacy:clients.initial-adjustment-remise:${clientTxRef.id}`,
                            source: 'legacy',
                            type: 'Ajustement Solde',
                            effectiveAt: timestamp,
                        },
                    });
                }
                setAlert('✅ Client mis à jour.');
            }
            else {
                const duplicate = clientsDzd.find(c => (data.fullName && c.fullName?.toLowerCase() === data.fullName.toLowerCase()) ||
                    (data.phone && c.phone === data.phone));
                if (duplicate) {
                    setAlert('⚠️ Ce client existe déjà.');
                    setIsSaving(false);
                    return;
                }
                const ref = userDocRef.collection('dzd_clients').doc();
                batch.set(ref, data);
                const initBal = parseAndEvaluate(initialBalance);
                if (initBal !== 0 && !isNaN(initBal)) {
                    const { date, time, timestamp } = now();
                    recordClientShadow({
                        operationId: `shadow:client-initial-balance:${ref.id}:${timestamp}`,
                        actorUid: userDocRef.id,
                        effectiveAt: timestamp,
                        kind: 'client_initial_balance',
                        clientId: ref.id,
                        amountDzd: initBal,
                        positionBefore: clientPositionFromLegacyRows([], ref.id, timestamp),
                        reason: 'Solde initial',
                        counterpartAccount: 'equity.client_opening_balance',
                    }, { clientDeltas: { [ref.id]: initBal } });
                    const clientTxRef = userDocRef.collection('dzd_client_txs').doc();
                    batch.set(clientTxRef, {
                        clientId: ref.id, timestamp, date, time,
                        type: 'Solde Initial', montant: initBal, notes: 'Solde initial', paymentMethod: 'Crédit'
                    });
                    const clientsDelta = transitionClientBalanceDelta(0, initBal);
                    clientsDelta.clientCountDelta = 1;
                    readModelDelta = mustPrepareWriterReadModelDelta('clients.initial-adjustment-remise', {
                        operationId: `legacy:clients.initial-adjustment-remise:${clientTxRef.id}`,
                        effectiveAt: timestamp,
                        payload: { type: 'client_initial_balance', clientId: ref.id, txId: clientTxRef.id, amountDzd: initBal },
                        affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                        clients: clientsDelta,
                        recentOperation: {
                            operationId: `legacy:clients.initial-adjustment-remise:${clientTxRef.id}`,
                            source: 'legacy',
                            type: 'Solde Initial',
                            effectiveAt: timestamp,
                        },
                    });
                }
                else {
                    readModelDelta = mustPrepareWriterReadModelDelta('clients.initial-adjustment-remise', {
                        operationId: `legacy:clients.initial-adjustment-remise:${ref.id}:create-zero`,
                        effectiveAt: Date.now(),
                        payload: { type: 'client_create_zero_balance', clientId: ref.id },
                        affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                        clients: { clientCountDelta: 1, receivablesDelta: 0, advancesDelta: 0 },
                        recentOperation: {
                            operationId: `legacy:clients.initial-adjustment-remise:${ref.id}:create-zero`,
                            source: 'legacy',
                            type: 'Client',
                            effectiveAt: Date.now(),
                        },
                    });
                }
                setAlert('✅ Client ajouté.');
            }
            if (readModelDelta) {
                await commitLegacyWithReadModelDeltas({ userDocRef, batch, deltas: [readModelDelta] });
            }
            else {
                await batch.commit();
            }
            closeClientModal();
            return true;
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de l’enregistrement du client.');
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
    const archiveClient = async (clientId: string) => {
        await userDocRef.collection('dzd_clients').doc(clientId).update({
            isActive: false,
            archived: true,
            archivedAt: Date.now(),
            archivedReason: 'user_delete',
        });
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
                await archiveClient(client.id);
                setAlert('✅ Client archivé.');
                closeClientDeleteDialog();
                return true;
            }
            catch (e) {
                console.error(e);
                setAlert('❌ Erreur lors de la suppression du client.');
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
            const clientHistory = clientTransactionsDzd.filter((tx) => tx.clientId === clientToDelete.id);
            if (clientDeleteMode === 'client_only_cleanup') {
                await archiveClient(clientToDelete.id);
                setAlert('✅ Client archivé (historique financier conservé).');
                closeClientDeleteDialog();
                return true;
            }
            if (clientDeleteMode === 'balance_only' && !isBalanceOnlyClientHistory(clientHistory)) {
                setClientDeleteMode('blocked');
                setAlert("⚠️ Suppression bloquée : ce client contient une opération liée.");
                return false;
            }
            await archiveClient(clientToDelete.id);
            setAlert('✅ Client archivé (historique financier conservé).');
            closeClientDeleteDialog();
            return true;
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de la suppression de l’historique du client.');
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
    const [clientTxReceiverClientId, setClientTxReceiverClientId] = useState('none');
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
            setClientTxReceiverClientId('none');
        }
        else {
            setClientTxAmount('');
            setClientTxType(normalizeClientTxType(presetType || CLIENT_TX_PAYMENT_RECEIVED));
            setClientTxNotes('');
            setClientTxSource('Caisse');
            setClientPaymentStatus('cash');
            setLinkedClientId(selectedClientId || 'none');
            setClientTxReceiverClientId('none');
            setClientTxUsdtAmount('');
            setClientTxSellPrice('');
            setClientTxEurAmount('');
            setClientTxEurPrice('');
        }
        setIsClientTxModalOpen(true);
    };
    const handleSaveClientTx = async (selectedClientId: string | null) => {
        if (isSaving)
            return;
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
            const receiverClientId = !editingClientTx && isClientSettlementTx && clientTxReceiverClientId !== 'none'
                ? clientTxReceiverClientId
                : 'none';
            const effectiveClientPaymentStatus = isClientSettlementTx && clientPaymentStatus === 'credit' ? 'cash' : clientPaymentStatus;
            if ((normalizedClientTxType === CLIENT_TX_PAYMENT_RECEIVED || normalizedClientTxType === CLIENT_TX_PAYMENT_MADE) && amount <= 0) {
                setAlert('⚠️ Entrez un montant positif.');
                return;
            }
            if (receiverClientId !== 'none' && receiverClientId === targetClientId) {
                setAlert('⚠️ Le client qui reçoit doit être différent.');
                return;
            }
            const montant = isPaymentReceived ? amount : -amount;
            const paymentMethod = paymentMethodMap[effectiveClientPaymentStatus];
            const walletSource = effectiveClientPaymentStatus === 'cash' ? 'Caisse' : 'BaridiMob';
            const treasuryTxType = isPaymentReceived ? 'Ajout' : 'Retrait';
            let readModelDelta: ReturnType<typeof mustPrepareWriterReadModelDelta> | null = null;
            let oldClientTxMain: any = null;
            let oldLinkedTreasuryTx: any = null;
            if (editingClientTx) {
                const legacyResult = await readClientTxLegacy(editingClientTx.id, userDocRef);
                logTxLifecycle('legacy-read', {
                    action: 'edit',
                    collection: 'dzd_client_txs',
                    transactionId: editingClientTx.id,
                    found: Boolean(legacyResult.main),
                    linkedRows: legacyResult.linkedRows.length,
                    error: legacyResult.error,
                });
                if (!legacyResult.main) {
                    throw new Error(`${LEGACY_EDIT_SOURCE_NOT_FOUND}:dzd_client_txs:${editingClientTx.id}`);
                }
                oldClientTxMain = legacyResult.main as any;
                oldLinkedTreasuryTx = legacyResult.linkedRows.find((row) => row.collection === 'treasury_txs')?.data || null;
            }
            if (effectiveClientPaymentStatus !== 'credit' && !isPaymentReceived && receiverClientId === 'none') {
                const linkedTreasuryTx = oldClientTxMain?.linkedTxId
                    ? (oldLinkedTreasuryTx || treasuryTransactions.find(tx => tx.id === oldClientTxMain.linkedTxId))
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
                if (oldClientTxMain.linkedTxId) {
                    const treasuryRef = userDocRef.collection('treasury_txs').doc(oldClientTxMain.linkedTxId);
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
                const oldMontant = Number(oldClientTxMain.montant || 0);
                const oldClientId = String(oldClientTxMain.clientId || editingClientTx.clientId);
                const beforeClientBalance = (clientBalances.get(oldClientId) || 0) - oldMontant;
                const clientsDelta = transitionClientBalanceDelta(beforeClientBalance, beforeClientBalance + montant);
                const walletDeltas = { Caisse: 0, BaridiMob: 0 };
                const linkedTreasuryTx = oldLinkedTreasuryTx;
                if (linkedTreasuryTx?.source === 'Caisse' || linkedTreasuryTx?.source === 'BaridiMob') {
                    walletDeltas[linkedTreasuryTx.source] -= linkedTreasuryTx.type === 'Ajout' ? Number(linkedTreasuryTx.amount || 0) : -Number(linkedTreasuryTx.amount || 0);
                }
                if (effectiveClientPaymentStatus !== 'credit') {
                    walletDeltas[walletSource] += isPaymentReceived ? amount : -amount;
                }
                readModelDelta = mustPrepareWriterReadModelDelta('clients.settlement', {
                    operationId: `legacy:clients.settlement:${editingClientTx.id}:update:${timestamp}`,
                    effectiveAt: timestamp,
                    payload: { type: 'client_settlement_update', txId: editingClientTx.id, oldMontant, montant, walletDeltas },
                    affectedSummaries: ['dashboard_summary', 'clients_summary', 'treasury_summary', 'financial_summary'],
                    clients: clientsDelta,
                    wallets: walletDeltas,
                    recentOperation: { operationId: `legacy:clients.settlement:${editingClientTx.id}`, source: 'legacy', type: normalizedClientTxType, effectiveAt: timestamp },
                });
                setAlert('✅ Transaction mise à jour.');
            }
            else {
                if (receiverClientId !== 'none') {
                    const outgoingTransferRef = userDocRef.collection('dzd_client_txs').doc();
                    const incomingTransferRef = userDocRef.collection('dzd_client_txs').doc();
                    const transferId = outgoingTransferRef.id;
                    const note = clientTxNotes.trim();
                    if (isPaymentReceived) {
                        batch.set(outgoingTransferRef, {
                            clientId: targetClientId,
                            timestamp,
                            date,
                            time,
                            montant: amount,
                            type: 'Transfert Sortant',
                            notes: note,
                            paymentMethod: 'Crédit',
                            transferId,
                            counterpartyClientId: receiverClientId,
                            transferRole: 'source',
                            transferAmountDzd: amount
                        });
                        batch.set(incomingTransferRef, {
                            clientId: receiverClientId,
                            timestamp: timestamp + 1,
                            date,
                            time,
                            montant: -amount,
                            type: 'Transfert Entrant',
                            notes: note,
                            paymentMethod: 'Crédit',
                            linkedTxId: outgoingTransferRef.id,
                            transferId,
                            counterpartyClientId: targetClientId,
                            transferRole: 'destination',
                            transferAmountDzd: amount
                        });
                        setAlert('✅ Dette transférée au client qui a reçu.');
                        const clientsDelta = buildClientBalanceTransferDelta({
                            sourceBeforeBalance: clientBalances.get(targetClientId) || 0,
                            destinationBeforeBalance: clientBalances.get(receiverClientId) || 0,
                            amountDzd: amount,
                        }).clients;
                        clientsDelta.activeClientsTodayDelta = activeClientTodayDelta(targetClientId, timestamp)
                            + activeClientTodayDelta(receiverClientId, timestamp);
                        readModelDelta = mustPrepareWriterReadModelDelta('clients.transfer', {
                            operationId: `legacy:clients.transfer:${outgoingTransferRef.id}`,
                            effectiveAt: timestamp,
                            payload: { type: 'client_balance_transfer', transferId, fromClientId: targetClientId, toClientId: receiverClientId, amount },
                            affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                            clients: clientsDelta,
                            recentOperation: { operationId: `legacy:clients.transfer:${outgoingTransferRef.id}`, source: 'legacy', type: 'Transfert client', effectiveAt: timestamp },
                        });
                    }
                    else {
                        batch.set(outgoingTransferRef, {
                            clientId: receiverClientId,
                            timestamp,
                            date,
                            time,
                            montant: amount,
                            type: 'Transfert Sortant',
                            notes: note,
                            paymentMethod: 'Crédit',
                            transferId,
                            counterpartyClientId: targetClientId,
                            transferRole: 'source',
                            transferAmountDzd: amount
                        });
                        batch.set(incomingTransferRef, {
                            clientId: targetClientId,
                            timestamp: timestamp + 1,
                            date,
                            time,
                            montant: -amount,
                            type: 'Transfert Entrant',
                            notes: note,
                            paymentMethod: 'Crédit',
                            linkedTxId: outgoingTransferRef.id,
                            transferId,
                            counterpartyClientId: receiverClientId,
                            transferRole: 'destination',
                            transferAmountDzd: amount
                        });
                        setAlert('✅ Droit transféré au client qui a reçu.');
                        const clientsDelta = buildClientBalanceTransferDelta({
                            sourceBeforeBalance: clientBalances.get(receiverClientId) || 0,
                            destinationBeforeBalance: clientBalances.get(targetClientId) || 0,
                            amountDzd: amount,
                        }).clients;
                        clientsDelta.activeClientsTodayDelta = activeClientTodayDelta(targetClientId, timestamp)
                            + activeClientTodayDelta(receiverClientId, timestamp);
                        readModelDelta = mustPrepareWriterReadModelDelta('clients.transfer', {
                            operationId: `legacy:clients.transfer:${outgoingTransferRef.id}`,
                            effectiveAt: timestamp,
                            payload: { type: 'client_balance_transfer', transferId, fromClientId: receiverClientId, toClientId: targetClientId, amount },
                            affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                            clients: clientsDelta,
                            recentOperation: { operationId: `legacy:clients.transfer:${outgoingTransferRef.id}`, source: 'legacy', type: 'Transfert client', effectiveAt: timestamp },
                        });
                    }
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
                    const clientsDelta = balanceTransitionForClient(targetClientId, montant);
                    clientsDelta.activeClientsTodayDelta = activeClientTodayDelta(targetClientId, timestamp);
                    const walletDeltas = { Caisse: 0, BaridiMob: 0 };
                    if (effectiveClientPaymentStatus !== 'credit') {
                        walletDeltas[walletSource] = isPaymentReceived ? amount : -amount;
                    }
                    readModelDelta = mustPrepareWriterReadModelDelta('clients.settlement', {
                        operationId: `legacy:clients.settlement:${clientTxRef.id}`,
                        effectiveAt: timestamp,
                        payload: { type: 'client_settlement_create', txId: clientTxRef.id, clientId: targetClientId, montant, walletDeltas },
                        affectedSummaries: ['dashboard_summary', 'clients_summary', 'treasury_summary', 'financial_summary'],
                        clients: clientsDelta,
                        wallets: walletDeltas,
                        recentOperation: { operationId: `legacy:clients.settlement:${clientTxRef.id}`, source: 'legacy', type: normalizedClientTxType, effectiveAt: timestamp },
                    });
                    setAlert('✅ Transaction ajoutée.');
                }
            }
            if (effectiveClientPaymentStatus !== 'credit' && receiverClientId === 'none') {
                const kind = isPaymentReceived ? 'client_receipt_cash' : 'client_payout_cash';
                recordTreasuryShadow({
                    operationId: `shadow:client-settlement:${editingClientTx?.id || `${targetClientId}:${timestamp}`}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind,
                    wallet: walletSource,
                    amountDzd: amount,
                    clientId: targetClientId,
                }, [{ type: treasuryTxType, source: walletSource, amount }]);
            }
            if (!editingClientTx) {
                if (receiverClientId !== 'none') {
                    if (isPaymentReceived) {
                        recordClientShadow({
                            operationId: `shadow:client-receivable-transfer:${targetClientId}:${receiverClientId}:${timestamp}`,
                            actorUid: userDocRef.id,
                            effectiveAt: timestamp,
                            kind: 'client_receivable_transfer',
                            fromClientId: targetClientId,
                            toClientId: receiverClientId,
                            amountDzd: amount,
                            fromPositionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, targetClientId, timestamp),
                            toPositionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, receiverClientId, timestamp),
                        }, { clientDeltas: { [targetClientId]: amount, [receiverClientId]: -amount }, receivableDzd: 0 });
                    }
                    else {
                        recordClientShadow({
                            operationId: `shadow:client-advance-transfer:${receiverClientId}:${targetClientId}:${timestamp}`,
                            actorUid: userDocRef.id,
                            effectiveAt: timestamp,
                            kind: 'client_advance_transfer',
                            fromClientId: receiverClientId,
                            toClientId: targetClientId,
                            amountDzd: amount,
                            fromPositionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, receiverClientId, timestamp),
                            toPositionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, targetClientId, timestamp),
                        }, { clientDeltas: { [receiverClientId]: -amount, [targetClientId]: amount }, clientAdvanceDzd: 0 });
                    }
                }
                else if (effectiveClientPaymentStatus !== 'credit') {
                    const positionBefore = clientPositionFromLegacyRows(clientTransactionsDzd, targetClientId, timestamp);
                    recordClientShadow({
                        operationId: `shadow:client-cash-settlement:${targetClientId}:${timestamp}`,
                        actorUid: userDocRef.id,
                        effectiveAt: timestamp,
                        kind: isPaymentReceived ? 'client_cash_receipt' : 'client_cash_payout',
                        clientId: targetClientId,
                        amountDzd: amount,
                        positionBefore,
                        wallet: walletSource,
                    }, {
                        clientDeltas: { [targetClientId]: montant },
                        cashDeltasDzd: { [walletSource]: isPaymentReceived ? amount : -amount },
                    });
                }
            }
            logTxLifecycle('commit-start', {
                action: editingClientTx ? 'edit' : 'create',
                collection: 'dzd_client_txs',
                transactionId: editingClientTx?.id,
                operationId: readModelDelta?.operationId,
            });
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: readModelDelta ? [readModelDelta] : [],
            });
            logTxLifecycle('commit-result', {
                action: editingClientTx ? 'edit' : 'create',
                collection: 'dzd_client_txs',
                transactionId: editingClientTx?.id,
                operationId: readModelDelta?.operationId,
                result: 'success',
            });
            setIsClientTxModalOpen(false);
            setEditingClientTx(null);
            setClientTxReceiverClientId('none');
            return true;
        }
        catch (e) {
            logTxLifecycleError(e, {
                action: editingClientTx ? 'edit' : 'create',
                collection: 'dzd_client_txs',
                transactionId: editingClientTx?.id,
            });
            setAlert('❌ Erreur lors de l’enregistrement de la transaction.');
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
            const buildOldDelta = (_resolvedType: string, resolvedTxId: string, mainData: any, linkedData: any[]) => {
                const ts = Number(mainData.timestamp || Date.now());
                const rows = [
                    { ...mainData, id: resolvedTxId },
                    ...linkedData.filter((row) => row?.clientId && (row?.type === 'Transfert Sortant' || row?.type === 'Transfert Entrant')),
                ];
                const transferRows = rows.filter((row) => row.type === 'Transfert Sortant' || row.type === 'Transfert Entrant');
                if (transferRows.length > 0) {
                    const clientsDelta = combineClientPositionDeltas(transferRows.map((row) => {
                        const montant = Number(row.montant || 0);
                        const current = clientBalances.get(row.clientId) || 0;
                        return transitionClientBalanceDelta(current - montant, current);
                    }));
                    return mustPrepareWriterReadModelDelta('clients.transfer', {
                        operationId: `legacy:delete-build:dzd_client_txs:${resolvedTxId}`,
                        effectiveAt: ts,
                        payload: { type: 'client_transfer_delete', txId: resolvedTxId, rows: transferRows.map((row) => ({ clientId: row.clientId, montant: row.montant })) },
                        affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                        clients: clientsDelta,
                        recentOperation: { operationId: `legacy:delete-build:dzd_client_txs:${resolvedTxId}`, source: 'legacy', type: 'Transfert client', effectiveAt: ts },
                    });
                }
                const montant = Number(mainData.montant || 0);
                const current = clientBalances.get(mainData.clientId) || 0;
                const treasuryRow = linkedData.find((row) => row?.source === 'Caisse' || row?.source === 'BaridiMob');
                const walletDeltas: Record<string, number> = {};
                if (treasuryRow?.source === 'Caisse' || treasuryRow?.source === 'BaridiMob') {
                    walletDeltas[treasuryRow.source] = (treasuryRow.type === 'Ajout' || treasuryRow.type === 'Adjustment (+)')
                        ? Number(treasuryRow.amount || 0)
                        : -Number(treasuryRow.amount || 0);
                }
                return mustPrepareWriterReadModelDelta('clients.settlement', {
                    operationId: `legacy:delete-build:dzd_client_txs:${resolvedTxId}`,
                    effectiveAt: ts,
                    payload: { type: 'client_settlement_delete', clientId: mainData.clientId, txId: resolvedTxId, montant, walletDeltas },
                    affectedSummaries: Object.keys(walletDeltas).length > 0
                        ? ['dashboard_summary', 'clients_summary', 'treasury_summary', 'financial_summary']
                        : ['dashboard_summary', 'clients_summary', 'financial_summary'],
                    clients: transitionClientBalanceDelta(current - montant, current),
                    wallets: Object.keys(walletDeltas).length > 0 ? walletDeltas as any : undefined,
                    recentOperation: { operationId: `legacy:delete-build:dzd_client_txs:${resolvedTxId}`, source: 'legacy', type: String(mainData.type || 'Client'), effectiveAt: ts },
                });
            };
            const result = await applyTransactionDelete(clientTxToDelete.id, 'client_tx', userDocRef, buildOldDelta);
            if (result.success)
                setAlert('✅ Transaction supprimée.');
            else
                setAlert('❌ Erreur lors de la suppression.');
        }
        catch (e) {
            logTxLifecycleError(e, {
                action: 'delete',
                collection: 'dzd_client_txs',
                transactionId: clientTxToDelete.id,
            });
            setAlert('❌ Erreur lors de la suppression.');
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
            const positionBefore = clientPositionFromLegacyRows(clientTransactionsDzd, clientId, timestamp);
            recordClientShadow(balance < 0 ? {
                operationId: `shadow:client-receivable-write-off:${clientId}:${timestamp}`,
                actorUid: userDocRef.id,
                effectiveAt: timestamp,
                kind: 'client_write_off_receivable',
                clientId,
                amountDzd: Math.abs(montant),
                positionBefore,
                reason: 'Effacement solde résiduel',
            } : {
                operationId: `shadow:client-advance-cancellation:${clientId}:${timestamp}`,
                actorUid: userDocRef.id,
                effectiveAt: timestamp,
                kind: 'client_advance_cancellation',
                clientId,
                amountDzd: Math.abs(montant),
                positionBefore,
                reason: 'Effacement solde résiduel',
            }, balance < 0
                ? { clientDeltas: { [clientId]: montant }, receivableDzd: -Math.abs(montant) }
                : { clientDeltas: { [clientId]: montant }, clientAdvanceDzd: -Math.abs(montant) });
            const batch = db.batch();
            const txRef = userDocRef.collection('dzd_client_txs').doc();
            batch.set(txRef, {
                clientId,
                timestamp, date, time,
                type: 'Remise solde',
                montant,
                notes: `Effacement solde résiduel (${balance > 0 ? '+' : ''}${balance.toFixed(2)} DZD)`,
                paymentMethod: 'Remise',
            });
            const readModelDelta = mustPrepareWriterReadModelDelta('clients.initial-adjustment-remise', {
                operationId: `legacy:clients.initial-adjustment-remise:${txRef.id}`,
                effectiveAt: timestamp,
                payload: { type: 'client_zero_out_balance', clientId, txId: txRef.id, balance, montant },
                affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                clients: transitionClientBalanceDelta(balance, 0),
                recentOperation: {
                    operationId: `legacy:clients.initial-adjustment-remise:${txRef.id}`,
                    source: 'legacy',
                    type: 'Remise solde',
                    effectiveAt: timestamp,
                },
            });
            await commitLegacyWithReadModelDeltas({ userDocRef, batch, deltas: [readModelDelta] });
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
        linkedClientId, setLinkedClientId, clientTxReceiverClientId, setClientTxReceiverClientId, openClientTxModal, handleSaveClientTx, handleDeleteClientTx,
        clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice,
        clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice
    };
}
