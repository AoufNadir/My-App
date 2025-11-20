
import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LandmarkIcon } from '../components/icons/LandmarkIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { ArrowRightLeftIcon } from '../components/icons/ArrowRightLeftIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';

type TresoreriePageProps = {
  isDark: boolean;
  cardBase: string;
  subtleText: string;
  caisseBalance: number;
  baridiBalance: number;
  totalDettes: number; // Negative number
  totalAvances: number; // Positive number
  portfolioValue: number;
  openTreasuryModal: () => void;
};

export function TresoreriePage({
  isDark,
  cardBase,
  subtleText,
  caisseBalance,
  baridiBalance,
  totalDettes,
  totalAvances,
  portfolioValue,
  openTreasuryModal
}: TresoreriePageProps) {

  // Formula requested: = Caisse + Baridi + Stock - (Avances - Dettes)
  // Dettes is usually negative in the system, so we take absolute value for the display logic 'Avances - Dettes' 
  // (assuming 'Dettes' means the magnitude of debt).
  const dettesAbs = Math.abs(totalDettes);

  // Calculation: Assets + (Receivables - Payables)
  // Receivables = DettesAbs (Money owed to us)
  // Payables = TotalAvances (Money we owe)
  // Adjusted to match user formula structure: Assets - (Payables - Receivables) -> Assets - (Avances - DettesAbs)
  const capitalTotal = caisseBalance + baridiBalance + portfolioValue - (totalAvances - dettesAbs);

  // Helper for formatting currency
  const formatDZD = (amount: number) => amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const StatBox = ({ title, value, colorClass, icon }: { title: string, value: string, colorClass: string, icon?: React.ReactNode }) => (
    <div className={`p-5 rounded-2xl shadow-sm border transition-all ${isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'}`}>
      <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
        <span>{title}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>
        {value} <span className={`text-sm font-normal ${subtleText}`}>DZD</span>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* Header Actions */}
      <Card className={cardBase}>
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <LandmarkIcon className="w-5 h-5" />
            Gestion de la Trésorerie
          </h2>

        </CardHeader>
      </Card>

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 gap-4">

        {/* Row 1: Capital Total (Hero) */}
        <div className={`p-6 rounded-2xl shadow-md border relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-indigo-900/40 to-[#1E293B] border-indigo-500/30' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100'}`}>
          <div className="relative z-10">
            <p className={`text-sm font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>Capital Total (Estimé)</p>
            <h1 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {formatDZD(capitalTotal)} <span className="text-lg font-medium opacity-60">DZD</span>
            </h1>
            <p className={`text-xs mt-2 ${subtleText} font-mono opacity-80`}>
              = Caisse + Baridi + Stock - (Avances - Dettes)
            </p>
          </div>
          <LandmarkIcon className={`absolute right-4 bottom-4 w-24 h-24 opacity-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
        </div>

        {/* NEW: Portfolio Value Card */}
        <StatBox
          title="Valeur du Stock (Crypto)"
          value={formatDZD(portfolioValue)}
          colorClass="text-teal-400"
          icon={<SparklesIcon className="w-4 h-4 text-teal-500" />}
        />

        {/* Row 2: Liquidités (2 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatBox
            title="Caisse (Espèces)"
            value={formatDZD(caisseBalance)}
            colorClass="text-teal-400"
            icon={<WalletIcon className="w-4 h-4 text-teal-500" />}
          />
          <StatBox
            title="BaridiMob"
            value={formatDZD(baridiBalance)}
            colorClass="text-blue-400"
            icon={<div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500">CCP</div>}
          />
        </div>

        {/* Row 3: Dettes & Avances (2 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatBox
            title="Dettes Totales (À Payer)"
            value={formatDZD(dettesAbs)}
            colorClass="text-red-400"
            icon={<ArrowRightLeftIcon className="w-4 h-4 text-red-500 rotate-45" />}
          />
          <StatBox
            title="Avances Totales (À Recevoir)"
            value={formatDZD(totalAvances)}
            colorClass="text-green-400"
            icon={<ArrowRightLeftIcon className="w-4 h-4 text-green-500 -rotate-45" />}
          />
        </div>

      </div>
    </motion.div>
  );
}
