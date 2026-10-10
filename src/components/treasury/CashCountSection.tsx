import { Fragment, useEffect, useMemo, useState } from 'react';
import type { FirestoreDocumentReference } from '../../firebase';
import { useLanguage } from '../../contexts/LanguageContext';
import { parseAndEvaluate } from '../../utils';
import { formatMoney } from '../../pages/shared/pageFormat';
import { CASH_COUNT_ACCOUNTS, CASH_COUNT_UNIT, cashCountAgrees, cashCountRecord, compareCashCount, lastAgreeingCount, type CashCount, type CashCountAccount, type CashCountLine, type CashCountValues } from '../../utils/cashCount';
import { SectionCard } from '../cards/SectionCard';
import { Button } from '../ui/Button';
import { MoneyField } from '../ui/MoneyField';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { OperationFooter } from '../ui/OperationFooter';
import { Textarea } from '../ui/Textarea';
import { Label } from '../ui/Label';

const ACCOUNT_KEY: Record<CashCountAccount, string> = {
    caisse: 'cashCount.caisse',
    baridi: 'cashCount.baridi',
    usdt: 'cashCount.usdt',
    eur: 'cashCount.eur',
};
const pad = (value: number) => String(value).padStart(2, '0');
const dateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** « +2 000 DZD de plus » / « −500 USDT manquants » / « juste ». */
function DifferenceText({ line }: { line: CashCountLine }) {
    const { t } = useLanguage();
    if (line.difference === null)
        return <span className="text-neutral-400">—</span>;
    if (line.agrees)
        return <span className="font-semibold text-financial-profit">{t('cashCount.agrees')}</span>;
    const more = line.difference > 0;
    return (<span className={`font-semibold ${more ? 'text-warning' : 'text-financial-debt'}`}>
        <bdi dir="ltr">{`${more ? '+' : '−'}${formatMoney(Math.abs(line.difference), CASH_COUNT_UNIT[line.account])}`}</bdi> {t(more ? 'cashCount.more' : 'cashCount.missing')}
      </span>);
}

export type CashCountDialogProps = {
    expected: CashCountValues;
    onClose: () => void;
    onSave: (record: ReturnType<typeof cashCountRecord>) => Promise<void>;
};

/** Type what is really there; each account is optional, the differences show as you type. */
export function CashCountDialog({ expected, onClose, onSave }: CashCountDialogProps) {
    const { t } = useLanguage();
    const [values, setValues] = useState<Record<CashCountAccount, string>>({ caisse: '', baridi: '', usdt: '', eur: '' });
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const counted = useMemo(() => {
        const result: Partial<Record<CashCountAccount, number | null>> = {};
        for (const account of CASH_COUNT_ACCOUNTS) {
            const raw = values[account].trim();
            const value = raw ? parseAndEvaluate(raw) : NaN;
            result[account] = raw && Number.isFinite(value) && value >= 0 ? value : null;
        }
        return result;
    }, [values]);
    const lines = compareCashCount(expected, counted);
    const anyCounted = lines.some((line) => line.counted !== null);
    const allAgree = cashCountAgrees(lines);
    const save = async () => {
        if (!anyCounted || saving)
            return;
        setSaving(true);
        setFailed(false);
        try {
            await onSave(cashCountRecord(Date.now(), expected, counted, note));
            onClose();
        }
        catch (error) {
            console.error(error);
            setFailed(true);
        }
        finally {
            setSaving(false);
        }
    };
    return (<Modal isOpen onClose={onClose} className="max-w-md bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{t('cashCount.title')}</ModalTitle>
        <p className="text-[13px] text-neutral-500">{t('cashCount.intro')}</p>
      </ModalHeader>
      <ModalContent className="flex flex-col gap-3 px-4 py-4 sm:px-5">
        {lines.map((line) => (<Fragment key={line.account}>
            <MoneyField label={t(ACCOUNT_KEY[line.account]) as string} value={values[line.account]} onChange={(value) => setValues((current) => ({ ...current, [line.account]: value }))} currency={CASH_COUNT_UNIT[line.account]} placeholder={t('cashCount.notCounted') as string}
              hint={<span className="flex flex-wrap justify-between gap-x-3"><span>{t('cashCount.expected')}: <bdi dir="ltr">{formatMoney(line.expected, CASH_COUNT_UNIT[line.account])}</bdi></span><DifferenceText line={line}/></span>}/>
          </Fragment>))}
        <div>
          <Label htmlFor="cash-count-note">{t('cashCount.note')}</Label>
          <Textarea id="cash-count-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 resize-none text-sm" placeholder={t('cashCount.notePlaceholder') as string}/>
        </div>
        <p className="rounded-card bg-surface-muted px-3 py-2 text-xs text-neutral-600">{t('cashCount.readOnly')}</p>
      </ModalContent>
      <OperationFooter reason={failed ? t('cashCount.saveFailed') : !anyCounted ? t('cashCount.typeOne') : allAgree ? t('cashCount.allAgree') : t('cashCount.someDiffer')} reasonTone={failed || (anyCounted && !allAgree) ? 'fix' : 'missing'}>
        <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={save} loading={saving} disabled={!anyCounted}>{t('cashCount.save')}</Button>
      </OperationFooter>
    </Modal>);
}

export type CashCountSectionProps = {
    userDocRef: FirestoreDocumentReference | null | undefined;
    expected: CashCountValues;
};

/**
 * On the Trésorerie page: the last count and its differences, the date of the last count that
 * agreed (a mistake found later happened after it), the latest counts, and « Faire le comptage ».
 */
export function CashCountSection({ userDocRef, expected }: CashCountSectionProps) {
    const { t } = useLanguage();
    const [counts, setCounts] = useState<CashCount[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    useEffect(() => {
        if (!userDocRef)
            return;
        return userDocRef.collection('cash_counts').orderBy('timestamp', 'desc').limit(30).onSnapshot((snapshot) => {
            setCounts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CashCount)));
        });
    }, [userDocRef]);
    const last = counts[0] ?? null;
    const lastLines = last ? compareCashCount(last.expected, last.counted) : [];
    const lastGood = lastAgreeingCount(counts);
    const save = async (record: ReturnType<typeof cashCountRecord>) => {
        if (!userDocRef)
            throw new Error('No user');
        await userDocRef.collection('cash_counts').add(record);
    };
    return (<SectionCard title={t('cashCount.sectionTitle')} actions={<Button size="sm" onClick={() => setIsOpen(true)} disabled={!userDocRef}>{t('cashCount.start')}</Button>}>
      {!last ? (<p className="text-sm text-neutral-600">{t('cashCount.never')}</p>) : (<div className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500">{t('cashCount.lastOn')} <bdi dir="ltr">{dateTime(last.timestamp)}</bdi></p>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
            {lastLines.filter((line) => line.counted !== null).map((line) => (<li key={line.account} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-neutral-700">{t(ACCOUNT_KEY[line.account])}</span>
                <DifferenceText line={line}/>
              </li>))}
          </ul>
          {last.note && <p className="text-xs text-neutral-600"><bdi>{last.note}</bdi></p>}
          <p className="text-xs text-neutral-500">{lastGood ? <>{t('cashCount.lastGoodOn')} <bdi dir="ltr">{dateTime(lastGood.timestamp)}</bdi></> : t('cashCount.noGood')}</p>
          {counts.length > 1 && (<details className="text-xs text-neutral-600">
              <summary className="min-h-touch cursor-pointer py-2 font-semibold">{t('cashCount.history')}</summary>
              <ul className="flex flex-col gap-1">
                {counts.slice(1).map((count) => {
                    const lines = compareCashCount(count.expected, count.counted).filter((line) => line.counted !== null);
                    const agrees = cashCountAgrees(lines);
                    return (<li key={count.id} className="flex justify-between gap-3">
                      <bdi dir="ltr">{dateTime(count.timestamp)}</bdi>
                      <span className={agrees ? 'text-financial-profit' : 'text-financial-debt'}>{agrees ? t('cashCount.agrees') : t('cashCount.differs')}</span>
                    </li>);
                })}
              </ul>
            </details>)}
        </div>)}
      {isOpen && <CashCountDialog expected={expected} onClose={() => setIsOpen(false)} onSave={save}/>}
    </SectionCard>);
}
