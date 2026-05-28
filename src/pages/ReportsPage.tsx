import { useMemo, type ReactNode } from 'react';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { PageHeader } from '../components/ui/PageHeader';
import { MoneyText } from '../components/ui/MoneyText';
import { Button } from '../components/ui/Button';
import { SectionHeading } from '../components/ui/SectionHeading';
import { FileSpreadsheetIcon } from '../components/icons/FileSpreadsheetIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { useLanguage } from '../contexts/LanguageContext';
import type { ClientDzd, ClientTransactionDzd, PortfolioStats, Tx } from '../types';
import { computePamLedger } from '../utils/pamLedger';
import { formatNumber } from './shared/pageFormat';
type ReportsPageProps = {
    cardBase: string;
    subtleText: string;
    fieldBase: string;
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
};
function buildLinkedClientMap(clientTransactions: ClientTransactionDzd[]) {
    const map = new Map<string, {
        clientId: string;
        timestamp: number;
        isSecondary: boolean;
    }>();
    for (const row of clientTransactions) {
        if (!row.linkedTxId || !row.clientId)
            continue;
        const isSecondary = row.linkRole === 'dzd_receiver';
        const existing = map.get(row.linkedTxId);
        if (!existing || (existing.isSecondary && !isSecondary) || (existing.isSecondary === isSecondary && row.timestamp > existing.timestamp)) {
            map.set(row.linkedTxId, { clientId: row.clientId, timestamp: row.timestamp, isSecondary });
        }
    }
    return map;
}
export function ReportsPage({ usdtReportMonth, setUsdtReportMonth, usdtReportYear, setUsdtReportYear, reportMonths, reportYears, reportClient, setReportClient, reportMonth, setReportMonth, reportYear, setReportYear, clientsDzd, clientTransactionsDzd, transactions, portfolioStats, getClientFullName, handleExportUsdtReport, handleExportClientReport }: ReportsPageProps) {
    const { t } = useLanguage();
    const monthlyMonthOptions = reportMonths(usdtReportYear);
    const clientMonthOptions = reportMonths(reportYear);
    const selectedMonthLabel = monthlyMonthOptions[usdtReportMonth] || `${usdtReportMonth + 1}`;
    const selectedClientMonthLabel = clientMonthOptions[reportMonth] || `${reportMonth + 1}`;
    const sortedClients = useMemo(() => [...clientsDzd].sort((a, b) => getClientFullName(a).localeCompare(getClientFullName(b), 'fr')), [clientsDzd, getClientFullName]);
    const selectedClient = clientsDzd.find((client) => client.id === reportClient) || null;
    const monthlyPreview = useMemo(() => {
        const startTs = new Date(usdtReportYear, usdtReportMonth, 1).getTime();
        const endTs = new Date(usdtReportYear, usdtReportMonth + 1, 0, 23, 59, 59, 999).getTime();
        const pamLedger = computePamLedger(transactions);
        const linkedClientMap = buildLinkedClientMap(clientTransactionsDzd);
        const clientNameById = new Map(clientsDzd.map((client) => [client.id, getClientFullName(client)]));
        const clientProfit = new Map<string, {
            name: string;
            profit: number;
            count: number;
        }>();
        let volUsdtBought = 0;
        let volUsdtSold = 0;
        let volEurBought = 0;
        let volEurSold = 0;
        let realizedProfit = 0;
        let txCount = 0;
        for (const tx of transactions) {
            if (tx.timestamp < startTs || tx.timestamp > endTs)
                continue;
            txCount += 1;
            if (tx.currency === 'USDT' && tx.type === 'buy')
                volUsdtBought += Number(tx.quantity || 0);
            if (tx.currency === 'USDT' && tx.type === 'sell')
                volUsdtSold += Number(tx.quantity || 0);
            if (tx.currency === 'EUR' && tx.type === 'buy')
                volEurBought += Number(tx.quantity || 0);
            if (tx.currency === 'EUR' && tx.type === 'sell')
                volEurSold += Number(tx.quantity || 0);
            if (tx.type !== 'sell')
                continue;
            const profit = tx.id ? Number(pamLedger.profitByTxId[tx.id]?.derivedProfit || 0) : 0;
            realizedProfit += profit;
            const linked = tx.id ? linkedClientMap.get(tx.id) : undefined;
            if (!linked)
                continue;
            const row = clientProfit.get(linked.clientId) || {
                name: clientNameById.get(linked.clientId) || 'Client inconnu',
                profit: 0,
                count: 0
            };
            row.profit += profit;
            row.count += 1;
            clientProfit.set(linked.clientId, row);
        }
        const topClient = [...clientProfit.values()].sort((a, b) => b.profit - a.profit)[0] || null;
        const hasData = txCount > 0 || realizedProfit !== 0;
        return { volUsdtBought, volUsdtSold, volEurBought, volEurSold, realizedProfit, txCount, topClient, hasData };
    }, [transactions, clientTransactionsDzd, clientsDzd, getClientFullName, usdtReportMonth, usdtReportYear]);
    const clientPreview = useMemo(() => {
        if (!selectedClient)
            return null;
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
            hasData: periodRows.length > 0
        };
    }, [selectedClient, clientTransactionsDzd, reportMonth, reportYear]);
    const cumulativeProfit = Number(portfolioStats.usdt.totalProfit || 0) + Number(portfolioStats.eur.totalProfit || 0);
    const soldVolumeTotal = monthlyPreview.volUsdtSold + monthlyPreview.volEurSold;
    return (<div className="anim-page-in space-y-4">
      <PageHeader title={t('reports.title')} subtitle={`${selectedMonthLabel} ${usdtReportYear}`} actions={<FileSpreadsheetIcon className="h-5 w-5 text-primary"/>}/>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-3">
              <SectionHeading icon={<CalendarIcon className="h-4 w-4"/>}>
                {t('reports.monthlyReport')}
              </SectionHeading>
              <Badge variant={monthlyPreview.hasData ? 'success' : 'warning'}>
                {monthlyPreview.hasData ? t('reports.dataAvailable') : t('reports.noData')}
              </Badge>
          </CardHeader>

          <CardContent className="space-y-4 p-4 pt-0">
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <Label>{t('portfolio.month')}</Label>
                <Select value={usdtReportMonth} onChange={(event) => setUsdtReportMonth(Number(event.target.value))} className="mt-1">
                  {monthlyMonthOptions.map((monthName, index) => <option key={monthName} value={index}>{monthName}</option>)}
                </Select>
              </div>
              <div>
                <Label>{t('portfolio.year')}</Label>
                <Select value={usdtReportYear} onChange={(event) => setUsdtReportYear(Number(event.target.value))} className="mt-1">
                  {reportYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </Select>
              </div>
            </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{selectedMonthLabel} {usdtReportYear}</p>
            <div className="mt-2">
              <MoneyText value={monthlyPreview.realizedProfit} currency="DZD" semantic="auto" showSign size="hero" className="text-3xl sm:text-4xl"/>
            </div>
            <p className="mt-1 text-sm font-semibold text-neutral-500">{t('reports.realizedProfit')}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricTile
              label={t('reports.soldVolume')}
              value={<span className="text-lg font-extrabold tabular-nums text-primary" dir="ltr">{formatNumber(soldVolumeTotal, { min: 0, max: 2 })}</span>}
              hint={<span className="flex flex-wrap gap-1"><MoneyText value={monthlyPreview.volUsdtSold} currency="USDT" semantic="plain" size="sm" min={0} max={2}/><span>/</span><MoneyText value={monthlyPreview.volEurSold} currency="EUR" semantic="plain" size="sm" min={0} max={2}/></span>}
            />
            <MetricTile label={t('reports.operations')} value={<span className="text-lg font-extrabold text-warning" dir="ltr">{monthlyPreview.txCount}</span>}/>
            <MetricTile label={t('reports.cumulativeProfit')} value={<MoneyText value={cumulativeProfit} currency="DZD" semantic="auto" size="lg"/>}/>
            <MetricTile label={t('reports.topClient')} value={monthlyPreview.topClient ? <span className="block truncate text-lg font-extrabold text-success">{monthlyPreview.topClient.name}</span> : <span className="text-neutral-500">-</span>} hint={monthlyPreview.topClient ? <MoneyText value={monthlyPreview.topClient.profit} currency="DZD" semantic="auto" size="sm" min={2} max={2}/> : t('reports.noLinkedClient')}/>
          </div>

            <Button onClick={handleExportUsdtReport} className="w-full gap-2">
              <DownloadCloudIcon className="h-4 w-4"/>
              {t('reports.exportMonthly')}
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-3">
              <SectionHeading icon={<UsersIcon className="h-4 w-4"/>}>
                {t('reports.clientReport')}
              </SectionHeading>
              <Badge variant={reportClient ? 'success' : 'warning'}>
                {reportClient ? t('reports.ready') : t('reports.clientRequired')}
              </Badge>
          </CardHeader>

          <CardContent className="space-y-4 p-4 pt-0">
            <div className="mt-4 space-y-3">
              <div>
                <Label>{t('portfolio.clientName')}</Label>
                <SearchableSelect value={reportClient} onChange={setReportClient} options={sortedClients.map((client) => ({ value: client.id, label: getClientFullName(client) }))} fieldClassName="" searchPlaceholder={t('reports.searchClient')} emptyOptionLabel={t('reports.selectClient')} emptyValue="" noResultsLabel={t('reports.noClientFound')} clearable clearLabel={t('reports.clearClient')}/>
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

          {clientPreview ? (<>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('reports.closingBalance')}</p>
                <div className="mt-2">
                  <MoneyText value={clientPreview.closingBalance} currency="DZD" semantic="auto" size="hero" className="text-3xl sm:text-4xl"/>
                </div>
                <p className="mt-1 text-sm font-semibold text-neutral-500">{selectedClientMonthLabel} {reportYear}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MetricTile label={t('reports.openingBalance')} value={<MoneyText value={clientPreview.openingBalance} currency="DZD" semantic="auto" size="lg"/>}/>
                <MetricTile label={t('reports.totalReceived')} value={<MoneyText value={clientPreview.totalReceived} currency="DZD" semantic="profit" size="lg"/>} hint={<WalletIcon className="h-4 w-4 text-success"/>}/>
                <MetricTile label={t('reports.totalPaid')} value={<MoneyText value={clientPreview.totalPaid} currency="DZD" semantic="loss" size="lg"/>}/>
                <MetricTile label={t('reports.operations')} value={<span className="text-lg font-extrabold text-warning" dir="ltr">{clientPreview.operations}</span>}/>
              </div>
            </>) : (<div>
              <EmptyState title={t('reports.selectClientPreview')} className="rounded-lg bg-surface-muted"/>
            </div>)}

          {selectedClient && clientPreview && !clientPreview.hasData && (<div className="rounded-lg bg-warning-bg px-3 py-2 text-sm font-semibold text-warning">
                {t('reports.noClientMovementStart')} {selectedClientMonthLabel} {reportYear}. {t('reports.noClientMovementEnd')}
            </div>)}

            <Button variant="secondary" onClick={() => handleExportClientReport(reportClient, reportMonth, reportYear)} disabled={!reportClient} className="w-full gap-2">
              <DownloadCloudIcon className="h-4 w-4"/>
              {t('reports.exportClient')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>);
}

function MetricTile({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
    return (<div className="rounded-lg border border-border bg-surface-muted p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="mt-2 leading-tight">{value}</div>
      {hint && <div className="mt-1 text-xs font-semibold text-neutral-500">{hint}</div>}
    </div>);
}
