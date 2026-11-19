import type { FirestoreDocumentReference } from './firebase';
import { formatNumber } from './pages/shared/pageFormat';
import { recordTreasuryLegacyDeletionShadow, recordTreasuryShadow } from './accounting/treasuryShadowDiagnostics';
import { resolveLegacyMutationPolicy } from './readModels/readModelActivation';
import { commitLegacyWithReadModelDeltas } from './readModels/productionSummaryWriter';
import {
    createLegacyOperationIndexDoc,
    deterministicLinkedId,
    flattenLegacyOperationIndexRows,
    legacyOperationIndexId,
    LEGACY_OPERATION_INDEX_COLLECTION,
    legacyTypeForCollection,
    type IndexedFinancialRow,
    type LegacyOperationIndexDoc,
} from './readModels/operationIndex';
type TransactionType = 'usdt_tx' | 'client_tx' | 'treasury_tx' | 'asset_tx';
interface LinkedTransaction {
    id: string;
    collection: string;
    type: TransactionType;
    data: any;
}
const COLLECTION_MAP: Record<TransactionType, string> = {
    usdt_tx: 'usdt_txs',
    client_tx: 'dzd_client_txs',
    treasury_tx: 'treasury_txs',
    asset_tx: 'actifTransactions'
};

function operationIndexRef(userDocRef: FirestoreDocumentReference, transactionType: TransactionType, transactionId: string) {
    return userDocRef
        .collection(LEGACY_OPERATION_INDEX_COLLECTION)
        .doc(legacyOperationIndexId(transactionType, transactionId));
}

function linkedTransactionsFromIndexedRows(rows: readonly IndexedFinancialRow[], transactionType: TransactionType, transactionId: string): LinkedTransaction[] {
    const mainCollection = COLLECTION_MAP[transactionType];
    return rows
        .filter((row) => !(row.collection === mainCollection && row.id === transactionId))
        .map((row) => ({
            id: row.id,
            collection: row.collection,
            type: (row.transactionType || legacyTypeForCollection(row.collection) || transactionType) as TransactionType,
            data: {},
        }));
}

async function loadOperationIndexRows(transactionId: string, transactionType: TransactionType, userDocRef: FirestoreDocumentReference): Promise<IndexedFinancialRow[] | null> {
    const indexDoc = await operationIndexRef(userDocRef, transactionType, transactionId).get();
    if (!indexDoc.exists) return null;
    const rows = flattenLegacyOperationIndexRows(indexDoc.data() as LegacyOperationIndexDoc);
    return rows.length > 0 ? rows : null;
}

async function findLinkedTransactionsFromOperationIndex(transactionId: string, transactionType: TransactionType, userDocRef: FirestoreDocumentReference): Promise<LinkedTransaction[] | null> {
    const rows = await loadOperationIndexRows(transactionId, transactionType, userDocRef);
    if (!rows) return null;
    return linkedTransactionsFromIndexedRows(rows, transactionType, transactionId);
}

function recordTreasuryDeletionShadow(userDocRef: FirestoreDocumentReference, operationId: string, rows: readonly any[]): void {
    rows.forEach((row, index) => {
        const wallet = row?.source === 'Caisse' || row?.source === 'BaridiMob' ? row.source : null;
        const amount = Math.abs(Number(row?.amount || 0));
        if (!wallet || !Number.isFinite(amount) || amount <= 0) return;
        const destination = row?.destination === 'Caisse' || row?.destination === 'BaridiMob' ? row.destination : undefined;
        recordTreasuryLegacyDeletionShadow({
            operationId: `shadow:legacy-delete:${operationId}:${index}`,
            actorUid: userDocRef.id,
            effectiveAt: Date.now(),
            row: { type: row.type, source: wallet, destination, amount },
        });
    });
}
async function resolveDeletionTarget(transactionId: string, transactionType: TransactionType, userDocRef: FirestoreDocumentReference, visited = new Set<string>()): Promise<{
    transactionId: string;
    transactionType: TransactionType;
    error?: string;
    /** V18 (performance): the target's data as read here, so the delete does not read it again. */
    data?: any;
}> {
    const key = `${transactionType}:${transactionId}`;
    if (visited.has(key)) {
        return {
            transactionId,
            transactionType,
            error: 'Circular delete link detected.'
        };
    }
    visited.add(key);
    const txDoc = await userDocRef.collection(COLLECTION_MAP[transactionType]).doc(transactionId).get();
    const txData = txDoc.data() as any;
    if (!txData) {
        return { transactionId, transactionType, data: null };
    }
    if (transactionType === 'client_tx' && txData.linkedTxId) {
        if (txData.origin === 'adjustment') {
            return resolveDeletionTarget(txData.linkedTxId, 'treasury_tx', userDocRef, visited);
        }
        const linkedTreasuryDoc = await userDocRef.collection('treasury_txs').doc(txData.linkedTxId).get();
        const linkedTreasuryData = linkedTreasuryDoc.data() as any;
        const reverseTreasuryLinks = await userDocRef
            .collection('treasury_txs')
            .where('linkedTxId', '==', transactionId)
            .limit(1)
            .get();
        // Manual client transactions point to their treasury child. In that case
        // the current client row is already the parent transaction we should delete.
        if ((linkedTreasuryData?.origin === 'client_tx' && linkedTreasuryData?.linkedTxId === transactionId)
            || reverseTreasuryLinks.docs.some((doc) => (doc.data() as any)?.origin === 'client_tx')) {
            return { transactionId, transactionType, data: txData };
        }
        return resolveDeletionTarget(txData.linkedTxId, 'usdt_tx', userDocRef, visited);
    }
    if (transactionType === 'treasury_tx') {
        if (txData.origin === 'manual_asset' && txData.linkedAssetTxId) {
            return resolveDeletionTarget(txData.linkedAssetTxId, 'asset_tx', userDocRef, visited);
        }
        if (txData.linkedTxId) {
            const parentType: TransactionType = txData.origin === 'client_tx' ? 'client_tx' : 'usdt_tx';
            return resolveDeletionTarget(txData.linkedTxId, parentType, userDocRef, visited);
        }
    }
    if (transactionType === 'usdt_tx' && txData.linkedTxId) {
        if (txData.origin === 'delivery_expense' || txData.origin === 'personal_expense' || txData.origin === 'personal_expense_return') {
            return resolveDeletionTarget(txData.linkedTxId, 'treasury_tx', userDocRef, visited);
        }
        return resolveDeletionTarget(txData.linkedTxId, 'usdt_tx', userDocRef, visited);
    }
    return { transactionId, transactionType, data: txData };
}
/**
 * Find all transactions linked to a given transaction ID
 * Searches across all collections for linkedTxId or linkedTreasuryTxId matches
 */
export async function findLinkedTransactions(transactionId: string, userDocRef: FirestoreDocumentReference): Promise<LinkedTransaction[]> {
    const linked: LinkedTransaction[] = [];
    try {
        // V18 (performance): the four searches do not depend on each other, so they go to the server together
        // instead of one after the other. The rows are added in the same order as before.
        const searches: Array<[string, TransactionType, string]> = [
            ['dzd_client_txs', 'client_tx', 'linkedTxId'],
            ['treasury_txs', 'treasury_tx', 'linkedTxId'],
            ['usdt_txs', 'usdt_tx', 'linkedTxId'],
            ['actifTransactions', 'asset_tx', 'linkedTreasuryTxId'],
        ];
        const snapshots = await Promise.all(searches.map(([collection, , field]) => userDocRef.collection(collection).where(field, '==', transactionId).get()));
        snapshots.forEach((snapshot, i) => {
            const [collection, type] = searches[i];
            snapshot.forEach((doc) => { linked.push({ id: doc.id, collection, type, data: doc.data() }); });
        });
    }
    catch (e) {
        console.error('Error finding linked transactions:', e);
    }
    return linked;
}
/**
 * Delete a transaction and all its linked transactions
 * Uses Firestore batch for atomic operations
 */
export async function applyTransactionDelete(transactionId: string, transactionType: TransactionType, userDocRef: FirestoreDocumentReference): Promise<{
    success: boolean;
    error?: string;
    /** V19: writes back every line this delete removed, exactly as it was (absent when one of them could not be kept). */
    undo?: () => Promise<void>;
}> {
    try {
        const legacyMutationPolicy = resolveLegacyMutationPolicy({});
        if (!legacyMutationPolicy.canMutate) {
            return { success: false, error: legacyMutationPolicy.reason };
        }
        const resolvedTarget = await resolveDeletionTarget(transactionId, transactionType, userDocRef);
        if (resolvedTarget.error) {
            return {
                success: false,
                error: resolvedTarget.error
            };
        }
        transactionId = resolvedTarget.transactionId;
        transactionType = resolvedTarget.transactionType;
        const batch = userDocRef.firestore.batch();
        const mainCollection = COLLECTION_MAP[transactionType];
        // V19: what each deleted line held, by path, so « Annuler » can write it back.
        const kept = new Map<string, any>();
        const keep = (ref: any, data: any) => { const path = ref?.nativeRef?.path ?? ref?.path; if (path && data && typeof data === 'object' && Object.keys(data).length > 0) kept.set(path, data); };
        // V18 (performance): the target was just read by resolveDeletionTarget; the linked rows are searched at the
        // same time. The same documents are read as before, only fewer times and not one after the other.
        const [mainData, linkedTxs] = await Promise.all([
            resolvedTarget.data !== undefined
                ? Promise.resolve(resolvedTarget.data)
                : userDocRef.collection(mainCollection).doc(transactionId).get().then((snap) => snap.data() as any),
            findLinkedTransactions(transactionId, userDocRef),
        ]);
        // Delete main transaction
        keep(userDocRef.collection(mainCollection).doc(transactionId), mainData);
        batch.delete(userDocRef.collection(mainCollection).doc(transactionId));
        recordTreasuryDeletionShadow(userDocRef, transactionId, [
            ...(transactionType === 'treasury_tx' && mainData ? [mainData] : []),
            ...linkedTxs.filter((tx) => tx.collection === 'treasury_txs').map((tx) => tx.data),
        ]);
        for (const linkedTx of linkedTxs) {
            keep(userDocRef.collection(linkedTx.collection).doc(linkedTx.id), linkedTx.data);
            batch.delete(userDocRef.collection(linkedTx.collection).doc(linkedTx.id));
        }
        const deletePersonalPortfolioChildren = async (txId: string) => {
            const [byLinkedTx, byPersonalId] = await Promise.all([
                userDocRef.collection('usdt_txs').where('linkedTxId', '==', txId).get(),
                userDocRef.collection('usdt_txs').where('linkedPersonalExpenseTxId', '==', txId).get(),
            ]);
            const seen = new Set<string>();
            byLinkedTx.forEach((doc) => {
                const data = doc.data() as any;
                if (data.origin !== 'personal_expense' && data.origin !== 'personal_expense_return') return;
                seen.add(doc.id);
                keep(doc.ref, data);
                batch.delete(doc.ref);
            });
            byPersonalId.forEach((doc) => {
                if (seen.has(doc.id)) return;
                keep(doc.ref, doc.data());
                batch.delete(doc.ref);
            });
        };
        // Backward compatibility:
        // Older "buy USDT with EUR" flows created an extra EUR withdrawal row
        // without linkedTxId. If no linked USDT row was found, try to remove it safely.
        if (transactionType === 'usdt_tx') {
            const hasLinkedUsdtChild = linkedTxs.some(tx => tx.collection === 'usdt_txs');
            if (!hasLinkedUsdtChild) {
                const mainTxData = mainData;
                if (mainTxData &&
                    mainTxData.type === 'buy' &&
                    mainTxData.currency === 'USDT' &&
                    typeof mainTxData.timestamp === 'number') {
                    const expectedNote = `Achat de ${Number(mainTxData.quantity || 0).toFixed(2)} USDT`;
                    const nearTxQuery = await userDocRef
                        .collection('usdt_txs')
                        .where('timestamp', '>=', mainTxData.timestamp - 120000)
                        .where('timestamp', '<=', mainTxData.timestamp)
                        .get();
                    const candidates = nearTxQuery.docs
                        .filter(doc => {
                        if (doc.id === transactionId)
                            return false;
                        const data = doc.data() as any;
                        return (!data.linkedTxId &&
                            data.type === 'Retrait Manuel' &&
                            data.currency === 'EUR' &&
                            data.notes === expectedNote);
                    })
                        .sort((a, b) => {
                        const aTs = Number((a.data() as any).timestamp || 0);
                        const bTs = Number((b.data() as any).timestamp || 0);
                        return bTs - aTs;
                    });
                    if (candidates.length === 1) {
                        keep(candidates[0].ref, candidates[0].data());
                        batch.delete(candidates[0].ref);
                    }
                }
            }
        }
        // For asset transactions, also check for linkedTreasuryTxId field
        if (transactionType === 'asset_tx') {
            const assetTxData = mainData;
            if (assetTxData?.linkedTreasuryTxId) {
                batch.delete(userDocRef.collection('treasury_txs').doc(assetTxData.linkedTreasuryTxId));
            }
        }
        // M5: personal_expense treasury_txs are linked to investor_transactions
        // (linkedInvestorTxId) and optionally a return treasury_tx (linkedReturnTxId).
        // findLinkedTransactions only searches by linkedTxId, so without this block
        // a generic delete of a personal_expense leaves the investor_tx and any
        // return tx orphaned. Mirror the cleanup done by handleDeletePersonalExpense.
        if (transactionType === 'treasury_tx') {
            const treasuryData = mainData;
            if (treasuryData?.origin === 'personal_expense') {
                await deletePersonalPortfolioChildren(transactionId);
                const investorTxIds = new Set<string>();
                if (treasuryData.linkedInvestorTxId) {
                    investorTxIds.add(treasuryData.linkedInvestorTxId);
                }
                if (treasuryData.linkedCapitalInvestorTxId) {
                    investorTxIds.add(treasuryData.linkedCapitalInvestorTxId);
                }
                const reverseInvestor = await userDocRef
                    .collection('investor_transactions')
                    .where('linkedTreasuryTxId', '==', transactionId)
                    .get();
                reverseInvestor.forEach((doc) => investorTxIds.add(doc.id));
                investorTxIds.forEach((id) => {
                    batch.delete(userDocRef.collection('investor_transactions').doc(id));
                });
                const returnDocs = await userDocRef
                    .collection('treasury_txs')
                    .where('linkedTreasuryTxId', '==', transactionId)
                    .where('origin', '==', 'personal_expense_return')
                    .get();
                for (const doc of returnDocs.docs) {
                    await deletePersonalPortfolioChildren(doc.id);
                    keep(doc.ref, doc.data());
                    batch.delete(doc.ref);
                }
            }
        }
        const deletedAt = Date.now();
        batch.set(operationIndexRef(userDocRef, transactionType, transactionId), createLegacyOperationIndexDoc({
            transactionId,
            transactionType,
            linkedRows: linkedTxs.map((linkedTx) => ({
                collection: linkedTx.collection,
                id: linkedTx.id,
                role: 'linked',
                transactionType: linkedTx.type,
            })),
            updatedAt: deletedAt,
            deletedAt,
            status: 'deleted',
        }));
        // V19: the lines found only by their id (an investor line, an asset's treasury line) are read once, together.
        const deletes = (batch.operations || []).filter((op: any) => op.kind === 'delete');
        const missing = deletes.filter((op: any) => !kept.has(op.ref.nativeRef.path));
        if (missing.length > 0 && missing.length <= 10) {
            const snaps = await Promise.all(missing.map((op: any) => op.ref.get().catch(() => null)));
            snaps.forEach((snap: any, i: number) => { if (snap?.exists) keep(missing[i].ref, snap.data()); });
        }
        const restorable = deletes.length > 0 && deletes.every((op: any) => kept.has(op.ref.nativeRef.path));
        const indexRef = operationIndexRef(userDocRef, transactionType, transactionId);
        await commitLegacyWithReadModelDeltas({
            userDocRef,
            batch,
            deltas: [],
        });
        if (!restorable)
            return { success: true };
        const restore = deletes.map((op: any) => ({ ref: op.ref, data: kept.get(op.ref.nativeRef.path) }));
        return {
            success: true,
            // The same lines with the same ids and fields: every figure comes back as it was. The « deleted » mark of the
            // operation index is removed (a later edit or delete then finds the lines by their links, as for any line).
            undo: async () => {
                const back = userDocRef.firestore.batch();
                for (const row of restore)
                    back.set(row.ref, row.data);
                back.delete(indexRef);
                await commitLegacyWithReadModelDeltas({ userDocRef, batch: back, deltas: [] });
            },
        };
    }
    catch (e: any) {
        console.error('Error in applyTransactionDelete:', e);
        return {
            success: false,
            error: e.message || 'Unknown error occurred during deletion'
        };
    }
}
/**
 * Update a transaction and recreate its linked transactions
 * This is complex because we need to:
 * 1. Update the main transaction
 * 2. Delete old linked transactions
 * 3. Recreate new linked transactions based on updated data
 */
export async function applyTransactionUpdate(transactionId: string, transactionType: TransactionType, newData: any, userDocRef: FirestoreDocumentReference): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const batch = userDocRef.firestore.batch();
        const collectionMap: Record<TransactionType, string> = {
            'usdt_tx': 'usdt_txs',
            'client_tx': 'dzd_client_txs',
            'treasury_tx': 'treasury_txs',
            'asset_tx': 'actifTransactions'
        };
        const mainCollection = collectionMap[transactionType];
        const legacyMutationPolicy = resolveLegacyMutationPolicy({});
        if (!legacyMutationPolicy.canMutate) {
            return { success: false, error: legacyMutationPolicy.reason };
        }
        const indexedLinkedTxs = await findLinkedTransactionsFromOperationIndex(transactionId, transactionType, userDocRef);
        const nextLinkedRows: IndexedFinancialRow[] = [];
        // Update main transaction
        const mainTxRef = userDocRef.collection(mainCollection).doc(transactionId);
        batch.update(mainTxRef, newData);
        // Find and delete all old linked transactions
        const linkedTxs = indexedLinkedTxs || await findLinkedTransactions(transactionId, userDocRef);
        for (const linkedTx of linkedTxs) {
            batch.delete(userDocRef.collection(linkedTx.collection).doc(linkedTx.id));
        }
        // Recreate linked transactions based on the transaction type and newData
        // This logic mirrors the creation logic in handleBuy, handleSell, etc.
        if (transactionType === 'usdt_tx') {
            const { timestamp, date, time, paymentMethod, quantity, price, total, sell } = newData;
            const linkedClientId = newData.linkedClientId;
            const resolvedPaymentMethod = paymentMethod || 'Crédit';
            // Determine if we need a treasury or client transaction
            if (newData.type === 'buy') {
                const totalCost = total || (quantity * price);
                // Treasury Transaction (if Cash or Baridi)
                if (resolvedPaymentMethod === 'Espèces' || resolvedPaymentMethod === 'BaridiMob') {
                    const source = resolvedPaymentMethod === 'BaridiMob' ? 'BaridiMob' : 'Caisse';
                    const treasuryRef = userDocRef.collection('treasury_txs').doc(deterministicLinkedId(transactionId, 'treasury-buy-cash'));
                    batch.set(treasuryRef, {
                        timestamp,
                        date,
                        time,
                        type: 'Retrait',
                        source,
                        amount: totalCost,
                        notes: `Achat ${formatNumber(quantity, { min: 0, max: 2 })} ${newData.currency}`,
                        linkedTxId: transactionId,
                        origin: 'usdt_tx'
                    });
                    nextLinkedRows.push({ collection: 'treasury_txs', id: treasuryRef.id, role: 'linked', transactionType: 'treasury_tx' });
                    recordTreasuryShadow({
                        operationId: `shadow:transaction-update:buy:${transactionId}`,
                        actorUid: userDocRef.id,
                        effectiveAt: timestamp,
                        kind: 'portfolio_purchase_cash',
                        wallet: source,
                        amountDzd: totalCost,
                        currency: newData.currency === 'EUR' ? 'EUR' : 'USDT',
                    }, [{ type: 'Retrait', source, amount: totalCost }]);
                }
                // Client transaction is always stored for history.
                if (linkedClientId && linkedClientId !== 'none') {
                    const clientRef = userDocRef.collection('dzd_client_txs').doc(deterministicLinkedId(transactionId, 'client-buy'));
                    batch.set(clientRef, {
                        clientId: linkedClientId,
                        timestamp,
                        date,
                        time,
                        montant: totalCost,
                        type: 'Règlement Reçu',
                        notes: `Financement achat de ${formatNumber(quantity, { min: 0, max: 2 })} ${newData.currency}`,
                        linkedTxId: transactionId,
                        paymentMethod: resolvedPaymentMethod,
                        affectsBalance: resolvedPaymentMethod === 'Crédit'
                    });
                    nextLinkedRows.push({ collection: 'dzd_client_txs', id: clientRef.id, role: 'linked', transactionType: 'client_tx' });
                }
            }
            else if (newData.type === 'sell') {
                const totalRevenue = newData.totalRevenue || (quantity * sell);
                // Treasury Transaction (if Cash or Baridi)
                if (resolvedPaymentMethod === 'Espèces' || resolvedPaymentMethod === 'BaridiMob') {
                    const source = resolvedPaymentMethod === 'BaridiMob' ? 'BaridiMob' : 'Caisse';
                    const treasuryRef = userDocRef.collection('treasury_txs').doc(deterministicLinkedId(transactionId, 'treasury-sell-cash'));
                    batch.set(treasuryRef, {
                        timestamp,
                        date,
                        time,
                        type: 'Ajout',
                        source,
                        amount: totalRevenue,
                        notes: `Vente ${formatNumber(quantity, { min: 0, max: 2 })} USDT`,
                        linkedTxId: transactionId,
                        origin: 'usdt_tx'
                    });
                    nextLinkedRows.push({ collection: 'treasury_txs', id: treasuryRef.id, role: 'linked', transactionType: 'treasury_tx' });
                    recordTreasuryShadow({
                        operationId: `shadow:transaction-update:sell:${transactionId}`,
                        actorUid: userDocRef.id,
                        effectiveAt: timestamp,
                        kind: 'portfolio_sale_cash',
                        wallet: source,
                        amountDzd: totalRevenue,
                        currency: newData.currency === 'EUR' ? 'EUR' : 'USDT',
                    }, [{ type: 'Ajout', source, amount: totalRevenue }]);
                }
                // Client transaction is always stored for history.
                if (linkedClientId && linkedClientId !== 'none') {
                    const clientRef = userDocRef.collection('dzd_client_txs').doc(deterministicLinkedId(transactionId, 'client-sell'));
                    batch.set(clientRef, {
                        clientId: linkedClientId,
                        timestamp,
                        date,
                        time,
                        montant: -totalRevenue,
                        type: 'Vente USDT',
                        notes: `Vente de ${formatNumber(quantity, { min: 0, max: 2 })} USDT @ ${sell.toFixed(2)}`,
                        linkedTxId: transactionId,
                        paymentMethod: resolvedPaymentMethod,
                        affectsBalance: resolvedPaymentMethod === 'Crédit'
                    });
                    nextLinkedRows.push({ collection: 'dzd_client_txs', id: clientRef.id, role: 'linked', transactionType: 'client_tx' });
                }
            }
        }
        // For client_tx and treasury_tx updates, we typically don't recreate links
        // because they are usually edited directly through their own forms
        // The main use case for applyTransactionUpdate is for USDT transactions
        batch.set(operationIndexRef(userDocRef, transactionType, transactionId), createLegacyOperationIndexDoc({
            transactionId,
            transactionType,
            linkedRows: nextLinkedRows,
            updatedAt: Date.now(),
            status: 'active',
        }));
        await commitLegacyWithReadModelDeltas({
            userDocRef,
            batch,
            deltas: [],
        });
        return { success: true };
    }
    catch (e: any) {
        console.error('Error in applyTransactionUpdate:', e);
        return {
            success: false,
            error: e.message || 'Unknown error occurred during update'
        };
    }
}
