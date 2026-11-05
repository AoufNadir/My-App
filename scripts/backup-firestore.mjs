// Copy of the Firestore database to a JSON file on this computer (free, read-only).
// It reads every document and every sub-collection, and writes nothing to the database.
//
// Use (from the project folder, on the owner's computer):
//   1. Firebase Console > Project settings > Service accounts > « Generate new private key ».
//      Save the file as  serviceAccount.json  in this folder. Never share it, never commit it.
//   2. npm install --no-save firebase-admin
//   3. node scripts/backup-firestore.mjs
// The copy is written to  backups/firestore-<date>.json , with a count of documents per collection.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import admin from 'firebase-admin';

const key = JSON.parse(readFileSync(new URL('../serviceAccount.json', import.meta.url), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

const counts = {};
// Timestamps and references are kept readable and can be told apart from plain values.
function plain(value) {
    if (value instanceof admin.firestore.Timestamp) return { __timestamp: value.toDate().toISOString() };
    if (value instanceof admin.firestore.DocumentReference) return { __ref: value.path };
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
    return value;
}
async function dumpCollection(ref) {
    const out = {};
    const snapshot = await ref.get();
    for (const doc of snapshot.docs) {
        const children = {};
        for (const sub of await doc.ref.listCollections())
            children[sub.id] = await dumpCollection(sub);
        out[doc.id] = { data: plain(doc.data()), ...(Object.keys(children).length ? { collections: children } : {}) };
        const name = ref.path.replace(/\/[^/]+\//g, '/*/');
        counts[name] = (counts[name] || 0) + 1;
    }
    // A document can have sub-collections without existing itself: keep those too.
    for (const doc of await ref.listDocuments()) {
        if (out[doc.id]) continue;
        const children = {};
        for (const sub of await doc.listCollections())
            children[sub.id] = await dumpCollection(sub);
        if (Object.keys(children).length) out[doc.id] = { data: null, collections: children };
    }
    return out;
}

const backup = { project: key.project_id, takenAt: new Date().toISOString(), collections: {} };
for (const collection of await db.listCollections())
    backup.collections[collection.id] = await dumpCollection(collection);

mkdirSync(new URL('../backups/', import.meta.url), { recursive: true });
const file = new URL(`../backups/firestore-${backup.takenAt.replace(/[:.]/g, '-')}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(backup, null, 1));
console.table(counts);
console.log(`Backup written: ${file.pathname}`);
process.exit(0);
