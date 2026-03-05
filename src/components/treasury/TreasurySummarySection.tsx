import { LandmarkIcon } from '../icons/LandmarkIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ArrowRightLeftIcon } from '../icons/ArrowRightLeftIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { formatDzd } from '../../pages/shared/pageFormat';

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

type TreasurySummarySectionProps = {
  isDark: boolean;
  subtleText: string;
  capitalTotal: number;
  portfolioValue: number;
  caisseBalance: number;
  baridiBalance: number;
  dettesAbs: number;
  totalAvances: number;
  positionNette: number;
  activeCardId: string | null;
  onToggleCard: (id: string) => void;
  openTreasuryBalanceEditModal: (asset: 'Caisse' | 'BaridiMob') => void;
};

export function TreasurySummarySection({
  isDark,
  subtleText,
  capitalTotal,
  portfolioValue,
  caisseBalance,
  baridiBalance,
  dettesAbs,
  totalAvances,
  positionNette,
  activeCardId,
  onToggleCard,
  openTreasuryBalanceEditModal
}: TreasurySummarySectionProps) {
  return (
    <>
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
          onToggle={() => onToggleCard('caisse')}
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
          onToggle={() => onToggleCard('baridi')}
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
    </>
  );
}
