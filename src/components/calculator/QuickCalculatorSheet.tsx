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
    roundToMarketPrice,
    ceilToMarketPrice,
    computeGoalAdjustedBase,
    getMarginMultiplier,
} from '../../utils/pricingMatrix';

const fmt0 = (n: number) => formatNumber(n, { min: 0, max: 0 });
const fmt2 = (n: number) => formatNumber(n, { min: 2, max: 2 });

type Currency = 'USDT' | 'EUR';
type Mode = 'normal' | 'inverse' | 'assisted' | 'client';

type ClientEntry = { id: string; name: string; group?: string };
type TxEntry    = { type: string; currency: string; linkedClientId?: string; quantity: number; sell?: number; price?: number; timestamp: number; total?: number };

const TIER_LABELS: Record<ClientTierType, string> = {
    vip:     '🏆 VIP',
    regular: '⭐ Régulier',
    petit:   '🔸 Petit',
    new:     '🆕 Nouveau',
    none:    '— Inconnu',
};

type PortfolioSide = { available: number; avgBuy: number };

type PricingContext = {
    dailyNeeded: number;
    avgMarginPerUsdt: number;     // effective = max(historical, goal-based)
    historicalMargin?: number;    // raw historical for display
    goalMargin?: number;          // goal-required margin for display
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
    clients?: ClientEntry[];
    clientLoyaltyMap?: Map<string, 'vip' | 'regular' | 'petit' | 'new' | 'inactive'>;
    transactions?: TxEntry[];
    minimumGoal?: number;
};

export function QuickCalculatorSheet({ isOpen, onClose, portfolioStats, pricingContext, clients = [], clientLoyaltyMap, transactions = [], minimumGoal = 0 }: QuickCalculatorSheetProps) {
    const [currency, setCurrency] = useState<Currency>('USDT');
    const [mode, setMode]         = useState<Mode>('normal');
    const [quantity, setQuantity] = useState('');
    const [sellPrice, setSellPrice]     = useState('');
    const [targetProfit, setTargetProfit] = useState('');
    // Assisté: selected tier row (highlight)
    const [selectedTier, setSelectedTier] = useState<ClientTierType>('regular');
    // Client mode
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

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

    // ── Client mode ───────────────────────────────────────────────────────────
    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return clients.slice(0, 6);
        const q = clientSearch.toLowerCase();
        return clients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
    }, [clients, clientSearch]);

    const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId) ?? null, [clients, selectedClientId]);

    const rawClientTier = selectedClientId ? (clientLoyaltyMap?.get(selectedClientId) ?? 'new') : null;
    const clientTier: ClientTierType = rawClientTier === 'inactive' ? 'new' : (rawClientTier ?? 'new');

    const clientPrevMonthVolume = useMemo(() => {
        if (!selectedClientId) return 0;
        const now = new Date();
        const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const prevEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
        return transactions
            .filter(tx => tx.type === 'sell' && tx.currency === 'USDT' && tx.linkedClientId === selectedClientId && tx.timestamp >= prevStart && tx.timestamp <= prevEnd)
            .reduce((s, tx) => s + Number(tx.quantity || 0), 0);
    }, [selectedClientId, transactions]);

    const lastSellToClient = useMemo(() => {
        if (!selectedClientId) return null;
        return transactions
            .filter(tx => tx.type === 'sell' && tx.currency === 'USDT' && tx.linkedClientId === selectedClientId)
            .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
    }, [selectedClientId, transactions]);

    const clientModeData = useMemo(() => {
        if (mode !== 'client' || !selectedClientId || !pricingContext || pam <= 0) return null;
        const qty = parseAndEvaluate(quantity);
        if (qty <= 0) return null;

        const bracket = getVolumeBracket(qty);
        const tierMult = getMarginMultiplier(clientTier, bracket);

        const avgVol = pricingContext.avgMonthlyUsdtSold > 0 ? pricingContext.avgMonthlyUsdtSold : qty;

        // Goal A — ambitious
        const goalA = pricingContext.monthlyGoal > 0 ? pricingContext.monthlyGoal : 0;
        const neededMarginA = goalA > 0 ? goalA / avgVol : pricingContext.avgMarginPerUsdt;
        const adjBaseA = computeGoalAdjustedBase(neededMarginA, bracket);
        const priceA = ceilToMarketPrice(pam + adjBaseA * tierMult);
        const profitA = (priceA - pam) * qty;

        // Goal B — minimum floor
        const goalB = minimumGoal > 0 ? minimumGoal : Math.round(goalA * 0.65);
        const neededMarginB = goalB > 0 ? goalB / avgVol : neededMarginA * 0.65;
        const adjBaseB = computeGoalAdjustedBase(neededMarginB, bracket);
        const priceB = ceilToMarketPrice(pam + adjBaseB * tierMult);
        const profitB = (priceB - pam) * qty;

        // Monthly impact
        const remainingGoal = Math.max(0, goalA - pricingContext.monthToDateProfit);
        const coveragePct = remainingGoal > 0 ? Math.min(100, Math.round((profitA / remainingGoal) * 100)) : 100;

        return { priceA, priceB, profitA, profitB, qty, bracket, tierMult, goalA, goalB, remainingGoal, coveragePct };
    }, [mode, selectedClientId, quantity, pam, pricingContext, minimumGoal, clientTier]);

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
                <div className="flex gap-1.5 flex-wrap">
                    <button type="button" onClick={() => { setMode('normal');   resetInputs(); }} className={modeBtn(mode === 'normal',   'bg-primary/10 text-primary')}>📊 Normal</button>
                    <button type="button" onClick={() => { setMode('inverse');  resetInputs(); }} className={modeBtn(mode === 'inverse',  'bg-secondary/10 text-secondary')}>🎯 Inverse</button>
                    {currency === 'USDT' && (<>
                        <button type="button" onClick={() => { setMode('assisted'); resetInputs(); }} className={modeBtn(mode === 'assisted', 'bg-warning/10 text-warning border-warning/30')}>✨ Assisté</button>
                        <button type="button" onClick={() => { setMode('client'); resetInputs(); setClientSearch(''); setSelectedClientId(null); }} className={modeBtn(mode === 'client', 'bg-teal-500/10 text-teal-600 border-teal-300/50')}>🧑 Client</button>
                    </>)}
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

                {/* ── CLIENT MODE ── */}
                {mode === 'client' && (<>
                    <div className="rounded-xl border border-teal-300/40 bg-teal-50/60 px-3 py-2 text-xs text-teal-700 font-medium">
                        🧑 Sélectionnez un client → entrez la quantité → obtenez ses prix personnalisés
                    </div>

                    {/* Client search */}
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={clientSearch}
                            onChange={e => { setClientSearch(e.target.value); setSelectedClientId(null); }}
                            placeholder="🔍 Rechercher un client..."
                            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                        />
                        {/* Client list */}
                        {!selectedClientId && filteredClients.length > 0 && (
                            <div className="rounded-xl border border-border overflow-hidden divide-y divide-neutral-100">
                                {filteredClients.map(c => {
                                    const tier = clientLoyaltyMap?.get(c.id) ?? 'new';
                                    const tierIcon = { vip: '🏆', regular: '⭐', petit: '🔸', new: '🆕', inactive: '💤' }[tier];
                                    return (
                                        <button key={c.id} type="button"
                                            onClick={() => { setSelectedClientId(c.id); setClientSearch(c.name); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-start hover:bg-neutral-50 transition-colors">
                                            <span className="text-base">{tierIcon}</span>
                                            <span className="flex-1 font-semibold text-neutral-800">{c.name}</span>
                                            {c.group && <span className="text-[10px] text-neutral-400">{c.group}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected client info panel */}
                    {selectedClient && (() => {
                        const tierLabel = { vip: '🏆 VIP', regular: '⭐ Régulier', petit: '🔸 Petit', new: '🆕 Nouveau', inactive: '💤 Inactif' }[rawClientTier ?? 'new'];
                        const tierColor = { vip: 'text-amber-600 bg-amber-50 border-amber-200', regular: 'text-primary bg-primary/5 border-primary/20', petit: 'text-orange-600 bg-orange-50 border-orange-200', new: 'text-neutral-600 bg-neutral-50 border-neutral-200', inactive: 'text-neutral-400 bg-neutral-50 border-neutral-200' }[rawClientTier ?? 'new'];
                        const lastPrice = lastSellToClient ? (lastSellToClient.sell ?? lastSellToClient.price ?? 0) : 0;
                        const lastDate  = lastSellToClient ? new Date(lastSellToClient.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : null;
                        return (
                            <div className="rounded-xl border border-border bg-surface-muted p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-extrabold text-neutral-800">{selectedClient.name}</span>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${tierColor}`}>{tierLabel}</span>
                                </div>
                                <div className="flex gap-3 text-[10px] text-neutral-500">
                                    <span>Vol. mois précédent: <span className="font-bold text-neutral-700">{fmt0(clientPrevMonthVolume)} USDT</span></span>
                                    {lastPrice > 0 && lastDate && (
                                        <span>Dernier prix: <span className="font-bold text-neutral-700">{Number.isInteger(lastPrice) ? lastPrice : fmt2(lastPrice)} DZD</span> le {lastDate}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Quantity input */}
                    {selectedClientId && (
                        <MoneyField
                            label="Quantité souhaitée (USDT)"
                            value={quantity}
                            onChange={setQuantity}
                            currency="USDT"
                            onMax={() => setQuantity(available.toFixed(2))}
                            placeholder="Ex: 500"
                        />
                    )}

                    {/* Price recommendation */}
                    {clientModeData && (() => {
                        const { priceA, priceB, profitA, profitB, qty, goalA, goalB, remainingGoal, coveragePct } = clientModeData;
                        const fmtP = (p: number) => Number.isInteger(p) ? `${p}` : fmt2(p);
                        return (
                            <div className="space-y-3">
                                {/* Two price cards */}
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Card A — objectif */}
                                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-1.5">
                                        <p className="text-[9px] font-bold uppercase text-primary tracking-wide">🎯 Objectif</p>
                                        <p className="text-[9px] text-neutral-400">{fmt0(goalA)} DZD</p>
                                        <p dir="ltr" className="text-2xl font-extrabold text-primary tabular-nums">{fmtP(priceA)}</p>
                                        <p className="text-[10px] text-neutral-500">+{fmt2(priceA - pam)} DZD/USDT</p>
                                        <p className="text-[10px] text-financial-profit font-semibold">+{fmt0(profitA)} DZD</p>
                                        <button type="button"
                                            onClick={() => navigator.clipboard?.writeText(fmtP(priceA))}
                                            className="w-full mt-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold py-1.5 hover:bg-primary/20 transition-colors">
                                            📋 Copier
                                        </button>
                                    </div>
                                    {/* Card B — minimum */}
                                    <div className="rounded-xl border border-danger/25 bg-danger/5 p-3 space-y-1.5">
                                        <p className="text-[9px] font-bold uppercase text-financial-loss tracking-wide">🔒 Minimum</p>
                                        <p className="text-[9px] text-neutral-400">{fmt0(goalB)} DZD</p>
                                        <p dir="ltr" className="text-2xl font-extrabold text-financial-loss tabular-nums">{fmtP(priceB)}</p>
                                        <p className="text-[10px] text-neutral-500">+{fmt2(priceB - pam)} DZD/USDT</p>
                                        <p className="text-[10px] text-financial-loss font-semibold">+{fmt0(profitB)} DZD</p>
                                        <button type="button"
                                            onClick={() => navigator.clipboard?.writeText(fmtP(priceB))}
                                            className="w-full mt-1 rounded-lg bg-danger/10 text-financial-loss text-[10px] font-bold py-1.5 hover:bg-danger/20 transition-colors">
                                            📋 Copier
                                        </button>
                                    </div>
                                </div>

                                {/* Negotiation range */}
                                {priceA !== priceB && (
                                    <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
                                        <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1.5">↔ Marge de négociation</p>
                                        <div className="flex items-center gap-2">
                                            <span dir="ltr" className="text-sm font-extrabold text-financial-loss tabular-nums">{fmtP(priceB)}</span>
                                            <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-danger/30 via-warning/40 to-primary/40 relative">
                                                <div className="absolute inset-y-0 right-0 w-2 h-2 rounded-full bg-primary"/>
                                            </div>
                                            <span dir="ltr" className="text-sm font-extrabold text-primary tabular-nums">{fmtP(priceA)}</span>
                                        </div>
                                        <p className="text-[9px] text-neutral-400 mt-1 text-center">
                                            Vous pouvez baisser jusqu'à {fmtP(priceB)} sans sacrifier le minimum
                                        </p>
                                    </div>
                                )}

                                {/* Monthly goal impact */}
                                {goalA > 0 && (
                                    <div className="rounded-xl border border-border bg-surface-muted px-4 py-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold uppercase text-neutral-400">📈 Impact sur le mois</p>
                                            <span className={`text-[11px] font-bold ${coveragePct >= 100 ? 'text-financial-profit' : 'text-neutral-600'}`}>{coveragePct}% de l'objectif restant</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${coveragePct >= 100 ? 'bg-financial-profit' : 'bg-primary'}`} style={{ width: `${Math.min(100, coveragePct)}%` }}/>
                                        </div>
                                        <div className="flex justify-between text-[9px] text-neutral-400">
                                            <span>Cette vente: <span className="font-bold text-financial-profit">+{fmt0(profitA)} DZD</span></span>
                                            <span>Reste: <span className="font-bold text-neutral-600">{fmt0(Math.max(0, remainingGoal - profitA))} DZD</span></span>
                                        </div>
                                    </div>
                                )}

                                <p className="text-center text-[9px] text-neutral-400">
                                    PAM: {fmt2(pam)} DZD · {qty} USDT · {TIER_LABELS[clientTier]}
                                </p>
                            </div>
                        );
                    })()}

                    {selectedClientId && !clientModeData && (
                        <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-400">
                            Entrez la quantité pour voir les prix recommandés
                        </div>
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

                                {/* Matrix rows */}
                                {(['vip', 'regular', 'petit', 'new', 'none'] as ClientTierType[]).map(tier => {
                                    const row = assistedData.tiers[tier];
                                    const isSelected = tier === selectedTier;
                                    const profit = row.profitPerUnit * assistedData.qty;
                                    // Show price as xxx or xxx.50 (already rounded by pricingMatrix)
                                    const priceDisplay = Number.isInteger(row.price)
                                        ? `${row.price}`
                                        : `${fmt2(row.price)}`;
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
                                                {priceDisplay} DZD
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
                                {/* Prix plancher — goal reference */}
                                {assistedData.ctx.dailyNeeded > 0 && (() => {
                                    const plancherMargin = assistedData.ctx.dailyNeeded / assistedData.qty;
                                    const plancherRaw = pam + plancherMargin;
                                    const plancher = roundToMarketPrice(plancherRaw);
                                    const selectedPrice = assistedData.tiers[selectedTier]?.price ?? 0;
                                    const isBelow = selectedPrice < plancher;
                                    return (
                                        <div className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2.5 border-t-2 ${isBelow ? 'border-financial-loss/40 bg-financial-loss-bg/50' : 'border-financial-profit/30 bg-financial-profit-bg/30'}`}>
                                            <span className={`text-[11px] font-bold ${isBelow ? 'text-financial-loss' : 'text-financial-profit'}`}>
                                                🎯 Plancher goal {isBelow ? '⚠️' : '✓'}
                                            </span>
                                            <span dir="ltr" className={`text-sm font-extrabold tabular-nums text-right ${isBelow ? 'text-financial-loss' : 'text-financial-profit'}`}>
                                                {Number.isInteger(plancher) ? plancher : fmt2(plancher)} DZD
                                            </span>
                                            <span dir="ltr" className={`text-xs font-semibold tabular-nums text-right ${isBelow ? 'text-financial-loss' : 'text-financial-profit'}`}>
                                                +{fmt2(plancherMargin)}
                                            </span>
                                            <span className="text-[9px] text-neutral-400 text-right">min/j</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            <p className="text-[10px] text-neutral-400 text-center">
                                Appuyez sur une ligne → prix pré-rempli dans le mode Normal
                            </p>

                            {/* Context footer */}
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="rounded-lg bg-neutral-100 p-2">
                                    <p className="text-[9px] uppercase font-bold text-neutral-400">Besoin/jour</p>
                                    <p dir="ltr" className="text-xs font-bold text-neutral-700">
                                        {assistedData.ctx.dailyNeeded > 0 ? `+${fmt0(assistedData.ctx.dailyNeeded)}` : '—'}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-neutral-100 p-2">
                                    <p className="text-[9px] uppercase font-bold text-neutral-400">Goal mois</p>
                                    <p className={`text-xs font-bold ${assistedData.goalPct !== null ? (assistedData.goalPct >= 100 ? 'text-financial-profit' : 'text-neutral-700') : 'text-neutral-400'}`}>
                                        {assistedData.goalPct !== null ? `${assistedData.goalPct}%` : '—'}
                                    </p>
                                </div>
                            </div>
                            {/* Margin source indicator */}
                            {assistedData.ctx.goalMargin !== undefined && assistedData.ctx.historicalMargin !== undefined && (
                                <div className={`rounded-lg px-3 py-2 text-center text-[10px] ${assistedData.ctx.goalMargin > assistedData.ctx.historicalMargin ? 'bg-warning-bg text-warning' : 'bg-success-bg text-financial-profit'}`}>
                                    {assistedData.ctx.goalMargin > assistedData.ctx.historicalMargin
                                        ? `⚠️ Marge goal (+${fmt2(assistedData.ctx.goalMargin)}/U) > historique (+${fmt2(assistedData.ctx.historicalMargin)}/U) → prix ajustés vers le haut`
                                        : `✓ Marge historique (+${fmt2(assistedData.ctx.historicalMargin)}/U) suffit pour l'objectif`
                                    }
                                </div>
                            )}
                        </div>
                    )}
                </>)}
            </div>
        </BottomSheet>
    );
}
