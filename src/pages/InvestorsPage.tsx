import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { PlusIcon } from '../components/icons/PlusIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { Investor } from '../types';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { SwipeableListItem } from '../components/ui/SwipeableListItem';
import { formatDzd, formatNumber } from './shared/pageFormat';

interface InvestorsPageProps {
  isDark: boolean;
  cardBase: string;
  subtleText: string;
  investors: Investor[];
  onOpenInvestor: (investor: Investor) => void;
  onAddInvestor: () => void;
  onEditInvestor: (investor: Investor) => void;
  onDeleteInvestor: (investor: Investor) => void;
  globalNetProfit: number;
  managerFeePercentage: string;
  setManagerFeePercentage: (val: string) => void;
}

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

export const InvestorsPage: React.FC<InvestorsPageProps> = ({
  isDark,
  cardBase,
  subtleText,
  investors,
  onOpenInvestor,
  onAddInvestor,
  onEditInvestor,
  onDeleteInvestor,
  globalNetProfit,
  managerFeePercentage,
  setManagerFeePercentage
}) => {
  const stats: InvestorsStats = useMemo(() => {
    const totalCapital = investors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0);
    const totalProfitDistributed = investors.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);
    const totalAvailable = investors.reduce((sum, inv) => sum + (inv.availableProfit || 0), 0);
    const totalWithdrawn = investors.reduce((sum, inv) => sum + (inv.withdrawnProfit || 0), 0);
    const managerFee = globalNetProfit * ((parseFloat(managerFeePercentage) || 0) / 100);

    return { totalCapital, totalProfitDistributed, totalAvailable, managerFee, totalWithdrawn };
  }, [investors, globalNetProfit, managerFeePercentage]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Card className={`${cardBase} border border-white/5 bg-slate-900/60 backdrop-blur-sm min-h-[100px] flex flex-col justify-center`}>
        <CardContent className="w-full flex items-center justify-between p-4 px-6">
          <div className="flex flex-col justify-center">
            <h3 className="font-medium text-sm text-slate-300">Commission Gerant</h3>
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

      <div className="fixed bottom-24 right-4 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAddInvestor}
          className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center justify-center transition-colors focus:outline-none"
        >
          <PlusIcon className="w-8 h-8" />
        </motion.button>
      </div>

      <Card className={cardBase}>
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-lg">Liste des Investisseurs</h2>
          </div>
          <span className={`text-sm ${subtleText}`}>{investors.length} Actifs</span>
        </CardHeader>
        <CardContent className="p-0">
          {investors.length === 0 ? (
            <div className="p-8 text-center opacity-50">
              <UsersIcon className="w-12 h-12 mx-auto mb-2" />
              <p>Aucun investisseur enregistre.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {investors.map((investor) => {
                const sharePercent = stats.totalCapital > 0
                  ? (investor.capitalInvested / stats.totalCapital) * 100
                  : 0;

                return (
                  <React.Fragment key={investor.id}>
                    <SwipeableListItem
                      onEdit={() => onEditInvestor(investor)}
                      onDelete={() => onDeleteInvestor(investor)}
                    >
                      <div
                        onClick={() => onOpenInvestor(investor)}
                        className={`p-4 transition-colors cursor-pointer flex items-center justify-between group w-full ${isDark ? 'bg-[#111827] hover:bg-white/5' : 'bg-white hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                            {investor.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-base">{investor.name}</h3>
                              {investor.isManager && (
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${isDark ? 'bg-purple-900/30 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                                  Gerant
                                </span>
                              )}
                            </div>
                            <p className={`text-xs ${subtleText}`}>
                              Part: <span className="font-semibold text-indigo-500">{sharePercent.toFixed(2)}%</span>
                              {' • '}
                              Entree: {new Date(investor.entryDate).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="font-bold text-sm text-right">{formatDzd(investor.capitalInvested, { min: 2, max: 2 })}</p>
                            <p className="text-xs text-emerald-500 font-medium text-right">
                              +{formatDzd(investor.availableProfit || 0, { min: 2, max: 2 })}
                            </p>
                          </div>
                          <ChevronRightIcon className={`w-5 h-5 ${subtleText} group-hover:text-indigo-500 transition-colors`} />
                        </div>
                      </div>
                    </SwipeableListItem>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
