import assert from 'node:assert/strict';
import { deriveInvestorEconomics, LOSS_POLICY_FROM_MS } from './useInvestorEconomics';
import type { Investor, InvestorTransaction, Tx } from '../types';

// Financial audit (2026-11-18), read only: the owner's stated rules checked against the app's engine, with the
// capitals he declared (owner 3 420 000, other investors 1 230 000, fee 30 %). Fake operations only.
const OWNER = 3_420_000;
const OTHERS = 1_230_000;
const TOTAL = OWNER + OTHERS;
const inv = (id: string, capital: number, isManager = false): Investor => ({ id, name: id, entryDate: new Date(0).toISOString(), capitalInvested: capital, initialCapital: capital, sharePercentage: 0, totalProfit: 0, withdrawnProfit: 0, availableProfit: 0, isActive: true, isManager } as Investor);
const T = LOSS_POLICY_FROM_MS + 86_400_000;
const buy = (ts: number, qty: number, price: number) => ({ id: `b${ts}`, type: 'buy', currency: 'USDT', quantity: qty, price, total: qty * price, timestamp: ts }) as unknown as Tx;
const sell = (ts: number, qty: number, price: number) => ({ id: `s${ts}`, type: 'sell', currency: 'USDT', quantity: qty, sell: price, total: qty * price, timestamp: ts }) as unknown as Tx;
const run = (txs: Tx[], investorTransactions: InvestorTransaction[] = [], fee = '30', extra: Record<string, unknown> = {}) =>
    deriveInvestorEconomics({ investors: [inv('owner', OWNER, true), inv('others', OTHERS)], investorTransactions, transactions: txs, managerFeePercentage: fee, ...extra } as never);
const of = (r: ReturnType<typeof run>, id: string) => r.derivedInvestors.find((x) => x.id === id)!;
const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) <= 0.02, `${msg}: ${a} vs ${b}`);

// The owner's formula: management 30 % + his capital share of the 70 %.
const ownerFormula = (net: number, fee = 0.3) => net * fee + net * (1 - fee) * OWNER / TOTAL;
const investorFormula = (net: number, fee = 0.3) => net * (1 - fee) * OTHERS / TOTAL;

// 1. A positive profit of 100 000, no expense: the engine applies exactly the owner's formula.
const sale = [buy(T, 10_000, 250), sell(T + 1, 10_000, 260)];
{
    const r = run(sale);
    near(of(r, 'owner').totalProfit, ownerFormula(100_000), 'owner = 30 % + capital share of 70 %');
    near(of(r, 'others').totalProfit, investorFormula(100_000), 'other investors = capital share of 70 %');
    near(of(r, 'owner').totalProfit + of(r, 'others').totalProfit, 100_000, 'shares add up to the net profit');
}
// 2. A real project expense (« Frais du projet ») comes off before the split, like the formula's NetProfit.
{
    const expense = { id: 'e', type: 'Retrait', amount: 350, amountDzd: 350, timestamp: T + 2 } as never;
    const r = run(sale, [], '30', { deliveryExpenses: [expense] });
    near(of(r, 'owner').totalProfit, ownerFormula(100_000 - 350), 'owner after a project expense');
    near(r.totals.netDistributableProfit, 99_650, 'net distributable = profit − project expenses');
}
// 3. A personal expense smaller than the owner's profit: earned profit unchanged, only « available » goes down;
//    the other investors are not touched.
{
    const expense = { id: 'p', investorId: 'owner', type: 'withdraw_profit', origin: 'personal_expense', amount: 38_500, timestamp: T + 3, date: '' } as unknown as InvestorTransaction;
    const r = run(sale, [expense]);
    near(of(r, 'owner').totalProfit, ownerFormula(100_000), 'earned profit not reduced by a personal expense');
    near(of(r, 'owner').availableProfit, ownerFormula(100_000) - 38_500, 'available profit = earned − personal expense');
    near(of(r, 'others').totalProfit, investorFormula(100_000), 'other investors untouched');
}
// 4. FINDING 1: a personal expense larger than the available profit is recorded as a capital withdrawal
//    (origin personal_expense). The displayed capital does not drop, but the capital that weights the NEXT sales does:
//    the owner's share of every later profit goes down a little, the other investors' share goes up.
{
    const capitalOut = { id: 'c', investorId: 'owner', type: 'withdraw_capital', origin: 'personal_expense', amount: 500_000, timestamp: T + 2, date: '' } as unknown as InvestorTransaction;
    const later = [buy(T + 3, 10_000, 250), sell(T + 4, 10_000, 260)];
    const r = run(later, [capitalOut]);
    const weighted = 100_000 * 0.3 + 70_000 * (OWNER - 500_000) / (TOTAL - 500_000);
    near(of(r, 'owner').totalProfit, weighted, 'today the weight uses capital minus the personal expense');
    assert.ok(of(r, 'owner').totalProfit < ownerFormula(100_000), 'so the owner earns less than with the declared capital');
}
// 5. FINDING 2: a sale at a loss of 39 000, then the same 39 000 recorded as a personal expense to « carry it
//    alone »: the loss is already split by capital (investors carry their part), and the owner pays it a second time.
{
    const lossSale = [buy(T, 1_000, 250), sell(T + 1, 1_000, 211)]; // −39 000
    const compensation = { id: 'k', investorId: 'owner', type: 'withdraw_profit', origin: 'personal_expense', amount: 39_000, timestamp: T + 2, date: '' } as unknown as InvestorTransaction;
    const r = run(lossSale, [compensation]);
    near(of(r, 'others').totalProfit, -39_000 * OTHERS / TOTAL, 'the other investors still carry their share of the loss');
    near(of(r, 'owner').availableProfit, -39_000 * OWNER / TOTAL - 39_000, 'the owner pays his share AND the full amount again');
}
// 6. A period with no sale: nothing earned, nothing split.
near(run([buy(T, 1_000, 250)]).totals.netDistributableProfit, 0, 'no sale, no profit');
// 7. The same sale with a 40/60 split (test only, production unchanged).
near(of(run(sale, [], '40'), 'owner').totalProfit, ownerFormula(100_000, 0.4), '40/60 follows the same formula');
console.log('financialAudit.test: owner formula matches; findings 1 (capital weight) and 2 (loss paid twice) reproduced');
