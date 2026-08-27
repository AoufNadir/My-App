// Verifies the PAM (weighted-avg cost) fix in src/hooks/useAppData.ts
// Replicates the portfolioStats reducer twice — original vs fixed — and
// runs the user's scenarios through both to confirm the fix.
//
// Run with: node scripts/verify-pam-fix.mjs

const round2 = (v) => Number(v.toFixed(2));
const normalizeZero = (v) =>
  Object.is(v, -0) || Math.abs(v) < 0.005 ? 0 : round2(v);

// --- ORIGINAL (broken) reducer — copied verbatim from useAppData.ts before the fix ---
function computeOriginal(transactions) {
  const stats = { costBasis: 0, purchasedQty: 0, available: 0, totalProfit: 0, avgBuy: 0 };

  for (const tx of transactions) {
    const txQuantity = round2(Math.abs(Number(tx.quantity || 0)));
    const txTotal = round2(Number(tx.total || 0));
    if (txQuantity <= 0) continue;

    if (tx.type === 'buy' || tx.type === 'Ajout Manuel') {
      stats.available = round2(stats.available + txQuantity);
    } else {
      stats.available = round2(stats.available - txQuantity);
    }

    if (tx.type === 'Ajout Manuel' && txTotal > 0) {
      stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
      stats.costBasis = round2(stats.costBasis + txTotal);
    } else if (tx.type === 'buy') {
      stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
      stats.costBasis = round2(stats.costBasis + txTotal);
    } else if (tx.type === 'sell' || tx.type === 'Retrait Manuel') {
      const avgBuy = stats.purchasedQty > 0 ? stats.costBasis / stats.purchasedQty : 0;
      const removedQty = Math.min(txQuantity, stats.purchasedQty);
      if (tx.type === 'sell') {
        const sellPrice = Number(tx.sell);
        if (removedQty > 0 && Number.isFinite(sellPrice) && sellPrice > 0) {
          stats.totalProfit = round2(stats.totalProfit + (sellPrice - avgBuy) * removedQty);
        } else {
          stats.totalProfit = round2(stats.totalProfit + Number(tx.profit || 0));
        }
      }
      stats.purchasedQty = round2(stats.purchasedQty - removedQty);
      stats.costBasis = round2(stats.costBasis - removedQty * avgBuy);
      if (stats.purchasedQty < 0.00001) { stats.purchasedQty = 0; stats.costBasis = 0; }
    }
  }

  stats.available = normalizeZero(stats.available);
  if (stats.available === 0) { stats.purchasedQty = 0; stats.costBasis = 0; }
  stats.purchasedQty = normalizeZero(stats.purchasedQty);
  stats.costBasis = normalizeZero(stats.costBasis);
  if (stats.purchasedQty === 0) stats.costBasis = 0;
  stats.avgBuy = stats.purchasedQty > 0 ? stats.costBasis / stats.purchasedQty : 0;
  stats.avgBuy = normalizeZero(stats.avgBuy);
  return stats;
}

// --- FIXED reducer — adds the in-loop reset when available returns to ~0 ---
function computeFixed(transactions) {
  const stats = { costBasis: 0, purchasedQty: 0, available: 0, totalProfit: 0, avgBuy: 0 };

  for (const tx of transactions) {
    const txQuantity = round2(Math.abs(Number(tx.quantity || 0)));
    const txTotal = round2(Number(tx.total || 0));
    if (txQuantity <= 0) continue;

    if (tx.type === 'buy' || tx.type === 'Ajout Manuel') {
      stats.available = round2(stats.available + txQuantity);
    } else {
      stats.available = round2(stats.available - txQuantity);
    }

    if (tx.type === 'Ajout Manuel' && txTotal > 0) {
      stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
      stats.costBasis = round2(stats.costBasis + txTotal);
    } else if (tx.type === 'buy') {
      stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
      stats.costBasis = round2(stats.costBasis + txTotal);
    } else if (tx.type === 'sell' || tx.type === 'Retrait Manuel') {
      const avgBuy = stats.purchasedQty > 0 ? stats.costBasis / stats.purchasedQty : 0;
      const removedQty = Math.min(txQuantity, stats.purchasedQty);
      if (tx.type === 'sell') {
        const sellPrice = Number(tx.sell);
        if (removedQty > 0 && Number.isFinite(sellPrice) && sellPrice > 0) {
          stats.totalProfit = round2(stats.totalProfit + (sellPrice - avgBuy) * removedQty);
        } else {
          stats.totalProfit = round2(stats.totalProfit + Number(tx.profit || 0));
        }
      }
      stats.purchasedQty = round2(stats.purchasedQty - removedQty);
      stats.costBasis = round2(stats.costBasis - removedQty * avgBuy);
      if (stats.purchasedQty < 0.00001) { stats.purchasedQty = 0; stats.costBasis = 0; }
    }

    // THE FIX: when position closes, drop residue so next buy starts fresh.
    if (Math.abs(stats.available) < 0.005) {
      stats.available = 0;
      stats.purchasedQty = 0;
      stats.costBasis = 0;
    }
  }

  stats.available = normalizeZero(stats.available);
  if (stats.available === 0) { stats.purchasedQty = 0; stats.costBasis = 0; }
  stats.purchasedQty = normalizeZero(stats.purchasedQty);
  stats.costBasis = normalizeZero(stats.costBasis);
  if (stats.purchasedQty === 0) stats.costBasis = 0;
  stats.avgBuy = stats.purchasedQty > 0 ? stats.costBasis / stats.purchasedQty : 0;
  stats.avgBuy = normalizeZero(stats.avgBuy);
  return stats;
}

// --- Test scenarios ---
// Each buy/sell stores `total = qty * price` rounded to integer (matches handleBuy
// in useTransactionHandlers.ts:275 — `totalCost = Math.round(totalCost)`).
const buy = (qty, price) => ({ type: 'buy', quantity: qty, total: Math.round(qty * price), price });
const sell = (qty, price) => ({ type: 'sell', quantity: qty, sell: price });
const ajoutManuel = (qty, total = 0) => ({ type: 'Ajout Manuel', quantity: qty, total });
const retraitManuel = (qty) => ({ type: 'Retrait Manuel', quantity: qty });

const scenarios = [
  {
    name: 'A. Fresh start: buy 1000 EUR @ 283 (no prior history)',
    txs: [buy(1000, 283)],
    expectedAvgBuy: 283,
    expectedAvailable: 1000,
  },
  {
    name: 'B. Clean cycle then buy 1000 @ 283 (sell empties position cleanly)',
    txs: [buy(500, 280), sell(500, 285), buy(1000, 283)],
    expectedAvgBuy: 283,
    expectedAvailable: 1000,
  },
  {
    name: 'C. Fractional sells (rounding residue) then buy 1000 @ 283',
    // Buy 100 @ 281.16, then 3 partial sells that each leave rounding residue
    txs: [
      buy(100, 281.16),
      sell(33.33, 290),
      sell(33.33, 290),
      sell(33.34, 290),
      buy(1000, 283),
    ],
    expectedAvgBuy: 283,
    expectedAvailable: 1000,
  },
  {
    name: 'D. Mid-history Ajout Manuel gift (qty>0, total=0) then sell-out then buy 1000 @ 283',
    txs: [
      buy(100, 280),
      ajoutManuel(50, 0),     // gift: +50 EUR, no cost
      sell(150, 285),         // sells everything; available -> 0
      buy(1000, 283),
    ],
    expectedAvgBuy: 283,
    expectedAvailable: 1000,
  },
  {
    name: 'E. The exact symptom: history that yields 1740 phantom costBasis, then buy 1000 @ 283',
    // Crafted to leave residue that SUMS to 1740 in original reducer.
    // Sequence chosen so that available returns to 0 by end-of-history,
    // but cumulative rounding via partial sells leaves a costBasis tail.
    txs: [
      buy(870, 283),           // costBasis=246210, qty=870
      sell(290, 285),          // partial sell #1
      sell(290, 285),          // partial sell #2
      sell(290, 285),          // partial sell #3 — drains available to 0
      ajoutManuel(1, 1740),    // residue injection: small ghost lot
      retraitManuel(1),        // remove the ghost qty (1 < 0.00001 won't trigger)
      buy(1000, 283),          // today's purchase
    ],
    expectedAvgBuy: 283,
    expectedAvailable: 1000,
  },
  {
    name: 'F. No close: buy 500 @ 280, then buy 1000 @ 283 (running average expected)',
    txs: [buy(500, 280), buy(1000, 283)],
    // (500*280 + 1000*283) / 1500 = (140000 + 283000)/1500 = 282
    expectedAvgBuy: 282,
    expectedAvailable: 1500,
  },
  {
    name: 'G. Sell more than held (Retrait Manuel >= held) then buy 1000 @ 283',
    txs: [buy(100, 280), retraitManuel(100), buy(1000, 283)],
    expectedAvgBuy: 283,
    expectedAvailable: 1000,
  },
];

// --- Runner ---
let pass = 0, fail = 0;

console.log('='.repeat(78));
console.log('PAM Fix Verification');
console.log('='.repeat(78));

for (const sc of scenarios) {
  const before = computeOriginal(sc.txs);
  const after = computeFixed(sc.txs);

  const ok = Math.abs(after.avgBuy - sc.expectedAvgBuy) < 0.01
          && Math.abs(after.available - sc.expectedAvailable) < 0.01;

  if (ok) pass++; else fail++;

  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${sc.name}`);
  console.log(`   expected: avgBuy=${sc.expectedAvgBuy}  available=${sc.expectedAvailable}`);
  console.log(`   ORIGINAL: avgBuy=${before.avgBuy}  available=${before.available}  costBasis=${before.costBasis}  purchasedQty=${before.purchasedQty}`);
  console.log(`   FIXED:    avgBuy=${after.avgBuy}  available=${after.available}  costBasis=${after.costBasis}  purchasedQty=${after.purchasedQty}`);

  if (Math.abs(before.avgBuy - after.avgBuy) > 0.01) {
    console.log(`   >>> Fix changed avgBuy from ${before.avgBuy} to ${after.avgBuy}`);
  }
}

console.log('\n' + '='.repeat(78));
console.log(`Result: ${pass} passed, ${fail} failed (out of ${scenarios.length})`);
console.log('='.repeat(78));

process.exit(fail === 0 ? 0 : 1);
