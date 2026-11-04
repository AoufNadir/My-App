import { useMemo, useState, type ReactNode } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { dayKey, parseDayKey } from '../../utils/clientActivityReport';
import { ReportRangePicker } from './ReportDialogParts';

// The dates of a list report: a long list (thousands of operations) makes a heavy PDF, so the window
// opens on this month and the reader widens it. Rows without a date are always kept.

/** More than this many rows makes a slow, large PDF: the window says so. */
export const HEAVY_REPORT_ROWS = 1000;

type Dated = { timestamp?: number };

/** The rows between two days (either may be empty = no limit); null when a date is not a real day. */
export function rowsInPeriod<T extends Dated>(rows: ReadonlyArray<T>, start: string, end: string): T[] | null {
    const from = start ? parseDayKey(start, false) : null;
    const to = end ? parseDayKey(end, true) : null;
    if ((start && from === null) || (end && to === null) || (from !== null && to !== null && from > to))
        return null;
    return rows.filter((row) => row.timestamp === undefined || ((from === null || row.timestamp >= from) && (to === null || row.timestamp <= to)));
}

/**
 * Period state for a list report window: `period.rows` are the rows to report, `period.picker` the
 * choice to show above the language, `period.invalid` true while the dates cannot be used.
 */
export function useReportPeriod<T extends Dated>(rows: ReadonlyArray<T>, now: number, onChange: () => void = () => {}) {
    const { t } = useLanguage();
    const today = dayKey(now);
    const firstOfMonth = dayKey(new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime());
    const [range, setRange] = useState({ start: firstOfMonth, end: today });
    const kept = useMemo(() => rowsInPeriod(rows, range.start, range.end), [rows, range]);
    const choose = (start: string, end: string) => { setRange({ start, end }); onChange(); };
    const error = kept === null ? t('clients.reportStartAfterEnd') as string : null;
    const count = kept?.length ?? 0;
    const picker: ReactNode = (<>
        <ReportRangePicker idPrefix="list-report" now={now} start={range.start} end={range.end} onChange={choose} onThisMonth={() => choose(firstOfMonth, today)} onThisYear={() => choose(`${new Date(now).getFullYear()}-01-01`, today)} onAllHistory={() => choose('', '')} error={error}/>
        {kept && (<p className={`text-[13px] font-semibold leading-snug ${count > HEAVY_REPORT_ROWS ? 'text-financial-debt' : 'text-neutral-600'}`}>
            {(t('reports.periodCount') as string).split('{count}').join(String(count))}
            {count > HEAVY_REPORT_ROWS && <span className="block font-normal">{t('reports.periodHeavy')}</span>}
          </p>)}
      </>);
    return { rows: kept ?? [], invalid: kept === null, picker, range };
}
