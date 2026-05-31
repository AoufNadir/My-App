import { useState, useMemo } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { MoneyField } from '../ui/MoneyField';
import { parseAndEvaluate } from '../../utils';
import { formatNumber } from '../../pages/shared/pageFormat';

const fmt0 = (n: number) => formatNumber(n, { min: 0, max: 0 });
const fmt2 = (n: number) => formatNumber(n, { min: 2, max: 2 });

type Currency = 'USDT' | 'EUR';
type Mode = 'normal' | 'inverse' | 'assisted';
type ClientTier = 'vip' | 'regular' | 'new' | 'none';

const TIER_MULTIPLIER: Record<ClientTier, number> = {
    vip:     0.85,
    regular: 1.0,
    new:     1.10,
    none:    1.0,
};
const TIER_LABELS: Record<ClientTier, string> = {
    vip:     '🏆 VIP',
    regular: '⭐ Régulier',
    new:     '🆕 Nouveau',
    none:    '—',
};

type PortfolioSide = { available: number; avgBuy: number };

type PricingContext = {
    dailyNeeded: number;
    avgMarginPerUsdt: number;
    avgMonthlyUsdtSold: number;
    monthlyGoal: number;
    monthToDateProfit: number;
    monthToDateUsdtSold: number;
    dayOfMonth: number;
    daysInMonth: number;
    daysRemaining: number;
    fallbackMargin: number;
};

type QuickCalculatorSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    portfolioStats: { usdt: PortfolioSide; eur: PortfolioSide };
    pricingContext?: PricingContext;
};

export function QuickCalculatorSheet({ isOpen, onClose, portfolioStats, pricingContext }: QuickCalculatorSheetProps) {
    const [currency, setCurrency] = useState<Currency>('USDT');
    const [mode, setMode] = useState<Mode>('normal');
    const [quantity, setQuantity] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [targetProfit, setTargetProfit] = useState('');
    const [clientTier, setClientTier] = useState<ClientTier>('none');

    const stats = currency === 'USDT' ? portfolioStats.usdt : portfolioStats.eur;
    const pam = stats.avgBuy;
    const available = stats.available;

    const resetInputs = () => { setQuantity(''); setSellPrice(''); setTargetProfit(''); };

    // ── Normal mode ──────────────────────────────────────────────────────────
    const normalCalc = useMemo(() => {
        if (mode !== 'normal') return null;
        const qty = parseAndEvaluate(quantity);
        const price = parseAndEvaluate(sellPrice);
        if (qty <= 0 || price <= 0 || pam <= 0) return null;
        const revenue = qty * price;
        const cost = qty * pam;
        const profit = revenue - cost;
        const margin = ((price - pam) / pam) * 100;
        return { qty, price, revenue, cost, profit, margin, profitPerUnit: price - pam };
    }, [quantity, sellPrice, pam, mode]);

    // ── Inverse mode ─────────────────────────────────────────────────────────
    const inverseCalc = useMemo(() => {
        if (mode !== 'inverse') return null;
        const qty = parseAndEvaluate(quantity);
        const target = parseAndEvaluate(targetProfit);
        if (qty <= 0 || pam <= 0) return null;
        const requiredPrice = pam + (target > 0 ? target / qty : 0);
        const margin = pam > 0 ? ((requiredPrice - pam) / pam) * 100 : 0;
        const profitPerUnit = requiredPrice - pam;
        return { qty, target, requiredPrice, margin, profitPerUnit, revenue: qty * requiredPrice, cost: qty * pam };
    }, [quantity, targetProfit, pam, mode]);

    // ── Assisted mode ────────────────────────────────────────────────────────
    const assistedCalc = useMemo(() => {
        if (mode !== 'assisted' || pam <= 0 || !pricingContext) return null;
        const qty = available; // always use full available stock as reference
        if (qty <= 0) return null;

        const ctx = pricingContext;
        const tierMult = TIER_MULTIPLIER[clientTier];
        const baseMargin = ctx.avgMarginPerUsdt > 0
            ? ctx.avgMarginPerUsdt
            : ctx.fallbackMargin;

        // 1) Prix minimal — cover today's daily needed
        const minMargin = ctx.dailyNeeded > 0 ? ctx.dailyNeeded / qty : baseMargin * 0.7;
        const minPrice = pam + Math.max(minMargin, 0.5);

        // 2) Prix recommandé — historical margin × client tier
        const recPrice = pam + baseMargin * tierMult;

        // 3) Prix objectif — reach monthly goal on time
        const goalRemaining = ctx.monthlyGoal > 0
            ? Math.max(0, ctx.monthlyGoal - ctx.monthToDateProfit)
            : 0;
        const estimatedVol = Math.max(
            ctx.avgMonthlyUsdtSold - ctx.monthToDateUsdtSold,
            qty
        );
        const goalMargin = goalRemaining > 0 && estimatedVol > 0
            ? goalRemaining / estimatedVol
            : baseMargin * 1.2;
        const goalPrice = pam + Math.max(goalMargin, recPrice - pam);

        const goalPct = ctx.monthlyGoal > 0
            ? Math.min(100, Math.round((ctx.monthToDateProfit / ctx.monthlyGoal) * 100))
            : null;

        return {
            qty,
            minPrice: Math.max(minPrice, pam + 0.5),
            recPrice: Math.max(recPrice, minPrice),
            goalPrice: Math.max(goalPrice, recPrice),
            minProfit: (Math.max(minPrice, pam + 0.5) - pam) * qty,
            recProfit: (Math.max(recPrice, minPrice) - pam) * qty,
            goalProfit: (Math.max(goalPrice, recPrice) - pam) * qty,
            baseMargin,
            goalPct,
            daysRemaining: ctx.daysRemaining,
            dailyNeeded: ctx.dailyNeeded,
        };
    }, [mode, pam, available, pricingContext, clientTier]);

    const segBtn = (active: boolean) =>
        `flex-1 min-h-[40px] rounded-lg text-sm font-bold transition-colors ${active ? 'bg-primary text-white' : 'text-neutral-600 hover:text-neutral-800'}`;

    const modeBtn = (active: boolean, color: string) =>
        `flex-1 min-h-[38px] rounded-lg text-xs font-bold transition-colors border ${active ? `${color} border-transparent` : 'text-neutral-500 border-border bg-surface hover:bg-neutral-50'}`;

    const applyPrice = (price: number) => {
        setSellPrice(price.toFixed(2));
        setMode('normal');
    };

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title="Calculatrice rapide" className="max-w-lg mx-auto">
            <div className="px-4 pb-6 space-y-4">

                {/* Currency */}
                <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
                    <button type="button" onClick={() => { setCurrency('USDT'); resetInputs(); }} className={segBtn(currency === 'USDT')}>USDT</button>
                    <button type="button" onClick={() => { setCurrency('EUR'); resetInputs(); }} className={segBtn(currency === 'EUR')}>EUR</button>
                </div>

                {/* Mode */}
                <div className="flex gap-2">
                    <button type="button" onClick={() => { setMode('normal'); resetInputs(); }} className={modeBtn(mode === 'normal', 'bg-primary/10 text-primary')}>📊 Normal</button>
                    <button type="button" onClick={() => { setMode('inverse'); resetInputs(); }} className={modeBtn(mode === 'inverse', 'bg-secondary/10 text-secondary')}>🎯 Inverse</button>
                    {currency === 'USDT' && (
                        <button type="button" onClick={() => { setMode('assisted'); resetInputs(); }} className={modeBtn(mode === 'assisted', 'bg-warning/10 text-warning border-warning/30')}>✨ Assisté</button>
                    )}
                </div>

                {/* PAM info */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted px-4 py-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wide">PAM actuel</p>
                        <p dir="ltr" className="text-xl font-extrabold text-neutral-800 tabular-nums mt-0.5">{fmt2(pam)} DZD</p>
                    </div>
                    <div className="text-end">
                        <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wide">Stock</p>
                        <p dir="ltr" className="text-sm font-semibold text-neutral-600 tabular-nums mt-0.5">{fmt2(available)} {currency}</p>
                    </div>
                </div>

                {/* ── NORMAL MODE ── */}
                {mode === 'normal' && (<>
                    <div className="space-y-3">
                        <MoneyField label={`Quantité (${currency})`} value={quantity} onChange={setQuantity}
                            currency={currency} onMax={() => setQuantity(available.toFixed(2))} placeholder="Ex: 500"/>
                        <div>
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-neutral-700">Prix de vente (DZD)</span>
                                {pam > 0 && <button type="button" onClick={() => setSellPrice(pam.toFixed(2))} className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-info-bg text-info hover:bg-primary/10 transition-colors">= PAM</button>}
                            </div>
                            <MoneyField label="" value={sellPrice} onChange={setSellPrice} className="-mt-2" placeholder="Ex: 262.50"/>
                        </div>
                    </div>
                    {normalCalc ? (
                        <div className="space-y-3">
                            <div className={`rounded-xl px-4 py-4 ${normalCalc.profit >= 0 ? 'bg-financial-profit-bg' : 'bg-financial-loss-bg'}`}>
                                <p className={`text-[11px] font-bold uppercase tracking-wide ${normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>Profit estimé</p>
                                <p dir="ltr" className={`text-3xl font-extrabold tabular-nums mt-1 ${normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                    {normalCalc.profit >= 0 ? '+' : ''}{fmt0(normalCalc.profit)} DZD
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl border border-border bg-surface-muted p-3">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Hامش/unité</p>
                                    <p dir="ltr" className={`text-base font-bold mt-1 ${normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>{normalCalc.profitPerUnit >= 0 ? '+' : ''}{fmt2(normalCalc.profitPerUnit)} DZD</p>
                                </div>
                                <div className="rounded-xl border border-border bg-surface-muted p-3">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Marge %</p>
                                    <p dir="ltr" className={`text-base font-bold mt-1 ${normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>{normalCalc.margin >= 0 ? '+' : ''}{fmt2(normalCalc.margin)}%</p>
                                </div>
                                <div className="rounded-xl border border-border bg-surface-muted p-3">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Recette brute</p>
                                    <p dir="ltr" className="text-base font-semibold mt-1 text-neutral-800">{fmt0(normalCalc.revenue)} DZD</p>
                                </div>
                                <div className="rounded-xl border border-border bg-surface-muted p-3">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Coût de revient</p>
                                    <p dir="ltr" className="text-base font-semibold mt-1 text-neutral-800">{fmt0(normalCalc.cost)} DZD</p>
                                </div>
                            </div>
                            <p className="text-center text-[11px] text-neutral-400">
                                Seuil de rentabilité : <span dir="ltr" className="font-semibold text-neutral-600">{fmt2(pam)} DZD/{currency}</span>
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-400">
                            Entrez une quantité et un prix pour voir le résultat
                        </div>
                    )}
                </>)}

                {/* ── INVERSE MODE ── */}
                {mode === 'inverse' && (<>
                    <div className="rounded-xl border border-secondary/20 bg-secondary/5 px-3 py-2 text-xs text-secondary font-medium">
                        🎯 Mode inverse : entrez votre profit cible → obtenez le prix à afficher
                    </div>
                    <div className="space-y-3">
                        <MoneyField label={`Quantité à vendre (${currency})`} value={quantity} onChange={setQuantity}
                            currency={currency} onMax={() => setQuantity(available.toFixed(2))} placeholder="Ex: 500"/>
                        <MoneyField label="Profit cible (DZD)" value={targetProfit} onChange={setTargetProfit} currency="DZD" placeholder="Ex: 5 000"/>
                    </div>
                    {inverseCalc && parseAndEvaluate(quantity) > 0 ? (
                        <div className="space-y-3">
                            <div className="rounded-xl bg-secondary/10 px-4 py-4 border border-secondary/20">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">Prix de vente requis</p>
                                <p dir="ltr" className="text-3xl font-extrabold tabular-nums mt-1 text-neutral-900">{fmt2(inverseCalc.requiredPrice)} DZD</p>
                                <p className="text-[11px] text-neutral-500 mt-1">pour un profit de {fmt0(inverseCalc.target > 0 ? inverseCalc.target : 0)} DZD</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl border border-border bg-surface-muted p-3">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Hامش/unité</p>
                                    <p dir="ltr" className="text-base font-bold mt-1 text-financial-profit">+{fmt2(inverseCalc.profitPerUnit)} DZD</p>
                                </div>
                                <div className="rounded-xl border border-border bg-surface-muted p-3">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Marge %</p>
                                    <p dir="ltr" className="text-base font-bold mt-1 text-financial-profit">+{fmt2(inverseCalc.margin)}%</p>
                                </div>
                                <div className="rounded-xl border border-border bg-surface-muted p-3">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Recette totale</p>
                                    <p dir="ltr" className="text-base font-semibold mt-1 text-neutral-800">{fmt0(inverseCalc.revenue)} DZD</p>
                                </div>
                                <div className="rounded-xl border border-border bg-surface-muted p-3">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">PAM (coût)</p>
                                    <p dir="ltr" className="text-base font-semibold mt-1 text-neutral-800">{fmt2(pam)} DZD</p>
                                </div>
                            </div>
                            <p className="text-center text-[11px] text-neutral-400">
                                Formule : PAM ({fmt2(pam)}) + Profit/Qté = {fmt2(inverseCalc.requiredPrice)} DZD/USDT
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-400">
                            Entrez une quantité et un profit cible
                        </div>
                    )}
                </>)}

                {/* ── ASSISTED MODE ── */}
                {mode === 'assisted' && (<>
                    <div className="rounded-xl border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning font-medium">
                        ✨ Mode assisté : 3 scénarios de prix selon votre historique et vos objectifs
                    </div>

                    {/* Client tier selector */}
                    <div>
                        <p className="text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wide">Type de client</p>
                        <div className="grid grid-cols-4 gap-1.5">
                            {(['vip', 'regular', 'new', 'none'] as ClientTier[]).map(tier => (
                                <button key={tier} type="button"
                                    onClick={() => setClientTier(tier)}
                                    className={`rounded-lg py-2 text-[11px] font-bold border transition-colors ${clientTier === tier ? 'bg-primary text-white border-primary' : 'border-border text-neutral-500 hover:border-primary/50'}`}>
                                    {TIER_LABELS[tier]}
                                </button>
                            ))}
                        </div>
                        {clientTier !== 'none' && (
                            <p className="text-[10px] text-neutral-400 mt-1 text-center">
                                {clientTier === 'vip' ? '−15% sur le hامش (fidélité récompensée)' :
                                 clientTier === 'new' ? '+10% sur le hامش (client sans historique)' :
                                 'Hامش standard basé sur votre historique'}
                            </p>
                        )}
                    </div>

                    {!pricingContext ? (
                        <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-400">
                            Données insuffisantes — effectuez quelques ventes pour activer ce mode
                        </div>
                    ) : assistedCalc ? (
                        <div className="space-y-3">

                            {/* Scenario 1 — minimal */}
                            <div className="rounded-xl border border-border bg-surface-muted p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-neutral-400">📉 Prix minimal</p>
                                        <p className="text-[10px] text-neutral-400">Couvre le besoin du jour</p>
                                    </div>
                                    <div className="text-end">
                                        <p dir="ltr" className="text-lg font-extrabold text-neutral-700 tabular-nums">{fmt2(assistedCalc.minPrice)} DZD</p>
                                        <p dir="ltr" className="text-[11px] text-neutral-500">+{fmt0(assistedCalc.minProfit)} DZD</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => applyPrice(assistedCalc.minPrice)}
                                    className="w-full rounded-lg border border-border bg-surface py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">
                                    → Utiliser ce prix
                                </button>
                            </div>

                            {/* Scenario 2 — recommended (highlighted) */}
                            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 ring-1 ring-primary/20">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[10px] font-bold uppercase text-primary">📊 Prix recommandé</p>
                                            <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[9px] font-bold text-primary">CONSEILLÉ</span>
                                        </div>
                                        <p className="text-[10px] text-neutral-400">Votre historique × {TIER_LABELS[clientTier]}</p>
                                    </div>
                                    <div className="text-end">
                                        <p dir="ltr" className="text-lg font-extrabold text-primary tabular-nums">{fmt2(assistedCalc.recPrice)} DZD</p>
                                        <p dir="ltr" className="text-[11px] text-financial-profit">+{fmt0(assistedCalc.recProfit)} DZD</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => applyPrice(assistedCalc.recPrice)}
                                    className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-white hover:bg-primary-dark transition-colors">
                                    → Utiliser ce prix
                                </button>
                            </div>

                            {/* Scenario 3 — goal price */}
                            {pricingContext.monthlyGoal > 0 && (
                                <div className="rounded-xl border border-financial-profit/20 bg-financial-profit-bg p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-financial-profit">🎯 Prix objectif</p>
                                            <p className="text-[10px] text-neutral-400">Pour atteindre le goal mensuel</p>
                                        </div>
                                        <div className="text-end">
                                            <p dir="ltr" className="text-lg font-extrabold text-financial-profit tabular-nums">{fmt2(assistedCalc.goalPrice)} DZD</p>
                                            <p dir="ltr" className="text-[11px] text-financial-profit">+{fmt0(assistedCalc.goalProfit)} DZD</p>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => applyPrice(assistedCalc.goalPrice)}
                                        className="w-full rounded-lg border border-financial-profit/30 bg-surface py-2 text-xs font-bold text-financial-profit hover:bg-financial-profit-bg transition-colors">
                                        → Utiliser ce prix
                                    </button>
                                </div>
                            )}

                            {/* Context footer */}
                            <div className="grid grid-cols-3 gap-2 text-center pt-1">
                                <div className="rounded-lg bg-neutral-100 p-2">
                                    <p className="text-[9px] uppercase font-bold text-neutral-400">Besoin/jour</p>
                                    <p dir="ltr" className="text-xs font-bold text-neutral-700">{assistedCalc.dailyNeeded > 0 ? `+${fmt0(assistedCalc.dailyNeeded)}` : '—'}</p>
                                </div>
                                <div className="rounded-lg bg-neutral-100 p-2">
                                    <p className="text-[9px] uppercase font-bold text-neutral-400">Moy. hist.</p>
                                    <p dir="ltr" className="text-xs font-bold text-neutral-700">+{fmt2(assistedCalc.baseMargin)}/U</p>
                                </div>
                                <div className="rounded-lg bg-neutral-100 p-2">
                                    <p className="text-[9px] uppercase font-bold text-neutral-400">Goal mois</p>
                                    <p className={`text-xs font-bold ${assistedCalc.goalPct !== null ? (assistedCalc.goalPct >= 100 ? 'text-financial-profit' : 'text-neutral-700') : 'text-neutral-400'}`}>
                                        {assistedCalc.goalPct !== null ? `${assistedCalc.goalPct}%` : '—'}
                                    </p>
                                </div>
                            </div>

                            <p className="text-center text-[10px] text-neutral-400">
                                Appuyez sur [→ Utiliser] pour pré-remplir le prix dans le mode Normal
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-400">
                            Aucun stock USDT disponible
                        </div>
                    )}
                </>)}
            </div>
        </BottomSheet>
    );
}
