#!/usr/bin/env node
/*
 * Read-only PAM profit reconciliation.
 *
 * Usage:
 *   node scripts/reconcile-pam-profit.mjs --file path/to/usdt_txs.json
 *   node scripts/reconcile-pam-profit.mjs --self-test
 *
 * Accepted JSON shapes:
 *   - Tx[]
 *   - { "transactions": Tx[] }
 *   - { "usdt_txs": Tx[] }
 *   - { "usdtTxs": Tx[] }
 *   - Firestore REST-style { "documents": [{ name, fields }] }
 */

import fs from 'node:fs';
import path from 'node:path';

const TOLERANCE_DZD = 1;
const ZERO_EPSILON = 0.005;

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeZero(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return Object.is(safe, -0) || Math.abs(safe) < ZERO_EPSILON ? 0 : round2(safe);
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value) {
  return round2(value);
}

function isFinitePositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return new Date(value.timestampValue).getTime();
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    const values = value.arrayValue?.values || [];
    return values.map(decodeFirestoreValue);
  }
  if ('mapValue' in value) {
    return decodeFirestoreFields(value.mapValue?.fields || {});
  }
  return value;
}

function decodeFirestoreFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    out[key] = decodeFirestoreValue(value);
  }
  return out;
}

function normalizeTx(raw, index) {
  const tx = { ...raw };
  if (!tx.id && tx.name) tx.id = String(tx.name).split('/').pop();
  if (tx.usd !== undefined && tx.quantity === undefined) tx.quantity = tx.usd;
  if (!tx.currency) tx.currency = 'USDT';
  tx.__index = index;
  tx.quantity = asNumber(tx.quantity, 0);
  tx.price = tx.price === undefined ? undefined : asNumber(tx.price, 0);
  tx.sell = tx.sell === undefined ? undefined : asNumber(tx.sell, 0);
  tx.total = tx.total === undefined ? undefined : asNumber(tx.total, 0);
  tx.profit = tx.profit === undefined ? undefined : asNumber(tx.profit, 0);
  tx.timestamp = asNumber(tx.timestamp, 0);
  tx.type = String(tx.type || '');
  tx.currency = tx.currency === 'EUR' ? 'EUR' : 'USDT';
  return tx;
}

function extractTransactions(input) {
  let rows = input;
  if (Array.isArray(input)) rows = input;
  else if (Array.isArray(input?.transactions)) rows = input.transactions;
  else if (Array.isArray(input?.usdt_txs)) rows = input.usdt_txs;
  else if (Array.isArray(input?.usdtTxs)) rows = input.usdtTxs;
  else if (Array.isArray(input?.documents)) {
    rows = input.documents.map((doc) => ({
      id: String(doc.name || '').split('/').pop(),
      ...decodeFirestoreFields(doc.fields || {}),
    }));
  } else {
    throw new Error('Unsupported JSON shape. Expected Tx[] or an object containing transactions/usdt_txs/usdtTxs/documents.');
  }

  return rows.map(normalizeTx);
}

function initialStats() {
  return { costBasis: 0, purchasedQty: 0, available: 0 };
}

function getSeverity(absDiff, anomalies) {
  if (absDiff <= TOLERANCE_DZD) return 'OK';
  if (anomalies.includes('oversell') || anomalies.includes('missing_cost_basis')) return 'HIGH';
  if (anomalies.includes('manual_total_ignored')) return absDiff > 1000 ? 'HIGH' : 'MEDIUM';
  if (absDiff > 10000) return 'CRITICAL';
  if (absDiff > 1000) return 'HIGH';
  if (absDiff > 100) return 'MEDIUM';
  return 'LOW';
}

function detectEurConversion(transactions, tx) {
  if (tx.currency !== 'USDT') return false;
  const txTs = asNumber(tx.timestamp, 0);
  return transactions.some((candidate) => (
    candidate.timestamp <= txTs
    && candidate.type === 'Retrait Manuel'
    && candidate.currency === 'EUR'
    && (candidate.linkedTxId || String(candidate.notes || '').toLowerCase().includes('achat de'))
  ));
}

function makeReason({ diff, anomalies, tx, avgBefore, impliedStoredAvg }) {
  if (Math.abs(diff) <= TOLERANCE_DZD) {
    return 'matching_or_rounding_noise';
  }

  const reasons = [];
  if (anomalies.includes('manual_total_ignored')) {
    reasons.push('manual_total_exists_but_stored_profit_matches_sell_price_times_quantity');
  }
  if (anomalies.includes('manual_total')) {
    reasons.push('manual_total_changes_actual_revenue');
  }
  if (anomalies.includes('oversell')) {
    reasons.push('sell_quantity_exceeds_historical_costed_stock');
    reasons.push('possible_old_purchase_delete_or_unlinked_withdrawal');
  }
  if (anomalies.includes('missing_cost_basis')) {
    reasons.push('no_historical_cost_basis_before_sell');
  }
  if (anomalies.includes('manual_adjustments_before_sell')) {
    reasons.push('manual_stock_adjustments_before_sell');
  }
  if (anomalies.includes('eur_to_usdt_conversion_before_sell')) {
    reasons.push('eur_to_usdt_conversion_history_present');
  }
  if (anomalies.includes('prior_sells_before_sell')) {
    reasons.push('prior_sells_may_have_changed_remaining_pam');
  }
  if (Number.isFinite(impliedStoredAvg) && Math.abs(impliedStoredAvg - avgBefore) > 0.01) {
    reasons.push(`stored_profit_implies_avgBuy_${money(impliedStoredAvg)}_instead_of_${money(avgBefore)}`);
    reasons.push('possible_old_purchase_edit_old_sale_edit_or_delete');
  }
  if (tx.profit === undefined) {
    reasons.push('stored_profit_missing_or_legacy_row');
  }

  if (reasons.length === 0) {
    reasons.push('stored_profit_differs_from_historical_pam_possible_old_edit_or_delete');
  }
  return reasons.join('; ');
}

function reconcileTransactions(rawTransactions) {
  const transactions = [...rawTransactions].sort((a, b) => {
    const tsDiff = asNumber(a.timestamp, 0) - asNumber(b.timestamp, 0);
    if (tsDiff !== 0) return tsDiff;
    return a.__index - b.__index;
  });

  const statsByCurrency = { USDT: initialStats(), EUR: initialStats() };
  const manualAdjustmentCount = { USDT: 0, EUR: 0 };
  const priorSellCount = { USDT: 0, EUR: 0 };
  const rows = [];

  for (const tx of transactions) {
    const stats = statsByCurrency[tx.currency] || statsByCurrency.USDT;
    const txQuantity = round2(Math.abs(asNumber(tx.quantity, 0)));
    const txTotal = round2(asNumber(tx.total, 0));
    if (txQuantity <= 0) continue;

    const isBuyLike = tx.type === 'buy' || tx.type === 'Ajout Manuel';
    const isSellLike = tx.type === 'sell' || tx.type === 'Retrait Manuel';

    if (tx.type === 'sell') {
      const avgBefore = stats.purchasedQty > 0 ? stats.costBasis / stats.purchasedQty : 0;
      const stockBefore = stats.purchasedQty;
      const sellPrice = asNumber(tx.sell, 0);
      const formulaTotal = txQuantity * sellPrice;
      const hasManualTotal = isFinitePositive(tx.total) && Math.abs(asNumber(tx.total) - formulaTotal) > TOLERANCE_DZD;
      const sellTotal = hasManualTotal ? asNumber(tx.total) : formulaTotal;
      const effectiveUnitSell = txQuantity > 0 ? sellTotal / txQuantity : sellPrice;
      const recomputedProfit = money((effectiveUnitSell - avgBefore) * txQuantity);
      const storedProfit = tx.profit === undefined ? 0 : money(tx.profit);
      const formulaStoredProfit = money((sellPrice - avgBefore) * txQuantity);
      const difference = money(storedProfit - recomputedProfit);
      const absDiff = Math.abs(difference);
      const impliedStoredAvg = txQuantity > 0 && Number.isFinite(storedProfit)
        ? effectiveUnitSell - (storedProfit / txQuantity)
        : NaN;

      const anomalies = [];
      if (hasManualTotal) anomalies.push('manual_total');
      if (hasManualTotal && Math.abs(storedProfit - formulaStoredProfit) <= TOLERANCE_DZD && absDiff > TOLERANCE_DZD) {
        anomalies.push('manual_total_ignored');
      }
      if (stockBefore <= ZERO_EPSILON) anomalies.push('missing_cost_basis');
      if (txQuantity > stockBefore + ZERO_EPSILON) anomalies.push('oversell');
      if (manualAdjustmentCount[tx.currency] > 0) anomalies.push('manual_adjustments_before_sell');
      if (priorSellCount[tx.currency] > 0) anomalies.push('prior_sells_before_sell');
      if (detectEurConversion(transactions, tx)) anomalies.push('eur_to_usdt_conversion_before_sell');

      rows.push({
        id: tx.id || `(row-${tx.__index + 1})`,
        date: tx.date || '',
        currency: tx.currency,
        quantity: txQuantity,
        sellPrice: money(sellPrice),
        sellTotal: money(sellTotal),
        historicalAvgBuy: money(avgBefore),
        storedProfit,
        recomputedProfit,
        difference,
        suspectedReason: makeReason({ diff: difference, anomalies, tx, avgBefore, impliedStoredAvg }),
        severity: getSeverity(absDiff, anomalies),
        manualTotalPresent: hasManualTotal,
        storedUsedSellTimesQuantity: anomalies.includes('manual_total_ignored'),
        stockBefore: money(stockBefore),
      });
    }

    if (isBuyLike) {
      stats.available = round2(stats.available + txQuantity);
    } else {
      stats.available = round2(stats.available - txQuantity);
    }

    if (tx.type === 'Ajout Manuel' && txTotal > 0) {
      stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
      stats.costBasis = round2(stats.costBasis + txTotal);
      manualAdjustmentCount[tx.currency] += 1;
    } else if (tx.type === 'Ajout Manuel') {
      manualAdjustmentCount[tx.currency] += 1;
    } else if (tx.type === 'buy') {
      stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
      stats.costBasis = round2(stats.costBasis + txTotal);
    } else if (isSellLike) {
      const avgBuy = stats.purchasedQty > 0 ? stats.costBasis / stats.purchasedQty : 0;
      const removedQty = Math.min(txQuantity, stats.purchasedQty);
      stats.purchasedQty = round2(stats.purchasedQty - removedQty);
      stats.costBasis = round2(stats.costBasis - (removedQty * avgBuy));
      if (stats.purchasedQty < 0.00001) {
        stats.purchasedQty = 0;
        stats.costBasis = 0;
      }
      if (tx.type === 'sell') priorSellCount[tx.currency] += 1;
      if (tx.type === 'Retrait Manuel') manualAdjustmentCount[tx.currency] += 1;
    }

    if (Math.abs(stats.available) < ZERO_EPSILON) {
      stats.available = 0;
      stats.purchasedQty = 0;
      stats.costBasis = 0;
    }
  }

  for (const currency of Object.keys(statsByCurrency)) {
    const stats = statsByCurrency[currency];
    stats.available = normalizeZero(stats.available);
    if (stats.available === 0) {
      stats.purchasedQty = 0;
      stats.costBasis = 0;
    }
    stats.purchasedQty = normalizeZero(stats.purchasedQty);
    stats.costBasis = normalizeZero(stats.costBasis);
    if (stats.purchasedQty === 0) stats.costBasis = 0;
  }

  const mismatches = rows.filter((row) => Math.abs(row.difference) > TOLERANCE_DZD);
  const matches = rows.length - mismatches.length;
  const largestMismatch = mismatches.reduce((largest, row) => (
    !largest || Math.abs(row.difference) > Math.abs(largest.difference) ? row : largest
  ), null);
  const totalStoredProfit = money(rows.reduce((sum, row) => sum + row.storedProfit, 0));
  const totalRecomputedProfit = money(rows.reduce((sum, row) => sum + row.recomputedProfit, 0));
  const totalDifference = money(totalStoredProfit - totalRecomputedProfit);

  return {
    rows,
    mismatches,
    summary: {
      totalSellTransactions: rows.length,
      totalStoredProfit,
      totalRecomputedProfit,
      totalDifference,
      matchingTransactions: matches,
      mismatchingTransactions: mismatches.length,
      largestMismatch: largestMismatch ? {
        id: largestMismatch.id,
        date: largestMismatch.date,
        currency: largestMismatch.currency,
        difference: largestMismatch.difference,
        severity: largestMismatch.severity,
        suspectedReason: largestMismatch.suspectedReason,
      } : null,
      affectedFilesLikelyResponsible: [
        'src/hooks/useTransactionHandlers.ts',
        'src/hooks/useAppData.ts',
        'src/utils/pdfReports.ts',
        'src/components/analytics/useAnalyticsViewModel.ts',
        'src/MainApp.tsx',
      ],
      recommendedNextSteps: [
        'Export real usdt_txs data and run this script against it.',
        'Review all HIGH/CRITICAL mismatches before changing formulas.',
        'Decide whether manual sell totals should become the canonical sale revenue for profit.',
        'Only after reconciliation, add regression tests for confirmed mismatch scenarios.',
      ],
    },
  };
}

function printReport(result) {
  console.log('PAM Profit Reconciliation');
  console.log('='.repeat(80));
  console.log(`Sell transactions:       ${result.summary.totalSellTransactions}`);
  console.log(`Total stored profit:     ${result.summary.totalStoredProfit} DZD`);
  console.log(`Total recomputed profit: ${result.summary.totalRecomputedProfit} DZD`);
  console.log(`Total difference:        ${result.summary.totalDifference} DZD`);
  console.log(`Matching transactions:   ${result.summary.matchingTransactions}`);
  console.log(`Mismatching transactions:${result.summary.mismatchingTransactions}`);
  if (result.summary.largestMismatch) {
    const lm = result.summary.largestMismatch;
    console.log(`Largest mismatch:        ${lm.id} (${lm.difference} DZD, ${lm.severity})`);
  } else {
    console.log('Largest mismatch:        none');
  }

  console.log('\nMismatches > 1 DZD');
  console.log('-'.repeat(80));
  if (result.mismatches.length === 0) {
    console.log('None.');
  } else {
    console.table(result.mismatches.map((row) => ({
      id: row.id,
      date: row.date,
      currency: row.currency,
      quantity: row.quantity,
      sellPrice: row.sellPrice,
      sellTotal: row.sellTotal,
      historicalAvgBuy: row.historicalAvgBuy,
      storedProfit: row.storedProfit,
      recomputedProfit: row.recomputedProfit,
      difference: row.difference,
      severity: row.severity,
      suspectedReason: row.suspectedReason,
    })));
  }

  console.log('\nAffected files likely responsible');
  console.log('-'.repeat(80));
  for (const file of result.summary.affectedFilesLikelyResponsible) {
    console.log(`- ${file}`);
  }

  console.log('\nRecommended next steps');
  console.log('-'.repeat(80));
  for (const step of result.summary.recommendedNextSteps) {
    console.log(`- ${step}`);
  }
}

function getFixtureTransactions() {
  return [
    { id: 'buy-1', timestamp: 1000, date: '01/01/2026', time: '10:00', type: 'buy', currency: 'USDT', quantity: 100, price: 280, total: 28000 },
    { id: 'sell-match', timestamp: 2000, date: '02/01/2026', time: '10:00', type: 'sell', currency: 'USDT', quantity: 10, sell: 285, profit: 50 },
    { id: 'buy-edit-symptom', timestamp: 3000, date: '03/01/2026', time: '10:00', type: 'buy', currency: 'USDT', quantity: 100, price: 300, total: 30000 },
    { id: 'sell-old-profit', timestamp: 4000, date: '04/01/2026', time: '10:00', type: 'sell', currency: 'USDT', quantity: 50, sell: 310, profit: 1500 },
    { id: 'manual-total-sale', timestamp: 5000, date: '05/01/2026', time: '10:00', type: 'sell', currency: 'USDT', quantity: 20, sell: 320, total: 6000, profit: 780 },
    { id: 'eur-buy', timestamp: 6000, date: '06/01/2026', time: '10:00', type: 'buy', currency: 'EUR', quantity: 100, price: 290, total: 29000 },
    { id: 'eur-withdraw', timestamp: 7000, date: '07/01/2026', time: '10:00', type: 'Retrait Manuel', currency: 'EUR', quantity: 50, linkedTxId: 'buy-usdt-with-eur', notes: 'Achat de 54.35 USDT' },
    { id: 'buy-usdt-with-eur', timestamp: 7001, date: '07/01/2026', time: '10:00', type: 'buy', currency: 'USDT', quantity: 54.35, price: 266.8, total: 14500 },
    { id: 'manual-adjustment', timestamp: 8000, date: '08/01/2026', time: '10:00', type: 'Ajout Manuel', currency: 'USDT', quantity: 5, total: 0 },
    { id: 'sell-after-conversion', timestamp: 9000, date: '09/01/2026', time: '10:00', type: 'sell', currency: 'USDT', quantity: 5, sell: 320, profit: 200 },
  ];
}

function parseArgs(argv) {
  const args = { file: null, selfTest: false, json: false, failOnMismatch: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--self-test') args.selfTest = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--fail-on-mismatch') args.failOnMismatch = true;
    else if (arg === '--file') {
      args.file = argv[++i];
    } else if (arg.startsWith('--file=')) {
      args.file = arg.slice('--file='.length);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

function printUsage() {
  console.log('Usage:');
  console.log('  node scripts/reconcile-pam-profit.mjs --file path/to/usdt_txs.json');
  console.log('  node scripts/reconcile-pam-profit.mjs --self-test');
  console.log('');
  console.log('Options:');
  console.log('  --json       Print full JSON result instead of the human report.');
  console.log('  --fail-on-mismatch');
  console.log('               Exit with code 2 when mismatches > 1 DZD are found.');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.file && !args.selfTest)) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  let transactions;
  if (args.selfTest) {
    transactions = getFixtureTransactions().map(normalizeTx);
  } else {
    const filePath = path.resolve(process.cwd(), args.file);
    const raw = fs.readFileSync(filePath, 'utf8');
    transactions = extractTransactions(JSON.parse(raw));
  }

  const result = reconcileTransactions(transactions);
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result);
  }

  process.exitCode = args.failOnMismatch && result.summary.mismatchingTransactions > 0 ? 2 : 0;
}

main();
