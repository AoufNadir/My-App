// P3 (owner, 2026-11-16): one clear decision for the goal of the month: raise the quantity, raise the price, both,
// or keep going. It compares this month so far with the same days of the last three months (USDT, the main
// currency) and says the number. Read only.
import { reviewGoal, type GoalLevels, type GoalReview, type ProfitRow } from './flexibleGoal';

export type CoachRow = ProfitRow & { quantity?: number | null; currency?: string | null };
export type CoachAdvice =
    | { kind: 'keep' }
    | { kind: 'quantity'; extraQtyPerWeek: number }
    | { kind: 'price'; extraPerUnit: number }
    | { kind: 'both'; extraQtyPerWeek: number; extraPerUnit: number };
export type GoalCoach = {
    review: GoalReview;
    /** USDT sold this month so far / usually by the same day */
    qtyNow: number;
    qtyUsual: number;
    /** profit per USDT this month / usually */
    marginNow: number;
    marginUsual: number;
    advice: CoachAdvice;
};

const COMPARE_MONTHS = 3;
const QTY_LOW = 0.9; // below 90 % of the usual quantity: quantity is the problem
const MARGIN_LOW = 0.95; // below 95 % of the usual margin: the price is the problem

const isUsdt = (row: CoachRow) => (row.currency || 'USDT') === 'USDT';

function sameDaysOf(rows: readonly CoachRow[], year: number, month: number, uptoDay: number) {
    const start = new Date(year, month, 1).getTime();
    const end = new Date(year, month, uptoDay + 1).getTime();
    return rows.filter((row) => row.timestamp >= start && row.timestamp < end);
}

function totals(rows: readonly CoachRow[]) {
    let qty = 0;
    let usdtProfit = 0;
    for (const row of rows) {
        if (!isUsdt(row)) continue;
        qty += Math.max(0, Number(row.quantity) || 0);
        usdtProfit += Number(row.derivedProfit) || 0;
    }
    return { qty, margin: qty > 0 ? usdtProfit / qty : 0 };
}

export function buildGoalCoach(input: { rows: readonly CoachRow[]; goal: GoalLevels; now: number; raisedInWeek?: number | null }): GoalCoach {
    const today = new Date(input.now);
    const day = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const thisMonth = sameDaysOf(input.rows, today.getFullYear(), today.getMonth(), day);
    const review = reviewGoal({ goal: input.goal, monthDeals: thisMonth, now: input.now, raisedInWeek: input.raisedInWeek });
    const now = totals(thisMonth);
    const past = Array.from({ length: COMPARE_MONTHS }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - 1 - i, 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return {
            sameDays: totals(sameDaysOf(input.rows, d.getFullYear(), d.getMonth(), Math.min(day, lastDay))),
            whole: totals(sameDaysOf(input.rows, d.getFullYear(), d.getMonth(), lastDay)),
        };
    }).filter((m) => m.whole.qty > 0);
    const avg = (pick: (m: typeof past[number]) => number) => (past.length ? past.reduce((s, m) => s + pick(m), 0) / past.length : 0);
    const qtyUsual = avg((m) => m.sameDays.qty);
    const usualMonthQty = avg((m) => m.whole.qty);
    const marginUsual = (() => {
        const qty = past.reduce((s, m) => s + m.whole.qty, 0);
        return qty > 0 ? past.reduce((s, m) => s + m.whole.qty * m.whole.margin, 0) / qty : 0;
    })();

    const remainingProfit = Math.max(0, input.goal.target - review.profitSoFar);
    const weeksLeft = Math.max(1, (daysInMonth - day) / 7);
    let advice: CoachAdvice = { kind: 'keep' };
    if (review.status !== 'ahead' && review.status !== 'on_track' && remainingProfit > 0 && past.length > 0) {
        const qtyLow = qtyUsual > 0 && now.qty < qtyUsual * QTY_LOW;
        const marginLow = marginUsual > 0 && now.margin < marginUsual * MARGIN_LOW;
        const usualRestQty = Math.max(0, usualMonthQty - qtyUsual);
        const margin = Math.max(now.margin, marginUsual, 0.01);
        // quantity: what must be sold at today's margin, beyond what usually sells in the rest of the month
        const extraQtyPerWeek = Math.max(0, Math.ceil((remainingProfit / margin - usualRestQty) / weeksLeft / 10) * 10);
        // price: the margin needed on the usual remaining quantity, above today's margin
        const extraPerUnit = usualRestQty > 0 ? Math.max(0, Math.ceil((remainingProfit / usualRestQty - now.margin) * 2) / 2) : 0;
        if (qtyLow && !marginLow) advice = { kind: 'quantity', extraQtyPerWeek };
        else if (marginLow && !qtyLow) advice = { kind: 'price', extraPerUnit };
        else advice = { kind: 'both', extraQtyPerWeek: Math.ceil(extraQtyPerWeek / 2 / 10) * 10, extraPerUnit: Math.ceil(extraPerUnit) / 2 };
    }
    return { review, qtyNow: Math.round(now.qty), qtyUsual: Math.round(qtyUsual), marginNow: Math.round(now.margin * 100) / 100, marginUsual: Math.round(marginUsual * 100) / 100, advice };
}
