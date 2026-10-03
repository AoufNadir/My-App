import { useMemo, useState, type ReactNode } from 'react';
import { SectionCard } from '../cards';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { ManualAssetClient, ManualAssetTransaction } from '../../types';
import { describeServiceBalance, getServiceBalanceLabel } from '../../utils/serviceBalances';
import { useLanguage } from '../../contexts/LanguageContext';
type ManualAssetReportsSectionProps = {
    assetId: string;
    assetName: string;
    clients: ManualAssetClient[];
    assetTransactions: ManualAssetTransaction[];
    clientBalances: Map<string, number>;
    /** Report shown first; monthly unless a test or a link asks for the year. */
    initialView?: ReportView;
};
type ClientPerformanceRow = {
    clientId: string;
    clientName: string;
    serviceRevenue: number;
    cashReceived: number;
    currentBalance: number;
    operationsCount: number;
    servicesCount: number;
};
type PeriodReport = {
    serviceRevenue: number;
    cashReceived: number;
    activeClientsCount: number;
    topProfitableClient: ClientPerformanceRow | null;
    topActiveClient: ClientPerformanceRow | null;
    topClients: ClientPerformanceRow[];
};
type ReportView = 'monthly' | 'annual';
const MONTH_LABELS = [
    'janvier',
    'fevrier',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'aout',
    'septembre',
    'octobre',
    'novembre',
    'decembre'
];
const EMPTY_REPORT: PeriodReport = {
    serviceRevenue: 0,
    cashReceived: 0,
    activeClientsCount: 0,
    topProfitableClient: null,
    topActiveClient: null,
    topClients: []
};
function isServiceLike(tx: ManualAssetTransaction) {
    return tx.type === 'service' || tx.type === 'invoice';
}
function shouldCountForActivity(tx: ManualAssetTransaction) {
    return tx.type !== 'adjustment';
}
function buildPeriodReport({ assetId, assetTransactions, clientsById, clientBalances, startTs, endTs }: {
    assetId: string;
    assetTransactions: ManualAssetTransaction[];
    clientsById: Map<string, ManualAssetClient>;
    clientBalances: Map<string, number>;
    startTs: number;
    endTs: number;
}): PeriodReport {
    const rows = new Map<string, ClientPerformanceRow>();
    for (const tx of assetTransactions) {
        if (tx.timestamp < startTs || tx.timestamp > endTs)
            continue;
        if (!shouldCountForActivity(tx))
            continue;
        const row = rows.get(tx.clientId) || {
            clientId: tx.clientId,
            clientName: clientsById.get(tx.clientId)?.fullName || 'Client inconnu',
            serviceRevenue: 0,
            cashReceived: 0,
            currentBalance: clientBalances.get(`${assetId}_${tx.clientId}`) || 0,
            operationsCount: 0,
            servicesCount: 0
        };
        row.operationsCount += 1;
        if (isServiceLike(tx)) {
            row.serviceRevenue += Math.abs(Number(tx.amount || 0));
            row.servicesCount += 1;
        }
        if (tx.type === 'payment_received') {
            row.cashReceived += Math.abs(Number(tx.amount || 0));
        }
        rows.set(tx.clientId, row);
    }
    const byProfit = Array.from(rows.values()).sort((left, right) => {
        if (right.serviceRevenue !== left.serviceRevenue)
            return right.serviceRevenue - left.serviceRevenue;
        if (right.cashReceived !== left.cashReceived)
            return right.cashReceived - left.cashReceived;
        if (right.operationsCount !== left.operationsCount)
            return right.operationsCount - left.operationsCount;
        return left.clientName.localeCompare(right.clientName, 'fr');
    });
    if (byProfit.length === 0)
        return EMPTY_REPORT;
    const byActivity = [...byProfit].sort((left, right) => {
        if (right.operationsCount !== left.operationsCount)
            return right.operationsCount - left.operationsCount;
        if (right.serviceRevenue !== left.serviceRevenue)
            return right.serviceRevenue - left.serviceRevenue;
        return left.clientName.localeCompare(right.clientName, 'fr');
    });
    return {
        serviceRevenue: byProfit.reduce((sum, row) => sum + row.serviceRevenue, 0),
        cashReceived: byProfit.reduce((sum, row) => sum + row.cashReceived, 0),
        activeClientsCount: byProfit.length,
        topProfitableClient: byProfit[0] || null,
        topActiveClient: byActivity[0] || null,
        topClients: byProfit.slice(0, 5)
    };
}
function StatCard({ label, value, hint, valueClassName = '' }: {
    label: string;
    value: ReactNode;
    hint: ReactNode;
    valueClassName?: string;
}) {
    return (<div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
      <p className="line-clamp-2 break-words text-xs font-semibold leading-snug text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-[15px] font-bold leading-tight text-neutral-900 ${valueClassName}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>
    </div>);
}
function RankedClientsBlock({ title, totalClients, rows, t }: {
    title: string;
    totalClients: number;
    rows: ClientPerformanceRow[];
    t: (key: string) => any;
}) {
    return (<div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold text-neutral-500">{title}</h3>
        <span className="shrink-0 text-xs text-neutral-500">{totalClients} {t('services.activeClients')}</span>
      </div>

      {rows.length > 0 ? (<ol className="mt-1">
          {rows.map((row, index) => {
            const balanceView = describeServiceBalance(row.currentBalance);
            const balanceSemantic = balanceView.kind === 'to_receive'
                ? 'profit'
                : balanceView.kind === 'client_advance'
                    ? 'loss'
                    : 'plain';
            return (<li key={row.clientId} className="flex items-start gap-3 border-t border-border py-2.5 first:border-t-0">
              <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-neutral-600">{index + 1}</span>
              <div className="min-w-0 flex-1">
                {/* Name and amount billed on the first line; the details use the full width below. */}
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words pt-0.5 text-sm font-semibold leading-tight text-neutral-900">
                    <span className="sr-only">{index + 1}. </span>{row.clientName}
                  </p>
                  <span className="shrink-0">
                    <CurrencyAmount value={row.serviceRevenue} currency="DZD" semantic="profit" size="md" decimals={2} className="font-semibold"/>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {row.operationsCount} {t('services.operationsShort')} · {row.servicesCount} {t('services.servicesShort')}
                </p>
                <p className="mt-0.5 text-xs leading-4 text-neutral-500">
                  {t('services.collected')}: <CurrencyAmount value={row.cashReceived} currency="DZD" semantic="profit" size="sm" decimals={2}/>
                </p>
                <p className="text-xs leading-4 text-neutral-500">
                  {getServiceBalanceLabel(balanceView.kind, t)}: <CurrencyAmount value={balanceView.amount} currency="DZD" semantic={balanceSemantic} size="sm" decimals={2}/>
                </p>
              </div>
            </li>);
        })}
        </ol>) : (<p className="mt-2 rounded-button border border-dashed border-border-strong p-4 text-center text-sm text-neutral-500">
          {t('services.noDataPeriod')}
        </p>)}
    </div>);
}
function ReportCard({ subtitle, topTitle, report, t }: {
    subtitle: string;
    topTitle: string;
    report: PeriodReport;
    t: (key: string) => any;
}) {
    return (<div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-neutral-900">{subtitle}</p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label={t('services.servicesBilled')} value={<CurrencyAmount value={report.serviceRevenue} currency="DZD" semantic="profit" size="lg" decimals={2}/>} hint={`${report.activeClientsCount} ${t('services.activeClients')}`}/>

        <StatCard label={t('services.collected')} value={<CurrencyAmount value={report.cashReceived} currency="DZD" semantic="profit" size="lg" decimals={2}/>} hint={t('transactions.paymentReceived')}/>

        <StatCard label={t('services.topBilledClient')} value={report.topProfitableClient?.clientName || t('services.noClient')} hint={report.topProfitableClient ? <CurrencyAmount value={report.topProfitableClient.serviceRevenue} currency="DZD" semantic="profit" size="sm" decimals={2}/> : t('services.noServiceBilled')} valueClassName="break-words"/>

        <StatCard label={t('services.topActiveClient')} value={report.topActiveClient?.clientName || t('services.noClient')} hint={report.topActiveClient ? `${report.topActiveClient.operationsCount} ${t('services.operationsShort')}` : t('services.noActivity')} valueClassName="break-words"/>
      </div>

      <RankedClientsBlock title={topTitle} totalClients={report.activeClientsCount} rows={report.topClients} t={t}/>
    </div>);
}
export function ManualAssetReportsSection({ assetId, assetName, clients, assetTransactions, clientBalances, initialView = 'monthly' }: ManualAssetReportsSectionProps) {
    const { t } = useLanguage();
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [reportView, setReportView] = useState<ReportView>(initialView);
    const availableYears = useMemo(() => {
        const years = new Set<number>([currentYear]);
        assetTransactions.forEach((tx) => {
            const year = new Date(tx.timestamp).getFullYear();
            if (Number.isFinite(year))
                years.add(year);
        });
        return Array.from(years).sort((left, right) => right - left);
    }, [assetTransactions, currentYear]);
    const clientsById = useMemo(() => {
        const map = new Map<string, ManualAssetClient>();
        clients.forEach((client) => map.set(client.id, client));
        return map;
    }, [clients]);
    const monthlyReport = useMemo(() => {
        const startTs = new Date(selectedYear, selectedMonth, 1).getTime();
        const endTs = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).getTime();
        return buildPeriodReport({
            assetId,
            assetTransactions,
            clientsById,
            clientBalances,
            startTs,
            endTs
        });
    }, [assetId, assetTransactions, clientBalances, clientsById, selectedMonth, selectedYear]);
    const annualReport = useMemo(() => {
        const startTs = new Date(selectedYear, 0, 1).getTime();
        const endTs = new Date(selectedYear, 11, 31, 23, 59, 59, 999).getTime();
        return buildPeriodReport({
            assetId,
            assetTransactions,
            clientsById,
            clientBalances,
            startTs,
            endTs
        });
    }, [assetId, assetTransactions, clientBalances, clientsById, selectedYear]);
    const activeReport = reportView === 'monthly' ? monthlyReport : annualReport;
    const monthLabels = t('common.months') as string[];
    const monthLabel = (index: number) => monthLabels?.[index] || MONTH_LABELS[index];
    const activeSubtitle = reportView === 'monthly'
        ? `${monthLabel(selectedMonth)} ${selectedYear}`
        : `${t('portfolio.year')} ${selectedYear}`;
    const activeTopTitle = reportView === 'monthly' ? t('services.topBilledMonthly') : t('services.topBilledAnnual');
    return (<SectionCard title={t('services.clientReport')}>
      <div className="flex flex-col gap-3">
        <p className="-mt-1 text-xs leading-relaxed text-neutral-500">
          {String(t('services.clientReportSubtitle')).replace('{assetName}', assetName)}
        </p>

        <Tabs variant="pills" tabs={[
            { id: 'monthly', label: t('services.monthly') as string },
            { id: 'annual', label: t('services.annual') as string },
        ]} activeTab={reportView} onChange={(id) => setReportView(id === 'annual' ? 'annual' : 'monthly')}/>

        <div className={`grid gap-2 ${reportView === 'monthly' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {reportView === 'monthly' && (<Select label={t('portfolio.month') as string} id={`service-report-month-${assetId}`} value={String(selectedMonth)} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              {MONTH_LABELS.map((month, index) => (<option key={month} value={index}>{monthLabel(index)}</option>))}
            </Select>)}
          <Select label={t('portfolio.year') as string} id={`service-report-year-${assetId}`} value={String(selectedYear)} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {availableYears.map((year) => (<option key={year} value={year}>{year}</option>))}
          </Select>
        </div>

        <ReportCard subtitle={activeSubtitle} topTitle={activeTopTitle} report={activeReport} t={t}/>
      </div>
    </SectionCard>);
}
