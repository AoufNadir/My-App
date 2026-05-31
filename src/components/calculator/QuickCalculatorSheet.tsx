import { useState, useMemo } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { MoneyField } from '../ui/MoneyField';
import { parseAndEvaluate } from '../../utils';
import { formatNumber } from '../../pages/shared/pageFormat';
import {
    ClientTierType,
    allTierPrices,
    getVolumeBracket,
    getVolumeBracketLabel,
    computeSuggestedPrice,
} from '../../utils/pricingMatrix';

const fmt0 = (n: number) => formatNumber(n, { min: 0, max: 0 });
const fmt2 = (n: number) => formatNumber(n, { min: 2, max: 2 });

type Currency = 'USDT' | 'EUR';
type Mode = 'normal' | 'inverse' | 'assisted';

const TIER_LABELS: Record<ClientTierType, string> = {
    vip:     '🏆 VIP',
    regular: '⭐ Régulier',
    new:     '🆕 Nouveau',
    none:    '— Inconnu',
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
    const [mode, setMode]         = useState<Mode>('normal');
    const [quantity, setQuantity] = useState('');
    const [sellPrice, setSellPrice]     = useState('');
    const [targetProfit, setTargetProfit] = useState('');
    // Assisté: selected tier row (highlight)
    const [selectedTier, setSelectedTier] = useState<ClientTierType>('regular');

    const stats    = currency === 'USDT' ? portfolioStats.usdt : portfolioStats.eur;
    const pam      = stats.avgBuy;
    const available = stats.available;

    const resetInputs = () => { setQuantity(''); setSellPrice(''); setTargetProfit(''); };

    // ── Normal mode ───────────────────────────────────────────────────────────
    const normalCalc = useMemo(() => {
        if (mode !== 'normal') return null;
        const qty   = parseAndEvaluate(quantity);
        const price = parseAndEvaluate(sellPrice);
        if (qty <= 0 || price <= 0 || pam <= 0) return null;
        const revenue = qty * price;
        const cost    = qty * pam;
        const profit  = revenue - cost;
        const margin  = ((price - pam) / pam) * 100;
        return { qty, price, revenue, cost, profit, margin, profitPerUnit: price - pam };
    }, [quantity, sellPrice, pam, mode]);

    // ── Inverse mode ──────────────────────────────────────────────────────────
    const inverseCalc = useMemo(() => {
        if (mode !== 'inverse') return null;
        const qty    = parseAndEvaluate(quantity);
        const target = parseAndEvaluate(targetProfit);
        if (qty <= 0 || pam <= 0) return null;
        const requiredPrice  = pam + (target > 0 ? target / qty : 0);
        const margin         = pam > 0 ? ((requiredPrice - pam) / pam) * 100 : 0;
        const profitPerUnit  = requiredPrice - pam;
        return { qty, target, requiredPrice, margin, profitPerUnit, revenue: qty * requiredPrice, cost: qty * pam };
    }, [quantity, targetProfit, pam, mode]);

    // ── Assisted mode ─────────────────────────────────────────────────────────
    const assistedQty = parseAndEvaluate(quantity);
    const assistedData = useMemo(() => {
        if (mode !== 'assisted' || pam <= 0 || !pricingContext) return null;
        const qty = assistedQty > 0 ? assistedQty : available;
        if (qty <= 0) return null;

        const baseMargin = pricingContext.avgMarginPerUsdt > 0
            ? pricingContext.avgMarginPerUsdt
            : pricingContext.fallbackMargin;

        const tiers = allTierPrices(pam, qty, baseMargin, pricingContext.fallbackMargin);
        const bracket = getVolumeBracket(qty);
        const bracketLabel = getVolumeBracketLabel(bracket);

        const goalPct = pricingContext.monthlyGoal > 0
            ? Math.min(100, Math.round((pricingContext.monthToDateProfit / pricingContext.monthlyGoal) * 100))
            : null;

        return { tiers, qty, bracket, bracketLabel, baseMargin, goalPct, ctx: pricingContext };
    }, [mode, pam, available, pricingContext, assistedQty]);

    const segBtn = (active: boolean) =>
        `flex-1 min-h-[40px] rounded-lg text-sm font-bold transition-colors ${active ? 'bg-primary text-white' : 'text-neutral-600 hover:text-neutral-800'}`;

    const modeBtn = (active: boolean, color: string) =>
        `flex-1 min-h-[38px] rounded-lg text-xs font-bold transition-colors border ${active ? `${color} border-transparent` : 'text-neutral-500 border-border bg-surface hover:bg-neutral-50'}`;

    const applyPrice = (price: number, tier: ClientTierType) => {
        setSellPrice(price.toFixed(2));
        setSelectedTier(tier);
        setMode('normal');
        if (assistedQty > 0) setQuantity(assistedData!.qty.toFixed(2));
    };

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title="Calculatrice rapide" className="max-w-lg mx-auto">
            <div className="px-4 pb-6 space-y-4">

                {/* Currency */}
                <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
                    <button type="button" onClick={() => { setCurrency('USDT'); resetInputs(); }} className={segBtn(currency === 'USDT')}>USDT</button>
                    <button type="button" onClick={() => { setCurrency('EUR');  resetInputs(); }} className={segBtn(currency === 'EUR')}>EUR</button>
                </div>

                {/* Mode */}
                <div className="flex gap-2">
                    <button type="button" onClick={() => { setMode('normal');   resetInputs(); }} className={modeBtn(mode === 'normal',   'bg-primary/10 text-primary')}>📊 Normal</button>
                    <button type="button" onClick={() => { setMode('inverse');  resetInputs(); }} className={modeBtn(mode === 'inverse',  'bg-secondary/10 text-secondary')}>🎯 Inverse</button>
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
                            <MoneyField label="" value={sellPrice} onChange={setSellPrice} className="-mt-2" placeholder="Ex: 247.50"/>
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
                                {[
                                    { label: 'Hامش/unité', value: `${normalCalc.profitPerUnit >= 0 ? '+' : ''}${fmt2(normalCalc.profitPerUnit)} DZD`, color: normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss' },
                                    { label: 'Marge %', value: `${normalCalc.margin >= 0 ? '+' : ''}${fmt2(normalCalc.margin)}%`, color: normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss' },
                                    { label: 'Recette brute', value: `${fmt0(normalCalc.revenue)} DZD`, color: 'text-neutral-800' },
                                    { label: 'Coût de revient', value: `${fmt0(normalCalc.cost)} DZD`, color: 'text-neutral-800' },
                                ].map(item => (
                                    <div key={item.label} className="rounded-xl border border-border bg-surface-muted p-3">
                                        <p className="text-[10px] font-bold uppercase text-neutral-400">{item.label}</p>
                                        <p dir="ltr" className={`text-base font-bold mt-1 ${item.color}`}>{item.value}</p>
                                    </div>
                                ))}
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
                        🎯 Entrez votre profit cible → obtenez le prix à afficher
                    </div>
                    <div className="space-y-3">
                        <MoneyField label={`Quantité (${currency})`} value={quantity} onChange={setQuantity}
                            currency={currency} onMax={() => setQuantity(available.toFixed(2))} placeholder="Ex: 500"/>
                        <MoneyField label="Profit cible (DZD)" value={targetProfit} onChange={setTargetProfit} currency="DZD" placeholder="Ex: 5 000"/>
                    </div>
                    {inverseCalc && parseAndEvaluate(quantity) > 0 ? (
                        <div className="space-y-3">
                            <div className="rounded-xl bg-secondary/10 px-4 py-4 border border-secondary/20">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">Prix de vente requis</p>
                                <p dir="ltr" className="text-3xl font-extrabold tabular-nums mt-1 text-neutral-900">{fmt2(inverseCalc.requiredPrice)} DZD</p>
                                <p className="text-[11px] text-neutral-500 mt-1">pour {fmt0(inverseCalc.target)} DZD de profit</p>
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
                            </div>
                            <p className="text-center text-[11px] text-neutral-400">
                                Formule : {fmt2(pam)} + {fmt0(inverseCalc.target)}/{fmt2(inverseCalc.qty)} = {fmt2(inverseCalc.requiredPrice)} DZD/USDT
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-400">Entrez une quantité et un profit cible</div>
                    )}
                </>)}

                {/* ── ASSISTED MODE ── */}
                {mode === 'assisted' && (<>
                    <div className="rounded-xl border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning font-medium">
                        ✨ Entrez la quantité → le tableau affiche le prix selon le type de client
                    </div>

                    {/* Quantity input */}
                    <MoneyField
                        label="Quantité à vendre (USDT)"
                        value={quantity}
                        onChange={setQuantity}
                        currency="USDT"
                        onMax={() => setQuantity(available.toFixed(2))}
                        placeholder={`Ex: 200  (Stock: ${fmt2(available)})`}
                    />

                    {!pricingContext ? (
                        <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-400">Pas encore assez de données historiques</div>
                    ) : !assistedData ? (
                        <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-400">Entrez une quantité pour voir le tableau de prix</div>
                    ) : (
                        <div className="space-y-3">
                            {/* Volume bracket info */}
                            <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                                <span>Tranche : <span className="font-semibold text-neutral-600">{assistedData.bracketLabel}</span></span>
                                <span>Base histo. : <span dir="ltr" className="font-semibold text-neutral-600">+{fmt2(assistedData.baseMargin)}/USDT</span></span>
                            </div>

                            {/* Pricing table */}
                            <div className="rounded-xl border border-border overflow-hidden">
                                {/* Header */}
                                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-surface-muted px-3 py-2 text-[9px] font-bold uppercase text-neutral-400 tracking-wide border-b border-border">
                                    <span>Type client</span>
                                    <span className="text-right">Prix</span>
                                    <span className="text-right">+/USDT</span>
                                    <span className="text-right">Profit total</span>
                                </div>

                                {/* Rows */}
                                {(['vip', 'regular', 'new', 'none'] as ClientTierType[]).map(tier => {
                                    const row = assistedData.tiers[tier];
                                    const isSelected = tier === selectedTier;
                                    const profit = row.profitPerUnit * assistedData.qty;
                                    return (
                                        <button
                                            key={tier}
                                            type="button"
                                            onClick={() => applyPrice(row.price, tier)}
                                            className={`w-full grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-3 text-start border-b last:border-b-0 border-neutral-100 transition-colors ${isSelected ? 'bg-primary/8 border-primary/20' : 'hover:bg-neutral-50'}`}
                                        >
                                            <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-neutral-700'}`}>
                                                {TIER_LABELS[tier]}
                                                {isSelected && <span className="ml-1 text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">actif</span>}
                                            </span>
                                            <span dir="ltr" className={`text-sm font-extrabold tabular-nums text-right ${isSelected ? 'text-primary' : 'text-neutral-800'}`}>
                                                {fmt2(row.price)}
                                            </span>
                                            <span dir="ltr" className="text-xs font-semibold tabular-nums text-right text-financial-profit">
                                                +{fmt2(row.profitPerUnit)}
                                            </span>
                                            <span dir="ltr" className="text-xs font-bold tabular-nums text-right text-financial-profit">
                                                +{fmt0(profit)} DZD
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <p className="text-[10px] text-neutral-400 text-center">
                                Appuyez sur une ligne → prix pré-rempli dans le mode Normal
                            </p>

                            {/* Context footer */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg bg-neutral-100 p-2">
                                    <p className="text-[9px] uppercase font-bold text-neutral-400">Besoin/jour</p>
                                    <p dir="ltr" className="text-xs font-bold text-neutral-700">
                                        {assistedData.ctx.dailyNeeded > 0 ? `+${fmt0(assistedData.ctx.dailyNeeded)}` : '—'}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-neutral-100 p-2">
                                    <p className="text-[9px] uppercase font-bold text-neutral-400">Jours restants</p>
                                    <p className="text-xs font-bold text-neutral-700">{assistedData.ctx.daysRemaining}j</p>
                                </div>
                                <div className="rounded-lg bg-neutral-100 p-2">
                                    <p className="text-[9px] uppercase font-bold text-neutral-400">Goal mois</p>
                                    <p className={`text-xs font-bold ${assistedData.goalPct !== null ? (assistedData.goalPct >= 100 ? 'text-financial-profit' : 'text-neutral-700') : 'text-neutral-400'}`}>
                                        {assistedData.goalPct !== null ? `${assistedData.goalPct}%` : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </>)}
            </div>
        </BottomSheet>
    );
}
