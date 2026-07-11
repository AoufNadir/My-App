import { useMemo, useState, useEffect } from 'react';
import {
    ResponsiveContainer, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { PageHeader } from '../components/ui/PageHeader';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { computePamLedger } from '../utils/pamLedger';
import type { Tx, ClientDzd, ClientTransactionDzd, Investor } from '../types';
import { quoteSale, type PricingContext } from '../services/smartPricingEngine';
import { useLanguage } from '../contexts/LanguageContext';

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
    pricingContext?: PricingContext;
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

export function InsightsPage({ transactions, clientsDzd = [], clientTransactionsDzd = [], investors = [], portfolioStats, investorReconciliationDiff, pricingContext }: InsightsPageProps) {
    const { t } = useLanguage();
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
    const canonicalReference = pricingContext && pricingContext.pam > 0
        ? quoteSale(pricingContext, { currency: 'USDT', clientId: null, quantity: 300, payment: { kind: 'cash' } })
        : null;

    return (
        <div className="anim-page-in space-y-4">
            <PageHeader title="Insights" subtitle="Analyses avancées"/>

            {canonicalReference && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <SectionHeading icon={<SparklesIcon className="h-4 w-4"/>}>{t('smartPricing.title')}</SectionHeading>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-2 p-4 pt-0">
                        {([
                            [t('smartPricing.opening'), canonicalReference.corridor.openingPrice],
                            [t('smartPricing.target'), canonicalReference.corridor.targetPrice],
                            [t('smartPricing.floor'), canonicalReference.corridor.floorPrice],
                        ] as Array<[string, number]>).map(([label, value]) => (
                            <div key={label} className="rounded-xl bg-surface-muted p-3 text-center">
                                <p className="text-[10px] font-bold text-neutral-400">{label}</p>
                                <p dir="ltr" className="text-lg font-black tabular-nums text-primary">{fmt2(value)}</p>
                            </div>
                        ))}
                        <p className="col-span-3 text-[11px] text-neutral-500">
                            {t(`smartPricing.reasons.market_${canonicalReference.market.effective}`)}{' '}
                            {canonicalReference.goal.volumeMissing ? t('smartPricing.reasons.goal_volume_missing') : t('smartPricing.subtitle')}
                        </p>
                    </CardContent>
                </Card>
            )}

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
