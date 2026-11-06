import assert from 'node:assert/strict';
import { accountMovementRow, checkAccountMovement } from './accountMovements';
import { computeAccountBalances } from './accountBalances';
import type { TreasuryTx } from '../types';

// M3: an opening balance and transfers for a created account, read back by the account balances.
const caisse = { id: 'Caisse', name: 'Caisse', kind: 'cash' as const };
const baridi = { id: 'BaridiMob', name: 'BaridiMob', kind: 'bank' as const };
const revolut = { id: 'acc-1', name: 'Revolut', kind: 'online' as const };
const accounts = [caisse, baridi, revolut];
const now = new Date(2026, 10, 6, 10).getTime();
const rows: TreasuryTx[] = [{ type: 'Ajout', source: 'Caisse', amount: 100_000, timestamp: 1 } as unknown as TreasuryTx];
const opening = accountMovementRow({ kind: 'opening', account: revolut, amount: 5_000 }, now);
assert.equal(opening.origin, 'account_opening');
rows.push(opening as unknown as TreasuryTx);
const t1 = accountMovementRow({ kind: 'transfer', from: caisse, to: revolut, amount: 20_000 }, now);
rows.push(t1 as unknown as TreasuryTx);
const balances = computeAccountBalances(rows, accounts).byAccount;
assert.deepEqual(balances, { Caisse: 80_000, BaridiMob: 0, 'acc-1': 25_000 }, 'opening and transfer move the right accounts');
// Total money never changes in a transfer.
const total = (b: Record<string, number>) => Object.values(b).reduce((a, v) => a + v, 0);
assert.equal(total(balances), 105_000);
// Checks
assert.deepEqual(checkAccountMovement({ kind: 'transfer', from: revolut, to: revolut, amount: 1 }, balances), { ok: false, reason: 'same_account' });
assert.deepEqual(checkAccountMovement({ kind: 'transfer', from: revolut, to: caisse, amount: 25_000.01 }, balances), { ok: false, reason: 'insufficient' });
assert.deepEqual(checkAccountMovement({ kind: 'transfer', from: revolut, to: caisse, amount: 25_000 }, balances), { ok: true });
assert.deepEqual(checkAccountMovement({ kind: 'opening', account: revolut, amount: 0 }, balances), { ok: false, reason: 'amount' });
console.log('account movements tests passed');
