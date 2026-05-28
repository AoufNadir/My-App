#!/usr/bin/env node
/*
 * Diagnostic regression for production mismatch jGd0Hug9GvHZ3pxrSrDR.
 *
 * This test does not touch Firestore and does not change production logic.
 * It builds a minimal fixed fixture from the audited trace window, then
 * executes the read-only reconciliation script and asserts the known mismatch.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const reconcileScript = path.join(repoRoot, 'scripts', 'reconcile-pam-profit.mjs');
const targetId = 'jGd0Hug9GvHZ3pxrSrDR';

const fixture = {
  transactions: [
    {
      id: 'audit-opening-usdt-costed-before-jGd0',
      timestamp: 1769100000000,
      date: '22/01/2026',
      time: '17:40',
      type: 'Ajout Manuel',
      currency: 'USDT',
      quantity: 2093.99,
      price: 248.26,
      total: 519847.75,
      notes: 'Regression fixture opening costed USDT state before target window',
    },
    {
      id: 'audit-opening-usdt-qty-only-before-jGd0',
      timestamp: 1769100000001,
      date: '22/01/2026',
      time: '17:40',
      type: 'Ajout Manuel',
      currency: 'USDT',
      quantity: 6.2,
      price: 0,
      notes: 'Regression fixture carries prior quantity-only manual adjustment',
    },
    {
      id: 'audit-opening-eur-before-jGd0',
      timestamp: 1769100000002,
      date: '22/01/2026',
      time: '17:40',
      type: 'Ajout Manuel',
      currency: 'EUR',
      quantity: 539.29,
      price: 287,
      total: 154776.23,
      notes: 'Regression fixture opening EUR state before target window',
    },
    {
      id: 'fGOuhIcU9AZtxN5EW4Uy',
      timestamp: 1769100424142,
      date: '22/01/2026',
      time: '17:47',
      type: 'buy',
      currency: 'EUR',
      quantity: 1000,
      price: 287,
      total: 287000,
      paymentMethod: 'credit',
      notes: '',
    },
    {
      id: '74gSmy27yPIAwqcNjprp',
      timestamp: 1769181602921,
      date: '23/01/2026',
      time: '16:20',
      type: 'sell',
      currency: 'USDT',
      quantity: 200,
      sell: 253,
      profit: 891.8682983450026,
      paymentMethod: 'credit',
      notes: '',
    },
    {
      id: 'vwWimTZvyNv2mFFxmaTB',
      timestamp: 1769185356232,
      date: '23/01/2026',
      time: '17:22',
      type: 'sell',
      currency: 'USDT',
      quantity: 1200,
      sell: 249.75,
      profit: 2200.5109279064413,
      paymentMethod: 'cash',
      notes: '',
    },
    {
      id: 'd4agW4sUxar2R45FvIQc',
      timestamp: 1769190031811,
      date: '23/01/2026',
      time: '18:40',
      type: 'Retrait Manuel',
      currency: 'EUR',
      quantity: 1530,
      notes: 'Achat de 1760.64 USDT',
    },
    {
      id: 'laRqwheTl8XGAjkgzGUu',
      timestamp: 1769190031824,
      date: '23/01/2026',
      time: '18:40',
      type: 'buy',
      currency: 'USDT',
      quantity: 1760.644418872267,
      price: 249.44645,
      total: 439186.5,
      paymentMethod: 'cash',
      notes: '',
    },
    {
      id: 'zQDN7XZ62ZFXx01Muc8T',
      timestamp: 1769190091985,
      date: '23/01/2026',
      time: '18:41',
      type: 'sell',
      currency: 'USDT',
      quantity: 1000,
      sell: 249.5,
      profit: 897.8115919630341,
      paymentMethod: 'credit',
      notes: '',
    },
    {
      id: 'o5rBPvnZCKhyLyMzM0R8',
      timestamp: 1769195206694,
      date: '23/01/2026',
      time: '20:06',
      type: 'buy',
      currency: 'USDT',
      quantity: 4426.56,
      price: 248.5,
      total: 1100000,
      paymentMethod: 'cash',
      notes: '',
    },
    {
      id: 'ViHDLQfiTv7soFQ7SLYk',
      timestamp: 1769197257271,
      date: '23/01/2026',
      time: '20:40',
      type: 'sell',
      currency: 'USDT',
      quantity: 400,
      sell: 252,
      profit: 1383.7365966900052,
      paymentMethod: 'cash',
      notes: '',
    },
    {
      id: 'P7vdQuq8gEDVL1IFvHW3',
      timestamp: 1769282381596,
      date: '24/01/2026',
      time: '20:19',
      type: 'sell',
      currency: 'USDT',
      quantity: 1000,
      sell: 251,
      profit: 2459.341491725013,
      paymentMethod: 'credit',
      notes: '',
    },
    {
      id: '5r1g3NpOXD1JGzJcbiZB',
      timestamp: 1769282933847,
      date: '24/01/2026',
      time: '20:28',
      type: 'sell',
      currency: 'USDT',
      quantity: 300,
      sell: 252,
      profit: 1934.8529547883118,
      paymentMethod: 'credit',
      notes: '',
    },
    {
      id: targetId,
      timestamp: 1769283803850,
      date: '24/01/2026',
      time: '20:43',
      type: 'sell',
      currency: 'USDT',
      quantity: 1000,
      sell: 249.5,
      profit: 2944.0575946601084,
      paymentMethod: 'credit',
      notes: '',
    },
  ],
};

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pam-regression-'));
const fixturePath = path.join(tempDir, 'jGd0Hug9GvHZ3pxrSrDR.json');

try {
  fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
  const output = execFileSync(
    process.execPath,
    [reconcileScript, '--file', fixturePath, '--json'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const result = JSON.parse(output);
  const row = result.rows.find((candidate) => candidate.id === targetId);

  assert.ok(row, `Expected reconciliation row for ${targetId}`);
  assert.equal(row.currency, 'USDT');
  assert.equal(row.quantity, 1000);
  assert.equal(row.sellPrice, 249.5);
  assert.equal(row.sellTotal, 249500);
  assert.equal(row.historicalAvgBuy, 248.65);
  assert.equal(row.storedProfit, 2944.06);
  assert.equal(row.recomputedProfit, 849);
  assert.equal(row.difference, 2095.06);
  assert.equal(row.severity, 'HIGH');
  assert.equal(row.manualTotalPresent, false);
  assert.equal(row.storedUsedSellTimesQuantity, false);
  assert.match(row.suspectedReason, /manual_stock_adjustments_before_sell/);
  assert.match(row.suspectedReason, /eur_to_usdt_conversion_history_present/);
  assert.match(row.suspectedReason, /stored_profit_implies_avgBuy_246\.56_instead_of_248\.65/);

  console.log(`PASS ${targetId}: stored profit mismatch remains fixed at 2095.06 DZD for audit tracking.`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
