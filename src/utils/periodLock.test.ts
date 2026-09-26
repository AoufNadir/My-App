import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { db, FinancialWriteBlockedError, FirestoreTransaction, financialWriteRefusal, setFinancialWriteGate, type FinancialWrite } from '../firebase';
import { PeriodLockCard } from '../components/investors/PeriodLockCard';
import {
    closedMonthStarts,
    endOfPreviousMonth,
    findPeriodLockViolation,
    formatLockDate,
    formatLockMonth,
    isInLockedPeriod,
    lockAfterDistribution,
    lockAfterReopening,
    periodLockFields,
    periodLockHistoryEntry,
    savedTimestampFrom,
    startOfMonth,
} from './periodLock';

// Dates are local time, like the month boundaries.
const at = (month: number, day: number, hour = 10) => new Date(2026, month - 1, day, hour).getTime();
const END_OF_JULY = new Date(2026, 7, 1).getTime() - 1;
const END_OF_AUGUST = new Date(2026, 8, 1).getTime() - 1;
const END_OF_SEPTEMBER = new Date(2026, 9, 1).getTime() - 1;

// The audit example: a purchase in July, sold in August. Profits are distributed on
// 5 September. Deleting the July purchase afterwards would change the August profit that
// the investors were already paid.
const saved = {
    usdt_txs: [
        { id: 'buy-july', timestamp: at(7, 10) },
        { id: 'sell-august', timestamp: at(8, 20) },
        { id: 'buy-september', timestamp: at(9, 12) },
    ],
    dzd_client_txs: [{ id: 'payment-august', timestamp: at(8, 21) }],
    treasury_txs: [{ id: 'cash-august', timestamp: at(8, 21) }],
    investor_transactions: [{ id: 'capital-july', timestamp: at(7, 1) }],
};
const path = (collection: string, id: string) => `users/u/${collection}/${id}`;
const check = (lockedThrough: number | null, writes: FinancialWrite[]) => findPeriodLockViolation({
    lockedThrough,
    writes,
    savedTimestamp: savedTimestampFrom(saved),
});

// Month boundaries.
{
    assert.equal(startOfMonth(at(9, 5)), new Date(2026, 8, 1).getTime());
    assert.equal(endOfPreviousMonth(at(9, 5)), END_OF_AUGUST);
    assert.equal(endOfPreviousMonth(new Date(2026, 8, 1, 0, 0).getTime()), END_OF_AUGUST);
    assert.equal(endOfPreviousMonth(new Date(2026, 0, 15).getTime()), new Date(2026, 0, 1).getTime() - 1);
    assert.equal(isInLockedPeriod(END_OF_AUGUST, END_OF_AUGUST), true);
    assert.equal(isInLockedPeriod(END_OF_AUGUST + 1, END_OF_AUGUST), false);
    assert.equal(isInLockedPeriod(at(7, 1), null), false);
}

// A distribution closes every month before its own, and the lock never moves back.
{
    assert.equal(lockAfterDistribution(null, at(9, 5)), END_OF_AUGUST);
    assert.equal(lockAfterDistribution(END_OF_JULY, at(9, 5)), END_OF_AUGUST);
    // August is already closed: a second distribution in September changes nothing.
    assert.equal(lockAfterDistribution(END_OF_AUGUST, at(9, 28)), null);
    assert.equal(lockAfterDistribution(END_OF_SEPTEMBER, at(9, 28)), null);
    assert.equal(lockAfterDistribution(END_OF_AUGUST, at(10, 2)), END_OF_SEPTEMBER);
    assert.deepEqual(periodLockFields(END_OF_AUGUST, 'profit_distribution', at(9, 5)), {
        periodLockedThrough: END_OF_AUGUST,
        periodLockReason: 'profit_distribution',
        periodLockUpdatedAt: at(9, 5),
    });
    assert.deepEqual(periodLockHistoryEntry(null, END_OF_AUGUST, 'profit_distribution', at(9, 5)), {
        previousLockedThrough: 0,
        lockedThrough: END_OF_AUGUST,
        reason: 'profit_distribution',
        at: at(9, 5),
    });
    // "Reopen all" is saved as 0.
    assert.equal(periodLockFields(null, 'manual_reopen', at(9, 6)).periodLockedThrough, 0);
}

// After the distribution (closed through 31/08): July and August operations can be neither
// edited nor deleted, and nothing can be added with a date inside them.
{
    const lockedThrough = lockAfterDistribution(null, at(9, 5));
    assert.deepEqual(check(lockedThrough, [{ path: path('usdt_txs', 'buy-july'), kind: 'delete' }]),
        { collection: 'usdt_txs', docId: 'buy-july', timestamp: at(7, 10) });
    assert.ok(check(lockedThrough, [{ path: path('usdt_txs', 'sell-august'), kind: 'update', data: { sell: 260 } }]));
    assert.ok(check(lockedThrough, [{ path: path('dzd_client_txs', 'payment-august'), kind: 'set', data: { montant: 1 } }]));
    assert.ok(check(lockedThrough, [{ path: path('investor_transactions', 'capital-july'), kind: 'delete' }]));
    // A new operation dated in August, from `add` or from a batch `set` on a new document.
    assert.deepEqual(check(lockedThrough, [{ path: 'users/u/usdt_txs/_', kind: 'create', data: { timestamp: at(8, 25) } }]),
        { collection: 'usdt_txs', docId: '_', timestamp: at(8, 25) });
    assert.ok(check(lockedThrough, [{ path: path('treasury_txs', 'new-row'), kind: 'set', data: { timestamp: at(8, 25) } }]));
    // An open operation moved into August by an edit.
    assert.ok(check(lockedThrough, [{ path: path('usdt_txs', 'buy-september'), kind: 'update', data: { timestamp: at(8, 30) } }]));
    // One closed operation is enough to refuse the whole batch.
    assert.ok(check(lockedThrough, [
        { path: path('usdt_txs', 'buy-september'), kind: 'update', data: { quantity: 2 } },
        { path: path('treasury_txs', 'cash-august'), kind: 'delete' },
    ]));
}

// September stays open: its operations, new operations of today, entities (clients,
// investors, cards) and settings are not affected.
{
    const lockedThrough = END_OF_AUGUST;
    assert.equal(check(lockedThrough, [{ path: path('usdt_txs', 'buy-september'), kind: 'update', data: { quantity: 2, timestamp: at(9, 13) } }]), null);
    assert.equal(check(lockedThrough, [{ path: path('usdt_txs', 'buy-september'), kind: 'delete' }]), null);
    assert.equal(check(lockedThrough, [{ path: 'users/u/usdt_txs/_', kind: 'create', data: { timestamp: at(9, 26) } }]), null);
    assert.equal(check(lockedThrough, [{ path: path('investors', 'inv-1'), kind: 'update', data: { name: 'x', timestamp: at(7, 1) } }]), null);
    assert.equal(check(lockedThrough, [{ path: path('dzd_clients', 'client-1'), kind: 'delete' }]), null);
    assert.equal(check(lockedThrough, [{ path: 'users/u', kind: 'set', data: { timestamp: at(7, 1) } }]), null);
    assert.equal(check(lockedThrough, [{ path: 'po_orders/o1', kind: 'update', data: { timestamp: at(7, 1) } }]), null);
    // A document the app has not loaded is only judged by the date it is given.
    assert.equal(check(lockedThrough, [{ path: path('usdt_txs', 'unknown'), kind: 'update', data: { notes: 'x' } }]), null);
    // No closed month: nothing is refused.
    assert.equal(check(null, [{ path: path('usdt_txs', 'buy-july'), kind: 'delete' }]), null);
}

// Reopening July (with the months after it) makes the July purchase editable again.
{
    const reopened = lockAfterReopening(startOfMonth(at(7, 10)));
    assert.equal(reopened, new Date(2026, 6, 1).getTime() - 1);
    assert.equal(check(reopened, [{ path: path('usdt_txs', 'buy-july'), kind: 'delete' }]), null);
    assert.equal(check(reopened, [{ path: path('usdt_txs', 'sell-august'), kind: 'update', data: { sell: 260 } }]), null);
    // June stays closed.
    assert.ok(check(reopened, [{ path: 'users/u/usdt_txs/_', kind: 'create', data: { timestamp: at(6, 30) } }]));
    assert.deepEqual(closedMonthStarts(END_OF_AUGUST, 3), [at(8, 1, 0), at(7, 1, 0), at(6, 1, 0)]);
    assert.deepEqual(closedMonthStarts(null), []);
    assert.equal(formatLockMonth(at(8, 1), ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'Août']), 'Août 2026');
    assert.equal(formatLockDate(END_OF_AUGUST), '31/08/2026');
}

// The app's write gate refuses these writes before anything is sent, whatever the path:
// document, collection `add`, batch or transaction.
{
    const refused: string[] = [];
    setFinancialWriteGate({
        blockedReason: () => null,
        refusedWritesReason: (writes) => (check(END_OF_AUGUST, [...writes]) ? 'closed' : null),
        onBlocked: (reason) => refused.push(reason),
    });
    const userRef = db.collection('users').doc('u');
    await assert.rejects(userRef.collection('usdt_txs').doc('buy-july').delete(), FinancialWriteBlockedError);
    await assert.rejects(userRef.collection('usdt_txs').doc('sell-august').update({ sell: 260 }), FinancialWriteBlockedError);
    await assert.rejects(userRef.collection('treasury_txs').add({ timestamp: at(8, 25), amount: 1 }), FinancialWriteBlockedError);
    const batch = db.batch();
    batch.update(userRef.collection('usdt_txs').doc('buy-september'), { quantity: 2 });
    batch.delete(userRef.collection('dzd_client_txs').doc('payment-august'));
    await assert.rejects(batch.commit(), FinancialWriteBlockedError);

    const nativeCalls: string[] = [];
    const transaction = new FirestoreTransaction({
        set: () => { nativeCalls.push('set'); },
        update: () => { nativeCalls.push('update'); },
        delete: () => { nativeCalls.push('delete'); },
    } as never, db);
    assert.throws(() => transaction.delete(userRef.collection('investor_transactions').doc('capital-july')), FinancialWriteBlockedError);
    assert.throws(() => transaction.set(userRef.collection('usdt_txs').doc('new'), { timestamp: at(8, 2) }), FinancialWriteBlockedError);
    // Open-month writes go through.
    transaction.update(userRef.collection('usdt_txs').doc('buy-september'), { quantity: 2 });
    transaction.set(userRef.collection('usdt_txs').doc('new'), { timestamp: at(9, 26) });
    assert.deepEqual(nativeCalls, ['update', 'set']);
    assert.equal(financialWriteRefusal([{ path: path('usdt_txs', 'buy-september'), kind: 'delete' }]), null);
    // Strings (paths without data) still work as before.
    assert.equal(financialWriteRefusal([path('usdt_txs', 'buy-september')]), null);
    assert.ok(financialWriteRefusal([path('usdt_txs', 'buy-july')]) instanceof FinancialWriteBlockedError);

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(refused.length >= 7);
    assert.ok(refused.every((reason) => reason === 'closed'));
    setFinancialWriteGate(null);
}

// The card on the investors page shows the closed period and offers to reopen from any
// closed month, or to close last month when it is still open.
{
    const render = (lockedThrough: number | null) => renderToStaticMarkup(React.createElement(PeriodLockCard, {
        lockedThrough,
        reason: lockedThrough === null ? null : 'profit_distribution',
        updatedAt: lockedThrough === null ? null : at(9, 5),
        isLoaded: true,
        saveLockedThrough: async () => {},
        setAlert: () => {},
        nowMs: at(10, 3),
    })).replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ');
    const closed = render(END_OF_AUGUST);
    assert.match(closed, /Clôturé jusqu’au 31\/08\/2026/);
    assert.match(closed, /Dernier changement : 05\/09\/2026 \(distribution des profits\)/);
    assert.match(closed, /Août 2026\|+Juillet 2026/);
    assert.match(closed, /Tous les mois/);
    // September has ended and is not closed yet.
    assert.match(closed, /Clôturer jusqu’au 30\/09\/2026/);
    const open = render(null);
    assert.match(open, /Aucun mois clôturé/);
    assert.doesNotMatch(open, /Rouvrir à partir de/);
    assert.doesNotMatch(render(END_OF_SEPTEMBER), /Clôturer jusqu’au/);
}

console.log('periodLock tests passed');
