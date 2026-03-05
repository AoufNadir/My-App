import React from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { PlusIcon } from '../icons/PlusIcon';
import { MinusIcon } from '../icons/MinusIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { Investor, InvestorTransaction } from '../../types';
import { formatDzd, formatNumber } from '../../pages/shared/pageFormat';

type InvestorDetailsContentProps = {
  investor: Investor;
  orderedTransactions: InvestorTransaction[];
  activeTab: 'overview' | 'history';
  setActiveTab: (tab: 'overview' | 'history') => void;
  onAddCapital: () => void;
  onWithdrawCapital: () => void;
  onWithdrawProfit: () => void;
  onReinvestProfit: () => void;
  onDeleteTransaction: (tx: InvestorTransaction) => void;
  isDark: boolean;
  cardBase: string;
  subtleText: string;
};

type TxVisualMeta = {
  label: string;
  isPositive: boolean;
  icon: React.ReactNode;
  badgeClass: string;
};

function getInvestorTxMeta(tx: InvestorTransaction, isDark: boolean): TxVisualMeta {
  switch (tx.type) {
    case 'profit_distribution':
      return {
        label: 'Distribution de Profit',
        isPositive: true,
        icon: <PlusIcon className="w-4 h-4" />,
        badgeClass: isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'
      };
    case 'withdraw_profit':
      return {
        label: 'Retrait de Benefices',
        isPositive: false,
        icon: <WalletIcon className="w-4 h-4" />,
        badgeClass: isDark ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-600'
      };
    case 'reinvest_profit':
      return {
        label: 'Reinvestissement',
        isPositive: true,
        icon: <PlusIcon className="w-4 h-4" />,
        badgeClass: isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'
      };
    case 'deposit_capital':
      return {
        label: 'Ajout de Capital',
        isPositive: true,
        icon: <PlusIcon className="w-4 h-4" />,
        badgeClass: isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
      };
    default:
      return {
        label: 'Retrait de Capital',
        isPositive: false,
        icon: <MinusIcon className="w-4 h-4" />,
        badgeClass: isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'
      };
  }
}

export function InvestorDetailsContent({
  investor,
  orderedTransactions,
  activeTab,
  setActiveTab,
  onAddCapital,
  onWithdrawCapital,
  onWithdrawProfit,
  onReinvestProfit,
  onDeleteTransaction,
  isDark,
  cardBase,
  subtleText
}: InvestorDetailsContentProps) {
  const currentTotalProfit = investor.totalProfit || 0;
  const currentAvailable = investor.availableProfit || 0;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className={`${cardBase} border-l-4 border-l-indigo-500 h-full min-h-[220px]`}>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full gap-4">
            <div className="flex flex-col items-center gap-2">
              <p className={`text-sm font-medium ${subtleText} uppercase tracking-wider opacity-70`}>Capital Investi</p>
              <div className="flex flex-col items-center">
                <h2 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  {formatDzd(investor.capitalInvested, { min: 0, max: 2 })}
                </h2>
                <span className="text-xs font-bold text-indigo-500/80 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full mt-1">
                  {formatNumber(investor.sharePercentage * 100, { min: 2, max: 2 })}% du fond
                </span>
              </div>
            </div>
            <div className="flex gap-2 w-full mt-2">
              <Button onClick={onAddCapital} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95">
                <PlusIcon className="w-4 h-4" /> Ajouter
              </Button>
              <Button onClick={onWithdrawCapital} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-95">
                <MinusIcon className="w-4 h-4" /> Retirer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={`${cardBase} border-l-4 border-l-emerald-500 h-full min-h-[220px]`}>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full gap-4">
            <div className="flex flex-col items-center gap-2">
              <p className={`text-sm font-medium ${subtleText} uppercase tracking-wider opacity-70`}>Benefices Disponibles</p>
              <h2 className="text-3xl font-bold text-emerald-500">
                {formatDzd(currentAvailable, { min: 2, max: 2 })}
              </h2>
            </div>
            <div className="flex gap-2 w-full mt-2">
              <Button onClick={onWithdrawProfit} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-transform active:scale-95">
                <WalletIcon className="w-4 h-4" /> Retirer Benefices
              </Button>
              <Button
                onClick={onReinvestProfit}
                disabled={currentAvailable <= 0.01}
                className={`w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-transform active:scale-95 ${currentAvailable <= 0.01 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <PlusIcon className="w-4 h-4" /> Reinvestir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className={`${cardBase} h-full min-h-[100px]`}>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-1">
            <p className={`text-xs font-medium ${subtleText} opacity-70`}>Total Gagne</p>
            <p className="text-lg font-bold text-green-500">+{formatDzd(currentTotalProfit, { min: 2, max: 2 })}</p>
          </CardContent>
        </Card>
        <Card className={`${cardBase} h-full min-h-[100px]`}>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-1">
            <p className={`text-xs font-medium ${subtleText} opacity-70`}>Total Retire</p>
            <p className="text-lg font-bold text-orange-500">-{formatDzd(investor.withdrawnProfit, { min: 2, max: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
        >
          Apercu
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
        >
          Historique ({orderedTransactions.length})
        </button>
      </div>

      {activeTab === 'history' && (
        <Card className={cardBase}>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {orderedTransactions.length === 0 ? (
                <p className="p-8 text-center text-sm opacity-50">Aucune transaction.</p>
              ) : (
                orderedTransactions.map((tx) => {
                  const meta = getInvestorTxMeta(tx, isDark);
                  return (
                    <React.Fragment key={tx.id}>
                      <SwipeableListItem onDelete={() => onDeleteTransaction(tx)}>
                        <div className={`p-4 flex items-center justify-between w-full ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${meta.badgeClass}`}>{meta.icon}</div>
                            <div>
                              <p className="font-bold text-sm">{meta.label}</p>
                              <p className={`text-xs ${subtleText} opacity-70`}>{tx.date} a {tx.time}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${meta.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                              {meta.isPositive ? '+' : '-'}{formatDzd(tx.amount, { min: 2, max: 2 })}
                            </p>
                            {tx.notes && <p className={`text-xs ${subtleText}`}>{tx.notes}</p>}
                          </div>
                        </div>
                      </SwipeableListItem>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-4">
          {investor.notes && (
            <Card className={cardBase}>
              <CardHeader className="p-4 pb-2">
                <UnifiedTitle
                  as="h3"
                  isDark={isDark}
                  variant="compact"
                  icon={<InfoIcon className="w-4 h-4" />}
                >
                  Notes
                </UnifiedTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-sm opacity-80">{investor.notes}</CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
