import assert from 'node:assert/strict';
import { CASH_ACCOUNTS, CASH_ACCOUNT_IDS, SHOWN_CASH_ACCOUNT_IDS, SHOWN_CUSTOM_CASH_ACCOUNTS, accountActions, readHiddenAccounts, setCustomAccounts, setHiddenAccounts } from './cashAccounts';
import { FINANCIAL_WALLETS } from '../components/ui/WalletPicker';

setCustomAccounts([{ id: 'acc_bna', name: 'BNA', kind: 'bank' }, { id: 'acc_ccp', name: 'CCP', kind: 'bank' }]);
assert.deepEqual(readHiddenAccounts(['BaridiMob', 'acc_bna', 'x', 5, 'acc_bna']), ['BaridiMob', 'acc_bna'], 'only real ids, once');

setHiddenAccounts(['BaridiMob', 'acc_bna']);
assert.deepEqual(SHOWN_CASH_ACCOUNT_IDS, ['Caisse', 'acc_ccp'], 'hidden accounts leave the choices');
assert.deepEqual(SHOWN_CUSTOM_CASH_ACCOUNTS.map((a) => a.id), ['acc_ccp']);
assert.ok(!FINANCIAL_WALLETS.includes('BaridiMob') && FINANCIAL_WALLETS.includes('Caisse'), 'wallet picker follows');
assert.deepEqual(CASH_ACCOUNT_IDS, ['Caisse', 'BaridiMob', 'acc_bna', 'acc_ccp'], 'balances and capital still count every account');

setHiddenAccounts(['Caisse', 'BaridiMob', 'acc_bna', 'acc_ccp']);
assert.equal(SHOWN_CASH_ACCOUNT_IDS.length, 4, 'never every account hidden');

const hidden = ['BaridiMob'];
assert.deepEqual(accountActions('acc_bna', { balance: 0, used: false }, hidden), { canHide: true, canDelete: true });
assert.deepEqual(accountActions('acc_bna', { balance: 0, used: true }, hidden), { canHide: true, canDelete: false }, 'used: hide only');
assert.deepEqual(accountActions('acc_bna', { balance: 500, used: false }, hidden), { canHide: false, canDelete: false }, 'money inside: neither');
assert.equal(accountActions('Caisse', { balance: 0, used: false }, hidden).canDelete, false, 'built-in accounts are never deleted');
assert.equal(accountActions('acc_ccp', { balance: 0, used: false }, ['Caisse', 'BaridiMob', 'acc_bna']).canHide, false, 'the last shown account stays');
setHiddenAccounts([]);
assert.equal(CASH_ACCOUNTS.length, 4);
console.log('hidden accounts tests passed');
