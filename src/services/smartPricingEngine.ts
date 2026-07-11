/**
 * Canonical, pure selling-price policy.
 *
 * Every surface (month plan, direct sale, Insights and portal publication)
 * must build one PricingContext and call quoteSale. This module deliberately
 * performs no Firebase, localStorage or React work.
 */

import type {
    ClientDzd,
    ClientTransactionDzd,
    PricingCustomerSegment,
    PricingMarketStatus,
    PricingPaymentKind,
    SmartPricingSnapshot,
    Tx,
} from '../types';
import { computeClientDebtState, projectCreditExposure, type ClientDebtState } from '../utils/clientDebt';
import { ceilToMarketPrice, getVolumeBracket, type VolumeBracket } from '../utils/pricingMatrix';

export type PricingCurrency = 'USDT' | 'EUR';
export type MarketStatus = PricingMarketStatus;
export type CustomerSegment = PricingCustomerSegment;
export type SmartPaymentStatus = PricingPaymentKind;

const DAY = 86_400_000;
const MODEL_VERSION = 'hybrid-v1';
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const finite = (n: unknown, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;

// ─────────────────────────────────────────────────────────────────────────────
// Market detection
// ─────────────────────────────────────────────────────────────────────────────

export type MarketSnapshot = {
    status: MarketStatus;
    pam: number;
    lastBuyPrice: number;
    lastBuyTimestamp: number;
    avgLast3: number;
    avg7d: number;
    deltaLastVsPam: number;
    momentum: number;
    volatility: number;
    sampleCount: number;
    confidence: 'low' | 'medium' | 'high';
};

const MARKET_WINDOW_DAYS = 14;
const MARKET_WINDOW_MAX = 10;
const TREND_BAND = 0.4;
const VOLATILITY_THRESHOLD = 1;

export function detectMarket(
    transactions: Tx[],
    currency: PricingCurrency,
    pam: number,
    now = Date.now(),
): MarketSnapshot {
    const cutoff = now - MARKET_WINDOW_DAYS * DAY;
    const buys = transactions
        .filter((tx) => tx.type === 'buy' && tx.currency === currency && finite(tx.price) > 0)
        .sort((a, b) => a.timestamp - b.timestamp);
    const window = buys.filter((tx) => tx.timestamp >= cutoff).slice(-MARKET_WINDOW_MAX);
    const last = buys[buys.length - 1];
    const confidence = window.length >= 6 ? 'high' : window.length >= 3 ? 'medium' : 'low';
    const empty: MarketSnapshot = {
        status: 'unknown',
        pam,
        lastBuyPrice: last ? finite(last.price) : 0,
        lastBuyTimestamp: last?.timestamp || 0,
        avgLast3: 0,
        avg7d: 0,
        deltaLastVsPam: 0,
        momentum: 0,
        volatility: 0,
        sampleCount: window.length,
        confidence,
    };
    if (window.length < 2) return empty;

    const prices = window.map((tx) => finite(tx.price));
    const lastPrice = prices[prices.length - 1];
    const previous = prices.slice(0, -1);
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const volatility = Math.sqrt(prices.reduce((sum, price) => sum + (price - mean) ** 2, 0) / prices.length);
    const momentum = lastPrice - previous.reduce((sum, price) => sum + price, 0) / previous.length;
    const last3 = prices.slice(-3);
    const avgLast3 = last3.reduce((sum, price) => sum + price, 0) / last3.length;

    const cutoff7d = now - 7 * DAY;
    let cost7d = 0;
    let qty7d = 0;
    for (const tx of window) {
        if (tx.timestamp < cutoff7d) continue;
        const qty = Math.max(0, finite(tx.quantity));
        if (qty <= 0) continue;
        cost7d += finite(tx.price) * qty;
        qty7d += qty;
    }
    const avg7d = qty7d > 0 ? cost7d / qty7d : avgLast3;

    let flips = 0;
    for (let i = 2; i < prices.length; i++) {
        const a = prices[i - 1] - prices[i - 2];
        const b = prices[i] - prices[i - 1];
        if (a * b < 0 && Math.abs(a) > 0.1 && Math.abs(b) > 0.1) flips++;
    }

    const deltaVsPam = pam > 0 ? avgLast3 - pam : 0;
    let status: MarketStatus;
    if (volatility >= VOLATILITY_THRESHOLD && (flips >= 2 || Math.abs(momentum) < volatility / 2)) {
        status = 'volatile';
    } else if (momentum > TREND_BAND || (Math.abs(momentum) <= TREND_BAND && deltaVsPam > TREND_BAND)) {
        status = 'rising';
    } else if (momentum < -TREND_BAND || (Math.abs(momentum) <= TREND_BAND && deltaVsPam < -TREND_BAND)) {
        status = 'falling';
    } else {
        status = 'stable';
    }

    return {
        status,
        pam,
        lastBuyPrice: lastPrice,
        lastBuyTimestamp: window[window.length - 1].timestamp,
        avgLast3: round2(avgLast3),
        avg7d: round2(avg7d),
        deltaLastVsPam: round2(pam > 0 ? lastPrice - pam : 0),
        momentum: round2(momentum),
        volatility: round2(volatility),
        sampleCount: window.length,
        confidence,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer profiles and negotiation learning
// ─────────────────────────────────────────────────────────────────────────────

export type CustomerProfile = {
    clientId: string;
    score: number;
    segment: CustomerSegment;
    vol30d: number;
    txCount30d: number;
    txCount90d: number;
    creditRatio90d: number;
    avgMarginPerUnit: number;
    negoLossPerUnit: number;
    trackedNegotiations: number;
    /** Learned repayment behavior (merged from the client's DZD debt ledger). */
    avgSettleDays: number | null;
    settledCreditLots: number;
    isNew: boolean;
};

export function segmentFromScore(score: number, isNew: boolean): CustomerSegment {
    if (isNew) return 'new';
    if (score >= 80) return 'vip';
    if (score >= 60) return 'good';
    if (score >= 40) return 'normal';
    if (score >= 20) return 'weak';
    return 'risky';
}

type DerivedProfitLookup = Record<string, number | { derivedProfit?: number }>;

function derivedProfitFor(tx: Tx, lookup?: DerivedProfitLookup) {
    const found = lookup?.[tx.id];
    if (typeof found === 'number') return found;
    if (found && Number.isFinite(found.derivedProfit)) return Number(found.derivedProfit);
    return finite(tx.profit);
}

export function buildCustomerProfiles(
    transactions: Tx[],
    vipVolumeThreshold: number,
    now = Date.now(),
    derivedProfits?: DerivedProfitLookup,
    currency?: PricingCurrency,
): Map<string, CustomerProfile> {
    const start30 = now - 30 * DAY;
    const start90 = now - 90 * DAY;
    type Acc = {
        vol30: number;
        count30: number;
        count90: number;
        credit90: number;
        profit90: number;
        qty90: number;
        negotiationLoss: number;
        negotiationQty: number;
        trackedNegotiations: number;
    };
    const acc = new Map<string, Acc>();

    for (const tx of transactions) {
        if (tx.type !== 'sell' || !tx.linkedClientId || tx.linkedClientId === 'none') continue;
        if (currency && tx.currency !== currency) continue;
        const clientId = tx.linkedClientId;
        const row = acc.get(clientId) || {
            vol30: 0,
            count30: 0,
            count90: 0,
            credit90: 0,
            profit90: 0,
            qty90: 0,
            negotiationLoss: 0,
            negotiationQty: 0,
            trackedNegotiations: 0,
        };
        const qty = Math.max(0, finite(tx.quantity));
        if (tx.timestamp >= start30 && tx.currency === 'USDT') {
            row.vol30 += qty;
            row.count30++;
        }
        if (tx.timestamp >= start90) {
            row.count90++;
            if (tx.clientPaymentStatus === 'credit') row.credit90++;
            row.profit90 += derivedProfitFor(tx, derivedProfits);
            row.qty90 += qty;
            const target = finite(tx.spSnapshot?.corridor.targetPrice, finite(tx.spTargetPrice));
            const sold = finite(tx.sell);
            if (target > 0 && sold > 0 && qty > 0) {
                row.negotiationLoss += Math.max(0, target - sold) * qty;
                row.negotiationQty += qty;
                row.trackedNegotiations++;
            }
        }
        acc.set(clientId, row);
    }

    const profiles = new Map<string, CustomerProfile>();
    for (const [clientId, row] of acc) {
        const creditRatio = row.count90 > 0 ? row.credit90 / row.count90 : 0;
        const avgMargin = row.qty90 > 0 ? row.profit90 / row.qty90 : 0;
        const negoLossPerUnit = row.negotiationQty > 0 ? row.negotiationLoss / row.negotiationQty : 0;
        const volumePts = 35 * Math.min(1, vipVolumeThreshold > 0 ? row.vol30 / vipVolumeThreshold : 0);
        const frequencyPts = 15 * Math.min(1, row.count30 / 6);
        const paymentPts = 25 * (1 - creditRatio);
        const marginPts = 15 * Math.min(1, Math.max(0, avgMargin) / 2);
        // Negotiation history influences OPENING only. Keep the behavioral
        // score neutral so frequent haggling never lowers target/floor.
        const negotiationPts = 10;
        const score = Math.round(clamp(volumePts + frequencyPts + paymentPts + marginPts + negotiationPts, 0, 100));
        profiles.set(clientId, {
            clientId,
            score,
            segment: segmentFromScore(score, false),
            vol30d: row.vol30,
            txCount30d: row.count30,
            txCount90d: row.count90,
            creditRatio90d: round2(creditRatio),
            avgMarginPerUnit: round2(avgMargin),
            negoLossPerUnit: round2(negoLossPerUnit),
            trackedNegotiations: row.trackedNegotiations,
            avgSettleDays: null,
            settledCreditLots: 0,
            isNew: false,
        });
    }
    return profiles;
}

export function newClientProfile(clientId: string): CustomerProfile {
    return {
        clientId,
        score: 45,
        segment: 'new',
        vol30d: 0,
        txCount30d: 0,
        txCount90d: 0,
        creditRatio90d: 0,
        avgMarginPerUnit: 0,
        negoLossPerUnit: 0,
        trackedNegotiations: 0,
        avgSettleDays: null,
        settledCreditLots: 0,
        isNew: true,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy, plan and context
// ─────────────────────────────────────────────────────────────────────────────

type Band = [number, number];
type BandTable = Record<CustomerSegment, Band>;

const STABLE_BANDS: BandTable = {
    vip: [0.5, 1.5],
    good: [1, 2],
    normal: [1.5, 2.5],
    weak: [2.5, 3.5],
    risky: [3, 4],
    new: [2, 3],
};

export const DEFAULT_MARKET_BANDS: Record<MarketStatus, BandTable> = {
    stable: STABLE_BANDS,
    unknown: STABLE_BANDS,
    falling: {
        vip: [0.25, 0.75], good: [0.5, 1.25], normal: [0.5, 1.5],
        weak: [1.5, 2.5], risky: [3, 4], new: [1, 2],
    },
    rising: {
        vip: [0.75, 1.5], good: [1.25, 2.25], normal: [2, 3],
        weak: [2.75, 3.75], risky: [3.25, 4], new: [2.5, 3.5],
    },
    volatile: {
        vip: [0.5, 1.25], good: [1, 2], normal: [1.75, 2.75],
        weak: [2.5, 3.5], risky: [3.5, 4], new: [2.25, 3.25],
    },
};

export type PricingPolicyConfig = {
    schemaVersion: 1;
    modelVersion: string;
    revision: number;
    vipVolumeThreshold: number;
    regularVolumeThreshold: number;
    smallVolumeThreshold: number;
    quantityAdjustments: { small: number; medium: number; large: number };
    monthlyCapitalCostRate: number;
    negotiationBuffer: number;
    learnedNegotiationCap: number;
    minNegotiationDeals: number;
    minHistoryDays: number;
    minHistoryDeals: number;
    highCreditUtilizationPct: number;
    seriousOverdueDays: number;
    /** Credit term (days) assumed when no due date AND no repayment history. */
    creditDefaultTermDays: number;
    goalPressureWarningMargin: number;
    marketBands: Record<MarketStatus, BandTable>;
    legacyGoalMixWeights?: Record<string, number>;
};

export const DEFAULT_PRICING_POLICY: PricingPolicyConfig = {
    schemaVersion: 1,
    modelVersion: MODEL_VERSION,
    revision: 1,
    vipVolumeThreshold: 5000,
    regularVolumeThreshold: 1000,
    smallVolumeThreshold: 150,
    quantityAdjustments: { small: 0.5, medium: 0, large: -0.5 },
    monthlyCapitalCostRate: 0.02,
    negotiationBuffer: 0.5,
    learnedNegotiationCap: 2,
    minNegotiationDeals: 3,
    minHistoryDays: 30,
    minHistoryDeals: 5,
    highCreditUtilizationPct: 80,
    seriousOverdueDays: 30,
    creditDefaultTermDays: 7,
    goalPressureWarningMargin: 4,
    marketBands: DEFAULT_MARKET_BANDS,
};

export type PricingMonthlyPlan = {
    schemaVersion: 1;
    monthKey: string;
    revision: number;
    monthlyGoal: number;
    minimumGoal: number;
    expectedMonthlyVolume: Partial<Record<PricingCurrency, number>>;
};

export type PricingOverride = {
    id?: string;
    schemaVersion?: 1;
    revision?: number;
    kind: 'market' | 'client';
    currency: PricingCurrency;
    clientId?: string;
    marketStatus?: MarketStatus;
    customerSegment?: CustomerSegment;
    reason?: string;
    expiresAt?: number;
    scope?: 'sale' | 'today';
};

export type PricingHistory = {
    observedDays: number;
    dealCount: number;
    monthlyVolume: number;
    expectedMonthlyVolume: number;
    source: 'history' | 'manual' | 'missing';
    confidence: 'low' | 'medium' | 'high';
};

export type GoalPressure = {
    monthlyGoal: number;
    minimumGoal: number;
    mtdProfit: number;
    remainingGoal: number;
    remainingMinimum: number;
    expectedRemainingVolume: number;
    baselineTargetMargin: number;
    baselineFloorMargin: number;
    targetShift: number;
    floorShift: number;
    volumeMissing: boolean;
    feasible: boolean;
};

export type PricingContext = {
    now: number;
    currency: PricingCurrency;
    pam: number;
    available: number;
    policy: PricingPolicyConfig;
    plan: PricingMonthlyPlan;
    market: MarketSnapshot;
    profiles: Map<string, CustomerProfile>;
    clientsById: Map<string, ClientDzd>;
    debtByClientId: Map<string, ClientDebtState>;
    history: PricingHistory;
    goal: GoalPressure;
    dailyMarketOverride?: PricingOverride;
    dailyClientOverrides: Map<string, PricingOverride>;
    negotiationMtd: NegotiationStats;
};

export type PricingContextInput = {
    transactions: Tx[];
    clients?: ClientDzd[];
    clientTransactions?: ClientTransactionDzd[];
    currency?: PricingCurrency;
    pam: number;
    available?: number;
    plan: PricingMonthlyPlan;
    mtdProfit: number;
    policy?: PricingPolicyConfig;
    overrides?: PricingOverride[];
    derivedProfits?: DerivedProfitLookup;
    now?: number;
};

function monthDays(now: number) {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function monthKeyFor(now = Date.now()) {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildHistory(
    transactions: Tx[],
    currency: PricingCurrency,
    plan: PricingMonthlyPlan,
    policy: PricingPolicyConfig,
    now: number,
): PricingHistory {
    const start90 = now - 90 * DAY;
    const sells = transactions
        .filter((tx) => tx.type === 'sell' && tx.currency === currency && tx.timestamp >= start90 && finite(tx.quantity) > 0)
        .sort((a, b) => a.timestamp - b.timestamp);
    const observedDays = sells.length > 0
        ? Math.min(90, Math.max(1, Math.ceil((now - sells[0].timestamp) / DAY)))
        : 0;
    const totalVolume = sells.reduce((sum, tx) => sum + Math.max(0, finite(tx.quantity)), 0);
    const monthlyVolume = observedDays > 0 ? totalVolume / observedDays * monthDays(now) : 0;
    const manual = Math.max(0, finite(plan.expectedMonthlyVolume[currency]));
    const historyReady = observedDays >= policy.minHistoryDays && sells.length >= policy.minHistoryDeals;
    const expectedMonthlyVolume = manual > 0 ? manual : historyReady ? monthlyVolume : 0;
    return {
        observedDays,
        dealCount: sells.length,
        monthlyVolume: round2(monthlyVolume),
        expectedMonthlyVolume: round2(expectedMonthlyVolume),
        source: manual > 0 ? 'manual' : historyReady ? 'history' : 'missing',
        confidence: manual > 0 || (observedDays >= 60 && sells.length >= 10)
            ? 'high'
            : historyReady ? 'medium' : 'low',
    };
}

const SEGMENT_RANK: Record<CustomerSegment, number> = {
    vip: 0, good: 1, normal: 2, new: 3, weak: 4, risky: 5,
};

function worseSegment(a: CustomerSegment, b: CustomerSegment) {
    return SEGMENT_RANK[a] >= SEGMENT_RANK[b] ? a : b;
}

function paymentTermDays(kind: PricingPaymentKind, dueDate: string | undefined, now: number) {
    if (kind !== 'credit') return 0;
    if (!dueDate) return 0;
    const due = Date.parse(`${dueDate}T23:59:59`);
    if (!Number.isFinite(due)) return 0;
    return Math.max(0, Math.ceil((due - now) / DAY));
}

export type CreditTermSource = 'explicit' | 'learned' | 'default';

/**
 * Effective credit term: the promised due date wins; without one, price by
 * the client's LEARNED average repayment delay; a brand-new client falls back
 * to the policy default. A missing date never blocks the quote.
 */
function resolveCreditTerm(
    kind: PricingPaymentKind,
    dueDate: string | undefined,
    now: number,
    learnedAvgDays: number | null,
    settledLots: number,
    policy: PricingPolicyConfig,
): { termDays: number; termSource: CreditTermSource } {
    if (kind !== 'credit') return { termDays: 0, termSource: 'explicit' };
    const explicit = paymentTermDays(kind, dueDate, now);
    if (explicit > 0) return { termDays: explicit, termSource: 'explicit' };
    if (learnedAvgDays !== null && settledLots > 0) {
        return { termDays: Math.max(1, Math.round(learnedAvgDays)), termSource: 'learned' };
    }
    return { termDays: Math.max(1, Math.round(policy.creditDefaultTermDays)), termSource: 'default' };
}

function bracketAdjustment(policy: PricingPolicyConfig, bracket: VolumeBracket) {
    return policy.quantityAdjustments[bracket];
}

function estimateBaselineMargins(
    transactions: Tx[],
    currency: PricingCurrency,
    market: MarketSnapshot,
    profiles: Map<string, CustomerProfile>,
    policy: PricingPolicyConfig,
    now: number,
    debtByClientId?: Map<string, ClientDebtState>,
) {
    const start90 = now - 90 * DAY;
    const sells = transactions.filter((tx) => tx.type === 'sell' && tx.currency === currency && tx.timestamp >= start90 && finite(tx.quantity) > 0);
    if (sells.length === 0) {
        const [min, max] = policy.marketBands[market.status].normal;
        return { floor: min, target: (min + max) / 2 };
    }
    let qtyTotal = 0;
    let targetTotal = 0;
    let floorTotal = 0;
    for (const tx of sells) {
        const qty = Math.max(0, finite(tx.quantity));
        const profile = tx.linkedClientId && tx.linkedClientId !== 'none'
            ? profiles.get(tx.linkedClientId) || newClientProfile(tx.linkedClientId)
            : null;
        const segment = profile?.segment || 'normal';
        const [min, max] = policy.marketBands[market.status][segment];
        const adj = bracketAdjustment(policy, getVolumeBracket(qty));
        const debt = tx.linkedClientId ? debtByClientId?.get(tx.linkedClientId) : undefined;
        const { termDays: term } = resolveCreditTerm(
            tx.clientPaymentStatus || 'cash', tx.creditDueDate, tx.timestamp,
            debt?.avgSettleDays ?? null, debt?.settledLotCount ?? 0, policy,
        );
        const financing = tx.clientPaymentStatus === 'credit'
            ? market.pam * policy.monthlyCapitalCostRate * (term / 30)
            : 0;
        floorTotal += Math.max(0, min + adj + financing) * qty;
        targetTotal += Math.max(0, (min + max) / 2 + adj + financing) * qty;
        qtyTotal += qty;
    }
    return qtyTotal > 0
        ? { floor: floorTotal / qtyTotal, target: targetTotal / qtyTotal }
        : { floor: 0, target: 0 };
}

export function buildPricingContext(input: PricingContextInput): PricingContext {
    const now = input.now ?? Date.now();
    const currency = input.currency || 'USDT';
    const policy: PricingPolicyConfig = {
        ...DEFAULT_PRICING_POLICY,
        ...(input.policy || {}),
        quantityAdjustments: {
            ...DEFAULT_PRICING_POLICY.quantityAdjustments,
            ...(input.policy?.quantityAdjustments || {}),
        },
        marketBands: input.policy?.marketBands || DEFAULT_PRICING_POLICY.marketBands,
    };
    const pam = Math.max(0, finite(input.pam));
    const market = detectMarket(input.transactions, currency, pam, now);
    const profiles = buildCustomerProfiles(
        input.transactions,
        policy.vipVolumeThreshold,
        now,
        input.derivedProfits,
        currency,
    );
    const clients = input.clients || [];
    const clientsById = new Map(clients.map((client) => [client.id, client]));
    const byClient = new Map<string, ClientTransactionDzd[]>();
    for (const tx of input.clientTransactions || []) {
        const rows = byClient.get(tx.clientId) || [];
        rows.push(tx);
        byClient.set(tx.clientId, rows);
    }
    const debtByClientId = new Map<string, ClientDebtState>();
    for (const client of clients) {
        debtByClientId.set(client.id, computeClientDebtState(byClient.get(client.id) || [], now));
    }
    // Learned repayment behavior lives on the DZD debt ledger — surface it on
    // the per-currency profiles so UI/score consumers see one object.
    for (const [clientId, debt] of debtByClientId) {
        const profile = profiles.get(clientId);
        if (profile) {
            profile.avgSettleDays = debt.avgSettleDays;
            profile.settledCreditLots = debt.settledLotCount;
        }
    }

    const history = buildHistory(input.transactions, currency, input.plan, policy, now);
    const baseline = estimateBaselineMargins(input.transactions, currency, market, profiles, policy, now, debtByClientId);
    const d = new Date(now);
    const daysInMonth = monthDays(now);
    const daysRemaining = Math.max(1, daysInMonth - d.getDate() + 1);
    const expectedRemainingVolume = history.expectedMonthlyVolume > 0
        ? Math.max(1, history.expectedMonthlyVolume * daysRemaining / daysInMonth)
        : 0;
    const monthlyGoal = Math.max(0, finite(input.plan.monthlyGoal));
    const minimumGoal = clamp(finite(input.plan.minimumGoal), 0, monthlyGoal || Number.MAX_SAFE_INTEGER);
    const mtdProfit = finite(input.mtdProfit);
    const remainingGoal = Math.max(0, monthlyGoal - mtdProfit);
    const remainingMinimum = Math.max(0, minimumGoal - mtdProfit);
    const requiredTargetMargin = expectedRemainingVolume > 0 ? remainingGoal / expectedRemainingVolume : 0;
    const requiredFloorMargin = expectedRemainingVolume > 0 ? remainingMinimum / expectedRemainingVolume : 0;
    const targetShift = expectedRemainingVolume > 0 ? Math.max(0, requiredTargetMargin - baseline.target) : 0;
    const floorShift = expectedRemainingVolume > 0 ? Math.max(0, requiredFloorMargin - baseline.floor) : 0;
    const goal: GoalPressure = {
        monthlyGoal,
        minimumGoal,
        mtdProfit,
        remainingGoal,
        remainingMinimum,
        expectedRemainingVolume,
        baselineTargetMargin: round2(baseline.target),
        baselineFloorMargin: round2(baseline.floor),
        targetShift: round2(targetShift),
        floorShift: round2(floorShift),
        volumeMissing: monthlyGoal > 0 && expectedRemainingVolume <= 0,
        feasible: targetShift <= policy.goalPressureWarningMargin,
    };

    const activeOverrides = (input.overrides || []).filter((override) => !override.expiresAt || override.expiresAt > now);
    const dailyMarketOverride = activeOverrides.find((override) => override.kind === 'market' && override.currency === currency);
    const dailyClientOverrides = new Map<string, PricingOverride>();
    for (const override of activeOverrides) {
        if (override.kind === 'client' && override.currency === currency && override.clientId) {
            dailyClientOverrides.set(override.clientId, override);
        }
    }
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

    return {
        now,
        currency,
        pam,
        available: Math.max(0, finite(input.available)),
        policy,
        plan: input.plan,
        market,
        profiles,
        clientsById,
        debtByClientId,
        history,
        goal,
        dailyMarketOverride,
        dailyClientOverrides,
        negotiationMtd: computeNegotiationStats(input.transactions, monthStart, currency),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote
// ─────────────────────────────────────────────────────────────────────────────

export type PricingReasonCode =
    | 'market_rising'
    | 'market_falling'
    | 'market_stable'
    | 'market_volatile'
    | 'market_unknown'
    | 'market_overridden'
    | 'client_overridden'
    | 'client_low_confidence'
    | 'small_qty_no_vip'
    | 'large_qty_discount'
    | 'small_qty_premium'
    | 'credit_financing_cost'
    | 'credit_term_estimated'
    | 'credit_high_utilization'
    | 'credit_over_limit'
    | 'credit_overdue'
    | 'credit_serious_overdue'
    | 'falling_prefer_cash'
    | 'volatile_no_credit'
    | 'goal_raised_target'
    | 'goal_raised_floor'
    | 'goal_above_market_range'
    | 'goal_volume_missing'
    | 'learned_opening_buffer'
    | 'insufficient_stock';

export type PricingWarning = PricingReasonCode;
export type SmartWarning = PricingReasonCode;

export type SalePayment = {
    kind: PricingPaymentKind;
    dueDate?: string;
};

export type SaleQuoteInput = {
    currency?: PricingCurrency;
    clientId: string | null;
    quantity: number;
    payment: SalePayment | PricingPaymentKind;
    available?: number;
    actualUnitPrice?: number;
    actualPriceSource?: 'opening' | 'target' | 'floor' | 'manual';
    marketOverride?: PricingOverride;
    clientOverride?: PricingOverride;
};

export type CreditRiskAssessment = {
    currentBalance: number;
    existingDebt: number;
    projectedDebt: number;
    creditLimit: number;
    utilizationPct: number | null;
    overdueAmount: number;
    oldestOverdueDays: number;
    highUtilization: boolean;
    overLimit: boolean;
    seriousOverdue: boolean;
    requiresAcknowledgement: boolean;
    reasons: PricingReasonCode[];
};

export type SaleQuoteStatus = 'ready' | 'missing_pam';

export type SaleQuote = {
    policyVersion: string;
    configRevision: number;
    planRevision: number;
    status: SaleQuoteStatus;
    currency: PricingCurrency;
    clientId: string | null;
    pam: number;
    quantity: number;
    quantityBracket: VolumeBracket;
    payment: SalePayment & { termDays: number; termSource?: CreditTermSource };
    market: { automatic: MarketStatus; effective: MarketStatus; overridden: boolean; confidence: MarketSnapshot['confidence'] };
    client: {
        automaticSegment: CustomerSegment;
        effectiveSegment: CustomerSegment;
        pricedAs: CustomerSegment;
        score: number | null;
        overridden: boolean;
    };
    corridor: { openingPrice: number; targetPrice: number; floorPrice: number };
    breakdown: {
        marketBand: Band;
        quantityAdjustment: number;
        financingPremium: number;
        targetGoalShift: number;
        floorGoalShift: number;
        negotiationBuffer: number;
    };
    goal: {
        remainingGoal: number;
        expectedProfit: number;
        coveragePct: number | null;
        feasible: boolean;
        volumeMissing: boolean;
    };
    creditRisk: CreditRiskAssessment;
    actual: {
        source: 'opening' | 'target' | 'floor' | 'manual';
        unitPrice: number;
        deviationPerUnit: number;
        negotiationLoss: number;
        belowFloor: boolean;
        belowPam: boolean;
    };
    reasonCodes: PricingReasonCode[];
    overrideIds: string[];

    // Compatibility fields used by pre-existing UI/report code.
    marketStatus: MarketStatus;
    customerScore: number | null;
    customerSegment: CustomerSegment;
    pricedAs: CustomerSegment;
    openingPrice: number;
    targetPrice: number;
    minimumAllowedPrice: number;
    targetMargin: number;
    minMargin: number;
    expectedProfit: number;
    goalCoveragePct: number | null;
    warnings: PricingReasonCode[];
};

const NORMALIZED_SEGMENT_FOR_SMALL: CustomerSegment = 'normal';

function normalizePayment(payment: SaleQuoteInput['payment']): SalePayment {
    return typeof payment === 'string' ? { kind: payment } : payment;
}

function chooseOverride(
    session: PricingOverride | undefined,
    daily: PricingOverride | undefined,
    now: number,
) {
    if (session && (!session.expiresAt || session.expiresAt > now)) return session;
    if (daily && (!daily.expiresAt || daily.expiresAt > now)) return daily;
    return undefined;
}

function buildCreditRisk(
    ctx: PricingContext,
    clientId: string | null,
    payment: SalePayment,
    projectedTotal: number,
): CreditRiskAssessment {
    const debtState = clientId ? ctx.debtByClientId.get(clientId) : undefined;
    const client = clientId ? ctx.clientsById.get(clientId) : undefined;
    const currentBalance = debtState?.balance || 0;
    const projected = payment.kind === 'credit'
        ? projectCreditExposure(currentBalance, projectedTotal)
        : { projectedBalance: currentBalance, projectedDebt: Math.max(0, -currentBalance) };
    const creditLimit = Math.max(0, finite(client?.creditLimit));
    const utilizationPct = creditLimit > 0 ? projected.projectedDebt / creditLimit * 100 : null;
    const highUtilization = payment.kind === 'credit'
        && utilizationPct !== null
        && utilizationPct >= ctx.policy.highCreditUtilizationPct;
    const overLimit = payment.kind === 'credit' && creditLimit > 0 && projected.projectedDebt > creditLimit + 0.01;
    const seriousOverdue = payment.kind === 'credit'
        && (debtState?.oldestOverdueDays || 0) >= ctx.policy.seriousOverdueDays;
    const reasons: PricingReasonCode[] = [];
    if (payment.kind === 'credit' && (debtState?.overdueAmount || 0) > 0) reasons.push('credit_overdue');
    if (highUtilization) reasons.push('credit_high_utilization');
    if (overLimit) reasons.push('credit_over_limit');
    if (seriousOverdue) reasons.push('credit_serious_overdue');
    return {
        currentBalance,
        existingDebt: debtState?.debt || 0,
        projectedDebt: round2(projected.projectedDebt),
        creditLimit,
        utilizationPct: utilizationPct === null ? null : Math.round(utilizationPct),
        overdueAmount: debtState?.overdueAmount || 0,
        oldestOverdueDays: debtState?.oldestOverdueDays || 0,
        highUtilization,
        overLimit,
        seriousOverdue,
        requiresAcknowledgement: overLimit || seriousOverdue,
        reasons,
    };
}

export function quoteSale(ctx: PricingContext, input: SaleQuoteInput): SaleQuote {
    const currency = input.currency || ctx.currency;
    const quantity = Math.max(0, finite(input.quantity));
    const bracket = getVolumeBracket(quantity);
    const payment = normalizePayment(input.payment);
    const debtState = input.clientId ? ctx.debtByClientId.get(input.clientId) : undefined;
    const { termDays, termSource } = resolveCreditTerm(
        payment.kind, payment.dueDate, ctx.now,
        debtState?.avgSettleDays ?? null, debtState?.settledLotCount ?? 0, ctx.policy,
    );
    const status: SaleQuoteStatus = ctx.pam <= 0 ? 'missing_pam' : 'ready';
    const profile = input.clientId
        ? ctx.profiles.get(input.clientId) || newClientProfile(input.clientId)
        : null;
    const automaticSegment = profile?.segment || 'normal';
    const marketOverride = chooseOverride(input.marketOverride, ctx.dailyMarketOverride, ctx.now);
    const clientOverride = chooseOverride(
        input.clientOverride,
        input.clientId ? ctx.dailyClientOverrides.get(input.clientId) : undefined,
        ctx.now,
    );
    const effectiveMarket = marketOverride?.marketStatus || ctx.market.status;
    const effectiveSegment = clientOverride?.customerSegment || automaticSegment;
    const reasons: PricingReasonCode[] = [`market_${effectiveMarket}` as PricingReasonCode];
    const overrideIds: string[] = [];
    if (marketOverride?.marketStatus) {
        reasons.push('market_overridden');
        if (marketOverride.id) overrideIds.push(marketOverride.id);
    }
    if (clientOverride?.customerSegment) {
        reasons.push('client_overridden');
        if (clientOverride.id) overrideIds.push(clientOverride.id);
    }
    if (!profile || profile.txCount90d < 3) reasons.push('client_low_confidence');

    let preliminarySegment = effectiveSegment;
    if (bracket === 'small' && (preliminarySegment === 'vip' || preliminarySegment === 'good')) {
        preliminarySegment = NORMALIZED_SEGMENT_FOR_SMALL;
        reasons.push('small_qty_no_vip');
    }
    const qtyAdj = bracketAdjustment(ctx.policy, bracket);
    if (bracket === 'small') reasons.push('small_qty_premium');
    if (bracket === 'large') reasons.push('large_qty_discount');
    const financing = payment.kind === 'credit'
        ? ctx.pam * ctx.policy.monthlyCapitalCostRate * (termDays / 30)
        : 0;
    if (financing > 0) reasons.push('credit_financing_cost');
    if (payment.kind === 'credit' && termSource !== 'explicit') reasons.push('credit_term_estimated');

    const firstBand = ctx.policy.marketBands[effectiveMarket][preliminarySegment];
    const firstTargetMargin = Math.max(0, (firstBand[0] + firstBand[1]) / 2 + qtyAdj + financing + ctx.goal.targetShift);
    const estimatedTarget = ceilToMarketPrice(ctx.pam + firstTargetMargin);
    const firstRisk = buildCreditRisk(ctx, input.clientId, payment, quantity * (input.actualUnitPrice || estimatedTarget));
    let pricedAs = preliminarySegment;
    if (payment.kind === 'credit') {
        if (firstRisk.overLimit || firstRisk.seriousOverdue) pricedAs = worseSegment(pricedAs, 'risky');
        else if (firstRisk.highUtilization || firstRisk.overdueAmount > 0) pricedAs = worseSegment(pricedAs, 'weak');
        if (effectiveMarket === 'falling') reasons.push('falling_prefer_cash');
        if (effectiveMarket === 'volatile') reasons.push('volatile_no_credit');
    }
    reasons.push(...firstRisk.reasons);

    const band = ctx.policy.marketBands[effectiveMarket][pricedAs];
    const bandMid = (band[0] + band[1]) / 2;
    const learnedBuffer = profile && profile.trackedNegotiations >= ctx.policy.minNegotiationDeals
        ? Math.min(ctx.policy.learnedNegotiationCap, Math.max(0, profile.negoLossPerUnit))
        : 0;
    const negotiationBuffer = Math.max(ctx.policy.negotiationBuffer, learnedBuffer);
    if (learnedBuffer > ctx.policy.negotiationBuffer + 0.01) reasons.push('learned_opening_buffer');
    if (ctx.goal.targetShift > 0.01) reasons.push('goal_raised_target');
    if (ctx.goal.floorShift > 0.01) reasons.push('goal_raised_floor');
    if (!ctx.goal.feasible) reasons.push('goal_above_market_range');
    if (ctx.goal.volumeMissing) reasons.push('goal_volume_missing');
    const available = input.available === undefined ? ctx.available : Math.max(0, finite(input.available));
    if (available > 0 && quantity > available + 0.001) reasons.push('insufficient_stock');

    const floorMargin = Math.max(0, band[0] + qtyAdj + financing + ctx.goal.floorShift);
    const targetMarginRaw = Math.max(floorMargin, bandMid + qtyAdj + financing + ctx.goal.targetShift);
    const openingMargin = Math.max(
        targetMarginRaw + negotiationBuffer,
        band[1] + qtyAdj + financing + ctx.goal.targetShift,
        floorMargin,
    );
    const floorPrice = ceilToMarketPrice(ctx.pam + floorMargin);
    const targetPrice = Math.max(floorPrice, ceilToMarketPrice(ctx.pam + targetMarginRaw));
    const openingPrice = Math.max(targetPrice, ceilToMarketPrice(ctx.pam + openingMargin));
    const actualSource = input.actualPriceSource || 'target';
    const actualPrice = Math.max(0, finite(input.actualUnitPrice, targetPrice));
    const finalRisk = buildCreditRisk(ctx, input.clientId, payment, quantity * (actualPrice || targetPrice));
    for (const reason of finalRisk.reasons) if (!reasons.includes(reason)) reasons.push(reason);
    const expectedProfit = round2((targetPrice - ctx.pam) * quantity);
    const coveragePct = ctx.goal.remainingGoal > 0 && expectedProfit > 0
        ? Math.min(100, Math.round(expectedProfit / ctx.goal.remainingGoal * 100))
        : ctx.goal.monthlyGoal > 0 ? 0 : null;
    const deviationPerUnit = round2(targetPrice - actualPrice);
    const negotiationLoss = round2(Math.max(0, deviationPerUnit) * quantity);
    const uniqueReasons = [...new Set(reasons)];

    return {
        policyVersion: ctx.policy.modelVersion || MODEL_VERSION,
        configRevision: ctx.policy.revision,
        planRevision: ctx.plan.revision,
        status,
        currency,
        clientId: input.clientId,
        pam: ctx.pam,
        quantity,
        quantityBracket: bracket,
        payment: { ...payment, termDays, ...(payment.kind === 'credit' ? { termSource } : {}) },
        market: {
            automatic: ctx.market.status,
            effective: effectiveMarket,
            overridden: effectiveMarket !== ctx.market.status,
            confidence: ctx.market.confidence,
        },
        client: {
            automaticSegment,
            effectiveSegment,
            pricedAs,
            score: profile?.score ?? null,
            overridden: effectiveSegment !== automaticSegment,
        },
        corridor: { openingPrice, targetPrice, floorPrice },
        breakdown: {
            marketBand: band,
            quantityAdjustment: round2(qtyAdj),
            financingPremium: round2(financing),
            targetGoalShift: ctx.goal.targetShift,
            floorGoalShift: ctx.goal.floorShift,
            negotiationBuffer: round2(negotiationBuffer),
        },
        goal: {
            remainingGoal: ctx.goal.remainingGoal,
            expectedProfit,
            coveragePct,
            feasible: ctx.goal.feasible,
            volumeMissing: ctx.goal.volumeMissing,
        },
        creditRisk: finalRisk,
        actual: {
            source: actualSource,
            unitPrice: actualPrice,
            deviationPerUnit,
            negotiationLoss,
            belowFloor: actualPrice > 0 && actualPrice < floorPrice - 0.001,
            belowPam: actualPrice > 0 && actualPrice < ctx.pam - 0.001,
        },
        reasonCodes: uniqueReasons,
        overrideIds,
        marketStatus: effectiveMarket,
        customerScore: profile?.score ?? null,
        customerSegment: effectiveSegment,
        pricedAs,
        openingPrice,
        targetPrice,
        minimumAllowedPrice: floorPrice,
        targetMargin: round2(targetPrice - ctx.pam),
        minMargin: round2(floorPrice - ctx.pam),
        expectedProfit,
        goalCoveragePct: coveragePct,
        warnings: uniqueReasons,
    };
}

// Compatibility contract kept while UI call sites migrate to quoteSale.
export type SmartQuoteInput = {
    currency: PricingCurrency;
    clientId: string | null;
    quantity: number;
    payment: SmartPaymentStatus;
    available?: number;
    dueDate?: string;
    currentPrice?: number;
};
export type SmartQuote = SaleQuote;
export type SmartPricingContext = PricingContext;

export function quoteSmartPrice(ctx: SmartPricingContext, input: SmartQuoteInput): SmartQuote | null {
    if (!ctx || ctx.pam <= 0) return null;
    return quoteSale(ctx, {
        currency: input.currency,
        clientId: input.clientId,
        quantity: input.quantity,
        payment: { kind: input.payment, dueDate: input.dueDate },
        available: input.available,
        actualUnitPrice: input.currentPrice,
    });
}

export function evaluateActualPrice(quote: SaleQuote, actualPrice: number, quantity: number) {
    const deviationPerUnit = round2(quote.targetPrice - actualPrice);
    return {
        deviationPerUnit,
        negotiationLoss: round2(Math.max(0, deviationPerUnit) * quantity),
        belowMinimum: actualPrice < quote.minimumAllowedPrice - 0.001,
        belowPam: actualPrice < quote.pam - 0.001,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Goals, negotiation summaries and snapshots
// ─────────────────────────────────────────────────────────────────────────────

export type GoalSuggestion = {
    realisticLow: number;
    realisticHigh: number;
    ambitious: number;
    hard: number;
};

const roundGoal = (n: number) => Math.max(0, Math.round(n / 1000) * 1000);

export function suggestMonthlyGoals(avgMonthlyProfit: number): GoalSuggestion | null {
    if (avgMonthlyProfit <= 0) return null;
    return {
        realisticLow: roundGoal(avgMonthlyProfit * 1.05),
        realisticHigh: roundGoal(avgMonthlyProfit * 1.45),
        ambitious: roundGoal(avgMonthlyProfit * 1.9),
        hard: roundGoal(avgMonthlyProfit * 2.5),
    };
}

export type NegotiationStats = {
    trackedDeals: number;
    totalLoss: number;
    plannedProfit: number;
    actualProfit: number;
    belowMinCount: number;
    byClient: Array<{ clientId: string; loss: number; deals: number }>;
};

export function computeNegotiationStats(
    transactions: Tx[],
    sinceTimestamp: number,
    currency?: PricingCurrency,
): NegotiationStats {
    let trackedDeals = 0;
    let totalLoss = 0;
    let plannedProfit = 0;
    let actualProfit = 0;
    let belowMinCount = 0;
    const byClient = new Map<string, { loss: number; deals: number }>();
    for (const tx of transactions) {
        if (tx.type !== 'sell' || tx.timestamp < sinceTimestamp || (currency && tx.currency !== currency)) continue;
        const target = finite(tx.spSnapshot?.corridor.targetPrice, finite(tx.spTargetPrice));
        const floor = finite(tx.spSnapshot?.corridor.floorPrice, finite(tx.spMinPrice));
        const sold = finite(tx.sell);
        const qty = finite(tx.quantity);
        if (target <= 0 || sold <= 0 || qty <= 0) continue;
        trackedDeals++;
        const actual = derivedProfitFor(tx);
        actualProfit += actual;
        const costPerUnit = ((sold * qty) - actual) / qty;
        plannedProfit += (target - costPerUnit) * qty;
        const loss = Math.max(0, target - sold) * qty;
        totalLoss += loss;
        if (floor > 0 && sold < floor - 0.001) belowMinCount++;
        if (tx.linkedClientId && tx.linkedClientId !== 'none' && loss > 0) {
            const row = byClient.get(tx.linkedClientId) || { loss: 0, deals: 0 };
            row.loss += loss;
            row.deals++;
            byClient.set(tx.linkedClientId, row);
        }
    }
    return {
        trackedDeals,
        totalLoss: round2(totalLoss),
        plannedProfit: round2(plannedProfit),
        actualProfit: round2(actualProfit),
        belowMinCount,
        byClient: [...byClient.entries()]
            .map(([clientId, value]) => ({ clientId, loss: round2(value.loss), deals: value.deals }))
            .sort((a, b) => b.loss - a.loss)
            .slice(0, 3),
    };
}

export type SmartSaleSnapshot = SmartPricingSnapshot & {
    // Flat compatibility fields consumed by the current transaction adapter.
    openingPrice: number;
    targetPrice: number;
    minimumAllowedPrice: number;
    marketStatus: MarketStatus;
    segment: CustomerSegment;
    score: number | null;
};

export function toSaleSnapshot(
    quote: SaleQuote,
    acknowledgement?: { acknowledged: boolean; acknowledgedAt?: number },
): SmartSaleSnapshot {
    // Firestore rejects `undefined` values — every optional field must be
    // OMITTED (conditional spread) rather than written as undefined.
    return {
        modelVersion: quote.policyVersion,
        quotedAt: Date.now(),
        currency: quote.currency,
        clientId: quote.clientId,
        quantity: quote.quantity,
        pam: quote.pam,
        payment: {
            kind: quote.payment.kind,
            termDays: quote.payment.termDays,
            ...(quote.payment.dueDate ? { dueDate: quote.payment.dueDate } : {}),
            ...(quote.payment.termSource ? { termSource: quote.payment.termSource } : {}),
        },
        corridor: quote.corridor,
        market: quote.market,
        client: quote.client,
        breakdown: quote.breakdown,
        goal: {
            remainingGoal: quote.goal.remainingGoal,
            expectedProfit: quote.goal.expectedProfit,
            coveragePct: quote.goal.coveragePct,
            feasible: quote.goal.feasible,
        },
        creditRisk: {
            projectedDebt: quote.creditRisk.projectedDebt,
            creditLimit: quote.creditRisk.creditLimit,
            utilizationPct: quote.creditRisk.utilizationPct,
            oldestOverdueDays: quote.creditRisk.oldestOverdueDays,
            requiresAcknowledgement: quote.creditRisk.requiresAcknowledgement,
            acknowledged: acknowledgement?.acknowledged || false,
            ...(acknowledgement?.acknowledgedAt !== undefined ? { acknowledgedAt: acknowledgement.acknowledgedAt } : {}),
            reasons: quote.creditRisk.reasons,
        },
        actual: quote.actual,
        reasonCodes: quote.reasonCodes,
        ...(quote.configRevision !== undefined ? { configRevision: quote.configRevision } : {}),
        ...(quote.planRevision !== undefined ? { planRevision: quote.planRevision } : {}),
        ...(quote.overrideIds !== undefined ? { overrideIds: quote.overrideIds } : {}),
        openingPrice: quote.openingPrice,
        targetPrice: quote.targetPrice,
        minimumAllowedPrice: quote.minimumAllowedPrice,
        marketStatus: quote.marketStatus,
        segment: quote.customerSegment,
        score: quote.customerScore,
    };
}

/**
 * Legacy builder retained for compatibility. New code must use
 * buildPricingContext so client debt, cloud policy and history confidence are
 * available to the quote.
 */
export type BuildContextInput = {
    transactions: Tx[];
    pamUsdt: number;
    pamEur: number;
    monthlyGoal: number;
    minGoal: number;
    mtdProfit: number;
    avgMonthlyVol: number;
    now?: number;
};

export function buildSmartPricingContext(input: BuildContextInput): SmartPricingContext {
    const now = input.now ?? Date.now();
    return buildPricingContext({
        transactions: input.transactions,
        pam: input.pamUsdt,
        available: 0,
        currency: 'USDT',
        mtdProfit: input.mtdProfit,
        now,
        plan: {
            schemaVersion: 1,
            monthKey: monthKeyFor(now),
            revision: 0,
            monthlyGoal: input.monthlyGoal,
            minimumGoal: input.minGoal,
            expectedMonthlyVolume: { USDT: input.avgMonthlyVol },
        },
    });
}
