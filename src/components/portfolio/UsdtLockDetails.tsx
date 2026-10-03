import type { PortfolioStats } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { CheckIcon } from '../icons/CheckIcon';
import { InfoIcon } from '../icons/InfoIcon';

export function formatCountdown(ms: number): string {
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

export function formatUnlockLabel(lockedUntil: number, t: (key: string) => string): string {
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

const formatUsdt = (value: number) => value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Available and locked USDT from the same PAM ledger as the rest of the app, so these figures
 * can never disagree with the portfolio. The ledger is memoized, so a batch whose 24h lock ran
 * out since it was computed is released here rather than waiting for the next transaction.
 */
export function usdtLockState(portfolioStats: PortfolioStats | undefined, nowMs: number) {
    const ledgerBatches = portfolioStats?.usdt.lockedBatches || [];
    const lockedBatches = ledgerBatches.filter((batch) => batch.lockedUntil > nowMs);
    const releasedQty = ledgerBatches
        .filter((batch) => batch.lockedUntil <= nowMs)
        .reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
    const available = Math.max(0, Math.round((Number(portfolioStats?.usdt.available || 0) + releasedQty) * 100) / 100);
    const locked = Math.max(0, Math.round((Number(portfolioStats?.usdt.locked || 0) - releasedQty) * 100) / 100);
    const sortedBatches = [...lockedBatches].sort((a, b) => a.lockedUntil - b.lockedUntil);
    return { available, locked, total: available + locked, sortedBatches, nextBatch: sortedBatches[0] };
}

/** Under the USDT figures: the next batch to unlock and every locked batch, or that all the stock is free. */
export function UsdtLockDetails({ portfolioStats, hasUnmigratedRecentBuys, onApplyLock24h }: {
    portfolioStats?: PortfolioStats;
    hasUnmigratedRecentBuys?: boolean;
    onApplyLock24h?: () => void;
}) {
    const { t } = useLanguage();
    const nowMs = Date.now();
    const { locked, total, sortedBatches, nextBatch } = usdtLockState(portfolioStats, nowMs);
    if (total < 0.005) return null;
    const nextReleaseMs = nextBatch ? nextBatch.lockedUntil - nowMs : 0;

    return (<div className="flex flex-col gap-2">
      {hasUnmigratedRecentBuys && onApplyLock24h && (<div className="flex items-center justify-between gap-2 rounded-card border border-warning/30 bg-financial-debt-bg px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-bold text-neutral-900">{t('treasury.unlockedBuysTitle')}</p>
            <p className="text-xs text-neutral-700">{t('treasury.unlockedBuysBody')}</p>
          </div>
          <button type="button" onClick={onApplyLock24h} className="min-h-9 shrink-0 rounded-button bg-warning px-3 text-xs font-bold text-white transition-colors hover:bg-warning/90">
            {t('transactions.apply')}
          </button>
        </div>)}

      {locked > 0 && nextBatch ? (<>
          <div className="flex items-start gap-3 rounded-card border border-info/25 bg-financial-asset-bg p-3">
            <InfoIcon aria-hidden="true" className="mt-px h-5 w-5 shrink-0 text-financial-asset"/>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-neutral-900">{t('treasury.nextUnlock')}</p>
              <p className="mt-0.5 text-sm font-extrabold tabular-nums text-neutral-900" dir="ltr">{formatUsdt(nextBatch.quantity)} USDT</p>
              <p className="mt-0.5 text-xs text-neutral-700">{t('treasury.available')} {formatUnlockLabel(nextBatch.lockedUntil, t)}</p>
            </div>
            <span className="shrink-0 rounded-button bg-surface px-2.5 py-1 text-sm font-extrabold tabular-nums text-primary dark:text-primary-light" dir="ltr">
              {formatCountdown(nextReleaseMs)}
            </span>
          </div>
          <div>
            <p className="px-1 pb-1 text-xs font-semibold text-neutral-500">
              {t('treasury.lockedBatches')} (<bdi>{sortedBatches.length}</bdi>)
            </p>
            <ul className="divide-y divide-border rounded-card border border-border">
              {sortedBatches.map((batch) => (<li key={batch.txId} className="flex items-start justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tabular-nums text-neutral-800" dir="ltr">{formatUsdt(batch.quantity)} USDT</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {t('treasury.purchaseAt')} <span className="font-medium tabular-nums">{formatTime(batch.lockedUntil - 24 * 60 * 60 * 1000)}</span>
                      <span className="mx-1">·</span>
                      {t('treasury.unlockAt')} <span className="font-medium tabular-nums">{formatUnlockLabel(batch.lockedUntil, t)}</span>
                    </p>
                  </div>
                  <span className="mt-0.5 shrink-0 text-xs font-semibold tabular-nums text-primary dark:text-primary-light" dir="ltr">
                    {t('treasury.inWord')} {formatCountdown(batch.lockedUntil - nowMs)}
                  </span>
                </li>))}
            </ul>
          </div>
        </>) : locked === 0 && total > 0 ? (<div className="flex items-start gap-3 rounded-card border border-success/25 bg-financial-profit-bg p-3">
          <CheckIcon aria-hidden="true" className="mt-px h-5 w-5 shrink-0 text-financial-profit"/>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-neutral-900">{t('emptyStates.locked.none')}</p>
            <p className="text-xs text-neutral-700">{t('treasury.allStockAvailable')}</p>
          </div>
        </div>) : null}
    </div>);
}
