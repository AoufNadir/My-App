import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { IconButton } from '../components/ui/IconButton';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeading } from '../components/ui/SectionHeading';
import { EmptyState } from '../components/ui/EmptyState';
import { Tabs, type Tab } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { BanknotesIcon } from '../components/icons/BanknotesIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { FileSpreadsheetIcon } from '../components/icons/FileSpreadsheetIcon';
import { AlertTriangleIcon } from '../components/icons/AlertTriangleIcon';
import { RefreshCwIcon } from '../components/icons/RefreshCwIcon';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { Trash2Icon } from '../components/icons/Trash2Icon';
import type { TreasuryTx } from '../types';
import { formatNumber } from './shared/pageFormat';

type Period = 'day' | 'week' | 'month' | 'year';

type PersonalExpensesPageProps = {
    personalExpenses: TreasuryTx[];
    managerAvailableProfit: number;
    managerExists: boolean;
    onOpenReconcile?: (advanceTx: TreasuryTx) => void;
    onEditExpense?: (tx: TreasuryTx) => void;
    onDeleteExpense?: (tx: TreasuryTx) => void;
    onExportReport?: (period: 'day' | 'week' | 'month' | 'year') => void;
};

const PERIOD_TABS: Tab[] = [
    { id: 'day', label: 'Jour' },
    { id: 'week', label: 'Semaine' },
    { id: 'month', label: 'Mois' },
    { id: 'year', label: 'Annee' },
];

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

function periodLabel(period: Period): string {
    const now = new Date();

    if (period === 'day') {
        return now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    if (period === 'week') {
        return `Semaine du ${new Date(startOfWeek(now.getTime())).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
    }

    if (period === 'month') {
        return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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
}: PersonalExpensesPageProps) {
    const [period, setPeriod] = useState<Period>('month');

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

    return (
        <div className="anim-page-in space-y-5">
            <PageHeader
                title="Mes depenses"
                subtitle="Suivi des avances, depenses et exports"
                actions={onExportReport && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onExportReport(period)}
                        aria-label="Exporter PDF"
                        title="Exporter PDF"
                    >
                        <DownloadCloudIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">PDF</span>
                    </Button>
                )}
            />

            <HeroKpiCard
                accent="sky"
                icon={<BanknotesIcon className="h-5 w-5" />}
                primaryLabel="Total ce mois"
                primaryValue={aggregates.month}
                primaryCurrency="DZD"
                primarySemantic="plain"
                secondary={[
                    { label: "Aujourd'hui", value: aggregates.today, currency: 'DZD', semantic: 'plain' },
                    { label: 'Cette semaine', value: aggregates.week, currency: 'DZD', semantic: 'plain' },
                    { label: 'Cette annee', value: aggregates.year, currency: 'DZD', semantic: 'plain' },
                ]}
            />

            {!managerExists && (
                <Card className="border-warning/20 bg-warning-bg p-4 text-sm text-warning">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>Aucun gerant defini. Designez un investisseur comme gerant pour activer cette fonctionnalite.</p>
                    </div>
                </Card>
            )}

            {managerExists && (
                <Card className="p-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-neutral-500">Profit disponible</p>
                        <CurrencyAmount value={managerAvailableProfit} currency="DZD" semantic="auto" size="lg" decimals={0}/>
                    </div>
                </Card>
            )}

            <Card>
                <CardHeader className="p-4 pb-3">
                    <SectionHeading icon={<TrendingUpIcon className="h-4 w-4" />}>
                        Statistiques
                    </SectionHeading>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 p-4 pt-0">
                    <MetricBlock
                        label="% profit consomme"
                        value={(
                            <span className={`text-xl font-bold tabular-nums ${profitPctTone}`} dir="ltr">
                                {formatNumber(profitConsumedPct, { min: 1, max: 1 })}%
                            </span>
                        )}
                    />
                    <MetricBlock
                        label="vs Periode prec."
                        value={changeVsPrev === null ? (
                            <span className="text-base font-medium text-neutral-500">-</span>
                        ) : (
                            <span className={`text-xl font-bold tabular-nums ${vsPrevTone}`} dir="ltr">
                                {changeVsPrev > 0 ? '+' : ''}{formatNumber(changeVsPrev, { min: 1, max: 1 })}%
                                <span className="ms-1 text-sm">{changeVsPrev > 0 ? '↑' : changeVsPrev < 0 ? '↓' : ''}</span>
                            </span>
                        )}
                    />
                    <MetricBlock
                        label="Moyenne / jour"
                        value={<CurrencyAmount value={dailyAverage} currency="DZD" semantic="plain" size="xl" decimals={0}/>}
                    />
                    <MetricBlock
                        label="Plus grosse dep."
                        value={<CurrencyAmount value={biggestAmount} currency="DZD" semantic="plain" size="xl" decimals={0}/>}
                        caption={biggestExpense?.date}
                    />
                </CardContent>
            </Card>

            {pendingAdvances.length > 0 && (
                <Card>
                    <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-3">
                        <SectionHeading icon={<AlertTriangleIcon className="h-4 w-4" />}>
                            A regulariser
                            <Badge variant="warning" size="sm">{pendingAdvances.length}</Badge>
                        </SectionHeading>
                        <div className="shrink-0 text-right">
                            <p className="text-xs font-medium text-neutral-500">En cours</p>
                            <CurrencyAmount value={pendingTotal} currency="DZD" semantic="neutral" size="lg" decimals={0}/>
                        </div>
                    </CardHeader>
                    <CardContent className="divide-y divide-border p-0">
                        {pendingAdvances.map((tx) => (
                            <ExpenseRow
                                key={tx.id}
                                tx={tx}
                                amount={Number(tx.amount || 0)}
                                amountSemantic="neutral"
                                amountLabel="Avance"
                                iconTone="warning"
                                badge={<Badge variant="warning" size="sm">Avance</Badge>}
                                action={onOpenReconcile && (
                                    <Button type="button" size="sm" onClick={() => onOpenReconcile(tx)}>
                                        <RefreshCwIcon className="h-3.5 w-3.5" />
                                        Regulariser
                                    </Button>
                                )}
                                onEdit={onEditExpense}
                                onDelete={onDeleteExpense}
                            />
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="flex items-center gap-2">
                <Tabs
                    tabs={PERIOD_TABS}
                    activeTab={period}
                    onChange={(next) => setPeriod(next as Period)}
                    variant="pills"
                    className="flex-1"
                />
                {onExportReport && (
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => onExportReport(period)}
                        aria-label="Exporter PDF"
                        title="Exporter PDF"
                        className="shrink-0"
                    >
                        <DownloadCloudIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">PDF</span>
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-3">
                    <SectionHeading icon={<CalendarIcon className="h-4 w-4" />}>
                        {periodLabel(period)}
                    </SectionHeading>
                    <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-neutral-500">
                            Total · {filteredExpenses.length} op{filteredExpenses.length > 1 ? 's' : ''}
                        </p>
                        <CurrencyAmount value={periodTotal} currency="DZD" semantic="plain" size="md" decimals={0}/>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredExpenses.length === 0 ? (
                        <EmptyState
                            icon={<FileSpreadsheetIcon className="h-6 w-6" />}
                            title="Aucune depense"
                            subtitle="Aucune depense pour cette periode."
                        />
                    ) : (
                        <div className="divide-y divide-border">
                            {filteredExpenses.map((tx) => {
                                const isSettled = tx.advanceState === 'settled';
                                const displayAmount = netExpenseAmount(tx);
                                const advanceAmount = Number(tx.amount || 0);

                                return (
                                    <ExpenseRow
                                        key={tx.id}
                                        tx={tx}
                                        amount={displayAmount > 0 ? -displayAmount : 0}
                                        amountSemantic={displayAmount > 0 ? 'auto' : 'plain'}
                                        iconTone="neutral"
                                        badge={isSettled ? <Badge variant="success" size="sm">Regularise</Badge> : undefined}
                                        caption={isSettled && advanceAmount > displayAmount ? (
                                            <span className="inline-flex flex-wrap items-center justify-end gap-1">
                                                sur avance
                                                <CurrencyAmount value={advanceAmount} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                                            </span>
                                        ) : undefined}
                                        onEdit={onEditExpense}
                                        onDelete={onDeleteExpense}
                                    />
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
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
        <div className="rounded-lg bg-surface-muted p-3">
            <p className="text-xs font-medium text-neutral-500">{label}</p>
            <div className="mt-1">{value}</div>
            {caption && <p className="mt-0.5 truncate text-xs text-neutral-500">{caption}</p>}
        </div>
    );
}

type ExpenseRowProps = {
    tx: TreasuryTx;
    amount: number;
    amountSemantic: 'auto' | 'neutral' | 'plain';
    amountLabel?: string;
    iconTone: 'warning' | 'neutral';
    badge?: ReactNode;
    caption?: ReactNode;
    action?: ReactNode;
    onEdit?: (tx: TreasuryTx) => void;
    onDelete?: (tx: TreasuryTx) => void;
};

function ExpenseRow({
    tx,
    amount,
    amountSemantic,
    amountLabel,
    iconTone,
    badge,
    caption,
    action,
    onEdit,
    onDelete,
}: ExpenseRowProps) {
    const iconClass = iconTone === 'warning'
        ? 'bg-warning-bg text-warning'
        : 'bg-neutral-100 text-neutral-600';

    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted">
            <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                    {iconTone === 'warning' ? <AlertTriangleIcon className="h-5 w-5" /> : <BanknotesIcon className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-neutral-900">
                            {tx.notes || (iconTone === 'warning' ? 'Avance personnelle' : 'Depense personnelle')}
                        </p>
                        {badge}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                        {tx.date} · {tx.time}
                        {tx.source && <span> · {tx.source}</span>}
                    </p>
                </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <div className="text-right">
                    <CurrencyAmount value={amount} currency="DZD" semantic={amountSemantic} size="lg" showSign={amount < 0} decimals={0}/>
                    {amountLabel && <p className="text-xs text-neutral-500">{amountLabel}</p>}
                    {caption && <p className="text-xs text-neutral-500">{caption}</p>}
                </div>
                {action}
                {onEdit && (
                    <IconButton label="Modifier la depense" size="sm" variant="edit" onClick={() => onEdit(tx)}>
                        <PencilIcon />
                    </IconButton>
                )}
                {onDelete && (
                    <IconButton label="Supprimer la depense" size="sm" variant="delete" onClick={() => onDelete(tx)}>
                        <Trash2Icon />
                    </IconButton>
                )}
            </div>
        </div>
    );
}
