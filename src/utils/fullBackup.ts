// V16-2 (owner, 2026-11-16): a full copy of the owner's data, downloaded as one JSON file from the app itself
// (free: one read per document, the same as opening the app once; nothing is written to the database).
// Derived data that the app rebuilds by itself (read models, accounting shadows, the stock lock) is left out.

export const BACKUP_COLLECTIONS = [
    'usdt_txs', 'dzd_clients', 'dzd_client_txs', 'treasury_txs', 'treasury_cards',
    'digital_service_txs', 'actifTransactions', 'manual_assets', 'manual_asset_clients',
    'investors', 'investor_transactions', 'deliveries', 'inventory_checks', 'movement_reasons',
    'client_confirmations', 'subscriptions', 'pricing_plans', 'pricing_overrides', 'pricing_settings',
    'period_lock_history', 'manager_fee_history', 'edit_log',
] as const;

export const LAST_BACKUP_KEY = 'app_last_backup_at';

type Snap = { id: string; data: () => Record<string, unknown> | undefined };
export type BackupSource = {
    get: () => Promise<{ data: () => Record<string, unknown> | undefined }>;
    collection: (name: string) => { get: () => Promise<{ docs?: Snap[]; forEach?: (fn: (d: Snap) => void) => void }> };
};

/** Timestamps and other objects with toDate() become ISO strings, so the file reads back the same everywhere. */
export function plainValue(value: unknown): unknown {
    if (value && typeof value === 'object') {
        const maybe = value as { toDate?: () => Date; path?: string };
        if (typeof maybe.toDate === 'function') return { __timestamp: maybe.toDate().toISOString() };
        if (Array.isArray(value)) return value.map(plainValue);
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plainValue(v)]));
    }
    return value;
}

export async function buildFullBackup(userDocRef: BackupSource, now = new Date()) {
    const userDoc = await userDocRef.get();
    const collections: Record<string, Array<{ id: string; data: unknown }>> = {};
    const counts: Record<string, number> = {};
    for (const name of BACKUP_COLLECTIONS) {
        const snap = await userDocRef.collection(name).get();
        const docs: Snap[] = snap.docs ?? (() => { const out: Snap[] = []; snap.forEach?.((d) => out.push(d)); return out; })();
        collections[name] = docs.map((d) => ({ id: d.id, data: plainValue(d.data()) }));
        counts[name] = docs.length;
    }
    return {
        backup: { version: 3, app: 'Pro Digital', exportedAt: now.toISOString(), user: plainValue(userDoc.data() ?? null), collections },
        counts,
        total: Object.values(counts).reduce((s, n) => s + n, 0),
    };
}

/** Days since the last backup taken on this phone, or null if never. */
export function daysSinceBackup(lastIso: string | null, now = Date.now()): number | null {
    const t = lastIso ? Date.parse(lastIso) : NaN;
    return Number.isFinite(t) ? Math.floor((now - t) / 86_400_000) : null;
}
