
import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LandmarkIcon } from '../components/icons/LandmarkIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { ArrowRightLeftIcon } from '../components/icons/ArrowRightLeftIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { Trash2Icon } from '../components/icons/Trash2Icon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TreasuryCard } from '../types';

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
  treasuryCards: TreasuryCard[];
  openTreasuryCardModal: (card?: TreasuryCard) => void;
  setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
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
  openTreasuryModal,
  treasuryCards,
  openTreasuryCardModal,
  setTreasuryCardToDelete
}: TresoreriePageProps) {

  // Formula requested: = Caisse + Baridi + Stock - (Avances - Dettes)
  // Dettes is usually negative in the system, so we take absolute value for the display logic 'Avances - Dettes' 
  // (assuming 'Dettes' means the magnitude of debt).
  const dettesAbs = Math.abs(totalDettes);

  // Calculation: Assets + (Receivables - Payables)
  // Receivables = DettesAbs (Money owed to us)
  // Payables = TotalAvances (Money we owe)
  // Adjusted to match user formula structure: Assets - (Payables - Receivables) -> Assets - (Avances - DettesAbs)
  // Adjusted to match user formula structure: Assets - (Payables - Receivables) -> Assets - (Avances - DettesAbs)
  const manualCardsTotal = treasuryCards.reduce((acc, card) => acc + card.value, 0);

  // Position Nette = Avance - Dettes
  // If Positive: Net Liability (We owe more than we are owed) -> Reduces Capital
  // If Negative: Net Asset (We are owed more than we owe) -> Increases Capital
  const positionNette = totalAvances - dettesAbs;

  // Capital Total = Caisse + Baridi + Stock + Manual - Position Nette
  const capitalTotal = caisseBalance + baridiBalance + portfolioValue + manualCardsTotal - positionNette;

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

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 gap-4">

        {/* Row 1: Capital Total (Hero) */}
        <div className={`p-6 rounded-2xl shadow-md border relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-indigo-900/40 to-[#1E293B] border-indigo-500/30' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100'}`}>
          <div className="relative z-10">
            <p className={`text-sm font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>Capital Total (Estimé)</p>
            <h1 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {formatDZD(capitalTotal)} <span className="text-lg font-medium opacity-60">DZD</span>
            </h1>
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

        {/* NEW: Position Nette Card */}
        <div className={`p-5 rounded-2xl shadow-sm border transition-all ${isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'}`}>
          <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
            <span>Position Nette (Avances - Dettes)</span>
            <ArrowRightLeftIcon className="w-4 h-4" />
          </div>
          <div className={`text-2xl font-bold ${positionNette > 0 ? 'text-green-400' : positionNette < 0 ? 'text-red-400' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {formatDZD(positionNette)} <span className={`text-sm font-normal ${subtleText}`}>DZD</span>
          </div>
          <p className={`text-xs mt-1 ${subtleText}`}>
            {positionNette > 0 ? "Dette Nette (Réduit le Capital)" : positionNette < 0 ? "Crédit Net (Augmente le Capital)" : "Équilibré"}
          </p>
        </div>

        {/* Row 4: Manual Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Cartes & Actifs Manuels</h3>
            <Button onClick={() => openTreasuryCardModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg flex items-center gap-2 text-sm font-bold">
              <PlusIcon className="w-4 h-4" /> Ajouter
            </Button>
          </div>

          {treasuryCards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {treasuryCards.map(card => (
                <div key={card.id} className={`p-5 rounded-2xl shadow-sm border transition-all relative group ${isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'}`}>
                  <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
                    <span>{card.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openTreasuryCardModal(card)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-blue-500/20 rounded-full text-blue-500"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setTreasuryCardToDelete(card)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded-full text-red-500"
                      >
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatDZD(card.value)} <span className={`text-sm font-normal ${subtleText}`}>DZD</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-8 rounded-2xl border border-dashed text-center ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
              Aucune carte ajoutée.
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
