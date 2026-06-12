import { useMemo, useState, useEffect } from 'react';
import {
    ResponsiveContainer, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { PageHeader } from '../components/ui/PageHeader';
import { MoneyField } from '../components/ui/MoneyField';
import { Button } from '../components/ui/Button';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { computePamLedger } from '../utils/pamLedger';
import { parseAndEvaluate } from '../utils';
import { ceilToMarketPrice, ClientTierType, computeGoalAdjustedBase, getVolumeBracket, getMarginMultiplier } from '../utils/pricingMatrix';
import type { Tx, ClientDzd, ClientTransactionDzd, Investor } from '../types';

const fmt0 = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
const fmt2 = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DAY_LABELS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const TIME_SLOTS = [
    { label: 'Nuit 0–6h',    start: 0,  end: 6  },
    { label: 'Matin 6–12h',  start: 6,  end: 12 },
    { label: 'Après-m. 12–18h', start: 12, end: 18 },
    { label: 'Soir 18–24h',  start: 18, end: 24 },
];

type InsightsPageProps = {
    transactions: Tx[];
    clientsDzd?: ClientDzd[];
    clientTransactionsDzd?: ClientTransactionDzd[];
    investors?: Investor[];
    portfolioStats?: { usdt: { avgBuy: number }; eur: { avgBuy: number } };
    investorReconciliationDiff?: number;
    tierThresholds?: { vip: number; regular: number; petit: number };
    minimumGoal?: number;
};

const CHART_COLORS = {
    usdt: 'var(--color-primary)',
    eur:  'var(--color-secondary)',
    grid: 'var(--color-border)',
    tick: 'var(--color-neutral-500)',
};

function computePamHistory(transactions: Tx[], currency: 'USDT' | 'EUR') {
    const sorted = [...transactions]
        .filter(tx => tx.currency === currency && (tx.type === 'buy' || tx.type === 'sell'))
        .sort((a, b) => a.timestamp - b.timestamp);

    let qty = 0;
    let pam = 0;
    const points: Array<{ date: string; pam: number; type: string }> = [];

    for (const tx of sorted) {
        const txQty = Number(tx.quantity || 0);
        const txPrice = Number(tx.price || tx.sell || 0);
        if (txQty <= 0) continue;

        if (tx.type === 'buy' && txPrice > 0) {
            pam = (qty * pam + txQty * txPrice) / (qty + txQty);
            qty += txQty;
            points.push({
                date: tx.date,
                pam: Math.round(pam * 100) / 100,
                type: 'buy',
            });
        } else if (tx.type === 'sell') {
            qty = Math.max(0, qty - txQty);
            // PAM stays the same after sell
            if (points.length > 0) {
                points.push({
                    date: tx.date,
                    pam: Math.round(pam * 100) / 100,
                    type: 'sell',
                });
            }
        }
    }

    return points;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0];
    return (
        <div className="rounded-xl border border-border bg-surface p-3 shadow-card text-sm">
            <p className="text-[11px] text-neutral-400 mb-1">{label}</p>
            <p dir="ltr" className="font-extrabold text-neutral-900">
                {Number(pt.value || 0).toFixed(2)} DZD
            </p>
            <p className="text-[10px] text-neutral-400 mt-0.5">
                {pt.payload?.type === 'buy' ? '📥 Achat' : '📤 Vente'}
            </p>
        </div>
    );
};

export function InsightsPage({ transactions, clientsDzd = [], clientTransactionsDzd = [], investors = [], portfolioStats, investorReconciliationDiff, tierThresholds, minimumGoal: minimumGoalProp = 0 }: InsightsPageProps) {
    const thr = tierThresholds ?? { vip: 5000, regular: 1000, petit: 150 };
    const pamHistoryUsdt = useMemo(() => computePamHistory(transactions, 'USDT'), [transactions]);
    const pamHistoryEur  = useMemo(() => computePamHistory(transactions, 'EUR'), [transactions]);

    // Day & hour analysis using local pamLedger
    const pamLedger = useMemo(() => computePamLedger(transactions), [transactions]);

    const dayAnalysis = useMemo(() => {
        // dow: 0=Mon..6=Sun (ISO)
        const byDay = Array.from({ length: 7 }, () => ({ profit: 0, count: 0, margin: 0, qty: 0 }));
        for (const row of pamLedger.sellProfitRows) {
            const d = new Date(row.timestamp);
            const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0..Sun=6
            byDay[dow].profit += row.derivedProfit || 0;
            byDay[dow].count++;
            byDay[dow].qty += Number(row.quantity || 0);
        }
        return byDay.map((d, i) => ({
            day: DAY_LABELS_FR[i],
            profit: Math.round(d.profit),
            count: d.count,
            avgProfit: d.count > 0 ? Math.round(d.profit / d.count) : 0,
        }));
    }, [pamLedger]);

    const timeAnalysis = useMemo(() => {
        return TIME_SLOTS.map(slot => {
            let profit = 0; let count = 0;
            for (const row of pamLedger.sellProfitRows) {
                const h = new Date(row.timestamp).getHours();
                if (h >= slot.start && h < slot.end) {
                    profit += row.derivedProfit || 0;
                    count++;
                }
            }
            return {
                label: slot.label,
                profit: Math.round(profit),
                count,
                avgProfit: count > 0 ? Math.round(profit / count) : 0,
            };
        });
    }, [pamLedger]);

    // Hourly tick — forces yearlyStats to recompute new Date() when month changes
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 3_600_000);
        return () => clearInterval(id);
    }, []);

    // ── YTD Statistics (current year, Jan → now) ────────────────────────────
    const yearlyStats = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const yearStart = new Date(currentYear, 0, 1).getTime();

        // Accumulate per month
        const byMonth = new Map<number, {
            profit: number; usdtQty: number; eurQty: number;
            usdtRevenueDzd: number; usdtSellPriceSum: number; usdtSellCount: number;
            eurSellPriceEurSum: number; eurSellCount: number;
        }>();

        for (const row of pamLedger.sellProfitRows) {
            if (row.timestamp < yearStart) continue;
            const m = new Date(row.timestamp).getMonth();
            const entry = byMonth.get(m) ?? {
                profit: 0, usdtQty: 0, eurQty: 0,
                usdtRevenueDzd: 0, usdtSellPriceSum: 0, usdtSellCount: 0,
                eurSellPriceEurSum: 0, eurSellCount: 0,
            };
            const qty = Number((row as any).quantity || 0);
            const profit = (row as any).derivedProfit || 0;
            entry.profit += profit;
            if ((row as any).currency === 'USDT') {
                entry.usdtQty += qty;
                const sp = Number((row as any).sellPrice || 0);
                if (sp > 0) { entry.usdtSellPriceSum += sp * qty; entry.usdtRevenueDzd += sp * qty; }
                entry.usdtSellCount += 1;
            } else if ((row as any).currency === 'EUR') {
                entry.eurQty += qty;
                const spEur = Number((row as any).sellPriceEur || 0);
                if (spEur > 0) { entry.eurSellPriceEurSum += spEur; entry.eurSellCount += 1; }
            }
            byMonth.set(m, entry);
        }

        const activeMonths = byMonth.size || 1;
        const values = Array.from(byMonth.values());
        const totalProfit   = values.reduce((s, v) => s + v.profit, 0);
        const totalUsdtQty  = values.reduce((s, v) => s + v.usdtQty, 0);
        const totalEurQty   = values.reduce((s, v) => s + v.eurQty, 0);
        const totalUsdtRev  = values.reduce((s, v) => s + v.usdtRevenueDzd, 0);
        const totalEurPSum  = values.reduce((s, v) => s + v.eurSellPriceEurSum, 0);
        const totalEurSells = values.reduce((s, v) => s + v.eurSellCount, 0);

        return {
            activeMonths,
            currentYear,
            totalProfit,
            avgMonthlyProfit: totalProfit / activeMonths,
            totalUsdtQty,
            avgMonthlyUsdt: totalUsdtQty / activeMonths,
            totalEurQty,
            avgMonthlyEur: totalEurQty / activeMonths,
            avgSellDzd: totalUsdtQty > 0 ? totalUsdtRev / totalUsdtQty : 0,
            avgSellEur: totalEurSells > 0 ? totalEurPSum / totalEurSells : 0,
            avgMarginUsdt: portfolioStats
                ? (totalUsdtQty > 0 ? (totalUsdtRev / totalUsdtQty) - portfolioStats.usdt.avgBuy : 0)
                : 0,
        };
    }, [pamLedger, portfolioStats, tick]);

    // Projection calculator state
    const [projectionTarget, setProjectionTarget] = useState('');
    const [minimumTarget, setMinimumTarget] = useState(''); // Option B — minimum obligatoire
    const [tierTableMode, setTierTableMode] = useState<'A' | 'B'>('A');
    const [showProjectionInputs, setShowProjectionInputs] = useState(false);
    const [goalActivated, setGoalActivated] = useState(false);
    const [plancherActivated, setPlancherActivated] = useState(false);

    const bestDay = dayAnalysis.reduce((b, d) => d.profit > b.profit ? d : b, dayAnalysis[0]);
    const bestSlot = timeAnalysis.reduce((b, d) => d.profit > b.profit ? d : b, timeAnalysis[0]);
    const maxDayProfit = Math.max(...dayAnalysis.map(d => d.profit), 1);
    const maxSlotProfit = Math.max(...timeAnalysis.map(d => d.profit), 1);
    const totalSells = pamLedger.sellProfitRows.length;

    const currentPamUsdt = pamHistoryUsdt.at(-1)?.pam ?? 0;
    const currentPamEur  = pamHistoryEur.at(-1)?.pam ?? 0;

    const minUsdt = pamHistoryUsdt.length > 1 ? Math.min(...pamHistoryUsdt.map(p => p.pam)) : 0;
    const maxUsdt = pamHistoryUsdt.length > 1 ? Math.max(...pamHistoryUsdt.map(p => p.pam)) : 0;
    const trendUsdt = pamHistoryUsdt.length >= 2
        ? pamHistoryUsdt.at(-1)!.pam - pamHistoryUsdt[0].pam
        : null;

    return (
        <div className="anim-page-in space-y-4">
            <PageHeader title="Insights" subtitle="Analyses avancées"/>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 1 — 3 STATISTICAL CARDS (YTD)
            ═══════════════════════════════════════════════════════════ */}

            {/* Card 1 — Avg Monthly Profit */}
            <Card>
                <CardHeader className="p-4 pb-3">
                    <SectionHeading icon={<TrendingUpIcon className="w-4 h-4"/>}>
                        Profit moyen mensuel — {yearlyStats.currentYear}
                    </SectionHeading>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Moyenne/mois</p>
                            <CurrencyAmount value={yearlyStats.avgMonthlyProfit} currency="DZD" semantic="auto" size="lg" decimals={0}/>
                            <p className="text-[9px] text-neutral-400 mt-1">sur {yearlyStats.activeMonths} mois actifs</p>
                        </div>
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Total YTD</p>
                            <CurrencyAmount value={yearlyStats.totalProfit} currency="DZD" semantic="auto" size="lg" decimals={0}/>
                            <p className="text-[9px] text-neutral-400 mt-1">Jan → aujourd'hui</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Card 2 — Avg Monthly Volume */}
            <Card>
                <CardHeader className="p-4 pb-3">
                    <SectionHeading icon={<CalendarIcon className="w-4 h-4"/>}>
                        Volume vendu moyen mensuel — {yearlyStats.currentYear}
                    </SectionHeading>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">USDT/mois moy.</p>
                            <p dir="ltr" className="text-xl font-extrabold tabular-nums text-neutral-800">
                                {fmt0(yearlyStats.avgMonthlyUsdt)}
                            </p>
                            <p className="text-[9px] text-neutral-400 mt-1">
                                Total: {fmt0(yearlyStats.totalUsdtQty)} USDT
                            </p>
                        </div>
                        {yearlyStats.avgMonthlyEur > 0 ? (
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">EUR/mois moy.</p>
                                <p dir="ltr" className="text-xl font-extrabold tabular-nums text-neutral-800">
                                    {fmt2(yearlyStats.avgMonthlyEur)}
                                </p>
                                <p className="text-[9px] text-neutral-400 mt-1">
                                    Total: {fmt2(yearlyStats.totalEurQty)} EUR
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-border bg-surface-muted p-3 flex items-center justify-center">
                                <p className="text-[11px] text-neutral-400">Pas de ventes EUR cette année</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Card 3 — Avg Sell Price */}
            <Card>
                <CardHeader className="p-4 pb-3">
                    <SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>
                        Prix de vente moyen mensuel — {yearlyStats.currentYear}
                    </SectionHeading>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Moy. vente DZD/USDT</p>
                            <p dir="ltr" className="text-lg font-extrabold tabular-nums text-neutral-800">
                                {yearlyStats.avgSellDzd > 0 ? fmt2(yearlyStats.avgSellDzd) : '—'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">PAM actuel</p>
                            <p dir="ltr" className="text-lg font-extrabold tabular-nums text-neutral-700">
                                {portfolioStats ? fmt2(portfolioStats.usdt.avgBuy) : '—'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Hامarge moy.</p>
                            <p dir="ltr" className={`text-lg font-extrabold tabular-nums ${yearlyStats.avgSellDzd > 0 && portfolioStats ? 'text-financial-profit' : 'text-neutral-400'}`}>
                                {yearlyStats.avgSellDzd > 0 && portfolioStats
                                    ? `+${fmt2(yearlyStats.avgSellDzd - portfolioStats.usdt.avgBuy)}`
                                    : '—'}
                            </p>
                        </div>
                    </div>
                    {yearlyStats.avgSellEur > 0 && (
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Moy. vente EUR/USDT</p>
                            <p dir="ltr" className="text-base font-bold tabular-nums text-neutral-700">
                                {fmt2(yearlyStats.avgSellEur)} EUR/USDT
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 2 — NEXT MONTH PROJECTION CALCULATOR
            ═══════════════════════════════════════════════════════════ */}
            {yearlyStats.avgMonthlyUsdt > 0 && portfolioStats && (() => {
                const pam = portfolioStats.usdt.avgBuy;
                const avgVol = yearlyStats.avgMonthlyUsdt;
                const storedGoal = Number(localStorage.getItem('app_monthly_profit_goal') || 0);
                const histMargin = yearlyStats.avgSellDzd - pam;

                // Option A — objectif ambitieux: input → stored Settings goal → YTD avg
                const targetInput = parseAndEvaluate(projectionTarget);
                const target = targetInput > 0 ? targetInput : (storedGoal > 0 ? storedGoal : yearlyStats.avgMonthlyProfit);
                const neededMarginA = avgVol > 0 ? target / avgVol : 0;
                const targetPrice = ceilToMarketPrice(pam + neededMarginA);
                const actualProfitAtTarget = (targetPrice - pam) * avgVol;

                // Option B — minimum obligatoire
                // Priority: 1. user input field, 2. settings stored minimum, 3. 65% of YTD avg
                const defaultMinimum = minimumGoalProp > 0 ? minimumGoalProp : Math.round(yearlyStats.avgMonthlyProfit * 0.65);
                const minimumInput = parseAndEvaluate(minimumTarget);
                const minimum = minimumInput > 0 ? minimumInput : defaultMinimum;
                const neededMarginB = avgVol > 0 ? minimum / avgVol : 0;
                const minimumPrice = ceilToMarketPrice(pam + neededMarginB);
                const actualProfitAtMinimum = (minimumPrice - pam) * avgVol;

                return (
                    <Card>
                        <CardHeader className="p-4 pb-0">
                            <div className="flex items-start justify-between gap-2">
                                <SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>
                                    Projection mois prochain
                                </SectionHeading>
                                <button type="button"
                                    onClick={() => setShowProjectionInputs(v => !v)}
                                    className="shrink-0 text-[11px] font-semibold text-neutral-400 hover:text-neutral-700 transition-colors mt-0.5">
                                    {showProjectionInputs ? '✕ Fermer' : '✏️ Modifier'}
                                </button>
                            </div>
                            {/* Context stats — 3-column grid, mobile-friendly */}
                            <div className="grid grid-cols-3 gap-0 mt-3 mb-1 rounded-xl overflow-hidden border border-border">
                                <div className="px-3 py-2 bg-surface-muted text-center border-r border-border">
                                    <p className="text-[9px] font-bold uppercase text-neutral-400 tracking-wide">PAM</p>
                                    <p dir="ltr" className="text-sm font-extrabold text-neutral-800 tabular-nums mt-0.5">{fmt2(pam)}</p>
                                    <p className="text-[9px] text-neutral-400">DZD</p>
                                </div>
                                <div className="px-3 py-2 bg-surface-muted text-center border-r border-border">
                                    <p className="text-[9px] font-bold uppercase text-neutral-400 tracking-wide">Vol. moy.</p>
                                    <p dir="ltr" className="text-sm font-extrabold text-neutral-800 tabular-nums mt-0.5">{fmt0(avgVol)}</p>
                                    <p className="text-[9px] text-neutral-400">USDT</p>
                                </div>
                                <div className="px-3 py-2 bg-surface-muted text-center">
                                    <p className="text-[9px] font-bold uppercase text-neutral-400 tracking-wide">Histo.</p>
                                    <p dir="ltr" className="text-sm font-extrabold text-financial-profit tabular-nums mt-0.5">+{fmt2(histMargin > 0 ? histMargin : 0)}</p>
                                    <p className="text-[9px] text-neutral-400">DZD/U</p>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="px-4 pb-4 pt-3 space-y-3">

                            {/* Collapsible inputs */}
                            {showProjectionInputs && (
                                <div className="rounded-xl border border-border bg-surface-muted p-3 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-semibold text-neutral-500 mb-1.5">
                                            Objectif ambitieux
                                            {storedGoal > 0
                                                ? <span className="font-normal text-neutral-400 ms-1">(actuel: {fmt0(storedGoal)} DZD)</span>
                                                : <span className="font-normal text-neutral-400 ms-1">(moy: {fmt0(yearlyStats.avgMonthlyProfit)} DZD)</span>
                                            }
                                        </p>
                                        <MoneyField label="" value={projectionTarget} onChange={setProjectionTarget} currency="DZD" placeholder={fmt0(storedGoal > 0 ? storedGoal : yearlyStats.avgMonthlyProfit)}/>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-neutral-500 mb-1.5">Plancher obligatoire <span className="font-normal text-neutral-400">(défaut: {fmt0(defaultMinimum)} DZD)</span></p>
                                        <MoneyField label="" value={minimumTarget} onChange={setMinimumTarget} currency="DZD" placeholder={fmt0(defaultMinimum)}/>
                                    </div>
                                </div>
                            )}

                            {/* Two price cards */}
                            <div className="grid grid-cols-2 gap-2.5">
                                {/* Card A — objectif */}
                                <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/8 to-primary/3 p-3 flex flex-col">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-primary/70">Objectif</p>
                                        {goalActivated && <span className="text-[9px] font-bold text-financial-profit">✓ Activé</span>}
                                    </div>
                                    <p className="text-[10px] text-neutral-400 mb-1.5">{fmt0(target)} DZD</p>
                                    <p dir="ltr" className="text-[1.9rem] font-black tabular-nums text-primary leading-none tracking-tight">
                                        {Number.isInteger(targetPrice) ? targetPrice : fmt2(targetPrice)}
                                    </p>
                                    <p dir="ltr" className="text-[10px] text-neutral-500 mt-1 mb-auto">+{fmt2(targetPrice - pam)} DZD/U</p>
                                    <button type="button"
                                        className={`w-full mt-2.5 rounded-xl text-[10px] font-bold py-2 transition-colors ${goalActivated ? 'bg-financial-profit text-white' : 'bg-primary text-white hover:bg-primary/90'}`}
                                        onClick={() => {
                                            localStorage.setItem('app_monthly_profit_goal', String(Math.round(target)));
                                            window.dispatchEvent(new StorageEvent('storage', { key: 'app_monthly_profit_goal', newValue: String(Math.round(target)) }));
                                            setGoalActivated(true);
                                            setTimeout(() => setGoalActivated(false), 2000);
                                        }}>
                                        {goalActivated ? '✓ Objectif activé' : '→ Activer objectif'}
                                    </button>
                                </div>
                                {/* Card B — plancher */}
                                <div className="rounded-2xl border border-danger/20 bg-gradient-to-b from-danger/8 to-danger/3 p-3 flex flex-col">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-financial-loss/70">Plancher</p>
                                        {plancherActivated && <span className="text-[9px] font-bold text-financial-profit">✓ Activé</span>}
                                    </div>
                                    <p className="text-[10px] text-neutral-400 mb-1.5">{fmt0(minimum)} DZD</p>
                                    <p dir="ltr" className="text-[1.9rem] font-black tabular-nums text-financial-loss leading-none tracking-tight">
                                        {Number.isInteger(minimumPrice) ? minimumPrice : fmt2(minimumPrice)}
                                    </p>
                                    <p dir="ltr" className="text-[10px] text-neutral-500 mt-1 mb-1">+{fmt2(minimumPrice - pam)} DZD/U</p>
                                    <p className="text-[9px] text-financial-loss/60 font-semibold mb-auto">⚠ Ne pas descendre</p>
                                    <button type="button"
                                        className={`w-full mt-2.5 rounded-xl text-[10px] font-bold py-2 transition-colors border ${plancherActivated ? 'bg-financial-profit border-transparent text-white' : 'bg-danger/10 border-danger/25 text-financial-loss hover:bg-danger/20'}`}
                                        onClick={() => {
                                            localStorage.setItem('app_min_monthly_goal', String(Math.round(minimum)));
                                            window.dispatchEvent(new StorageEvent('storage', { key: 'app_min_monthly_goal', newValue: String(Math.round(minimum)) }));
                                            setPlancherActivated(true);
                                            setTimeout(() => setPlancherActivated(false), 2000);
                                        }}>
                                        {plancherActivated ? '✓ Plancher activé' : '→ Activer plancher'}
                                    </button>
                                </div>
                            </div>

                            {/* Tier price list — toggle A/B */}
                            {(neededMarginA > 0 || neededMarginB > 0) && (() => {
                                const bracket = getVolumeBracket(avgVol);
                                const isA = tierTableMode === 'A';
                                const activeMargin = isA ? neededMarginA : neededMarginB;
                                const activeGoalForCheck = isA ? target : minimum;
                                const adjustedBase = computeGoalAdjustedBase(activeMargin, bracket);
                                // Use ceilToMarketPrice to GUARANTEE all tiers meet the goal (never round down)
                                const tierOrder: ClientTierType[] = ['vip', 'regular', 'petit', 'new'];
                                const tiers = Object.fromEntries(
                                    tierOrder.map(tier => {
                                        const mult = getMarginMultiplier(tier, bracket);
                                        const price = ceilToMarketPrice(pam + adjustedBase * mult);
                                        return [tier, { price, profitPerUnit: price - pam }];
                                    })
                                ) as Record<ClientTierType, { price: number; profitPerUnit: number }>;

                                type TierMeta = { label: string; volume: string; dot: string };
                                const fmt0k = (n: number) => n >= 1000 ? `${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;
                                const TIER_META: Record<string, TierMeta> = {
                                    vip:     { label: 'VIP',      volume: `> ${fmt0k(thr.vip)} U/mois`,               dot: 'bg-amber-400' },
                                    regular: { label: 'Régulier', volume: `${fmt0k(thr.regular)} – ${fmt0k(thr.vip)} U`, dot: 'bg-primary' },
                                    petit:   { label: 'Petit',    volume: `${fmt0k(thr.petit)} – ${fmt0k(thr.regular)} U`, dot: 'bg-orange-400' },
                                    new:     { label: 'Nouveau',  volume: `< ${fmt0k(thr.petit)} U ou nouveau`,        dot: 'bg-neutral-300' },
                                };

                                return (
                                    <div className="space-y-2">
                                        {/* Section header with toggle */}
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Prix par client</p>
                                            <div className="flex rounded-lg border border-border overflow-hidden text-[10px] font-bold">
                                                <button type="button" onClick={() => setTierTableMode('A')}
                                                    className={`px-2.5 py-1 transition-colors ${isA ? 'bg-primary text-white' : 'text-neutral-400 hover:bg-neutral-50'}`}>
                                                    Objectif
                                                </button>
                                                <button type="button" onClick={() => setTierTableMode('B')}
                                                    className={`px-2.5 py-1 transition-colors border-l border-border ${!isA ? 'bg-financial-loss text-white' : 'text-neutral-400 hover:bg-neutral-50'}`}>
                                                    Plancher
                                                </button>
                                            </div>
                                        </div>

                                        {/* Clean list */}
                                        <div className="rounded-xl border border-border overflow-hidden divide-y divide-neutral-100">
                                            {tierOrder.map(tier => {
                                                const row = tiers[tier];
                                                const priceStr = Number.isInteger(row.price) ? `${row.price}` : fmt2(row.price);
                                                const { label, volume, dot } = TIER_META[tier];
                                                return (
                                                    <div key={tier} className="flex items-center justify-between px-4 py-3 bg-surface hover:bg-neutral-50/60 transition-colors">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`}/>
                                                            <div>
                                                                <p className="text-sm font-semibold text-neutral-800">{label}</p>
                                                                <p dir="ltr" className="text-[10px] text-neutral-400">{volume}</p>
                                                            </div>
                                                        </div>
                                                        <p dir="ltr" className={`text-base font-extrabold tabular-nums ${isA ? 'text-primary' : 'text-financial-loss'}`}>
                                                            {priceStr} <span className="text-xs font-normal text-neutral-400">DZD</span>
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {isA && (
                                            <p className="text-[10px] text-neutral-400 text-center pt-0.5">
                                                Après "Activer comme objectif", la calculatrice Assisté utilise ces prix
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* ── Volume Strategy Monitor ───────────────────── */}
                            {(() => {
                                const now = new Date();
                                const dayOfMonth   = now.getDate();
                                const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                const daysElapsed  = Math.max(1, dayOfMonth);
                                const daysRemaining = Math.max(1, daysInMonth - dayOfMonth);
                                const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

                                // Volume sold this month (USDT only)
                                const currentMonthVol = pamLedger.sellProfitRows
                                    .filter(r => r.currency === 'USDT' && r.timestamp >= monthStart)
                                    .reduce((s, r) => s + Number(r.quantity || 0), 0);

                                const dailyPace = currentMonthVol / daysElapsed;
                                const projectedVol = dailyPace * daysInMonth;

                                // Margins at each strategy price
                                const marginA = Math.max(0.01, targetPrice - pam);
                                const marginB = Math.max(0.01, minimumPrice - pam);

                                // Volume needed to hit goals
                                const volA_goal   = target    / marginA; // objective at A price
                                const volB_goal   = target    / marginB; // objective at B price
                                const volB_min    = minimum   / marginB; // minimum at B price

                                const remainA = Math.max(0, volA_goal - currentMonthVol);
                                const remainB = Math.max(0, volB_min  - currentMonthVol);

                                const paceNeededA = remainA / daysRemaining;
                                const paceNeededBmin = remainB / daysRemaining;

                                const achievedA    = currentMonthVol >= volA_goal;
                                const achievedBmin = currentMonthVol >= volB_min;
                                const projAchievesA    = projectedVol >= volA_goal;
                                const projAchievesBmin = projectedVol >= volB_min;

                                // Recommendation
                                type RecLevel = 'success' | 'primary' | 'warning' | 'danger';
                                let recText = '';
                                let recLevel: RecLevel = 'primary';
                                if (achievedA) {
                                    recText = 'Volume suffisant — maintenez les prix ambitieux. Chaque vente supplémentaire est un bonus.';
                                    recLevel = 'success';
                                } else if (projAchievesA) {
                                    recText = 'L\'objectif est accessible au rythme actuel — maintenez les prix forts (Stratégie A).';
                                    recLevel = 'primary';
                                } else if (projAchievesBmin) {
                                    recText = 'Le plancher sera atteint. Pour l\'objectif ambitieux: baissez légèrement les prix et cherchez plus de volume.';
                                    recLevel = 'warning';
                                } else {
                                    recText = 'Rythme insuffisant — appliquez le prix plancher et recherchez activement des clients pour maximiser le volume.';
                                    recLevel = 'danger';
                                }

                                const recColors: Record<RecLevel, string> = {
                                    success: 'bg-financial-profit-bg border-success/30 text-financial-profit',
                                    primary: 'bg-primary/5 border-primary/20 text-primary',
                                    warning: 'bg-warning-bg border-warning/30 text-warning',
                                    danger:  'bg-danger/5 border-danger/30 text-financial-loss',
                                };
                                const volPct = avgVol > 0 ? Math.min(100, (currentMonthVol / avgVol) * 100) : 0;

                                return (
                                    <div className="border-t border-border pt-3 space-y-3">
                                        {/* Header */}
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Volume ce mois</p>
                                            <span className="text-[10px] text-neutral-400">{daysRemaining}j restants · {fmt0(daysInMonth)}j total</span>
                                        </div>

                                        {/* Volume progress bar */}
                                        <div>
                                            <div className="flex items-center justify-between text-[10px] mb-1.5">
                                                <span dir="ltr" className="font-bold text-neutral-700">{fmt0(currentMonthVol)} USDT vendu</span>
                                                <span className="text-neutral-400">{fmt0(Math.round(volPct))}% de la moy. mensuelle</span>
                                            </div>
                                            <div className="relative h-3 w-full rounded-full bg-neutral-100 overflow-visible">
                                                {/* Current volume bar */}
                                                <div className={`h-3 rounded-full transition-all ${achievedA ? 'bg-financial-profit' : projAchievesA ? 'bg-primary' : projAchievesBmin ? 'bg-warning' : 'bg-danger/60'}`}
                                                    style={{ width: `${Math.min(100, volPct)}%` }}/>
                                                {/* Marker for Strategy A */}
                                                {volA_goal <= avgVol * 1.5 && (
                                                    <div className="absolute top-0 h-3 w-0.5 bg-primary/60 rounded-full"
                                                        style={{ left: `${Math.min(99, (volA_goal / (avgVol * 1.5)) * 100)}%` }}
                                                        title={`Objectif A: ${fmt0(volA_goal)} U`}/>
                                                )}
                                                {/* Marker for Min */}
                                                {volB_min <= avgVol * 1.5 && (
                                                    <div className="absolute top-0 h-3 w-0.5 bg-danger/40 rounded-full"
                                                        style={{ left: `${Math.min(99, (volB_min / (avgVol * 1.5)) * 100)}%` }}
                                                        title={`Plancher B: ${fmt0(volB_min)} U`}/>
                                                )}
                                            </div>
                                            <div className="flex justify-between text-[9px] text-neutral-400 mt-1">
                                                <span dir="ltr">Rythme: {fmt0(dailyPace)} U/j · Projection: ~{fmt0(projectedVol)} U</span>
                                                <span dir="ltr">Moy.: {fmt0(avgVol)} U</span>
                                            </div>
                                        </div>

                                        {/* Two strategy cards */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Strategy A — prix fort */}
                                            <div className={`rounded-xl border p-3 space-y-1.5 ${achievedA ? 'border-success/30 bg-financial-profit-bg/40' : projAchievesA ? 'border-primary/20 bg-primary/5' : 'border-neutral-200 bg-neutral-50'}`}>
                                                <p className="text-[9px] font-bold uppercase tracking-wide text-primary">A · Prix fort</p>
                                                <p dir="ltr" className="text-xs font-extrabold text-neutral-800">{Number.isInteger(targetPrice) ? targetPrice : fmt2(targetPrice)} DZD</p>
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] text-neutral-500">Vol. pour {fmt0(target)} DZD:</p>
                                                    <p dir="ltr" className="text-[10px] font-bold text-neutral-700">{fmt0(volA_goal)} USDT</p>
                                                </div>
                                                {achievedA ? (
                                                    <p className="text-[10px] font-bold text-financial-profit">✓ Atteint!</p>
                                                ) : (
                                                    <div>
                                                        <p className="text-[9px] text-neutral-400">Reste: <span className="font-bold text-neutral-700">{fmt0(remainA)} U</span></p>
                                                        <p dir="ltr" className={`text-[9px] font-bold ${projAchievesA ? 'text-primary' : 'text-financial-loss'}`}>
                                                            {fmt0(paceNeededA)} U/j nécessaire
                                                        </p>
                                                        <p className={`text-[9px] font-bold mt-0.5 ${projAchievesA ? 'text-primary' : 'text-financial-loss'}`}>
                                                            {projAchievesA ? '✓ Accessible' : '✗ Hors portée'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Strategy B — volume fort */}
                                            <div className={`rounded-xl border p-3 space-y-1.5 ${achievedBmin ? 'border-success/30 bg-financial-profit-bg/40' : projAchievesBmin ? 'border-warning/30 bg-warning-bg/30' : 'border-danger/20 bg-danger/5'}`}>
                                                <p className="text-[9px] font-bold uppercase tracking-wide text-financial-loss">B · Volume fort</p>
                                                <p dir="ltr" className="text-xs font-extrabold text-neutral-800">{Number.isInteger(minimumPrice) ? minimumPrice : fmt2(minimumPrice)} DZD</p>
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] text-neutral-500">Vol. pour {fmt0(minimum)} DZD:</p>
                                                    <p dir="ltr" className="text-[10px] font-bold text-neutral-700">{fmt0(volB_min)} USDT</p>
                                                </div>
                                                {achievedBmin ? (
                                                    <p className="text-[10px] font-bold text-financial-profit">✓ Plancher assuré!</p>
                                                ) : (
                                                    <div>
                                                        <p className="text-[9px] text-neutral-400">Reste: <span className="font-bold text-neutral-700">{fmt0(remainB)} U</span></p>
                                                        <p dir="ltr" className={`text-[9px] font-bold ${projAchievesBmin ? 'text-warning' : 'text-financial-loss'}`}>
                                                            {fmt0(paceNeededBmin)} U/j nécessaire
                                                        </p>
                                                        <p className={`text-[9px] font-bold mt-0.5 ${projAchievesBmin ? 'text-warning' : 'text-financial-loss'}`}>
                                                            {projAchievesBmin ? '⚠️ Faisable' : '✗ Critique'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Recommendation */}
                                        <div className={`rounded-xl border px-3 py-2.5 ${recColors[recLevel]}`}>
                                            <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5">Recommandation</p>
                                            <p className="text-[11px] font-semibold leading-relaxed">{recText}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>
                );
            })()}


            {/* PAM USDT History */}
            {pamHistoryUsdt.length >= 2 && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <SectionHeading icon={<TrendingUpIcon className="w-4 h-4"/>}>
                                Évolution du PAM USDT
                            </SectionHeading>
                            <div className="text-end shrink-0">
                                <p dir="ltr" className="text-lg font-extrabold text-neutral-800 tabular-nums">
                                    {currentPamUsdt.toFixed(2)} DZD
                                </p>
                                {trendUsdt !== null && (
                                    <p dir="ltr" className={`text-[11px] font-bold ${trendUsdt >= 0 ? 'text-financial-loss' : 'text-financial-profit'}`}>
                                        {trendUsdt >= 0 ? '↑' : '↓'} {Math.abs(trendUsdt).toFixed(2)} DZD depuis début
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-2 pb-4 pt-0">
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={pamHistoryUsdt} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="pamUsdtGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor={CHART_COLORS.usdt} stopOpacity={0.25}/>
                                            <stop offset="95%" stopColor={CHART_COLORS.usdt} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid}/>
                                    <XAxis dataKey="date" axisLine={false} tickLine={false}
                                        tick={{ fill: CHART_COLORS.tick, fontSize: 10 }} minTickGap={40}/>
                                    <YAxis axisLine={false} tickLine={false}
                                        tick={{ fill: CHART_COLORS.tick, fontSize: 10 }}
                                        domain={['auto', 'auto']}
                                        tickFormatter={(v) => v.toFixed(0)}/>
                                    <Tooltip content={<CustomTooltip/>}/>
                                    {/* Reference line at current PAM */}
                                    <ReferenceLine y={currentPamUsdt} stroke={CHART_COLORS.usdt} strokeDasharray="4 2" strokeOpacity={0.5}/>
                                    <Area type="monotone" dataKey="pam"
                                        stroke={CHART_COLORS.usdt} strokeWidth={2}
                                        fillOpacity={1} fill="url(#pamUsdtGrad)"
                                        dot={false} activeDot={{ r: 4, fill: CHART_COLORS.usdt }}/>
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-2 mt-3 px-2">
                            <div className="text-center">
                                <p className="text-[9px] uppercase font-bold text-neutral-400">Min PAM</p>
                                <p dir="ltr" className="text-sm font-extrabold text-financial-profit tabular-nums">{minUsdt.toFixed(2)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] uppercase font-bold text-neutral-400">Actuel</p>
                                <p dir="ltr" className="text-sm font-extrabold text-neutral-800 tabular-nums">{currentPamUsdt.toFixed(2)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] uppercase font-bold text-neutral-400">Max PAM</p>
                                <p dir="ltr" className="text-sm font-extrabold text-financial-loss tabular-nums">{maxUsdt.toFixed(2)}</p>
                            </div>
                        </div>
                        <p className="text-center text-[10px] text-neutral-400 mt-2">
                            {pamHistoryUsdt.length} opérations · chaque achat recalcule le PAM
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* PAM EUR History */}
            {pamHistoryEur.length >= 2 && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <SectionHeading icon={<TrendingUpIcon className="w-4 h-4"/>}>
                                Évolution du PAM EUR
                            </SectionHeading>
                            <p dir="ltr" className="text-lg font-extrabold text-neutral-800 tabular-nums shrink-0">
                                {currentPamEur.toFixed(2)} DZD
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="px-2 pb-4 pt-0">
                        <div className="h-[180px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={pamHistoryEur} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="pamEurGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor={CHART_COLORS.eur} stopOpacity={0.25}/>
                                            <stop offset="95%" stopColor={CHART_COLORS.eur} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid}/>
                                    <XAxis dataKey="date" axisLine={false} tickLine={false}
                                        tick={{ fill: CHART_COLORS.tick, fontSize: 10 }} minTickGap={40}/>
                                    <YAxis axisLine={false} tickLine={false}
                                        tick={{ fill: CHART_COLORS.tick, fontSize: 10 }}
                                        domain={['auto', 'auto']}
                                        tickFormatter={(v) => v.toFixed(0)}/>
                                    <Tooltip content={<CustomTooltip/>}/>
                                    <Area type="monotone" dataKey="pam"
                                        stroke={CHART_COLORS.eur} strokeWidth={2}
                                        fillOpacity={1} fill="url(#pamEurGrad)"
                                        dot={false} activeDot={{ r: 4, fill: CHART_COLORS.eur }}/>
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-center text-[10px] text-neutral-400 mt-2">
                            {pamHistoryEur.length} opérations EUR
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Day of week analysis */}
            {totalSells >= 3 && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <SectionHeading icon={<CalendarIcon className="w-4 h-4"/>}>
                                Meilleur jour de la semaine
                            </SectionHeading>
                            <span className="text-xs font-bold text-primary shrink-0">
                                🏆 {bestDay.day}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-2">
                        {dayAnalysis.map((d) => {
                            const barPct = maxDayProfit > 0 ? Math.max(d.profit > 0 ? 4 : 0, (d.profit / maxDayProfit) * 100) : 0;
                            const isBest = d.day === bestDay.day && d.profit > 0;
                            return (
                                <div key={d.day} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${isBest ? 'bg-financial-profit-bg' : ''}`}>
                                    <span className={`w-8 text-[11px] font-bold shrink-0 ${isBest ? 'text-financial-profit' : 'text-neutral-400'}`}>
                                        {d.day}
                                    </span>
                                    <div className="flex-1 rounded-full bg-neutral-100 h-2">
                                        {d.profit > 0 && <div className={`h-2 rounded-full ${isBest ? 'bg-financial-profit' : 'bg-financial-profit/40'}`} style={{ width: `${barPct}%` }}/>}
                                    </div>
                                    <div className="w-28 text-end shrink-0">
                                        {d.count > 0 ? (
                                            <span dir="ltr" className={`text-[11px] font-semibold tabular-nums ${isBest ? 'text-financial-profit' : 'text-neutral-600'}`}>
                                                +{d.profit.toLocaleString('fr-FR')} DZD
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-neutral-300">—</span>
                                        )}
                                    </div>
                                    <span className="text-[9px] text-neutral-400 shrink-0 w-8 text-end">{d.count}op</span>
                                </div>
                            );
                        })}
                        <p className="text-[10px] text-neutral-400 text-end pt-1">
                            Profit cumulé par jour · {totalSells} ventes analysées
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Time slot analysis */}
            {totalSells >= 3 && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <SectionHeading icon={<TrendingUpIcon className="w-4 h-4"/>}>
                                Meilleures tranches horaires
                            </SectionHeading>
                            <span className="text-xs font-bold text-primary shrink-0">
                                🕐 {bestSlot.label.split(' ')[0]} {bestSlot.label.split(' ')[1]}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="h-[160px] w-full mb-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={timeAnalysis} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid}/>
                                    <XAxis dataKey="label" axisLine={false} tickLine={false}
                                        tick={{ fill: CHART_COLORS.tick, fontSize: 9 }}
                                        tickFormatter={(v) => v.split(' ')[0]}/>
                                    <YAxis axisLine={false} tickLine={false}
                                        tick={{ fill: CHART_COLORS.tick, fontSize: 9 }}
                                        tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}/>
                                    <Tooltip
                                        content={({ active, payload, label }: any) => {
                                            if (!active || !payload?.length) return null;
                                            return (
                                                <div className="rounded-xl border border-border bg-surface p-3 shadow-card text-sm">
                                                    <p className="text-[11px] text-neutral-400 mb-1">{label}</p>
                                                    <p dir="ltr" className="font-extrabold text-financial-profit">
                                                        +{Number(payload[0].value || 0).toLocaleString('fr-FR')} DZD
                                                    </p>
                                                    <p className="text-[10px] text-neutral-400">{payload[0]?.payload?.count} ventes</p>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                                        {timeAnalysis.map((entry, i) => (
                                            <Cell key={i} fill={entry.label === bestSlot.label ? 'var(--color-primary)' : 'var(--color-primary)'} fillOpacity={entry.label === bestSlot.label ? 1 : 0.35}/>
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {timeAnalysis.map(slot => (
                                <div key={slot.label} className={`rounded-xl border p-3 ${slot.label === bestSlot.label ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface-muted'}`}>
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">{slot.label}</p>
                                    <p dir="ltr" className={`text-sm font-extrabold mt-1 ${slot.profit > 0 ? 'text-financial-profit' : 'text-neutral-300'}`}>
                                        {slot.profit > 0 ? `+${slot.profit.toLocaleString('fr-FR')} DZD` : '—'}
                                    </p>
                                    <p className="text-[9px] text-neutral-400">{slot.count} ventes</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {pamHistoryUsdt.length < 2 && pamHistoryEur.length < 2 && totalSells < 3 && (
                <Card>
                    <CardContent className="p-8 text-center text-neutral-400 text-sm">
                        Pas assez de données pour les analyses.<br/>
                        Effectuez au moins 3 ventes pour voir les tendances.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
