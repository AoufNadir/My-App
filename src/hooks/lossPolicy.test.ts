import assert from 'node:assert/strict';
import { deriveInvestorEconomics, LOSS_POLICY_FROM_MS } from './useInvestorEconomics';
import type { Investor, InvestorTransaction, Tx } from '../types';

// V13-6 loss policy, worked by hand. Fake figures only. Manager and investor A each 100 000 of capital, fee 30%.
const inv = (id: string, isManager = false): Investor => ({ id, name: id, entryDate: new Date(0).toISOString(), capitalInvested: 100_000, initialCapital: 100_000, sharePercentage: 0, totalProfit: 0, withdrawnProfit: 0, availableProfit: 0, isActive: true, isManager } as Investor);
const run = (txs: Tx[], investorTransactions: InvestorTransaction[] = []) => deriveInvestorEconomics({ investors: [inv('m', true), inv('a')], investorTransactions, transactions: txs, managerFeePercentage: '30' });
const byId = (r: ReturnType<typeof run>, id: string) => r.derivedInvestors.find((x) => x.id === id)!;
const T = LOSS_POLICY_FROM_MS + 86_400_000;
const buy = (ts: number, qty: number, price: number) => ({ id: `b${ts}`, type: 'buy', currency: 'USDT', quantity: qty, price, total: qty * price, timestamp: ts }) as unknown as Tx;
const sell = (ts: number, qty: number, price: number) => ({ id: `s${ts}`, type: 'sell', currency: 'USDT', quantity: qty, sell: price, total: qty * price, timestamp: ts }) as unknown as Tx;

// 1. A loss of 10 000: no fee, half each by capital.
{
    const r = run([buy(T, 1_000, 250), sell(T + 1, 1_000, 240)]);
    assert.equal(byId(r, 'a').totalProfit, -5_000);
    assert.equal(byId(r, 'm').totalProfit, -5_000);
}
// 2. Profit first (A gets 7 000 of 20 000 × 70% / 2), then a huge loss of 500 000: A loses at most 7 000 + 100 000.
{
    const r = run([buy(T, 1_000, 250), sell(T + 1, 1_000, 270), buy(T + 2, 10_000, 250), sell(T + 3, 10_000, 200)]);
    assert.equal(byId(r, 'a').totalProfit, 7_000 - 107_000, 'capped at unwithdrawn profit + capital');
    assert.equal(byId(r, 'm').totalProfit + byId(r, 'a').totalProfit, 20_000 - 500_000, 'nothing lost on the way: the manager carries the rest');
}
// 3. Profit already withdrawn is not taken back: the cap counts only what is still there.
{
    const withdraw = { id: 'w', investorId: 'a', type: 'withdraw_profit', amount: 7_000, timestamp: T + 2, date: '' } as unknown as InvestorTransaction;
    const r = run([buy(T, 1_000, 250), sell(T + 1, 1_000, 270), buy(T + 3, 10_000, 250), sell(T + 4, 10_000, 200)], [withdraw]);
    assert.equal(byId(r, 'a').totalProfit, 7_000 - 100_000, 'only the capital is at stake');
}
// 4. A loss before the policy date keeps the old split (fee ratio applied to the loss too).
{
    const P = LOSS_POLICY_FROM_MS - 86_400_000;
    const r = run([buy(P, 1_000, 250), sell(P + 1, 1_000, 240)]);
    assert.equal(byId(r, 'a').totalProfit, -3_500, 'old split: 10 000 × 70% / 2');
}
console.log('lossPolicy.test: no fee on a loss, investors capped at unwithdrawn profit + capital, the rest on the manager');
