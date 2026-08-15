import { LandmarkIcon } from '../icons/LandmarkIcon';
import { HeroKpiCard, type HeroKpiSecondary } from '../ui/HeroKpiCard';
import type { CapitalSnapshot, InvestorBreakdown } from '../../utils/capitalSnapshot';

type CapitalOverviewCardProps = {
    t: (key: string) => string;
    capitalSnapshot: CapitalSnapshot;
    investorBreakdown?: InvestorBreakdown;
};

type CapitalOverviewSecondaryItem = HeroKpiSecondary & {
    hideWhenZero?: boolean;
};

/**
 * The shared financial overview used at the top of Dashboard and Trésorerie.
 * Keeping the calculation and ordering here prevents the two pages from drifting.
 */
export function CapitalOverviewCard({ t, capitalSnapshot, investorBreakdown }: CapitalOverviewCardProps) {
    const secondaryItems: CapitalOverviewSecondaryItem[] = [
        { label: t('finance.projectNetAssets'), value: capitalSnapshot.totalCapital, currency: 'DZD', semantic: 'plain' },
        { label: t('treasury.investorCapital'), value: investorBreakdown?.capital ?? capitalSnapshot.investorLiability, currency: 'DZD', semantic: 'loss', hideWhenZero: true },
        { label: t('treasury.profitsNotWithdrawn'), value: investorBreakdown?.profits ?? 0, currency: 'DZD', semantic: 'loss', hideWhenZero: true },
        { label: t('finance.liquidity'), value: capitalSnapshot.cashTotal, currency: 'DZD', semantic: 'plain' },
        { label: t('finance.stock'), value: capitalSnapshot.stockValue, currency: 'DZD', semantic: 'plain', hideWhenZero: true },
        { label: t('finance.treasuryCards'), value: capitalSnapshot.treasuryCardsTotal, currency: 'DZD', semantic: 'plain', hideWhenZero: true },
        { label: t('finance.servicesNetPosition'), value: capitalSnapshot.servicesCapitalImpact, currency: 'DZD', semantic: 'auto', hideWhenZero: true },
        { label: t('finance.netPosition'), value: capitalSnapshot.netClientPosition, currency: 'DZD', semantic: 'auto', hideWhenZero: true }
    ];
    const visibleSecondaryItems = secondaryItems.filter((item) => !item.hideWhenZero || Math.abs(item.value) > 0.005);

    return (
        <HeroKpiCard
            accent="sky"
            icon={<LandmarkIcon className="w-5 h-5"/>}
            primaryLabel={t('dashboard.capitalTotal')}
            primaryValue={capitalSnapshot.netOwnedCapital}
            primaryCurrency="DZD"
            primarySemantic="plain"
            secondary={visibleSecondaryItems}
        />
    );
}
