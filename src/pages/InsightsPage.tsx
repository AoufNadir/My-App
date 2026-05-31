import { useMemo, useState } from 'react';
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
import { roundToMarketPrice, ceilToMarketPrice, allTierPrices, ClientTierType, computeGoalAdjustedBase, getVolumeBracket } from '../utils/pricingMatrix';
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

export function InsightsPage({ transactions, clientsDzd = [], clientTransactionsDzd = [], investors = [], portfolioStats, investorReconciliationDiff }: InsightsPageProps) {
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

    // Data integrity checks
    const integrityChecks = useMemo(() => {
        const checks: Array<{ label: string; status: 'ok' | 'warn' | 'error'; detail: string }> = [];

        // 1. Investor shares sum
        const activeInvestors = investors.filter(i => i.isActive && !i.isManager);
        const sharesSum = activeInvestors.reduce((s, i) => s + Number(i.sharePercentage || 0), 0);
        const sharesPct = Math.round(sharesSum * 100 * 10) / 10;
        checks.push({
            label: 'Parts investisseurs',
            status: Math.abs(sharesSum - 1) < 0.01 ? 'ok' : sharesSum > 1.01 ? 'error' : 'warn',
            detail: activeInvestors.length === 0 ? 'Aucun investisseur actif' : `${sharesPct}% (doit être 100%)`,
        });

        // 2. Negative PAM
        const usdtPam = portfolioStats?.usdt.avgBuy ?? 0;
        const eurPam = portfolioStats?.eur.avgBuy ?? 0;
        const pamOk = usdtPam >= 0 && eurPam >= 0;
        checks.push({
            label: 'PAM positif (USDT/EUR)',
            status: pamOk ? 'ok' : 'error',
            detail: pamOk
                ? `USDT: ${usdtPam.toFixed(2)} | EUR: ${eurPam.toFixed(2)} DZD`
                : `PAM négatif détecté!`,
        });

        // 3. Sells without linked client
        const sellTxIds = new Set(transactions.filter(tx => tx.type === 'sell').map(tx => tx.id));
        const linkedSellIds = new Set(clientTransactionsDzd.filter(tx => tx.linkedTxId).map(tx => tx.linkedTxId));
        const unlinkedSells = [...sellTxIds].filter(id => !linkedSellIds.has(id)).length;
        checks.push({
            label: 'Ventes sans client lié',
            status: unlinkedSells === 0 ? 'ok' : unlinkedSells <= 5 ? 'warn' : 'error',
            detail: unlinkedSells === 0 ? 'Toutes les ventes sont liées' : `${unlinkedSells} vente${unlinkedSells > 1 ? 's' : ''} sans client`,
        });

        // 4. Duplicate phone numbers
        const phoneMap = new Map<string, string[]>();
        for (const c of clientsDzd) {
            const phone = c.phone?.trim();
            if (!phone) continue;
            const existing = phoneMap.get(phone) || [];
            existing.push(c.fullName || c.id);
            phoneMap.set(phone, existing);
        }
        const dupPhones = [...phoneMap.entries()].filter(([, names]) => names.length > 1);
        checks.push({
            label: 'Doublons de téléphone',
            status: dupPhones.length === 0 ? 'ok' : 'warn',
            detail: dupPhones.length === 0
                ? 'Aucun doublon détecté'
                : `${dupPhones.length} numéro${dupPhones.length > 1 ? 's' : ''} en double`,
        });

        // 5. Investor reconciliation
        if (typeof investorReconciliationDiff === 'number') {
            const absRec = Math.abs(investorReconciliationDiff);
            checks.push({
                label: 'Réconciliation investisseurs',
                status: absRec < 1 ? 'ok' : absRec < 1000 ? 'warn' : 'error',
                detail: absRec < 1 ? 'Équilibre parfait'
                    : `Écart: ${investorReconciliationDiff > 0 ? '+' : ''}${Math.round(investorReconciliationDiff).toLocaleString('fr-FR')} DZD`,
            });
        }

        // 6. Transactions with 0 or missing total
        const badTxs = transactions.filter(tx => (tx.type === 'sell' || tx.type === 'buy') && (!tx.total || tx.total <= 0) && tx.quantity > 0 && (tx.price || tx.sell || 0) > 0);
        checks.push({
            label: 'Transactions avec total manquant',
            status: badTxs.length === 0 ? 'ok' : 'warn',
            detail: badTxs.length === 0 ? 'Toutes les transactions sont complètes'
                : `${badTxs.length} transaction${badTxs.length > 1 ? 's' : ''} sans total`,
        });

        return checks;
    }, [investors, portfolioStats, transactions, clientTransactionsDzd, clientsDzd, investorReconciliationDiff]);

    const okCount = integrityChecks.filter(c => c.status === 'ok').length;
    const warnCount = integrityChecks.filter(c => c.status === 'warn').length;
    const errorCount = integrityChecks.filter(c => c.status === 'error').length;

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
    }, [pamLedger, portfolioStats]);

    // Projection calculator state
    const [projectionTarget, setProjectionTarget] = useState('');

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
                const targetInput = parseAndEvaluate(projectionTarget);
                const target = targetInput > 0 ? targetInput : yearlyStats.avgMonthlyProfit;

                // Target price to achieve profit goal at historical volume
                const neededMargin = avgVol > 0 ? target / avgVol : 0;
                const targetPriceRaw = pam + neededMargin;
                // Use CEILING rounding so the rounded price always ≥ needed price → goal is guaranteed
                const targetPrice = ceilToMarketPrice(targetPriceRaw);
                const actualProfitAtTarget = (targetPrice - pam) * avgVol;

                // Volume needed to achieve profit goal at historical avg sell price
                const histMargin = yearlyStats.avgSellDzd - pam;
                const volumeNeeded = histMargin > 0 ? Math.ceil(target / histMargin) : 0;

                return (
                    <Card>
                        <CardHeader className="p-4 pb-3">
                            <SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>
                                🔮 Projection mois prochain
                            </SectionHeading>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">
                            {/* Context row */}
                            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                                <div className="rounded-lg bg-surface-muted border border-border p-2">
                                    <p className="font-bold uppercase text-neutral-400">Vol. moy/mois</p>
                                    <p dir="ltr" className="font-extrabold text-neutral-800 text-sm mt-0.5">{fmt0(avgVol)} U</p>
                                </div>
                                <div className="rounded-lg bg-surface-muted border border-border p-2">
                                    <p className="font-bold uppercase text-neutral-400">PAM actuel</p>
                                    <p dir="ltr" className="font-extrabold text-neutral-800 text-sm mt-0.5">{fmt2(pam)} DZD</p>
                                </div>
                                <div className="rounded-lg bg-surface-muted border border-border p-2">
                                    <p className="font-bold uppercase text-neutral-400">Marge hist.</p>
                                    <p dir="ltr" className="font-extrabold text-financial-profit text-sm mt-0.5">+{fmt2(histMargin > 0 ? histMargin : yearlyStats.avgSellDzd - pam)} DZD/U</p>
                                </div>
                            </div>

                            {/* Objective input */}
                            <div>
                                <MoneyField
                                    label={`Objectif mensuel (DZD) — défaut: votre moyenne +${fmt0(yearlyStats.avgMonthlyProfit)} DZD`}
                                    value={projectionTarget}
                                    onChange={setProjectionTarget}
                                    currency="DZD"
                                    placeholder={fmt0(yearlyStats.avgMonthlyProfit)}
                                    hint={storedGoal > 0 ? `Goal défini: ${fmt0(storedGoal)} DZD` : undefined}
                                />
                                {storedGoal > 0 && !projectionTarget && (
                                    <button type="button" onClick={() => setProjectionTarget(String(storedGoal))} className="mt-1 text-xs font-semibold text-primary hover:underline">
                                        Utiliser mon objectif mensuel ({fmt0(storedGoal)} DZD) →
                                    </button>
                                )}
                            </div>

                            {/* Results */}
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                                <p className="text-[11px] font-bold uppercase text-primary tracking-wide">
                                    Pour réaliser {fmt0(target)} DZD ce mois-ci :
                                </p>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {/* Option A — fix price, historical volume */}
                                    <div className="rounded-xl border border-border bg-surface p-3">
                                        <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">
                                            Option A — même volume ({fmt0(avgVol)} U)
                                        </p>
                                        <p dir="ltr" className="text-2xl font-extrabold tabular-nums text-primary">
                                            {Number.isInteger(targetPrice) ? targetPrice : fmt2(targetPrice)} DZD
                                        </p>
                                        <p className="text-[11px] text-neutral-500 mt-1">
                                            +{fmt2(targetPrice - pam)} DZD/USDT de marge
                                        </p>
                                        {actualProfitAtTarget > target && (
                                            <p className="text-[10px] text-financial-profit mt-0.5">
                                                ≈ +{fmt0(actualProfitAtTarget)} DZD effectif (arrondi ↑)
                                            </p>
                                        )}
                                        <Button type="button" size="sm" variant="outline" className="mt-2 w-full text-xs font-bold"
                                            onClick={() => {
                                                localStorage.setItem('app_insights_suggested_price', String(targetPrice));
                                                localStorage.setItem('app_monthly_profit_goal', String(Math.round(target)));
                                                window.dispatchEvent(new StorageEvent('storage', { key: 'app_monthly_profit_goal', newValue: String(Math.round(target)) }));
                                            }}>
                                            → Définir comme objectif + prix de référence
                                        </Button>
                                    </div>

                                    {/* Option B — historical price, need more volume */}
                                    <div className="rounded-xl border border-border bg-surface p-3">
                                        <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">
                                            Option B — prix historique ({yearlyStats.avgSellDzd > 0 ? fmt2(roundToMarketPrice(yearlyStats.avgSellDzd)) : '—'} DZD)
                                        </p>
                                        {volumeNeeded > 0 ? (<>
                                            <p dir="ltr" className="text-2xl font-extrabold tabular-nums text-secondary">
                                                {fmt0(volumeNeeded)} USDT
                                            </p>
                                            <p className="text-[11px] text-neutral-500 mt-1">
                                                {volumeNeeded > avgVol
                                                    ? `+${fmt0(volumeNeeded - avgVol)} U vs votre moyenne (${Math.round((volumeNeeded / avgVol - 1) * 100)}% de plus)`
                                                    : `−${fmt0(avgVol - volumeNeeded)} U vs votre moyenne`}
                                            </p>
                                        </>) : (
                                            <p className="text-sm text-neutral-400">Données insuffisantes</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <p className="text-center text-[10px] text-neutral-400">
                                Formule A: Prix = PAM + Objectif ÷ Volume  ·  Formule B: Volume = Objectif ÷ (PrixHist − PAM)
                            </p>

                            {/* Tier price table — goal-aligned */}
                            {neededMargin > 0 && (() => {
                                // Adjust base so even VIP achieves the goal
                                const bracket = getVolumeBracket(avgVol);
                                const adjustedBase = computeGoalAdjustedBase(neededMargin, bracket);
                                const tiers = allTierPrices(pam, avgVol, adjustedBase, adjustedBase);
                                const tierOrder: ClientTierType[] = ['vip', 'regular', 'petit', 'new'];
                                const TIER_ICONS: Record<string, string> = { vip: '🏆 VIP', regular: '⭐ Régulier', petit: '🔸 Petit', new: '🆕 Nouveau' };
                                return (
                                    <div className="border-t border-border pt-3">
                                        <p className="text-[10px] font-bold uppercase text-neutral-400 mb-2 tracking-wide">
                                            Prix par type de client · volume moy. {fmt0(avgVol)} USDT/mois
                                        </p>
                                        <div className="rounded-xl border border-border overflow-hidden">
                                            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-surface-muted px-3 py-2 text-[9px] font-bold uppercase text-neutral-400 tracking-wide border-b border-border">
                                                <span>Type</span>
                                                <span className="text-right">Prix</span>
                                                <span className="text-right">+/USDT</span>
                                                <span className="text-right">Profit/mois</span>
                                            </div>
                                            {tierOrder.map(tier => {
                                                const row = tiers[tier];
                                                const monthlyProfit = row.profitPerUnit * avgVol;
                                                const achievesGoal = monthlyProfit >= target;
                                                const priceStr = Number.isInteger(row.price) ? `${row.price}` : fmt2(row.price);
                                                return (
                                                    <div key={tier} className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2.5 border-b last:border-b-0 border-neutral-100 ${achievesGoal ? 'bg-financial-profit-bg/40' : ''}`}>
                                                        <span className={`text-xs font-bold ${achievesGoal ? 'text-financial-profit' : 'text-neutral-700'}`}>
                                                            {TIER_ICONS[tier]}
                                                            {achievesGoal
                                                                ? <span className="ml-1 text-[9px] bg-financial-profit/15 text-financial-profit px-1 rounded-full">✓ objectif</span>
                                                                : <span className="ml-1 text-[9px] text-neutral-300">{fmt0(target - monthlyProfit)} DZD manquants</span>
                                                            }
                                                        </span>
                                                        <span dir="ltr" className={`text-sm font-extrabold tabular-nums text-right ${achievesGoal ? 'text-financial-profit' : 'text-neutral-800'}`}>
                                                            {priceStr} DZD
                                                        </span>
                                                        <span dir="ltr" className="text-xs font-semibold tabular-nums text-right text-financial-profit">
                                                            +{fmt2(row.profitPerUnit)}
                                                        </span>
                                                        <span dir="ltr" className="text-xs font-bold tabular-nums text-right text-financial-profit">
                                                            +{fmt0(monthlyProfit)} DZD
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[9px] text-neutral-400 mt-1.5 text-center">
                                            ✨ Après "Définir comme objectif", le calculateur Assisté utilise ces prix automatiquement
                                        </p>
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>
                );
            })()}

            {/* Data Integrity Card */}
            <Card>
                <CardHeader className="p-4 pb-3">
                    <div className="flex items-center justify-between gap-2">
                        <SectionHeading icon={<TrendingUpIcon className="w-4 h-4"/>}>
                            Santé des données
                        </SectionHeading>
                        <div className="flex items-center gap-2 shrink-0">
                            {errorCount > 0 && <span className="rounded-full bg-danger-bg border border-danger/30 px-2 py-0.5 text-[10px] font-bold text-financial-loss">{errorCount} erreur{errorCount > 1 ? 's' : ''}</span>}
                            {warnCount > 0 && <span className="rounded-full bg-warning-bg border border-warning/30 px-2 py-0.5 text-[10px] font-bold text-warning">{warnCount} alerte{warnCount > 1 ? 's' : ''}</span>}
                            {errorCount === 0 && warnCount === 0 && <span className="rounded-full bg-success-bg border border-success/30 px-2 py-0.5 text-[10px] font-bold text-financial-profit">✓ Tout OK</span>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-neutral-100">
                    {integrityChecks.map((check) => {
                        const icon = check.status === 'ok' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
                        const textCls = check.status === 'ok' ? 'text-financial-profit' : check.status === 'warn' ? 'text-warning' : 'text-financial-loss';
                        return (
                            <div key={check.label} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm shrink-0">{icon}</span>
                                    <span className="text-sm font-semibold text-neutral-700 truncate">{check.label}</span>
                                </div>
                                <span className={`text-xs font-semibold shrink-0 text-right ${textCls}`}>
                                    {check.detail}
                                </span>
                            </div>
                        );
                    })}
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
                                    <div className="w-28 text-right shrink-0">
                                        {d.count > 0 ? (
                                            <span dir="ltr" className={`text-[11px] font-semibold tabular-nums ${isBest ? 'text-financial-profit' : 'text-neutral-600'}`}>
                                                +{d.profit.toLocaleString('fr-FR')} DZD
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-neutral-300">—</span>
                                        )}
                                    </div>
                                    <span className="text-[9px] text-neutral-400 shrink-0 w-8 text-right">{d.count}op</span>
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
