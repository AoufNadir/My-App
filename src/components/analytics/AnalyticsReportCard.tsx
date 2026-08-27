import { useMemo, useState, type FC } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Label } from '../ui/Label';
import { MobileTable, type MobileTableColumn } from '../ui/MobileTable';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SectionHeading } from '../ui/SectionHeading';
import { Select } from '../ui/Select';
import { Tabs, type Tab } from '../ui/Tabs';
import { BottomSheet } from '../ui/BottomSheet';
import { SearchableSelect } from '../ui/SearchableSelect';
import { SparklesIcon } from '../icons/SparklesIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { DownloadCloudIcon } from '../icons/DownloadCloudIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import type { ClientDzd, ClientTransactionDzd, PortfolioStats, Tx } from '../../types';
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
    const [activeTab, setActiveTab] = useState<'monthly' | 'clients'>('monthly');
    const [isExportSheetOpen, setIsExportSheetOpen] = useState(false);
    // Client report state (local, previously in AnalyticsExportPanel)
    const [localReportClient, setLocalReportClient] = useState(reportClient);
    const [localReportMonth, setLocalReportMonth] = useState(reportMonth);
    const [localReportYear, setLocalReportYear] = useState(reportYear);

    const topProfitableRows = [...monthlyClientRanking.rankedRows]
        .filter((row) => row.sellCount > 0)
        .sort((a, b) => {
            if (b.realizedProfit !== a.realizedProfit) return b.realizedProfit - a.realizedProfit;
            if (b.totalVolumeUsdt !== a.totalVolumeUsdt) return b.totalVolumeUsdt - a.totalVolumeUsdt;
            return a.clientName.localeCompare(b.clientName, 'fr');
        })
        .slice(0, 5);
    const monthOptions = reportMonths(usdtReportYear);
    const clientMonthOptions = reportMonths(localReportYear);
    const selectedMonthLabel = monthOptions[usdtReportMonth] || `${usdtReportMonth + 1}`;
    const monthlyHasData = Boolean(calculatedStats.volUsdtBought || calculatedStats.volUsdtSold
        || calculatedStats.volEurBought || calculatedStats.volEurSold
        || calculatedStats.realizedProfit || heatmapData.size);
    const bestHeatmapDay = [...heatmapData.entries()].sort((l, r) => r[1] - l[1])[0] || null;
    const worstHeatmapDay = [...heatmapData.entries()].sort((l, r) => l[1] - r[1])[0] || null;
    const winningDaysCount = [...heatmapData.values()].filter((p) => p > 0).length;
    const sortedClients = useMemo(() => [...clientsDzd].sort((a, b) => getClientFullName(a).localeCompare(getClientFullName(b), 'fr')), [clientsDzd, getClientFullName]);
    const tabItems: Tab[] = [
        { id: 'monthly', label: t('portfolio.tabSynthesis') },
        { id: 'clients', label: t('portfolio.tabClients'), badge: topProfitableRows.length },
    ];
    // Simplified 3-column table: Name | Ventes USDT | Profit
    const columns: MobileTableColumn<MonthlyClientRank>[] = [
        {
            key: 'client',
            label: t('portfolio.clientName'),
            render: (row) => {
                const index = topProfitableRows.findIndex((item) => item.clientId === row.clientId);
                return (
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">
                            {index + 1}
                        </span>
                        <span className="truncate text-sm font-semibold">{row.clientName}</span>
                    </div>
                );
            },
        },
        {
            key: 'sellVolumeUsdt',
            label: t('portfolio.sellVolumeUsdt'),
            align: 'end',
            render: (row) => <CurrencyAmount value={row.sellVolumeUsdt} currency="USDT" semantic="plain" size="sm" decimals={0}/>,
        },
        {
            key: 'realizedProfit',
            label: t('portfolio.realizedProfit'),
            align: 'end',
            render: (row) => <CurrencyAmount value={row.realizedProfit} currency="DZD" semantic="auto" showSign size="sm" decimals={0}/>,
        },
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="p-4 pb-3">
                    <div className="flex items-center justify-between gap-2">
                        <SectionHeading icon={<SparklesIcon className="h-4 w-4" />}>
                            {t('portfolio.analysisReports')}
                        </SectionHeading>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsExportSheetOpen(true)}
                            className="shrink-0 gap-1.5 font-semibold"
                            title="Exporter PDF"
                        >
                            <DownloadCloudIcon className="h-4 w-4"/>
                            PDF
                        </Button>
                    </div>
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
                    monthlyHasData={monthlyHasData}
                    bestHeatmapDay={bestHeatmapDay}
                    worstHeatmapDay={worstHeatmapDay}
                    winningDaysCount={winningDaysCount}
                    topProfitableClient={monthlyClientRanking.topProfitableClient}
                />
            )}

            {activeTab === 'clients' && (
                <ClientsPanel
                    t={t}
                    topProfitableRows={topProfitableRows}
                    monthlyClientRanking={monthlyClientRanking}
                    columns={columns}
                />
            )}

            {/* Export PDF BottomSheet */}
            <BottomSheet isOpen={isExportSheetOpen} onClose={() => setIsExportSheetOpen(false)} title="Exporter un rapport PDF">
                <div className="px-4 pb-6 space-y-5">

                    {/* Section 1 — Rapport mensuel */}
                    <div className="rounded-xl border border-border bg-surface-muted p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-primary shrink-0"/>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-neutral-800">Rapport mensuel</p>
                                <p className="text-xs text-neutral-500">
                                    {selectedMonthLabel} {usdtReportYear}
                                    {calculatedStats.realizedProfit !== 0 && (
                                        <> · <CurrencyAmount value={calculatedStats.realizedProfit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/></>
                                    )}
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            onClick={() => { handleExportUsdtReport(); setIsExportSheetOpen(false); }}
                            className="w-full gap-2 font-bold"
                            disabled={!monthlyHasData}
                        >
                            <DownloadCloudIcon className="h-4 w-4"/>
                            {monthlyHasData ? 'Télécharger rapport mensuel' : 'Aucune donnée ce mois'}
                        </Button>
                    </div>

                    {/* Section 2 — Rapport par client */}
                    <div className="rounded-xl border border-border bg-surface-muted p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <UsersIcon className="w-4 h-4 text-secondary shrink-0"/>
                            <p className="text-sm font-bold text-neutral-800">Rapport client</p>
                        </div>

                        <div>
                            <Label>Client</Label>
                            <SearchableSelect
                                value={localReportClient}
                                onChange={setLocalReportClient}
                                options={sortedClients.map((c) => ({ value: c.id, label: getClientFullName(c) }))}
                                fieldClassName="mt-1"
                                searchPlaceholder="Rechercher un client…"
                                emptyOptionLabel="Sélectionner un client"
                                emptyValue=""
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label>Mois</Label>
                                <Select value={localReportMonth} onChange={(e) => setLocalReportMonth(Number(e.target.value))} className="mt-1">
                                    {clientMonthOptions.map((name, i) => <option key={name} value={i}>{name}</option>)}
                                </Select>
                            </div>
                            <div>
                                <Label>Année</Label>
                                <Select value={localReportYear} onChange={(e) => setLocalReportYear(Number(e.target.value))} className="mt-1">
                                    {reportYears.map((y) => <option key={y} value={y}>{y}</option>)}
                                </Select>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => { if (localReportClient) { handleExportClientReport(localReportClient, localReportMonth, localReportYear); setIsExportSheetOpen(false); } }}
                            className="w-full gap-2 font-bold"
                            disabled={!localReportClient}
                        >
                            <DownloadCloudIcon className="h-4 w-4"/>
                            {localReportClient ? 'Télécharger rapport client' : "Choisir un client d'abord"}
                        </Button>
                    </div>
                </div>
            </BottomSheet>
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
    monthlyHasData,
    bestHeatmapDay,
    worstHeatmapDay,
    winningDaysCount,
    topProfitableClient,
}: Pick<MonthlyPanelProps, 't' | 'monthlyHasData' | 'bestHeatmapDay' | 'worstHeatmapDay' | 'winningDaysCount' | 'topProfitableClient'>) {
    if (!monthlyHasData) {
        return (
            <EmptyState
                title={t('portfolio.noMonthlyActivity')}
                subtitle={t('portfolio.emptyPeriod')}
                className="min-h-[120px] rounded-xl border border-border bg-surface-muted"
            />
        );
    }

    return (
        <div className="space-y-3">
            {/* Compact daily stats card — unique info not shown elsewhere */}
            <Card>
                <CardContent className="p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                        {t('portfolio.profitHeatmap')}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MetricTile label={t('portfolio.bestDay')}>
                            <DayProfitValue entry={bestHeatmapDay} />
                        </MetricTile>
                        <MetricTile label={t('portfolio.worstDay')}>
                            <DayProfitValue entry={worstHeatmapDay} />
                        </MetricTile>
                        <MetricTile label={t('portfolio.winningDays')}>
                            <span className="text-2xl font-extrabold tabular-nums text-neutral-900">{winningDaysCount}</span>
                        </MetricTile>
                        <MetricTile label={t('portfolio.profitableClient')}>
                            <span className="block truncate text-base font-extrabold text-neutral-900">
                                {topProfitableClient?.clientName || '—'}
                            </span>
                        </MetricTile>
                    </div>
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

function ClientsPanel({ t, topProfitableRows, monthlyClientRanking, columns }: Omit<ClientsPanelProps, 'isClientRankingVisible' | 'setIsClientRankingVisible'>) {
    return (
        <div className="space-y-3">
            {/* Top 2 summary tiles — compact */}
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                    <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.topTradedClient')}</p>
                    {monthlyClientRanking.topTradedClient ? (<>
                        <p className="text-sm font-bold text-neutral-800 truncate">{monthlyClientRanking.topTradedClient.clientName}</p>
                        <CurrencyAmount value={monthlyClientRanking.topTradedClient.sellVolumeUsdt} currency="USDT" semantic="plain" size="sm" decimals={0}/>
                        <p className="text-[9px] text-neutral-400 mt-0.5">{monthlyClientRanking.topTradedClient.sellCount} ventes</p>
                    </>) : <p className="text-xs text-neutral-400">—</p>}
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                    <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.topProfitableClient')}</p>
                    {monthlyClientRanking.topProfitableClient ? (<>
                        <p className="text-sm font-bold text-neutral-800 truncate">{monthlyClientRanking.topProfitableClient.clientName}</p>
                        <CurrencyAmount value={monthlyClientRanking.topProfitableClient.realizedProfit} currency="DZD" semantic="auto" showSign size="sm" decimals={0}/>
                        <p className="text-[9px] text-neutral-400 mt-0.5">{monthlyClientRanking.topProfitableClient.sellCount} ventes</p>
                    </>) : <p className="text-xs text-neutral-400">—</p>}
                </div>
            </div>

            {/* Top 5 compact table */}
            {topProfitableRows.length > 0 && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <SectionHeading icon={<UsersIcon className="h-4 w-4" />}>
                            {t('portfolio.topFiveProfit')}
                        </SectionHeading>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <MobileTable
                            columns={columns}
                            data={topProfitableRows}
                            keyExtractor={(row) => row.clientId}
                            emptyTitle={t('portfolio.noClientMonthlyData')}
                            emptySubtitle={t('portfolio.emptyPeriod')}
                        />
                    </CardContent>
                </Card>
            )}
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

const MetricTile: FC<{ label: ReactNode; children: ReactNode }> = ({ label, children }) => (
    <div className="rounded-lg border border-border bg-surface p-3">
        <span className="text-xs font-medium text-neutral-500">{label}</span>
        <div className="mt-2">{children}</div>
    </div>
);

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
