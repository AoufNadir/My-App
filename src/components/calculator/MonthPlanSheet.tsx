import React, { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MoneyField } from '../ui/MoneyField';
import { SearchableSelect } from '../ui/SearchableSelect';
import { SmartPricePanel } from '../main/SmartPricePanel';
import { useLanguage } from '../../contexts/LanguageContext';
import { auth } from '../../firebaseAuth';
import { formatNumber } from '../../pages/shared/pageFormat';
import { parseAndEvaluate } from '../../utils';
import { ORDER_SYSTEM_CONFIGURED } from '../../config/orderSystem';
import { generatePortalTiersFromPricing } from '../../utils/portalTiersBridge';
import {
    quoteSale,
    type CustomerSegment,
    type MarketStatus,
    type PricingContext,
    type PricingMonthlyPlan,
    type PricingOverride,
    type PricingPolicyConfig,
} from '../../services/smartPricingEngine';
import type { PrefillSell } from '../../hooks/useTransactionHandlers';

const fmt0 = (value: number) => formatNumber(value, { min: 0, max: 0 });
const fmt2 = (value: number) => formatNumber(value, { min: 2, max: 2 });
const priceText = (value: number) => Number.isInteger(value) ? `${value}` : fmt2(value);

type ClientEntry = { id: string; name: string };
type SyncState = 'loading' | 'synced' | 'saving' | 'offline' | 'error';
type PriceSource = 'opening' | 'target' | 'floor' | 'manual';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    context: PricingContext;
    clients: ClientEntry[];
    suggestedGoal: number;
    syncState: SyncState;
    onSavePlan: (patch: Partial<PricingMonthlyPlan>) => Promise<void>;
    onSavePolicy: (patch: Partial<PricingPolicyConfig>) => Promise<void>;
    onSaveDailyMarketOverride: (currency: 'USDT', status: MarketStatus, reason: string) => Promise<void>;
    onSaveDailyClientOverride: (currency: 'USDT', clientId: string, segment: CustomerSegment, reason: string) => Promise<void>;
    onClearOverride: (kind: 'market' | 'client', currency: 'USDT', clientId?: string) => Promise<void>;
    onUseInSale: (prefill: PrefillSell) => void;
};

function tomorrowIso() {
    return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
}

const fieldClass = 'min-h-input w-full rounded-xl border border-border bg-surface px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40';

export function MonthPlanSheet({
    isOpen, onClose, context, clients, suggestedGoal, syncState,
    onSavePlan, onSavePolicy, onSaveDailyMarketOverride,
    onSaveDailyClientOverride, onClearOverride, onUseInSale,
}: Props) {
    const { t, lang } = useLanguage();
    const [clientId, setClientId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [payment, setPayment] = useState<'cash' | 'baridi' | 'credit'>('cash');
    const [creditDueDate, setCreditDueDate] = useState('');
    const [actualPrice, setActualPrice] = useState('');
    const [priceSource, setPriceSource] = useState<PriceSource>('target');
    const [copied, setCopied] = useState(false);
    const [goalDraft, setGoalDraft] = useState('');
    const [minimumDraft, setMinimumDraft] = useState('');
    const [volumeDraft, setVolumeDraft] = useState('');
    const [planError, setPlanError] = useState('');
    const [savingPlan, setSavingPlan] = useState(false);
    const [bufferDraft, setBufferDraft] = useState('');
    const [capitalCostDraft, setCapitalCostDraft] = useState('');
    const [smallAdjDraft, setSmallAdjDraft] = useState('');
    const [largeAdjDraft, setLargeAdjDraft] = useState('');
    const [savingPolicy, setSavingPolicy] = useState(false);
    const [sessionMarketStatus, setSessionMarketStatus] = useState<MarketStatus | ''>('');
    const [sessionClientSegment, setSessionClientSegment] = useState<CustomerSegment | ''>('');
    const [overrideReason, setOverrideReason] = useState('');
    const [overrideBusy, setOverrideBusy] = useState(false);
    const [portalConfirm, setPortalConfirm] = useState(false);
    const [portalBusy, setPortalBusy] = useState(false);
    const [portalMessage, setPortalMessage] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setGoalDraft(context.plan.monthlyGoal > 0 ? String(Math.round(context.plan.monthlyGoal)) : '');
        setMinimumDraft(context.plan.minimumGoal > 0 ? String(Math.round(context.plan.minimumGoal)) : '');
        setVolumeDraft(context.plan.expectedMonthlyVolume.USDT ? String(context.plan.expectedMonthlyVolume.USDT) : '');
        setBufferDraft(String(context.policy.negotiationBuffer));
        setCapitalCostDraft(String(context.policy.monthlyCapitalCostRate * 100));
        setSmallAdjDraft(String(context.policy.quantityAdjustments.small));
        setLargeAdjDraft(String(Math.abs(context.policy.quantityAdjustments.large)));
        setPlanError('');
        setPortalMessage('');
    }, [isOpen, context.plan, context.policy]);

    const options = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
    const selectedClient = clients.find((client) => client.id === clientId) || null;
    const qty = parseAndEvaluate(quantity);
    const actual = parseAndEvaluate(actualPrice);
    const marketOverride: PricingOverride | undefined = sessionMarketStatus ? {
        kind: 'market', currency: 'USDT', marketStatus: sessionMarketStatus, scope: 'sale',
    } : undefined;
    const clientOverride: PricingOverride | undefined = sessionClientSegment && clientId ? {
        kind: 'client', currency: 'USDT', clientId, customerSegment: sessionClientSegment, scope: 'sale',
    } : undefined;
    const quote = useMemo(() => {
        if (!clientId || qty <= 0 || context.pam <= 0) return null;
        return quoteSale(context, {
            currency: 'USDT', clientId, quantity: qty,
            payment: { kind: payment, dueDate: creditDueDate },
            available: context.available,
            actualUnitPrice: actual > 0 ? actual : undefined,
            actualPriceSource: priceSource,
            marketOverride,
            clientOverride,
        });
    }, [context, clientId, qty, payment, creditDueDate, actual, priceSource, sessionMarketStatus, sessionClientSegment]);

    useEffect(() => {
        if (!quote || quote.status !== 'ready' || priceSource === 'manual') return;
        const next = priceSource === 'opening'
            ? quote.corridor.openingPrice
            : priceSource === 'floor' ? quote.corridor.floorPrice : quote.corridor.targetPrice;
        const formatted = next.toFixed(2);
        setActualPrice((current) => current === formatted ? current : formatted);
    }, [quote?.corridor.openingPrice, quote?.corridor.targetPrice, quote?.corridor.floorPrice, quote?.status, priceSource]);

    const handleClientChange = (nextClientId: string) => {
        setClientId(nextClientId);
        setSessionClientSegment('');
        setPriceSource('target');
        setActualPrice('');
    };

    const applyCorridorPrice = (price: number, source: Exclude<PriceSource, 'manual'>) => {
        setPriceSource(source);
        setActualPrice(price.toFixed(2));
    };

    const handlePayment = (next: typeof payment) => {
        setPayment(next);
        if (next === 'credit' && !creditDueDate) setCreditDueDate(tomorrowIso());
        if (next !== 'credit') setCreditDueDate('');
    };

    const savePlan = async () => {
        const goal = parseAndEvaluate(goalDraft);
        const minimum = parseAndEvaluate(minimumDraft);
        const expectedVolume = parseAndEvaluate(volumeDraft);
        if (goal <= 0) { setPlanError(t('smartPricing.monthlyGoal')); return; }
        if (minimum < 0 || minimum > goal) { setPlanError(`${t('smartPricing.minimumGoal')} ≤ ${t('smartPricing.monthlyGoal')}`); return; }
        if (context.history.source === 'missing' && expectedVolume <= 0) { setPlanError(t('smartPricing.historyMissing')); return; }
        setSavingPlan(true);
        setPlanError('');
        try {
            await onSavePlan({
                monthlyGoal: goal,
                minimumGoal: minimum,
                expectedMonthlyVolume: { ...context.plan.expectedMonthlyVolume, USDT: Math.max(0, expectedVolume) },
            });
        } finally {
            setSavingPlan(false);
        }
    };

    const savePolicy = async () => {
        setSavingPolicy(true);
        try {
            await onSavePolicy({
                negotiationBuffer: Math.max(0, parseAndEvaluate(bufferDraft)),
                monthlyCapitalCostRate: Math.max(0, parseAndEvaluate(capitalCostDraft) / 100),
                quantityAdjustments: {
                    small: Math.max(0, parseAndEvaluate(smallAdjDraft)),
                    medium: 0,
                    large: -Math.abs(parseAndEvaluate(largeAdjDraft)),
                },
            });
        } finally {
            setSavingPolicy(false);
        }
    };

    const persistMarketOverride = async () => {
        if (!sessionMarketStatus || !overrideReason.trim()) return;
        setOverrideBusy(true);
        try { await onSaveDailyMarketOverride('USDT', sessionMarketStatus, overrideReason); }
        finally { setOverrideBusy(false); }
    };

    const persistClientOverride = async () => {
        if (!sessionClientSegment || !clientId || !overrideReason.trim()) return;
        setOverrideBusy(true);
        try { await onSaveDailyClientOverride('USDT', clientId, sessionClientSegment, overrideReason); }
        finally { setOverrideBusy(false); }
    };

    const shareQuote = async () => {
        if (!quote || !selectedClient) return;
        const text = [
            `${t('smartPricing.title')} — ${selectedClient.name}`,
            `${t('smartPricing.quantity')}: ${fmt0(qty)} USDT`,
            `${t('smartPricing.payment')}: ${t(`smartPricing.${payment}`)}`,
            `${t('smartPricing.opening')}: ${priceText(quote.corridor.openingPrice)} DZD`,
            `${t('smartPricing.target')}: ${priceText(quote.corridor.targetPrice)} DZD`,
            `${t('smartPricing.floor')}: ${priceText(quote.corridor.floorPrice)} DZD`,
            `${t('smartPricing.actualPrice')}: ${priceText(actual || quote.corridor.targetPrice)} DZD`,
            `${t('smartPricing.expectedProfit')}: +${fmt0((actual || quote.corridor.targetPrice) * qty - context.pam * qty)} DZD`,
        ].join('\n');
        try {
            if (navigator.share) await navigator.share({ text });
            else await navigator.clipboard.writeText(text);
        } catch {
            await navigator.clipboard?.writeText(text);
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    };

    const useInSale = () => {
        if (!quote || !clientId || qty <= 0 || actual <= 0 || quote.status !== 'ready') return;
        onClose();
        onUseInSale({
            sellQty: String(qty), sellPrice: actual.toFixed(2), clientId,
            paymentStatus: payment, creditDueDate: payment === 'credit' ? creditDueDate : undefined,
        });
    };

    const publishPortal = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        setPortalBusy(true);
        setPortalMessage('');
        try {
            const result = await generatePortalTiersFromPricing(context, uid);
            setPortalMessage(result.ok ? `✓ ${result.tiers.length}` : result.reason || 'error');
        } catch {
            setPortalMessage('error');
        } finally {
            setPortalBusy(false);
            setPortalConfirm(false);
        }
    };

    const goal = context.goal.monthlyGoal;
    const progress = goal > 0 ? Math.min(100, Math.max(0, context.goal.mtdProfit / goal * 100)) : 0;
    const syncLabel = t(`smartPricing.sync.${syncState}`);
    const syncClass = syncState === 'error' ? 'text-financial-loss' : syncState === 'offline' ? 'text-warning' : 'text-neutral-400';

    return (<>
        <BottomSheet isOpen={isOpen} onClose={onClose} title={t('smartPricing.monthPlan')} className="mx-auto max-w-lg">
            <div className="space-y-4 px-4 pb-7 pt-3">
                <section className="rounded-2xl bg-surface-muted p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                            <p className="text-sm font-extrabold text-neutral-900">{t('smartPricing.title')}</p>
                            <p className="text-[11px] text-neutral-500">{t('smartPricing.subtitle')}</p>
                        </div>
                        <span className={`text-[10px] font-semibold ${syncClass}`}>{syncLabel}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }}/></div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div><span className="block text-[9px] text-neutral-400">{t('smartPricing.goal')}</span><b dir="ltr" className="text-xs">{fmt0(goal)}</b></div>
                        <div><span className="block text-[9px] text-neutral-400">{t('smartPricing.achieved')}</span><b dir="ltr" className="text-xs text-financial-profit">{fmt0(context.goal.mtdProfit)}</b></div>
                        <div><span className="block text-[9px] text-neutral-400">{t('smartPricing.remaining')}</span><b dir="ltr" className="text-xs">{fmt0(context.goal.remainingGoal)}</b></div>
                    </div>
                </section>

                <section className="space-y-3">
                    <label className="block text-sm font-semibold text-neutral-700">
                        {t('smartPricing.client')}
                        <SearchableSelect value={clientId} onChange={handleClientChange} options={options}
                            fieldClassName={`${fieldClass} mt-1.5`} searchPlaceholder={t('smartPricing.client')}
                            emptyValue="" clearable minSearchLength={0}/>
                    </label>
                    <MoneyField label={t('smartPricing.quantity')} currency="USDT" value={quantity}
                        onChange={setQuantity} onMax={() => setQuantity(context.available.toFixed(2))}
                        hint={`${fmt2(context.available)} USDT`}/>
                    <div>
                        <p className="mb-1.5 text-sm font-semibold text-neutral-700">{t('smartPricing.payment')}</p>
                        <div className="grid grid-cols-3 gap-2">
                            {(['cash', 'baridi', 'credit'] as const).map((kind) => (
                                <button key={kind} type="button" aria-pressed={payment === kind} onClick={() => handlePayment(kind)}
                                    className={`min-h-touch rounded-xl border px-2 text-xs font-bold ${payment === kind ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-neutral-600'}`}>
                                    {t(`smartPricing.${kind}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                    {payment === 'credit' && (
                        <label className="block text-sm font-semibold text-neutral-700">
                            {t('smartPricing.dueDate')}
                            <input type="date" value={creditDueDate} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                                onChange={(event) => setCreditDueDate(event.target.value)} className={`${fieldClass} mt-1.5`}/>
                        </label>
                    )}
                </section>

                <SmartPricePanel smartPricing={context} currency="USDT" clientId={clientId || 'none'} quantity={qty}
                    payment={payment} creditDueDate={creditDueDate} available={context.available} currentPrice={actual}
                    isEditing={false} onApplyPrice={applyCorridorPrice} marketOverride={marketOverride} clientOverride={clientOverride}/>

                {quote?.status === 'ready' && (
                    <section className="space-y-3">
                        <MoneyField label={t('smartPricing.actualPrice')} currency="DZD" value={actualPrice}
                            onChange={(value) => { setActualPrice(value); setPriceSource('manual'); }}/>
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" onClick={shareQuote}>{copied ? t('smartPricing.copied') : t('smartPricing.shareQuote')}</Button>
                            <Button type="button" onClick={useInSale} disabled={actual <= 0}>{t('smartPricing.useInSale')}</Button>
                        </div>
                    </section>
                )}

                <details className="rounded-2xl border border-border bg-surface px-3.5 py-2.5">
                    <summary className="min-h-touch cursor-pointer py-2 text-sm font-bold text-neutral-800">{t('smartPricing.planAndSettings')}</summary>
                    <div className="space-y-3 pb-2 pt-2">
                        {suggestedGoal > 0 && <button type="button" onClick={() => { setGoalDraft(String(Math.round(suggestedGoal))); setMinimumDraft(String(Math.round(suggestedGoal * 0.65))); }}
                            className="w-full rounded-xl border border-dashed border-primary/40 px-3 py-2 text-start text-xs font-semibold text-primary">💡 {fmt0(suggestedGoal)} DZD</button>}
                        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                            <MoneyField label={t('smartPricing.monthlyGoal')} value={goalDraft} onChange={setGoalDraft} currency="DZD"/>
                            <MoneyField label={t('smartPricing.minimumGoal')} value={minimumDraft} onChange={setMinimumDraft} currency="DZD"/>
                        </div>
                        {(context.history.source === 'missing' || context.plan.expectedMonthlyVolume.USDT) && (
                            <MoneyField label={t('smartPricing.expectedVolume')} value={volumeDraft} onChange={setVolumeDraft} currency="USDT"
                                hint={context.history.source === 'missing' ? t('smartPricing.historyMissing') : undefined}/>
                        )}
                        {planError && <p role="alert" className="text-xs font-semibold text-financial-loss">{planError}</p>}
                        <Button type="button" className="w-full" loading={savingPlan} onClick={savePlan}>{t('smartPricing.savePlan')}</Button>

                        <details className="rounded-xl bg-surface-muted px-3 py-2">
                            <summary className="min-h-touch cursor-pointer py-2 text-xs font-bold text-neutral-700">{t('smartPricing.advanced')}</summary>
                            <div className="space-y-3 pb-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <MoneyField label="Buffer (DZD/U)" value={bufferDraft} onChange={setBufferDraft}/>
                                    <MoneyField label="Coût capital (%/mois)" value={capitalCostDraft} onChange={setCapitalCostDraft}/>
                                    <MoneyField label="<100 (DZD/U)" value={smallAdjDraft} onChange={setSmallAdjDraft}/>
                                    <MoneyField label=">500 (DZD/U)" value={largeAdjDraft} onChange={setLargeAdjDraft}/>
                                </div>
                                <Button type="button" variant="outline" className="w-full" loading={savingPolicy} onClick={savePolicy}>{t('common.save')}</Button>
                            </div>
                        </details>
                    </div>
                </details>

                <details className="rounded-2xl border border-border bg-surface px-3.5 py-2.5">
                    <summary className="min-h-touch cursor-pointer py-2 text-sm font-bold text-neutral-800">{t('smartPricing.marketOverride')} / {t('smartPricing.clientOverride')}</summary>
                    <div className="space-y-3 pb-2 pt-2">
                        <label className="block text-xs font-semibold text-neutral-600">{t('smartPricing.marketOverride')}
                            <select value={sessionMarketStatus} onChange={(event) => setSessionMarketStatus(event.target.value as MarketStatus | '')} className={`${fieldClass} mt-1`}>
                                <option value="">{t('smartPricing.auto')}</option>
                                {(['rising', 'falling', 'stable', 'volatile'] as MarketStatus[]).map((status) => <option key={status} value={status}>{t(`smartPricing.market.${status}`)}</option>)}
                            </select>
                        </label>
                        <label className="block text-xs font-semibold text-neutral-600">{t('smartPricing.clientOverride')}
                            <select value={sessionClientSegment} disabled={!clientId} onChange={(event) => setSessionClientSegment(event.target.value as CustomerSegment | '')} className={`${fieldClass} mt-1`}>
                                <option value="">{t('smartPricing.auto')}</option>
                                {(['vip', 'good', 'normal', 'weak', 'risky', 'new'] as CustomerSegment[]).map((segment) => <option key={segment} value={segment}>{t(`smartPricing.segment.${segment}`)}</option>)}
                            </select>
                        </label>
                        <input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder={t('smartPricing.overrideReason')} className={fieldClass}/>
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" disabled={!sessionMarketStatus || !overrideReason.trim()} loading={overrideBusy} onClick={persistMarketOverride}>{t('smartPricing.today')} · {t('smartPricing.marketOverride')}</Button>
                            <Button type="button" variant="outline" disabled={!sessionClientSegment || !clientId || !overrideReason.trim()} loading={overrideBusy} onClick={persistClientOverride}>{t('smartPricing.today')} · {t('smartPricing.clientOverride')}</Button>
                        </div>
                        <Button type="button" variant="ghost" className="w-full" onClick={async () => {
                            setSessionMarketStatus(''); setSessionClientSegment('');
                            await Promise.all([onClearOverride('market', 'USDT'), ...(clientId ? [onClearOverride('client', 'USDT', clientId)] : [])]);
                        }}>{t('smartPricing.reset')}</Button>
                    </div>
                </details>

                {ORDER_SYSTEM_CONFIGURED && (
                    <details className="rounded-2xl border border-border bg-surface px-3.5 py-2.5">
                        <summary className="min-h-touch cursor-pointer py-2 text-sm font-bold text-neutral-800">Portail clients</summary>
                        <div className="space-y-2 pb-2">
                            <p className="text-xs text-neutral-500">Prix publics anonymes basés sur la cible cash. Aucun score ou override client n’est publié.</p>
                            <Button type="button" variant="secondary" className="w-full" loading={portalBusy} onClick={() => setPortalConfirm(true)}>Publier les paliers USDT</Button>
                            {portalMessage && <p className="text-xs font-semibold text-neutral-600">{portalMessage}</p>}
                        </div>
                    </details>
                )}
            </div>
        </BottomSheet>
        <ConfirmDialog isOpen={portalConfirm} onClose={() => setPortalConfirm(false)} onConfirm={publishPortal}
            title="Publier les prix publics ?" description="Les anciens paliers actifs seront désactivés et remplacés. Les commandes existantes conservent leur prix."
            confirmLabel={t('common.confirm')} cancelLabel={t('common.cancel')} variant="warning" loading={portalBusy}/>
    </>);
}

