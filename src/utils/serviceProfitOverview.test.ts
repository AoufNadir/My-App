import assert from 'node:assert/strict';
import type { DigitalServiceTransaction, ManualAssetTransaction } from '../types';
import {
    areOwnerProfitSplitsEqual,
    buildServiceProfitOverview,
    emptyServiceProfitOverview,
    hasNoServiceActivity,
    serviceProfitTotal,
    type OwnerProfitSplit,
} from './serviceProfitOverview';

// V4-1 keeps the profit of the other businesses (services, digital services) apart from the profit of
// the USDT and EUR sales. Nothing is counted differently: this test runs the sums the Home page used
// to make inside « mon profit réel » (copied verbatim from V3-5, MainApp.tsx) and the new ones on the
// same made-up data, and asks for the very same numbers, digit for digit.

// ---- Reference: V3-5 MainApp.tsx, dailyOverview, copied verbatim (only the data arrives as arguments) ----
function referenceOwnerProfits(args: {
    manualAssetTransactions: ManualAssetTransaction[];
    digitalServiceTransactions: DigitalServiceTransaction[];
    nowTs: number;
    dayStartTs: number;
    weekStartTs: number;
    monthStartTs: number;
    yearStartTs: number;
    deriveOwnerTradingProfitForPeriod: (periodStartTs: number) => number;
    baseOwnerTotalProfit: number;
}) {
    const { manualAssetTransactions, digitalServiceTransactions, nowTs, dayStartTs, weekStartTs, monthStartTs, yearStartTs, deriveOwnerTradingProfitForPeriod } = args;
    const serviceProfitForPeriod = (periodStartTs: number) => manualAssetTransactions.reduce((sum, tx) => {
        if (tx.timestamp < periodStartTs || tx.timestamp > nowTs)
            return sum;
        if (tx.type !== 'service' && tx.type !== 'invoice')
            return sum;
        const amount = Math.abs(Number(tx.amount || 0));
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    const serviceProfitAllTime = manualAssetTransactions.reduce((sum, tx) => {
        if (tx.timestamp > nowTs || (tx.type !== 'service' && tx.type !== 'invoice'))
            return sum;
        const amount = Math.abs(Number(tx.amount || 0));
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    const digitalServiceProfitForPeriod = (periodStartTs: number) => digitalServiceTransactions.reduce((sum, tx) => {
        if (tx.timestamp < periodStartTs || tx.timestamp > nowTs)
            return sum;
        const amount = Number(tx.profitDzd || 0);
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    const digitalServiceProfitAllTime = digitalServiceTransactions.reduce((sum, tx) => {
        if (tx.timestamp > nowTs)
            return sum;
        const amount = Number(tx.profitDzd || 0);
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    const ownerProfitToday = deriveOwnerTradingProfitForPeriod(dayStartTs) + serviceProfitForPeriod(dayStartTs) + digitalServiceProfitForPeriod(dayStartTs);
    const ownerProfitWeek = deriveOwnerTradingProfitForPeriod(weekStartTs) + serviceProfitForPeriod(weekStartTs) + digitalServiceProfitForPeriod(weekStartTs);
    const ownerProfitMonth = deriveOwnerTradingProfitForPeriod(monthStartTs) + serviceProfitForPeriod(monthStartTs) + digitalServiceProfitForPeriod(monthStartTs);
    const ownerProfitYear = deriveOwnerTradingProfitForPeriod(yearStartTs) + serviceProfitForPeriod(yearStartTs) + digitalServiceProfitForPeriod(yearStartTs);
    const ownerProfitAllTime = args.baseOwnerTotalProfit + serviceProfitAllTime + digitalServiceProfitAllTime;
    return {
        ownerProfitToday, ownerProfitWeek, ownerProfitMonth, ownerProfitYear, ownerProfitAllTime,
        manual: { today: serviceProfitForPeriod(dayStartTs), week: serviceProfitForPeriod(weekStartTs), month: serviceProfitForPeriod(monthStartTs), year: serviceProfitForPeriod(yearStartTs), allTime: serviceProfitAllTime },
        digital: { today: digitalServiceProfitForPeriod(dayStartTs), week: digitalServiceProfitForPeriod(weekStartTs), month: digitalServiceProfitForPeriod(monthStartTs), year: digitalServiceProfitForPeriod(yearStartTs), allTime: digitalServiceProfitAllTime },
    };
}
// ---- End of the reference ----

// The new way, as MainApp.tsx now writes it.
function newOwnerProfits(args: Parameters<typeof referenceOwnerProfits>[0]) {
    const { manualAssetTransactions, digitalServiceTransactions, nowTs, dayStartTs, weekStartTs, monthStartTs, yearStartTs, deriveOwnerTradingProfitForPeriod } = args;
    const serviceProfit = buildServiceProfitOverview({ manualAssetTransactions, digitalServiceTransactions, nowTs, dayStartTs, weekStartTs, monthStartTs, yearStartTs });
    const tradingOwnerProfit = {
        today: deriveOwnerTradingProfitForPeriod(dayStartTs),
        week: deriveOwnerTradingProfitForPeriod(weekStartTs),
        month: deriveOwnerTradingProfitForPeriod(monthStartTs),
        year: deriveOwnerTradingProfitForPeriod(yearStartTs),
    };
    return {
        serviceProfit,
        tradingOwnerProfit,
        ownerProfitToday: tradingOwnerProfit.today + serviceProfit.today.manual + serviceProfit.today.digital,
        ownerProfitWeek: tradingOwnerProfit.week + serviceProfit.week.manual + serviceProfit.week.digital,
        ownerProfitMonth: tradingOwnerProfit.month + serviceProfit.month.manual + serviceProfit.month.digital,
        ownerProfitYear: tradingOwnerProfit.year + serviceProfit.year.manual + serviceProfit.year.digital,
        ownerProfitAllTime: args.baseOwnerTotalProfit + serviceProfit.allTime.manual + serviceProfit.allTime.digital,
    };
}

// ---- Made-up data: a fixed generator, so every run sees the same lines ----
let seed = 20261010;
const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
};
const DAY = 86_400_000;
const nowTs = new Date(2026, 9, 10, 15, 30, 0, 0).getTime();
const dayStartTs = new Date(2026, 9, 10).getTime();
const weekStartTs = new Date(2026, 9, 5).getTime();
const monthStartTs = new Date(2026, 9, 1).getTime();
const yearStartTs = new Date(2026, 0, 1).getTime();
const MANUAL_TYPES = ['service', 'invoice', 'payment_received', 'payment_made', 'adjustment'] as const;
const WEIRD_AMOUNTS: unknown[] = [undefined, null, '', 'abc', '1500.55', NaN, Infinity, -Infinity, 0, -250.1, 0.1, 0.2];
const manualTransactions = (count: number) => Array.from({ length: count }, (_, index) => {
    const timestamp = nowTs + Math.round((random() * 800 - 760) * DAY) + Math.round(random() * DAY);
    const amount = random() < 0.12 ? WEIRD_AMOUNTS[Math.floor(random() * WEIRD_AMOUNTS.length)] : Math.round(random() * 1_500_000) / 100 * (random() < 0.1 ? -1 : 1);
    return { id: `m${index}`, actifId: 'a1', clientId: 'x1', type: MANUAL_TYPES[Math.floor(random() * MANUAL_TYPES.length)], amount, timestamp } as unknown as ManualAssetTransaction;
});
const digitalTransactions = (count: number) => Array.from({ length: count }, (_, index) => {
    const timestamp = nowTs + Math.round((random() * 800 - 760) * DAY) + Math.round(random() * DAY);
    const profitDzd = random() < 0.1 ? WEIRD_AMOUNTS[Math.floor(random() * WEIRD_AMOUNTS.length)] : Math.round((random() * 3000 - 800)) / 10 + 0.07;
    return { id: `d${index}`, type: 'digital_service_sale', clientId: 'x1', serviceName: 'Fake card', profitDzd, timestamp } as unknown as DigitalServiceTransaction;
});
// A trading profit that is not a round number, so a different order of additions would show.
const tradingFor = (periodStartTs: number) => 8_100.4 + (nowTs - periodStartTs) / DAY * 13.37 + 0.1 + 0.2;

let cases = 0;
for (let round = 0; round < 60; round++) {
    const args = {
        manualAssetTransactions: manualTransactions(round % 7 === 0 ? 0 : 5 + Math.floor(random() * 90)),
        digitalServiceTransactions: digitalTransactions(round % 11 === 0 ? 0 : Math.floor(random() * 60)),
        nowTs, dayStartTs, weekStartTs, monthStartTs, yearStartTs,
        deriveOwnerTradingProfitForPeriod: tradingFor,
        baseOwnerTotalProfit: 1_234_567.89 + round * 0.37,
    };
    const before = referenceOwnerProfits(args);
    const after = newOwnerProfits(args);
    // The old total of the Home page is untouched, to the last digit.
    for (const key of ['ownerProfitToday', 'ownerProfitWeek', 'ownerProfitMonth', 'ownerProfitYear', 'ownerProfitAllTime'] as const) {
        assert.ok(Object.is(after[key], before[key]), `round ${round}: ${key} ${after[key]} vs ${before[key]}`);
        cases++;
    }
    // Each business, period by period, is what the old sums were made of.
    for (const period of ['today', 'week', 'month', 'year', 'allTime'] as const) {
        assert.ok(Object.is(after.serviceProfit[period].manual, before.manual[period]), `round ${round}: manual ${period}`);
        assert.ok(Object.is(after.serviceProfit[period].digital, before.digital[period]), `round ${round}: digital ${period}`);
        cases += 2;
    }
    // The trading part is exactly what the old total started from.
    assert.equal(after.tradingOwnerProfit.month, tradingFor(monthStartTs));
    // Trading, then the two businesses, add back to the old total.
    assert.ok(Object.is(after.tradingOwnerProfit.year + after.serviceProfit.year.manual + after.serviceProfit.year.digital, before.ownerProfitYear));
    cases++;
}

// ---- Cases written by hand ----
const at = (daysAgo: number) => nowTs - daysAgo * DAY;
const manual = [
    { id: 'm1', type: 'service', amount: 30_000, timestamp: at(0) - 3_600_000 },
    { id: 'm2', type: 'invoice', amount: -12_000, timestamp: at(2) },
    { id: 'm3', type: 'payment_received', amount: 99_999, timestamp: at(1) },
    { id: 'm4', type: 'service', amount: 8_000, timestamp: at(40) },
    { id: 'm5', type: 'service', amount: 5_000, timestamp: at(-3) },
] as unknown as ManualAssetTransaction[];
const digital = [
    { id: 'd1', profitDzd: 1_500, timestamp: at(0) - 7_200_000 },
    { id: 'd2', profitDzd: -400, timestamp: at(2) },
    { id: 'd3', profitDzd: 700, timestamp: at(70) },
] as unknown as DigitalServiceTransaction[];
const overview = buildServiceProfitOverview({ manualAssetTransactions: manual, digitalServiceTransactions: digital, nowTs, dayStartTs, weekStartTs, monthStartTs, yearStartTs });
// Today: the service of this morning; the payment received is not a profit; the one dated in the future is not counted yet.
assert.deepEqual(overview.today, { manual: 30_000, digital: 1_500 });
// This week (since Monday 5 October): the invoice of two days ago counts with its amount, whatever its sign.
assert.deepEqual(overview.week, { manual: 42_000, digital: 1_100 });
assert.deepEqual(overview.month, { manual: 42_000, digital: 1_100 });
// The year goes back to 1 January: the service of 40 days ago and the digital margin of 70 days ago are in.
assert.deepEqual(overview.year, { manual: 50_000, digital: 1_800 });
assert.deepEqual(overview.allTime, { manual: 50_000, digital: 1_800 });
assert.equal(serviceProfitTotal(overview.month), 43_100);
// A digital service sold at a loss lowers the total of the other businesses.
const loss = buildServiceProfitOverview({ manualAssetTransactions: [], digitalServiceTransactions: [{ id: 'd9', profitDzd: -250, timestamp: at(1) } as unknown as DigitalServiceTransaction], nowTs, dayStartTs, weekStartTs, monthStartTs, yearStartTs });
assert.equal(serviceProfitTotal(loss.month), -250);
assert.equal(hasNoServiceActivity(loss), false, 'a loss is activity too');

// ---- No activity: the card stays hidden ----
assert.equal(hasNoServiceActivity(undefined), true);
assert.equal(hasNoServiceActivity(null), true);
assert.equal(hasNoServiceActivity(emptyServiceProfitOverview()), true);
assert.equal(hasNoServiceActivity(buildServiceProfitOverview({ manualAssetTransactions: [], digitalServiceTransactions: [], nowTs, dayStartTs, weekStartTs, monthStartTs, yearStartTs })), true);
assert.equal(hasNoServiceActivity(overview), false);
// Only payments received and adjustments: nothing earned.
assert.equal(hasNoServiceActivity(buildServiceProfitOverview({ manualAssetTransactions: manual.filter((tx) => tx.type === 'payment_received'), digitalServiceTransactions: [], nowTs, dayStartTs, weekStartTs, monthStartTs, yearStartTs })), true);

// ---- The comparison that decides whether the Home page is drawn again ----
const split = (): OwnerProfitSplit => ({
    trading: { today: 100, week: 200, month: 300, year: 400 },
    services: buildServiceProfitOverview({ manualAssetTransactions: manual, digitalServiceTransactions: digital, nowTs, dayStartTs, weekStartTs, monthStartTs, yearStartTs }),
});
assert.equal(areOwnerProfitSplitsEqual(undefined, undefined), true);
assert.equal(areOwnerProfitSplitsEqual(null, undefined), true, 'no split on either side');
assert.equal(areOwnerProfitSplitsEqual(split(), undefined), false);
assert.equal(areOwnerProfitSplitsEqual(undefined, split()), false);
assert.equal(areOwnerProfitSplitsEqual(split(), split()), true, 'same figures, other objects');
for (const mutate of [
    (value: OwnerProfitSplit) => { value.trading.today += 0.01; },
    (value: OwnerProfitSplit) => { value.trading.year -= 1; },
    (value: OwnerProfitSplit) => { value.services.today.manual += 1; },
    (value: OwnerProfitSplit) => { value.services.week.digital -= 1; },
    (value: OwnerProfitSplit) => { value.services.month.manual += 0.5; },
    (value: OwnerProfitSplit) => { value.services.year.digital += 2; },
    (value: OwnerProfitSplit) => { value.services.allTime.manual += 3; },
    (value: OwnerProfitSplit) => { value.services.allTime.digital += 4; },
]) {
    const changed = split();
    mutate(changed);
    assert.equal(areOwnerProfitSplitsEqual(split(), changed), false);
    assert.equal(areOwnerProfitSplitsEqual(changed, split()), false);
}

console.log(`serviceProfitOverview.test: the old Home total is unchanged in ${cases} comparisons, the other businesses add up apart, and the hand-written cases hold`);
