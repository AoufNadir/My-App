import { useMemo, useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { TreasuryTx } from '../../../types';
import { buildExpensesReport, expensesReportFileName, type ExpensesPeriodKey } from '../../../utils/expensesReport';
import { buildMonthlyReport, monthlyReportFileName, type MonthlyReportInput } from '../../../utils/monthlyReport';
import { buildTreasuryReport, treasuryReportFileName, type TreasuryMovementInput } from '../../../utils/treasuryReport';
import { EXPENSES_REPORT_WORDS, MONTHLY_REPORT_WORDS, TREASURY_REPORT_WORDS, monthNames } from '../documentWords';
import { ReportDocumentDialog } from '../ReportDocumentDialog';
import { ExpensesReportSheet, expensesPeriodLabel } from './ExpensesReportSheet';
import { MonthlyReportSheet } from './MonthlyReportSheet';
import { TreasuryReportSheet } from './TreasuryReportSheet';

// The windows of the monthly, personal-expenses and treasury reports (V3-6). Each computes the
// report once when it opens (« now » stays the same while it is open, so the preview and the PDF
// agree) and hands its sheet to the shared report window.

export function MonthlyReportDialog({ onClose, input, now: fixedNow }: { onClose: () => void; input: MonthlyReportInput; now?: number }) {
    const { t } = useLanguage();
    const [now] = useState(() => fixedNow ?? Date.now());
    const report = useMemo(() => buildMonthlyReport(input), [input]);
    const appMonths = t('common.months') as string[];
    return (<ReportDocumentDialog onClose={onClose} title={t('reports.monthlyReport') as string} subtitle={`${appMonths[report.month]} ${report.year}`} languageKey="monthly_report_lang" fileName={monthlyReportFileName(report.month, report.year)} pdfTitle={(lang) => `${MONTHLY_REPORT_WORDS[lang].title} · ${monthNames(lang)[report.month]} ${report.year}`} issuedAt={now} reference={report.reference} renderSheet={(lang, variant) => <MonthlyReportSheet report={report} lang={lang} issuedAt={now} variant={variant}/>}/>);
}

export function ExpensesReportDialog({ onClose, periodKey, expenses, managerProfitAvailable, now: fixedNow }: { onClose: () => void; periodKey: ExpensesPeriodKey; expenses: ReadonlyArray<TreasuryTx>; managerProfitAvailable: number; now?: number }) {
    const { t, lang: appLang } = useLanguage();
    const [now] = useState(() => fixedNow ?? Date.now());
    const report = useMemo(() => buildExpensesReport({ expenses, periodKey, now, managerProfitAvailable }), [expenses, periodKey, now, managerProfitAvailable]);
    return (<ReportDocumentDialog onClose={onClose} title={t('reports.expensesReport') as string} subtitle={expensesPeriodLabel(periodKey, report.periodStart, appLang === 'ar' ? 'ar' : 'fr')} languageKey="expenses_report_lang" fileName={expensesReportFileName(report.periodStart, report.periodEnd)} pdfTitle={(lang) => `${EXPENSES_REPORT_WORDS[lang].title} · ${expensesPeriodLabel(periodKey, report.periodStart, lang)}`} issuedAt={now} reference={report.reference} renderSheet={(lang, variant) => <ExpensesReportSheet report={report} lang={lang} issuedAt={now} variant={variant}/>}/>);
}

export function TreasuryReportDialog({ onClose, rows, balances, now: fixedNow }: { onClose: () => void; rows: ReadonlyArray<TreasuryMovementInput>; balances: { caisse: number; baridi: number }; now?: number }) {
    const { t } = useLanguage();
    const [now] = useState(() => fixedNow ?? Date.now());
    const report = useMemo(() => buildTreasuryReport({ rows, balances, issuedAt: now }), [rows, balances, now]);
    return (<ReportDocumentDialog onClose={onClose} title={t('reports.treasuryReport') as string} languageKey="treasury_report_lang" fileName={treasuryReportFileName(now)} pdfTitle={(lang) => TREASURY_REPORT_WORDS[lang].title} issuedAt={now} reference={report.reference} renderSheet={(lang, variant) => <TreasuryReportSheet report={report} lang={lang} variant={variant}/>}/>);
}
