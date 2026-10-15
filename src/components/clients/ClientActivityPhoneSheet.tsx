import { Fragment, type ReactNode } from 'react';
import type { BalanceLineKey, ClientActivityReport, ComparisonRow, OperationRow, ReportCurrency, ReportCurrencyCard, ReportEntry, ReportLang, ReportPeriod } from '../../utils/clientActivityReport';
import { averagePrice, isSmallAmount } from '../../utils/clientActivityReport';
import { DOT, ReportSheet, isolate, num } from '../reports/ReportSheet';
import { PHONE_WORDS, type AccountState } from './clientActivityPhoneText';
import { REPORT_WORDS, currencyUnit, formatDate, formatDayMonth, formatDzdCents, formatEur, formatEurPrice, formatPrice, formatQuantity } from './clientActivityReportText';

export type ClientActivityPhoneSheetProps = {
    report: ClientActivityReport;
    lang: ReportLang;
    clientName: string;
    /** Off: no balance, no debt, no account status, no balance after each operation (payments stay) */
    showBalance: boolean;
    /** « phone »: the 420px sheet the PDF pages are cut from; « screen »: the preview in the window */
    variant: 'screen' | 'phone';
};

// Lines after purchases and payments, in this order; the opening balance entered during the period comes first.
const OTHER_BALANCE_LINES: BalanceLineKey[] = ['saleToUs', 'withdrawal', 'transfer', 'writeOff', 'adjustment'];
const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The client report written for a phone (V8-2): a sheet 420px wide whose smallest text is 12.5px,
 * cut into 420x960 PDF pages. Page 1 is the summary (what was bought and at what price, the state
 * of the account, how it adds up); the details start page 2 (week by week, every operation). The
 * numbers are the A4 report's, from the same model; only their place and weight change. V8-3: the
 * price is the period's own (nothing is compared with another month), and every operation is a
 * sentence from the client's side, without + or − signs, with the account's state after it.
 */
export function ClientActivityPhoneSheet({ report, lang, clientName, showBalance, variant }: ClientActivityPhoneSheetProps) {
    const w = REPORT_WORDS[lang];
    const p = PHONE_WORDS[lang];
    const { period, totals, balance, showCents } = report;
    const dzd = (cents: number) => `${formatDzdCents(cents, showCents)} DZD`;
    const dzdShort = (cents: number) => formatDzdCents(cents, showCents);
    const small = (cents: number) => isSmallAmount(cents, totals.spentCents);

    // ---- page 1: the header and who it is for
    const periodValue: ReactNode = report.kind === 'range'
        ? <>{w.from} {num(formatDate(period.from))} {w.to} {num(formatDate(report.shownTo))}{report.isLive ? ` · ${w.soFar}` : ''}</>
        : <>{w.periodName(period)}{report.isLive ? ` · ${w.soFar}` : ''}</>;

    // ---- the big block: what was bought
    const quantityCards = report.currencyCards.filter((card) => card.quantity > 0);
    const hasSpent = totals.spentCents > 0;
    const bigLines = quantityCards.length > 0
        ? quantityCards.map((card) => ({ key: card.currency, value: formatQuantity(card.quantity), unit: currencyUnit(card.currency) }))
        : hasSpent ? [{ key: 'dzd', value: dzdShort(totals.spentCents), unit: 'DZD' }] : [];
    const hero = bigLines.length === 0
        ? (<div data-pdf-break="" className="rounded-2xl bg-surface-muted px-4 py-4 text-[15px] font-semibold text-neutral-700">{w.leadNone}</div>)
        : (<div data-pdf-break="" className="rounded-[18px] bg-primary px-4 pb-3.5 pt-4 text-white">
          <p className="text-[14px] leading-snug opacity-90">{p.heroLabel(report.kind, period, report.isLive)}</p>
          {bigLines.map((line) => (<p key={line.key} className="mt-0.5 flex items-baseline gap-2 font-latin leading-tight">
              <span className="text-[38px] font-extrabold tracking-tight">{num(line.value)}</span>
              <small className="text-[20px] font-semibold opacity-90">{line.unit}</small>
            </p>))}
          <p className="mt-2 flex flex-wrap gap-x-3.5 text-[15px] font-semibold leading-snug">
            {quantityCards.length > 0 && hasSpent && <span>{p.heroAmount(isolate(dzd(totals.spentCents)))}</span>}
            <span>{p.purchaseCount(totals.purchaseCount)}</span>
          </p>
        </div>);

    // ---- the price of each currency
    const statRow = (label: string, value: string) => (<div key={label} className="flex items-baseline justify-between gap-3 text-[13.5px] leading-snug text-neutral-600"><span>{label}</span>{num(value)}</div>);
    const methods = balance.paymentsByMethod;
    const methodsText: ReactNode = methods.length === 1
        ? w.allPaidBy[methods[0].method]
        : methods.map((item, index) => (<Fragment key={item.method}>{index > 0 && DOT}{w.method[item.method]} {num(dzdShort(item.cents))}</Fragment>));
    const multipleKinds = report.currencyCards.length > 1 || totals.serviceCount > 0;
    const priceBox = (card: ReportCurrencyCard) => {
        const paidInDzd = card.dzdQuantity > 0;
        const average = paidInDzd ? averagePrice(card.dzdCents, card.dzdQuantity) : 0;
        const stats: ReactNode[] = [];
        if (paidInDzd && (multipleKinds || card.dzdCents !== totals.spentCents))
            stats.push(statRow(w.amount, dzd(card.dzdCents)));
        if (card.eurQuantity > 0 && paidInDzd)
            stats.push(statRow(w.ofWhichPaidInEur, `${formatQuantity(card.eurQuantity)} ${currencyUnit(card.currency)} · ${formatEur(card.eurAmount)} €`));
        if (card.eurQuantity > 0 && !paidInDzd)
            stats.push(statRow(w.paidInEur, `${formatEur(card.eurAmount)} €`));
        if (multipleKinds || card.purchases !== totals.purchaseCount)
            stats.push(statRow(w.purchases, String(card.purchases)));
        return (<div key={card.currency} data-pdf-break="" className="rounded-[14px] border border-border px-3.5 py-3">
          <p className="text-[13px] font-bold leading-snug text-neutral-500">{w.yourAveragePrice} · {p.currencyName[card.currency]}</p>
          {paidInDzd && (<p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 font-latin">
              <span className="text-[27px] font-extrabold leading-tight">{num(formatPrice(average))}</span>
              <small className="text-[13px] font-medium text-neutral-500">{p.perUnit[card.currency]}</small>
            </p>)}
          {!paidInDzd && card.eurQuantity > 0 && (<p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 font-latin">
              <span className="text-[27px] font-extrabold leading-tight">{num(`${formatEurPrice(card.eurAmount / card.eurQuantity)} €`)}</span>
              <small className="text-[13px] font-medium text-neutral-500">{lang === 'ar' ? 'لكل USDT' : 'par USDT'}</small>
            </p>)}
          {card.priceRange && (<div className="mt-2 flex gap-2">
              {([['lowestPrice', card.priceRange.min], ['highestPrice', card.priceRange.max]] as const).map(([key, value]) => (<div key={key} className="min-w-0 flex-1 rounded-[10px] bg-surface-muted px-2.5 py-1.5 text-[13px] leading-snug text-neutral-600">
                  {p[key]}<b className="block font-latin text-[15px] text-neutral-900">{num(formatPrice(value))}</b>
                </div>))}
            </div>)}
          {stats.length > 0 && <div className="mt-2 flex flex-col gap-0.5">{stats}</div>}
        </div>);
    };
    const servicesBox = totals.serviceCount > 0
        ? (<div key="services" data-pdf-break="" className="rounded-[14px] border border-border px-3.5 py-3">
          <p className="text-[13px] font-bold leading-snug text-neutral-500">{w.services}</p>
          {totals.serviceCents > 0 && <p className="mt-0.5 font-latin text-[20px] font-extrabold leading-tight">{num(dzd(totals.serviceCents))}</p>}
          <div className="mt-1.5 flex flex-col gap-0.5">{statRow(w.servicesCount, String(totals.serviceCount))}</div>
        </div>)
        : null;
    // Without the balance, what the client paid is all that is said about the account.
    const paidBox = !showBalance && balance.lines.payments > 0
        ? (<div key="paid" data-pdf-break="" className="rounded-[14px] border border-border px-3.5 py-3">
          <p className="text-[13px] font-bold leading-snug text-neutral-500">{w.paid}</p>
          <p className="mt-0.5 font-latin text-[20px] font-extrabold leading-tight">{num(dzd(balance.lines.payments))}</p>
          <p className="mt-1 text-[13.5px] leading-snug text-neutral-600">{methodsText}</p>
        </div>)
        : null;

    // ---- the state of the account, said before the calculation
    const closingCents = balance.closingCents;
    const status = (() => {
        if (!showBalance)
            return null;
        const kind = closingCents === 0 ? 'ok' : closingCents < 0 ? 'owes' : 'credit';
        const look = {
            ok: { box: 'border-green-200 bg-green-50 text-green-700', icon: 'bg-green-700', glyph: '✓', title: p.statusSettled, sub: p.statusSettledSub },
            owes: { box: 'border-amber-200 bg-amber-50 text-amber-700', icon: 'bg-amber-700', glyph: '!', title: w.remainingOwed, sub: p.statusOwesSub },
            credit: { box: 'border-blue-200 bg-blue-50 text-primary', icon: 'bg-primary', glyph: '+', title: w.remainingCredit, sub: p.statusCreditSub },
        }[kind];
        return (<div data-pdf-break="" className={`flex items-center gap-3 rounded-[14px] border px-3.5 py-3 ${look.box}`}>
          <span aria-hidden="true" className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full font-latin text-[16px] font-extrabold text-white ${look.icon}`}>{look.glyph}</span>
          <div className="min-w-0">
            <b className="block text-[16px] leading-snug">{look.title}</b>
            {kind !== 'ok' && <b className="block font-latin text-[22px] font-extrabold leading-tight">{num(dzd(closingCents))}</b>}
            <span className="block text-[13.5px] leading-snug">{look.sub}</span>
          </div>
        </div>);
    })();

    // ---- the calculation: at most five lines in the usual case
    const calculation = (() => {
        if (!showBalance)
            return null;
        const { openingCents, lines } = balance;
        const otherLines = OTHER_BALANCE_LINES.filter((key) => lines[key] !== 0);
        if (openingCents === 0 && closingCents === 0 && lines.opening === 0 && otherLines.length === 0) {
            return (<div data-pdf-break="" className="rounded-[14px] bg-surface-muted px-3.5 py-3 text-[14px] font-semibold leading-snug text-neutral-700">
              <p>{lines.purchases > 0 ? w.allPaid(isolate(dzd(lines.purchases))) : w.balanceZero}</p>
              {lines.payments > 0 && <p className="mt-0.5 text-[13.5px] font-normal text-neutral-600">{methodsText}</p>}
            </div>);
        }
        // Written from the side the client ends on (owing, or in credit).
        const owingSide = closingCents < 0 || (closingCents === 0 && openingCents <= 0);
        const side = owingSide ? -1 : 1;
        const signed = (cents: number) => `${cents > 0 ? '+' : cents < 0 ? '−' : ''} ${dzdShort(cents)}`.trim();
        const line = (key: string, label: ReactNode, value: string, options: { sub?: ReactNode; dim?: boolean } = {}) => (<div key={key} className={`flex items-baseline justify-between gap-3 border-b border-dashed border-border py-1.5 ${options.dim ? 'text-neutral-500' : ''}`}>
          <span className={`min-w-0 leading-snug ${options.dim ? 'text-[13.5px]' : 'text-[14.5px]'}`}>{label}{options.sub && <span className="block text-[12.5px] text-neutral-500">{options.sub}</span>}</span>
          <span className={`shrink-0 font-latin ${options.dim ? 'text-[13.5px] font-medium' : 'text-[15px] font-semibold text-neutral-900'}`}>{num(value)}</span>
        </div>);
        // A small debt from before the period that a write-off cancels is one quiet line (a balance of 0 and why), not two.
        const remitted = openingCents < 0 && lines.writeOff === -openingCents && small(openingCents);
        const sideWord = (cents: number) => (cents === 0 ? '' : cents < 0 ? ` (${w.owes})` : ` (${w.credit})`);
        const note = (key: BalanceLineKey) => (key === 'writeOff' ? p.smallNote.writeOff : key === 'adjustment' ? p.smallNote.adjustment : undefined);
        const rows: ReactNode[] = [];
        if (remitted)
            rows.push(line('remitted', w.balanceStart[report.kind], '0', { dim: true, sub: p.remittedNote(isolate(`${dzdShort(openingCents)} DZD`), report.kind) }));
        else if (openingCents !== 0)
            rows.push(line('start', <>{w.balanceStart[report.kind]}{sideWord(openingCents)}</>, `${openingCents * side < 0 ? '−' : ''}${dzdShort(openingCents)}`, { dim: small(openingCents) }));
        if (lines.opening !== 0)
            rows.push(line('opening', w.balanceLine.opening, signed(lines.opening * side), { dim: small(lines.opening) }));
        if (lines.purchases !== 0)
            rows.push(line('purchases', w.balanceLine.purchases, signed(-lines.purchases * side)));
        if (lines.payments !== 0)
            rows.push(line('payments', w.balanceLine.payments, signed(lines.payments * side), { sub: methods.length > 0 ? methodsText : undefined }));
        for (const key of otherLines) {
            if (remitted && key === 'writeOff')
                continue;
            const isSmall = small(lines[key]);
            rows.push(line(key, w.balanceLine[key], signed(lines[key] * side), { dim: isSmall, sub: isSmall ? note(key) : undefined }));
        }
        const closing = closingCents * side;
        return (<section data-pdf-break="" className="rounded-[14px] border border-border px-3.5 py-3">
          <p className="pb-0.5 text-[13px] font-bold leading-snug text-neutral-500">{p.calcTitle}</p>
          {rows}
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-neutral-900 pt-2 font-extrabold">
            <span className="text-[16px] leading-snug">{closing === 0 ? w.balanceNow : owingSide ? w.remainingOwed : w.remainingCredit}</span>
            <span className={`font-latin text-[18px] ${closing === 0 ? 'text-neutral-700' : owingSide ? 'text-amber-700' : 'text-primary'}`}>{num(dzd(closingCents))}</span>
          </div>
        </section>);
    })();

    // ---- page 2: week by week (or month by month, year by year)
    const unit = report.breakdownUnit;
    const parts = report.comparison;
    const showParts = parts.length > (report.kind === 'range' ? 1 : 0);
    const maxSpent = Math.max(1, ...parts.map((row) => row.totals.spentCents));
    const spansYears = new Date(period.from).getFullYear() !== new Date(period.to).getFullYear();
    const partDays = (part: ReportPeriod) => {
        const start = new Date(part.from);
        const end = new Date(part.to);
        return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
            ? `${pad(start.getDate())}–${pad(end.getDate())}/${pad(start.getMonth() + 1)}`
            : `${formatDayMonth(part.from)}–${formatDayMonth(part.to)}`;
    };
    const partLabel = (part: ReportPeriod) => (unit === 'week' ? w.weekLabel(part.week) : unit === 'month' ? `${w.monthName(part.month)}${spansYears ? ` ${part.year}` : ''}` : String(part.year));
    // Under the name: the days of a week, or of a month or a year cut by the report's first or last day.
    const partSub = (part: ReportPeriod) => (unit === 'week' || part.cut ? partDays(part) : null);
    const partQuantities = (row: ComparisonRow) => (['USDT', 'EUR'] as ReportCurrency[])
        .filter((currency) => row.totals.currencies[currency].quantity > 0)
        .map((currency) => `${formatQuantity(row.totals.currencies[currency].quantity)} ${currencyUnit(currency)}`)
        .join(DOT);
    const partRow = (row: ComparisonRow) => {
        const spent = row.totals.spentCents;
        const sub = partSub(row.period);
        const quantities = partQuantities(row);
        return (<div key={row.period.key} data-pdf-break="" className={`grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-x-2.5 py-1.5 ${spent > 0 ? '' : 'text-neutral-500'}`}>
          <span className="text-[13.5px] leading-snug">{partLabel(row.period)}{sub && <small className="block font-latin text-[12.5px] text-neutral-500" dir="ltr">{sub}</small>}</span>
          {/* Technical exception: the bar's length is data. */}
          <span className={`h-3.5 rounded-full ${spent > 0 ? (spent === maxSpent ? 'bg-primary' : 'bg-primary/40') : 'bg-surface-muted'}`} style={{ width: `${spent > 0 ? Math.max(3, (spent / maxSpent) * 100).toFixed(1) : '1'}%`, minWidth: 4 }}/>
          {spent > 0
            ? (<span className="text-end font-latin text-[14px] font-bold leading-snug">{num(dzdShort(spent))}{quantities && <small className="block text-[12.5px] font-medium text-neutral-500">{num(quantities)}</small>}</span>)
            : (<span className="text-end text-[13px] leading-snug">{p.noPurchase}</span>)}
        </div>);
    };

    // ---- page 2: every operation, as a card: what happened (a sentence), how it was paid, where the account stands after it
    const o = p.operation;
    const operationAmount = (entry: ReportEntry): { value: string; unit: string } | null => {
        if (entry.dzdCents !== null)
            return { value: dzdShort(entry.dzdCents), unit: 'DZD' };
        return entry.eurAmount ? { value: formatEur(entry.eurAmount), unit: '€' } : null;
    };
    const operationPrice = (entry: ReportEntry): string | null => {
        if ((entry.kind !== 'buy' && entry.kind !== 'saleToUs') || !entry.quantity || !entry.currency)
            return null;
        if (entry.dzdCents !== null && !(entry.eurAmount && !entry.affectsBalance))
            return o.unitPrice(isolate(`${formatPrice(entry.dzdCents / 100 / entry.quantity)} DZD`));
        return entry.eurAmount ? o.unitPrice(isolate(`${formatEurPrice(entry.eurAmount / entry.quantity)} €`)) : null;
    };
    const accountState = (cents: number): AccountState => (Math.abs(cents) < 1 ? 'settled' : cents < 0 ? 'owes' : 'credit');
    const AFTER_LOOK: Record<AccountState, string> = { owes: 'bg-amber-50 text-amber-700', credit: 'bg-blue-50 text-primary', settled: 'bg-green-50 text-green-700' };
    // A client who always pays on the spot has a balance of 0 on every row: nothing to say after each one.
    const showBalanceAfter = showBalance && report.operations.some((row) => Math.abs(row.balanceAfterCents) >= 1);
    const dateColumn = spansYears ? 'grid-cols-[96px_minmax(0,1fr)_auto]' : 'grid-cols-[58px_minmax(0,1fr)_auto]';
    const operationCard = (row: OperationRow, index: number) => {
        const { entry } = row;
        const quiet = entry.dzdCents !== null && small(entry.dzdCents);
        const amount = operationAmount(entry);
        const title = o.title(entry, entry.quantity && entry.currency ? o.quantity(entry.currency, formatQuantity(entry.quantity)) : null, quiet);
        const detail = [operationPrice(entry), o.how(entry, showBalance)].filter((line): line is string => Boolean(line));
        if (quiet && entry.kind === 'adjustment')
            detail.push(p.smallNote.adjustment);
        // A purchase paid on the spot never touched the account: nothing to say about it after.
        const after = showBalanceAfter && entry.affectsBalance ? accountState(row.balanceAfterCents) : null;
        return (<div key={entry.id} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined} className={`grid ${dateColumn} items-start gap-x-2.5 border-b border-border py-2.5 ${quiet ? 'text-neutral-500' : ''}`}>
          <span className="mt-0.5 justify-self-start rounded-lg bg-surface-muted px-2 py-0.5 font-latin text-[13px] font-semibold leading-snug text-neutral-900">{num(spansYears ? formatDate(entry.timestamp) : formatDayMonth(entry.timestamp))}</span>
          <div className="min-w-0">
            <b className={`block leading-snug ${quiet ? 'text-[14px] font-semibold' : 'text-[15px] text-neutral-900'}`}>{title}</b>
            {detail.map((line) => (<small key={line} className="block text-[13px] leading-snug text-neutral-500">{line}</small>))}
            {after && <b className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-[13px] font-semibold leading-snug ${AFTER_LOOK[after]}`}>{o.after(after, isolate(`${dzdShort(row.balanceAfterCents)} DZD`))}</b>}
          </div>
          <span className="text-end font-latin leading-snug">
            {amount && (<>
                <b className={quiet ? 'text-[14px] font-medium' : 'text-[15px] font-bold'}>{num(amount.value)}</b>
                <small className="block text-[12.5px] font-medium text-neutral-500">{amount.unit}</small>
              </>)}
          </span>
        </div>);
    };

    // ---- page 2: two facts, and the note
    const facts: ReactNode[] = [];
    if (report.kind === 'month') {
        const since = report.sinceJanuary;
        if (since && (since.quantities.USDT > 0 || since.quantities.EUR > 0)) {
            const quantities = (['USDT', 'EUR'] as const).filter((currency) => since.quantities[currency] > 0).map((currency) => `${formatQuantity(since.quantities[currency])} ${currencyUnit(currency)}`).join(DOT);
            facts.push(<div key="since" data-pdf-break="" className="rounded-xl bg-surface-muted px-3 py-2.5">
              <small className="block text-[12.5px] leading-snug text-neutral-500">{w.sinceJanuary(period.year)}</small>
              <b className="text-[14.5px] leading-snug">{num(quantities)}{since.spentCents > 0 && <>{DOT}{num(dzd(since.spentCents))}</>}</b>
            </div>);
        }
        const biggest = report.biggestPurchase;
        if (biggest && biggest.quantity && biggest.currency) {
            facts.push(<div key="biggest" data-pdf-break="" className="rounded-xl bg-surface-muted px-3 py-2.5">
              <small className="block text-[12.5px] leading-snug text-neutral-500">{w.biggest(period.month)}</small>
              <b className="text-[14.5px] leading-snug">{num(`${formatQuantity(biggest.quantity)} ${currencyUnit(biggest.currency)}`)}{DOT}{w.onDay} {num(formatDayMonth(biggest.timestamp))}{DOT}{num(dzd(biggest.dzdCents ?? 0))}</b>
            </div>);
        }
    }

    const screen = variant === 'screen';
    return (<ReportSheet lang={lang} variant={screen ? 'screen' : 'image'}>
      <div className="flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3 border-b-2 border-primary pb-2.5">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-md border border-border object-cover"/>
            <b className="font-latin text-[18px] tracking-wide text-primary">ProDigital</b>
          </div>
          <strong className="min-w-0 text-end text-[14px] leading-snug text-neutral-900">{w.title[report.kind]}</strong>
        </header>

        <div data-pdf-break="" className="flex justify-between gap-x-3 rounded-xl bg-surface-muted px-3 py-2">
          <div className="flex min-w-0 flex-col">
            <small className="text-[12.5px] leading-snug text-neutral-500">{w.client}</small>
            <b className="text-[15px] leading-snug"><bdi>{clientName}</bdi></b>
          </div>
          <div className="flex min-w-0 flex-col">
            <small className="text-[12.5px] leading-snug text-neutral-500">{w.period}</small>
            <b className="text-[15px] leading-snug">{periodValue}</b>
          </div>
        </div>

        {hero}
        {report.currencyCards.map(priceBox)}
        {servicesBox}
        {paidBox}
        {status}
        {calculation}

        {/* Page 2 starts here: the PDF cuts the pages at this line, whatever is left of page 1. */}
        <div data-pdf-break="" data-pdf-newpage="" className={`flex items-baseline justify-between gap-3 border-b border-border pb-2 text-[13px] leading-snug text-neutral-500 ${screen ? 'mt-3 border-t border-dashed pt-4' : ''}`}>
          <b className="min-w-0 text-neutral-900"><bdi>{clientName}</bdi></b>
          <span>{report.kind === 'range' ? <>{num(formatDate(period.from))} – {num(formatDate(report.shownTo))}</> : w.periodName(period)}</span>
        </div>

        {showParts && (<section className="flex flex-col">
            <p data-pdf-break="" className="pb-1 text-[15.5px] font-extrabold leading-snug">{p.partsTitle(unit)}</p>
            <div>{parts.map(partRow)}</div>
          </section>)}

        <section className="flex flex-col">
          <p data-pdf-break="" className="text-[15.5px] font-extrabold leading-snug">{p.operationsTitle}</p>
          {showBalanceAfter && <p data-pdf-break="" className="pb-1 text-[13px] leading-snug text-neutral-500">{o.hint}</p>}
          {report.operations.length === 0
            ? (<p className="text-[13.5px] text-neutral-500">{w.leadNone}</p>)
            : (<div>{report.operations.map(operationCard)}</div>)}
        </section>

        {facts}

        <footer data-pdf-break="" className="border-t border-border pt-2 text-[12.5px] leading-snug text-neutral-500">
          <p>{w.footer}</p>
          {screen && <p className="mt-1">{p.issuedLine(formatDate(report.issuedAt), report.reference)}</p>}
        </footer>
      </div>
    </ReportSheet>);
}
