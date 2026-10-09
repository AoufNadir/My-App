import { Fragment, type ReactNode } from 'react';
import type { BalanceLineKey, ClientActivityReport, ReportCurrencyCard, ReportEntry, ReportLang, ReportPeriod } from '../../utils/clientActivityReport';
import { averagePrice } from '../../utils/clientActivityReport';
import { DOT, ReportSheetFrame, isolate, num, reportTd, reportTdNum, reportTh } from '../reports/ReportSheet';
import { REPORT_WORDS, currencyUnit, formatCompactDzd, formatDate, formatDayMonth, formatDzdCents, formatEur, formatEurPrice, formatPercent, formatPrice, formatQuantity } from './clientActivityReportText';

export type ClientActivityReportSheetProps = {
    report: ClientActivityReport;
    lang: ReportLang;
    clientName: string;
    /** Off: no balance, no debt, no balance column (payments stay) */
    showBalance: boolean;
    /** « print »: the A4 sheet captured for the PDF (794px wide); « screen »: the preview in the window */
    variant: 'screen' | 'print';
};

// Lines after purchases and payments, in this order; the opening balance entered during the period comes first.
const OTHER_BALANCE_LINES: BalanceLineKey[] = ['saleToUs', 'withdrawal', 'transfer', 'writeOff', 'adjustment'];

/**
 * The report as the client receives it. Always light, like paper, whatever the app theme
 * (`report-sheet` resets the colour tokens). Elements marked data-pdf-break are where a PDF page
 * may end; rows marked data-pdf-row are left out of the other pages' captures.
 */
export function ClientActivityReportSheet({ report, lang, clientName, showBalance, variant }: ClientActivityReportSheetProps) {
    const w = REPORT_WORDS[lang];
    const { period, totals, balance, showCents } = report;
    const dzd = (cents: number) => `${formatDzdCents(cents, showCents)} DZD`;
    const dzdShort = (cents: number) => formatDzdCents(cents, showCents);

    const lead = (() => {
        if (totals.spentCents <= 0) {
            const quantities = report.currencyCards.filter((card) => card.quantity > 0).map((card) => isolate(`${formatQuantity(card.quantity)} ${currencyUnit(card.currency)}`));
            return quantities.length ? w.leadQuantities(quantities.join(lang === 'ar' ? ' و' : ' et ')) : w.leadNone;
        }
        const spent = isolate(dzd(totals.spentCents));
        const previous = report.comparedWith;
        const change = previous && previous.spentCents > 0
            ? isolate(formatPercent(Math.round(((totals.spentCents - previous.spentCents) / previous.spentCents) * 100)))
            : null;
        if (report.kind === 'range')
            return report.isLive ? w.leadRangeLive(spent) : w.leadRange(spent, change, previous ? previous.period : null);
        if (report.kind === 'month') {
            if (report.isLive)
                return w.leadMonthLive(spent, period.month);
            return w.leadMonth(spent, period.month, change, previous ? previous.period.month : 0);
        }
        const best = report.bestMonth;
        return w.leadYear(spent, period.year, best ? best.period.month : null, best ? isolate(dzd(best.spentCents)) : '', report.isLive);
    })();

    const currencyCard = (card: ReportCurrencyCard) => {
        const paidInDzd = card.dzdQuantity > 0;
        const rows: Array<{ label: string; value: ReactNode }> = [];
        if (paidInDzd && card.trend.length === 0)
            rows.push({ label: w.averagePrice, value: num(`${formatPrice(averagePrice(card.dzdCents, card.dzdQuantity))} DZD`) });
        if (paidInDzd)
            rows.push({ label: w.amount, value: num(dzd(card.dzdCents)) });
        if (card.eurQuantity > 0) {
            if (paidInDzd)
                rows.push({ label: w.ofWhichPaidInEur, value: num(`${formatQuantity(card.eurQuantity)} ${currencyUnit(card.currency)} · ${formatEur(card.eurAmount)} €`) });
            else {
                rows.push({ label: w.averagePrice, value: num(`${formatEurPrice(card.eurAmount / card.eurQuantity)} €`) });
                rows.push({ label: w.paidInEur, value: num(`${formatEur(card.eurAmount)} €`) });
            }
        }
        rows.push({ label: w.purchases, value: num(String(card.purchases)) });
        return (<div key={card.currency} className="flex min-w-0 flex-col gap-1 rounded-lg border border-border px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-500">
          <i aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-sm ${card.currency === 'USDT' ? 'bg-secondary' : 'bg-primary'}`}/>
          {w.currencyTitle[card.currency]}
        </span>
        <span className="self-start text-[19px] font-bold leading-tight text-neutral-900">{num(`${formatQuantity(card.quantity)} ${currencyUnit(card.currency)}`)}</span>
        {card.trend.length > 0 && (<div className="mt-0.5">
            <span className="text-[11.5px] text-neutral-600">{w.yourAveragePrice}</span>
            <div className="mt-1 flex items-stretch gap-1">
              {card.trend.map((point, index) => {
                const isCurrent = index === card.trend.length - 1;
                return (<Fragment key={point.period.key}>
                    {index > 0 && <span aria-hidden="true" className="flex items-center text-xs text-neutral-400">{lang === 'ar' ? '←' : '→'}</span>}
                    <span className={`flex min-w-0 flex-1 flex-col rounded-md px-1.5 py-1 text-center ${isCurrent ? 'bg-primary/10 text-primary' : 'bg-surface-muted text-neutral-700'}`}>
                      <span className="truncate text-[10.5px] font-medium">{w.periodShort(point.period)}</span>
                      <span className={`text-[12.5px] ${isCurrent ? 'font-bold' : 'font-semibold'}`}>{num(formatPrice(point.averagePrice))}</span>
                    </span>
                  </Fragment>);
            })}
            </div>
          </div>)}
        <span className="flex flex-col gap-px text-xs text-neutral-700">
          {rows.map((row) => (<span key={row.label} className="flex justify-between gap-2"><span>{row.label}</span>{row.value}</span>))}
        </span>
      </div>);
    };

    const methods = balance.paymentsByMethod;
    const methodsText: ReactNode = methods.length === 1
        ? w.allPaidBy[methods[0].method]
        : methods.map((item, index) => (<Fragment key={item.method}>{index > 0 && DOT}{w.method[item.method]} {num(dzdShort(item.cents))}</Fragment>));

    const paymentsCard = !showBalance && balance.lines.payments > 0
        ? (<div key="paid" className="flex min-w-0 flex-col gap-1 rounded-lg border border-border px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-500"><i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-sm bg-success"/>{w.paid}</span>
          <span className="self-start text-[19px] font-bold leading-tight text-neutral-900">{num(dzd(balance.lines.payments))}</span>
          <span className="text-xs text-neutral-700">{methodsText}</span>
        </div>)
        : null;
    const servicesCard = totals.serviceCount > 0
        ? (<div key="services" className="flex min-w-0 flex-col gap-1 rounded-lg border border-border px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-500"><i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-sm bg-neutral-500"/>{w.services}</span>
          {totals.serviceCents > 0 && <span className="self-start text-[19px] font-bold leading-tight text-neutral-900">{num(dzd(totals.serviceCents))}</span>}
          <span className="flex justify-between gap-2 text-xs text-neutral-700"><span>{w.servicesCount}</span>{num(String(totals.serviceCount))}</span>
        </div>)
        : null;
    const cards = [...report.currencyCards.map(currencyCard), servicesCard, paymentsCard].filter(Boolean);

    // The balance as a calculation (أ): written from the side the client ends on (owing or in credit).
    const balanceBlock = (() => {
        if (!showBalance)
            return null;
        const { openingCents, closingCents, lines } = balance;
        const otherLines = OTHER_BALANCE_LINES.filter((key) => lines[key] !== 0);
        if (openingCents === 0 && closingCents === 0 && lines.opening === 0 && otherLines.length === 0) {
            const text = lines.purchases > 0 ? w.allPaid(isolate(dzd(lines.purchases))) : w.balanceZero;
            return (<div data-pdf-break="" className="rounded-lg bg-surface-muted px-3 py-2.5 text-[13px] font-semibold text-neutral-700">
            <p>{text}</p>
            {lines.payments > 0 && <p className="mt-0.5 text-xs font-normal text-neutral-600">{methodsText}</p>}
          </div>);
        }
        // Owing side: purchases add, payments take away. Credit side: the reverse.
        const owingSide = closingCents < 0 || (closingCents === 0 && openingCents <= 0);
        const side = owingSide ? -1 : 1;
        const signed = (cents: number) => `${cents > 0 ? '+' : cents < 0 ? '−' : ''} ${dzdShort(cents)}`.trim();
        const opening = openingCents * side;
        const closing = closingCents * side;
        const row = (key: string, label: ReactNode, value: string, sub?: ReactNode) => (<div key={key} className="flex items-baseline justify-between gap-3 py-1">
          <span className="min-w-0">{label}{sub && <span className="block text-[11px] text-neutral-500">{sub}</span>}</span>
          <span className="shrink-0 font-semibold text-neutral-900">{num(value)}</span>
        </div>);
        // The opening balance says which way it goes; on the other side of the calculation it is negative.
        const sideWord = (cents: number) => (cents === 0 ? '' : cents < 0 ? ` (${w.owes})` : ` (${w.credit})`);
        return (<section data-pdf-break="" className={`rounded-lg border px-3 py-2 text-[12.5px] text-neutral-700 ${owingSide && closingCents < 0 ? 'border-financial-debt/40 bg-financial-debt-bg' : 'border-border bg-surface-muted'}`}>
          <p className="pb-1 text-[11.5px] font-semibold text-neutral-500">{w.balanceTitle}</p>
          {row('start', <>{w.balanceStart[report.kind]}{sideWord(openingCents)}</>, opening === 0 ? '0' : `${opening < 0 ? '−' : ''}${dzdShort(opening)}`)}
          {lines.opening !== 0 && row('opening', w.balanceLine.opening, signed(lines.opening * side))}
          {row('purchases', w.balanceLine.purchases, signed(-lines.purchases * side))}
          {row('payments', w.balanceLine.payments, signed(lines.payments * side), methods.length > 0 ? methodsText : undefined)}
          {otherLines.map((key) => row(key, w.balanceLine[key], signed(lines[key] * side)))}
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-neutral-300 pt-1.5 text-[14px] font-bold">
            <span>{closing === 0 ? w.balanceNow : owingSide ? w.remainingOwed : w.remainingCredit}</span>
            <span className={closing === 0 ? 'text-neutral-700' : owingSide ? 'text-financial-debt' : 'text-financial-profit'}>{num(`${dzdShort(closing)} DZD`)}</span>
          </div>
        </section>);
    })();

    const facts = report.kind === 'month'
        ? (() => {
            const items: ReactNode[] = [];
            const since = report.sinceJanuary;
            if (since && (since.quantities.USDT > 0 || since.quantities.EUR > 0)) {
                const quantities = (['USDT', 'EUR'] as const).filter((currency) => since.quantities[currency] > 0).map((currency) => `${formatQuantity(since.quantities[currency])} ${currencyUnit(currency)}`).join(DOT);
                items.push(<div key="since" className="flex min-w-0 flex-col gap-px rounded-lg bg-surface-muted px-3 py-2">
                  <small className="text-[11px] text-neutral-500">{w.sinceJanuary(period.year)}</small>
                  <b className="self-start text-sm text-neutral-900">{num(quantities)}</b>
                  {since.spentCents > 0 && <span className="text-[11.5px] text-neutral-700">{num(dzd(since.spentCents))}</span>}
                </div>);
            }
            const biggest = report.biggestPurchase;
            if (biggest && biggest.quantity && biggest.currency) {
                items.push(<div key="biggest" className="flex min-w-0 flex-col gap-px rounded-lg bg-surface-muted px-3 py-2">
                  <small className="text-[11px] text-neutral-500">{w.biggest(period.month)}</small>
                  <b className="self-start text-sm text-neutral-900">{num(`${formatQuantity(biggest.quantity)} ${currencyUnit(biggest.currency)}`)}</b>
                  <span className="text-[11.5px] text-neutral-700">{w.onDay} {num(formatDayMonth(biggest.timestamp))}{DOT}{num(dzd(biggest.dzdCents ?? 0))}</span>
                </div>);
            }
            return items.length ? <div data-pdf-break="" className={`grid gap-2.5 ${items.length === 2 ? 'grid-cols-1 @lg:grid-cols-2' : 'grid-cols-1'}`}>{items}</div> : null;
        })()
        : null;

    const comparisonRows = report.comparison;
    const unit = report.breakdownUnit;
    // A range with a single part has nothing to compare.
    const showComparison = comparisonRows.length > (report.kind === 'range' ? 1 : 0);
    const maxSpent = Math.max(1, ...comparisonRows.map((row) => row.totals.spentCents));
    // Dark bar: the strongest month of a yearly report, named in its first sentence.
    const isHighlighted = (row: typeof comparisonRows[number]) => report.kind === 'year' && report.bestMonth?.period.key === row.period.key;
    const totalRow = comparisonRows.reduce((sum, row) => ({
        spent: sum.spent + row.totals.spentCents,
        usdt: sum.usdt + row.totals.currencies.USDT.quantity,
        eur: sum.eur + row.totals.currencies.EUR.quantity,
    }), { spent: 0, usdt: 0, eur: 0 });
    // Months of a range over several years carry their year.
    const spansYears = new Date(period.from).getFullYear() !== new Date(period.to).getFullYear();
    const pad = (value: number) => String(value).padStart(2, '0');
    // dd–dd/mm inside one month, dd/mm–dd/mm across two.
    const partDays = (part: ReportPeriod) => {
        const start = new Date(part.from);
        const end = new Date(part.to);
        return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
            ? `${pad(start.getDate())}–${pad(end.getDate())}/${pad(start.getMonth() + 1)}`
            : `${formatDayMonth(part.from)}–${formatDayMonth(part.to)}`;
    };
    const partLabel = (part: ReportPeriod) => (unit === 'week' ? w.weekLabel(part.week) : unit === 'month' ? `${w.monthName(part.month)}${spansYears ? ` ${part.year}` : ''}` : String(part.year));
    // Under the name: the days of a week, or of a month or a year cut by the range's first or last day.
    const partSub = (part: ReportPeriod) => (unit === 'week' || part.cut ? partDays(part) : null);
    const axisLabel = (part: ReportPeriod) => (unit === 'week'
        ? (report.kind === 'month' ? partDays(part).slice(0, 5) : formatDayMonth(part.from))
        : unit === 'month' ? `${pad(part.month + 1)}${spansYears ? `/${String(part.year).slice(2)}` : ''}` : String(part.year));

    const operationAmount = (entry: ReportEntry): { text: string; tone: string } => {
        if (entry.dzdCents === null)
            return { text: entry.eurAmount ? `${formatEur(entry.eurAmount)} €` : '—', tone: '' };
        const amount = dzdShort(entry.dzdCents);
        if (!entry.affectsBalance || entry.kind === 'buy' || entry.kind === 'service')
            return { text: amount, tone: '' };
        return entry.balanceCents >= 0 ? { text: `+${amount}`, tone: 'font-semibold text-financial-profit' } : { text: `−${amount}`, tone: '' };
    };
    const operationDetail = (entry: ReportEntry): string => {
        const parts: string[] = [];
        if ((entry.kind === 'buy' || entry.kind === 'saleToUs') && entry.quantity && entry.currency) {
            const unit = currencyUnit(entry.currency);
            if (entry.dzdCents !== null && !(entry.eurAmount && !entry.affectsBalance))
                parts.push(isolate(`${formatQuantity(entry.quantity)} ${unit} × ${formatPrice(entry.dzdCents / 100 / entry.quantity)}`));
            else if (entry.eurAmount)
                parts.push(isolate(`${formatQuantity(entry.quantity)} ${unit} × ${formatEurPrice(entry.eurAmount / entry.quantity)} €`));
            else
                parts.push(isolate(`${formatQuantity(entry.quantity)} ${unit}`));
        }
        if ((entry.kind === 'buy' || entry.kind === 'service') && entry.affectsBalance) {
            if (showBalance)
                parts.push(w.onAccount);
        }
        else if ((entry.kind === 'buy' || entry.kind === 'service' || entry.kind === 'saleToUs' || entry.kind === 'withdrawal') && entry.method && entry.method !== 'other')
            parts.push(w.method[entry.method]);
        return parts.join(DOT);
    };
    const balanceCell = (cents: number) => (Math.abs(cents) < 1 ? { text: '0', tone: '' } : cents < 0 ? { text: `−${dzdShort(cents)}`, tone: 'text-financial-debt' } : { text: `+${dzdShort(cents)}`, tone: 'text-financial-profit' });

    const th = reportTh;
    const td = reportTd;
    const tdNum = reportTdNum;
    const issued = formatDate(report.issuedAt);
    // A client who always pays on the spot has a balance of 0 on every row: no column for it.
    const showBalanceColumn = showBalance && report.operations.some((row) => Math.abs(row.balanceAfterCents) >= 1);

    return (<ReportSheetFrame lang={lang} variant={variant} brandTagline={w.brandTagline} title={w.title[report.kind]} referenceLabel={w.reference} reference={report.reference} issuedLabel={w.issued} issued={issued}
        partyLabel={w.client} partyName={clientName} periodCaption={<>{w.period} · {w.periodName(period)}</>}
        period={<>{w.from} {num(formatDate(period.from))} {w.to} {num(formatDate(report.shownTo))}{report.isLive ? ` (${w.soFar})` : ''}</>} footer={w.footer}>
      <p data-pdf-break="" className="rounded-lg bg-primary/5 px-3 py-2 text-[13.5px] font-semibold text-neutral-900">{lead}</p>

      {cards.length > 0 && (<div data-pdf-break="" className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2">{cards}</div>)}

      {balanceBlock}

      {facts}

      {showComparison && (<section data-pdf-break="" className="flex flex-col gap-2">
          <p className="text-[13.5px] font-bold">{w.comparisonTitle(period, unit)}</p>
          <div role="img" aria-label={w.comparisonTitle(period, unit)} className="flex h-32 items-end gap-2 border-b border-border pt-4">
            {comparisonRows.map((row) => (<div key={row.period.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <em className="whitespace-nowrap font-latin text-[10.5px] font-semibold not-italic text-neutral-700" dir="ltr">{row.totals.spentCents ? formatCompactDzd(row.totals.spentCents) : '0'}</em>
                {/* Technical exception: bar height is data. */}
                <i className={`block w-full max-w-10 rounded-t ${isHighlighted(row) ? 'bg-primary' : 'bg-primary/40'}`} style={{ height: `${Math.max(1.5, (row.totals.spentCents / maxSpent) * 100).toFixed(1)}%` }}/>
              </div>))}
          </div>
          <div className="-mt-1 flex gap-2 text-center text-[10.5px] text-neutral-500">
            {comparisonRows.map((row) => (<span key={row.period.key} className="min-w-0 flex-1 truncate" dir="ltr">{axisLabel(row.period)}</span>))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[330px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className={th}>{unit === 'week' ? w.colWeek : unit === 'month' ? w.colMonth : w.colYear}</th>
                  <th className={`${th} text-end`}>{w.colSpent}</th>
                  <th className={`${th} text-end`}>{w.colChange}</th>
                  {report.showUsdtColumn && <th className={`${th} text-end`}>USDT</th>}
                  {report.showEurColumn && <th className={`${th} text-end`}>EUR</th>}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => {
                    const sub = partSub(row.period);
                    return (<tr key={row.period.key}>
                    <td className={td}>{partLabel(row.period)}{sub && <small className="block font-latin text-[10.5px] text-neutral-500" dir="ltr">{sub}</small>}</td>
                    <td className={tdNum}>{num(row.totals.spentCents ? dzdShort(row.totals.spentCents) : '—')}</td>
                    <td className={`${tdNum} ${row.changePct === null ? 'text-neutral-400' : ''}`}>{row.isLive && index > 0 ? <span className="text-[10.5px]">{w.running}</span> : num(row.changePct === null ? '—' : formatPercent(row.changePct))}</td>
                    {report.showUsdtColumn && <td className={tdNum}>{num(row.totals.currencies.USDT.quantity ? formatQuantity(row.totals.currencies.USDT.quantity) : '—')}</td>}
                    {report.showEurColumn && <td className={tdNum}>{num(row.totals.currencies.EUR.quantity ? formatQuantity(row.totals.currencies.EUR.quantity) : '—')}</td>}
                  </tr>);
                })}
                <tr className="bg-surface-muted font-bold">
                  <td className={td}>{w.total}</td>
                  <td className={tdNum}>{num(dzdShort(totalRow.spent))}</td>
                  <td className={td}/>
                  {report.showUsdtColumn && <td className={tdNum}>{num(formatQuantity(totalRow.usdt))}</td>}
                  {report.showEurColumn && <td className={tdNum}>{num(formatQuantity(totalRow.eur))}</td>}
                </tr>
              </tbody>
            </table>
          </div>
        </section>)}

      <section data-pdf-break="" className="flex flex-col gap-2">
      <p className="text-[13.5px] font-bold">{w.operationsTitle}</p>
      {report.operations.length === 0 ? (<p className="text-xs text-neutral-500">{w.leadNone}</p>) : (<div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[330px] border-collapse text-xs">
            <thead>
              <tr>
                <th className={th}>{w.colDate}</th>
                <th className={th}>{w.colOperation}</th>
                <th className={`${th} text-end`}>{w.colAmount}</th>
                {showBalanceColumn && <th className={`${th} text-end`}>{w.colBalance}</th>}
              </tr>
            </thead>
            <tbody>
              {report.operations.map((row, index) => {
                const amount = operationAmount(row.entry);
                const detail = operationDetail(row.entry);
                const after = balanceCell(row.balanceAfterCents);
                return (<tr key={row.entry.id} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                    <td className={td}>{num(spansYears ? formatDate(row.entry.timestamp) : formatDayMonth(row.entry.timestamp))}</td>
                    <td className={td}>{w.operation(row.entry)}{detail && <small className="block text-[10.5px] text-neutral-500">{detail}</small>}</td>
                    <td className={`${tdNum} ${amount.tone}`}>{num(amount.text)}</td>
                    {showBalanceColumn && <td className={`${tdNum} ${after.tone}`}>{num(after.text)}</td>}
                  </tr>);
            })}
            </tbody>
          </table>
        </div>)}
      </section>

    </ReportSheetFrame>);
}
