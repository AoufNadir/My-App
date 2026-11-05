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

    // V11-3: the panel no longer advises a price or fills the field. It still computes the quote that the sale keeps
    // (credit-risk confirmation, stored snapshot) and says, in short lines, when the price loses money or sits under the floor.
    if (!smartPricing || !quote) return null;
    if (smartPricing.pam <= 0) {
        return <p className="rounded-xl bg-warning-bg px-3 py-2 text-xs font-semibold text-warning">{t('smartPricing.noPam')}</p>;
    }
    const importantReasons = quote.reasonCodes.filter((reason) => IMPORTANT_REASONS.has(reason));
    const hasWarning = quote.actual.belowPam || quote.actual.belowFloor || importantReasons.length > 0;
    if (!hasWarning) return null;
    return (
        <div role="alert" aria-live="polite" className="space-y-1 rounded-card border border-border bg-surface px-3 py-2 text-xs">
            {quote.actual.belowPam && <p className="font-bold text-financial-loss">⛔ {t('smartPricing.belowPam')}</p>}
            {!quote.actual.belowPam && quote.actual.belowFloor && <p className="font-bold text-financial-loss">⚠ {t('smartPricing.belowFloor')}</p>}
            {importantReasons.map((reason) => (
                <p key={reason} className="font-semibold text-warning">⚠ {t(`smartPricing.reasons.${reason}`)}</p>
            ))}
        </div>
    );
}
