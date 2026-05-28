import { useMemo } from 'react';
import { TreasuryCard } from '../types';
import { TreasurySummarySection } from '../components/treasury/TreasurySummarySection';
import { TreasuryCollectionsSection } from '../components/treasury/TreasuryCollectionsSection';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { LandmarkIcon } from '../components/icons/LandmarkIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';
type TresoreriePageProps = {
    cardBase: string;
    subtleText: string;
    caisseBalance: number;
    baridiBalance: number;
    totalDettes: number;
    totalAvances: number;
    investorLiability?: number;
    portfolioValue: number;
    openTreasuryModal: () => void;
    treasuryCards: TreasuryCard[];
    openTreasuryCardModal: (card?: TreasuryCard) => void;
    setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
    openTreasuryBalanceEditModal: (asset: 'Caisse' | 'BaridiMob') => void;
    openDeliveryExpenseModal?: () => void;
    servicesSummary?: {
        netCapitalImpact?: number;
    };
};
export function TresoreriePage({ cardBase, subtleText, caisseBalance, baridiBalance, totalDettes, totalAvances, investorLiability = 0, portfolioValue, treasuryCards, openTreasuryCardModal, setTreasuryCardToDelete, openTreasuryBalanceEditModal, openDeliveryExpenseModal, servicesSummary }: TresoreriePageProps) {
    const { t } = useLanguage();
    const servicesCapitalImpact = Number(servicesSummary?.netCapitalImpact || 0);
    const capitalSnapshot = useMemo(() => computeCapitalSnapshot({
        caisseBalance,
        baridiBalance,
        portfolioValue,
        totalDettes,
        totalAvances,
        treasuryCards,
        investorLiability,
        servicesCapitalImpact
    }), [caisseBalance, baridiBalance, portfolioValue, totalDettes, totalAvances, treasuryCards, investorLiability, servicesCapitalImpact]);
    const secondaryItems = [
        { label: t('finance.realCapital') as string, value: capitalSnapshot.netOwnedCapital, currency: 'DZD' as const, semantic: 'plain' as const },
        { label: t('finance.investorLiability') as string, value: capitalSnapshot.investorLiability, currency: 'DZD' as const, semantic: capitalSnapshot.investorLiability > 0 ? 'loss' as const : 'plain' as const, hideWhenZero: true },
        { label: t('common.caisseBalance') as string, value: caisseBalance, currency: 'DZD' as const, semantic: 'plain' as const },
        { label: t('common.baridiBalance') as string, value: baridiBalance, currency: 'DZD' as const, semantic: 'plain' as const },
        { label: t('finance.stock') as string, value: portfolioValue, currency: 'DZD' as const, semantic: 'plain' as const, hideWhenZero: true },
        { label: t('finance.treasuryCards') as string, value: capitalSnapshot.treasuryCardsTotal, currency: 'DZD' as const, semantic: 'plain' as const, hideWhenZero: true },
        { label: t('nav.services') as string, value: capitalSnapshot.servicesCapitalImpact, currency: 'DZD' as const, semantic: 'auto' as const, hideWhenZero: true },
        { label: t('finance.netPosition') as string, value: capitalSnapshot.netClientPosition, currency: 'DZD' as const, semantic: 'auto' as const, hideWhenZero: true }
    ].filter((item) => !item.hideWhenZero || Math.abs(item.value) > 0.005);
    return (<div className="anim-page-in space-y-5">
      <HeroKpiCard accent="sky" icon={<LandmarkIcon className="w-5 h-5"/>} primaryLabel={t('treasury.totalCapital') as string} primaryValue={capitalSnapshot.totalCapital} primaryCurrency="DZD" primarySemantic="plain" secondary={secondaryItems}/>

      <TreasurySummarySection cardBase={cardBase} subtleText={subtleText} caisseBalance={caisseBalance} baridiBalance={baridiBalance} dettesAbs={capitalSnapshot.receivables} totalAvances={capitalSnapshot.clientAdvances} investorLiability={capitalSnapshot.investorLiability} servicesCapitalImpact={capitalSnapshot.servicesCapitalImpact} openTreasuryBalanceEditModal={openTreasuryBalanceEditModal} openDeliveryExpenseModal={openDeliveryExpenseModal} deliveryExpenseLabel={t('delivery.addExpense') as string}/>

      <TreasuryCollectionsSection cardBase={cardBase} subtleText={subtleText} treasuryCards={treasuryCards} openTreasuryCardModal={openTreasuryCardModal} setTreasuryCardToDelete={setTreasuryCardToDelete}/>
    </div>);
}
