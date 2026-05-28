import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { MoneyText } from '../ui/MoneyText';
import { Button } from '../ui/Button';
import { WalletIcon } from '../icons/WalletIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { useLanguage } from '../../contexts/LanguageContext';
type TreasurySummarySectionProps = {
    cardBase: string;
    subtleText: string;
    caisseBalance: number;
    baridiBalance: number;
    dettesAbs: number;
    totalAvances: number;
    investorLiability?: number;
    servicesCapitalImpact?: number;
    openTreasuryBalanceEditModal: (asset: 'Caisse' | 'BaridiMob') => void;
    openDeliveryExpenseModal?: () => void;
    deliveryExpenseLabel?: string;
};
type AccountRowProps = {
    label: string;
    value: number;
    subtleText: string;
    onEdit?: () => void;
    semantic?: 'profit' | 'loss' | 'auto' | 'plain';
};
function AccountRow({ label, value, subtleText, onEdit, semantic = 'plain' }: AccountRowProps) {
    return (<div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className={`text-sm ${subtleText}`}>{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <MoneyText value={value} currency="DZD" semantic={semantic} size="lg"/>
        {onEdit && (<Button onClick={onEdit} aria-label={`Modifier ${label}`} variant="ghost" className="p-2 text-neutral-600">
            <PencilIcon className="w-4 h-4"/>
          </Button>)}
      </div>
    </div>);
}
export function TreasurySummarySection({ cardBase, subtleText, caisseBalance, baridiBalance, dettesAbs, totalAvances, investorLiability = 0, servicesCapitalImpact = 0, openTreasuryBalanceEditModal, openDeliveryExpenseModal, deliveryExpenseLabel }: TreasurySummarySectionProps) {
    const { t } = useLanguage();
    const shouldShowAmount = (value: number) => Math.abs(Number(value) || 0) > 0.005;
    const deliveryButtonClass = 'flex w-full items-center justify-center gap-2 py-3 text-sm font-bold';
    return (<Card className={cardBase}>
      <CardHeader className="p-4 pb-3">
        <UnifiedTitle as="h3" variant="section" icon={<WalletIcon className="w-4 h-4"/>}>
          Comptes & Mouvements
        </UnifiedTitle>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border">
        <AccountRow label={t('common.caisseBalance') as string} value={caisseBalance} subtleText={subtleText} onEdit={() => openTreasuryBalanceEditModal('Caisse')}/>
        <AccountRow label={t('common.baridiBalance') as string} value={baridiBalance} subtleText={subtleText} onEdit={() => openTreasuryBalanceEditModal('BaridiMob')}/>
        {shouldShowAmount(dettesAbs) && (<AccountRow label={t('finance.toReceive') as string} value={dettesAbs} subtleText={subtleText} semantic="profit"/>)}
        {shouldShowAmount(totalAvances) && (<AccountRow label={t('finance.clientAdvance') as string} value={totalAvances} subtleText={subtleText} semantic="loss"/>)}
        {shouldShowAmount(servicesCapitalImpact) && (<AccountRow label={t('nav.services') as string} value={servicesCapitalImpact} subtleText={subtleText} semantic="auto"/>)}
        {shouldShowAmount(investorLiability) && (<AccountRow label={t('finance.investorLiability') as string} value={investorLiability} subtleText={subtleText} semantic="loss"/>)}
        {openDeliveryExpenseModal && (<div className="p-4">
            <Button onClick={openDeliveryExpenseModal} variant="outline" className={deliveryButtonClass}>
              <PlusIcon className="w-4 h-4"/>
              {deliveryExpenseLabel || 'Frais de livraison'}
            </Button>
          </div>)}
      </CardContent>
    </Card>);
}
