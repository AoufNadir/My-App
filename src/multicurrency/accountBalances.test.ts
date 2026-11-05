import assert from 'node:assert/strict';
import type { TreasuryTx } from '../types';
import { computeAccountBalances, otherAccountsTotal } from './accountBalances';

// M3: the cash box and BaridiMob come out exactly as the code that computed them before (copied below as the
// reference), on movements of every shape; created accounts add their own balances and touch nothing else.

function before(treasuryTransactions: any[]) {
    const normalizeZero = (value: number) => (Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : Number(value.toFixed(2)));
    const resolveWallet = (raw: any): 'Caisse' | 'BaridiMob' | null => {
        if (!raw) return null;
        const normalized = String(raw).toLowerCase();
        if (normalized.includes('caisse')) return 'Caisse';
        if (normalized.includes('baridi')) return 'BaridiMob';
        return null;
    };
    const parseLegacyTransfer = (rawAsset?: string) => {
        if (!rawAsset) return { from: null, to: null };
        const match = /from\s+(.+?)\s+to\s+(.+)/i.exec(rawAsset);
        if (!match) return { from: null, to: null };
        return { from: resolveWallet(match[1]), to: resolveWallet(match[2]) };
    };
    let caisse = 0, baridi = 0;
    treasuryTransactions.forEach((tx) => {
        const amount = Number(tx.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        if (tx.type === 'Transfer') {
            const legacy = parseLegacyTransfer(tx.asset);
            const from = resolveWallet(tx.source) || legacy.from;
            const to = resolveWallet(tx.destination) || legacy.to;
            if (!from || !to || from === to) return;
            if (from === 'Caisse') caisse -= amount;
            if (from === 'BaridiMob') baridi -= amount;
            if (to === 'Caisse') caisse += amount;
            if (to === 'BaridiMob') baridi += amount;
            return;
        }
        let factor = 0;
        if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)') factor = 1;
        else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)') factor = -1;
        const source = resolveWallet(tx.source) || (tx.asset === 'DZD-Caisse' ? 'Caisse' : tx.asset === 'DZD-Baridi' ? 'BaridiMob' : null);
        if (source === 'Caisse') caisse += amount * factor;
        if (source === 'BaridiMob') baridi += amount * factor;
    });
    return { caisse: normalizeZero(caisse), baridi: normalizeZero(baridi) };
}

// Movements of every shape the database holds, with amounts that do not round nicely.
const types = ['Ajout', 'Retrait', 'Adjustment (+)', 'Adjustment (-)', 'Transfer', 'Dépense', 'Expense'];
const sources = ['Caisse', 'BaridiMob', 'caisse principale', 'Baridi Mob', undefined, 'USDT', 'Revolut', ''];
const assets = [undefined, 'DZD-Caisse', 'DZD-Baridi', 'from Caisse to BaridiMob', 'from baridi to caisse', 'USDT', 'from Caisse to Revolut'];
const rows: any[] = [];
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 4_000; i++) {
    rows.push({
        id: `t${i}`,
        type: types[Math.floor(rnd() * types.length)],
        amount: [Math.round(rnd() * 900_000) / 100, -50, 0, 'abc', 1234.567][i % 23 === 0 ? 1 + (i % 4) : 0],
        source: sources[Math.floor(rnd() * sources.length)],
        destination: sources[Math.floor(rnd() * sources.length)],
        asset: assets[Math.floor(rnd() * assets.length)],
    });
}
for (let size = 0; size <= rows.length; size += 250) {
    const slice = rows.slice(0, size) as TreasuryTx[];
    const old = before(slice);
    const now = computeAccountBalances(slice);
    assert.equal(now.caisse, old.caisse, `cash box over ${size} movements`);
    assert.equal(now.baridi, old.baridi, `BaridiMob over ${size} movements`);
}

// A created account: its movements are its own; the cash box and BaridiMob do not move.
const revolut = { id: 'acc-1', name: 'Revolut', kind: 'online' as const };
const accounts = [{ id: 'Caisse', name: 'Caisse', kind: 'cash' as const }, { id: 'BaridiMob', name: 'BaridiMob', kind: 'bank' as const }, revolut];
const mixed = [
    { type: 'Ajout', amount: 1_000, source: 'Caisse' },
    { type: 'Ajout', amount: 500, source: 'Revolut' },
    { type: 'Transfer', amount: 200, source: 'Caisse', destination: 'acc-1' },
    { type: 'Retrait', amount: 50, source: 'acc-1' },
] as unknown as TreasuryTx[];
const result = computeAccountBalances(mixed, accounts);
assert.deepEqual(result.byAccount, { Caisse: 800, BaridiMob: 0, 'acc-1': 650 });
assert.equal(otherAccountsTotal(result), 650);
// Without the account, its movements are left out as before.
assert.deepEqual(computeAccountBalances(mixed).byAccount, { Caisse: 1_000, BaridiMob: 0 }, 'transfer to an unknown wallet ignored, as before');
console.log('accountBalances tests passed: cash box and BaridiMob equal to the previous code on 4 000 movements');

// The capital: with nothing new it is unchanged; a created account adds to the cash, another currency to the stock.
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';
{
    const base = { caisseBalance: 100_000, baridiBalance: 50_000, portfolioStats: { usdt: { available: 10, locked: 0, avgBuy: 250 }, eur: { available: 0, locked: 0, avgBuy: 0 } } as never, totalDettes: -20_000, totalAvances: 5_000, investorLiability: 30_000 };
    const plain = computeCapitalSnapshot(base);
    assert.deepEqual(computeCapitalSnapshot({ ...base, otherAccountsBalance: 0, otherHoldingsValue: 0 }), plain, 'nothing new: same capital');
    const more = computeCapitalSnapshot({ ...base, otherAccountsBalance: 650, otherHoldingsValue: 280_000 });
    assert.equal(more.cashTotal, plain.cashTotal + 650, 'the created account adds to the cash');
    assert.equal(more.stockValue, plain.stockValue + 280_000, 'the other currency adds to the stock');
    assert.equal(more.totalCapital, plain.totalCapital + 280_650);
    assert.equal(more.netOwnedCapital, plain.netOwnedCapital + 280_650);
    console.log('capital with created accounts and other currencies passed');
}
