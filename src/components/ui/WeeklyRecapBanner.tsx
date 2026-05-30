import { CurrencyAmount } from '../financial/CurrencyAmount';
import type { WeeklyRecap } from '../../hooks/useWeeklyRecap';

interface WeeklyRecapBannerProps {
    recap: WeeklyRecap | null;
    onDismiss: () => void;
}

export function WeeklyRecapBanner({ recap, onDismiss }: WeeklyRecapBannerProps) {
    if (!recap) return null;
    return (
        <div role="status" aria-live="polite" className="anim-fade-slide-down relative mb-4 overflow-hidden rounded-lg bg-surface p-4 text-neutral-900 ring-1 ring-primary/20 sm:p-5">
            <div className="absolute inset-0 -z-10 bg-primary/8"/>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        Récap semaine
                    </p>
                    <h3 className="mt-1 text-base font-semibold">{recap.weekLabel}</h3>
                    <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                        <CurrencyAmount value={recap.profit} currency="DZD" semantic="auto" size="xl" showSign/>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                        <span>{recap.sellCount} vente{recap.sellCount > 1 ? 's' : ''}</span>
                        {recap.usdtSold > 0 && (
                            <span dir="ltr">{recap.usdtSold.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} USDT</span>
                        )}
                        {recap.eurSold > 0 && (
                            <span dir="ltr">{recap.eurSold.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} EUR</span>
                        )}
                        <span>{recap.activeDays} jour{recap.activeDays > 1 ? 's' : ''} actif{recap.activeDays > 1 ? 's' : ''}</span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Fermer"
                    className="min-h-touch min-w-touch shrink-0 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>
    );
}
