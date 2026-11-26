// V27-1 (owner): « Fiche de l'intermédiaire ». Clients pay their dues to a friend (the intermediary, « أمين »); each
// payment is already recorded as a debt moved onto the intermediary (a transfer to him, or a sale he was paid for):
// a negative line on his account. When the owner collects, he counts each bundle (or pastes the list the friend wrote)
// and the app finds whose bundle it is, shows each difference, and never guesses when two dues look alike.

export type AgentDeposit = { id: string; amount: number; timestamp: number; clientId?: string; label: string };
export type CountedAmount = { index: number; amount: number };
export type MatchKind = 'exact' | 'near' | 'ambiguous' | 'extra';
export type MatchLine = {
    counted: CountedAmount;
    kind: MatchKind;
    deposit?: AgentDeposit;          // exact / near
    candidates?: AgentDeposit[];     // ambiguous: the deposits it could be
    difference: number;              // counted − due (0 when exact; the whole amount when extra)
};
export type MatchResult = { lines: MatchLine[]; missing: AgentDeposit[]; countedTotal: number; dueTotal: number };

const c = (v: number) => Math.round(v * 100);
const fromC = (v: number) => v / 100;

/** The intermediary's lines that are deposits still to collect: money he received for the owner, not marked collected. */
export function pendingDeposits<T extends { id: string; montant?: number; timestamp?: number; affectsBalance?: boolean }>(
    rows: readonly T[], collected: ReadonlySet<string>, since: number, label: (row: T) => { label: string; clientId?: string },
): AgentDeposit[] {
    return rows
        .filter((row) => Number(row.montant) < 0 && row.affectsBalance !== false && !collected.has(row.id) && (Number(row.timestamp) || 0) >= since)
        .map((row) => ({ id: row.id, amount: fromC(Math.abs(c(Number(row.montant)))), timestamp: Number(row.timestamp) || 0, ...label(row) }))
        .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * V27-2: only what is still owed. The intermediary's balance says how much he holds for the owner; the newest deposits
 * up to that amount are the ones still with him (older ones were collected before this follow-up existed). The oldest
 * of them may be only partly there: it is kept whole, so nothing is lost from the list.
 */
export function outstandingOnly(deposits: readonly AgentDeposit[], owed: number): AgentDeposit[] {
    if (!(owed > 0)) return [];
    const kept: AgentDeposit[] = [];
    let sum = 0;
    for (const d of [...deposits].sort((a, b) => b.timestamp - a.timestamp)) {
        if (c(sum) >= c(owed)) break;
        kept.push(d);
        sum += d.amount;
    }
    return kept.sort((a, b) => a.timestamp - b.timestamp);
}

/** Amounts as people write them: « 289 500,00 DA », « 289500 », « 289.500 », one per line (or separated by ; / +). */
export function parseAmounts(text: string): number[] {
    return text.split(/[\n;+|]+/).map((part) => {
        let s = part.replace(/[^\d.,\s]/g, '').trim().replace(/\s+/g, '');
        if (!s) return NaN;
        const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
        const decimalAt = Math.max(lastComma, lastDot);
        // A separator followed by exactly 1 or 2 digits is the decimal mark; any other one separates thousands.
        if (decimalAt >= 0 && s.length - decimalAt - 1 <= 2) s = `${s.slice(0, decimalAt).replace(/[.,]/g, '')}.${s.slice(decimalAt + 1)}`;
        else s = s.replace(/[.,]/g, '');
        return Number(s);
    }).filter((v) => Number.isFinite(v) && v > 0);
}

/** A counted bundle can belong to a deposit when they differ by at most 5 % (or 1 000 DZD for small amounts). */
const close = (counted: number, due: number) => Math.abs(counted - due) <= Math.max(due * 0.05, 1000);

/**
 * Matches the counted amounts to the deposits: equal amounts first (several equal dues and bundles pair up, whoever
 * they are: no difference either way), then each other bundle to the nearest free deposit. A bundle near two free
 * deposits of the same amount, or as near to two, is « ambiguous »: the app does not choose.
 */
export function matchDeposits(deposits: readonly AgentDeposit[], countedAmounts: readonly number[]): MatchResult {
    const counted: CountedAmount[] = countedAmounts.map((amount, index) => ({ index, amount: fromC(c(amount)) }));
    const free = new Set(deposits.map((d) => d.id));
    const byId = new Map(deposits.map((d) => [d.id, d]));
    const lines = new Map<number, MatchLine>();
    // 1. Exact amounts.
    for (const item of counted) {
        const same = deposits.find((d) => free.has(d.id) && c(d.amount) === c(item.amount));
        if (same) { free.delete(same.id); lines.set(item.index, { counted: item, kind: 'exact', deposit: same, difference: 0 }); }
    }
    // 2. The rest, smallest gap first, so a bundle takes the deposit it is clearly closest to.
    const rest = counted.filter((item) => !lines.has(item.index));
    const pairs: { item: CountedAmount; deposit: AgentDeposit; gap: number }[] = [];
    for (const item of rest)
        for (const d of deposits) if (free.has(d.id) && close(item.amount, d.amount)) pairs.push({ item, deposit: d, gap: Math.abs(c(item.amount) - c(d.amount)) });
    pairs.sort((a, b) => a.gap - b.gap);
    for (const { item, deposit } of pairs) {
        if (lines.has(item.index) || !free.has(deposit.id)) continue;
        // Another free deposit just as near (or of the same amount)? Then it cannot be told apart: ambiguous.
        const twins = deposits.filter((d) => free.has(d.id) && d.id !== deposit.id && Math.abs(c(item.amount) - c(d.amount)) === Math.abs(c(item.amount) - c(deposit.amount)));
        if (twins.length > 0) {
            lines.set(item.index, { counted: item, kind: 'ambiguous', candidates: [deposit, ...twins], difference: fromC(c(item.amount) - c(deposit.amount)) });
            continue;
        }
        free.delete(deposit.id);
        lines.set(item.index, { counted: item, kind: 'near', deposit, difference: fromC(c(item.amount) - c(deposit.amount)) });
    }
    // 3. A gap on a deposit whose twin (same amount) was counted exact: the gap can be either one's. Ambiguous.
    for (const line of lines.values()) {
        if (line.kind !== 'near' || !line.deposit) continue;
        const twins = [...lines.values()].filter((l) => l.kind === 'exact' && l.deposit && c(l.deposit.amount) === c(line.deposit!.amount)).map((l) => l.deposit!);
        if (twins.length > 0) { line.kind = 'ambiguous'; line.candidates = [line.deposit, ...twins]; }
    }
    // An ambiguous bundle keeps its candidates out of « missing » (one of them is it).
    const held = new Set<string>();
    for (const line of lines.values()) if (line.kind === 'ambiguous') line.candidates!.forEach((d) => held.add(d.id));
    for (const item of counted) if (!lines.has(item.index)) lines.set(item.index, { counted: item, kind: 'extra', difference: item.amount });
    const ordered = counted.map((item) => lines.get(item.index)!);
    return {
        lines: ordered,
        missing: deposits.filter((d) => free.has(d.id) && !held.has(d.id)).map((d) => byId.get(d.id)!),
        countedTotal: fromC(counted.reduce((s, x) => s + c(x.amount), 0)),
        dueTotal: fromC(deposits.reduce((s, d) => s + c(d.amount), 0)),
    };
}
