import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Label } from '../ui/Label';
import { MobileTable, type MobileTableColumn } from '../ui/MobileTable';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SectionHeading } from '../ui/SectionHeading';
import { Select } from '../ui/Select';
import { Tabs, type Tab } from '../ui/Tabs';
import { SparklesIcon } from '../icons/SparklesIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { formatNumber } from '../../pages/shared/pageFormat';
import type { ClientDzd, ClientTransactionDzd, PortfolioStats, Tx } from '../../types';
import { AnalyticsExportPanel } from './AnalyticsExportPanel';
import { CalculatedStats, MonthlyClientRank, MonthlyClientRanking } from './analyticsTypes';

type AnalyticsReportCardProps = {
    t: (...args: any[]) => any;
    usdtReportMonth: number;
    setUsdtReportMonth: (month: number) => void;
    usdtReportYear: number;
    setUsdtReportYear: (year: number) => void;
    reportMonths: (year: number) => string[];
    reportYears: number[];
    reportClient: string;
    setReportClient: (id: string) => void;
    reportMonth: number;
    setReportMonth: (month: number) => void;
    reportYear: number;
    setReportYear: (year: number) => void;
    clientsDzd: ClientDzd[];
    clientTransactionsDzd: ClientTransactionDzd[];
    transactions: Tx[];
    portfolioStats: PortfolioStats;
    getClientFullName: (client: ClientDzd) => string;
    handleExportUsdtReport: () => void;
    handleExportClientReport: (clientId: string, month: number, year: number) => void;
    calculatedStats: CalculatedStats;
    monthlyClientRanking: MonthlyClientRanking;
    heatmapData: Map<number, number>;
    selectedHeatmapDay: {
        day: number;
        profit: number;
    } | null;
    setSelectedHeatmapDay: (day: {
        day: number;
        profit: number;
    } | null) => void;
};

export function AnalyticsReportCard({
    t,
    usdtReportMonth,
    setUsdtReportMonth,
    usdtReportYear,
    setUsdtReportYear,
    reportMonths,
    reportYears,
    reportClient,
    setReportClient,
    reportMonth,
    setReportMonth,
    reportYear,
    setReportYear,
    clientsDzd,
    clientTransactionsDzd,
    transactions,
    portfolioStats,
    getClientFullName,
    handleExportUsdtReport,
    handleExportClientReport,
    calculatedStats,
    monthlyClientRanking,
    heatmapData,
    selectedHeatmapDay,
    setSelectedHeatmapDay,
}: AnalyticsReportCardProps) {
    const [activeTab, setActiveTab] = useState<'monthly' | 'clients' | 'exports'>('monthly');
    const [isHeatmapVisible, setIsHeatmapVisible] = useState(false);
    const [isClientRankingVisible, setIsClientRankingVisible] = useState(true);

    const topProfitableRows = [...monthlyClientRanking.rankedRows]
        .filter((row) => row.sellCount > 0)
        .sort((a, b) => {
            if (b.realizedProfit !== a.realizedProfit) {
                return b.realizedProfit - a.realizedProfit;
            }
            if (b.totalVolumeUsdt !== a.totalVolumeUsdt) {
                return b.totalVolumeUsdt - a.totalVolumeUsdt;
            }
            return a.clientName.localeCompare(b.clientName, 'fr');
        })
        .slice(0, 5);
    const monthOptions = reportMonths(usdtReportYear);
    const selectedMonthLabel = monthOptions[usdtReportMonth] || `${usdtReportMonth + 1}`;
    const monthlyHasData = Boolean(calculatedStats.volUsdtBought
        || calculatedStats.volUsdtSold
        || calculatedStats.volEurBought
        || calculatedStats.volEurSold
        || calculatedStats.realizedProfit
        || heatmapData.size);
    const bestHeatmapDay = [...heatmapData.entries()]
        .sort((left, right) => right[1] - left[1])[0] || null;
    const worstHeatmapDay = [...heatmapData.entries()]
        .sort((left, right) => left[1] - right[1])[0] || null;
    const winningDaysCount = [...heatmapData.values()].filter((profit) => profit > 0).length;
    const monthlyVolumeCount = calculatedStats.volUsdtBought
        + calculatedStats.volUsdtSold
        + calculatedStats.volEurBought
        + calculatedStats.volEurSold;
    const tabItems: Tab[] = [
        { id: 'monthly', label: t('portfolio.tabSynthesis') },
        { id: 'clients', label: t('portfolio.tabClients'), badge: topProfitableRows.length },
        { id: 'exports', label: t('portfolio.tabExports') },
    ];
    const flowMetrics = [
        { label: t('portfolio.usdtBought'), value: calculatedStats.volUsdtBought, currency: 'USDT' as const },
        { label: t('portfolio.usdtSold'), value: calculatedStats.volUsdtSold, currency: 'USDT' as const },
        { label: t('portfolio.eurBought'), value: calculatedStats.volEurBought, currency: 'EUR' as const },
        { label: t('portfolio.eurSold'), value: calculatedStats.volEurSold, currency: 'EUR' as const },
    ];
    const columns: MobileTableColumn<MonthlyClientRank>[] = [
        {
            key: 'client',
            label: t('portfolio.clientName'),
            render: (row) => {
                const index = topProfitableRows.findIndex((item) => item.clientId === row.clientId);
                return (
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700">
                            {index + 1}
                        </span>
                        <span className="truncate font-semibold">{row.clientName}</span>
                    </div>
                );
            },
        },
        {
            key: 'buyVolumeUsdt',
            label: t('portfolio.buyVolumeUsdt'),
            align: 'end',
            render: (row) => <CurrencyAmount value={row.buyVolumeUsdt} currency="USDT" semantic="plain" size="sm" decimals={2}/>,
        },
        {
            key: 'sellVolumeUsdt',
            label: t('portfolio.sellVolumeUsdt'),
            align: 'end',
            render: (row) => <CurrencyAmount value={row.sellVolumeUsdt} currency="USDT" semantic="plain" size="sm" decimals={2}/>,
        },
        {
            key: 'totalVolumeUsdt',
            label: t('portfolio.totalVolumeUsdt'),
            align: 'end',
            render: (row) => <CurrencyAmount value={row.totalVolumeUsdt} currency="USDT" semantic="plain" size="sm" decimals={2}/>,
        },
        {
            key: 'realizedProfit',
            label: t('portfolio.realizedProfit'),
            align: 'end',
            render: (row) => <CurrencyAmount value={row.realizedProfit} currency="DZD" semantic="auto" showSign size="sm" decimals={2}/>,
        },
        {
            key: 'txCount',
            label: t('portfolio.txCount'),
            align: 'end',
        },
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="p-4 pb-3">
                    <SectionHeading icon={<SparklesIcon className="h-4 w-4" />}>
                        {t('portfolio.analysisReports')}
                    </SectionHeading>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>{t('portfolio.month')}</Label>
                            <Select value={usdtReportMonth} onChange={(event) => setUsdtReportMonth(Number(event.target.value))} className="mt-1">
                                {monthOptions.map((monthName, index) => <option key={monthName} value={index}>{monthName}</option>)}
                            </Select>
                        </div>
                        <div>
                            <Label>{t('portfolio.year')}</Label>
                            <Select value={usdtReportYear} onChange={(event) => setUsdtReportYear(Number(event.target.value))} className="mt-1">
                                {reportYears.map((year) => <option key={year} value={year}>{year}</option>)}
                            </Select>
                        </div>
                    </div>

                    <Tabs tabs={tabItems} activeTab={activeTab} onChange={(next) => setActiveTab(next as typeof activeTab)} variant="pills" />
                </CardContent>
            </Card>

            {activeTab === 'monthly' && (
                <MonthlyPanel
                    t={t}
                    selectedMonthLabel={selectedMonthLabel}
                    usdtReportYear={usdtReportYear}
                    monthlyHasData={monthlyHasData}
                    calculatedStats={calculatedStats}
                    flowMetrics={flowMetrics}
                    monthlyVolumeCount={monthlyVolumeCount}
                    bestHeatmapDay={bestHeatmapDay}
                    worstHeatmapDay={worstHeatmapDay}
                    winningDaysCount={winningDaysCount}
                    heatmapData={heatmapData}
                    selectedHeatmapDay={selectedHeatmapDay}
                    setSelectedHeatmapDay={setSelectedHeatmapDay}
                    usdtReportMonth={usdtReportMonth}
                    isHeatmapVisible={isHeatmapVisible}
                    setIsHeatmapVisible={setIsHeatmapVisible}
                    topProfitableClient={monthlyClientRanking.topProfitableClient}
                />
            )}

            {activeTab === 'clients' && (
                <ClientsPanel
                    t={t}
                    topProfitableRows={topProfitableRows}
                    monthlyClientRanking={monthlyClientRanking}
                    columns={columns}
                    isClientRankingVisible={isClientRankingVisible}
                    setIsClientRankingVisible={setIsClientRankingVisible}
                />
            )}

            {activeTab === 'exports' && (
                <AnalyticsExportPanel
                    t={t}
                    usdtReportMonth={usdtReportMonth}
                    usdtReportYear={usdtReportYear}
                    reportMonths={reportMonths}
                    reportYears={reportYears}
                    reportClient={reportClient}
                    setReportClient={setReportClient}
                    reportMonth={reportMonth}
                    setReportMonth={setReportMonth}
                    reportYear={reportYear}
                    setReportYear={setReportYear}
                    clientsDzd={clientsDzd}
                    clientTransactionsDzd={clientTransactionsDzd}
                    transactions={transactions}
                    portfolioStats={portfolioStats}
                    getClientFullName={getClientFullName}
                    calculatedStats={calculatedStats}
                    monthlyClientRanking={monthlyClientRanking}
                    handleExportUsdtReport={handleExportUsdtReport}
                    handleExportClientReport={handleExportClientReport}
                />
            )}
        </div>
    );
}

type MonthlyPanelProps = {
    t: (...args: any[]) => any;
    selectedMonthLabel: string;
    usdtReportYear: number;
    monthlyHasData: boolean;
    calculatedStats: CalculatedStats;
    flowMetrics: Array<{ label: string; value: number; currency: 'USDT' | 'EUR' }>;
    monthlyVolumeCount: number;
    bestHeatmapDay: [number, number] | null;
    worstHeatmapDay: [number, number] | null;
    winningDaysCount: number;
    heatmapData: Map<number, number>;
    selectedHeatmapDay: { day: number; profit: number } | null;
    setSelectedHeatmapDay: (day: { day: number; profit: number } | null) => void;
    usdtReportMonth: number;
    isHeatmapVisible: boolean;
    setIsHeatmapVisible: (value: boolean | ((previous: boolean) => boolean)) => void;
    topProfitableClient: MonthlyClientRank | null;
};

function MonthlyPanel({
    t,
    selectedMonthLabel,
    usdtReportYear,
    monthlyHasData,
    calculatedStats,
    flowMetrics,
    monthlyVolumeCount,
    bestHeatmapDay,
    worstHeatmapDay,
    winningDaysCount,
    heatmapData,
    selectedHeatmapDay,
    setSelectedHeatmapDay,
    usdtReportMonth,
    isHeatmapVisible,
    setIsHeatmapVisible,
    topProfitableClient,
}: MonthlyPanelProps) {
    return (
        <div className="space-y-3">
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium text-neutral-500">{t('portfolio.monthlySynthesis')}</p>
                            <p className="mt-1 text-xl font-extrabold leading-tight text-neutral-900">{selectedMonthLabel} {usdtReportYear}</p>
                        </div>
                        <Badge variant={monthlyHasData ? 'success' : 'neutral'}>{monthlyHasData ? t('portfolio.activePeriod') : t('portfolio.emptyPeriod')}</Badge>
                    </div>
                    <div className="mt-5">
                        <CurrencyAmount value={calculatedStats.realizedProfit} currency="DZD" semantic="auto" showSign size="hero" decimals={2}/>
                        <p className="mt-1 text-sm font-semibold text-neutral-500">{t('portfolio.monthlyProfitHint')}</p>
                    </div>
                    {!monthlyHasData && (
                        <EmptyState
                            title={t('portfolio.noMonthlyActivity')}
                            subtitle={t('portfolio.emptyPeriod')}
                            className="mt-4 min-h-[120px] rounded-lg bg-surface-muted"
                        />
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2">
                {flowMetrics.map((item) => (
                    <MetricTile key={`${item.label}-${item.currency}`} label={item.label}>
                        <CurrencyAmount value={item.value} currency={item.currency} semantic="plain" size="xl" decimals={2}/>
                    </MetricTile>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <MetricTile label={t('portfolio.totalVolume')}>
                    <span className="text-lg font-extrabold tabular-nums text-neutral-900" dir="ltr">{formatNumber(monthlyVolumeCount, { min: 2, max: 2 })}</span>
                </MetricTile>
                <MetricTile label={t('portfolio.bestDay')}>
                    <DayProfitValue entry={bestHeatmapDay} />
                </MetricTile>
                <MetricTile label={t('portfolio.profitableClient')}>
                    <span className="block truncate text-lg font-extrabold text-neutral-900">{topProfitableClient?.clientName || '-'}</span>
                </MetricTile>
            </div>

            <Card>
                <CardHeader className="flex-row items-center justify-between gap-3 p-4 pb-3">
                    <SectionHeading icon={<TrendingUpIcon className="h-4 w-4" />}>
                        {t('portfolio.profitHeatmap')}
                    </SectionHeading>
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsHeatmapVisible((previous) => !previous)}>
                        {isHeatmapVisible ? t('portfolio.hideCalendar') : t('portfolio.showCalendar')}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <MetricTile label={t('portfolio.bestDay')}>
                            <DayProfitValue entry={bestHeatmapDay} />
                        </MetricTile>
                        <MetricTile label={t('portfolio.worstDay')}>
                            <DayProfitValue entry={worstHeatmapDay} />
                        </MetricTile>
                        <MetricTile label={t('portfolio.winningDays')}>
                            <span className="text-sm font-bold text-neutral-900">{winningDaysCount}</span>
                        </MetricTile>
                    </div>

                    {isHeatmapVisible && (
                        <div>
                            <ProfitHeatmap
                                t={t}
                                heatmapData={heatmapData}
                                selectedHeatmapDay={selectedHeatmapDay}
                                setSelectedHeatmapDay={setSelectedHeatmapDay}
                                usdtReportMonth={usdtReportMonth}
                                usdtReportYear={usdtReportYear}
                            />
                            {selectedHeatmapDay && (
                                <p className="mt-2 rounded-lg bg-surface-muted p-2 text-center text-sm text-neutral-700">
                                    {t('portfolio.profitOn')} {selectedHeatmapDay.day}/{usdtReportMonth + 1}/{usdtReportYear}:{' '}
                                    <CurrencyAmount value={selectedHeatmapDay.profit} currency="DZD" semantic="auto" size="sm" decimals={2}/>
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

type ClientsPanelProps = {
    t: (...args: any[]) => any;
    topProfitableRows: MonthlyClientRank[];
    monthlyClientRanking: MonthlyClientRanking;
    columns: MobileTableColumn<MonthlyClientRank>[];
    isClientRankingVisible: boolean;
    setIsClientRankingVisible: (value: boolean | ((previous: boolean) => boolean)) => void;
};

function ClientsPanel({ t, topProfitableRows, monthlyClientRanking, columns, isClientRankingVisible, setIsClientRankingVisible }: ClientsPanelProps) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TopClientTile
                    label={t('portfolio.topTradedClient')}
                    client={monthlyClientRanking.topTradedClient}
                    emptyText={t('portfolio.noClientMonthlyData')}
                    value={(client) => <CurrencyAmount value={client.totalVolumeUsdt} currency="USDT" semantic="plain" size="lg" decimals={2}/>}
                    hint={(client) => `${t('portfolio.txCount')}: ${client.txCount}`}
                />
                <TopClientTile
                    label={t('portfolio.topProfitableClient')}
                    client={monthlyClientRanking.topProfitableClient}
                    emptyText={t('portfolio.noClientMonthlyData')}
                    value={(client) => <CurrencyAmount value={client.realizedProfit} currency="DZD" semantic="auto" showSign size="lg" decimals={2}/>}
                    hint={(client) => `${t('portfolio.sellCount')}: ${client.sellCount}`}
                />
            </div>

            <Card>
                <CardHeader className="flex-row items-center justify-between gap-3 p-4 pb-3">
                    <SectionHeading icon={<FileSpreadsheetIcon className="h-4 w-4" />}>
                        {t('portfolio.topFiveProfit')}
                    </SectionHeading>
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsClientRankingVisible((previous) => !previous)}>
                        {isClientRankingVisible ? t('common.hide') : t('common.show')}
                    </Button>
                </CardHeader>
                {isClientRankingVisible && (
                    <CardContent className="p-4 pt-0">
                        <MobileTable
                            columns={columns}
                            data={topProfitableRows}
                            keyExtractor={(row) => row.clientId}
                            emptyTitle={t('portfolio.noClientMonthlyData')}
                            emptySubtitle={t('portfolio.emptyPeriod')}
                        />
                    </CardContent>
                )}
            </Card>
        </div>
    );
}

function ProfitHeatmap({
    t,
    heatmapData,
    selectedHeatmapDay,
    setSelectedHeatmapDay,
    usdtReportMonth,
    usdtReportYear,
}: {
    t: (...args: any[]) => any;
    heatmapData: Map<number, number>;
    selectedHeatmapDay: { day: number; profit: number } | null;
    setSelectedHeatmapDay: (day: { day: number; profit: number } | null) => void;
    usdtReportMonth: number;
    usdtReportYear: number;
}) {
    const firstDayOfMonth = new Date(usdtReportYear, usdtReportMonth, 1).getDay();
    const daysInMonth = new Date(usdtReportYear, usdtReportMonth + 1, 0).getDate();
    const getHeatmapColor = (profit: number) => {
        if (profit > 10000) {
            return 'bg-success text-white';
        }
        if (profit > 5000) {
            return 'bg-success/80 text-white';
        }
        if (profit > 1000) {
            return 'bg-success/60 text-white';
        }
        if (profit > 0) {
            return 'bg-success/20 text-success';
        }
        if (profit < -10000) {
            return 'bg-danger text-white';
        }
        if (profit < -5000) {
            return 'bg-danger/80 text-white';
        }
        if (profit < -1000) {
            return 'bg-danger/60 text-white';
        }
        if (profit < 0) {
            return 'bg-danger/20 text-danger';
        }
        return 'bg-neutral-100 text-neutral-500';
    };

    return (
        <div>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
                {(t('common.days') as string[]).map((day) => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDayOfMonth }).map((_, index) => <div key={`empty-${index}`} />)}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                    const day = index + 1;
                    const profit = heatmapData.get(day) || 0;
                    const selected = selectedHeatmapDay?.day === day;

                    return (
                        <button
                            key={day}
                            type="button"
                            className={[
                                'flex aspect-square w-full min-h-touch items-center justify-center rounded-md text-xs font-semibold transition-transform hover:scale-105',
                                getHeatmapColor(profit),
                                selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => setSelectedHeatmapDay(selected ? null : { day, profit })}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function MetricTile({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="rounded-lg border border-border bg-surface p-3">
            <span className="text-xs font-medium text-neutral-500">{label}</span>
            <div className="mt-2">{children}</div>
        </div>
    );
}

function DayProfitValue({ entry }: { entry: [number, number] | null }) {
    if (!entry) {
        return <span className="text-sm font-bold text-neutral-500">-</span>;
    }

    return (
        <span className="flex flex-wrap items-center gap-1 text-sm font-bold text-neutral-900">
            <span dir="ltr">{entry[0]}</span>
            <span>/</span>
            <CurrencyAmount value={entry[1]} currency="DZD" semantic="auto" size="sm" decimals={0}/>
        </span>
    );
}

function TopClientTile({
    label,
    client,
    emptyText,
    value,
    hint,
}: {
    label: ReactNode;
    client: MonthlyClientRank | null;
    emptyText: ReactNode;
    value: (client: MonthlyClientRank) => ReactNode;
    hint: (client: MonthlyClientRank) => ReactNode;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <Label className="text-xs font-medium text-neutral-500">{label}</Label>
                {client ? (
                    <>
                        <p className="mt-2 truncate text-lg font-bold text-neutral-900">{client.clientName}</p>
                        <div className="mt-1">{value(client)}</div>
                        <p className="mt-1 text-xs text-neutral-500">{hint(client)}</p>
                    </>
                ) : (
                    <EmptyState title={String(emptyText)} className="min-h-[112px]" />
                )}
            </CardContent>
        </Card>
    );
}
