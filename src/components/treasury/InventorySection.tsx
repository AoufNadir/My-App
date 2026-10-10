import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { SectionCard } from '../cards';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { MoneyField } from '../ui/MoneyField';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatMoney, type MoneyCurrency } from '../../pages/shared/pageFormat';
import { now as currentStamp, parseAndEvaluate } from '../../utils';
import {
    INVENTORY_ACCOUNTS,
    buildInventoryCheckData,
    compareInventory,
    inventoryMonths,
    isDzdAccount,
    lastCleanCheck,
    sortChecksNewestFirst,
    type BalanceCorrection,
    type InventoryAccount,
    type InventoryCheck,
    type InventoryCounted,
    type InventoryExpected,
    type InventoryGapStatus,
    type InventoryRow,
} from '../../utils/inventoryCheck';

const ACCOUNT_LABEL_KEYS: Record<InventoryAccount, string> = {
    caisse: 'inventory.accountCaisse',
    baridi: 'inventory.accountBaridi',
    usdt: 'inventory.accountUsdt',
    eur: 'inventory.accountEur',
};
const ACCOUNT_CURRENCY: Record<InventoryAccount, MoneyCurrency> = { caisse: 'DZD', baridi: 'DZD', usdt: 'USDT', eur: 'EUR' };
const MONTHS_SHOWN = 3;

type Draft = Record<InventoryAccount, string>;
const EMPTY_DRAFT: Draft = { caisse: '', baridi: '', usdt: '', eur: '' };

/** Colour plus a symbol, so the state never rests on colour alone. */
const STATUS_STYLE: Record<InventoryGapStatus, { tone: string; mark: string }> = {
    match: { tone: 'text-financial-profit', mark: '✓' },
    short: { tone: 'text-financial-loss', mark: '▼' },
    over: { tone: 'text-warning', mark: '▲' },
};

type InventorySectionProps = {
    /** What the books say each account holds */
    expected: InventoryExpected;
    /** Saved inventories, newest first */
    checks: InventoryCheck[];
    /** Balance corrections already made, for the monthly list */
    corrections: BalanceCorrection[];
    /** False while the figures still come from the phone's cache */
    ready: boolean;
    onSave: (data: Omit<InventoryCheck, 'id'>) => void;
    onDelete: (id: string) => void;
    /** Opens the existing « edit balance » window for this gap; the inventory window closes first */
    onCorrect: (row: InventoryRow) => void;
    /** Opens the window at once, with these entries typed (screenshots and tests) */
    defaultOpen?: boolean;
    initialDraft?: Partial<Draft>;
};

export function InventorySection({ expected, checks, corrections, ready, onSave, onDelete, onCorrect, defaultOpen = false, initialDraft }: InventorySectionProps) {
    const { t } = useLanguage();
    const text = (key: string, values: Record<string, string> = {}) =>
        Object.entries(values).reduce((out, [name, value]) => out.replace(new RegExp(`\\{${name}\\}`, 'g'), value), String(t(key)));
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, ...initialDraft });
    const [note, setNote] = useState('');
    const [justSaved, setJustSaved] = useState(false);
    const [showAllMonths, setShowAllMonths] = useState(false);
    const [checkToDelete, setCheckToDelete] = useState<InventoryCheck | null>(null);

    // Whole dinars without decimals, otherwise always two (never « 120 000,4 »).
    const decimals = (value: number, account: InventoryAccount) => (isDzdAccount(account) && Number.isInteger(value) ? { min: 0, max: 0 } : { min: 2, max: 2 });
    const money = (value: number, account: InventoryAccount) => formatMoney(value, ACCOUNT_CURRENCY[account], decimals(value, account));
    
    // What was typed: empty means not counted; text that is not a plain non-negative amount is flagged.
    const parsed = useMemo(() => {
        const counted: InventoryCounted = {};
        const invalid: Partial<Record<InventoryAccount, boolean>> = {};
        for (const account of INVENTORY_ACCOUNTS) {
            const raw = draft[account].trim();
            if (raw === '')
                continue;
            const value = parseAndEvaluate(raw);
            if (Number.isFinite(value) && value >= 0)
                counted[account] = value;
            else
                invalid[account] = true;
        }
        return { counted, invalid };
    }, [draft]);
    const rows = useMemo(() => compareInventory(expected, parsed.counted), [expected, parsed.counted]);
    const rowByAccount = new Map<InventoryAccount, InventoryRow>();
    rows.forEach((row) => rowByAccount.set(row.account, row));
    const hasInvalid = Object.keys(parsed.invalid).length > 0;

    const sortedChecks = useMemo(() => sortChecksNewestFirst(checks), [checks]);
    const latest = sortedChecks[0] ?? null;
    const latestGaps = latest ? latest.rows.filter((row) => row.status !== 'match').length : 0;
    const clean = useMemo(() => lastCleanCheck(checks), [checks]);
    const months = useMemo(() => inventoryMonths(checks, corrections), [checks, corrections]);
    const monthNames = (Array.isArray(t('common.months')) ? t('common.months') : []) as unknown as string[];
    const monthLabel = (key: string) => {
        const [year, month] = key.split('-');
        return `${monthNames[Number(month) - 1] ?? month} ${year}`;
    };

    const hasDraft = INVENTORY_ACCOUNTS.some((account) => draft[account].trim() !== '');
    const edit = (account: InventoryAccount, value: string) => {
        setDraft((current) => ({ ...current, [account]: value }));
        setJustSaved(false);
    };
    const close = () => {
        setIsOpen(false);
        // A saved inventory is finished; an unsaved one is kept for when the window is reopened.
        if (justSaved) {
            setDraft(EMPTY_DRAFT);
            setNote('');
            setJustSaved(false);
        }
    };
    const canSave = ready && rows.length > 0 && !hasInvalid && !justSaved;
    const save = () => {
        if (!canSave)
            return;
        const data = buildInventoryCheckData(expected, parsed.counted, currentStamp(), note);
        if (!data)
            return;
        onSave(data);
        setJustSaved(true);
    };
    const correct = (row: InventoryRow) => {
        setIsOpen(false);
        onCorrect(row);
    };

    const checkLine = (check: InventoryCheck): ReactNode => (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-semibold text-neutral-700" dir="ltr">{check.date} {check.time}</span>
            {check.rows.map((row) => {
                const style = STATUS_STYLE[row.status];
                return (<span key={row.account} className={`text-xs font-semibold ${style.tone}`}>
                    {style.mark} {t(ACCOUNT_LABEL_KEYS[row.account])}{row.status === 'match' ? '' : <> <span dir="ltr">{formatMoney(row.gap, null, { min: 0, max: 2, showSign: true })}</span></>}
                </span>);
            })}
        </div>
    );

    const shownMonths = showAllMonths ? months : months.slice(0, MONTHS_SHOWN);
    const lastSummary = latest
        ? latestGaps === 0 ? text('inventory.lastAllMatch') : text('inventory.lastGaps', { count: String(latestGaps) })
        : null;

    return (<>
      <SectionCard title={t('inventory.title')}>
        <p className="text-xs text-neutral-500">{t('inventory.intro')}</p>
        <div className="mt-3 flex flex-col gap-1">
          {latest ? (<>
              <p className="text-sm font-semibold text-neutral-900">{text('inventory.lastCheck', { date: latest.date })}</p>
              <p className={`text-xs font-semibold ${latestGaps === 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>{lastSummary}</p>
              <p className="text-xs text-neutral-500">{clean ? text('inventory.lastClean', { date: clean.date }) : text('inventory.neverClean')}</p>
            </>) : (<p className="text-sm text-neutral-500">{t('inventory.never')}</p>)}
        </div>
        <Button type="button" className="mt-3 w-full" onClick={() => setIsOpen(true)}>
          {hasDraft ? t('inventory.resume') : t('inventory.start')}
        </Button>
      </SectionCard>

      <Modal isOpen={isOpen} onClose={close} className="max-w-md bg-surface text-neutral-900">
        <ModalHeader onClose={close}>
          <ModalTitle className="text-base sm:text-lg">{t('inventory.title')}</ModalTitle>
          <p className="mt-0.5 text-sm font-normal text-neutral-500">{t('inventory.dialogHint')}</p>
        </ModalHeader>
        <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
          {!ready && (<p role="status" className="rounded-button bg-warning-bg px-3 py-2 text-xs font-semibold text-warning">{t('inventory.waitingSync')}</p>)}
          {INVENTORY_ACCOUNTS.map((account) => {
              const row = rowByAccount.get(account);
              const style = row ? STATUS_STYLE[row.status] : null;
              return (<Fragment key={account}>
                <div>
                  <MoneyField label={t(ACCOUNT_LABEL_KEYS[account]) as string} value={draft[account]} onChange={(value) => edit(account, value)} currency={ACCOUNT_CURRENCY[account]} placeholder="0" error={parsed.invalid[account] ? t('common.invalidAmount') : undefined} hint={<span>{text('inventory.inApp', { amount: money(expected[account], account) })}</span>}/>
                  {row && style && (<div className="mt-1 flex items-center justify-between gap-2">
                      <p className={`text-sm font-bold ${style.tone}`}>
                        {style.mark} {row.status === 'match'
                            ? t('inventory.match')
                            : row.status === 'short'
                                ? text('inventory.short', { amount: money(Math.abs(row.gap), account) })
                                : text('inventory.over', { amount: money(Math.abs(row.gap), account) })}
                      </p>
                      {row.status !== 'match' && (<Button type="button" size="sm" variant="outline" disabled={!ready} onClick={() => correct(row)}>{t('inventory.fix')}</Button>)}
                    </div>)}
                </div>
              </Fragment>);
          })}
          <Input label={t('inventory.note') as string} value={note} onChange={(event) => { setNote(event.target.value); setJustSaved(false); }} placeholder={t('inventory.notePlaceholder') as string}/>
          {rows.length === 0 && !hasInvalid && (<p className="text-xs text-neutral-500">{t('inventory.nothingCounted')}</p>)}
          <p className="text-xs text-neutral-500">{t('inventory.saveHint')}</p>
          {justSaved && (<p role="status" className="text-sm font-semibold text-financial-profit">{t('inventory.saved')}</p>)}

          <section aria-label={t('inventory.history') as string} className="border-t border-border pt-3">
            <h3 className="text-sm font-bold text-neutral-900">{t('inventory.history')}</h3>
            {months.length === 0 ? (<p className="mt-2 text-xs text-neutral-500">{t('inventory.historyEmpty')}</p>) : (<div className="mt-2 space-y-4">
                {shownMonths.map((month) => (<div key={month.month} className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{monthLabel(month.month)}</p>
                    {month.checks.map((check) => (<div key={check.id} className="flex items-start justify-between gap-2 rounded-button bg-surface-muted px-3 py-2">
                        <div className="min-w-0">
                          {checkLine(check)}
                          {check.note && (<p className="mt-0.5 text-xs text-neutral-500">{check.note}</p>)}
                        </div>
                        <button type="button" onClick={() => setCheckToDelete(check)} className="shrink-0 text-xs font-semibold text-danger">{t('common.delete')}</button>
                      </div>))}
                    <p className="text-xs text-neutral-500">
                      {t('inventory.monthCorrections')}:{' '}
                      {month.correctionCount === 0
                        ? t('inventory.noCorrections')
                        : INVENTORY_ACCOUNTS.filter((account) => month.corrections[account] !== 0).map((account) => (<span key={account} className="me-2 inline-block font-semibold text-neutral-700">
                            {t(ACCOUNT_LABEL_KEYS[account])} <span dir="ltr">{formatMoney(month.corrections[account], null, { min: 0, max: 2, showSign: true })}</span>
                          </span>))}
                    </p>
                  </div>))}
                {months.length > MONTHS_SHOWN && (<button type="button" onClick={() => setShowAllMonths((current) => !current)} className="text-xs font-semibold text-primary">
                    {showAllMonths ? t('inventory.showLess') : t('inventory.showAll')}
                  </button>)}
              </div>)}
          </section>
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={close}>{t('common.close')}</Button>
          <Button type="button" onClick={save} disabled={!canSave}>{t('inventory.save')}</Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog isOpen={checkToDelete !== null} onClose={() => setCheckToDelete(null)} onConfirm={() => { if (checkToDelete) onDelete(checkToDelete.id); setCheckToDelete(null); }} title={t('inventory.deleteTitle') as string} description={t('inventory.deleteDesc')} confirmLabel={t('common.delete') as string} cancelLabel={t('common.cancel') as string}/>
    </>);
}
