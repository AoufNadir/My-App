import { useMemo, type ReactNode } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Label } from '../ui/Label';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SearchableSelect } from '../ui/SearchableSelect';
import { SectionHeading } from '../ui/SectionHeading';
import { Select } from '../ui/Select';
import { CalendarIcon } from '../icons/CalendarIcon';
import { DownloadCloudIcon } from '../icons/DownloadCloudIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { WalletIcon } from '../icons/WalletIcon';
import type { ClientDzd, ClientTransactionDzd, PortfolioStats, Tx } from '../../types';
import { formatNumber } from '../../pages/shared/pageFormat';
import type { CalculatedStats, MonthlyClientRanking } from './analyticsTypes';

type AnalyticsExportPanelProps = {
    t: (...args: any[]) => any;
    usdtReportMonth: number;
    usdtReportYear: number;
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
    calculatedStats: CalculatedStats;
    monthlyClientRanking: MonthlyClientRanking;
    handleExportUsdtReport: () => void;
    handleExportClientReport: (clientId: string, month: number, year: number) => void;
};

export function AnalyticsExportPanel({
    t,
    usdtReportMonth,
    usdtReportYear,
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
    calculatedStats,
    monthlyClientRanking,
    handleExportUsdtReport,
    handleExportClientReport,
}: AnalyticsExportPanelProps) {
    const monthlyMonthOptions = reportMonths(usdtReportYear);
    const clientMonthOptions = reportMonths(reportYear);
    const selectedMonthLabel = monthlyMonthOptions[usdtReportMonth] || `${usdtReportMonth + 1}`;
    const selectedClientMonthLabel = clientMonthOptions[reportMonth] || `${reportMonth + 1}`;
    const selectedClient = clientsDzd.find((client) => client.id === reportClient) || null;
    const sortedClients = useMemo(() => [...clientsDzd].sort((a, b) => getClientFullName(a).localeCompare(getClientFullName(b), 'fr')), [clientsDzd, getClientFullName]);
    const monthlyTxCount = useMemo(() => {
        const startTs = new Date(usdtReportYear, usdtReportMonth, 1).getTime();
        const endTs = new Date(usdtReportYear, usdtReportMonth + 1, 0, 23, 59, 59, 999).getTime();
        return transactions.filter((tx) => tx.timestamp >= startTs && tx.timestamp <= endTs).length;
    }, [transactions, usdtReportMonth, usdtReportYear]);
    const clientPreview = useMemo(() => {
        if (!selectedClient) {
            return null;
        }

        const allRows = clientTransactionsDzd
            .filter((tx) => tx.clientId === selectedClient.id)
            .sort((a, b) => a.timestamp - b.timestamp);
        const startTs = new Date(reportYear, reportMonth, 1).getTime();
        const endTs = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59, 999).getTime();
        const periodRows = allRows.filter((tx) => tx.timestamp >= startTs && tx.timestamp <= endTs);
        const openingBalance = allRows
            .filter((tx) => tx.timestamp < startTs)
            .reduce((sum, tx) => sum + Number(tx.montant || 0), 0);
        const totalReceived = periodRows
            .filter((tx) => Number(tx.montant || 0) > 0)
            .reduce((sum, tx) => sum + Number(tx.montant || 0), 0);
        const totalPaid = periodRows
            .filter((tx) => Number(tx.montant || 0) < 0)
            .reduce((sum, tx) => sum + Math.abs(Number(tx.montant || 0)), 0);
        const periodNet = periodRows.reduce((sum, tx) => sum + Number(tx.montant || 0), 0);

        return {
            operations: periodRows.length,
            openingBalance,
            totalReceived,
            totalPaid,
            closingBalance: openingBalance + periodNet,
            hasData: periodRows.length > 0,
        };
    }, [selectedClient, clientTransactionsDzd, reportMonth, reportYear]);
    const cumulativeProfit = Number(portfolioStats.usdt.totalProfit || 0) + Number(portfolioStats.eur.totalProfit || 0);
    const topClient = monthlyClientRanking.topProfitableClient;

    return (
        <div className="space-y-3">
            <Card>
                <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-3">
                    <SectionHeading icon={<CalendarIcon className="h-4 w-4" />}>
                        {t('reports.monthlyReport')}
                    </SectionHeading>
                    <Badge variant={monthlyTxCount > 0 ? 'success' : 'warning'}>
                        {monthlyTxCount > 0 ? t('reports.dataAvailable') : t('reports.noData')}
                    </Badge>
                </CardHeader>

                <CardContent className="space-y-4 p-4 pt-0">
                    <div className="border-t border-border pt-4">
                        <p className="text-xs font-medium text-neutral-500">{selectedMonthLabel} {usdtReportYear}</p>
                        <div className="mt-2">
                            <CurrencyAmount value={calculatedStats.realizedProfit} currency="DZD" semantic="auto" showSign size="hero" decimals={2}/>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-neutral-500">{t('reports.realizedProfit')}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <MetricTile
                            label={t('reports.soldVolume')}
                            value={<span className="text-lg font-extrabold tabular-nums text-primary" dir="ltr">{formatNumber(calculatedStats.volUsdtSold + calculatedStats.volEurSold, { min: 0, max: 2 })}</span>}
                            hint={(
                                <span className="flex flex-wrap gap-1">
                                    <CurrencyAmount value={calculatedStats.volUsdtSold} currency="USDT" semantic="plain" size="sm" decimals={2}/>
                                    <span>/</span>
                                    <CurrencyAmount value={calculatedStats.volEurSold} currency="EUR" semantic="plain" size="sm" decimals={2}/>
                                </span>
                            )}
                        />
                        <MetricTile label={t('reports.operations')} value={<span className="text-lg font-extrabold text-warning">{monthlyTxCount}</span>} />
                        <MetricTile label={t('reports.cumulativeProfit')} value={<CurrencyAmount value={cumulativeProfit} currency="DZD" semantic="auto" size="lg" decimals={2}/>} />
                        <MetricTile
                            label={t('reports.topClient')}
                            value={topClient ? <span className="block truncate text-lg font-extrabold text-success">{topClient.clientName}</span> : <span className="text-neutral-500">-</span>}
                            hint={topClient ? <CurrencyAmount value={topClient.realizedProfit} currency="DZD" semantic="auto" size="sm" decimals={2}/> : t('reports.noLinkedClient')}
                        />
                    </div>

                    <Button type="button" onClick={handleExportUsdtReport} className="w-full gap-2">
                        <DownloadCloudIcon className="h-4 w-4" />
                        {t('reports.exportMonthly')}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-3">
                    <SectionHeading icon={<UsersIcon className="h-4 w-4" />}>
                        {t('reports.clientReport')}
                    </SectionHeading>
                    <Badge variant={reportClient ? 'success' : 'warning'}>
                        {reportClient ? t('reports.ready') : t('reports.clientRequired')}
                    </Badge>
                </CardHeader>

                <CardContent className="space-y-4 p-4 pt-0">
                    <div className="space-y-3">
                        <div>
                            <Label>{t('portfolio.clientName')}</Label>
                            <SearchableSelect
                                value={reportClient}
                                onChange={setReportClient}
                                options={sortedClients.map((client) => ({ value: client.id, label: getClientFullName(client) }))}
                                fieldClassName=""
                                searchPlaceholder={t('reports.searchClient')}
                                emptyOptionLabel={t('reports.selectClient')}
                                emptyValue=""
                                noResultsLabel={t('reports.noClientFound')}
                                clearable
                                clearLabel={t('reports.clearClient')}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>{t('portfolio.month')}</Label>
                                <Select value={reportMonth} onChange={(event) => setReportMonth(Number(event.target.value))} className="mt-1">
                                    {clientMonthOptions.map((monthName, index) => <option key={monthName} value={index}>{monthName}</option>)}
                                </Select>
                            </div>
                            <div>
                                <Label>{t('portfolio.year')}</Label>
                                <Select value={reportYear} onChange={(event) => setReportYear(Number(event.target.value))} className="mt-1">
                                    {reportYears.map((year) => <option key={year} value={year}>{year}</option>)}
                                </Select>
                            </div>
                        </div>
                    </div>

                    {clientPreview ? (
                        <>
                            <div className="border-t border-border pt-4">
                                <p className="text-xs font-medium text-neutral-500">{t('reports.closingBalance')}</p>
                                <div className="mt-2">
                                    <CurrencyAmount value={clientPreview.closingBalance} currency="DZD" semantic="auto" size="hero" decimals={2}/>
                                </div>
                                <p className="mt-1 text-sm font-semibold text-neutral-500">{selectedClientMonthLabel} {reportYear}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <MetricTile label={t('reports.openingBalance')} value={<CurrencyAmount value={clientPreview.openingBalance} currency="DZD" semantic="auto" size="lg" decimals={2}/>} />
                                <MetricTile label={t('reports.totalReceived')} value={<CurrencyAmount value={clientPreview.totalReceived} currency="DZD" semantic="profit" size="lg" decimals={2}/>} hint={<WalletIcon className="h-4 w-4 text-success" />} />
                                <MetricTile label={t('reports.totalPaid')} value={<CurrencyAmount value={clientPreview.totalPaid} currency="DZD" semantic="loss" size="lg" decimals={2}/>} />
                                <MetricTile label={t('reports.operations')} value={<span className="text-lg font-extrabold text-warning">{clientPreview.operations}</span>} />
                            </div>
                        </>
                    ) : (
                        <EmptyState title={t('reports.selectClientPreview')} className="rounded-lg bg-surface-muted" />
                    )}

                    {selectedClient && clientPreview && !clientPreview.hasData && (
                        <div className="rounded-lg bg-warning-bg px-3 py-2 text-sm font-semibold text-warning">
                            {t('reports.noClientMovementStart')} {selectedClientMonthLabel} {reportYear}. {t('reports.noClientMovementEnd')}
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleExportClientReport(reportClient, reportMonth, reportYear)}
                        disabled={!reportClient}
                        className="w-full gap-2"
                    >
                        <DownloadCloudIcon className="h-4 w-4" />
                        {t('reports.exportClient')}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

function MetricTile({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
    return (
        <div className="rounded-lg border border-border bg-surface-muted p-3">
            <p className="text-xs font-medium text-neutral-500">{label}</p>
            <div className="mt-2">{value}</div>
            {hint && <div className="mt-1 text-xs font-semibold text-neutral-500">{hint}</div>}
        </div>
    );
}
