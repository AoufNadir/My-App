import { CurrencyAmount } from '../financial/CurrencyAmount';
import type { WeeklyRecap } from '../../hooks/useWeeklyRecap';

interface WeeklyRecapBannerProps {
    recap: WeeklyRecap | null;
    onDismiss: () => void;
}

export function WeeklyRecapBanner({ recap, onDismiss }: WeeklyRecapBannerProps) {
    if (!recap) return null;
    return (
        <div role="status" aria-live="polite" className="anim-fade-slide-down relative mb-4 overflow-hidden rounded-xl bg-surface p-4 text-neutral-900 ring-1 ring-primary/25 sm:p-5">
            <div className="absolute inset-0 -z-10 bg-primary/8"/>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    {/* Header */}
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/70">
                        📋 Récap semaine
                    </p>
                    <h3 className="mt-0.5 text-sm font-bold text-neutral-700">{recap.weekLabel}</h3>

                    {/* Profit — primary highlight */}
                    <div className="mt-2">
                        <CurrencyAmount value={recap.profit} currency="DZD" semantic="auto" size="xl" showSign/>
                    </div>

                    {/* Stats row */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                        <span className="font-semibold">{recap.sellCount} vente{recap.sellCount > 1 ? 's' : ''}</span>
                        {recap.usdtSold > 0 && (
                            <span dir="ltr">{recap.usdtSold.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} USDT</span>
                        )}
                        {recap.eurSold > 0 && (
                            <span dir="ltr">{recap.eurSold.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} EUR</span>
                        )}
                        <span>{recap.activeDays} j. actif{recap.activeDays > 1 ? 's' : ''}</span>
                    </div>

                    {/* Top client */}
                    {recap.topClientName && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                            <span className="text-[10px] font-bold uppercase text-primary/60">🏆 Top client</span>
                            <span className="text-sm font-bold text-neutral-800 truncate">{recap.topClientName}</span>
                            {recap.topClientProfit > 0 && (
                                <CurrencyAmount value={recap.topClientProfit} currency="DZD" semantic="profit" size="sm" decimals={0} showSign/>
                            )}
                        </div>
                    )}
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
