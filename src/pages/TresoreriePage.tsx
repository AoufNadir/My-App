import { useMemo, useState } from 'react';
import { TreasuryCard, TreasuryTx, PortfolioStats } from '../types';
import { TreasurySummarySection } from '../components/treasury/TreasurySummarySection';
import { TreasuryCollectionsSection } from '../components/treasury/TreasuryCollectionsSection';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { LandmarkIcon } from '../components/icons/LandmarkIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { ArrowUpRightIcon } from '../components/icons/ArrowUpRightIcon';
import { BanknotesIcon } from '../components/icons/BanknotesIcon';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useLanguage } from '../contexts/LanguageContext';
import type { CapitalSnapshot } from '../utils/capitalSnapshot';

function formatCountdown(ms: number): string {
    if (ms <= 0) return '00h 00min';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min`;
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatUnlockLabel(lockedUntil: number, t: (key: string) => string): string {
    const now = new Date();
    const unlockDate = new Date(lockedUntil);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86400000;
    const dayAfterStart = tomorrowStart + 86400000;
    const time = formatTime(lockedUntil);
    if (lockedUntil < tomorrowStart) return `${t('treasury.todayAt')} ${time}`;
    if (lockedUntil < dayAfterStart) return `${t('treasury.tomorrowAt')} ${time}`;
    return `${t('treasury.onDay')} ${unlockDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${t('treasury.atTime')} ${time}`;
}

export function USDTStockCard({ transactions, portfolioStats, hasUnmigratedRecentBuys, onApplyLock24h }: {
    transactions?: any[];
    portfolioStats?: PortfolioStats;
    hasUnmigratedRecentBuys?: boolean;
    onApplyLock24h?: () => void;
}) {
    const { t } = useLanguage();
    const [expanded, setExpanded] = useState(false);
    const nowMs = Date.now();

    // Compute USDT stats directly from transactions (primary source)
    let available = 0;
    let locked = 0;
    const lockedBatches: Array<{ txId: string; quantity: number; lockedUntil: number }> = [];

    if (transactions && transactions.length > 0) {
        const usdtTxs = transactions.filter((tx: any) =>
            (tx.currency === 'USDT' || tx.currency === 'USD' || !tx.currency) &&
            ['buy', 'sell', 'Ajout Manuel', 'Retrait Manuel'].includes(tx.type)
        );
        for (const tx of usdtTxs) {
            const qty = Math.round(Math.abs(Number(tx.quantity || 0)) * 100) / 100;
            if (qty <= 0) continue;
            if (tx.type === 'buy' || tx.type === 'Ajout Manuel') {
                const isStillLocked = tx.type === 'buy' && tx.lockedUntil && tx.lockedUntil > nowMs;
                if (isStillLocked) {
                    locked = Math.round((locked + qty) * 100) / 100;
                    lockedBatches.push({ txId: tx.id, quantity: qty, lockedUntil: tx.lockedUntil });
                } else {
                    available = Math.round((available + qty) * 100) / 100;
                }
            } else {
                available = Math.round((available - qty) * 100) / 100;
            }
        }
        available = Math.max(0, available);
        locked = Math.max(0, locked);
    } else if (portfolioStats) {
        available = portfolioStats.usdt.available;
        locked = portfolioStats.usdt.locked;
        portfolioStats.usdt.lockedBatches.forEach(b => lockedBatches.push(b));
    }

    const total = available + locked;

    if (total < 0.005) return null;

    const sortedBatches = [...lockedBatches].sort((a, b) => a.lockedUntil - b.lockedUntil);
    const nextBatch = sortedBatches[0];
    const nextReleaseMs = nextBatch ? nextBatch.lockedUntil - nowMs : 0;

    return (
        <Card className="overflow-hidden">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                    <SectionHeading icon={<WalletIcon className="h-4 w-4 text-primary" />}>
                        {t('treasury.usdtStock')}
                    </SectionHeading>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
                {/* Migration banner */}
                {hasUnmigratedRecentBuys && onApplyLock24h && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning-bg px-3 py-2.5">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-warning">{t('treasury.unlockedBuysTitle')}</p>
                            <p className="text-xs text-warning">{t('treasury.unlockedBuysBody')}</p>
                        </div>
                        <button type="button" onClick={onApplyLock24h} className="shrink-0 rounded-lg bg-warning px-3 py-1.5 text-xs font-bold text-white hover:bg-warning/90 transition-colors">
                            {t('transactions.apply')}
                        </button>
                    </div>
                )}

                {/* Main KPIs */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 p-3 text-center">
                        <p className="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">{t('treasury.total')}</p>
                        <p className="text-base font-extrabold text-neutral-900 tabular-nums" dir="ltr">
                            {total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] font-medium text-neutral-400">USDT</p>
                    </div>
                    <div className="rounded-xl border border-success/15 bg-financial-profit-bg p-3 text-center">
                        <p className="mb-0.5 text-[10px] font-semibold uppercase text-financial-profit">{t('treasury.available')}</p>
                        <p className="text-base font-extrabold text-financial-profit tabular-nums" dir="ltr">
                            {available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] font-medium text-financial-profit/60">USDT</p>
                    </div>
                    <div className={`rounded-xl border p-3 text-center ${locked > 0 ? 'border-primary/15 bg-primary/5' : 'border-neutral-100 bg-neutral-50/80'}`}>
                        <p className={`mb-0.5 text-[10px] font-semibold uppercase ${locked > 0 ? 'text-primary' : 'text-neutral-400'}`}>{t('treasury.locked')}</p>
                        <p className={`text-base font-extrabold tabular-nums ${locked > 0 ? 'text-primary' : 'text-neutral-400'}`} dir="ltr">
                            {locked.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className={`text-[10px] font-medium ${locked > 0 ? 'text-primary/60' : 'text-neutral-400'}`}>USDT</p>
                    </div>
                </div>

                {/* Next release banner */}
                {locked > 0 && nextBatch && (
                    <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-primary">{t('treasury.nextUnlock')}</p>
                                    <p className="mt-0.5 text-sm font-extrabold text-neutral-900 tabular-nums" dir="ltr">
                                        {nextBatch.quantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                    </p>
                                    <p className="mt-0.5 text-xs text-neutral-500">
                                        {t('treasury.available')} {formatUnlockLabel(nextBatch.lockedUntil, t)}
                                    </p>
                                </div>
                            </div>
                            <span className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-sm font-extrabold text-primary tabular-nums shadow-sm" dir="ltr">
                                {formatCountdown(nextReleaseMs)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Locked batches list */}
                {locked > 0 && sortedBatches.length > 0 ? (
                    <div>
                        <button
                            type="button"
                            onClick={() => setExpanded(e => !e)}
                            className="flex w-full items-center gap-2 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:text-primary"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                            {t('treasury.lockedBatches')} ({sortedBatches.length})
                            <span className="ms-auto">{expanded ? '▲' : '▼'}</span>
                        </button>
                        {expanded && (
                            <div className="mt-1 space-y-1.5">
                                {sortedBatches.map((batch) => {
                                    const remainingMs = batch.lockedUntil - nowMs;
                                    const purchaseTime = formatTime(batch.lockedUntil - 24 * 60 * 60 * 1000);
                                    const unlockLabel = formatUnlockLabel(batch.lockedUntil, t);
                                    return (
                                        <div key={batch.txId} className="rounded-lg border border-primary/10 bg-surface-muted px-3 py-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-neutral-700 tabular-nums" dir="ltr">
                                                        {batch.quantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                                    </p>
                                                    <p className="text-[11px] text-neutral-500 mt-0.5">
                                                        {t('treasury.purchaseAt')} <span className="tabular-nums font-medium">{purchaseTime}</span>
                                                        <span className="mx-1">·</span>
                                                        {t('treasury.unlockAt')} <span className="tabular-nums font-medium">{unlockLabel}</span>
                                                    </p>
                                                </div>
                                                <span className="text-xs font-semibold text-primary tabular-nums shrink-0 mt-0.5" dir="ltr">
                                                    {t('treasury.inWord')} {formatCountdown(remainingMs)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : locked === 0 && total > 0 ? (
                    <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-financial-profit-bg px-3 py-2.5">
                        <span className="text-financial-profit text-sm">✓</span>
                        <div>
                            <p className="text-xs font-semibold text-financial-profit">{t('emptyStates.locked.none')}</p>
                            <p className="text-xs text-financial-profit/70">{t('treasury.allStockAvailable')}</p>
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type TresoreriePageProps = {
    caisseBalance: number;
    baridiBalance: number;
    investorBreakdown?: { capital: number; profits: number; total: number };
    capitalSnapshot: CapitalSnapshot;
    openTreasuryModal: () => void;
    treasuryCards: TreasuryCard[];
    openTreasuryCardModal: (card?: TreasuryCard) => void;
    setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
    openTreasuryBalanceEditModal: (asset: 'Caisse' | 'BaridiMob') => void;
    openDeliveryExpenseModal?: () => void;
    treasuryTransactions?: TreasuryTx[];
    [key: string]: any;
};
export function TresoreriePage({ caisseBalance, baridiBalance, investorBreakdown, capitalSnapshot, treasuryCards, openTreasuryCardModal, setTreasuryCardToDelete, openTreasuryBalanceEditModal, openDeliveryExpenseModal, treasuryTransactions = [] }: TresoreriePageProps) {
    const { t } = useLanguage();

    // Last 7 days cash flow
    const weeklyFlow = useMemo(() => {
        const now = new Date();
        const todayDow = now.getDay(); // 0=Sun..6=Sat
        const result = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
            d.setHours(0, 0, 0, 0);
            const dayStart = d.getTime();
            const dayEnd = dayStart + 86_400_000 - 1;
            const dow = d.getDay();
            return { dayStart, dayEnd, label: DAY_SHORT[dow === 0 ? 6 : dow - 1], isToday: i === 6, cashIn: 0, cashOut: 0 };
        });
        for (const tx of treasuryTransactions) {
            if (!tx.timestamp) continue;
            const slot = result.find((r) => tx.timestamp >= r.dayStart && tx.timestamp <= r.dayEnd);
            if (!slot) continue;
            const amount = Number(tx.amount || 0);
            if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)') slot.cashIn += amount;
            else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)') slot.cashOut += amount;
        }
        const maxVal = Math.max(...result.flatMap((r) => [r.cashIn, r.cashOut]), 1);
        return { days: result, maxVal, totalIn: result.reduce((s, r) => s + r.cashIn, 0), totalOut: result.reduce((s, r) => s + r.cashOut, 0) };
    }, [treasuryTransactions]);
    const secondaryItems = [
        { label: t('finance.realCapital') as string, value: capitalSnapshot.netOwnedCapital, currency: 'DZD' as const, semantic: 'plain' as const },
        // Split investor liability: capital invested vs undistributed profits
        { label: t('treasury.investorCapital') as string, value: investorBreakdown?.capital ?? capitalSnapshot.investorLiability, currency: 'DZD' as const, semantic: 'loss' as const, hideWhenZero: true },
        { label: t('treasury.profitsNotWithdrawn') as string, value: investorBreakdown?.profits ?? 0, currency: 'DZD' as const, semantic: 'loss' as const, hideWhenZero: true },
        { label: t('common.caisseBalance') as string, value: caisseBalance, currency: 'DZD' as const, semantic: 'plain' as const },
        { label: t('common.baridiBalance') as string, value: baridiBalance, currency: 'DZD' as const, semantic: 'plain' as const },
        { label: t('finance.stock') as string, value: capitalSnapshot.stockValue, currency: 'DZD' as const, semantic: 'plain' as const, hideWhenZero: true },
        { label: t('finance.treasuryCards') as string, value: capitalSnapshot.treasuryCardsTotal, currency: 'DZD' as const, semantic: 'plain' as const, hideWhenZero: true },
        { label: t('nav.services') as string, value: capitalSnapshot.servicesCapitalImpact, currency: 'DZD' as const, semantic: 'auto' as const, hideWhenZero: true },
        { label: t('finance.netPosition') as string, value: capitalSnapshot.netClientPosition, currency: 'DZD' as const, semantic: 'auto' as const, hideWhenZero: true }
    ].filter((item) => !item.hideWhenZero || Math.abs(item.value) > 0.005);
    const recentTxs = useMemo(() => {
        return [...treasuryTransactions]
            .filter((tx) => tx.type !== 'Transfer' && !tx.origin?.startsWith('investor') && !tx.origin?.startsWith('personal'))
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 12);
    }, [treasuryTransactions]);

    return (<div className="anim-page-in space-y-5">
      <HeroKpiCard accent="sky" icon={<LandmarkIcon className="w-5 h-5"/>} primaryLabel={t('treasury.totalCapital') as string} primaryValue={capitalSnapshot.totalCapital} primaryCurrency="DZD" primarySemantic="plain" secondary={secondaryItems}/>

      {weeklyFlow.days.some((d) => d.cashIn > 0 || d.cashOut > 0) && (
        <Card>
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading icon={<ArrowUpRightIcon className="w-4 h-4"/>}>Flux 7 jours</SectionHeading>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-financial-profit inline-block"/><CurrencyAmount value={weeklyFlow.totalIn} currency="DZD" size="sm" decimals={0}/></span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-financial-loss inline-block"/><CurrencyAmount value={weeklyFlow.totalOut} currency="DZD" size="sm" decimals={0}/></span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex items-end gap-1 h-14">
              {weeklyFlow.days.map((day, i) => {
                const inH = day.cashIn > 0 ? Math.max(6, (day.cashIn / weeklyFlow.maxVal) * 52) : 0;
                const outH = day.cashOut > 0 ? Math.max(6, (day.cashOut / weeklyFlow.maxVal) * 52) : 0;
                return (
                  <div key={i} className={`flex flex-1 flex-col items-center gap-0.5 ${day.isToday ? 'opacity-100' : 'opacity-70'}`}>
                    <div className="flex w-full flex-1 items-end justify-center gap-px">
                      {inH > 0 && <div className={`w-[40%] max-w-[10px] rounded-sm ${day.isToday ? 'bg-financial-profit' : 'bg-financial-profit/60'}`} style={{ height: `${inH}px` }}/>}
                      {outH > 0 && <div className={`w-[40%] max-w-[10px] rounded-sm ${day.isToday ? 'bg-financial-loss' : 'bg-financial-loss/60'}`} style={{ height: `${outH}px` }}/>}
                    </div>
                    <span className={`text-[9px] font-semibold ${day.isToday ? 'text-primary' : 'text-neutral-400'}`}>{day.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <TreasurySummarySection caisseBalance={caisseBalance} baridiBalance={baridiBalance} dettesAbs={capitalSnapshot.receivables} totalAvances={capitalSnapshot.clientAdvances} investorLiability={capitalSnapshot.investorLiability} servicesCapitalImpact={capitalSnapshot.servicesCapitalImpact} openTreasuryBalanceEditModal={openTreasuryBalanceEditModal} openDeliveryExpenseModal={openDeliveryExpenseModal} deliveryExpenseLabel={t('delivery.addExpense') as string}/>

      <TreasuryCollectionsSection treasuryCards={treasuryCards} openTreasuryCardModal={openTreasuryCardModal} setTreasuryCardToDelete={setTreasuryCardToDelete}/>

      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <SectionHeading icon={<BanknotesIcon className="w-4 h-4"/>}>Mouvements récents</SectionHeading>
            {recentTxs.length > 0 && (
              <Button
                variant="icon" size="icon"
                className="rounded-button bg-neutral-100 hover:bg-neutral-200"
                aria-label={t('treasury.exportPdf')}
                title={t('treasury.exportPdf')}
                onClick={async () => {
                  const { buildTreasuryPdf, openPdfPrintWindow } = await import('../utils/pdfReports');
                  const allNonInternal = treasuryTransactions
                    .filter((tx) => tx.type !== 'Transfer')
                    .sort((a, b) => b.timestamp - a.timestamp);
                  const rows = allNonInternal.map((tx) => ({
                    date: tx.date,
                    time: tx.time,
                    type: tx.type,
                    source: tx.source ?? '',
                    amount: Number(tx.amount || 0),
                    notes: tx.notes ?? '',
                    origin: tx.origin,
                  }));
                  const report = buildTreasuryPdf(
                    rows,
                    { caisse: caisseBalance, baridi: baridiBalance },
                    `${t('treasury.exportedOn')} ${new Date().toLocaleDateString('fr-FR')}`
                  );
                  openPdfPrintWindow(report);
                }}
              >
                <DownloadCloudIcon className="w-4 h-4"/>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentTxs.length === 0 ? (
            <EmptyState icon={<BanknotesIcon className="w-5 h-5"/>} title={t('emptyStates.mouvement.title')} subtitle={t('emptyStates.mouvement.subtitle')}/>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentTxs.map((tx) => {
                const isIn = tx.type === 'Ajout' || tx.type === 'Adjustment (+)';
                const amount = Number(tx.amount || 0);
                const label = tx.type === 'Ajout' ? t('treasury.inShort') : tx.type === 'Retrait' ? t('treasury.outShort') : tx.type;
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isIn ? 'bg-success-bg text-financial-profit' : 'bg-danger-bg text-financial-loss'}`}>
                      <span className="text-base font-bold leading-none">{isIn ? '+' : '−'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-800">{label}</p>
                      <p className="text-xs text-neutral-400">
                        {tx.source ?? '—'} · {tx.date}
                        {tx.notes ? ` · ${tx.notes}` : ''}
                      </p>
                    </div>
                    <CurrencyAmount value={isIn ? amount : -amount} currency="DZD" semantic="auto" size="md" decimals={0} showSign/>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>);
}
