import type { BusinessAccount } from './businessSettings';

// M3: the two movements a created account needs, written as treasury rows the balances already read
// (computeAccountBalances): its opening balance, and transfers between any two accounts of the base currency.
// Both carry an `origin`, so they are never « movements without a reason ».

export type AccountMovementInput =
    | { kind: 'opening'; account: BusinessAccount; amount: number; note?: string }
    | { kind: 'transfer'; from: BusinessAccount; to: BusinessAccount; amount: number; note?: string };
export type AccountMovementCheck = { ok: true } | { ok: false; reason: 'amount' | 'same_account' | 'insufficient' };

const pad = (n: number) => String(n).padStart(2, '0');
const stampOf = (ts: number) => { const d = new Date(ts); return { timestamp: ts, date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };
const round2 = (value: number) => Math.round(value * 100) / 100;

export function checkAccountMovement(input: AccountMovementInput, balances: Record<string, number>): AccountMovementCheck {
    if (!(input.amount > 0))
        return { ok: false, reason: 'amount' };
    if (input.kind === 'transfer') {
        if (input.from.id === input.to.id)
            return { ok: false, reason: 'same_account' };
        if (round2(input.amount) > round2(balances[input.from.id] ?? 0) + 0.005)
            return { ok: false, reason: 'insufficient' };
    }
    return { ok: true };
}

/** The treasury row of the movement. The cash box and BaridiMob keep the names their old rows carry. */
export function accountMovementRow(input: AccountMovementInput, now: number): Record<string, unknown> {
    const amount = round2(input.amount);
    const note = input.note?.trim();
    if (input.kind === 'opening')
        return { ...stampOf(now), type: 'Ajout', source: input.account.id, amount, origin: 'account_opening', notes: note || `Solde d’ouverture ${input.account.name}`, recordedAt: now };
    return {
        ...stampOf(now), type: 'Transfer', source: input.from.id, destination: input.to.id, amount,
        asset: `From ${input.from.id} to ${input.to.id}`, origin: 'account_transfer', notes: note || 'Transfert interne', recordedAt: now,
    };
}
