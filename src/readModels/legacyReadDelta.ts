/**
 * Legacy Read Delta Layer
 * 
 * Shared read layer for building old financial effects from actual legacy documents.
 * Reads main legacy doc + linked rows BEFORE any mutation.
 * Pure reads — no writes, no UI state dependency.
 */

import type { FirestoreDocumentReference } from '../firebase';
import { db } from '../firebase';

export interface LegacyLinkedRow {
    id: string;
    collection: string;
    transactionType: 'usdt_tx' | 'client_tx' | 'treasury_tx' | 'asset_tx' | 'digital_service_tx' | 'investor_tx' | 'personal_expense' | 'unknown';
    data: Record<string, unknown>;
}

export interface LegacyReadResult<TMain = Record<string, unknown>> {
    main: TMain | null;
    linkedRows: LegacyLinkedRow[];
    error?: string;
}

/**
 * Read USDT transaction (buy/sell) with all linked rows
 */
export async function readUsdtTxLegacy(
    txId: string,
    userDocRef: FirestoreDocumentReference
): Promise<LegacyReadResult> {
    try {
        const mainSnap = await userDocRef.collection('usdt_txs').doc(txId).get();
        if (!mainSnap.exists) {
            return { main: null, linkedRows: [], error: 'Main USDT tx not found' };
        }
        const main = { id: mainSnap.id, ...mainSnap.data() } as Record<string, unknown>;

        const linkedRows: LegacyLinkedRow[] = [];

        // Treasury linked rows
        const treasurySnap = await userDocRef
            .collection('treasury_txs')
            .where('linkedTxId', '==', txId)
            .get();
        treasurySnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'treasury_txs',
                transactionType: 'treasury_tx',
                data: doc.data(),
            });
        });

        // Portfolio linked rows (usdt_txs with linkedTxId)
        const portfolioSnap = await userDocRef
            .collection('usdt_txs')
            .where('linkedTxId', '==', txId)
            .get();
        portfolioSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'usdt_txs',
                transactionType: 'usdt_tx',
                data: doc.data(),
            });
        });

        // Client linked rows
        const clientSnap = await userDocRef
            .collection('dzd_client_txs')
            .where('linkedTxId', '==', txId)
            .get();
        clientSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'dzd_client_txs',
                transactionType: 'client_tx',
                data: doc.data(),
            });
        });

        return { main, linkedRows };
    } catch (e: any) {
        return { main: null, linkedRows: [], error: e.message };
    }
}

/**
 * Read Treasury transaction with linked rows
 */
export async function readTreasuryTxLegacy(
    txId: string,
    userDocRef: FirestoreDocumentReference
): Promise<LegacyReadResult> {
    try {
        const mainSnap = await userDocRef.collection('treasury_txs').doc(txId).get();
        if (!mainSnap.exists) {
            return { main: null, linkedRows: [], error: 'Main Treasury tx not found' };
        }
        const main = { id: mainSnap.id, ...mainSnap.data() } as Record<string, unknown>;

        const linkedRows: LegacyLinkedRow[] = [];

        // Linked USDT portfolio rows
        const portfolioSnap = await userDocRef
            .collection('usdt_txs')
            .where('linkedTxId', '==', txId)
            .get();
        portfolioSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'usdt_txs',
                transactionType: 'usdt_tx',
                data: doc.data(),
            });
        });

        // Linked client rows
        const clientSnap = await userDocRef
            .collection('dzd_client_txs')
            .where('linkedTxId', '==', txId)
            .get();
        clientSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'dzd_client_txs',
                transactionType: 'client_tx',
                data: doc.data(),
            });
        });

        // Linked investor transactions (for personal_expense)
        const investorSnap = await userDocRef
            .collection('investor_transactions')
            .where('linkedTreasuryTxId', '==', txId)
            .get();
        investorSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'investor_transactions',
                transactionType: 'investor_tx',
                data: doc.data(),
            });
        });

        // Linked digital service rows
        const digitalSnap = await userDocRef
            .collection('digital_service_txs')
            .where('linkedTreasuryTxIds', 'array-contains', txId)
            .get();
        digitalSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'digital_service_txs',
                transactionType: 'digital_service_tx',
                data: doc.data(),
            });
        });

        return { main, linkedRows };
    } catch (e: any) {
        return { main: null, linkedRows: [], error: e.message };
    }
}

/**
 * Read Client transaction with linked rows
 */
export async function readClientTxLegacy(
    txId: string,
    userDocRef: FirestoreDocumentReference
): Promise<LegacyReadResult> {
    try {
        const mainSnap = await userDocRef.collection('dzd_client_txs').doc(txId).get();
        if (!mainSnap.exists) {
            return { main: null, linkedRows: [], error: 'Main Client tx not found' };
        }
        const main = { id: mainSnap.id, ...mainSnap.data() } as Record<string, unknown>;

        const linkedRows: LegacyLinkedRow[] = [];

        // Counterpart transfer (linkedTxId points to outgoing/incoming)
        const counterpartSnap = await userDocRef
            .collection('dzd_client_txs')
            .where('linkedTxId', '==', txId)
            .get();
        counterpartSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'dzd_client_txs',
                transactionType: 'client_tx',
                data: doc.data(),
            });
        });

        // Parent USDT/Treasury tx (linkedTxId on client points to parent)
        if (main.linkedTxId) {
            const parentClientSnap = await userDocRef.collection('dzd_client_txs').doc(main.linkedTxId as string).get();
            if (parentClientSnap.exists) {
                linkedRows.push({
                    id: parentClientSnap.id,
                    collection: 'dzd_client_txs',
                    transactionType: 'client_tx',
                    data: parentClientSnap.data(),
                });
            } else {
                const parentUsdtSnap = await userDocRef.collection('usdt_txs').doc(main.linkedTxId as string).get();
                if (parentUsdtSnap.exists) {
                linkedRows.push({
                    id: parentUsdtSnap.id,
                    collection: 'usdt_txs',
                    transactionType: 'usdt_tx',
                    data: parentUsdtSnap.data(),
                });
                } else {
                    const parentTreasurySnap = await userDocRef.collection('treasury_txs').doc(main.linkedTxId as string).get();
                    if (parentTreasurySnap.exists) {
                        linkedRows.push({
                            id: parentTreasurySnap.id,
                            collection: 'treasury_txs',
                            transactionType: 'treasury_tx',
                            data: parentTreasurySnap.data(),
                        });
                    }
                }
            }
        }

        return { main, linkedRows };
    } catch (e: any) {
        return { main: null, linkedRows: [], error: e.message };
    }
}

/**
 * Read Digital Service transaction with linked rows
 */
export async function readDigitalServiceTxLegacy(
    txId: string,
    userDocRef: FirestoreDocumentReference
): Promise<LegacyReadResult> {
    try {
        const mainSnap = await userDocRef.collection('digital_service_txs').doc(txId).get();
        if (!mainSnap.exists) {
            return { main: null, linkedRows: [], error: 'Main Digital Service tx not found' };
        }
        const main = { id: mainSnap.id, ...mainSnap.data() } as Record<string, unknown>;

        const linkedRows: LegacyLinkedRow[] = [];

        // Linked treasury rows
        const treasurySnap = await userDocRef
            .collection('treasury_txs')
            .where('linkedDigitalServiceTxId', '==', txId)
            .get();
        treasurySnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'treasury_txs',
                transactionType: 'treasury_tx',
                data: doc.data(),
            });
        });

        // Linked portfolio rows
        const portfolioSnap = await userDocRef
            .collection('usdt_txs')
            .where('linkedDigitalServiceTxId', '==', txId)
            .get();
        portfolioSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'usdt_txs',
                transactionType: 'usdt_tx',
                data: doc.data(),
            });
        });

        // Linked client rows
        const clientSnap = await userDocRef
            .collection('dzd_client_txs')
            .where('linkedDigitalServiceTxId', '==', txId)
            .get();
        clientSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'dzd_client_txs',
                transactionType: 'client_tx',
                data: doc.data(),
            });
        });

        return { main, linkedRows };
    } catch (e: any) {
        return { main: null, linkedRows: [], error: e.message };
    }
}

/**
 * Read Personal Expense (treasury_tx origin=personal_expense) with linked rows
 */
export async function readPersonalExpenseLegacy(
    txId: string,
    userDocRef: FirestoreDocumentReference
): Promise<LegacyReadResult> {
    try {
        const mainSnap = await userDocRef.collection('treasury_txs').doc(txId).get();
        if (!mainSnap.exists) {
            return { main: null, linkedRows: [], error: 'Main Personal Expense tx not found' };
        }
        const main = { id: mainSnap.id, ...mainSnap.data() } as Record<string, unknown>;

        const linkedRows: LegacyLinkedRow[] = [];

        // Linked investor transactions (profit + capital)
        const investorSnap = await userDocRef
            .collection('investor_transactions')
            .where('linkedTreasuryTxId', '==', txId)
            .get();
        investorSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'investor_transactions',
                transactionType: 'investor_tx',
                data: doc.data(),
            });
        });

        // Linked portfolio rows (manual asset withdrawal)
        const portfolioSnap = await userDocRef
            .collection('usdt_txs')
            .where('linkedPersonalExpenseTxId', '==', txId)
            .get();
        portfolioSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'usdt_txs',
                transactionType: 'usdt_tx',
                data: doc.data(),
            });
        });

        // Return docs (for advances)
        const returnSnap = await userDocRef
            .collection('treasury_txs')
            .where('linkedTreasuryTxId', '==', txId)
            .where('origin', '==', 'personal_expense_return')
            .get();
        returnSnap.docs.forEach(doc => {
            linkedRows.push({
                id: doc.id,
                collection: 'treasury_txs',
                transactionType: 'treasury_tx',
                data: doc.data(),
            });
        });

        return { main, linkedRows };
    } catch (e: any) {
        return { main: null, linkedRows: [], error: e.message };
    }
}

/**
 * Read Investor transaction with linked rows
 */
export async function readInvestorTxLegacy(
    txId: string,
    userDocRef: FirestoreDocumentReference
): Promise<LegacyReadResult> {
    try {
        const mainSnap = await userDocRef.collection('investor_transactions').doc(txId).get();
        if (!mainSnap.exists) {
            return { main: null, linkedRows: [], error: 'Main Investor tx not found' };
        }
        const main = { id: mainSnap.id, ...mainSnap.data() } as Record<string, unknown>;

        const linkedRows: LegacyLinkedRow[] = [];

        // Linked treasury tx
        if (main.linkedTreasuryTxId) {
            const treasurySnap = await userDocRef.collection('treasury_txs').doc(main.linkedTreasuryTxId as string).get();
            if (treasurySnap.exists) {
                linkedRows.push({
                    id: treasurySnap.id,
                    collection: 'treasury_txs',
                    transactionType: 'treasury_tx',
                    data: treasurySnap.data(),
                });
            }
        }

        return { main, linkedRows };
    } catch (e: any) {
        return { main: null, linkedRows: [], error: e.message };
    }
}

/**
 * Read Manual Asset transaction with linked rows
 */
export async function readManualAssetTxLegacy(
    txId: string,
    userDocRef: FirestoreDocumentReference
): Promise<LegacyReadResult> {
    try {
        const mainSnap = await userDocRef.collection('actifTransactions').doc(txId).get();
        if (!mainSnap.exists) {
            return { main: null, linkedRows: [], error: 'Main Manual Asset tx not found' };
        }
        const main = { id: mainSnap.id, ...mainSnap.data() } as Record<string, unknown>;

        const linkedRows: LegacyLinkedRow[] = [];

        // Linked treasury tx
        if (main.linkedTreasuryTxId) {
            const treasurySnap = await userDocRef.collection('treasury_txs').doc(main.linkedTreasuryTxId as string).get();
            if (treasurySnap.exists) {
                linkedRows.push({
                    id: treasurySnap.id,
                    collection: 'treasury_txs',
                    transactionType: 'treasury_tx',
                    data: treasurySnap.data(),
                });
            }
        }

        return { main, linkedRows };
    } catch (e: any) {
        return { main: null, linkedRows: [], error: e.message };
    }
}

/**
 * Generic reader by collection
 */
export async function readLegacyTxByCollection(
    collection: string,
    txId: string,
    userDocRef: FirestoreDocumentReference
): Promise<LegacyReadResult> {
    switch (collection) {
        case 'usdt_txs':
            return readUsdtTxLegacy(txId, userDocRef);
        case 'treasury_txs':
            return readTreasuryTxLegacy(txId, userDocRef);
        case 'dzd_client_txs':
            return readClientTxLegacy(txId, userDocRef);
        case 'digital_service_txs':
            return readDigitalServiceTxLegacy(txId, userDocRef);
        case 'investor_transactions':
            return readInvestorTxLegacy(txId, userDocRef);
        case 'actifTransactions':
            return readManualAssetTxLegacy(txId, userDocRef);
        default:
            return { main: null, linkedRows: [], error: `Unknown collection: ${collection}` };
    }
}
