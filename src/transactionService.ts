import type { FirestoreDocumentReference } from './firebase';
import { formatNumber } from './pages/shared/pageFormat';
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
async function resolveDeletionTarget(transactionId: string, transactionType: TransactionType, userDocRef: FirestoreDocumentReference, visited = new Set<string>()): Promise<{
    transactionId: string;
    transactionType: TransactionType;
    error?: string;
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
        return { transactionId, transactionType };
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
            return { transactionId, transactionType };
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
        return resolveDeletionTarget(txData.linkedTxId, 'usdt_tx', userDocRef, visited);
    }
    return { transactionId, transactionType };
}
/**
 * Find all transactions linked to a given transaction ID
 * Searches across all collections for linkedTxId or linkedTreasuryTxId matches
 */
export async function findLinkedTransactions(transactionId: string, userDocRef: FirestoreDocumentReference): Promise<LinkedTransaction[]> {
    const linked: LinkedTransaction[] = [];
    try {
        // Search Client Transactions for linkedTxId
        const clientTxQuery = await userDocRef
            .collection('dzd_client_txs')
            .where('linkedTxId', '==', transactionId)
            .get();
        clientTxQuery.forEach(doc => {
            linked.push({
                id: doc.id,
                collection: 'dzd_client_txs',
                type: 'client_tx',
                data: doc.data()
            });
        });
        // Search Treasury Transactions for linkedTxId
        const treasuryTxQuery = await userDocRef
            .collection('treasury_txs')
            .where('linkedTxId', '==', transactionId)
            .get();
        treasuryTxQuery.forEach(doc => {
            linked.push({
                id: doc.id,
                collection: 'treasury_txs',
                type: 'treasury_tx',
                data: doc.data()
            });
        });
        // Search USDT/EUR Transactions for linkedTxId (used by conversion helper rows)
        const usdtTxQuery = await userDocRef
            .collection('usdt_txs')
            .where('linkedTxId', '==', transactionId)
            .get();
        usdtTxQuery.forEach(doc => {
            linked.push({
                id: doc.id,
                collection: 'usdt_txs',
                type: 'usdt_tx',
                data: doc.data()
            });
        });
        // Search Asset Transactions for linkedTreasuryTxId
        const assetTxQuery = await userDocRef
            .collection('actifTransactions')
            .where('linkedTreasuryTxId', '==', transactionId)
            .get();
        assetTxQuery.forEach(doc => {
            linked.push({
                id: doc.id,
                collection: 'actifTransactions',
                type: 'asset_tx',
                data: doc.data()
            });
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
}> {
    try {
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
        // Delete main transaction
        batch.delete(userDocRef.collection(mainCollection).doc(transactionId));
        // Find and delete all linked transactions
        const linkedTxs = await findLinkedTransactions(transactionId, userDocRef);
        for (const linkedTx of linkedTxs) {
            batch.delete(userDocRef.collection(linkedTx.collection).doc(linkedTx.id));
        }
        // Backward compatibility:
        // Older "buy USDT with EUR" flows created an extra EUR withdrawal row
        // without linkedTxId. If no linked USDT row was found, try to remove it safely.
        if (transactionType === 'usdt_tx') {
            const hasLinkedUsdtChild = linkedTxs.some(tx => tx.collection === 'usdt_txs');
            if (!hasLinkedUsdtChild) {
                const mainTxDoc = await userDocRef.collection('usdt_txs').doc(transactionId).get();
                const mainTxData = mainTxDoc.data() as any;
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
                        batch.delete(candidates[0].ref);
                    }
                }
            }
        }
        // For asset transactions, also check for linkedTreasuryTxId field
        if (transactionType === 'asset_tx') {
            const assetTxDoc = await userDocRef.collection('actifTransactions').doc(transactionId).get();
            const assetTxData = assetTxDoc.data();
            if (assetTxData?.linkedTreasuryTxId) {
                batch.delete(userDocRef.collection('treasury_txs').doc(assetTxData.linkedTreasuryTxId));
            }
        }
        await batch.commit();
        return { success: true };
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
        // Update main transaction
        const mainTxRef = userDocRef.collection(mainCollection).doc(transactionId);
        batch.update(mainTxRef, newData);
        // Find and delete all old linked transactions
        const linkedTxs = await findLinkedTransactions(transactionId, userDocRef);
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
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
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
                }
                // Client transaction is always stored for history.
                if (linkedClientId && linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
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
                }
            }
            else if (newData.type === 'sell') {
                const totalRevenue = newData.totalRevenue || (quantity * sell);
                // Treasury Transaction (if Cash or Baridi)
                if (resolvedPaymentMethod === 'Espèces' || resolvedPaymentMethod === 'BaridiMob') {
                    const source = resolvedPaymentMethod === 'BaridiMob' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
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
                }
                // Client transaction is always stored for history.
                if (linkedClientId && linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
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
                }
            }
        }
        // For client_tx and treasury_tx updates, we typically don't recreate links
        // because they are usually edited directly through their own forms
        // The main use case for applyTransactionUpdate is for USDT transactions
        await batch.commit();
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
