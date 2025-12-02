import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

type TransactionType = 'usdt_tx' | 'client_tx' | 'treasury_tx' | 'asset_tx';

interface LinkedTransaction {
    id: string;
    collection: string;
    type: TransactionType;
    data: any;
}

/**
 * Find all transactions linked to a given transaction ID
 * Searches across all collections for linkedTxId or linkedTreasuryTxId matches
 */
export async function findLinkedTransactions(
    transactionId: string,
    userDocRef: firebase.firestore.DocumentReference
): Promise<LinkedTransaction[]> {
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

    } catch (e) {
        console.error('Error finding linked transactions:', e);
    }

    return linked;
}

/**
 * Delete a transaction and all its linked transactions
 * Uses Firestore batch for atomic operations
 */
export async function applyTransactionDelete(
    transactionId: string,
    transactionType: TransactionType,
    userDocRef: firebase.firestore.DocumentReference
): Promise<{ success: boolean; error?: string }> {
    try {
        const batch = userDocRef.firestore.batch();

        // Get the collection name based on type
        const collectionMap: Record<TransactionType, string> = {
            'usdt_tx': 'usdt_txs',
            'client_tx': 'dzd_client_txs',
            'treasury_tx': 'treasury_txs',
            'asset_tx': 'actifTransactions'
        };

        const mainCollection = collectionMap[transactionType];

        // For treasury and client transactions, check if they're children (have origin or are linked)
        if (transactionType === 'treasury_tx' || transactionType === 'client_tx') {
            const txDoc = await userDocRef.collection(mainCollection).doc(transactionId).get();
            const txData = txDoc.data();

            if (txData) {
                // Check if transaction has origin (meaning it's a child)
                if (transactionType === 'treasury_tx' &&
                    (txData.origin === 'client_tx' || txData.origin === 'usdt_tx' ||
                        txData.origin === 'manual_asset' || (txData.linkedTxId && !txData.origin))) {
                    return {
                        success: false,
                        error: 'Cannot delete: This transaction is linked to another transaction. Delete the parent transaction instead.'
                    };
                }

                if (transactionType === 'client_tx' && txData.origin === 'adjustment') {
                    return {
                        success: false,
                        error: 'Cannot delete: This transaction is linked to a treasury adjustment. Delete the adjustment instead.'
                    };
                }
            }
        }

        // Delete main transaction
        batch.delete(userDocRef.collection(mainCollection).doc(transactionId));

        // Find and delete all linked transactions
        const linkedTxs = await findLinkedTransactions(transactionId, userDocRef);

        for (const linkedTx of linkedTxs) {
            batch.delete(userDocRef.collection(linkedTx.collection).doc(linkedTx.id));
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

    } catch (e: any) {
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
export async function applyTransactionUpdate(
    transactionId: string,
    transactionType: TransactionType,
    newData: any,
    userDocRef: firebase.firestore.DocumentReference
): Promise<{ success: boolean; error?: string }> {
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

            // Determine if we need a treasury or client transaction
            if (newData.type === 'buy') {
                const totalCost = total || (quantity * price);

                // Treasury Transaction (if Cash or Baridi)
                if (paymentMethod === 'Espèces' || paymentMethod === 'BaridiMob') {
                    const source = paymentMethod === 'BaridiMob' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp,
                        date,
                        time,
                        type: 'Retrait',
                        source,
                        amount: totalCost,
                        notes: `Achat ${quantity.toFixed(2)} ${newData.currency}`,
                        linkedTxId: transactionId,
                        origin: 'usdt_tx'
                    });
                }

                // Client Transaction (if Credit)
                if (paymentMethod === 'Crédit' && linkedClientId && linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId,
                        timestamp,
                        date,
                        time,
                        montant: totalCost,
                        type: 'Règlement Reçu',
                        notes: `Financement achat de ${quantity.toFixed(2)} ${newData.currency}`,
                        linkedTxId: transactionId,
                        paymentMethod: 'Crédit'
                    });
                }
            } else if (newData.type === 'sell') {
                const totalRevenue = newData.totalRevenue || (quantity * sell);

                // Treasury Transaction (if Cash or Baridi)
                if (paymentMethod === 'Espèces' || paymentMethod === 'BaridiMob') {
                    const source = paymentMethod === 'BaridiMob' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp,
                        date,
                        time,
                        type: 'Ajout',
                        source,
                        amount: totalRevenue,
                        notes: `Vente ${quantity.toFixed(2)} USDT`,
                        linkedTxId: transactionId,
                        origin: 'usdt_tx'
                    });
                }

                // Client Transaction (if Credit)
                if (paymentMethod === 'Crédit' && linkedClientId && linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId,
                        timestamp,
                        date,
                        time,
                        montant: -totalRevenue,
                        type: 'Vente USDT',
                        notes: `Vente de ${quantity.toFixed(2)} USDT @ ${sell.toFixed(2)}`,
                        linkedTxId: transactionId,
                        paymentMethod: 'Crédit'
                    });
                }
            }
        }

        // For client_tx and treasury_tx updates, we typically don't recreate links
        // because they are usually edited directly through their own forms
        // The main use case for applyTransactionUpdate is for USDT transactions

        await batch.commit();

        return { success: true };

    } catch (e: any) {
        console.error('Error in applyTransactionUpdate:', e);
        return {
            success: false,
            error: e.message || 'Unknown error occurred during update'
        };
    }
}
