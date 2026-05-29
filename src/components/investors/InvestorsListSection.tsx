import React from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { UsersIcon } from '../icons/UsersIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { Investor } from '../../types';
type InvestorsListSectionProps = {
    investors: Investor[];
    activeCount: number;
    onOpenInvestor: (investor: Investor) => void;
    onEditInvestor: (investor: Investor) => void;
    onDeleteInvestor: (investor: Investor) => void;
};
export function InvestorsListSection({ investors, activeCount, onOpenInvestor, onEditInvestor, onDeleteInvestor }: InvestorsListSectionProps) {
    return (<Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border p-4">
        <SectionHeading icon={<UsersIcon className="w-4 h-4"/>}>
          Liste des Investisseurs
        </SectionHeading>
        <Badge variant="primary" size="sm">{activeCount} Actifs</Badge>
      </CardHeader>
      <CardContent className="p-0">
        {investors.length === 0 ? (<EmptyState icon={<UsersIcon className="w-6 h-6"/>} title="Aucun investisseur enregistré." subtitle="Ajoutez un investisseur pour suivre son capital et ses bénéfices."/>) : (<div className="divide-y divide-neutral-100">
            {investors.map((investor) => {
                const availableProfit = Number(investor.availableProfit || 0);
                return (<React.Fragment key={investor.id}>
                  <SwipeableListItem onEdit={() => onEditInvestor(investor)} onDelete={() => onDeleteInvestor(investor)}>
                    <div onClick={() => onOpenInvestor(investor)} className="group flex min-h-touch w-full cursor-pointer items-center justify-between gap-3 bg-surface p-4 transition-colors hover:bg-neutral-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-lg font-bold text-secondary">
                          {investor.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <h3 className="text-base font-semibold truncate">{investor.name}</h3>
                          {investor.isManager && (<Badge variant="warning" size="sm">Gérant</Badge>)}
                          {!investor.isActive && (<Badge variant="neutral" size="sm">Inactif</Badge>)}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 text-end">
                        <div>
                          <CurrencyAmount value={investor.capitalInvested} currency="DZD" size="lg" decimals={0}/>
                          <div className="mt-0.5">
                            <CurrencyAmount value={availableProfit} currency="DZD" semantic="auto" size="md" showSign decimals={0}/>
                          </div>
                          {(investor as any).roi !== null && (investor as any).roi !== undefined && (<div className={`mt-0.5 text-[10px] font-bold tabular-nums ${(investor as any).roi > 0 ? 'text-financial-profit' : (investor as any).roi < 0 ? 'text-financial-loss' : 'text-neutral-400'}`} dir="ltr">
                            {(investor as any).roi > 0 ? '+' : ''}{((investor as any).roi as number).toFixed(1)}% ROI
                          </div>)}
                        </div>
                        <ChevronRightIcon className="w-5 h-5 text-neutral-400"/>
                      </div>
                    </div>
                  </SwipeableListItem>
                </React.Fragment>);
            })}
          </div>)}
      </CardContent>
    </Card>);
}
