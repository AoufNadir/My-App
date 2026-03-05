import { Button } from '../ui/Button';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon';
import { UserIcon } from '../icons/UserIcon';
import { formatDzd } from '../../pages/shared/pageFormat';

type ManualClientHeaderStatsProps = {
  clientName: string;
  clientPhone?: string;
  balance: number;
  onBack: () => void;
  isDark: boolean;
  subtleText: string;
};

export function ManualClientHeaderStats({
  clientName,
  clientPhone,
  balance,
  onBack,
  isDark,
  subtleText
}: ManualClientHeaderStatsProps) {
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
            icon={<UserIcon className="w-4 h-4" />}
          >
            {clientName}
          </UnifiedTitle>
          <p className={`text-sm ${subtleText}`}>{clientPhone || 'Details du client'}</p>
        </div>
      </div>

      <div className={`p-6 rounded-2xl border text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`text-sm font-medium mb-2 ${subtleText}`}>Solde Actuel</div>
        <div className={`text-4xl font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {formatDzd(balance, { min: 2, max: 2 })}
        </div>
        <p className={`text-xs mt-2 ${subtleText}`}>
          {balance < 0 ? "Le client vous doit de l'argent" : balance > 0 ? "Vous devez de l'argent au client" : 'Compte solde'}
        </p>
      </div>
    </>
  );
}
