import { useMemo, useState } from 'react';
import { CalendarIcon } from '../icons/CalendarIcon';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { ManualAssetClient, ManualAssetTransaction } from '../../types';
import { formatDzd } from '../../pages/shared/pageFormat';

type ManualAssetReportsSectionProps = {
  assetId: string;
  assetName: string;
  clients: ManualAssetClient[];
  assetTransactions: ManualAssetTransaction[];
  clientBalances: Map<string, number>;
  isDark: boolean;
  subtleText: string;
  fieldBase: string;
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

function buildPeriodReport({
  assetId,
  assetTransactions,
  clientsById,
  clientBalances,
  startTs,
  endTs
}: {
  assetId: string;
  assetTransactions: ManualAssetTransaction[];
  clientsById: Map<string, ManualAssetClient>;
  clientBalances: Map<string, number>;
  startTs: number;
  endTs: number;
}): PeriodReport {
  const rows = new Map<string, ClientPerformanceRow>();

  for (const tx of assetTransactions) {
    if (tx.timestamp < startTs || tx.timestamp > endTs) continue;
    if (!shouldCountForActivity(tx)) continue;

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
    if (right.serviceRevenue !== left.serviceRevenue) return right.serviceRevenue - left.serviceRevenue;
    if (right.cashReceived !== left.cashReceived) return right.cashReceived - left.cashReceived;
    if (right.operationsCount !== left.operationsCount) return right.operationsCount - left.operationsCount;
    return left.clientName.localeCompare(right.clientName, 'fr');
  });

  if (byProfit.length === 0) return EMPTY_REPORT;

  const byActivity = [...byProfit].sort((left, right) => {
    if (right.operationsCount !== left.operationsCount) return right.operationsCount - left.operationsCount;
    if (right.serviceRevenue !== left.serviceRevenue) return right.serviceRevenue - left.serviceRevenue;
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

function StatCard({
  label,
  value,
  hint,
  isDark,
  valueClassName = ''
}: {
  label: string;
  value: string;
  hint: string;
  isDark: boolean;
  valueClassName?: string;
}) {
  return (
    <div className={`rounded-[18px] border px-3.5 py-3 ${isDark ? 'border-slate-600/60 bg-[#111a2a]' : 'border-slate-200 bg-slate-50'} shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
      <p className={`mt-2 font-black leading-[1.08] tracking-tight text-white ${valueClassName}`}>{value}</p>
      <p className={`mt-1 text-[12px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{hint}</p>
    </div>
  );
}

function RankedClientsBlock({
  title,
  totalClients,
  rows,
  isDark,
  subtleText
}: {
  title: string;
  totalClients: number;
  rows: ClientPerformanceRow[];
  isDark: boolean;
  subtleText: string;
}) {
  return (
    <div className={`rounded-[22px] border p-3.5 ${isDark ? 'border-slate-600/60 bg-[#1a2638]' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[1.12rem] font-black leading-tight text-white">{title}</h4>
        <span className={`text-[12px] ${subtleText}`}>{totalClients} clients</span>
      </div>

      {rows.length > 0 ? (
        <div className="mt-3 space-y-2.5">
          {rows.map((row, index) => (
            <div
              key={row.clientId}
              className={`rounded-[18px] border px-3 py-2.5 ${isDark ? 'border-slate-700/70 bg-[#091121]' : 'border-slate-200 bg-white'}`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                <div className="min-w-0">
                  <p className="text-[0.95rem] font-black leading-tight text-white">
                    {index + 1}. {row.clientName}
                  </p>
                  <p className={`mt-1 text-[12px] ${subtleText}`}>
                    {row.operationsCount} ops . {row.servicesCount} services
                  </p>
                </div>

                <div className="min-w-[120px] shrink-0 text-right">
                  <p className="text-[0.95rem] font-black leading-tight text-emerald-400">
                    {formatDzd(row.serviceRevenue, { min: 2, max: 2 })}
                  </p>
                  <p className={`mt-1 text-[12px] leading-4 ${subtleText}`}>
                    Encaisse: {formatDzd(row.cashReceived, { min: 2, max: 2 })}
                  </p>
                  <p className={`text-[12px] leading-4 ${subtleText}`}>
                    Solde: {formatDzd(row.currentBalance, { min: 2, max: 2 })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`mt-4 rounded-[20px] border border-dashed p-5 text-center text-sm ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
          Aucune donnee disponible pour cette periode.
        </div>
      )}
    </div>
  );
}

function ReportCard({
  title,
  subtitle,
  topTitle,
  report,
  isDark,
  subtleText
}: {
  title: string;
  subtitle: string;
  topTitle: string;
  report: PeriodReport;
  isDark: boolean;
  subtleText: string;
}) {
  return (
    <section className={`rounded-[24px] border p-3.5 ${isDark ? 'border-slate-600/70 bg-[linear-gradient(180deg,#223047_0%,#1c283b_100%)]' : 'border-slate-200 bg-white'} shadow-[0_24px_60px_rgba(2,6,23,0.18),inset_0_1px_0_rgba(255,255,255,0.03)]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.45rem] font-black leading-tight tracking-tight text-white">{title}</h3>
          <p className={`mt-1 text-sm ${subtleText}`}>{subtitle}</p>
        </div>
        <div className={`rounded-[16px] border p-2.5 ${isDark ? 'border-slate-600/60 bg-[#162133] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
          <CalendarIcon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3.5 space-y-2.5">
        <div className="space-y-2.5">
          <StatCard
            label="CA Services"
            value={formatDzd(report.serviceRevenue, { min: 2, max: 2 })}
            hint={`${report.activeClientsCount} clients actifs`}
            isDark={isDark}
            valueClassName="text-[1.28rem]"
          />

          <StatCard
            label="Encaissements"
            value={formatDzd(report.cashReceived, { min: 2, max: 2 })}
            hint="Paiements recus"
            isDark={isDark}
            valueClassName="text-[1.28rem]"
          />
        </div>

        <div className="space-y-2.5">
          <StatCard
            label="Client rentable"
            value={report.topProfitableClient?.clientName || 'Aucun client'}
            hint={report.topProfitableClient ? formatDzd(report.topProfitableClient.serviceRevenue, { min: 2, max: 2 }) : 'Pas encore de ventes'}
            isDark={isDark}
            valueClassName="text-[1.3rem] break-words"
          />

          <StatCard
            label="Client actif"
            value={report.topActiveClient?.clientName || 'Aucun client'}
            hint={report.topActiveClient ? `${report.topActiveClient.operationsCount} operations` : 'Pas encore d activite'}
            isDark={isDark}
            valueClassName="text-[1.3rem] break-words"
          />
        </div>

        <RankedClientsBlock
          title={topTitle}
          totalClients={report.activeClientsCount}
          rows={report.topClients}
          isDark={isDark}
          subtleText={subtleText}
        />
      </div>
    </section>
  );
}

export function ManualAssetReportsSection({
  assetId,
  assetName,
  clients,
  assetTransactions,
  clientBalances,
  isDark,
  subtleText,
  fieldBase
}: ManualAssetReportsSectionProps) {
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
      if (Number.isFinite(year)) years.add(year);
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

  const selectClassName = `${fieldBase} mt-2 h-12 rounded-[18px] px-4 text-base ${
    isDark
      ? 'border-slate-600 bg-[#22324a] text-slate-100'
      : 'border-slate-200 bg-white text-slate-800'
  }`;

  const activeReport = reportView === 'monthly' ? monthlyReport : annualReport;
  const activeTitle = reportView === 'monthly' ? 'Rapport Mensuel' : 'Rapport Annuel';
  const activeSubtitle = reportView === 'monthly'
    ? `${MONTH_LABELS[selectedMonth]} ${selectedYear}`
    : `Annee ${selectedYear}`;
  const activeTopTitle = reportView === 'monthly' ? 'Top 5 du mois' : 'Top 5 de l annee';

  const pillBase = 'h-10 rounded-[16px] px-4 font-bold text-sm';

  return (
    <section className="space-y-4">
      <div>
        <UnifiedTitle
          as="h2"
          isDark={isDark}
          variant="section"
          icon={<TrendingUpIcon className="w-4 h-4" />}
        >
          Rapport Clients
        </UnifiedTitle>
        <p className={`mt-2 max-w-[32rem] text-sm leading-7 ${subtleText}`}>
          Suivi du chiffre de service, des encaissements et des clients les plus rentables pour {assetName}.
        </p>
      </div>

      <div className={`rounded-[22px] border p-3.5 ${isDark ? 'border-slate-700/70 bg-[#101827]' : 'border-slate-200 bg-slate-50'}`}>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label>Mois</Label>
            <Select
              value={String(selectedMonth)}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className={selectClassName}
            >
              {MONTH_LABELS.map((month, index) => (
                <option key={month} value={index}>{month}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Annee</Label>
            <Select
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={selectClassName}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className={`inline-flex w-full rounded-[18px] p-1 ${isDark ? 'bg-[#1a2638] border border-slate-700/60' : 'bg-slate-100 border border-slate-200'}`}>
        <Button
          onClick={() => setReportView('monthly')}
          className={`flex-1 ${pillBase} ${reportView === 'monthly'
            ? 'bg-emerald-500 text-white shadow-sm'
            : (isDark ? 'bg-transparent text-slate-300 hover:bg-slate-700/60' : 'bg-transparent text-slate-600 hover:bg-white')}`}
        >
          Mensuel
        </Button>
        <Button
          onClick={() => setReportView('annual')}
          className={`flex-1 ${pillBase} ${reportView === 'annual'
            ? 'bg-emerald-500 text-white shadow-sm'
            : (isDark ? 'bg-transparent text-slate-300 hover:bg-slate-700/60' : 'bg-transparent text-slate-600 hover:bg-white')}`}
        >
          Annuel
        </Button>
      </div>

      <ReportCard
        title={activeTitle}
        subtitle={activeSubtitle}
        topTitle={activeTopTitle}
        report={activeReport}
        isDark={isDark}
        subtleText={subtleText}
      />
    </section>
  );
}
