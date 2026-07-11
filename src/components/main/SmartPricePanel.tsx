import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatNumber } from '../../pages/shared/pageFormat';
import {
    quoteSale,
    toSaleSnapshot,
    type CustomerSegment,
    type MarketStatus,
    type PricingContext,
    type PricingOverride,
    type PricingReasonCode,
    type SmartPaymentStatus,
    type SmartSaleSnapshot,
} from '../../services/smartPricingEngine';

const fmt0 = (n: number) => formatNumber(n, { min: 0, max: 0 });
const fmt2 = (n: number) => formatNumber(n, { min: 2, max: 2 });
const fmtPrice = (n: number) => Number.isInteger(n) ? `${n}` : fmt2(n);

type PriceSource = 'opening' | 'target' | 'floor' | 'manual';

type Props = {
    smartPricing: PricingContext | null | undefined;
    currency: 'USDT' | 'EUR';
    clientId: string;
    quantity: number;
    payment: SmartPaymentStatus;
    creditDueDate?: string;
    available: number;
    currentPrice: number;
    isEditing: boolean;
    onApplyPrice: (price: number, source: Exclude<PriceSource, 'manual'>) => void;
    smartQuoteRef?: React.MutableRefObject<SmartSaleSnapshot | null>;
    marketOverride?: PricingOverride;
    clientOverride?: PricingOverride;
    compact?: boolean;
};

const MARKET_CLS: Record<MarketStatus, string> = {
    rising: 'bg-warning/10 text-warning',
    falling: 'bg-danger-bg text-financial-loss',
    stable: 'bg-financial-profit-bg text-financial-profit',
    volatile: 'bg-secondary/10 text-secondary',
    unknown: 'bg-neutral-100 text-neutral-500',
};

const SEGMENT_CLS: Record<CustomerSegment, string> = {
    vip: 'bg-amber-100 text-amber-700',
    good: 'bg-financial-profit-bg text-financial-profit',
    normal: 'bg-primary/10 text-primary',
    weak: 'bg-warning/10 text-warning',
    risky: 'bg-danger-bg text-financial-loss',
    new: 'bg-neutral-100 text-neutral-500',
};

const IMPORTANT_REASONS = new Set<PricingReasonCode>([
    'credit_high_utilization', 'credit_over_limit', 'credit_overdue', 'credit_serious_overdue',
    'credit_term_estimated',
    'falling_prefer_cash', 'volatile_no_credit', 'goal_above_market_range', 'goal_volume_missing',
    'insufficient_stock', 'small_qty_no_vip',
]);

export function SmartPricePanel({
    smartPricing, currency, clientId, quantity, payment, creditDueDate,
    available, currentPrice, isEditing, onApplyPrice, smartQuoteRef,
    marketOverride, clientOverride, compact = false,
}: Props) {
    const { t } = useLanguage();
    const [showDetails, setShowDetails] = React.useState(false);
    const lastAppliedPriceRef = React.useRef<number | null>(null);
    const lastAppliedSourceRef = React.useRef<Exclude<PriceSource, 'manual'>>('target');
    /** clientId whose target already got its one-shot prefill this mount. */
    const autoFilledClientRef = React.useRef<string | null>(null);

    const quote = React.useMemo(() => {
        if (!smartPricing || clientId === 'none' || quantity <= 0) return null;
        const followsApplied = lastAppliedPriceRef.current !== null && Math.abs(currentPrice - lastAppliedPriceRef.current) < 0.001;
        return quoteSale(smartPricing, {
            currency,
            clientId,
            quantity,
            payment: { kind: payment, dueDate: creditDueDate },
            available,
            actualUnitPrice: currentPrice > 0 ? currentPrice : undefined,
            actualPriceSource: currentPrice > 0 ? (followsApplied ? lastAppliedSourceRef.current : 'manual') : 'target',
            marketOverride,
            clientOverride,
        });
    }, [smartPricing, clientId, quantity, currency, payment, creditDueDate, available, currentPrice, marketOverride, clientOverride]);

    React.useEffect(() => {
        if (!smartQuoteRef) return;
        smartQuoteRef.current = quote && !isEditing ? toSaleSnapshot(quote) : null;
        return () => { smartQuoteRef.current = null; };
    }, [quote, isEditing, smartQuoteRef]);

    // Suggest, never force: fill the target price ONCE per client per mount,
    // then never touch the field again — the user edits freely or taps a
    // corridor button. A price already present at the first ready quote
    // (manual typing, prefill, edit mode) is never overwritten.
    React.useEffect(() => {
        if (!quote || quote.status !== 'ready' || isEditing) return;
        if (autoFilledClientRef.current === clientId) return;
        const isFirstReadyQuote = autoFilledClientRef.current === null;
        autoFilledClientRef.current = clientId;
        if (isFirstReadyQuote && currentPrice > 0) return;
        lastAppliedPriceRef.current = quote.corridor.targetPrice;
        lastAppliedSourceRef.current = 'target';
        onApplyPrice(quote.corridor.targetPrice, 'target');
    }, [quote, clientId, isEditing, currentPrice, onApplyPrice]);

    if (!smartPricing) return null;
    if (smartPricing.pam <= 0) {
        return <p className="rounded-xl bg-warning-bg px-3 py-2 text-xs font-semibold text-warning">{t('smartPricing.noPam')}</p>;
    }
    if (!quote) {
        return compact ? null : (
            <p className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-neutral-500">
                {t('smartPricing.setupHint')}
            </p>
        );
    }
    const marketLabel = t(`smartPricing.market.${quote.market.effective}`);
    const segmentLabel = t(`smartPricing.segment.${quote.client.pricedAs}`);
    const importantReasons = quote.reasonCodes.filter((reason) => IMPORTANT_REASONS.has(reason));
    const corridor = [
        { source: 'opening' as const, label: t('smartPricing.opening'), price: quote.corridor.openingPrice },
        { source: 'target' as const, label: t('smartPricing.target'), price: quote.corridor.targetPrice },
        { source: 'floor' as const, label: t('smartPricing.floor'), price: quote.corridor.floorPrice },
    ];
    // Highlight follows the ACTUAL field value: the button matching the current
    // price lights up; a manual price matching none leaves all buttons plain.
    // lastAppliedSourceRef breaks ties when corridor prices collapse together.
    const priceMatches = currentPrice > 0 ? corridor.filter((item) => Math.abs(currentPrice - item.price) < 0.001) : [];
    const selectedSource = priceMatches.length === 0 ? null
        : (priceMatches.find((item) => item.source === lastAppliedSourceRef.current) ?? priceMatches[0]).source;

    return (
        <section aria-label={t('smartPricing.title')} className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-extrabold text-neutral-800">{t('smartPricing.title')}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${MARKET_CLS[quote.market.effective]}`}>{marketLabel}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${SEGMENT_CLS[quote.client.pricedAs]}`}>
                    {segmentLabel}{quote.client.score !== null ? ` · ${quote.client.score}` : ''}
                </span>
                {(quote.market.confidence === 'low' || smartPricing.history.confidence === 'low') && (
                    <span className="rounded-full bg-warning-bg px-2 py-1 text-[10px] font-bold text-warning">{t('smartPricing.lowConfidence')}</span>
                )}
            </div>

            <p className="text-xs leading-relaxed text-neutral-600">
                {t(`smartPricing.reasons.market_${quote.market.effective}`)}{' '}
                {quote.goal.volumeMissing ? t('smartPricing.reasons.goal_volume_missing') : t('smartPricing.subtitle')}
            </p>

            <div role="group" aria-label={t('smartPricing.title')} className="grid grid-cols-3 gap-2">
                {corridor.map((item) => {
                    const selected = item.source === selectedSource;
                    return (
                        <button
                            key={item.source}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => { lastAppliedPriceRef.current = item.price; lastAppliedSourceRef.current = item.source; onApplyPrice(item.price, item.source); }}
                            className={`min-h-touch rounded-xl border px-1 py-2 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${selected
                                ? 'border-primary bg-primary text-white'
                                : 'border-border bg-surface text-neutral-700 hover:bg-neutral-50'}`}
                        >
                            <span className={`block text-[10px] font-semibold ${selected ? 'text-white/80' : 'text-neutral-400'}`}>{item.label}</span>
                            <span dir="ltr" className="block text-base font-black tabular-nums">{fmtPrice(item.price)}</span>
                        </button>
                    );
                })}
            </div>

            <div aria-live="polite" className="space-y-1 text-[11px] text-neutral-500">
                <p dir="ltr">
                    {t('smartPricing.pam')}: <b>{fmt2(quote.pam)}</b>
                    <span className="mx-1.5 text-neutral-300">·</span>
                    <span className="font-bold text-financial-profit">{t('smartPricing.expectedProfit')} +{fmt0(quote.goal.expectedProfit)}</span>
                    {quote.goal.coveragePct !== null && quote.goal.coveragePct > 0 && (
                        <span> ({quote.goal.coveragePct}% {t('smartPricing.goalCoverage')})</span>
                    )}
                </p>
                {quote.actual.belowPam && <p role="alert" className="font-bold text-financial-loss">⛔ {t('smartPricing.belowPam')}</p>}
                {!quote.actual.belowPam && quote.actual.belowFloor && <p role="alert" className="font-bold text-financial-loss">⚠ {t('smartPricing.belowFloor')}</p>}
                {!quote.actual.belowFloor && quote.actual.deviationPerUnit > 0.01 && <p className="font-semibold text-warning">⚠ {t('smartPricing.belowTarget')} −{fmt0(quote.actual.negotiationLoss)} DZD</p>}
                {importantReasons.map((reason) => (
                    <p key={reason} className="font-semibold text-warning">⚠ {t(`smartPricing.reasons.${reason}`)}</p>
                ))}
            </div>

            {!compact && (
                <div className="border-t border-primary/10 pt-2">
                    <button type="button" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails}
                        className="min-h-touch text-xs font-bold text-primary">
                        {showDetails ? t('smartPricing.hideDetails') : t('smartPricing.why')}
                    </button>
                    {showDetails && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-surface-muted p-3 text-[11px] text-neutral-600">
                            <span>{t('smartPricing.marketOverride')}</span><b>{marketLabel}</b>
                            <span>{t('smartPricing.clientOverride')}</span><b>{segmentLabel}</b>
                            <span>{t('smartPricing.quantity')}</span><b dir="ltr">{fmt0(quantity)} {currency}</b>
                            <span>{t('smartPricing.payment')}</span><b>{t(`smartPricing.${payment}`)}</b>
                            <span>{t('smartPricing.reasons.goal_raised_target')}</span><b dir="ltr">+{fmt2(quote.breakdown.targetGoalShift)}</b>
                            <span>{t('smartPricing.reasons.credit_financing_cost')}</span><b dir="ltr">+{fmt2(quote.breakdown.financingPremium)}</b>
                            <span>{t('smartPricing.reasons.learned_opening_buffer')}</span><b dir="ltr">+{fmt2(quote.breakdown.negotiationBuffer)}</b>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
