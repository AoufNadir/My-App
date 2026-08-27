import { CurrencyAmount } from '../financial/CurrencyAmount';
import type { MonthlyRecap } from '../../hooks/useMonthlyRecap';
interface MonthlyRecapBannerProps {
    recap: MonthlyRecap | null;
    onDismiss: () => void;
}
export function MonthlyRecapBanner({ recap, onDismiss }: MonthlyRecapBannerProps) {
    if (!recap) return null;
    return (<div role="status" aria-live="polite" className="anim-fade-slide-down relative mb-4 overflow-hidden rounded-lg bg-surface p-4 text-neutral-900 ring-1 ring-primary/20 sm:p-5">
        <div className="absolute inset-0 -z-10 bg-primary/10"/>
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Récap mensuel
                </p>
                <h3 className="mt-1 text-base font-semibold">{recap.monthLabel}</h3>
                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                    <CurrencyAmount value={recap.profit} currency="DZD" semantic="auto" size="xl" showSign/>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                    {recap.sellCount} vente{recap.sellCount > 1 ? 's' : ''} ·{' '}
                    {recap.usdtSold.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} USDT
                </p>
            </div>
            <button type="button" onClick={onDismiss} aria-label="Fermer" className="min-h-touch min-w-touch shrink-0 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    </div>);
}
