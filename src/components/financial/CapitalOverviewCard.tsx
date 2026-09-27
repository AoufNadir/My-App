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
 * The financial overview at the top of Trésorerie (also on the dashboard until V2-3).
 * The calculation and ordering live here so any page that shows it shows the same figures.
 */
export function CapitalOverviewCard({ t, capitalSnapshot, investorBreakdown }: CapitalOverviewCardProps) {
    const secondaryItems: CapitalOverviewSecondaryItem[] = [
        { label: t('finance.projectNetAssets'), value: capitalSnapshot.totalCapital, currency: 'DZD', semantic: 'plain' },
        { label: t('finance.investorLiability'), value: capitalSnapshot.investorLiability, currency: 'DZD', semantic: 'loss', hideWhenZero: true },
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
