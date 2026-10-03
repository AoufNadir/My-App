import { useId, useState } from 'react';
import { LandmarkIcon } from '../icons/LandmarkIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { CurrencyAmount } from './CurrencyAmount';
import { HeroKpiCard, type HeroKpiSecondary } from '../ui/HeroKpiCard';
import type { CapitalSnapshot, InvestorBreakdown } from '../../utils/capitalSnapshot';

type CapitalOverviewCardProps = {
    t: (key: string) => string;
    capitalSnapshot: CapitalSnapshot;
    investorBreakdown?: InvestorBreakdown;
    /** Adds « Comment ce chiffre est calculé » under the figures (closed at first). */
    showBreakdown?: boolean;
};

type CapitalOverviewSecondaryItem = HeroKpiSecondary & {
    hideWhenZero?: boolean;
};

const isShown = (value: number) => Math.abs(value) > 0.005;

/**
 * The lines the snapshot adds and subtracts, as calculateCapitalSnapshot does: no figure is
 * computed here, each line is a field of the snapshot.
 */
function CapitalBreakdown({ t, capitalSnapshot, id }: { t: (key: string) => string; capitalSnapshot: CapitalSnapshot; id: string }) {
    const parts: Array<{ label: string; value: number; always?: boolean }> = [
        { label: t('common.caisseBalance'), value: capitalSnapshot.caisseBalance, always: true },
        { label: t('common.baridiBalance'), value: capitalSnapshot.baridiBalance, always: true },
        { label: t('finance.stock'), value: capitalSnapshot.stockValue, always: true },
        { label: t('finance.treasuryCards'), value: capitalSnapshot.treasuryCardsTotal },
        { label: t('finance.toReceive'), value: capitalSnapshot.receivables },
        { label: t('finance.clientAdvance'), value: -capitalSnapshot.clientAdvances },
        { label: t('finance.servicesNetPosition'), value: capitalSnapshot.servicesCapitalImpact },
        { label: t('personalExpenses.personalAdvance'), value: capitalSnapshot.managerPendingAdvances },
    ];
    const row = (label: string, value: number, strong = false) => (<div key={label} className="flex items-baseline justify-between gap-3 py-1">
        <dt className={`min-w-0 text-xs ${strong ? 'font-bold text-neutral-900' : 'text-neutral-600'}`}>{label}</dt>
        <dd className="shrink-0"><CurrencyAmount value={value} currency="DZD" semantic="plain" size="sm" decimals={0} className={strong ? 'font-bold' : ''}/></dd>
      </div>);
    return (<dl id={id} className="rounded-button bg-surface-muted px-3 py-2">
      {parts.filter((part) => part.always || isShown(part.value)).map((part) => row(part.label, part.value))}
      <div className="my-1 border-t border-border"/>
      {row(t('finance.projectNetAssets'), capitalSnapshot.totalCapital, true)}
      {isShown(capitalSnapshot.investorLiability) && (<>
          {row(t('finance.investorLiability'), -capitalSnapshot.investorLiability)}
          <div className="my-1 border-t border-border"/>
          {row(t('dashboard.capitalTotal'), capitalSnapshot.netOwnedCapital, true)}
        </>)}
    </dl>);
}

/**
 * The financial overview at the top of Trésorerie (also on the dashboard until V2-3).
 * The calculation and ordering live here so any page that shows it shows the same figures.
 */
export function CapitalOverviewCard({ t, capitalSnapshot, investorBreakdown, showBreakdown = false }: CapitalOverviewCardProps) {
    const [breakdownOpen, setBreakdownOpen] = useState(false);
    const breakdownId = useId();
    const secondaryItems: CapitalOverviewSecondaryItem[] = [
        { label: t('finance.projectNetAssets'), value: capitalSnapshot.totalCapital, currency: 'DZD', semantic: 'plain' },
        { label: t('finance.investorLiability'), value: capitalSnapshot.investorLiability, currency: 'DZD', semantic: 'loss', hideWhenZero: true },
    ];
    const visibleSecondaryItems = secondaryItems.filter((item) => !item.hideWhenZero || Math.abs(item.value) > 0.005);
    const footer = showBreakdown ? (<div className="flex flex-col gap-2">
        <button type="button" aria-expanded={breakdownOpen} aria-controls={breakdownOpen ? breakdownId : undefined} onClick={() => setBreakdownOpen((open) => !open)} className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-button text-xs font-bold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-light">
          <InfoIcon aria-hidden="true" className="h-4 w-4"/>
          {breakdownOpen ? t('treasury.hideComputation') : t('treasury.howComputed')}
        </button>
        {breakdownOpen && <CapitalBreakdown t={t} capitalSnapshot={capitalSnapshot} id={breakdownId}/>}
      </div>) : undefined;

    return (
        <HeroKpiCard
            accent="sky"
            icon={<LandmarkIcon className="w-5 h-5"/>}
            primaryLabel={t('dashboard.capitalTotal')}
            primaryValue={capitalSnapshot.netOwnedCapital}
            primaryCurrency="DZD"
            primarySemantic="plain"
            secondary={visibleSecondaryItems}
            footer={footer}
        />
    );
}

export { CapitalBreakdown };
