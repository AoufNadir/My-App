import { useState, useMemo } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { MoneyField } from '../ui/MoneyField';
import { parseAndEvaluate } from '../../utils';
import { formatNumber } from '../../pages/shared/pageFormat';

const fmt0 = (n: number) => formatNumber(n, { min: 0, max: 0 });
const fmt2 = (n: number) => formatNumber(n, { min: 2, max: 2 });

type Currency = 'USDT' | 'EUR';
type Mode = 'normal' | 'inverse';

type PortfolioSide = { available: number; avgBuy: number };

type QuickCalculatorSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    portfolioStats: { usdt: PortfolioSide; eur: PortfolioSide };
};

export function QuickCalculatorSheet({ isOpen, onClose, portfolioStats }: QuickCalculatorSheetProps) {
    const [currency, setCurrency] = useState<Currency>('USDT');
    const [mode, setMode] = useState<Mode>('normal');
    const [quantity, setQuantity] = useState('');
    // Normal mode: price input
    const [sellPrice, setSellPrice] = useState('');
    // Inverse mode: target profit input
    const [targetProfit, setTargetProfit] = useState('');

    const stats = currency === 'USDT' ? portfolioStats.usdt : portfolioStats.eur;
    const pam = stats.avgBuy;
    const available = stats.available;

    const resetInputs = () => { setQuantity(''); setSellPrice(''); setTargetProfit(''); };

    // Normal mode calculation
    const normalCalc = useMemo(() => {
        if (mode !== 'normal') return null;
        const qty = parseAndEvaluate(quantity);
        const price = parseAndEvaluate(sellPrice);
        if (qty <= 0 || price <= 0 || pam <= 0) return null;
        const revenue = qty * price;
        const cost = qty * pam;
        const profit = revenue - cost;
        const margin = ((price - pam) / pam) * 100;
        const profitPerUnit = price - pam;
        return { qty, price, revenue, cost, profit, margin, profitPerUnit };
    }, [quantity, sellPrice, pam, mode]);

    // Inverse mode calculation
    const inverseCalc = useMemo(() => {
        if (mode !== 'inverse') return null;
        const qty = parseAndEvaluate(quantity);
        const target = parseAndEvaluate(targetProfit);
        if (qty <= 0 || pam <= 0) return null;
        // sellPrice = PAM + targetProfit / qty
        const requiredPrice = pam + (target > 0 ? target / qty : 0);
        const margin = pam > 0 ? ((requiredPrice - pam) / pam) * 100 : 0;
        const profitPerUnit = requiredPrice - pam;
        const revenue = qty * requiredPrice;
        const cost = qty * pam;
        return { qty, target, requiredPrice, margin, profitPerUnit, revenue, cost };
    }, [quantity, targetProfit, pam, mode]);

    const segBtn = (active: boolean) =>
        `flex-1 min-h-[40px] rounded-lg text-sm font-bold transition-colors ${active ? 'bg-primary text-white' : 'text-neutral-600 hover:text-neutral-800'}`;

    const modeBtn = (active: boolean, color: string) =>
        `flex-1 min-h-[38px] rounded-lg text-xs font-bold transition-colors border ${active ? `${color} border-transparent` : 'text-neutral-500 border-border bg-surface hover:bg-neutral-50'}`;

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title="Calculatrice rapide" className="max-w-lg mx-auto">
            <div className="px-4 pb-6 space-y-4">

                {/* Currency selector */}
                <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
                    <button type="button" onClick={() => { setCurrency('USDT'); resetInputs(); }} className={segBtn(currency === 'USDT')}>
                        USDT
                    </button>
                    <button type="button" onClick={() => { setCurrency('EUR'); resetInputs(); }} className={segBtn(currency === 'EUR')}>
                        EUR
                    </button>
                </div>

                {/* Mode selector */}
                <div className="flex gap-2">
                    <button type="button" onClick={() => { setMode('normal'); resetInputs(); }}
                        className={modeBtn(mode === 'normal', 'bg-primary/10 text-primary')}>
                        📊 Normal
                    </button>
                    <button type="button" onClick={() => { setMode('inverse'); resetInputs(); }}
                        className={modeBtn(mode === 'inverse', 'bg-secondary/10 text-secondary')}>
                        🎯 Inverse
                    </button>
                </div>

                {/* PAM info */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted px-4 py-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wide">PAM actuel</p>
                        <p dir="ltr" className="text-xl font-extrabold text-neutral-800 tabular-nums mt-0.5">
                            {fmt2(pam)} DZD
                        </p>
                    </div>
                    <div className="text-end">
                        <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wide">Stock</p>
                        <p dir="ltr" className="text-sm font-semibold text-neutral-600 tabular-nums mt-0.5">
                            {fmt2(available)} {currency}
                        </p>
                    </div>
                </div>

                {/* ─── NORMAL MODE ─── */}
                {mode === 'normal' && (
                    <>
                        <div className="space-y-3">
                            <MoneyField label={`Quantité (${currency})`} value={quantity} onChange={setQuantity}
                                currency={currency} onMax={() => setQuantity(available.toFixed(2))} placeholder="Ex: 500"/>
                            <div>
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-neutral-700">Prix de vente (DZD)</span>
                                    {pam > 0 && (
                                        <button type="button" onClick={() => setSellPrice(pam.toFixed(2))}
                                            className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-info-bg text-info hover:bg-primary/10 transition-colors">
                                            = PAM
                                        </button>
                                    )}
                                </div>
                                <MoneyField label="" value={sellPrice} onChange={setSellPrice} className="-mt-2" placeholder="Ex: 262.50"/>
                            </div>
                        </div>

                        {normalCalc ? (
                            <div className="space-y-3">
                                <div className={`rounded-xl px-4 py-4 ${normalCalc.profit >= 0 ? 'bg-financial-profit-bg' : 'bg-financial-loss-bg'}`}>
                                    <p className={`text-[11px] font-bold uppercase tracking-wide ${normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                        Profit estimé
                                    </p>
                                    <p dir="ltr" className={`text-3xl font-extrabold tabular-nums mt-1 ${normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                        {normalCalc.profit >= 0 ? '+' : ''}{fmt0(normalCalc.profit)} DZD
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-border bg-surface-muted p-3">
                                        <p className="text-[10px] font-bold uppercase text-neutral-400">Hامش/unité</p>
                                        <p dir="ltr" className={`text-base font-bold mt-1 ${normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                            {normalCalc.profitPerUnit >= 0 ? '+' : ''}{fmt2(normalCalc.profitPerUnit)} DZD
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-surface-muted p-3">
                                        <p className="text-[10px] font-bold uppercase text-neutral-400">Marge %</p>
                                        <p dir="ltr" className={`text-base font-bold mt-1 ${normalCalc.profit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                            {normalCalc.margin >= 0 ? '+' : ''}{fmt2(normalCalc.margin)}%
                                        </p>
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
                    </>
                )}

                {/* ─── INVERSE MODE ─── */}
                {mode === 'inverse' && (
                    <>
                        <div className="rounded-xl border border-secondary/20 bg-secondary/5 px-3 py-2 text-xs text-secondary font-medium">
                            🎯 Mode inverse : entrez votre profit cible → obtenez le prix à afficher
                        </div>

                        <div className="space-y-3">
                            <MoneyField label={`Quantité à vendre (${currency})`} value={quantity} onChange={setQuantity}
                                currency={currency} onMax={() => setQuantity(available.toFixed(2))} placeholder="Ex: 500"/>
                            <MoneyField label="Profit cible (DZD)" value={targetProfit} onChange={setTargetProfit}
                                currency="DZD" placeholder="Ex: 5 000"/>
                        </div>

                        {inverseCalc && parseAndEvaluate(quantity) > 0 ? (
                            <div className="space-y-3">
                                {/* Main result: required price */}
                                <div className="rounded-xl bg-secondary/10 px-4 py-4 border border-secondary/20">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">
                                        Prix de vente requis
                                    </p>
                                    <p dir="ltr" className="text-3xl font-extrabold tabular-nums mt-1 text-neutral-900">
                                        {fmt2(inverseCalc.requiredPrice)} DZD
                                    </p>
                                    <p className="text-[11px] text-neutral-500 mt-1">
                                        pour un profit de {fmt0(inverseCalc.target > 0 ? inverseCalc.target : 0)} DZD
                                    </p>
                                </div>

                                {/* Detail grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-border bg-surface-muted p-3">
                                        <p className="text-[10px] font-bold uppercase text-neutral-400">Hامش/unité</p>
                                        <p dir="ltr" className="text-base font-bold mt-1 text-financial-profit">
                                            +{fmt2(inverseCalc.profitPerUnit)} DZD
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-surface-muted p-3">
                                        <p className="text-[10px] font-bold uppercase text-neutral-400">Marge %</p>
                                        <p dir="ltr" className="text-base font-bold mt-1 text-financial-profit">
                                            +{fmt2(inverseCalc.margin)}%
                                        </p>
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
                                    Formule : PAM ({fmt2(pam)}) + Profit/Qté = {fmt2(inverseCalc.requiredPrice)} DZD/{currency}
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-400">
                                Entrez une quantité et un profit cible
                            </div>
                        )}
                    </>
                )}
            </div>
        </BottomSheet>
    );
}
