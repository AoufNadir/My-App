import type { Tx } from '../types';
import { computePamLedger, type PamLedgerResult } from './pamLedger';
import { roundM } from './money';
import { stampAt } from './editStamp';
import { isInLockedPeriod } from './periodLock';

/**
 * « When did the sale really happen? » (V5-3). A sale found days later (the inventory investigator's
 * unrecorded sale) can be saved on the day it happened. Nothing is computed differently: the sale
 * is stamped with that moment and the ledger, which replays operations by their timestamp, gives it
 * the stock and the average buy price (PAM) of that day, exactly as if it had been typed then.
 *
 * What this adds is the guard rails a late entry needs: not in the future, not in a closed month,
 * and enough stock on that day AND for every sale recorded after it.
 */

/** A sale with no time is placed at noon (the delivery-expense window does the same). */
export const BACKDATED_SALE_DEFAULT_HOUR = 12;
/** A clock a minute ahead is not « the future ». */
const FUTURE_TOLERANCE_MS = 60_000;
/** Why a date is refused, in the French the save checks use (the windows translate them, see formMessages.ts). */
export const SALE_DATE_MESSAGES = {
    invalid: 'Date de vente invalide',
    future: 'La date de la vente ne peut pas être dans le futur',
    closedMonth: 'Ce mois est clôturé : la vente ne peut pas y être ajoutée',
    noStock: 'Stock insuffisant à cette date',
} as const;
/** Id of the sale while it is only a draft in the ledger replay. */
export const PENDING_SALE_ID = '__pending-sale__';

export type SaleMoment =
    /** Nothing chosen (or today without a time): the sale is stamped when it is saved, as always. */
    | { kind: 'now' }
    | { kind: 'at'; timestamp: number; date: string; time: string }
    | { kind: 'invalid' }
    | { kind: 'future' };

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_INPUT = /^(\d{2}):(\d{2})$/;

const sameLocalDay = (a: number, b: number) => {
    const first = new Date(a);
    const second = new Date(b);
    return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
};

/**
 * The moment typed in the sale window: a date input (`YYYY-MM-DD`) and a time input (`HH:mm`),
 * both optional. A date alone means noon of that day; a time alone means that time today.
 */
export function resolveSaleMoment(dateInput: string, timeInput: string, nowMs: number): SaleMoment {
    const dateText = dateInput.trim();
    const timeText = timeInput.trim();
    if (!dateText && !timeText)
        return { kind: 'now' };
    const today = new Date(nowMs);
    let year = today.getFullYear();
    let month = today.getMonth();
    let day = today.getDate();
    if (dateText) {
        const parts = DATE_INPUT.exec(dateText);
        if (!parts)
            return { kind: 'invalid' };
        year = Number(parts[1]);
        month = Number(parts[2]) - 1;
        day = Number(parts[3]);
    }
    let hour = BACKDATED_SALE_DEFAULT_HOUR;
    let minute = 0;
    if (timeText) {
        const parts = TIME_INPUT.exec(timeText);
        if (!parts)
            return { kind: 'invalid' };
        hour = Number(parts[1]);
        minute = Number(parts[2]);
        if (hour > 23 || minute > 59)
            return { kind: 'invalid' };
    }
    const moment = new Date(year, month, day, hour, minute, 0, 0);
    // 31/02 or month 13 roll over into another date: that is a typo, not a date.
    if (moment.getFullYear() !== year || moment.getMonth() !== month || moment.getDate() !== day)
        return { kind: 'invalid' };
    const timestamp = moment.getTime();
    if (sameLocalDay(timestamp, nowMs) && !timeText)
        return { kind: 'now' };
    if (timestamp > nowMs + FUTURE_TOLERANCE_MS)
        return { kind: 'future' };
    return { kind: 'at', ...stampAt(timestamp) };
}

export type SaleDraft = {
    currency: 'USDT' | 'EUR';
    quantity: number;
    /** DZD per unit, as typed */
    sellPrice: number;
    /** What the sale brings in, in dinars before rounding (a typed total is kept as typed) */
    saleValueDzd: number;
    /** The same, rounded to the dinar: the amount saved and moved to the cash box or the client */
    totalRevenue: number;
};

export type BackdatedSalePlan =
    | { ok: false; reason: 'closedMonth' | 'noStock' }
    | {
        ok: true;
        /** PAM on that day (cents), the one the sale form would have shown then */
        avgAtSale: number;
        /** Profit saved on the sale: revenue minus PAM of that day times quantity (same formula as a sale typed that day) */
        profit: number;
        /** Cost taken out of the stock: PAM of that day times quantity */
        soldCost: number;
        /** Sales already recorded after that moment, whose profit follows the new stock and PAM */
        laterSales: { count: number; shift: number };
    };

const warningKeys = (ledger: PamLedgerResult) =>
    new Set(ledger.warnings.filter((w) => w.code === 'oversell' || w.code === 'uncosted_quantity_sold').map((w) => `${w.txId}:${w.code}`));

/**
 * Checks a sale placed at `timestamp` against everything recorded and returns what it will cost
 * and earn on that day. Pure: the ledger replays by timestamp, so recording order never matters.
 */
export function planBackdatedSale(input: {
    transactions: readonly Tx[];
    draft: SaleDraft;
    timestamp: number;
    nowMs: number;
    /** End of the last closed month, when there is one */
    lockedThrough?: number | null;
}): BackdatedSalePlan {
    const { transactions, draft, timestamp, nowMs } = input;
    if (isInLockedPeriod(timestamp, input.lockedThrough))
        return { ok: false, reason: 'closedMonth' };
    const stamp = stampAt(timestamp);
    const pending: Tx = {
        id: PENDING_SALE_ID,
        type: 'sell',
        currency: draft.currency,
        quantity: draft.quantity,
        sell: draft.sellPrice,
        total: draft.totalRevenue,
        settlementCurrency: 'DZD',
        date: stamp.date,
        time: stamp.time,
        timestamp,
    };
    const before = computePamLedger([...transactions], { nowMs });
    const after = computePamLedger([...transactions, pending], { nowMs });
    // A sale on that day, or one recorded after it, that no longer finds its stock.
    const known = warningKeys(before);
    for (const key of warningKeys(after)) {
        if (!known.has(key))
            return { ok: false, reason: 'noStock' };
    }
    const row = after.operationRows.find((operation) => operation.txId === PENDING_SALE_ID);
    if (!row)
        return { ok: false, reason: 'noStock' };
    const avgAtSale = row.statsBefore.avgBuy;
    const soldCost = roundM(avgAtSale * draft.quantity);
    let count = 0;
    let shiftCents = 0;
    for (const sale of after.sellProfitRows) {
        if (sale.txId === PENDING_SALE_ID || sale.timestamp < timestamp)
            continue;
        const was = before.profitByTxId[sale.txId];
        if (!was)
            continue;
        const diff = Math.round(sale.derivedProfit * 100) - Math.round(was.derivedProfit * 100);
        if (diff !== 0) {
            count += 1;
            shiftCents += diff;
        }
    }
    return {
        ok: true,
        avgAtSale,
        profit: Number((draft.saleValueDzd - avgAtSale * draft.quantity).toFixed(2)),
        soldCost,
        laterSales: { count, shift: shiftCents / 100 },
    };
}
