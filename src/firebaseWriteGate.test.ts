import assert from 'node:assert/strict';

import { db, FinancialWriteBlockedError, FirestoreTransaction, financialWriteRefusal, setFinancialWriteGate } from './firebase';

// No request in this file reaches Firestore: every write below is refused by the gate
// before the SDK is called, and the transaction uses a stub.
const userRef = db.collection('users').doc('gate-test-user');
const blockedReasons: string[] = [];
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Without a gate, or once the server has answered, nothing is refused.
{
    setFinancialWriteGate(null);
    assert.equal(financialWriteRefusal(['users/u/usdt_txs/a']), null);
    setFinancialWriteGate({ blockedReason: () => null });
    assert.equal(financialWriteRefusal(['users/u/usdt_txs/a']), null);
}

setFinancialWriteGate({ blockedReason: () => 'sync', onBlocked: (reason) => blockedReasons.push(reason) });

// While syncing, every financial collection is refused; settings and portal orders are not.
{
    for (const collection of ['usdt_txs', 'dzd_clients', 'dzd_client_txs', 'treasury_txs', 'treasury_cards',
        'digital_service_txs', 'manual_assets', 'manual_asset_clients', 'actifTransactions', 'investors', 'investor_transactions']) {
        assert.ok(financialWriteRefusal([`users/u/${collection}/a`]) instanceof FinancialWriteBlockedError, collection);
    }
    assert.equal(financialWriteRefusal(['users/u']), null);
    assert.equal(financialWriteRefusal(['users/u/settings/app']), null);
    assert.equal(financialWriteRefusal(['po_orders/o1']), null);
    assert.ok(financialWriteRefusal(['po_orders/o1', 'users/u/usdt_txs/a']) instanceof FinancialWriteBlockedError);
}

// Documents, collections and batches are refused before anything is sent.
{
    await assert.rejects(userRef.collection('usdt_txs').doc('a').set({ quantity: 1 }), FinancialWriteBlockedError);
    await assert.rejects(userRef.collection('treasury_txs').doc('b').update({ amount: 1 }), FinancialWriteBlockedError);
    await assert.rejects(userRef.collection('dzd_client_txs').doc('c').delete(), FinancialWriteBlockedError);
    await assert.rejects(userRef.collection('investors').add({ name: 'x' }), FinancialWriteBlockedError);
    const batch = db.batch();
    batch.set(userRef.collection('investor_transactions').doc('d'), { amount: 1 });
    await assert.rejects(batch.commit(), FinancialWriteBlockedError);
}

// Transactions (order completion) are refused too, and nothing reaches the native transaction.
{
    const nativeCalls: string[] = [];
    const nativeTransaction = {
        set: () => { nativeCalls.push('set'); },
        update: () => { nativeCalls.push('update'); },
        delete: () => { nativeCalls.push('delete'); },
    };
    const transaction = new FirestoreTransaction(nativeTransaction as never, db);
    const sellRef = userRef.collection('usdt_txs').doc('sell');
    assert.throws(() => transaction.set(sellRef, { quantity: 1 }), FinancialWriteBlockedError);
    assert.throws(() => transaction.update(userRef.collection('treasury_txs').doc('t'), { amount: 1 }), FinancialWriteBlockedError);
    assert.throws(() => transaction.delete(userRef.collection('dzd_client_txs').doc('c')), FinancialWriteBlockedError);
    assert.deepEqual(nativeCalls, []);
    // A non-financial document in the same transaction still goes through.
    transaction.update(db.collection('po_orders').doc('o1'), { status: 'done' });
    assert.deepEqual(nativeCalls, ['update']);

    // Once synced, the same transaction writes go through.
    setFinancialWriteGate({ blockedReason: () => null });
    transaction.set(sellRef, { quantity: 1 });
    assert.deepEqual(nativeCalls, ['update', 'set']);
}

// The user sees the sync message for each refused write.
await tick();
assert.ok(blockedReasons.length >= 8);
assert.ok(blockedReasons.every((reason) => reason === 'sync'));

setFinancialWriteGate(null);
console.log('firebaseWriteGate tests passed');
