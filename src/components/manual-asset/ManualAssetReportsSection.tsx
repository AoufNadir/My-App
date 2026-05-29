import { useMemo, useState, type ReactNode } from 'react';
import { CalendarIcon } from '../icons/CalendarIcon';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { SectionHeading } from '../ui/SectionHeading';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { ManualAssetClient, ManualAssetTransaction } from '../../types';
import { describeServiceBalance, getServiceBalanceLabel } from '../../utils/serviceBalances';
type ManualAssetReportsSectionProps = {
    assetId: string;
    assetName: string;
    clients: ManualAssetClient[];
    assetTransactions: ManualAssetTransaction[];
    clientBalances: Map<string, number>;
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
    return (<div className="rounded-xl border border-border bg-surface-muted px-3 py-2">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`mt-1 text-base font-bold leading-tight text-neutral-900 ${valueClassName}`}>{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{hint}</p>
    </div>);
}
function RankedClientsBlock({ title, totalClients, rows }: {
    title: string;
    totalClients: number;
    rows: ClientPerformanceRow[];
}) {
    return (<div className="rounded-xl border border-border bg-surface-muted p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold leading-tight text-neutral-900">{title}</h4>
        <span className={`text-[12px] text-neutral-500`}>{totalClients} clients</span>
      </div>

      {rows.length > 0 ? (<div className="mt-3 space-y-2">
          {rows.map((row, index) => {
            const balanceView = describeServiceBalance(row.currentBalance);
            const balanceSemantic = balanceView.kind === 'to_receive'
                ? 'profit'
                : balanceView.kind === 'client_advance'
                    ? 'loss'
                    : 'plain';
            return (<div key={row.clientId} className="rounded-lg border border-border bg-surface px-3 py-2">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight text-neutral-900">
                    {index + 1}. {row.clientName}
                  </p>
                  <p className={`mt-1 text-[12px] text-neutral-500`}>
                    {row.operationsCount} ops . {row.servicesCount} services
                  </p>
                </div>

                <div className="min-w-[120px] shrink-0 text-end">
                  <p className="text-sm font-bold leading-tight">
                    <CurrencyAmount value={row.serviceRevenue} currency="DZD" semantic="profit" size="md" decimals={2}/>
                  </p>
                  <p className={`mt-1 text-[12px] leading-4 text-neutral-500`}>
                    Encaisse: <CurrencyAmount value={row.cashReceived} currency="DZD" semantic="profit" size="sm" decimals={2}/>
                  </p>
                  <p className={`text-[12px] leading-4 text-neutral-500`}>
                    {getServiceBalanceLabel(balanceView.kind)}: <CurrencyAmount value={balanceView.amount} currency="DZD" semantic={balanceSemantic} size="sm" decimals={2}/>
                  </p>
                </div>
              </div>
            </div>);
        })}
        </div>) : (<div className="mt-3 rounded-xl border border-dashed border-border-strong p-4 text-center text-sm text-neutral-400">
          Aucune donnee disponible pour cette periode.
        </div>)}
    </div>);
}
function ReportCard({ title, subtitle, topTitle, report }: {
    title: string;
    subtitle: string;
    topTitle: string;
    report: PeriodReport;
}) {
    return (<section className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold leading-tight text-neutral-900">{title}</h3>
          <p className={`mt-1 text-sm text-neutral-500`}>{subtitle}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-muted p-2.5 text-neutral-600">
          <CalendarIcon className="w-4 h-4"/>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="space-y-2">
          <StatCard label="CA Services" value={<CurrencyAmount value={report.serviceRevenue} currency="DZD" semantic="profit" size="lg" decimals={2}/>} hint={`${report.activeClientsCount} clients actifs`}/>

          <StatCard label="Encaissements" value={<CurrencyAmount value={report.cashReceived} currency="DZD" semantic="profit" size="lg" decimals={2}/>} hint="Paiements recus"/>
        </div>

        <div className="space-y-2">
          <StatCard label="Client rentable" value={report.topProfitableClient?.clientName || 'Aucun client'} hint={report.topProfitableClient ? <CurrencyAmount value={report.topProfitableClient.serviceRevenue} currency="DZD" semantic="profit" size="sm" decimals={2}/> : 'Pas encore de ventes'} valueClassName="break-words"/>

          <StatCard label="Client actif" value={report.topActiveClient?.clientName || 'Aucun client'} hint={report.topActiveClient ? `${report.topActiveClient.operationsCount} operations` : 'Pas encore d activite'} valueClassName="break-words"/>
        </div>

        <RankedClientsBlock title={topTitle} totalClients={report.activeClientsCount} rows={report.topClients}/>
      </div>
    </section>);
}
export function ManualAssetReportsSection({ assetId, assetName, clients, assetTransactions, clientBalances }: ManualAssetReportsSectionProps) {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [reportView, setReportView] = useState<ReportView>('monthly');
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
    const selectClassName = 'mt-2 min-h-touch rounded-lg px-3 text-sm';
    const activeReport = reportView === 'monthly' ? monthlyReport : annualReport;
    const activeTitle = reportView === 'monthly' ? 'Rapport Mensuel' : 'Rapport Annuel';
    const activeSubtitle = reportView === 'monthly'
        ? `${MONTH_LABELS[selectedMonth]} ${selectedYear}`
        : `Annee ${selectedYear}`;
    const activeTopTitle = reportView === 'monthly' ? 'Top 5 du mois' : 'Top 5 de l annee';
    const pillBase = 'min-h-touch rounded-lg px-3 font-bold text-sm';
    return (<section className="space-y-3">
      <div>
        <SectionHeading icon={<TrendingUpIcon className="w-4 h-4"/>}>
          Rapport Clients
        </SectionHeading>
        <p className={`mt-1 max-w-[32rem] text-sm leading-6 text-neutral-500`}>
          Suivi du chiffre de service, des encaissements et des clients les plus rentables pour {assetName}.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-3">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label>Mois</Label>
            <Select value={String(selectedMonth)} onChange={(e) => setSelectedMonth(Number(e.target.value))} className={selectClassName}>
              {MONTH_LABELS.map((month, index) => (<option key={month} value={index}>{month}</option>))}
            </Select>
          </div>

          <div>
            <Label>Annee</Label>
            <Select value={String(selectedYear)} onChange={(e) => setSelectedYear(Number(e.target.value))} className={selectClassName}>
              {availableYears.map((year) => (<option key={year} value={year}>{year}</option>))}
            </Select>
          </div>
        </div>
      </div>

      <div className="inline-flex w-full rounded-xl border border-border bg-neutral-100 p-1">
        <Button onClick={() => setReportView('monthly')} className={`flex-1 ${pillBase} ${reportView === 'monthly'
            ? 'bg-success text-white shadow-sm'
            : 'bg-transparent text-neutral-600 hover:bg-surface'}`}>
          Mensuel
        </Button>
        <Button onClick={() => setReportView('annual')} className={`flex-1 ${pillBase} ${reportView === 'annual'
            ? 'bg-success text-white shadow-sm'
            : 'bg-transparent text-neutral-600 hover:bg-surface'}`}>
          Annuel
        </Button>
      </div>

      <ReportCard title={activeTitle} subtitle={activeSubtitle} topTitle={activeTopTitle} report={activeReport}/>
    </section>);
}
