import { useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { OverdueDebtClient } from '../../types';
import { formatDzd } from '../../pages/shared/pageFormat';

type OverdueDebtsPanelProps = {
  overdueDebtors: OverdueDebtClient[];
  cardBase: string;
  subtleText: string;
  isDark: boolean;
  onOpenClient: (clientId: string) => void;
};

export function OverdueDebtsPanel({
  overdueDebtors,
  cardBase,
  subtleText,
  isDark,
  onOpenClient
}: OverdueDebtsPanelProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  if (overdueDebtors.length === 0) return null;

  const totalOverdue = overdueDebtors.reduce((sum, debtor) => sum + debtor.overdueAmount, 0);

  const openClientFromModal = (clientId: string) => {
    setIsDetailsOpen(false);
    onOpenClient(clientId);
  };

  return (
    <>
      <Card className={`${cardBase} border-l-4 border-l-red-500`}>
        <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="pt-6 sm:pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangleIcon className="w-5 h-5 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <UnifiedTitle
                    as="h3"
                    isDark={isDark}
                    variant="compact"
                    className="text-sm sm:text-base leading-snug break-words"
                  >
                    Suivi des Dettes (+7 jours)
                  </UnifiedTitle>
                  <p className={`text-xs sm:text-sm mt-0.5 ${subtleText}`}>
                    {overdueDebtors.length} client(s) - {formatDzd(-totalOverdue, { min: 2, max: 2 })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsDetailsOpen(true)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  Afficher
                </Button>
                <Button
                  onClick={() => onOpenClient(overdueDebtors[0].clientId)}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white"
                >
                  Urgent
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} className={`${cardBase} max-w-2xl`}>
        <DialogHeader onClose={() => setIsDetailsOpen(false)} isDark={isDark}>
          <DialogTitle>Dettes en retard (+7 jours)</DialogTitle>
        </DialogHeader>
        <DialogContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className={`mb-3 text-sm ${subtleText}`}>
            Total: <span className="font-bold text-red-500">{formatDzd(-totalOverdue, { min: 2, max: 2 })}</span>
          </div>

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {overdueDebtors.map((debtor, index) => (
              <button
                key={debtor.clientId}
                onClick={() => openClientFromModal(debtor.clientId)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${isDark ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/70' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">
                      #{index + 1} {debtor.fullName}
                    </p>
                    <p className={`text-xs mt-0.5 ${subtleText}`}>
                      {debtor.daysOverdue} jours de retard - depuis {debtor.oldestUnpaidDate}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${subtleText}`}>
                      {debtor.lastPaymentTimestamp
                        ? `Dernier reglement: ${new Date(debtor.lastPaymentTimestamp).toLocaleDateString('fr-FR')}`
                        : 'Aucun reglement'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-500">{formatDzd(-debtor.overdueAmount, { min: 2, max: 2 })}</p>
                    <span className={`text-[11px] ${subtleText}`}>Dette</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
