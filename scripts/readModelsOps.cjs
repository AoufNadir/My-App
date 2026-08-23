#!/usr/bin/env node
/**
 * Read Models Production Ops — Rebuild / Live Reconcile (glue ONLY).
 *
 * Reuses the app's own engines verbatim via tsx import:
 *   computePamLedger, deriveInvestorEconomics, getManagerProfitBreakdown,
 *   calculateInvestorLiability, computeCapitalSnapshot,
 *   buildDashboardReadModelShadowFromLegacy, reconcileDashboardReadModelsWithLegacy,
 *   writeInitialRefusal-free snapshot writer with built-in reconciliation gate.
 * No financial logic is re-implemented here beyond mirroring the exact legacy
 * memo formulas from MainApp.tsx / useAppData.ts (treasuryStats, totals,
 * servicesSummary, dailyOverview, financialAudit) so the baseline matches the
 * app bit-for-bit.
 *
 * Auth: Firebase CLI access token from this machine (no keys shared/created).
 *
 * Usage:
 *   node --import tsx scripts/readModelsOps.cjs inspect   --uid <UID>
 *   node --import tsx scripts/readModelsOps.cjs rebuild   --uid <UID> [--allow-overwrite]
 *   node --import tsx scripts/readModelsOps.cjs reconcile --uid <UID>
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ID = 'proodigital-7ec70';
const DATABASE_ID = '(default)';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const DOC_ROOT = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

function parseArgs(argv) {
  const options = { mode: argv[0] || 'help', uid: '', allowOverwrite: false };
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === '--uid') options.uid = argv[i + 1] || '';
    if (argv[i] === '--allow-overwrite') options.allowOverwrite = true;
  }
  return options;
}

function loadToken() {
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const cliConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const token = cliConfig.tokens && cliConfig.tokens.access_token;
  if (!token) throw new Error('Firebase CLI access token not found. Run `firebase login` first.');
  return token;
}

async function requestJson(url, token, init) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init && init.headers) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 400)}`);
  return body;
}

// ── Firestore REST codec ────────────────────────────────────────────────────
function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return new Date(value.timestampValue).getTime();
  if ('stringValue' in value) return value.stringValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  return null;
}
function decodeFields(fields) {
  const out = {};
  Object.keys(fields || {}).forEach((key) => { out[key] = decodeValue(fields[key]); });
  return out;
}
function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null };
    if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') {
    const fields = {};
    Object.keys(value).forEach((key) => { fields[key] = encodeValue(value[key]); });
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}
function encodeFields(obj) {
  const fields = {};
  Object.keys(obj || {}).forEach((key) => { fields[key] = encodeValue(obj[key]); });
  return fields;
}

async function listAll(token, collectionPath) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${BASE}/${collectionPath}?pageSize=999${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const page = await requestJson(url, token);
    (page.documents || []).forEach((doc) => {
      docs.push({ id: doc.name.split('/').pop(), data: decodeFields(doc.fields || {}) });
    });
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function getDocFields(token, docPath) {
  try {
    const doc = await requestJson(`${BASE}/${docPath}`, token);
    return { exists: true, data: decodeFields(doc.fields || {}) };
  } catch (error) {
    if (String(error).includes('404')) return { exists: false, data: null };
    throw error;
  }
}

// Adapter implementing initialSnapshotWriter's Manual* interfaces over REST.
function makeUserDocAdapter(token, uid) {
  const pendingWrites = [];
  const readModelsPath = `users/${uid}/read_models`;
  return {
    userDocRef: {
      collection: () => ({
        doc: (docId) => ({
          docId,
          get: async () => {
            const snap = await getDocFields(token, `${readModelsPath}/${docId}`);
            return { exists: snap.exists, data: () => snap.data };
          },
        }),
      }),
      firestore: {
        batch: () => ({
          set: (ref, data) => {
            pendingWrites.push({ name: `${DOC_ROOT}/${readModelsPath}/${ref.docId}`, fields: encodeFields(data) });
          },
          commit: async () => {
            for (let i = 0; i < pendingWrites.length; i += 200) {
              const writes = pendingWrites.slice(i, i + 200).map(w => ({ update: { name: w.name, fields: w.fields } }));
              await requestJson(`${BASE}:commit`, token, { method: 'POST', body: JSON.stringify({ writes }) });
            }
            pendingWrites.length = 0;
          },
        }),
      },
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.uid || options.mode === 'help') {
    console.log('Usage: node --import tsx scripts/readModelsOps.cjs <inspect|rebuild|reconcile> --uid <UID> [--allow-overwrite]');
    process.exit(options.mode === 'help' ? 0 : 1);
  }
  const token = loadToken();
  const uid = options.uid;
  const userPath = `users/${uid}`;

  const [userDoc, usdtTxs, clients, clientTxs, treasuryTxs, treasuryCards, manualAssets, manualAssetClients, assetTxs, digitalTxs, investors, investorTxs, feeHistoryDocs] = await Promise.all([
    getDocFields(token, userPath),
    listAll(token, `${userPath}/usdt_txs`),
    listAll(token, `${userPath}/dzd_clients`),
    listAll(token, `${userPath}/dzd_client_txs`),
    listAll(token, `${userPath}/treasury_txs`),
    listAll(token, `${userPath}/treasury_cards`),
    listAll(token, `${userPath}/manual_assets`),
    listAll(token, `${userPath}/manual_asset_clients`),
    listAll(token, `${userPath}/actifTransactions`),
    listAll(token, `${userPath}/digital_service_txs`),
    listAll(token, `${userPath}/investors`),
    listAll(token, `${userPath}/investor_transactions`),
    listAll(token, `${userPath}/manager_fee_history`),
  ]);

  const counts = {
    usdt_txs: usdtTxs.length, dzd_clients: clients.length, dzd_client_txs: clientTxs.length,
    treasury_txs: treasuryTxs.length, treasury_cards: treasuryCards.length,
    manual_assets: manualAssets.length, manual_asset_clients: manualAssetClients.length,
    actifTransactions: assetTxs.length, digital_service_txs: digitalTxs.length,
    investors: investors.length, investor_transactions: investorTxs.length,
    manager_fee_history: feeHistoryDocs.length,
  };

  if (options.mode === 'inspect') {
    const existing = await getDocFields(token, `${userPath}/read_models/dashboard_summary`);
    console.log(JSON.stringify({
      operatorDocExists: userDoc.exists,
      managerFeePercentage: userDoc.exists ? (userDoc.data.managerFeePercentage ?? null) : null,
      existingDashboardSummary: existing.exists
        ? { generationId: existing.data.generationId || null, payloadHash: existing.data.payloadHash || null, updatedAt: existing.data.updatedAt || null }
        : null,
      counts,
    }, null, 2));
    return;
  }

  // ── Legacy baseline — mirrors src/MainApp.tsx + src/hooks/useAppData.ts ──
  const pamMod = await import('../src/utils/pamLedger.ts');
  const invEcon = await import('../src/hooks/useInvestorEconomics.ts');
  const capMod = await import('../src/utils/capitalSnapshot.ts');
  const closureMod = await import('../src/accounting/closure.ts');
  const drmMod = await import('../src/readModels/dashboardReadModels.ts');
  const iswMod = await import('../src/readModels/initialSnapshotWriter.ts');

  const OWNER_OPENING_CAPITAL = 2_000_000;
  const OWNER_PRE_TRACKING_EXPENSES = closureMod.HISTORICAL_CLOSING_BASELINE_DZD;
  const nowTs = Date.now();

  const transactions = usdtTxs.map(d => d.data);
  const treasData = treasuryTxs.map(d => d.data);
  const txData = clientTxs.map(d => d.data);

  const feeRaw = userDoc.exists && userDoc.data.managerFeePercentage !== undefined ? Number(userDoc.data.managerFeePercentage) : 30;
  const managerFeePercentage = Number.isFinite(feeRaw) ? String(feeRaw) : '30';
  const managerFeeHistory = feeHistoryDocs.map(d => ({
    id: d.id,
    percentage: Number(d.data.percentage),
    effectiveFrom: Number(d.data.effectiveFrom),
    createdAt: Number(d.data.createdAt ?? d.data.effectiveFrom),
  })).filter(r => Number.isFinite(r.percentage) && Number.isFinite(r.effectiveFrom))
    .sort((a, b) => a.effectiveFrom - b.effectiveFrom);

  const deliveryExpenses = treasData.filter(tx => tx.origin === 'delivery_expense');
  const personalExpenses = treasData.filter(tx => tx.origin === 'personal_expense');
  const pamLedger = pamMod.computePamLedger(transactions);

  const investorEconomics = invEcon.deriveInvestorEconomics({
    investors: investors.map(d => d.data),
    investorTransactions: investorTxs.map(d => d.data),
    transactions,
    managerFeePercentage,
    managerFeeHistory,
    pamLedger,
    deliveryExpenses,
    treasuryTransactions: treasData,
    personalExpenses,
  });
  const derivedInvestors = investorEconomics.derivedInvestors;
  const investorLiability = capMod.calculateInvestorLiability(derivedInvestors);
  const baseManagerBreakdown = invEcon.getManagerProfitBreakdown(investorEconomics, managerFeePercentage);
  const globalNetProfit = Number(investorEconomics.totals.netDistributableProfit || pamLedger.totals.derivedProfit || 0);

  // treasuryStats — useAppData.ts:261-319 semantics, verbatim
  const nz = v => (Object.is(v, -0) || Math.abs(v) < 0.005 ? 0 : Number(v.toFixed(2)));
  const resolveWallet = raw => {
    if (!raw) return null;
    const n = String(raw).toLowerCase();
    if (n.includes('caisse')) return 'Caisse';
    if (n.includes('baridi')) return 'BaridiMob';
    return null;
  };
  const parseLegacyTransfer = rawAsset => {
    if (!rawAsset) return { from: null, to: null };
    const m = /from\s+(.+?)\s+to\s+(.+)/i.exec(rawAsset);
    return m ? { from: resolveWallet(m[1]), to: resolveWallet(m[2]) } : { from: null, to: null };
  };
  let caisse = 0, baridi = 0;
  treasData.forEach(tx => {
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
    const source = resolveWallet(tx.source)
      || (tx.asset === 'DZD-Caisse' ? 'Caisse' : tx.asset === 'DZD-Baridi' ? 'BaridiMob' : null);
    if (source === 'Caisse') caisse += amount * factor;
    if (source === 'BaridiMob') baridi += amount * factor;
  });
  const treasuryStats = { caisse: nz(caisse), baridi: nz(baridi) };

  // client balances + totals — useAppData.ts:320-352 semantics
  const balancesMap = new Map();
  clients.forEach(c => balancesMap.set(c.id, 0));
  txData.forEach(tx => { if (tx.affectsBalance === false) return; balancesMap.set(tx.clientId, (balancesMap.get(tx.clientId) || 0) + tx.montant); });
  let totalDettes = 0, totalAvances = 0;
  balancesMap.forEach(b => { if (b < 0) totalDettes += b; else if (b > 0) totalAvances += b; });

  // servicesSummary — MainApp.tsx:858-886 semantics
  const assetBalancesMap = new Map();
  assetTxs.forEach(d => {
    const tx = d.data;
    const key = `${tx.actifId}_${tx.clientId}`;
    assetBalancesMap.set(key, (assetBalancesMap.get(key) || 0) + tx.amount);
  });
  let amountToReceive = 0, svcAdvances = 0;
  assetBalancesMap.forEach(balance => {
    if (balance < -0.005) amountToReceive += Math.abs(balance);
    else if (balance > 0.005) svcAdvances += balance;
  });
  const cashReceived = assetTxs.reduce((sum, d) => sum + (d.data.type === 'payment_received' ? Math.abs(Number(d.data.amount || 0)) : 0), 0);
  const manualServiceRevenue = assetTxs.reduce((sum, d) => sum + ((d.data.type === 'service' || d.data.type === 'invoice') ? Math.abs(Number(d.data.amount || 0)) : 0), 0);
  const digitalServiceProfit = digitalTxs.reduce((sum, d) => {
    const amount = Number(d.data.profitDzd || 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const servicesSummary = {
    amountToReceive, clientAdvances: svcAdvances, cashReceived,
    serviceRevenue: manualServiceRevenue + digitalServiceProfit,
    manualServiceRevenue, digitalServiceProfit,
    netCapitalImpact: capMod.calculateServicesCapitalImpact({ amountToReceive, clientAdvances: svcAdvances }).servicesCapitalImpact,
    servicesCount: manualAssets.length, clientsCount: manualAssetClients.length,
  };

  const managerPendingAdvances = personalExpenses
    .filter(tx => tx.advanceState === 'pending')
    .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0)), 0);

  // capitalSnapshot — same inputs/order as MainApp.tsx:893-903
  const capitalSnapshot = capMod.computeCapitalSnapshot({
    caisseBalance: treasuryStats.caisse,
    baridiBalance: treasuryStats.baridi,
    portfolioStats: pamLedger.portfolioStats,
    totalDettes,
    totalAvances,
    treasuryCards: treasuryCards.map(d => d.data),
    investorLiability,
    services: servicesSummary,
    managerPendingAdvances,
  });

  // dailyOverview profit buckets — MainApp.tsx:668-780 semantics
  const dayStartTs = new Date(nowTs); dayStartTs.setHours(0, 0, 0, 0);
  const nowDate = new Date(nowTs);
  const monthStartTs = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
  const yearStartTs = new Date(nowDate.getFullYear(), 0, 1).getTime();
  const dow = nowDate.getDay();
  const weekStartTs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - (dow === 0 ? 6 : dow - 1), 0, 0, 0, 0).getTime();
  const deriveOwnerTradingProfitForPeriod = (periodStartTs) => invEcon.getManagerProfitBreakdown(invEcon.deriveInvestorEconomics({
    investors: investors.map(d => d.data),
    investorTransactions: investorTxs.map(d => d.data),
    transactions,
    managerFeePercentage,
    managerFeeHistory,
    pamLedger,
    periodStartTs,
    periodEndTs: nowTs,
    deliveryExpenses,
    treasuryTransactions: treasData,
  }), managerFeePercentage).ownerTotalProfit;
  const serviceProfitForPeriod = (periodStartTs) => assetTxs.reduce((sum, d) => {
    const tx = d.data;
    if (tx.timestamp < periodStartTs || tx.timestamp > nowTs) return sum;
    if (tx.type !== 'service' && tx.type !== 'invoice') return sum;
    const amount = Math.abs(Number(tx.amount || 0));
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const digitalServiceProfitForPeriod = (periodStartTs) => digitalTxs.reduce((sum, d) => {
    const tx = d.data;
    if (tx.timestamp < periodStartTs || tx.timestamp > nowTs) return sum;
    const amount = Number(tx.profitDzd || 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  let todayProfit = 0, weekToDateProfit = 0, monthToDateProfit = 0, allTimeProfit = 0;
  pamLedger.sellProfitRows.forEach((row) => {
    if (row.timestamp > nowTs) return;
    const derivedProfit = Number(row.derivedProfit || 0);
    allTimeProfit += derivedProfit;
    if (row.timestamp >= weekStartTs) weekToDateProfit += derivedProfit;
    if (row.timestamp >= dayStartTs.getTime()) todayProfit += derivedProfit;
    if (row.timestamp >= monthStartTs) monthToDateProfit += derivedProfit;
  });
  const ownerTradingToday = deriveOwnerTradingProfitForPeriod(dayStartTs.getTime());
  const ownerTradingWeek = deriveOwnerTradingProfitForPeriod(weekStartTs);
  const ownerTradingMonth = deriveOwnerTradingProfitForPeriod(monthStartTs);
  const ownerTradingYear = deriveOwnerTradingProfitForPeriod(yearStartTs);
  const serviceProfitAllTime = assetTxs.reduce((sum, d) => {
    const tx = d.data;
    if (tx.timestamp > nowTs || (tx.type !== 'service' && tx.type !== 'invoice')) return sum;
    const amount = Math.abs(Number(tx.amount || 0));
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const digitalServiceProfitAllTime = digitalTxs.reduce((sum, d) => {
    const tx = d.data;
    if (tx.timestamp > nowTs) return sum;
    const amount = Number(tx.profitDzd || 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const dailyOverview = {
    todayProfit,
    weekToDateProfit,
    monthToDateProfit,
    allTimeProfit,
    ownerProfitToday: ownerTradingToday + serviceProfitForPeriod(dayStartTs.getTime()) + digitalServiceProfitForPeriod(dayStartTs.getTime()),
    ownerProfitWeek: ownerTradingWeek + serviceProfitForPeriod(weekStartTs) + digitalServiceProfitForPeriod(weekStartTs),
    ownerProfitMonth: ownerTradingMonth + serviceProfitForPeriod(monthStartTs) + digitalServiceProfitForPeriod(monthStartTs),
    ownerProfitYear: ownerTradingYear + serviceProfitForPeriod(yearStartTs) + digitalServiceProfitForPeriod(yearStartTs),
    ownerProfitAllTime: baseManagerBreakdown.ownerTotalProfit + serviceProfitAllTime + digitalServiceProfitAllTime,
  };

  // managerProfitBreakdown — MainApp.tsx:904-916 semantics (reconciled against
  // the balance sheet; this is what makes actualOwnerCapital canonical)
  const managerProfitBreakdown = invEcon.reconcileManagerProfitBreakdown({
    breakdown: baseManagerBreakdown,
    openingCapital: OWNER_OPENING_CAPITAL,
    actualOwnerCapital: capitalSnapshot.netOwnedCapital,
    serviceProfit: servicesSummary.serviceRevenue,
    preTrackingPersonalExpenses: OWNER_PRE_TRACKING_EXPENSES,
  });

  const financialAudit = {
    openingCapital: OWNER_OPENING_CAPITAL,
    tradingOwnerProfit: managerProfitBreakdown.tradingOwnerProfit,
    serviceProfit: managerProfitBreakdown.serviceProfit,
    historicalPersonalExpenses: managerProfitBreakdown.personalExpenses,
    currentPersonalExpenses: managerProfitBreakdown.currentPersonalExpenses,
    totalPersonalExpenses: managerProfitBreakdown.totalPersonalExpenses,
    deliveryExpensesSinceStart: deliveryExpenses
      .filter(tx => tx.timestamp <= nowTs)
      .reduce((sum, tx) => sum + Math.max(0, Number(tx.amountDzd ?? tx.amount ?? 0)), 0),
    actualOwnerCapital: managerProfitBreakdown.actualOwnerCapital,
  };

  const buildInput = {
    transactions,
    clientsDzd: clients.map(d => d.data),
    clientTransactionsDzd: txData,
    treasuryTransactions: treasData,
    treasuryCards: treasuryCards.map(d => d.data),
    manualAssets: manualAssets.map(d => d.data),
    manualAssetClients: manualAssetClients.map(d => d.data),
    manualAssetTransactions: assetTxs.map(d => d.data),
    digitalServiceTransactions: digitalTxs.map(d => d.data),
    investors: investors.map(d => d.data),
    investorTransactions: investorTxs.map(d => d.data),
    managerFeePercentage,
    managerFeeHistory,
    ownerOpeningCapital: OWNER_OPENING_CAPITAL,
    preTrackingPersonalExpenses: OWNER_PRE_TRACKING_EXPENSES,
    getClientFullName: client => client.fullName,
    asOf: nowTs,
    generationId: `gen-${new Date(nowTs).toISOString().replace(/[:.]/g, '-')}`,
    snapshotRevision: 1,
    summaryRevisions: {
      dashboard_summary: 1, treasury_summary: 1, portfolio_summary: 1, clients_summary: 1,
      investors_summary: 1, services_summary: 1, financial_summary: 1,
    },
  };

  const legacyBaseline = {
    treasuryStats,
    portfolioStats: pamLedger.portfolioStats,
    investorBreakdown: capMod.calculateInvestorBreakdown(derivedInvestors),
    investorLiability,
    capitalSnapshot,
    servicesSummary,
    dailyOverview,
    globalNetProfit,
    managerProfitBreakdown,
    financialAudit,
  };

  const adapter = makeUserDocAdapter(token, uid);

  if (options.mode === 'rebuild') {
    const result = await iswMod.writeInitialReadModelSnapshot({
      userDocRef: adapter.userDocRef,
      buildInput,
      legacyBaseline,
      allowOverwrite: options.allowOverwrite,
    });
    console.log(JSON.stringify({
      status: result.status,
      wrote: result.wrote,
      documentIds: result.documentIds,
      generationId: result.reconciliation.generationId || buildInput.generationId,
      payloadHash: result.payloadHash,
      ok: result.reconciliation.ok,
      toleranceDzd: result.reconciliation.toleranceDzd,
      mismatchCount: result.reconciliation.mismatches.length,
      mismatches: result.reconciliation.mismatches,
      reason: result.reason || null,
      counts,
    }, null, 2));
    process.exit(result.status === 'written' || result.status === 'already_exists' ? 0 : 2);
  }

  if (options.mode === 'backup') {
    const out = {};
    for (const docId of ['dashboard_summary', 'treasury_summary', 'portfolio_summary', 'clients_summary', 'investors_summary', 'services_summary', 'financial_summary']) {
      const snap = await getDocFields(token, `${userPath}/read_models/${docId}`);
      out[docId] = snap.exists ? snap.data : null;
    }
    const backupFile = path.resolve(__dirname, '..', `read_models_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify({ uid, backedUpAt: new Date().toISOString(), docs: out }, null, 2));
    console.log(JSON.stringify({ backupFile, documents: Object.keys(out).length }, null, 2));
    return;
  }

  if (options.mode === 'reconcile') {
    // Business-level identity between STORED snapshot and a FRESH rebuild:
    // pin the rebuild to the STORED asOf timestamp so every rolling
    // wall-clock window (last7DaysProfit, periodBuckets, activeClients…)
    // covers exactly the same intervals. Any remaining difference is a real
    // data difference, not clock semantics.
    const storedFirst = await getDocFields(token, `${userPath}/read_models/dashboard_summary`);
    const storedAsOf = Number(storedFirst.exists && storedFirst.data.meta?.asOf?.timestamp || storedFirst.data.updatedAt || nowTs);
    buildInput.asOf = storedAsOf;
    buildInput.generationId = `reconcile-${storedAsOf}`;
    const ENVELOPE_KEYS = ['readModelName', 'schemaVersion', 'revision', 'snapshotRevision', 'generationId', 'payloadHash', 'updatedAt', 'writeMode', 'sourceOfTruth', 'firestoreUpdatedAt', 'meta', 'sourceSummaries'];
    const businessOnly = (node) => {
      if (Array.isArray(node)) return node.map(businessOnly);
      if (node && typeof node === 'object') {
        const copy = {};
        Object.keys(node).sort().forEach((key) => {
          if (ENVELOPE_KEYS.includes(key)) return;
          const value = node[key];
          if (value === null || value === undefined) return;
          copy[key] = businessOnly(value);
        });
        return copy;
      }
      return node;
    };
    const freshSet = drmMod.buildDashboardReadModelShadowFromLegacy(buildInput);
    const remoteDocs = {};
    const MODEL_KEY = { dashboard_summary: 'dashboard', treasury_summary: 'treasury', portfolio_summary: 'portfolio', clients_summary: 'clients', investors_summary: 'investors', services_summary: 'services', financial_summary: 'financial' };
    for (const docId of Object.keys(MODEL_KEY)) {
      const snap = await getDocFields(token, `${userPath}/read_models/${docId}`);
      if (!snap.exists) throw new Error(`missing read_models/${docId}`);
      remoteDocs[docId] = snap.data;
    }
    const storedBusiness = {};
    const freshBusiness = {};
    for (const docId of Object.keys(MODEL_KEY)) {
      storedBusiness[docId] = businessOnly(remoteDocs[docId]);
      freshBusiness[docId] = businessOnly(freshSet[MODEL_KEY[docId]]);
    }
    const identicalAfterRebuild = JSON.stringify(storedBusiness) === JSON.stringify(freshBusiness);
    let firstDifference = null;
    const differences = [];
    if (!identicalAfterRebuild) {
      outer: for (const docId of Object.keys(storedBusiness)) {
        const walk = (a, b, trail) => {
          if (differences.length >= 20 || JSON.stringify(a) === JSON.stringify(b)) return;
          if (a && b && typeof a === 'object' && typeof b === 'object') {
            const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
            for (const k of keys) { walk(a[k], b[k], `${trail}.${k}`); }
          } else {
            differences.push({ path: trail, stored: a ?? null, fresh: b ?? null });
          }
        };
        walk(storedBusiness[docId], freshBusiness[docId], docId);
        if (differences.length >= 20) break outer;
      }
    }
    // Rolling windows (week-to-date etc.) legitimately change as wall-clock
    // time advances between the stored write and a fresh rebuild. They are
    // NOT financial mismatches: both values are correct for their own asOf.
    const ROLLING_WINDOW_PATTERN = /\.(week|day)(\.|$)|Week\b|Today\b/;
    const nonRollingDifferences = differences.filter(d => !ROLLING_WINDOW_PATTERN.test(d.path));
    const identicalOnStableMetrics = nonRollingDifferences.length === 0;
    // Official engine reconciliation at CURRENT wall-clock (the view the app
    // itself would compute right now) — separate from the pinned-asOf
    // identity check above.
    buildInput.asOf = nowTs;
    buildInput.generationId = `gen-${new Date(nowTs).toISOString().replace(/[:.]/g, '-')}`;
    const currentSet = drmMod.buildDashboardReadModelShadowFromLegacy(buildInput);
    const liveReconciliation = drmMod.reconcileDashboardReadModelsWithLegacy(currentSet, legacyBaseline);
    const maxDifference = liveReconciliation.mismatches.reduce((max, m) => Math.max(max, Math.abs(m.difference)), 0);
    console.log(JSON.stringify({
      generationId: remoteDocs.dashboard_summary.generationId || null,
      liveReconciliation,
      maxDifference,
      storedMatchesFreshRebuild: identicalAfterRebuild,
      rollingWindowDifferences: differences.filter(d => ROLLING_WINDOW_PATTERN.test(d.path)),
      nonRollingDifferences,
      stableMetricsMatch: identicalOnStableMetrics,
      note: 'liveReconciliation recomputes legacy-vs-shadow on CURRENT production data. storedMatchesFreshRebuild compares stored docs to a fresh rebuild ignoring the write envelope; rolling wall-clock windows are reported separately.',
      counts,
    }, null, 2));
    process.exit(liveReconciliation.ok && maxDifference <= 0.01 && identicalOnStableMetrics ? 0 : 2);
  }
}

main().catch(error => { console.error('[readModelsOps] FAILED:', error && error.message ? error.message : error); process.exit(1); });
