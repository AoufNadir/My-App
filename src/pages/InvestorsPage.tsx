import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon } from '../components/icons/PlusIcon';
import { Investor } from '../types';
import { InvestorsStatsSection } from '../components/investors/InvestorsStatsSection';
import { InvestorsListSection } from '../components/investors/InvestorsListSection';

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
      <InvestorsStatsSection
        cardBase={cardBase}
        subtleText={subtleText}
        isDark={isDark}
        stats={stats}
        managerFeePercentage={managerFeePercentage}
        setManagerFeePercentage={setManagerFeePercentage}
      />

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

      <InvestorsListSection
        cardBase={cardBase}
        subtleText={subtleText}
        isDark={isDark}
        investors={investors}
        totalCapital={stats.totalCapital}
        onOpenInvestor={onOpenInvestor}
        onEditInvestor={onEditInvestor}
        onDeleteInvestor={onDeleteInvestor}
      />
    </motion.div>
  );
};
