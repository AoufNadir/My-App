import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { LandmarkIcon } from '../components/icons/LandmarkIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { ArrowRightLeftIcon } from '../components/icons/ArrowRightLeftIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { Trash2Icon } from '../components/icons/Trash2Icon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TreasuryCard, ManualAsset, ManualAssetClient } from '../types';
import { formatDzd } from './shared/pageFormat';

type TresoreriePageProps = {
  isDark: boolean;
  cardBase: string;
  subtleText: string;
  caisseBalance: number;
  baridiBalance: number;
  totalDettes: number;
  totalAvances: number;
  portfolioValue: number;
  openTreasuryModal: () => void;
  treasuryCards: TreasuryCard[];
  openTreasuryCardModal: (card?: TreasuryCard) => void;
  setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
  openTreasuryBalanceEditModal: (asset: 'Caisse' | 'BaridiMob') => void;
  manualAssets: ManualAsset[];
  manualAssetClients: ManualAssetClient[];
  assetBalances: Map<string, number>;
  onOpenManualAsset: (asset: ManualAsset) => void;
  onOpenCreateManualAsset: () => void;
  onDeleteManualAsset: (assetId: string) => void;
};

type StatBoxProps = {
  title: string;
  value: number;
  colorClass: string;
  icon?: React.ReactNode;
  onEdit?: () => void;
  subtleText: string;
  isDark: boolean;
  isActive?: boolean;
  onToggle?: () => void;
};

function StatBox({
  title,
  value,
  colorClass,
  icon,
  onEdit,
  subtleText,
  isDark,
  isActive,
  onToggle
}: StatBoxProps) {
  return (
    <div
      onClick={onToggle}
      className={`p-5 rounded-2xl shadow-sm border transition-all relative group ${onToggle ? 'cursor-pointer' : ''} ${isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'} ${isActive ? 'ring-2 ring-indigo-500/50' : ''}`}
    >
      <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
        <span>{title}</span>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className={`transition-all p-1.5 rounded text-gray-500 hover:bg-slate-200 dark:hover:bg-slate-700 ${isActive ? 'opacity-100 bg-slate-100 dark:bg-slate-800' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{formatDzd(value, { min: 2, max: 2 })}</div>
    </div>
  );
}

export function TresoreriePage({
  isDark,
  subtleText,
  caisseBalance,
  baridiBalance,
  totalDettes,
  totalAvances,
  portfolioValue,
  treasuryCards,
  openTreasuryCardModal,
  setTreasuryCardToDelete,
  openTreasuryBalanceEditModal,
  manualAssets,
  manualAssetClients,
  assetBalances,
  onOpenManualAsset,
  onOpenCreateManualAsset,
  onDeleteManualAsset
}: TresoreriePageProps) {
  const [activeCardId, setActiveCardId] = React.useState<string | null>(null);

  const manualCardsTotal = useMemo(
    () => treasuryCards.reduce((acc, card) => acc + (Number(card.value) || 0), 0),
    [treasuryCards]
  );

  const assetClientCount = useMemo(() => {
    const counts = new Map<string, number>();
    manualAssetClients.forEach((client) => {
      counts.set(client.assetId, (counts.get(client.assetId) || 0) + 1);
    });
    return counts;
  }, [manualAssetClients]);

  const dettesAbs = Math.abs(totalDettes);
  const positionNette = totalAvances - dettesAbs;
  const capitalTotal = (Number(caisseBalance) || 0)
    + (Number(baridiBalance) || 0)
    + (Number(portfolioValue) || 0)
    + manualCardsTotal
    - positionNette;

  const toggleCard = (id: string) => {
    setActiveCardId((prev) => (prev === id ? null : id));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <div className={`p-6 rounded-2xl shadow-md border relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-indigo-900/40 to-[#1E293B] border-indigo-500/30' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100'}`}>
          <div className="relative z-10">
            <p className={`text-sm font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>Capital Total (Estime)</p>
            <h1 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatDzd(capitalTotal, { min: 2, max: 2 })}</h1>
          </div>
          <LandmarkIcon className={`absolute right-4 bottom-4 w-24 h-24 opacity-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
        </div>

        <StatBox
          title="Valeur du Stock (Crypto)"
          value={portfolioValue}
          colorClass="text-teal-400"
          subtleText={subtleText}
          isDark={isDark}
          icon={<SparklesIcon className="w-4 h-4 text-teal-500" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatBox
            title="Caisse (Especes)"
            value={caisseBalance}
            colorClass="text-teal-400"
            subtleText={subtleText}
            isDark={isDark}
            icon={<WalletIcon className="w-4 h-4 text-teal-500" />}
            onEdit={() => openTreasuryBalanceEditModal('Caisse')}
            isActive={activeCardId === 'caisse'}
            onToggle={() => toggleCard('caisse')}
          />
          <StatBox
            title="BaridiMob"
            value={baridiBalance}
            colorClass="text-blue-400"
            subtleText={subtleText}
            isDark={isDark}
            icon={<div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500">CCP</div>}
            onEdit={() => openTreasuryBalanceEditModal('BaridiMob')}
            isActive={activeCardId === 'baridi'}
            onToggle={() => toggleCard('baridi')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatBox
            title="Dettes Totales (A Payer)"
            value={dettesAbs}
            colorClass="text-red-400"
            subtleText={subtleText}
            isDark={isDark}
            icon={<ArrowRightLeftIcon className="w-4 h-4 text-red-500 rotate-45" />}
          />
          <StatBox
            title="Avances Totales (A Recevoir)"
            value={totalAvances}
            colorClass="text-green-400"
            subtleText={subtleText}
            isDark={isDark}
            icon={<ArrowRightLeftIcon className="w-4 h-4 text-green-500 -rotate-45" />}
          />
        </div>

        <div className={`p-5 rounded-2xl shadow-sm border transition-all ${isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'}`}>
          <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
            <span>Position Nette (Avances - Dettes)</span>
            <ArrowRightLeftIcon className="w-4 h-4" />
          </div>
          <div className={`text-2xl font-bold ${positionNette > 0 ? 'text-green-400' : positionNette < 0 ? 'text-red-400' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {formatDzd(positionNette, { min: 2, max: 2 })}
          </div>
          <p className={`text-xs mt-1 ${subtleText}`}>
            {positionNette > 0 ? 'Dette Nette (Reduit le Capital)' : positionNette < 0 ? 'Credit Net (Augmente le Capital)' : 'Equilibre'}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Cartes de Tresorerie</h3>
            <Button onClick={() => openTreasuryCardModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg flex items-center gap-2 text-sm font-bold">
              <PlusIcon className="w-4 h-4" /> Ajouter
            </Button>
          </div>

          {treasuryCards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {treasuryCards.map((card) => (
                <div key={card.id} className={`p-5 rounded-2xl shadow-sm border transition-all relative group ${isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'}`}>
                  <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
                    <span>{card.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openTreasuryCardModal(card)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 hover:bg-blue-500/20 rounded-full text-blue-500"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setTreasuryCardToDelete(card)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded-full text-red-500"
                      >
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatDzd(Number(card.value) || 0, { min: 2, max: 2 })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-8 rounded-2xl border border-dashed text-center ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
              Aucune carte ajoutee.
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Actifs Manuels</h3>
            <Button onClick={onOpenCreateManualAsset} className="bg-teal-600 hover:bg-teal-700 text-white p-2 rounded-lg flex items-center gap-2 text-sm font-bold">
              <PlusIcon className="w-4 h-4" /> Creer
            </Button>
          </div>

          {manualAssets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {manualAssets.map((asset) => {
                const balance = assetBalances.get(asset.id) || 0;
                const clientCount = assetClientCount.get(asset.id) || 0;

                return (
                  <div
                    key={asset.id}
                    onClick={() => onOpenManualAsset(asset)}
                    className={`p-5 rounded-2xl shadow-sm border transition-all relative group cursor-pointer hover:scale-[1.02] ${isDark ? 'bg-[#1E293B] border-[#334155] hover:bg-[#263345]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
                      <span>{asset.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteManualAsset(asset.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded-full text-red-500"
                      >
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                    <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatDzd(balance, { min: 2, max: 2 })}
                    </div>
                    <div className={`text-xs mt-2 ${subtleText} flex items-center gap-2`}>
                      <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{clientCount} Clients</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`p-8 rounded-2xl border border-dashed text-center ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
              Aucun actif manuel cree.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
