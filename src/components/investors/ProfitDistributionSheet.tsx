import { useMemo, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { MoneyField } from '../ui/MoneyField';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { AlertCard } from '../cards';
import { CheckIcon } from '../icons/CheckIcon';
import { db, FirestoreDocumentReference } from '../../firebase';
import { now, parseAndEvaluate } from '../../utils';
import { buildProfitDistributionPlan, wholeDzdDown } from '../../utils/profitDistribution';
import { formatLockDate, lockAfterDistribution, periodLockFields, periodLockHistoryEntry } from '../../utils/periodLock';
import { recordTreasuryShadow } from '../../accounting/treasuryShadowDiagnostics';
import type { Investor } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { mustPrepareWriterReadModelDelta } from '../../readModels/preparedWriterDeltas';
import { commitLegacyWithReadModelDeltas } from '../../readModels/productionSummaryWriter';

type ActiveInvestor = Investor & { isManager?: boolean };

type Props = {
    isOpen: boolean;
    onClose: () => void;
    investors: ActiveInvestor[];
    suggestedTotal: number;
    userDocRef: FirestoreDocumentReference;
    setAlert: (msg: string) => void;
    treasuryStats: { caisse: number; baridi: number };
    /** Closed months (utils/periodLock): a distribution closes every month before its own. */
    periodLockedThrough?: number | null;
};

export function ProfitDistributionSheet({ isOpen, onClose, investors, suggestedTotal, userDocRef, setAlert, treasuryStats, periodLockedThrough = null }: Props) {
    const { t } = useLanguage();
    const [totalInput, setTotalInput] = useState('');
    const [paymentSource, setPaymentSource] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [isSaving, setIsSaving] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    // Payouts are whole DZD, so the suggestion is rounded down: never above what is owed.
    const payableSuggestedTotal = wholeDzdDown(suggestedTotal);
    const parsedTotalInput = parseAndEvaluate(totalInput);
    const totalAmount = totalInput.trim()
        ? (Number.isFinite(parsedTotalInput) ? parsedTotalInput : 0)
        : suggestedTotal;

    const distribution = useMemo(() =>
        buildProfitDistributionPlan(investors, totalAmount),
        [investors, totalAmount]
    );

    const totalDistributed = distribution.reduce((s, d) => s + d.amount, 0);
    const hasExceedingRow = distribution.some(d => d.exceedsAvailable);
    const sourceBalance = paymentSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
    const exceedsCash = totalDistributed > sourceBalance + 0.005;
    const canConfirm = distribution.length > 0 && totalDistributed > 0 && !hasExceedingRow && !exceedsCash;
    // The months this distribution will close, shown before confirming.
    const lockAfterConfirm = confirmed ? lockAfterDistribution(periodLockedThrough, Date.now()) : null;

    const handleConfirm = async () => {
        if (!canConfirm) return;
        setIsSaving(true);
        try {
            const { timestamp, date, time } = now();
            const batch = db.batch();
            for (const { inv, amount } of distribution) {
                if (amount <= 0) continue;
                const investorTxRef = userDocRef.collection('investor_transactions').doc();
                const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
                batch.set(investorTxRef, {
                    investorId: inv.id,
                    type: 'withdraw_profit',
                    origin: 'profit_distribution',
                    amount,
                    paymentSource,
                    linkedTreasuryTxId: treasuryTxRef.id,
                    date,
                    time,
                    timestamp,
                    notes: `Distribution groupée — ${date}`,
                });
                batch.set(treasuryTxRef, {
                    timestamp,
                    date,
                    time,
                    type: 'Retrait',
                    source: paymentSource,
                    amount,
                    notes: `Retrait profit investisseur: ${inv.name} (distribution groupée)`,
                    linkedInvestorTxId: investorTxRef.id,
                    origin: 'investor_profit_withdrawal'
                });
                recordTreasuryShadow({
                    operationId: `shadow:investor-distribution:${investorTxRef.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'investor_profit_withdrawal_cash',
                    wallet: paymentSource,
                    amountDzd: amount,
                    investorId: inv.id,
                }, [{ type: 'Retrait', source: paymentSource, amount }]);
            }
            // The months before this one are closed in the same write: their profits are now paid.
            const lockedThrough = lockAfterDistribution(periodLockedThrough, timestamp);
            if (lockedThrough !== null) {
                batch.set(userDocRef, periodLockFields(lockedThrough, 'profit_distribution', timestamp), { merge: true });
                batch.set(userDocRef.collection('period_lock_history').doc(), periodLockHistoryEntry(periodLockedThrough, lockedThrough, 'profit_distribution', timestamp));
            }
            const readModelDelta = mustPrepareWriterReadModelDelta('investors.profit-payout', {
                operationId: `legacy:investors.profit-payout:distribution:${timestamp}`,
                effectiveAt: timestamp,
                payload: {
                    type: 'investor_group_profit_distribution',
                    paymentSource,
                    totalDistributed,
                    rows: distribution.map(({ inv, amount }) => ({ investorId: inv.id, amount })),
                },
                affectedSummaries: ['dashboard_summary', 'investors_summary', 'treasury_summary', 'financial_summary'],
                wallets: { [paymentSource]: -totalDistributed },
                investors: {
                    externalInvestorProfitsDelta: -totalDistributed,
                    investorLiabilityDelta: -totalDistributed,
                },
                recentOperation: {
                    operationId: `legacy:investors.profit-payout:distribution:${timestamp}`,
                    source: 'legacy',
                    type: 'Distribution profits',
                    effectiveAt: timestamp,
                },
            });
            await commitLegacyWithReadModelDeltas({ userDocRef, batch, deltas: [readModelDelta] });
            setAlert(`✅ Distribution enregistrée — ${distribution.length} investisseur${distribution.length > 1 ? 's' : ''} · ${totalDistributed.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD depuis ${paymentSource}`);
            setConfirmed(false);
            setTotalInput('');
            onClose();
        } catch (e: any) {
            setAlert(`❌ Erreur: ${e.message || 'inconnue'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const resetAndClose = () => {
        setConfirmed(false);
        setTotalInput('');
        onClose();
    };

    const sourceLabel = (src: 'Caisse' | 'BaridiMob') => t(src === 'Caisse' ? 'transactions.cash' : 'transactions.baridi') as string;
    const confirmWarning = String(t(distribution.length > 1 ? 'profitDistribution.confirmWarningMany' : 'profitDistribution.confirmWarningOne'))
        .replace(/\{count\}/g, String(distribution.length))
        .replace('{source}', sourceLabel(paymentSource));

    return (
        <BottomSheet isOpen={isOpen} onClose={resetAndClose} title={t('profitDistribution.planTitle') as string}>
            <div className="flex flex-col gap-4 px-4 pb-6">

                <div>
                    <MoneyField
                        label={t('profitDistribution.totalToDistribute') as string}
                        value={totalInput}
                        onChange={setTotalInput}
                        currency="DZD"
                        placeholder={String(payableSuggestedTotal)}
                        hint={suggestedTotal > 0
                            ? `${t('profitDistribution.availableToWithdraw')} : ${suggestedTotal.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DZD`
                            : t('profitDistribution.enterAmount')}
                    />
                    {!totalInput && suggestedTotal > 0 && (
                        <button
                            type="button"
                            onClick={() => setTotalInput(String(payableSuggestedTotal))}
                            className="mt-1 inline-flex min-h-9 items-center rounded-button text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-light"
                        >
                            {t('profitDistribution.useAvailableProfit')}
                        </button>
                    )}
                </div>

                <div role="radiogroup" aria-label={t('profitDistribution.paymentSource') as string}>
                    <p className="mb-1.5 text-sm font-semibold text-neutral-700">{t('profitDistribution.paymentSource')}</p>
                    <div className="grid grid-cols-2 gap-2">
                        {(['Caisse', 'BaridiMob'] as const).map(src => (
                            <button
                                key={src}
                                type="button"
                                role="radio"
                                aria-checked={paymentSource === src}
                                onClick={() => setPaymentSource(src)}
                                className={`min-h-touch rounded-card border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${paymentSource === src ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-surface-muted'}`}
                            >
                                <span className={`block text-sm font-bold ${paymentSource === src ? 'text-primary dark:text-primary-light' : 'text-neutral-800'}`}>{sourceLabel(src)}</span>
                                <span dir="ltr" className="mt-0.5 block text-xs text-neutral-500 rtl:text-right">
                                    {(src === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {totalAmount > 0 && distribution.length > 0 && (
                    <div className="overflow-hidden rounded-card border border-border">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-surface-muted px-4 py-2 text-xs font-bold text-neutral-500">
                            <span>{t('profitDistribution.investor')}</span>
                            <span className="text-end">{t('profitDistribution.share')}</span>
                            <span className="w-28 text-end">{t('profitDistribution.amount')}</span>
                        </div>
                        <div>
                            {distribution.map(({ inv, normalizedShare, amount, availableProfit, exceedsAvailable }) => (
                                <div key={inv.id} className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 ${exceedsAvailable ? 'bg-financial-loss-bg' : ''}`}>
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <p className="truncate text-sm font-semibold text-neutral-900">{inv.name}</p>
                                            {inv.isManager && <span className="shrink-0 rounded-full bg-financial-debt-bg px-1.5 py-0.5 text-[11px] font-bold leading-none text-financial-debt">{t('investors.manager')}</span>}
                                        </div>
                                        <p className={`mt-0.5 text-xs ${exceedsAvailable ? 'font-semibold text-financial-loss' : 'text-neutral-500'}`}>
                                            {t('profitDistribution.available')} : <span dir="ltr">{availableProfit.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DZD</span>
                                            {exceedsAvailable && ` · ${t('profitDistribution.exceeded')}`}
                                        </p>
                                    </div>
                                    <span dir="ltr" className="text-xs font-bold tabular-nums text-neutral-600">
                                        {(normalizedShare * 100).toFixed(1)}%
                                    </span>
                                    <div className="w-28 text-end">
                                        <CurrencyAmount value={amount} currency="DZD" semantic={exceedsAvailable ? 'loss' : 'profit'} size="md" decimals={0} className="font-semibold"/>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-muted px-4 py-3">
                            <span className="text-sm font-bold text-neutral-800">{t('profitDistribution.totalDistributed')}</span>
                            <CurrencyAmount value={totalDistributed} currency="DZD" semantic="profit" size="lg" decimals={0}/>
                        </div>
                    </div>
                )}

                {distribution.length === 0 && totalAmount > 0 && (
                    <p className="text-center text-sm text-neutral-500">
                        {t('profitDistribution.noActiveInvestors')}
                    </p>
                )}

                {(hasExceedingRow || exceedsCash) && distribution.length > 0 && (
                    <AlertCard tone="danger" title={hasExceedingRow ? t('profitDistribution.exceedsAvailable') : String(t('profitDistribution.insufficientBalance')).replace('{source}', sourceLabel(paymentSource)).replace('{amount}', sourceBalance.toLocaleString('fr-FR', { maximumFractionDigits: 0 }))} detail={hasExceedingRow && exceedsCash
                        ? String(t('profitDistribution.insufficientBalance')).replace('{source}', sourceLabel(paymentSource)).replace('{amount}', sourceBalance.toLocaleString('fr-FR', { maximumFractionDigits: 0 }))
                        : undefined}/>
                )}

                {distribution.length > 0 && totalDistributed > 0 && (
                    !confirmed ? (
                        <Button
                            type="button"
                            onClick={() => setConfirmed(true)}
                            disabled={!canConfirm}
                            className="w-full gap-2 font-bold"
                        >
                            {t('profitDistribution.confirmDistribution')}
                        </Button>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <AlertCard tone="warning" title={confirmWarning} detail={lockAfterConfirm !== null
                                ? String(t('periodLock.distributionWillLock')).replace('{date}', formatLockDate(lockAfterConfirm))
                                : undefined}/>
                            <div className="grid grid-cols-2 gap-2">
                                <Button type="button" variant="outline" onClick={() => setConfirmed(false)} className="w-full">
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isSaving || !canConfirm}
                                    className="w-full gap-1.5 bg-financial-profit font-bold text-white hover:bg-financial-profit/90"
                                >
                                    {isSaving ? t('common.saving') : (<><CheckIcon aria-hidden="true" className="h-4 w-4"/>{t('common.confirm')}</>)}
                                </Button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </BottomSheet>
    );
}
