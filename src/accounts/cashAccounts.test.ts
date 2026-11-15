import assert from 'node:assert/strict';
import { CASH_ACCOUNT_IDS, CASH_ACCOUNTS, checkCashAccount, readCustomAccounts, setCustomAccounts } from './cashAccounts';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';

// V15-2 (owner): dinar accounts beyond the Caisse and BaridiMob, added from the settings.
assert.deepEqual(CASH_ACCOUNT_IDS, ['Caisse', 'BaridiMob'], 'by default, as always');
const ok = checkCashAccount({ name: '  BNA  Centre ', kind: 'bank' }, CASH_ACCOUNTS, () => 'acc_x1');
assert.deepEqual(ok, { ok: true, account: { id: 'acc_x1', name: 'BNA Centre', kind: 'bank', custom: true } });
assert.equal((checkCashAccount({ name: 'B', kind: 'bank' }) as { reason: string }).reason, 'name');
assert.equal((checkCashAccount({ name: 'baridimob', kind: 'mobile' }) as { reason: string }).reason, 'taken');
assert.equal((checkCashAccount({ name: 'CCP', kind: '' }) as { reason: string }).reason, 'kind', 'no kind chosen in advance (rule 11)');
// The user document read safely: a bad id, a double or a missing kind is left out.
assert.deepEqual(readCustomAccounts([{ id: 'acc_a1', name: 'BNA', kind: 'bank' }, { id: 'acc_a1', name: 'Autre', kind: 'cash' }, { id: 'Caisse', name: 'X', kind: 'cash' }, { id: 'acc_b2', name: 'CCP', kind: 'x' }]).map((a) => a.id), ['acc_a1']);
assert.equal(setCustomAccounts(readCustomAccounts([{ id: 'acc_a1', name: 'BNA', kind: 'bank' }])), true);
assert.deepEqual(CASH_ACCOUNT_IDS, ['Caisse', 'BaridiMob', 'acc_a1'], 'the derived list follows');
// Their dinars count in the cash and the capital, like the Caisse and BaridiMob.
const snap = computeCapitalSnapshot({ caisseBalance: 1000, baridiBalance: 500, otherCashBalance: 250, totalDettes: 0, totalAvances: 0 });
assert.equal(snap.cashTotal, 1750);
assert.equal(snap.totalCapital, 1750);
assert.equal(computeCapitalSnapshot({ caisseBalance: 1000, baridiBalance: 500, totalDettes: 0, totalAvances: 0 }).cashTotal, 1500, 'none: as before');
setCustomAccounts([]);
assert.deepEqual(CASH_ACCOUNT_IDS, ['Caisse', 'BaridiMob']);
console.log('cashAccounts.test: dinar accounts added from the settings, counted in the cash and the capital');
