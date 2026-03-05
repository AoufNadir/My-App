import React from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { UsersIcon } from '../icons/UsersIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { Investor } from '../../types';
import { formatDzd } from '../../pages/shared/pageFormat';

type InvestorsListSectionProps = {
  cardBase: string;
  subtleText: string;
  isDark: boolean;
  investors: Investor[];
  totalCapital: number;
  onOpenInvestor: (investor: Investor) => void;
  onEditInvestor: (investor: Investor) => void;
  onDeleteInvestor: (investor: Investor) => void;
};

export function InvestorsListSection({
  cardBase,
  subtleText,
  isDark,
  investors,
  totalCapital,
  onOpenInvestor,
  onEditInvestor,
  onDeleteInvestor
}: InvestorsListSectionProps) {
  return (
    <Card className={cardBase}>
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <UnifiedTitle
            as="h2"
            isDark={isDark}
            variant="section"
            icon={<UsersIcon className="w-4 h-4" />}
          >
            Liste des Investisseurs
          </UnifiedTitle>
        </div>
        <span className={`text-sm ${subtleText}`}>{investors.length} Actifs</span>
      </CardHeader>
      <CardContent className="p-0">
        {investors.length === 0 ? (
          <div className="p-8 text-center opacity-50">
            <UsersIcon className="w-12 h-12 mx-auto mb-2" />
            <p>Aucun investisseur enregistre.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {investors.map((investor) => {
              const sharePercent = totalCapital > 0
                ? (investor.capitalInvested / totalCapital) * 100
                : 0;

              return (
                <React.Fragment key={investor.id}>
                  <SwipeableListItem
                    onEdit={() => onEditInvestor(investor)}
                    onDelete={() => onDeleteInvestor(investor)}
                  >
                    <div
                      onClick={() => onOpenInvestor(investor)}
                      className={`p-4 transition-colors cursor-pointer flex items-center justify-between group w-full ${isDark ? 'bg-[#111827] hover:bg-white/5' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                          {investor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base">{investor.name}</h3>
                            {investor.isManager && (
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${isDark ? 'bg-purple-900/30 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                                Gerant
                              </span>
                            )}
                          </div>
                          <p className={`text-xs ${subtleText}`}>
                            Part: <span className="font-semibold text-indigo-500">{sharePercent.toFixed(2)}%</span>
                            {' - '}
                            Entree: {new Date(investor.entryDate).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="font-bold text-sm text-right">{formatDzd(investor.capitalInvested, { min: 2, max: 2 })}</p>
                          <p className="text-xs text-emerald-500 font-medium text-right">
                            +{formatDzd(investor.availableProfit || 0, { min: 2, max: 2 })}
                          </p>
                        </div>
                        <ChevronRightIcon className={`w-5 h-5 ${subtleText} group-hover:text-indigo-500 transition-colors`} />
                      </div>
                    </div>
                  </SwipeableListItem>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
