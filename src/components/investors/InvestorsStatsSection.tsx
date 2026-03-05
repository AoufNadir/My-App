import { Card, CardContent } from '../ui/Card';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { SparklesIcon } from '../icons/SparklesIcon';
import { formatDzd, formatNumber } from '../../pages/shared/pageFormat';

type InvestorsStats = {
  totalCapital: number;
  totalProfitDistributed: number;
  totalAvailable: number;
  managerFee: number;
  totalWithdrawn: number;
};

type InvestorsSummaryCardProps = {
  cardBase: string;
  subtleText: string;
  title: string;
  value: string;
  valueClass: string;
  className: string;
  footerText?: string;
};

type InvestorsStatsSectionProps = {
  cardBase: string;
  subtleText: string;
  isDark: boolean;
  stats: InvestorsStats;
  managerFeePercentage: string;
  setManagerFeePercentage: (val: string) => void;
};

function InvestorsSummaryCard({
  cardBase,
  subtleText,
  title,
  value,
  valueClass,
  className,
  footerText
}: InvestorsSummaryCardProps) {
  return (
    <Card className={`${cardBase} ${className} h-full min-h-[120px] sm:min-h-[140px]`}>
      <CardContent className="h-full flex flex-col justify-center items-center text-center gap-2 p-6">
        <p className={`text-sm font-medium ${subtleText} uppercase tracking-wider opacity-70`}>{title}</p>
        <p className={`text-2xl font-bold ${valueClass}`}>{value} <span className="text-sm text-gray-400 font-normal">DZD</span></p>
        {footerText && <p className="text-[10px] text-gray-400 font-medium">{footerText}</p>}
      </CardContent>
    </Card>
  );
}

export function InvestorsStatsSection({
  cardBase,
  subtleText,
  isDark,
  stats,
  managerFeePercentage,
  setManagerFeePercentage
}: InvestorsStatsSectionProps) {
  return (
    <>
      <Card className={`${cardBase} border border-white/5 bg-slate-900/60 backdrop-blur-sm min-h-[100px] flex flex-col justify-center`}>
        <CardContent className="w-full flex items-center justify-between p-4 px-6">
          <div className="flex flex-col justify-center">
            <UnifiedTitle
              as="h3"
              isDark={isDark}
              variant="compact"
              icon={<SparklesIcon className="w-4 h-4" />}
            >
              Commission Gerant
            </UnifiedTitle>
            <p className="text-xs font-bold text-purple-400 mt-1">
              Prelevement : {formatDzd(stats.managerFee, { min: 2, max: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg border border-white/10 px-3 py-2">
            <input
              type="number"
              value={managerFeePercentage}
              onChange={(e) => setManagerFeePercentage(e.target.value)}
              className="w-12 bg-transparent font-bold text-right text-sm text-white outline-none"
              placeholder="20"
            />
            <span className="text-sm text-gray-500 font-medium">%</span>
          </div>
        </CardContent>
      </Card>

      <div className={`grid grid-cols-1 ${stats.totalWithdrawn > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
        <InvestorsSummaryCard
          cardBase={cardBase}
          subtleText={subtleText}
          title="Capital Total"
          value={formatNumber(stats.totalCapital, { min: 2, max: 2 })}
          valueClass="text-indigo-500"
          className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20"
        />

        <InvestorsSummaryCard
          cardBase={cardBase}
          subtleText={subtleText}
          title="Part Benefices (Globale)"
          value={formatNumber(stats.totalProfitDistributed, { min: 2, max: 2 })}
          valueClass="text-emerald-500"
          className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
          footerText={stats.totalWithdrawn === 0 ? 'Aucun retrait effectue' : undefined}
        />

        {stats.totalWithdrawn > 0 && (
          <InvestorsSummaryCard
            cardBase={cardBase}
            subtleText={subtleText}
            title="Benefices Disponibles"
            value={formatNumber(stats.totalAvailable, { min: 2, max: 2 })}
            valueClass="text-amber-500"
            className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20"
          />
        )}
      </div>
    </>
  );
}
