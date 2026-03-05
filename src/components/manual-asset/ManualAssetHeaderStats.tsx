import { Button } from '../ui/Button';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { formatDzd } from '../../pages/shared/pageFormat';

type ManualAssetHeaderStatsProps = {
  assetName: string;
  assetDescription?: string;
  totalBalance: number;
  clientsCount: number;
  onBack: () => void;
  isDark: boolean;
  subtleText: string;
};

export function ManualAssetHeaderStats({
  assetName,
  assetDescription,
  totalBalance,
  clientsCount,
  onBack,
  isDark,
  subtleText
}: ManualAssetHeaderStatsProps) {
  return (
    <>
      <div className="flex items-center gap-4">
        <Button onClick={onBack} className={`p-2 rounded-full ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
          <ArrowLeftIcon className="w-6 h-6" />
        </Button>
        <div>
          <UnifiedTitle
            as="h1"
            isDark={isDark}
            variant="page"
            icon={<BriefcaseIcon className="w-4 h-4" />}
          >
            {assetName}
          </UnifiedTitle>
          <p className={`text-sm ${subtleText}`}>{assetDescription || 'Gestion des clients et operations'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`text-sm font-medium mb-1 ${subtleText}`}>Solde Total (Estime)</div>
          <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {formatDzd(totalBalance, { min: 2, max: 2 })}
          </div>
        </div>
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`text-sm font-medium mb-1 ${subtleText}`}>Nombre de Clients</div>
          <div className="text-2xl font-bold">{clientsCount}</div>
        </div>
      </div>
    </>
  );
}
