import { useState, useMemo } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { MoneyField } from '../ui/MoneyField';
import { parseAndEvaluate } from '../../utils';
import { formatNumber } from '../../pages/shared/pageFormat';
const fmt0 = (n: number) => formatNumber(n, { min: 0, max: 0 });
const fmt2 = (n: number) => formatNumber(n, { min: 2, max: 2 });

type Currency = 'USDT' | 'EUR';

type PortfolioSide = {
    available: number;
    avgBuy: number;
};

type QuickCalculatorSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    portfolioStats: {
        usdt: PortfolioSide;
        eur: PortfolioSide;
    };
};

export function QuickCalculatorSheet({ isOpen, onClose, portfolioStats }: QuickCalculatorSheetProps) {
    const [currency, setCurrency] = useState<Currency>('USDT');
    const [quantity, setQuantity] = useState('');
    const [sellPrice, setSellPrice] = useState('');

    const stats = currency === 'USDT' ? portfolioStats.usdt : portfolioStats.eur;
    const pam = stats.avgBuy;
    const available = stats.available;

    const calc = useMemo(() => {
        const qty = parseAndEvaluate(quantity);
        const price = parseAndEvaluate(sellPrice);
        if (qty <= 0 || price <= 0 || pam <= 0) return null;
        const revenue = qty * price;
        const cost = qty * pam;
        const profit = revenue - cost;
        const margin = ((price - pam) / pam) * 100;
        const profitPerUnit = price - pam;
        const breakEvenQty = pam > 0 ? cost / pam : 0;
        return { qty, price, revenue, cost, profit, margin, profitPerUnit, breakEvenQty };
    }, [quantity, sellPrice, pam]);

    const isProfit = calc ? calc.profit >= 0 : null;

    const applyMaxQty = () => setQuantity(available.toFixed(2));
    const applyPam = () => setSellPrice(pam.toFixed(2));

    const segBtn = (active: boolean) =>
        `flex-1 min-h-[40px] rounded-lg text-sm font-bold transition-colors ${active ? 'bg-primary text-white' : 'text-neutral-600 hover:text-neutral-800'}`;

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title="Calculatrice rapide" className="max-w-lg mx-auto">
            <div className="px-4 pb-6 space-y-5">
                {/* Currency selector */}
                <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
                    <button type="button" onClick={() => { setCurrency('USDT'); setQuantity(''); setSellPrice(''); }} className={segBtn(currency === 'USDT')}>
                        USDT
                    </button>
                    <button type="button" onClick={() => { setCurrency('EUR'); setQuantity(''); setSellPrice(''); }} className={segBtn(currency === 'EUR')}>
                        EUR
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

                {/* Inputs */}
                <div className="space-y-3">
                    <MoneyField
                        label={`Quantité (${currency})`}
                        value={quantity}
                        onChange={setQuantity}
                        currency={currency}
                        onMax={applyMaxQty}
                        placeholder="Ex: 500"
                    />
                    <div>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-neutral-700">Prix de vente (DZD)</span>
                            {pam > 0 && (
                                <button type="button" onClick={applyPam} className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-info-bg text-info hover:bg-primary/10 transition-colors">
                                    = PAM
                                </button>
                            )}
                        </div>
                        <MoneyField
                            label=""
                            value={sellPrice}
                            onChange={setSellPrice}
                            className="-mt-2"
                            placeholder="Ex: 262.50"
                        />
                    </div>
                </div>

                {/* Results */}
                {calc ? (
                    <div className="space-y-3">
                        {/* Main result */}
                        <div className={`rounded-xl px-4 py-4 ${isProfit ? 'bg-financial-profit-bg' : 'bg-financial-loss-bg'}`}>
                            <p className={`text-[11px] font-bold uppercase tracking-wide ${isProfit ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                Profit estimé
                            </p>
                            <p dir="ltr" className={`text-3xl font-extrabold tabular-nums mt-1 ${isProfit ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                {isProfit ? '+' : ''}{fmt0(calc.profit)} DZD
                            </p>
                        </div>

                        {/* Detail grid */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wide">Hامش/unité</p>
                                <p dir="ltr" className={`text-base font-bold mt-1 tabular-nums ${isProfit ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                    {calc.profitPerUnit >= 0 ? '+' : ''}{fmt2(calc.profitPerUnit)} DZD
                                </p>
                            </div>
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wide">Marge %</p>
                                <p dir="ltr" className={`text-base font-bold mt-1 tabular-nums ${isProfit ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                    {calc.margin >= 0 ? '+' : ''}{fmt2(calc.margin)}%
                                </p>
                            </div>
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wide">Recette brute</p>
                                <p dir="ltr" className="text-base font-semibold mt-1 tabular-nums text-neutral-800">
                                    {fmt0(calc.revenue)} DZD
                                </p>
                            </div>
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wide">Coût de revient</p>
                                <p dir="ltr" className="text-base font-semibold mt-1 tabular-nums text-neutral-800">
                                    {fmt0(calc.cost)} DZD
                                </p>
                            </div>
                        </div>

                        {/* Break-even note */}
                        <p className="text-center text-[11px] text-neutral-400">
                            Seuil de rentabilité : <span dir="ltr" className="font-semibold text-neutral-600">{fmt2(pam)} DZD/{currency}</span>
                        </p>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-neutral-400">
                        Entrez une quantité et un prix pour voir le résultat
                    </div>
                )}
            </div>
        </BottomSheet>
    );
}
