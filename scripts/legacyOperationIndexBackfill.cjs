#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PROJECT_ID = 'proodigital-7ec70';
const DATABASE_ID = '(default)';
const DEFAULT_CHUNK_SIZE = 350;
const INDEX_COLLECTION = 'legacy_operation_index';
const CHECKPOINT_COLLECTION = 'legacy_operation_index_checkpoints';

const SUPPORTED_COLLECTIONS = {
  usdt_txs: 'usdt_tx',
  dzd_client_txs: 'client_tx',
  treasury_txs: 'treasury_tx',
  actifTransactions: 'asset_tx',
  investor_transactions: 'investor_tx',
  treasury_cards: 'treasury_card',
  digital_service_txs: 'digital_service_tx',
};

const LINK_FIELDS = [
  { field: 'linkedTxId', targets: null },
  { field: 'linkedTreasuryTxId', targets: ['treasury_txs'] },
  { field: 'linkedAssetTxId', targets: ['actifTransactions'] },
  { field: 'linkedReturnTxId', targets: ['treasury_txs'] },
  { field: 'linkedInvestorTxId', targets: ['investor_transactions'] },
  { field: 'linkedCapitalInvestorTxId', targets: ['investor_transactions'] },
  { field: 'linkedDigitalServiceTxId', targets: ['digital_service_txs'] },
  { field: 'linkedProjectExpenseTxId', targets: ['treasury_txs'] },
  { field: 'linkedPersonalExpenseTxId', targets: ['treasury_txs'] },
  { field: 'linkedClientTxId', targets: ['dzd_client_txs'] },
];

const ARRAY_LINK_FIELDS = [
  { field: 'linkedTreasuryTxIds', targets: ['treasury_txs'] },
  { field: 'linkedPortfolioTxIds', targets: ['usdt_txs'] },
];

function parseArgs(argv) {
  const options = {
    mode: 'dry-run',
    projectId: PROJECT_ID,
    chunkSize: DEFAULT_CHUNK_SIZE,
    runId: `legacy-index-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    fixturePath: '',
    outputPath: '',
    resume: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') options.mode = 'dry-run';
    else if (arg === '--apply') options.mode = 'apply';
    else if (arg.startsWith('--project=')) options.projectId = arg.slice('--project='.length);
    else if (arg.startsWith('--chunk-size=')) options.chunkSize = Math.max(1, Math.min(400, Number(arg.slice('--chunk-size='.length)) || DEFAULT_CHUNK_SIZE));
    else if (arg.startsWith('--run-id=')) options.runId = sanitizeId(arg.slice('--run-id='.length));
    else if (arg.startsWith('--fixture=')) options.fixturePath = path.resolve(arg.slice('--fixture='.length));
    else if (arg.startsWith('--out=')) options.outputPath = path.resolve(arg.slice('--out='.length));
    else if (arg === '--resume') options.resume = true;
    else if (arg === '--help') {
      console.log('Usage: node scripts/legacyOperationIndexBackfill.cjs --dry-run|--apply [--chunk-size=350] [--run-id=id] [--resume] [--fixture=fixture.json] [--out=report.json]');
      process.exit(0);
    }
  }
  return options;
}

function firebaseCliAccessToken() {
  const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
  const cliConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const token = cliConfig.tokens && cliConfig.tokens.access_token;
  if (!token) throw new Error('Firebase CLI access token not found. Run `firebase login` first.');
  return token;
}

function firestoreBase(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${DATABASE_ID}/documents`;
}

async function requestJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 800)}`);
  }
  return response.json();
}

async function commitWrites(projectId, token, writes) {
  if (writes.length === 0) return;
  const url = `${firestoreBase(projectId)}:commit`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 1200)}`);
  }
}

function docId(name) {
  return String(name || '').split('/').pop();
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return Date.parse(value.timestampValue);
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) {
    const out = {};
    for (const [key, child] of Object.entries(value.mapValue.fields || {})) out[key] = decodeValue(child);
    return out;
  }
  return undefined;
}

function decodeDoc(doc) {
  const out = { id: docId(doc.name), __name: doc.name };
  for (const [key, value] of Object.entries(doc.fields || {})) out[key] = decodeValue(value);
  return out;
}

async function listDocuments(projectId, token, collectionPath) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${firestoreBase(projectId)}/${collectionPath}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const json = await requestJson(url, token);
    for (const doc of json.documents || []) docs.push(decodeDoc(doc));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return docs;
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) fields[key] = encodeValue(child);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function encodeFields(data) {
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) fields[key] = encodeValue(value);
  }
  return fields;
}

function sanitizeId(value) {
  return String(value || '')
    .trim()
    .replace(/\//g, '__slash__')
    .replace(/\s+/g, '_')
    .slice(0, 900);
}

function indexId(transactionType, transactionId) {
  return sanitizeId(`legacy:${transactionType}:${transactionId}`);
}

function nodeKey(collection, id) {
  return `${collection}/${id}`;
}

function collectionType(collection) {
  return SUPPORTED_COLLECTIONS[collection];
}

function normalizeRow(row) {
  return {
    collection: row.collection,
    id: row.id,
    role: row.role || 'linked',
    transactionType: row.transactionType || collectionType(row.collection),
  };
}

function dedupeRows(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row.collection || !row.id) continue;
    const normalized = normalizeRow(row);
    map.set(nodeKey(normalized.collection, normalized.id), normalized);
  }
  return Array.from(map.values()).sort((a, b) => nodeKey(a.collection, a.id).localeCompare(nodeKey(b.collection, b.id)));
}

function hashPayload(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function createIndexDoc(rootNode, componentRows, updatedAt, runId) {
  const root = normalizeRow({
    collection: rootNode.collection,
    id: rootNode.doc.id,
    role: 'root',
    transactionType: rootNode.type,
  });
  const linkedRows = dedupeRows(componentRows
    .filter((rowKey) => rowKey !== rootNode.key)
    .map((rowKey) => {
      const [collection, id] = rowKey.split('/');
      return { collection, id, role: 'linked', transactionType: collectionType(collection) };
    }));
  const payload = {
    schemaVersion: 1,
    operationId: indexId(rootNode.type, rootNode.doc.id),
    source: 'legacy.edit-delete',
    status: 'active',
    root,
    linkedRows,
    updatedAt,
    backfillRunId: runId,
  };
  payload.payloadHash = hashPayload({
    schemaVersion: payload.schemaVersion,
    operationId: payload.operationId,
    source: payload.source,
    status: payload.status,
    root: payload.root,
    linkedRows: payload.linkedRows,
  });
  return payload;
}

function parseIndexRows(indexDoc) {
  const rows = [];
  if (indexDoc.root && indexDoc.root.collection && indexDoc.root.id) rows.push(nodeKey(indexDoc.root.collection, indexDoc.root.id));
  for (const row of indexDoc.linkedRows || []) {
    if (row && row.collection && row.id) rows.push(nodeKey(row.collection, row.id));
  }
  return [...new Set(rows)].sort();
}

function arraysEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function addIdMapping(idToKeys, collection, id) {
  const list = idToKeys.get(id) || [];
  list.push(nodeKey(collection, id));
  idToKeys.set(id, list);
}

function buildIndexPlan(userReport, byCollection, runId) {
  const nodes = new Map();
  const idToKeys = new Map();
  const idToKeysByCollection = new Map();

  for (const [collection, type] of Object.entries(SUPPORTED_COLLECTIONS)) {
    idToKeysByCollection.set(collection, new Map());
    for (const doc of byCollection[collection] || []) {
      const key = nodeKey(collection, doc.id);
      nodes.set(key, { collection, type, doc, key, neighbors: new Set() });
      addIdMapping(idToKeys, collection, doc.id);
      addIdMapping(idToKeysByCollection.get(collection), collection, doc.id);
    }
  }

  function targetsFor(linkedId, targets) {
    if (!linkedId) return [];
    if (!targets) return idToKeys.get(String(linkedId)) || [];
    return targets.flatMap((collection) => idToKeysByCollection.get(collection)?.get(String(linkedId)) || []);
  }

  function connect(a, b) {
    if (!nodes.has(a) || !nodes.has(b) || a === b) return;
    nodes.get(a).neighbors.add(b);
    nodes.get(b).neighbors.add(a);
  }

  function linkToId(fromKey, linkedId, fieldName, targets) {
    if (!linkedId) return;
    const targetKeys = targetsFor(linkedId, targets);
    if (targetKeys.length === 0) {
      userReport.missingLinkedTargets.push({ from: fromKey, fieldName, linkedId: String(linkedId) });
      return;
    }
    for (const targetKey of targetKeys) connect(fromKey, targetKey);
  }

  for (const node of nodes.values()) {
    for (const spec of LINK_FIELDS) linkToId(node.key, node.doc[spec.field], spec.field, spec.targets);
    for (const spec of ARRAY_LINK_FIELDS) {
      const values = Array.isArray(node.doc[spec.field]) ? node.doc[spec.field] : [];
      for (const linkedId of values) linkToId(node.key, linkedId, spec.field, spec.targets);
    }
  }

  const componentByKey = new Map();
  const components = [];
  const visited = new Set();
  for (const key of nodes.keys()) {
    if (visited.has(key)) continue;
    const stack = [key];
    const rows = [];
    visited.add(key);
    while (stack.length) {
      const current = stack.pop();
      rows.push(current);
      for (const next of nodes.get(current).neighbors) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
    rows.sort();
    const componentIndex = components.length;
    for (const row of rows) componentByKey.set(row, componentIndex);
    components.push(rows);
  }

  const existingIndexes = new Map((byCollection[INDEX_COLLECTION] || []).map((doc) => [doc.id, doc]));
  userReport.existingIndexes = existingIndexes.size;

  const plan = [];
  const seenIndexIds = new Set();
  for (const node of nodes.values()) {
    userReport.legacyOperationsCandidate += 1;
    const expectedId = indexId(node.type, node.doc.id);
    if (seenIndexIds.has(expectedId)) userReport.duplicates += 1;
    seenIndexIds.add(expectedId);

    const componentRows = components[componentByKey.get(node.key)] || [node.key];
    const expectedDoc = createIndexDoc(node, componentRows, Date.now(), runId);
    const existing = existingIndexes.get(expectedId);
    if (!existing) {
      userReport.expectedIndexesToCreate += 1;
      plan.push({ uid: userReport.uid, indexId: expectedId, payload: expectedDoc });
      continue;
    }
    const existingRows = parseIndexRows(existing);
    const expectedRows = parseIndexRows(expectedDoc);
    const existingHash = existing.payloadHash;
    if (existing.status !== 'deleted' && arraysEqual(existingRows, expectedRows) && (!existingHash || existingHash === expectedDoc.payloadHash)) {
      userReport.matchingExistingIndexes += 1;
      userReport.skippedExisting += 1;
      continue;
    }
    userReport.mismatches.push({ indexId: expectedId, expectedRows, existingRows, existingStatus: existing.status || 'unknown' });
  }

  return plan;
}

async function loadUserCollections(projectId, token, uid, report) {
  const byCollection = {};
  for (const collection of [...Object.keys(SUPPORTED_COLLECTIONS), INDEX_COLLECTION, CHECKPOINT_COLLECTION]) {
    const docs = await listDocuments(projectId, token, `users/${encodeURIComponent(uid)}/${collection}`);
    byCollection[collection] = docs;
    report.collectionCounts[collection] = docs.length;
    report.documentsRead += docs.length;
  }
  return byCollection;
}

function docName(projectId, uid, collection, id) {
  return `projects/${projectId}/databases/${DATABASE_ID}/documents/users/${uid}/${collection}/${id}`;
}

function checkpointPayload(input) {
  return {
    schemaVersion: 1,
    source: 'legacy_operation_index_backfill',
    runId: input.runId,
    mode: input.mode,
    batchNumber: input.batchNumber,
    processed: input.processed,
    created: input.created,
    skipped: input.skipped,
    lastIndexId: input.lastIndexId || '',
    updatedAt: input.updatedAt,
  };
}

function createBaseReport(options) {
  return {
    mode: options.mode,
    projectId: options.projectId,
    runId: options.runId,
    chunkSize: options.chunkSize,
    fixturePath: options.fixturePath || undefined,
    resume: Boolean(options.resume),
    users: [],
    totals: {
      usersRead: 0,
      documentsRead: 0,
      estimatedReads: 0,
      legacyOperationsCandidate: 0,
      expectedIndexesToCreate: 0,
      existingIndexes: 0,
      matchingExistingIndexes: 0,
      skipped: 0,
      skippedByCheckpoint: 0,
      created: 0,
      duplicates: 0,
      mismatches: 0,
      unsupported: 0,
      immutableLegacy: 0,
      missingLinkedTargets: 0,
      checkpointsWritten: 0,
      lastCheckpoint: null,
    },
  };
}

function createUserReport(uid) {
  return {
    uid,
    documentsRead: 0,
    collectionCounts: {},
    legacyOperationsCandidate: 0,
    expectedIndexesToCreate: 0,
    existingIndexes: 0,
    matchingExistingIndexes: 0,
    skippedExisting: 0,
    skippedByCheckpoint: 0,
    duplicates: 0,
    mismatches: [],
    unsupported: [],
    immutableLegacy: [],
    missingLinkedTargets: [],
    checkpoint: null,
  };
}

function addUserReportToTotals(report, userReport) {
  report.totals.documentsRead += userReport.documentsRead;
  report.totals.legacyOperationsCandidate += userReport.legacyOperationsCandidate;
  report.totals.expectedIndexesToCreate += userReport.expectedIndexesToCreate;
  report.totals.existingIndexes += userReport.existingIndexes;
  report.totals.matchingExistingIndexes += userReport.matchingExistingIndexes;
  report.totals.skipped += userReport.skippedExisting;
  report.totals.skippedByCheckpoint += userReport.skippedByCheckpoint;
  report.totals.duplicates += userReport.duplicates;
  report.totals.mismatches += userReport.mismatches.length;
  report.totals.unsupported += userReport.unsupported.length;
  report.totals.immutableLegacy += userReport.immutableLegacy.length;
  report.totals.missingLinkedTargets += userReport.missingLinkedTargets.length;
  report.users.push({
    uid: userReport.uid,
    collectionCounts: userReport.collectionCounts,
    legacyOperationsCandidate: userReport.legacyOperationsCandidate,
    expectedIndexesToCreate: userReport.expectedIndexesToCreate,
    existingIndexes: userReport.existingIndexes,
    matchingExistingIndexes: userReport.matchingExistingIndexes,
    skippedExisting: userReport.skippedExisting,
    skippedByCheckpoint: userReport.skippedByCheckpoint,
    duplicates: userReport.duplicates,
    mismatches: userReport.mismatches.length,
    unsupported: userReport.unsupported.length,
    immutableLegacy: userReport.immutableLegacy.length,
    missingLinkedTargets: userReport.missingLinkedTargets.length,
    checkpoint: userReport.checkpoint,
    mismatchSamples: userReport.mismatches.slice(0, 5),
    immutableLegacySamples: userReport.immutableLegacy.slice(0, 5),
    missingLinkedTargetSamples: userReport.missingLinkedTargets.slice(0, 10),
  });
}

function checkpointFromCollections(byCollection) {
  const docs = byCollection[CHECKPOINT_COLLECTION] || [];
  return docs.find((doc) => doc.id === 'backfill_latest') || null;
}

function sortPlan(plan) {
  return [...plan].sort((a, b) => `${a.uid}:${a.indexId}`.localeCompare(`${b.uid}:${b.indexId}`));
}

function applyResumeCheckpoints(plan, checkpointByUid, runId, userReports) {
  if (!checkpointByUid || checkpointByUid.size === 0) return plan;
  return plan.filter((item) => {
    const checkpoint = checkpointByUid.get(item.uid);
    if (!checkpoint || checkpoint.runId !== runId || !checkpoint.lastIndexId)
      return true;
    if (String(item.indexId).localeCompare(String(checkpoint.lastIndexId)) > 0)
      return true;
    const userReport = userReports.get(item.uid);
    if (userReport) userReport.skippedByCheckpoint += 1;
    return false;
  });
}

function assertReadyForApply(report, options) {
  if (report.totals.duplicates || report.totals.mismatches || report.totals.missingLinkedTargets || report.totals.unsupported) {
    report.readyForApply = false;
    if (options.mode === 'apply') {
      report.applyBlockedReason = 'duplicates, mismatches, missing linked targets, or unsupported rows were detected.';
    }
    return false;
  }
  report.readyForApply = true;
  return true;
}

function emitReport(report, outputPath) {
  const text = JSON.stringify(report, null, 2);
  if (outputPath) fs.writeFileSync(outputPath, `${text}\n`, 'utf8');
  console.log(text);
}

function writeForSet(projectId, uid, collection, id, payload, precondition) {
  const write = {
    update: {
      name: docName(projectId, uid, collection, id),
      fields: encodeFields(payload),
    },
  };
  if (precondition) write.currentDocument = precondition;
  return write;
}

async function applyPlan(projectId, token, runId, plan, chunkSize, report) {
  let batchNumber = 0;
  let processed = 0;
  for (let start = 0; start < plan.length; start += chunkSize) {
    const chunk = plan.slice(start, start + chunkSize);
    batchNumber += 1;
    const last = chunk[chunk.length - 1];
    const writes = chunk.map((item) => writeForSet(projectId, item.uid, INDEX_COLLECTION, item.indexId, item.payload, { exists: false }));
    writes.push(writeForSet(projectId, last.uid, CHECKPOINT_COLLECTION, 'backfill_latest', checkpointPayload({
      runId,
      mode: 'apply',
      batchNumber,
      processed: processed + chunk.length,
      created: report.totals.created + chunk.length,
      skipped: report.totals.skipped,
      lastIndexId: last.indexId,
      updatedAt: Date.now(),
    })));
    await commitWrites(projectId, token, writes);
    processed += chunk.length;
    report.totals.created += chunk.length;
    report.totals.checkpointsWritten += 1;
    report.totals.lastCheckpoint = {
      runId,
      batchNumber,
      processed,
      lastIndexId: last.indexId,
      uid: last.uid,
    };
  }
}

function normalizeFixtureDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  if (!doc.id) return null;
  return { ...doc, id: String(doc.id) };
}

function loadFixture(fixturePath) {
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const users = Array.isArray(raw.users)
    ? raw.users
    : Object.entries(raw.users || {}).map(([id, value]) => ({ id, ...(value || {}) }));
  return users.map((user) => {
    const uid = String(user.id || user.uid || '');
    const collections = user.collections || {};
    const normalizedCollections = {};
    for (const collection of [...Object.keys(SUPPORTED_COLLECTIONS), INDEX_COLLECTION, CHECKPOINT_COLLECTION]) {
      normalizedCollections[collection] = (collections[collection] || [])
        .map(normalizeFixtureDoc)
        .filter(Boolean);
    }
    return { id: uid, collections: normalizedCollections };
  }).filter((user) => user.id);
}

function loadFixtureUserCollections(fixtureUser, report) {
  const byCollection = {};
  for (const collection of [...Object.keys(SUPPORTED_COLLECTIONS), INDEX_COLLECTION, CHECKPOINT_COLLECTION]) {
    const docs = fixtureUser.collections[collection] || [];
    byCollection[collection] = docs;
    report.collectionCounts[collection] = docs.length;
    report.documentsRead += docs.length;
  }
  return byCollection;
}

async function buildBackfillPlan(options, loadUsers, loadCollections) {
  const report = createBaseReport(options);
  const users = await loadUsers();
  report.totals.usersRead = users.length;
  report.totals.documentsRead += users.length;
  const checkpointByUid = new Map();
  const userReportsByUid = new Map();
  const fullPlan = [];

  for (const user of users) {
    const uid = user.id;
    const userReport = createUserReport(uid);
    userReportsByUid.set(uid, userReport);
    const byCollection = await loadCollections(user, userReport);
    const checkpoint = checkpointFromCollections(byCollection);
    userReport.checkpoint = checkpoint ? {
      runId: checkpoint.runId || '',
      processed: Number(checkpoint.processed || 0),
      created: Number(checkpoint.created || 0),
      lastIndexId: checkpoint.lastIndexId || '',
      batchNumber: Number(checkpoint.batchNumber || 0),
    } : null;
    if (options.resume && checkpoint) checkpointByUid.set(uid, checkpoint);
    const userPlan = buildIndexPlan(userReport, byCollection, options.runId);
    fullPlan.push(...userPlan);
  }

  let sortedPlan = sortPlan(fullPlan);
  if (options.resume) {
    sortedPlan = applyResumeCheckpoints(sortedPlan, checkpointByUid, options.runId, userReportsByUid);
  }

  for (const userReport of userReportsByUid.values()) {
    addUserReportToTotals(report, userReport);
  }
  report.totals.estimatedReads = report.totals.documentsRead;
  report.plan = {
    totalItems: sortedPlan.length,
    firstIndexId: sortedPlan[0]?.indexId || null,
    lastIndexId: sortedPlan[sortedPlan.length - 1]?.indexId || null,
  };
  return { report, plan: sortedPlan };
}

function applyFixturePlan(options, plan, report) {
  let batchNumber = 0;
  let processed = 0;
  const createdIndexes = [];
  for (let start = 0; start < plan.length; start += options.chunkSize) {
    const chunk = plan.slice(start, start + options.chunkSize);
    batchNumber += 1;
    const last = chunk[chunk.length - 1];
    for (const item of chunk) {
      createdIndexes.push({
        uid: item.uid,
        collection: INDEX_COLLECTION,
        id: item.indexId,
        payloadHash: item.payload.payloadHash,
        rows: parseIndexRows(item.payload),
      });
    }
    processed += chunk.length;
    report.totals.created += chunk.length;
    report.totals.checkpointsWritten += 1;
    report.totals.lastCheckpoint = {
      runId: options.runId,
      batchNumber,
      processed,
      lastIndexId: last.indexId,
      uid: last.uid,
    };
  }
  report.fixtureApply = {
    createdIndexes,
    noFirestoreWrites: true,
  };
}

async function runWithFixture(options) {
  const fixtureUsers = loadFixture(options.fixturePath);
  const { report, plan } = await buildBackfillPlan(
    options,
    async () => fixtureUsers,
    async (user, userReport) => loadFixtureUserCollections(user, userReport),
  );
  const ready = assertReadyForApply(report, options);
  if (options.mode === 'apply' && ready) {
    applyFixturePlan(options, plan, report);
  }
  emitReport(report, options.outputPath);
  if (options.mode === 'apply' && !ready) process.exit(2);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.fixturePath) {
    await runWithFixture(options);
    return;
  }
  const token = firebaseCliAccessToken();
  const { report, plan } = await buildBackfillPlan(
    options,
    async () => listDocuments(options.projectId, token, 'users'),
    async (user, userReport) => loadUserCollections(options.projectId, token, user.id, userReport),
  );
  const ready = assertReadyForApply(report, options);
  if (options.mode === 'apply') {
    if (!ready) {
      emitReport(report, options.outputPath);
      process.exit(2);
      return;
    }
    await applyPlan(options.projectId, token, options.runId, plan, options.chunkSize, report);
  }

  emitReport(report, options.outputPath);
}

if (require.main === module) main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

module.exports = {
  buildIndexPlan,
  createIndexDoc,
  hashPayload,
  indexId,
  parseArgs,
  parseIndexRows,
  runWithFixture,
  sanitizeId,
};
