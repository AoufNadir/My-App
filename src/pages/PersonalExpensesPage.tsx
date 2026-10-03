import React, { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCard, HeroCard, SectionCard, StatTile, StatTileGrid } from '../components/cards';
import { Button } from '../components/ui/Button';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { IconButton } from '../components/ui/IconButton';
import { EmptyState } from '../components/ui/EmptyState';
import { Tabs, type Tab } from '../components/ui/Tabs';
import { BanknotesIcon } from '../components/icons/BanknotesIcon';
import { FileSpreadsheetIcon } from '../components/icons/FileSpreadsheetIcon';
import { AlertTriangleIcon } from '../components/icons/AlertTriangleIcon';
import { RefreshCwIcon } from '../components/icons/RefreshCwIcon';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { Trash2Icon } from '../components/icons/Trash2Icon';
import { useHeaderActionsSlot } from '../components/main/headerActionsSlot';
import type { TreasuryTx } from '../types';
import { formatNumber } from './shared/pageFormat';
import { useLanguage } from '../contexts/LanguageContext';

type Period = 'day' | 'week' | 'month' | 'year';

type PersonalExpensesPageProps = {
    personalExpenses: TreasuryTx[];
    managerAvailableProfit: number;
    managerExists: boolean;
    onOpenReconcile?: (advanceTx: TreasuryTx) => void;
    onEditExpense?: (tx: TreasuryTx) => void;
    onDeleteExpense?: (tx: TreasuryTx) => void;
    onExportReport?: (period: 'day' | 'week' | 'month' | 'year') => void;
    /** Period shown first; the month unless a test or a link asks for another. */
    initialPeriod?: Period;
};

function startOfDay(ts: number): number {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function startOfWeek(ts: number): number {
    const d = new Date(ts);
    const dayOfWeek = d.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function startOfMonth(ts: number): number {
    const d = new Date(ts);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function startOfYear(ts: number): number {
    const d = new Date(ts);
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function endOfPeriod(period: Period, startTs: number): number {
    const d = new Date(startTs);

    if (period === 'day') {
        d.setHours(23, 59, 59, 999);
        return d.getTime();
    }

    if (period === 'week') {
        d.setDate(d.getDate() + 6);
        d.setHours(23, 59, 59, 999);
        return d.getTime();
    }

    if (period === 'month') {
        return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    }

    return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
}

function startOfPreviousPeriod(period: Period, currentStart: number): number {
    const d = new Date(currentStart);

    if (period === 'day') {
        d.setDate(d.getDate() - 1);
        return startOfDay(d.getTime());
    }

    if (period === 'week') {
        d.setDate(d.getDate() - 7);
        return startOfWeek(d.getTime());
    }

    if (period === 'month') {
        d.setMonth(d.getMonth() - 1);
        return startOfMonth(d.getTime());
    }

    d.setFullYear(d.getFullYear() - 1);
    return startOfYear(d.getTime());
}

function daysInCurrentPeriod(period: Period, startTs: number): number {
    if (period === 'day') {
        return 1;
    }

    if (period === 'week') {
        return 7;
    }

    if (period === 'month') {
        const d = new Date(startTs);
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }

    const y = new Date(startTs).getFullYear();
    return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
}

/** Title of the period list, from the translated month names (digits stay as they were). */
function periodLabel(period: Period, months: string[], weekdays: string[], weekOf: string): string {
    const now = new Date();

    if (period === 'day') {
        return `${weekdays[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    if (period === 'week') {
        const weekStart = new Date(startOfWeek(now.getTime()));
        return weekOf.replace('{date}', `${weekStart.getDate()} ${months[weekStart.getMonth()]}`);
    }

    if (period === 'month') {
        return `${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    return String(now.getFullYear());
}

function netExpenseAmount(tx: TreasuryTx): number {
    if (tx.origin === 'personal_expense_return') {
        return 0;
    }

    if (tx.advanceState === 'settled') {
        return Number(tx.settledAmount || 0);
    }

    return Number(tx.amount || 0);
}

export function PersonalExpensesPage({
    personalExpenses,
    managerAvailableProfit,
    managerExists,
    onOpenReconcile,
    onEditExpense,
    onDeleteExpense,
    onExportReport,
    initialPeriod = 'month',
}: PersonalExpensesPageProps) {
    const { t } = useLanguage();
    const [period, setPeriod] = useState<Period>(initialPeriod);
    const periodTabs: Tab[] = [
        { id: 'day', label: t('personalExpenses.tabDay') as string },
        { id: 'week', label: t('personalExpenses.tabWeek') as string },
        { id: 'month', label: t('portfolio.month') as string },
        { id: 'year', label: t('portfolio.year') as string },
    ];

    const pendingAdvances = useMemo(() => personalExpenses
        .filter((tx) => tx.origin === 'personal_expense' && tx.advanceState === 'pending')
        .sort((a, b) => b.timestamp - a.timestamp), [personalExpenses]);

    const settledExpenses = useMemo(() => personalExpenses
        .filter((tx) => tx.origin === 'personal_expense' && tx.advanceState !== 'pending')
        .sort((a, b) => b.timestamp - a.timestamp), [personalExpenses]);

    const aggregates = useMemo(() => {
        const nowTs = Date.now();
        const dayStart = startOfDay(nowTs);
        const weekStart = startOfWeek(nowTs);
        const monthStart = startOfMonth(nowTs);
        const yearStart = startOfYear(nowTs);
        let today = 0;
        let week = 0;
        let month = 0;
        let year = 0;
        let allTime = 0;

        for (const tx of settledExpenses) {
            const amount = netExpenseAmount(tx);

            if (amount <= 0) {
                continue;
            }

            allTime += amount;

            if (tx.timestamp >= dayStart) {
                today += amount;
            }

            if (tx.timestamp >= weekStart) {
                week += amount;
            }

            if (tx.timestamp >= monthStart) {
                month += amount;
            }

            if (tx.timestamp >= yearStart) {
                year += amount;
            }
        }

        return { today, week, month, year, allTime };
    }, [settledExpenses]);

    const filteredExpenses = useMemo(() => {
        const nowTs = Date.now();
        const threshold = period === 'day'
            ? startOfDay(nowTs)
            : period === 'week'
                ? startOfWeek(nowTs)
                : period === 'month'
                    ? startOfMonth(nowTs)
                    : startOfYear(nowTs);

        return settledExpenses.filter((tx) => tx.timestamp >= threshold);
    }, [settledExpenses, period]);

    const periodTotal = filteredExpenses.reduce((sum, tx) => sum + netExpenseAmount(tx), 0);
    const pendingTotal = pendingAdvances.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const periodStartTs = useMemo(() => {
        const nowTs = Date.now();

        if (period === 'day') {
            return startOfDay(nowTs);
        }

        if (period === 'week') {
            return startOfWeek(nowTs);
        }

        if (period === 'month') {
            return startOfMonth(nowTs);
        }

        return startOfYear(nowTs);
    }, [period]);

    const previousPeriodTotal = useMemo(() => {
        const prevStart = startOfPreviousPeriod(period, periodStartTs);
        const prevEnd = endOfPeriod(period, prevStart);

        return settledExpenses
            .filter((tx) => tx.timestamp >= prevStart && tx.timestamp <= prevEnd)
            .reduce((sum, tx) => sum + netExpenseAmount(tx), 0);
    }, [settledExpenses, period, periodStartTs]);

    const profitConsumedPct = useMemo(() => {
        const denom = managerAvailableProfit + periodTotal;
        return denom > 0 ? (periodTotal / denom) * 100 : 0;
    }, [periodTotal, managerAvailableProfit]);

    const changeVsPrev = useMemo(() => {
        if (previousPeriodTotal <= 0) {
            return null;
        }

        return ((periodTotal - previousPeriodTotal) / previousPeriodTotal) * 100;
    }, [periodTotal, previousPeriodTotal]);

    const dailyAverage = useMemo(() => {
        const days = daysInCurrentPeriod(period, periodStartTs);
        return days > 0 ? periodTotal / days : 0;
    }, [periodTotal, period, periodStartTs]);

    const biggestExpense = useMemo<TreasuryTx | null>(() => {
        return filteredExpenses.reduce<TreasuryTx | null>((max, tx) => {
            if (!max || netExpenseAmount(tx) > netExpenseAmount(max)) {
                return tx;
            }

            return max;
        }, null);
    }, [filteredExpenses]);

    const biggestAmount = biggestExpense ? netExpenseAmount(biggestExpense) : 0;
    const profitPctTone = profitConsumedPct > 80
        ? 'text-danger'
        : profitConsumedPct > 50
            ? 'text-warning'
            : 'text-neutral-900';
    const vsPrevTone = changeVsPrev === null
        ? 'text-neutral-500'
        : changeVsPrev > 0
            ? 'text-financial-loss'
            : changeVsPrev < 0
                ? 'text-financial-profit'
                : 'text-neutral-500';

    const headerActionsSlot = useHeaderActionsSlot();
    const pdfLabel = t('treasury.exportPdf') as string;
    const months = (Array.isArray(t('common.months')) ? t('common.months') : []) as string[];
    const sourceLabel = (source?: string) => source === 'Caisse'
        ? t('transactions.cash') as string
        : source === 'BaridiMob'
            ? t('transactions.baridi') as string
            : source;
    const opsCount = (count: number) => String(t(count > 1 ? 'personalExpenses.totalOps' : 'personalExpenses.totalOp')).replace('{count}', String(count));

    return (
        <div className="anim-page-in flex flex-col gap-3">
            {/* Phones get the PDF in the header. */}
            {onExportReport && (
                <div className="hidden gap-2 sm:flex">
                    <Button type="button" variant="outline" size="md" onClick={() => onExportReport(period)} className="font-semibold">
                        <DownloadCloudIcon className="h-4 w-4" />
                        <span>{pdfLabel}</span>
                    </Button>
                </div>
            )}
            {onExportReport && headerActionsSlot && createPortal(
                <button type="button" onClick={() => onExportReport(period)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95" title={pdfLabel} aria-label={pdfLabel}>
                    <DownloadCloudIcon className="h-[22px] w-[22px]" />
                </button>,
                headerActionsSlot,
            )}

            {!managerExists && (
                <AlertCard tone="warning" title={t('emptyStates.personal.noManager')} />
            )}

            <HeroCard label={t('personalExpenses.totalThisMonth')} value={aggregates.month} />
            <StatTileGrid>
                <StatTile label={t('personalExpenses.today') as string} value={aggregates.today} />
                <StatTile label={t('personalExpenses.thisWeek') as string} value={aggregates.week} />
                <StatTile label={t('personalExpenses.thisYear') as string} value={aggregates.year} />
                <StatTile label={t('personalExpenses.sinceStart') as string} value={aggregates.allTime} />
            </StatTileGrid>

            {pendingAdvances.length > 0 && (
                <SectionCard
                    flush
                    title={<>{t('personalExpenses.toReconcile')} <span className="font-semibold text-neutral-500">· <bdi>{pendingAdvances.length}</bdi></span></>}
                    actions={(
                        <span className="pe-2 text-end">
                            <span className="block text-xs text-neutral-500">{t('personalExpenses.pending')}</span>
                            <CurrencyAmount value={pendingTotal} currency="DZD" semantic="plain" size="md" decimals={0} className="font-semibold text-financial-debt" />
                        </span>
                    )}
                >
                    {pendingAdvances.map((tx) => (
                        <React.Fragment key={tx.id}>
                            <ExpenseRow
                                tx={tx}
                                sourceLabel={sourceLabel(tx.source)}
                                amount={Number(tx.amount || 0)}
                                amountSemantic="plain"
                                amountClassName="text-financial-debt"
                                fallbackLabel={t('personalExpenses.personalAdvance') as string}
                                iconTone="warning"
                                badge={<span className="rounded-full bg-financial-debt-bg px-1.5 py-0.5 text-[11px] font-bold leading-none text-financial-debt">{t('personalExpenses.advance')}</span>}
                                action={onOpenReconcile && (
                                    <Button type="button" size="sm" onClick={() => onOpenReconcile(tx)} className="shrink-0 whitespace-nowrap px-3">
                                        <RefreshCwIcon className="h-3.5 w-3.5" />
                                        {t('personalExpenses.reconcile')}
                                    </Button>
                                )}
                                editLabel={t('personalExpenses.editExpense') as string}
                                deleteLabel={t('personalExpenses.deleteExpense') as string}
                                onEdit={onEditExpense}
                                onDelete={onDeleteExpense}
                            />
                        </React.Fragment>
                    ))}
                </SectionCard>
            )}

            <Tabs
                tabs={periodTabs}
                activeTab={period}
                onChange={(next) => setPeriod(next as Period)}
                variant="pills"
            />

            <SectionCard title={t('personalExpenses.statistics')}>
                <div className="grid grid-cols-2 gap-2">
                    <MetricBlock
                        label={t('personalExpenses.profitConsumed') as string}
                        value={(
                            <span className={`text-lg font-bold tabular-nums ${profitPctTone}`} dir="ltr">
                                {formatNumber(profitConsumedPct, { min: 1, max: 1 })}%
                            </span>
                        )}
                    />
                    <MetricBlock
                        label={t('personalExpenses.vsPreviousPeriod') as string}
                        value={changeVsPrev === null ? (
                            <span className="text-base font-medium text-neutral-500">-</span>
                        ) : (
                            <span className={`text-lg font-bold tabular-nums ${vsPrevTone}`} dir="ltr">
                                {changeVsPrev > 0 ? '+' : ''}{formatNumber(changeVsPrev, { min: 1, max: 1 })}%
                                <span className="ms-1 text-sm">{changeVsPrev > 0 ? '↑' : changeVsPrev < 0 ? '↓' : ''}</span>
                            </span>
                        )}
                    />
                    <MetricBlock
                        label={t('personalExpenses.averagePerDay') as string}
                        value={<CurrencyAmount value={dailyAverage} currency="DZD" semantic="plain" size="lg" decimals={0}/>}
                    />
                    <MetricBlock
                        label={t('personalExpenses.biggestExpense') as string}
                        value={<CurrencyAmount value={biggestAmount} currency="DZD" semantic="plain" size="lg" decimals={0}/>}
                        caption={biggestExpense?.date}
                    />
                </div>
            </SectionCard>

            <SectionCard
                flush
                title={periodLabel(period, months, t('common.weekdaysLong') as unknown as string[], t('personalExpenses.weekOf') as string)}
                actions={(
                    <span className="pe-2 text-end">
                        <span className="block text-xs text-neutral-500">{opsCount(filteredExpenses.length)}</span>
                        <CurrencyAmount value={periodTotal} currency="DZD" semantic="plain" size="md" decimals={0} className="font-semibold" />
                    </span>
                )}
            >
                {filteredExpenses.length === 0 ? (
                    <EmptyState
                        icon={<FileSpreadsheetIcon className="h-5 w-5" />}
                        title={t('emptyStates.expenses.title') as string}
                        subtitle={t('emptyStates.expenses.subtitle') as string}
                    />
                ) : (
                    <div>
                        {filteredExpenses.map((tx) => {
                            const isSettled = tx.advanceState === 'settled';
                            const displayAmount = netExpenseAmount(tx);
                            const advanceAmount = Number(tx.amount || 0);

                            return (
                                <React.Fragment key={tx.id}>
                                    <ExpenseRow
                                        tx={tx}
                                        sourceLabel={sourceLabel(tx.source)}
                                        amount={displayAmount > 0 ? -displayAmount : 0}
                                        amountSemantic={displayAmount > 0 ? 'auto' : 'plain'}
                                        iconTone="neutral"
                                        fallbackLabel={t('personalExpenses.personalExpense') as string}
                                        badge={isSettled ? <span className="rounded-full bg-financial-profit-bg px-1.5 py-0.5 text-[11px] font-bold leading-none text-financial-profit">{t('personalExpenses.settled')}</span> : undefined}
                                        caption={isSettled && advanceAmount > displayAmount ? (
                                            <span className="inline-flex flex-wrap items-center gap-1">
                                                {t('personalExpenses.fromAdvance')}
                                                <CurrencyAmount value={advanceAmount} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                                            </span>
                                        ) : undefined}
                                        editLabel={t('personalExpenses.editExpense') as string}
                                        deleteLabel={t('personalExpenses.deleteExpense') as string}
                                        onEdit={onEditExpense}
                                        onDelete={onDeleteExpense}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}

type MetricBlockProps = {
    label: string;
    value: ReactNode;
    caption?: string;
};

function MetricBlock({ label, value, caption }: MetricBlockProps) {
    return (
        <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
            <p className="line-clamp-2 break-words text-xs font-semibold leading-snug text-neutral-500">{label}</p>
            <div className="mt-0.5">{value}</div>
            {caption && <p className="mt-0.5 truncate text-xs text-neutral-500" dir="ltr">{caption}</p>}
        </div>
    );
}

type ExpenseRowProps = {
    tx: TreasuryTx;
    sourceLabel?: string;
    amount: number;
    amountSemantic: 'auto' | 'plain';
    amountClassName?: string;
    fallbackLabel: ReactNode;
    iconTone: 'warning' | 'neutral';
    badge?: ReactNode;
    caption?: ReactNode;
    action?: ReactNode;
    editLabel: string;
    deleteLabel: string;
    onEdit?: (tx: TreasuryTx) => void;
    onDelete?: (tx: TreasuryTx) => void;
};

function ExpenseRow({
    tx,
    sourceLabel,
    amount,
    amountSemantic,
    amountClassName = '',
    fallbackLabel,
    iconTone,
    badge,
    caption,
    action,
    editLabel,
    deleteLabel,
    onEdit,
    onDelete,
}: ExpenseRowProps) {
    const iconClass = iconTone === 'warning'
        ? 'bg-financial-debt-bg text-financial-debt'
        : 'bg-surface-muted text-neutral-600';
    const displayLabel = tx.spentDescription || tx.notes || fallbackLabel;
    const editButtons = (onEdit || onDelete) && (
        <span className="flex shrink-0 items-center gap-1">
            {onEdit && (
                <IconButton label={editLabel} size="sm" variant="edit" onClick={() => onEdit(tx)}>
                    <PencilIcon />
                </IconButton>
            )}
            {onDelete && (
                <IconButton label={deleteLabel} size="sm" variant="delete" onClick={() => onDelete(tx)}>
                    <Trash2Icon />
                </IconButton>
            )}
        </span>
    );

    return (
        <div className="flex items-start gap-3 border-t border-border px-4 py-3 first:border-t-0">
            <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                {iconTone === 'warning' ? <AlertTriangleIcon className="h-4 w-4" /> : <BanknotesIcon className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
                {/* Label and amount on the first line; the details use the full width below. */}
                <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words pt-0.5 text-sm font-semibold leading-snug text-neutral-900">{displayLabel}</p>
                    <span className="shrink-0">
                        <CurrencyAmount value={amount} currency="DZD" semantic={amountSemantic} size="md" showSign={amount < 0} decimals={0} className={`font-semibold ${amountClassName}`}/>
                    </span>
                </div>
                {badge && <div className="mt-1">{badge}</div>}
                <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        {/* Each part keeps its dot when the line wraps, so no line ends on a lone dot. */}
                        <p className="flex flex-wrap items-center gap-x-1.5 text-xs leading-snug text-neutral-500">
                            <span dir="ltr" className="whitespace-nowrap">{tx.date}</span>
                            <span className="whitespace-nowrap"><span aria-hidden="true">· </span><span dir="ltr">{tx.time}</span></span>
                            {sourceLabel && <span className="whitespace-nowrap"><span aria-hidden="true">· </span>{sourceLabel}</span>}
                        </p>
                        {caption && <p className="mt-0.5 text-xs text-neutral-500">{caption}</p>}
                    </div>
                    {!action && editButtons}
                </div>
                {action && (
                    <div className="mt-2 flex items-center gap-1">
                        {action}
                        <span className="flex-1" />
                        {editButtons}
                    </div>
                )}
            </div>
        </div>
    );
}
