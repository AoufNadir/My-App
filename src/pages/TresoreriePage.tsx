import { useMemo } from 'react';
import { TreasuryCard, TreasuryTx } from '../types';
import { TreasurySummarySection } from '../components/treasury/TreasurySummarySection';
import { TreasuryCollectionsSection } from '../components/treasury/TreasuryCollectionsSection';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { LandmarkIcon } from '../components/icons/LandmarkIcon';
import { ArrowUpRightIcon } from '../components/icons/ArrowUpRightIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';

const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type TresoreriePageProps = {
    caisseBalance: number;
    baridiBalance: number;
    totalDettes: number;
    totalAvances: number;
    investorLiability?: number;
    investorBreakdown?: { capital: number; profits: number; total: number };
    portfolioValue: number;
    openTreasuryModal: () => void;
    treasuryCards: TreasuryCard[];
    openTreasuryCardModal: (card?: TreasuryCard) => void;
    setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
    openTreasuryBalanceEditModal: (asset: 'Caisse' | 'BaridiMob') => void;
    openDeliveryExpenseModal?: () => void;
    servicesSummary?: { netCapitalImpact?: number };
    treasuryTransactions?: TreasuryTx[];
};
export function TresoreriePage({ caisseBalance, baridiBalance, totalDettes, totalAvances, investorLiability = 0, investorBreakdown, portfolioValue, treasuryCards, openTreasuryCardModal, setTreasuryCardToDelete, openTreasuryBalanceEditModal, openDeliveryExpenseModal, servicesSummary, treasuryTransactions = [] }: TresoreriePageProps) {
    const { t } = useLanguage();

    // Last 7 days cash flow
    const weeklyFlow = useMemo(() => {
        const now = new Date();
        const todayDow = now.getDay(); // 0=Sun..6=Sat
        const result = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
            d.setHours(0, 0, 0, 0);
            const dayStart = d.getTime();
            const dayEnd = dayStart + 86_400_000 - 1;
            const dow = d.getDay();
            return { dayStart, dayEnd, label: DAY_SHORT[dow === 0 ? 6 : dow - 1], isToday: i === 6, cashIn: 0, cashOut: 0 };
        });
        for (const tx of treasuryTransactions) {
            if (!tx.timestamp) continue;
            const slot = result.find((r) => tx.timestamp >= r.dayStart && tx.timestamp <= r.dayEnd);
            if (!slot) continue;
            const amount = Number(tx.amount || 0);
            if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)') slot.cashIn += amount;
            else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)') slot.cashOut += amount;
        }
        const maxVal = Math.max(...result.flatMap((r) => [r.cashIn, r.cashOut]), 1);
        return { days: result, maxVal, totalIn: result.reduce((s, r) => s + r.cashIn, 0), totalOut: result.reduce((s, r) => s + r.cashOut, 0) };
    }, [treasuryTransactions]);
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
        // Split investor liability: capital invested vs undistributed profits
        { label: 'Capital investisseurs', value: investorBreakdown?.capital ?? capitalSnapshot.investorLiability, currency: 'DZD' as const, semantic: 'loss' as const, hideWhenZero: true },
        { label: 'Profits non retirés', value: investorBreakdown?.profits ?? 0, currency: 'DZD' as const, semantic: 'loss' as const, hideWhenZero: true },
        { label: t('common.caisseBalance') as string, value: caisseBalance, currency: 'DZD' as const, semantic: 'plain' as const },
        { label: t('common.baridiBalance') as string, value: baridiBalance, currency: 'DZD' as const, semantic: 'plain' as const },
        { label: t('finance.stock') as string, value: portfolioValue, currency: 'DZD' as const, semantic: 'plain' as const, hideWhenZero: true },
        { label: t('finance.treasuryCards') as string, value: capitalSnapshot.treasuryCardsTotal, currency: 'DZD' as const, semantic: 'plain' as const, hideWhenZero: true },
        { label: t('nav.services') as string, value: capitalSnapshot.servicesCapitalImpact, currency: 'DZD' as const, semantic: 'auto' as const, hideWhenZero: true },
        { label: t('finance.netPosition') as string, value: capitalSnapshot.netClientPosition, currency: 'DZD' as const, semantic: 'auto' as const, hideWhenZero: true }
    ].filter((item) => !item.hideWhenZero || Math.abs(item.value) > 0.005);
    return (<div className="anim-page-in space-y-5">
      <HeroKpiCard accent="sky" icon={<LandmarkIcon className="w-5 h-5"/>} primaryLabel={t('treasury.totalCapital') as string} primaryValue={capitalSnapshot.totalCapital} primaryCurrency="DZD" primarySemantic="plain" secondary={secondaryItems}/>

      {weeklyFlow.days.some((d) => d.cashIn > 0 || d.cashOut > 0) && (
        <Card>
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading icon={<ArrowUpRightIcon className="w-4 h-4"/>}>Flux 7 jours</SectionHeading>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-financial-profit inline-block"/><CurrencyAmount value={weeklyFlow.totalIn} currency="DZD" size="sm" decimals={0}/></span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-financial-loss inline-block"/><CurrencyAmount value={weeklyFlow.totalOut} currency="DZD" size="sm" decimals={0}/></span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex items-end gap-1 h-14">
              {weeklyFlow.days.map((day, i) => {
                const inH = day.cashIn > 0 ? Math.max(6, (day.cashIn / weeklyFlow.maxVal) * 52) : 0;
                const outH = day.cashOut > 0 ? Math.max(6, (day.cashOut / weeklyFlow.maxVal) * 52) : 0;
                return (
                  <div key={i} className={`flex flex-1 flex-col items-center gap-0.5 ${day.isToday ? 'opacity-100' : 'opacity-70'}`}>
                    <div className="flex w-full flex-1 items-end justify-center gap-px">
                      {inH > 0 && <div className={`w-[40%] max-w-[10px] rounded-sm ${day.isToday ? 'bg-financial-profit' : 'bg-financial-profit/60'}`} style={{ height: `${inH}px` }}/>}
                      {outH > 0 && <div className={`w-[40%] max-w-[10px] rounded-sm ${day.isToday ? 'bg-financial-loss' : 'bg-financial-loss/60'}`} style={{ height: `${outH}px` }}/>}
                    </div>
                    <span className={`text-[9px] font-semibold ${day.isToday ? 'text-primary' : 'text-neutral-400'}`}>{day.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <TreasurySummarySection caisseBalance={caisseBalance} baridiBalance={baridiBalance} dettesAbs={capitalSnapshot.receivables} totalAvances={capitalSnapshot.clientAdvances} investorLiability={capitalSnapshot.investorLiability} servicesCapitalImpact={capitalSnapshot.servicesCapitalImpact} openTreasuryBalanceEditModal={openTreasuryBalanceEditModal} openDeliveryExpenseModal={openDeliveryExpenseModal} deliveryExpenseLabel={t('delivery.addExpense') as string}/>

      <TreasuryCollectionsSection treasuryCards={treasuryCards} openTreasuryCardModal={openTreasuryCardModal} setTreasuryCardToDelete={setTreasuryCardToDelete}/>
    </div>);
}
