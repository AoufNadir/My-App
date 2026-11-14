import assert from 'node:assert/strict';
// V14-5 (accounting tour): random histories of buys (some locked 24h), sales, withdrawals, conversions and sales for
// another currency, in USDT, EUR and RMB. Whatever happens, every dinar of cost is either still in a stock, or left
// with a sale or a withdrawal: a conversion moves it, it never creates or loses any. And each stock equals what came
// in minus what went out. Found: USDT → EUR → USDT lost the cost of the EUR leg (the USDT came in at 0 DZD).
import { computePamLedger } from './pamLedger';
for (const start of [1, 7, 42]) {
let seed = start;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const C = ['USDT', 'EUR', 'RMB'];
let bad = 0;
for (let run = 0; run < 400; run++) {
  const txs: any[] = []; let t = Date.UTC(2026, 10, 15); const hold: Record<string, number> = { USDT: 0, EUR: 0, RMB: 0 };
  let dzdIn = 0; let n = 0;
  for (let i = 0; i < 25; i++) {
    t += 1000 + Math.floor(rnd() * 5000);
    const c = C[Math.floor(rnd() * 3)]; const r = rnd();
    const id = `t${n++}`;
    if (r < 0.35 || hold[c] < 1) {
      const q = Math.round(1 + rnd() * 500); const p = Math.round(100 + rnd() * 200);
      txs.push({ id, type: 'buy', currency: c, quantity: q, price: p, total: q * p, timestamp: t, lockedUntil: rnd() < 0.3 ? t + 86400000 : undefined }); hold[c] += q; dzdIn += q * p;
    } else if (r < 0.6) {
      const q = Math.round(1 + rnd() * hold[c]); if (q > hold[c]) continue;
      const p = Math.round(100 + rnd() * 200);
      txs.push({ id, type: 'sell', currency: c, quantity: q, sell: p, total: q * p, timestamp: t }); hold[c] -= q;
    } else if (r < 0.75) {
      const q = Math.round(1 + rnd() * hold[c]); if (q > hold[c]) continue;
      txs.push({ id, type: 'Retrait Manuel', currency: c, quantity: q, timestamp: t }); hold[c] -= q;
    } else if (r < 0.85) {
      const d = C.filter((x) => x !== c)[Math.floor(rnd() * 2)];
      const q = Math.round(1 + rnd() * hold[c]); if (q > hold[c]) continue;
      const qd = Math.round(1 + rnd() * 600); const avg = Math.round(100 + rnd() * 200); const v = qd * avg;
      txs.push({ id, type: 'sell', currency: c, quantity: q, sell: Math.round(v / q * 100) / 100, total: v, timestamp: t, crossTrade: true });
      txs.push({ id: id + 'r', type: 'buy', currency: d, quantity: qd, price: avg, total: v, timestamp: t + 1, linkedTxId: id, crossTrade: true });
      hold[c] -= q; hold[d] += qd; dzdIn += v;
    } else {
      // conversion c -> d
      const d = C.filter((x) => x !== c)[Math.floor(rnd() * 2)];
      const q = Math.round(1 + rnd() * hold[c]); if (q > hold[c]) continue;
      const qd = Math.round(1 + rnd() * 600);
      txs.push({ id: id + 'o', type: 'Retrait Manuel', currency: c, quantity: q, timestamp: t - 1, linkedTxId: id, conversionLeg: 'out' });
      txs.push({ id, type: 'buy', currency: d, quantity: qd, price: 0, total: 0, timestamp: t, conversionFrom: c });
      hold[c] -= q; hold[d] += qd;
    }
  }
  const L = computePamLedger(txs, { nowMs: Infinity });
  const convOut = new Set(txs.filter((x) => x.conversionLeg === 'out').map((x) => x.id));
  let sold = 0, removed = 0;
  for (const row of L.operationRows) {
    if (row.type === 'sell') sold += -row.costBasisChange;
    else if (row.type === 'Retrait Manuel' && !convOut.has(row.txId)) removed += -row.costBasisChange;
  }
  const left = C.reduce((s, c) => s + (L.holdings[c]?.costBasis || 0), 0);
  const diff = dzdIn - sold - removed - left;
  for (const c of C) { const h = L.holdings[c]; if (h && Math.abs(h.available - hold[c]) > 0.01) { bad++; if (bad < 5) console.log('qty', run, c, h.available, hold[c]); } }
  if (Math.abs(diff) > 0.05 * txs.length) { bad++; if (bad === 1) { console.log('cost leak', run, diff.toFixed(2)); for (const r of L.operationRows) console.log(r.txId, r.type, r.currency, r.quantity, r.costBasisChange, r.statsAfter.available, r.statsAfter.costBasis, (r.tx as any).linkedTxId||''); console.log(JSON.stringify(L.conversions.map(c=>[c.buyTxId,c.fromCurrency,c.toCurrency,c.ledgerCost,c.applied]))); } }
}
assert.equal(bad, 0, `seed ${start}: cost or quantity leak`);
}
{
    // The case found: 100 USDT at 100 DZD; 50 USDT converted to 40 EUR; those 40 EUR converted back to 60 USDT.
    const T0 = Date.UTC(2026, 10, 15);
    const book: any[] = [
        { id: 'b', type: 'buy', currency: 'USDT', quantity: 100, price: 100, total: 10000, timestamp: T0 },
        { id: 'o1', type: 'Retrait Manuel', currency: 'USDT', quantity: 50, timestamp: T0 + 999, linkedTxId: 'e', conversionLeg: 'out' },
        { id: 'e', type: 'buy', currency: 'EUR', quantity: 40, price: 0, total: 0, timestamp: T0 + 1000 },
        { id: 'o2', type: 'Retrait Manuel', currency: 'EUR', quantity: 40, timestamp: T0 + 1999, linkedTxId: 'u', conversionLeg: 'out' },
        { id: 'u', type: 'buy', currency: 'USDT', quantity: 60, price: 0, total: 0, timestamp: T0 + 2000 },
    ];
    const ledger = computePamLedger(book, { nowMs: T0 });
    assert.equal(ledger.portfolioStats.usdt.available, 110);
    assert.equal(ledger.portfolioStats.usdt.costBasis, 10000, 'the 5 000 DZD of the converted USDT came back with them (was 5 000: lost)');
}
console.log('pamLedgerConservation.test: no dinar of cost is created or lost, in any currency, whatever the history');
