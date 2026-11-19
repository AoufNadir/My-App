// V17-2 (owner, 2026-11-19): the guard BEFORE saving. When an amount or a price looks unusual, the first press on
// « Confirmer » saves nothing and says why; a second press with the same values saves. Nothing is blocked and nothing
// is changed: the owner decides. The rules are the bell guard's (guardChecks.ts), applied to the line being typed.
import { GUARD_RULES } from './guardChecks';

const DAY = 86_400_000;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const median = (values: number[]) => {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
const dayOf = (ts: number) => { const d = new Date(ts); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

export type PastExpense = { id?: string; origin?: string; amount: number; timestamp: number };
export type PastOperation = { id?: string; type: string; currency?: string; quantity: number; price?: number; sell?: number; timestamp: number; linkedClientId?: string };

/** The warning for an expense being saved, or null. `editingId` leaves the line being edited out of its own history. */
export function expenseWarning(input: { origin: 'personal_expense' | 'delivery_expense'; amount: number; timestamp: number; history: readonly PastExpense[]; editingId?: string | null }): string | null {
    const amount = num(input.amount);
    if (amount <= 0) return null;
    const same = input.history.filter((e) => e.origin === input.origin && e.id !== input.editingId && num(e.amount) > 0);
    if (amount >= GUARD_RULES.duplicateMin) {
        const twin = same
            .filter((e) => Math.abs(e.timestamp - input.timestamp) <= GUARD_RULES.duplicateDays * DAY)
            .filter((e) => Math.abs(num(e.amount) - amount) <= Math.max(num(e.amount), amount) * GUARD_RULES.duplicateShare)
            .sort((a, b) => b.timestamp - a.timestamp)[0];
        if (twin) return `Même dépense de ${fmt(amount)} DZD déjà enregistrée le ${dayOf(twin.timestamp)}. Appuyez encore sur Confirmer si ce n’est pas un doublon.`;
    }
    if (amount >= GUARD_RULES.unusualMin) {
        const before = same.filter((e) => e.timestamp < input.timestamp && e.timestamp >= input.timestamp - GUARD_RULES.unusualHistoryDays * DAY).map((e) => num(e.amount));
        const usual = median(before);
        if (before.length >= GUARD_RULES.unusualMinSamples && usual > 0 && amount >= usual * GUARD_RULES.unusualFactor)
            return `Dépense de ${fmt(amount)} DZD, d’habitude environ ${fmt(usual)}. Appuyez encore sur Confirmer si le montant est juste.`;
    }
    return null;
}

/** The warning for a buy or a sale being saved (a price far from the recent ones, or the same operation again), or null. */
export function operationWarning(input: { side: 'buy' | 'sell'; currency: string; quantity: number; price: number; timestamp: number; clientId?: string | null; history: readonly PastOperation[]; editingId?: string | null }): string | null {
    const price = num(input.price);
    const quantity = num(input.quantity);
    if (price <= 0 || quantity <= 0) return null;
    const priceOf = (o: PastOperation) => num(o.type === 'sell' ? o.sell : o.price);
    const ops = input.history
        .filter((o) => o.id !== input.editingId && o.type === input.side && (o.currency || 'USDT') === input.currency && num(o.quantity) > 0 && priceOf(o) > 0);
    const twin = ops.find((o) => Math.abs(o.timestamp - input.timestamp) <= GUARD_RULES.twinMinutes * 60_000
        && num(o.quantity) === quantity && priceOf(o) === price && (o.linkedClientId || '') === (input.clientId || ''));
    if (twin) return `Même opération enregistrée il y a quelques minutes. Appuyez encore sur Confirmer si ce n’est pas un doublon.`;
    const recent = ops.filter((o) => o.timestamp <= input.timestamp).sort((a, b) => b.timestamp - a.timestamp).slice(0, GUARD_RULES.priceSamples).map(priceOf);
    const usual = median(recent);
    if (recent.length >= GUARD_RULES.priceMinSamples && usual > 0 && Math.abs(price - usual) > usual * GUARD_RULES.priceShare)
        return `Prix ${fmt(price)}, loin de l’habitude (${fmt(usual)}). Appuyez encore sur Confirmer si le prix est juste.`;
    return null;
}

/**
 * Two presses: the first one with a warning shows it and saves nothing; pressing again with exactly the same values
 * goes on. Any change of the values asks again.
 */
export function createSecondPress() {
    let pending: string | null = null;
    return {
        /** true: go on saving. false: the warning was shown, stop here. */
        check(warning: string | null, fingerprint: string, show: (message: string) => void): boolean {
            if (!warning) { pending = null; return true; }
            const key = `${fingerprint}|${warning}`;
            if (pending === key) { pending = null; return true; }
            pending = key;
            show(`⚠️ ${warning}`);
            return false;
        },
        reset() { pending = null; },
    };
}
