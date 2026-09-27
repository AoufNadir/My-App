import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CalendarIcon } from '../icons/CalendarIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    closedMonthStarts,
    endOfPreviousMonth,
    formatLockDate,
    formatLockMonth,
    lockAfterReopening,
    type PeriodLockReason,
} from '../../utils/periodLock';

export type PeriodLockCardProps = {
    lockedThrough: number | null;
    reason: PeriodLockReason | null;
    updatedAt: number | null;
    isLoaded: boolean;
    saveLockedThrough: (lockedThrough: number | null, reason: 'manual_lock' | 'manual_reopen') => Promise<void>;
    setAlert: (message: string) => void;
    /** Current time, for tests. */
    nowMs?: number;
};

const REOPEN_ALL = 'all';

type PendingAction = { kind: 'reopen'; monthStart: number | null } | { kind: 'lock'; lockedThrough: number };

export function PeriodLockCard({ lockedThrough, reason, updatedAt, isLoaded, saveLockedThrough, setAlert, nowMs }: PeriodLockCardProps) {
    const { t } = useLanguage();
    const monthNames = (Array.isArray(t('common.months')) ? t('common.months') : []) as string[];
    const [selectedMonth, setSelectedMonth] = useState('');
    const [pending, setPending] = useState<PendingAction | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const closedMonths = useMemo(() => closedMonthStarts(lockedThrough), [lockedThrough]);
    // Last month that can be closed by hand: the current month is still running.
    const lastClosableMonthEnd = endOfPreviousMonth(nowMs ?? Date.now());
    const canLockMore = lockedThrough === null || lockedThrough < lastClosableMonthEnd;
    const reopenChoice = selectedMonth || (closedMonths.length ? String(closedMonths[0]) : '');

    const reasonLabel = reason === 'profit_distribution'
        ? t('periodLock.reasonDistribution')
        : reason === 'manual_lock'
            ? t('periodLock.reasonManualLock')
            : reason === 'manual_reopen'
                ? t('periodLock.reasonReopen')
                : '';

    const askReopen = () => {
        if (!reopenChoice)
            return;
        setPending({ kind: 'reopen', monthStart: reopenChoice === REOPEN_ALL ? null : Number(reopenChoice) });
    };

    const confirmPending = async () => {
        if (!pending)
            return;
        setIsSaving(true);
        try {
            if (pending.kind === 'reopen') {
                await saveLockedThrough(pending.monthStart === null ? null : lockAfterReopening(pending.monthStart), 'manual_reopen');
                setAlert(t('periodLock.reopened') as string);
            }
            else {
                await saveLockedThrough(pending.lockedThrough, 'manual_lock');
                setAlert(String(t('periodLock.locked')).replace('{date}', formatLockDate(pending.lockedThrough)));
            }
            setSelectedMonth('');
            setPending(null);
        }
        catch (error: any) {
            setAlert(`❌ ${error?.message || t('common.error')}`);
        }
        finally {
            setIsSaving(false);
        }
    };

    const dialogTitle = pending?.kind === 'lock'
        ? String(t('periodLock.lockConfirmTitle')).replace('{date}', formatLockDate(pending.lockedThrough))
        : pending?.monthStart == null
            ? t('periodLock.reopenAllConfirmTitle') as string
            : String(t('periodLock.reopenConfirmTitle')).replace('{month}', formatLockMonth(pending.monthStart, monthNames));

    return (<Card>
      <CardHeader className="p-4 pb-2">
        <SectionHeading icon={<CalendarIcon className="w-4 h-4"/>}>
          {t('periodLock.title')}
        </SectionHeading>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <div>
          <p className="text-sm font-bold text-neutral-800">
            {lockedThrough !== null
                ? `🔒 ${String(t('periodLock.closedThrough')).replace('{date}', formatLockDate(lockedThrough))}`
                : t('periodLock.noneClosed')}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{t('periodLock.explanation')}</p>
          <p className="mt-1 text-xs text-neutral-500">{t('periodLock.autoHint')}</p>
          {updatedAt !== null && reasonLabel && (<p className="mt-1 text-xs text-neutral-400">
              {String(t('periodLock.lastChange')).replace('{date}', formatLockDate(updatedAt)).replace('{reason}', reasonLabel)}
            </p>)}
        </div>

        {closedMonths.length > 0 && (<div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Select label={t('periodLock.reopenFrom') as string} id="period-lock-reopen-from" value={reopenChoice} onChange={(event) => setSelectedMonth(event.target.value)} disabled={!isLoaded || isSaving}>
                {closedMonths.map((monthStart) => (<option key={monthStart} value={String(monthStart)}>
                    {formatLockMonth(monthStart, monthNames)}
                  </option>))}
                <option value={REOPEN_ALL}>{t('periodLock.reopenAll')}</option>
              </Select>
            </div>
            <Button type="button" variant="outline" size="md" onClick={askReopen} disabled={!isLoaded || isSaving}>
              {t('periodLock.reopen')}
            </Button>
          </div>)}

        {canLockMore && (<Button type="button" variant="outline" size="md" className="w-full" onClick={() => setPending({ kind: 'lock', lockedThrough: lastClosableMonthEnd })} disabled={!isLoaded || isSaving}>
            🔒 {String(t('periodLock.lockThrough')).replace('{date}', formatLockDate(lastClosableMonthEnd))}
          </Button>)}
      </CardContent>

      <ConfirmDialog
        isOpen={pending !== null}
        onClose={() => { if (!isSaving) setPending(null); }}
        onConfirm={confirmPending}
        title={dialogTitle}
        description={(pending?.kind === 'lock' ? t('periodLock.lockConfirmBody') : t('periodLock.reopenConfirmBody')) as string}
        confirmLabel={pending?.kind === 'lock'
            ? String(t('periodLock.lockThrough')).replace('{date}', formatLockDate(pending.lockedThrough))
            : t('periodLock.reopen') as string}
        cancelLabel={t('common.cancel') as string}
        variant={pending?.kind === 'lock' ? 'primary' : 'warning'}
        loading={isSaving}
      />
    </Card>);
}
