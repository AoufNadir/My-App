import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { UnifiedTitle } from '../components/ui/UnifiedTitle';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { UserIcon } from '../components/icons/UserIcon';
import { Investor, InvestorTransaction } from '../types';
import { InvestorDetailsContent } from '../components/investor-details/InvestorDetailsContent';

interface InvestorDetailsPageProps {
  investor: Investor;
  transactions: InvestorTransaction[];
  onBack: () => void;
  onAddCapital: () => void;
  onWithdrawCapital: () => void;
  onWithdrawProfit: () => void;
  onReinvestProfit: () => void;
  onDeleteTransaction: (tx: InvestorTransaction) => void;
  isDark: boolean;
  cardBase: string;
  subtleText: string;
  globalNetProfit: number;
  managerFeePercentage: number;
  totalCapital: number;
}

export const InvestorDetailsPage: React.FC<InvestorDetailsPageProps> = ({
  investor,
  transactions,
  onBack,
  onAddCapital,
  onWithdrawCapital,
  onWithdrawProfit,
  onReinvestProfit,
  onDeleteTransaction,
  isDark,
  cardBase,
  subtleText
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  const orderedTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.timestamp - a.timestamp),
    [transactions]
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={onBack} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
          <ArrowLeftIcon className="w-6 h-6" />
        </Button>
        <div>
          <UnifiedTitle
            as="h1"
            isDark={isDark}
            variant="page"
            icon={<UserIcon className="w-4 h-4" />}
          >
            {investor.name}
          </UnifiedTitle>
          <p className={`text-sm ${subtleText}`}>
            Investisseur depuis le {new Date(investor.entryDate).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>

      <InvestorDetailsContent
        investor={investor}
        orderedTransactions={orderedTransactions}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAddCapital={onAddCapital}
        onWithdrawCapital={onWithdrawCapital}
        onWithdrawProfit={onWithdrawProfit}
        onReinvestProfit={onReinvestProfit}
        onDeleteTransaction={onDeleteTransaction}
        isDark={isDark}
        cardBase={cardBase}
        subtleText={subtleText}
      />
    </motion.div>
  );
};
