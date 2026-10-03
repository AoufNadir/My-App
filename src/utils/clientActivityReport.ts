import type { ClientTransactionDzd, Tx } from '../types';
import { toCents } from './money';

/**
 * Client activity report (weekly, monthly, yearly), sent to the client as a PDF.
 *
 * Read-only. The numbers come from the client's own ledger rows, with the same rule and the same
 * cent arithmetic as the balance on the client page (rows with affectsBalance === false never
 * move the balance). Quantities come from the portfolio operation a row is linked to.
 *
 * What the client must never see is never read here: our buy price and profit (Tx.price,
 * Tx.profit, Tx.sell is not needed either), smart-pricing fields (sp*), the notes and tags of
 * any row, other clients. A DZD value that is only our own valuation of a payment made in EUR
 * (a sale settled in EUR, a purchase paid in EUR) is not shown either: it would give away our
 * EUR cost. Only the EUR amount the client actually paid or received is shown for those.
 */

export type ReportKind = 'week' | 'month' | 'year';
export type ReportLang = 'ar' | 'fr';
export type ReportCurrency = 'USDT' | 'EUR';

export type ReportPeriod = {
    kind: ReportKind;
    key: string;
    year: number;
    /** 0-11; -1 for a year */
    month: number;
    /** Week number inside its month (week 1 holds the 1st); 0 for a month or a year */
    week: number;
    /** First and last day of the month covered by a week (1 and the month's last day otherwise) */
    firstDay: number;
    lastDay: number;
    /** Local start of the first day and local end of the last day, in ms */
    from: number;
    to: number;
};

export type ReportPaymentMethod = 'cash' | 'baridi' | 'usdt' | 'eur' | 'other';

export type ReportEntryKind =
    | 'buy' // the client bought USDT or EUR from us
    | 'service' // the client bought a digital service
    | 'payment' // the client paid us
    | 'saleToUs' // the client sold us USDT or EUR
    | 'withdrawal' // money taken from the client's balance (paid out to them, or used for another operation)
    | 'transfer' // balance moved between the client and another account (never named)
    | 'adjustment' // balance correction
    | 'opening' // opening balance
    | 'writeOff'; // part of the debt forgiven

export type ReportEntry = {
    id: string;
    timestamp: number;
    kind: ReportEntryKind;
    /** True when the row moves the client balance (same rule as the client page) */
    affectsBalance: boolean;
    /** What the row does to the client balance, in cents (0 for a history-only row) */
    balanceCents: number;
    /** Amount shown in DZD, in cents (≥ 0); null when the only DZD value is our own valuation */
    dzdCents: number | null;
    currency?: ReportCurrency;
    quantity?: number;
    /** EUR the client paid (purchase settled in EUR) or received (sale to us paid in EUR) */
    eurAmount?: number;
    /** How a purchase was paid at the time, or how a payment / withdrawal was made */
    method?: ReportPaymentMethod;
};

export type CurrencySummary = {
    currency: ReportCurrency;
    /** Every purchase of this currency with a known quantity */
    quantity: number;
    purchases: number;
    /** Paid in DZD: the client's own average price is dzdCents / dzdQuantity */
    dzdQuantity: number;
    dzdCents: number;
    /** Paid in EUR (USDT settled in EUR) */
    eurQuantity: number;
    eurAmount: number;
};

export type PriceTrendPoint = { period: ReportPeriod; averagePrice: number };

export type ReportCurrencyCard = CurrencySummary & {
    /** Average price over the last three periods, oldest first (ج); empty when fewer than two have purchases */
    trend: PriceTrendPoint[];
};

export type PeriodTotals = {
    /** Purchases in DZD (currencies and services), cents */
    spentCents: number;
    currencies: Record<ReportCurrency, CurrencySummary>;
    serviceCount: number;
    serviceCents: number;
    purchaseCount: number;
};

export type BalanceLineKey = 'purchases' | 'payments' | 'saleToUs' | 'withdrawal' | 'transfer' | 'opening' | 'writeOff' | 'adjustment';

export type BalanceCalculation = {
    /** Balances in cents, positive = in the client's favour (as on the client page) */
    openingCents: number;
    closingCents: number;
    /** Each line in cents; purchases and payments ≥ 0, the others signed by their effect on the balance */
    lines: Record<BalanceLineKey, number>;
    paymentsByMethod: Array<{ method: ReportPaymentMethod; cents: number }>;
};

export type ComparisonRow = {
    period: ReportPeriod;
    totals: PeriodTotals;
    /** Change of spentCents against the row before, in %, when both rows have purchases and this one is over */
    changePct: number | null;
    isCurrent: boolean;
    /** Still running: compared with nothing, a few days against a whole period would mislead */
    isLive: boolean;
};

export type OperationRow = {
    entry: ReportEntry;
    /** Client balance after the row, in cents */
    balanceAfterCents: number;
};

export type ClientActivityReport = {
    kind: ReportKind;
    period: ReportPeriod;
    /** The period is still running: its data stops today */
    isLive: boolean;
    /** Last day shown in the period header (today for a running period) */
    shownTo: number;
    issuedAt: number;
    reference: string;
    totals: PeriodTotals;
    currencyCards: ReportCurrencyCard[];
    /** Spending of the period this report is compared with (previous week of the month, previous month); null while the period is running */
    comparedWith: { period: ReportPeriod; spentCents: number } | null;
    /** Yearly report: the month with the most purchases */
    bestMonth: { period: ReportPeriod; spentCents: number } | null;
    balance: BalanceCalculation;
    /** Monthly report only: since January, and the month's biggest purchase */
    sinceJanuary: { quantities: Record<ReportCurrency, number>; spentCents: number } | null;
    biggestPurchase: ReportEntry | null;
    comparison: ComparisonRow[];
    showUsdtColumn: boolean;
    showEurColumn: boolean;
    /** Weekly and monthly reports; the yearly report sends to each month's own report */
    operations: OperationRow[] | null;
    /** Some DZD amount has cents: the report shows two decimals for every DZD amount */
    showCents: boolean;
};

const pad2 = (value: number) => String(value).padStart(2, '0');
const startOfDay = (year: number, month: number, day: number) => new Date(year, month, day).getTime();
const endOfDay = (year: number, month: number, day: number) => new Date(year, month, day, 23, 59, 59, 999).getTime();
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** Weeks of a month, Sunday to Saturday, cut at the month's first and last day so they add up to the month. */
export function monthWeeks(year: number, month: number): ReportPeriod[] {
    const last = daysInMonth(year, month);
    const weeks: ReportPeriod[] = [];
    let first = 1;
    while (first <= last) {
        const dayOfWeek = new Date(year, month, first).getDay();
        const lastDay = Math.min(last, first + (6 - dayOfWeek));
        const week = weeks.length + 1;
        weeks.push({
            kind: 'week',
            key: `w-${year}-${pad2(month + 1)}-${week}`,
            year,
            month,
            week,
            firstDay: first,
            lastDay,
            from: startOfDay(year, month, first),
            to: endOfDay(year, month, lastDay),
        });
        first = lastDay + 1;
    }
    return weeks;
}

export function monthPeriod(year: number, month: number): ReportPeriod {
    const normalized = new Date(year, month, 1);
    const y = normalized.getFullYear();
    const m = normalized.getMonth();
    const last = daysInMonth(y, m);
    return { kind: 'month', key: `m-${y}-${pad2(m + 1)}`, year: y, month: m, week: 0, firstDay: 1, lastDay: last, from: startOfDay(y, m, 1), to: endOfDay(y, m, last) };
}

export function yearPeriod(year: number): ReportPeriod {
    return { kind: 'year', key: `y-${year}`, year, month: -1, week: 0, firstDay: 1, lastDay: 31, from: startOfDay(year, 0, 1), to: endOfDay(year, 11, 31) };
}

export function periodContaining(kind: ReportKind, timestamp: number): ReportPeriod {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth();
    if (kind === 'year')
        return yearPeriod(year);
    if (kind === 'month')
        return monthPeriod(year, month);
    const day = date.getDate();
    return monthWeeks(year, month).find((week) => day >= week.firstDay && day <= week.lastDay)!;
}

/** The calendar period just before (a week can be in the previous month). */
export function periodBefore(period: ReportPeriod): ReportPeriod {
    return periodContaining(period.kind, period.from - 1);
}

/**
 * The period a report is compared with: the previous week of the same month (week 1 has none,
 * as the user asked), the previous month, the previous year.
 */
export function comparisonPeriod(period: ReportPeriod): ReportPeriod | null {
    if (period.kind === 'week')
        return period.week > 1 ? monthWeeks(period.year, period.month)[period.week - 2] : null;
    if (period.kind === 'month')
        return monthPeriod(period.year, period.month - 1);
    return yearPeriod(period.year - 1);
}

export function parsePeriodKey(key: string): ReportPeriod | null {
    const week = /^w-(\d{4})-(\d{2})-(\d{1,2})$/.exec(key);
    if (week) {
        const found = monthWeeks(Number(week[1]), Number(week[2]) - 1)[Number(week[3]) - 1];
        return found || null;
    }
    const month = /^m-(\d{4})-(\d{2})$/.exec(key);
    if (month)
        return monthPeriod(Number(month[1]), Number(month[2]) - 1);
    const year = /^y-(\d{4})$/.exec(key);
    if (year)
        return yearPeriod(Number(year[1]));
    return null;
}

const PERIOD_LIST_LIMIT: Record<ReportKind, number> = { week: 30, month: 36, year: 10 };

/** Periods offered in the report window, newest first: from the current one back to the client's first operation. */
export function listReportPeriods(kind: ReportKind, firstOperationAt: number | null, now: number): ReportPeriod[] {
    const periods: ReportPeriod[] = [];
    let period = periodContaining(kind, now);
    while (periods.length < PERIOD_LIST_LIMIT[kind]) {
        periods.push(period);
        if (firstOperationAt === null || period.from <= firstOperationAt)
            break;
        period = periodBefore(period);
    }
    return periods;
}

/**
 * Period selected when the window opens: the newest finished week or month with an operation of the
 * client (the one usually sent), else the newest with an operation, else the current one. For a
 * year, the newest with an operation (the current year to date, most of the time).
 */
export function defaultReportPeriod(periods: ReportPeriod[], clientRows: ReadonlyArray<Pick<ClientTransactionDzd, 'timestamp'>>, now: number): ReportPeriod {
    const hasActivity = (period: ReportPeriod) => clientRows.some((row) => row.timestamp >= period.from && row.timestamp <= period.to);
    const finished = periods[0]?.kind === 'year' ? undefined : periods.find((period) => period.to < now && hasActivity(period));
    return finished || periods.find(hasActivity) || periods[0];
}

function methodFromLedger(paymentMethod: ClientTransactionDzd['paymentMethod'] | string | undefined): ReportPaymentMethod {
    if (paymentMethod === 'Espèces' || paymentMethod === 'EspÃ¨ces')
        return 'cash';
    if (paymentMethod === 'BaridiMob')
        return 'baridi';
    if (paymentMethod === 'USDT')
        return 'usdt';
    if (paymentMethod === 'EUR')
        return 'eur';
    return 'other';
}

const positiveNumber = (value: unknown): number | undefined => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
};

/**
 * One ledger row as the client may see it. `linked` is the portfolio operation the row points to,
 * when there is one; only its kind, currency, quantity and EUR leg are read.
 */
export function classifyClientRow(row: ClientTransactionDzd, linked?: Tx): ReportEntry {
    const montantCents = toCents(Number(row.montant) || 0);
    const affectsBalance = row.affectsBalance !== false;
    const balanceCents = affectsBalance ? montantCents : 0;
    const base = { id: row.id, timestamp: Number(row.timestamp) || 0, affectsBalance, balanceCents };
    const portfolio = linked && (linked.type === 'buy' || linked.type === 'sell') ? linked : undefined;
    const ledgerMethod = methodFromLedger(row.paymentMethod);
    switch (row.type) {
        case 'Vente USDT':
        case 'Vente EUR': {
            const sale = portfolio?.type === 'sell' ? portfolio : undefined;
            const currency: ReportCurrency = sale?.currency === 'EUR' || (!sale && row.type === 'Vente EUR') ? 'EUR' : 'USDT';
            const settledInEur = Boolean(sale && sale.currency === 'USDT' && sale.settlementCurrency === 'EUR');
            const paidThroughAnotherAccount = Boolean(sale?.linkedClientDzdId);
            return {
                ...base,
                kind: 'buy',
                currency,
                quantity: positiveNumber(sale?.quantity),
                dzdCents: settledInEur && !affectsBalance ? null : Math.abs(montantCents),
                ...(settledInEur ? { eurAmount: positiveNumber(sale?.saleValueEur) } : {}),
                ...(affectsBalance ? {} : { method: settledInEur ? 'eur' : paidThroughAnotherAccount ? 'other' : ledgerMethod }),
            };
        }
        case 'Vente service numérique': {
            // Paid in USDT or EUR, its DZD amount is our own valuation of that currency.
            const paidInCurrency = !affectsBalance && (ledgerMethod === 'usdt' || ledgerMethod === 'eur');
            return {
                ...base,
                kind: 'service',
                dzdCents: paidInCurrency ? null : Math.abs(montantCents),
                ...(affectsBalance ? {} : { method: ledgerMethod }),
            };
        }
        case 'Règlement Reçu': {
            if (portfolio?.type === 'buy') {
                const fundedInEur = portfolio.purchaseFundingCurrency === 'EUR';
                return {
                    ...base,
                    kind: 'saleToUs',
                    currency: portfolio.currency === 'EUR' ? 'EUR' : 'USDT',
                    quantity: positiveNumber(portfolio.quantity),
                    dzdCents: fundedInEur && !affectsBalance ? null : Math.abs(montantCents),
                    ...(fundedInEur ? { eurAmount: positiveNumber(portfolio.purchaseAmountEur) } : {}),
                    ...(affectsBalance ? {} : { method: fundedInEur ? 'eur' : portfolio.linkedClientDzdId ? 'other' : ledgerMethod }),
                };
            }
            return { ...base, kind: 'payment', dzdCents: Math.abs(montantCents), method: ledgerMethod };
        }
        case 'Achat EUR':
            return { ...base, kind: 'saleToUs', currency: 'EUR', dzdCents: Math.abs(montantCents), ...(affectsBalance ? {} : { method: ledgerMethod }) };
        case 'Paiement Effectué':
            return { ...base, kind: 'withdrawal', dzdCents: Math.abs(montantCents), method: portfolio ? 'other' : ledgerMethod };
        case 'Transfert Entrant':
        case 'Transfert Sortant':
            return { ...base, kind: 'transfer', dzdCents: Math.abs(montantCents) };
        case 'Solde Initial':
            return { ...base, kind: 'opening', dzdCents: Math.abs(montantCents) };
        case 'Remise solde':
            return { ...base, kind: 'writeOff', dzdCents: Math.abs(montantCents) };
        default:
            return { ...base, kind: 'adjustment', dzdCents: Math.abs(montantCents) };
    }
}

export function buildReportEntries(clientRows: ReadonlyArray<ClientTransactionDzd>, transactions: ReadonlyArray<Tx>): ReportEntry[] {
    const txById = new Map<string, Tx>();
    transactions.forEach((tx) => txById.set(tx.id, tx));
    return clientRows
        .map((row) => classifyClientRow(row, row.linkedTxId ? txById.get(row.linkedTxId) : undefined))
        .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

const isPurchase = (entry: ReportEntry) => entry.kind === 'buy' || entry.kind === 'service';

/** DZD a purchase adds to the client's purchases: what it put on the account, or what was paid on the spot. */
function purchaseCents(entry: ReportEntry): number {
    if (entry.affectsBalance)
        return -entry.balanceCents;
    return entry.dzdCents ?? 0;
}

function emptyCurrency(currency: ReportCurrency): CurrencySummary {
    return { currency, quantity: 0, purchases: 0, dzdQuantity: 0, dzdCents: 0, eurQuantity: 0, eurAmount: 0 };
}

const inPeriod = (entry: ReportEntry, period: Pick<ReportPeriod, 'from' | 'to'>) => entry.timestamp >= period.from && entry.timestamp <= period.to;

export function periodTotals(entries: ReadonlyArray<ReportEntry>, period: Pick<ReportPeriod, 'from' | 'to'>): PeriodTotals {
    const totals: PeriodTotals = {
        spentCents: 0,
        currencies: { USDT: emptyCurrency('USDT'), EUR: emptyCurrency('EUR') },
        serviceCount: 0,
        serviceCents: 0,
        purchaseCount: 0,
    };
    for (const entry of entries) {
        if (!inPeriod(entry, period) || !isPurchase(entry))
            continue;
        const cents = purchaseCents(entry);
        totals.spentCents += cents;
        totals.purchaseCount += 1;
        if (entry.kind === 'service') {
            totals.serviceCount += 1;
            totals.serviceCents += cents;
            continue;
        }
        const summary = totals.currencies[entry.currency || 'USDT'];
        summary.purchases += 1;
        if (!entry.quantity)
            continue;
        summary.quantity += entry.quantity;
        if (entry.dzdCents !== null) {
            summary.dzdQuantity += entry.quantity;
            summary.dzdCents += cents;
        }
        else if (entry.eurAmount) {
            summary.eurQuantity += entry.quantity;
            summary.eurAmount += entry.eurAmount;
        }
    }
    return totals;
}

export const averagePrice = (cents: number, quantity: number) => (quantity > 0 ? cents / 100 / quantity : 0);

export function balanceBefore(entries: ReadonlyArray<ReportEntry>, timestamp: number): number {
    return entries.reduce((sum, entry) => (entry.timestamp < timestamp ? sum + entry.balanceCents : sum), 0);
}

const OTHER_LINE: Partial<Record<ReportEntryKind, BalanceLineKey>> = {
    saleToUs: 'saleToUs',
    withdrawal: 'withdrawal',
    transfer: 'transfer',
    adjustment: 'adjustment',
    opening: 'opening',
    writeOff: 'writeOff',
};
const METHOD_ORDER: ReportPaymentMethod[] = ['cash', 'baridi', 'usdt', 'eur', 'other'];

/**
 * opening − purchases + payments + other lines = closing, exactly, in cents. A purchase paid on the
 * spot counts in purchases and in payments (it never touched the balance); a history-only row of
 * any other kind is left out.
 */
export function balanceCalculation(entries: ReadonlyArray<ReportEntry>, period: Pick<ReportPeriod, 'from' | 'to'>): BalanceCalculation {
    const lines: Record<BalanceLineKey, number> = { purchases: 0, payments: 0, saleToUs: 0, withdrawal: 0, transfer: 0, opening: 0, writeOff: 0, adjustment: 0 };
    const byMethod = new Map<ReportPaymentMethod, number>();
    const addPayment = (method: ReportPaymentMethod, cents: number) => {
        lines.payments += cents;
        byMethod.set(method, (byMethod.get(method) || 0) + cents);
    };
    const openingCents = balanceBefore(entries, period.from);
    let closingCents = openingCents;
    for (const entry of entries) {
        if (!inPeriod(entry, period))
            continue;
        closingCents += entry.balanceCents;
        if (isPurchase(entry)) {
            const cents = purchaseCents(entry);
            lines.purchases += cents;
            if (!entry.affectsBalance && cents)
                addPayment(entry.method || 'other', cents);
            continue;
        }
        if (!entry.affectsBalance)
            continue;
        if (entry.kind === 'payment') {
            addPayment(entry.method || 'other', entry.balanceCents);
            continue;
        }
        const line = OTHER_LINE[entry.kind] || 'adjustment';
        lines[line] += entry.balanceCents;
    }
    return {
        openingCents,
        closingCents,
        lines,
        paymentsByMethod: METHOD_ORDER.filter((method) => byMethod.get(method)).map((method) => ({ method, cents: byMethod.get(method)! })),
    };
}

export const percentChange = (current: number, previous: number): number | null => (previous > 0 && current > 0 ? Math.round(((current - previous) / previous) * 100) : null);

function comparisonPeriods(period: ReportPeriod, now: number): ReportPeriod[] {
    if (period.kind === 'year')
        return Array.from({ length: 12 }, (_, month) => monthPeriod(period.year, month)).filter((month) => month.from <= now);
    const weeks = monthWeeks(period.year, period.month).filter((week) => week.from <= now);
    return period.kind === 'week' ? weeks.filter((week) => week.week <= period.week) : weeks;
}

/** Average price of each of the last three periods with DZD purchases of the currency (ج). */
function priceTrend(entries: ReadonlyArray<ReportEntry>, period: ReportPeriod, currency: ReportCurrency): PriceTrendPoint[] {
    const periods: ReportPeriod[] = [period];
    let previous = comparisonPeriod(period);
    while (previous && periods.length < 3) {
        periods.unshift(previous);
        previous = comparisonPeriod(previous);
    }
    const points = periods
        .map((item) => {
            const summary = periodTotals(entries, item).currencies[currency];
            return summary.dzdQuantity > 0 ? { period: item, averagePrice: averagePrice(summary.dzdCents, summary.dzdQuantity) } : null;
        })
        .filter((point): point is PriceTrendPoint => point !== null);
    // The current period must be one of them: the trend ends on this report's price.
    return points.length >= 2 && points[points.length - 1].period.key === period.key ? points : [];
}

function reportReference(period: ReportPeriod, clientId: string): string {
    const code = clientId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase() || '0000';
    const stamp = period.kind === 'year'
        ? `${period.year}`
        : period.kind === 'month'
            ? `${period.year}${pad2(period.month + 1)}`
            : `${period.year}${pad2(period.month + 1)}-S${period.week}`;
    return `R-${stamp}-${code}`;
}

export type BuildClientActivityReportInput = {
    clientId: string;
    /** Every ledger row of the client (any other client's rows are ignored) */
    clientRows: ReadonlyArray<ClientTransactionDzd>;
    transactions: ReadonlyArray<Tx>;
    period: ReportPeriod;
    now: number;
};

export function buildClientActivityReport(input: BuildClientActivityReportInput): ClientActivityReport {
    const { period, now } = input;
    const entries = buildReportEntries(input.clientRows.filter((row) => row.clientId === input.clientId), input.transactions);
    const totals = periodTotals(entries, period);
    const isLive = period.to >= now;
    const currencyCards: ReportCurrencyCard[] = (['USDT', 'EUR'] as ReportCurrency[])
        .filter((currency) => totals.currencies[currency].purchases > 0)
        .map((currency) => ({ ...totals.currencies[currency], trend: priceTrend(entries, period, currency) }));

    const previous = period.kind === 'year' || isLive ? null : comparisonPeriod(period);
    const comparedWith = previous ? { period: previous, spentCents: periodTotals(entries, previous).spentCents } : null;

    const comparison = comparisonPeriods(period, now).map((item): ComparisonRow => ({
        period: item,
        totals: periodTotals(entries, item),
        changePct: null,
        isCurrent: period.kind === 'week' && item.key === period.key,
        isLive: item.to >= now,
    }));
    comparison.forEach((row, index) => {
        if (index > 0 && !row.isLive)
            row.changePct = percentChange(row.totals.spentCents, comparison[index - 1].totals.spentCents);
    });
    const bestMonth = period.kind === 'year'
        ? comparison.reduce<{ period: ReportPeriod; spentCents: number } | null>((best, row) => (row.totals.spentCents > (best?.spentCents ?? 0) ? { period: row.period, spentCents: row.totals.spentCents } : best), null)
        : null;

    let sinceJanuary: ClientActivityReport['sinceJanuary'] = null;
    let biggestPurchase: ReportEntry | null = null;
    if (period.kind === 'month') {
        const yearToDate = periodTotals(entries, { from: yearPeriod(period.year).from, to: period.to });
        sinceJanuary = {
            quantities: { USDT: yearToDate.currencies.USDT.quantity, EUR: yearToDate.currencies.EUR.quantity },
            spentCents: yearToDate.spentCents,
        };
        for (const entry of entries) {
            if (entry.kind !== 'buy' || !inPeriod(entry, period) || !entry.quantity || entry.dzdCents === null)
                continue;
            if (!biggestPurchase || purchaseCents(entry) > purchaseCents(biggestPurchase))
                biggestPurchase = entry;
        }
    }

    const balance = balanceCalculation(entries, period);
    let operations: OperationRow[] | null = null;
    if (period.kind !== 'year') {
        let running = balance.openingCents;
        operations = entries.filter((entry) => inPeriod(entry, period)).map((entry) => {
            running += entry.balanceCents;
            return { entry, balanceAfterCents: running };
        });
    }
    const centsSeen = [
        balance.openingCents, balance.closingCents, ...Object.values(balance.lines),
        ...(operations || []).flatMap((row) => [row.entry.dzdCents ?? 0, row.balanceAfterCents]),
        ...currencyCards.map((card) => card.dzdCents),
    ];
    return {
        kind: period.kind,
        period,
        isLive,
        shownTo: Math.min(period.to, now),
        issuedAt: now,
        reference: reportReference(period, input.clientId),
        totals,
        currencyCards,
        comparedWith,
        bestMonth,
        balance,
        sinceJanuary,
        biggestPurchase,
        comparison,
        showUsdtColumn: comparison.some((row) => row.totals.currencies.USDT.quantity > 0),
        showEurColumn: comparison.some((row) => row.totals.currencies.EUR.quantity > 0),
        operations,
        showCents: centsSeen.some((cents) => cents % 100 !== 0),
    };
}
