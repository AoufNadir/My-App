// V20-1 (owner, 2026-11-22): « Ce que vous avez aujourd'hui » in the first-run setup. What a new account already
// holds is written once, as the manager's opening capital, with the rows the app already knows (no new kind of
// operation): the manager investor, one `deposit_capital` per dinar account (with its treasury `Ajout`), and for
// each currency a capital deposit of its value into the Caisse then a `buy` paid from the Caisse (net 0 in the
// Caisse, the stock and its average price exactly as typed). Every movement has its owner: the manager.

export type OpeningCash = { accountId: string; amount: number };
export type OpeningStock = { currency: string; quantity: number; avgPrice: number };
export type OpeningInput = { managerName: string; cash: OpeningCash[]; stocks: OpeningStock[] };
export type OpeningWrite = { collection: 'investors' | 'investor_transactions' | 'treasury_txs' | 'usdt_txs'; id: string; data: Record<string, unknown> };
export type OpeningCheck = { ok: true; total: number } | { ok: false; reason: 'name' | 'amount' | 'stock' };

const round2 = (value: number) => Math.round(value * 100) / 100;
const positive = (value: number) => Number.isFinite(value) && value > 0;

/** The total opening capital in dinars, or why the form cannot be saved. Nothing typed is valid (total 0). */
export function checkOpening(input: OpeningInput): OpeningCheck {
    if (input.cash.some((c) => !Number.isFinite(c.amount) || c.amount < 0)) return { ok: false, reason: 'amount' };
    if (input.stocks.some((s) => !positive(s.quantity) || !positive(s.avgPrice))) return { ok: false, reason: 'stock' };
    const total = round2(input.cash.reduce((sum, c) => sum + c.amount, 0) + input.stocks.reduce((sum, s) => sum + round2(s.quantity * s.avgPrice), 0));
    if (total > 0 && !input.managerName.trim()) return { ok: false, reason: 'name' };
    return { ok: true, total };
}

/** The rows to write in one batch. `newId` gives a fresh document id; `at` is the moment of the setup. */
export function openingWrites(input: OpeningInput, at: { date: string; time: string; timestamp: number }, newId: () => string): OpeningWrite[] {
    const check = checkOpening(input);
    if (check.ok === false || check.total <= 0) return [];
    const writes: OpeningWrite[] = [];
    const name = input.managerName.trim();
    const investorId = newId();
    writes.push({ collection: 'investors', id: investorId, data: {
        id: investorId, name, entryDate: new Date(at.timestamp).toISOString(),
        capitalInvested: check.total, initialCapital: check.total, sharePercentage: 0,
        totalProfit: 0, withdrawnProfit: 0, availableProfit: 0, isActive: true, notes: '', isManager: true, email: '', phone: '',
    } });
    let tick = 0;
    const deposit = (amount: number, source: string, notes: string) => {
        const investorTxId = newId();
        const treasuryId = newId();
        const stamp = { date: at.date, time: at.time, timestamp: at.timestamp + tick++ };
        writes.push({ collection: 'investor_transactions', id: investorTxId, data: {
            investorId, type: 'deposit_capital', amount, ...stamp, origin: 'initial_capital', notes, paymentSource: source, linkedTreasuryTxId: treasuryId,
        } });
        writes.push({ collection: 'treasury_txs', id: treasuryId, data: {
            ...stamp, type: 'Ajout', source, amount, notes: `Capital initial: ${name}`, linkedInvestorTxId: investorTxId, origin: 'investor_capital_deposit',
        } });
    };
    input.cash.filter((c) => c.amount > 0).forEach((c) => deposit(round2(c.amount), c.accountId, 'Capital Initial'));
    input.stocks.forEach((s) => {
        const total = round2(s.quantity * s.avgPrice);
        deposit(total, 'Caisse', `Capital Initial (${s.currency})`);
        const buyId = newId();
        const stamp = { date: at.date, time: at.time, timestamp: at.timestamp + tick++ };
        writes.push({ collection: 'usdt_txs', id: buyId, data: {
            ...stamp, type: 'buy', currency: s.currency, quantity: s.quantity, price: s.avgPrice, total,
            notes: 'Stock initial', clientPaymentStatus: 'cash', purchaseFundingCurrency: 'DZD', openingStock: true,
        } });
        writes.push({ collection: 'treasury_txs', id: newId(), data: {
            ...stamp, type: 'Retrait', source: 'Caisse', amount: total, notes: `Achat ${s.quantity} ${s.currency}`, linkedTxId: buyId,
        } });
    });
    return writes;
}
