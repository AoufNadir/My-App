import { useMemo, useState } from 'react';
import { SectionCard } from '../cards';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatMoney } from '../../pages/shared/pageFormat';
import type { ClientTransactionDzd, TreasuryTx, Tx } from '../../types';
import {
    buildMovementReview,
    isMeaningfulReasonNote,
    type MovementKind,
    type MovementReasonDoc,
    type ReviewRow,
    type ReviewWallet,
} from '../../utils/movementReason';

const WALLET_LABEL_KEYS: Record<ReviewWallet, string> = {
    Caisse: 'movementReview.walletCaisse',
    BaridiMob: 'movementReview.walletBaridi',
    USDT: 'movementReview.walletUsdt',
    EUR: 'movementReview.walletEur',
};
/** Rows shown before « see all »: the newest ones, which are the ones still easy to remember. */
const ROWS_SHOWN = 5;

type MovementReviewSectionProps = {
    treasuryTransactions: readonly TreasuryTx[];
    portfolioTransactions: readonly Tx[];
    clientRows: ReadonlyArray<Pick<ClientTransactionDzd, 'linkedTxId'>>;
    reasons: readonly MovementReasonDoc[];
    /** False while the figures still come from the phone's cache */
    ready: boolean;
    /** Writes the reason for one movement; false when the text says nothing */
    onWriteReason: (kind: MovementKind, movementId: string, note: string) => boolean;
    /** Opens the existing adjustment window on this movement, to attach it to a client */
    onLinkClient: (row: ReviewRow) => void;
    /** Opens the list at once (screenshots and tests) */
    defaultOpenAll?: boolean;
};

/**
 * V7-2: the money movements typed by hand that nothing explains (no client, no link to a sale, an
 * expense, an investor...). Each one can be attached to a client or explained in words, and then
 * leaves the list. Reading this list never changes a balance.
 */
export function MovementReviewSection({ treasuryTransactions, portfolioTransactions, clientRows, reasons, ready, onWriteReason, onLinkClient, defaultOpenAll = false }: MovementReviewSectionProps) {
    const { t } = useLanguage();
    const text = (key: string, values: Record<string, string> = {}) =>
        Object.entries(values).reduce((out, [name, value]) => out.replace(new RegExp(`\\{${name}\\}`, 'g'), value), String(t(key)));
    const review = useMemo(() => buildMovementReview({ treasury: treasuryTransactions, crypto: portfolioTransactions, clientRows, reasons }), [treasuryTransactions, portfolioTransactions, clientRows, reasons]);
    const [showAll, setShowAll] = useState(defaultOpenAll);
    const [showExplained, setShowExplained] = useState(false);
    const [writingKey, setWritingKey] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    if (!ready)
        return null;

    // Sign and amount isolated together, left to right: in an Arabic line the sign would otherwise end up on the wrong side.
    const money = (row: ReviewRow) => {
        const whole = row.currency === 'DZD' && Number.isInteger(row.amount);
        return `\u2066${row.direction === 'in' ? '+' : '−'}${formatMoney(row.amount, row.currency, whole ? { min: 0, max: 0 } : { min: 2, max: 2 })}\u2069`;
    };
    const startWriting = (row: ReviewRow) => {
        setWritingKey(writingKey === row.key ? null : row.key);
        setDraft('');
    };
    const save = (row: ReviewRow) => {
        if (onWriteReason(row.kind, row.id, draft)) {
            setWritingKey(null);
            setDraft('');
        }
    };
    const rowView = (row: ReviewRow) => {
        const isIn = row.direction === 'in';
        const writing = writingKey === row.key;
        return (<li key={row.key} className="rounded-button bg-surface-muted px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">
                        <span className={isIn ? 'text-financial-profit' : 'text-financial-loss'}>{isIn ? t('movementReview.directionIn') : t('movementReview.directionOut')}</span>
                        {' · '}{t(WALLET_LABEL_KEYS[row.wallet])}
                    </p>
                    <p className="text-xs text-neutral-500" dir="ltr">{row.date} {row.time}</p>
                </div>
                <p className={`shrink-0 text-sm font-bold ${isIn ? 'text-financial-profit' : 'text-financial-loss'}`}>{money(row)}</p>
            </div>
            {isMeaningfulReasonNote(row.note) && (<p className="mt-1 text-xs text-neutral-500">{text('movementReview.originalNote', { note: row.note })}</p>)}
            {row.reasonNote && (<p className="mt-1 text-xs font-semibold text-neutral-700">{t('movementReview.reasonLabel')}: {row.reasonNote}</p>)}
            {!row.reasonNote && (<div className="mt-2 flex flex-wrap gap-2">
                {row.canLinkClient && (<Button type="button" size="sm" variant="outline" onClick={() => onLinkClient(row)}>{t('movementReview.linkClient')}</Button>)}
                <Button type="button" size="sm" variant="outline" aria-expanded={writing} onClick={() => startWriting(row)}>{t('movementReview.writeReason')}</Button>
            </div>)}
            {writing && (<div className="mt-2 space-y-2">
                <Input label={t('movementReview.reasonLabel') as string} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('movementReview.reasonPlaceholder') as string} error={draft.trim() !== '' && !isMeaningfulReasonNote(draft) ? t('movementReview.reasonShort') as string : undefined}/>
                <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={!isMeaningfulReasonNote(draft)} onClick={() => save(row)}>{t('movementReview.save')}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setWritingKey(null)}>{t('movementReview.cancel')}</Button>
                </div>
            </div>)}
        </li>);
    };

    const unexplained = showAll ? review.unexplained : review.unexplained.slice(0, ROWS_SHOWN);
    if (review.unexplained.length === 0 && review.explained.length === 0) {
        return (<SectionCard title={t('movementReview.title')}>
            <p className="text-sm font-semibold text-financial-profit">✓ {t('movementReview.none')}</p>
        </SectionCard>);
    }
    return (<SectionCard title={t('movementReview.title')}>
        <p className="text-xs text-neutral-500">{t('movementReview.intro')}</p>
        {review.unexplained.length === 0
            ? (<p className="mt-3 text-sm font-semibold text-financial-profit">✓ {t('movementReview.none')}</p>)
            : (<>
                <p className="mt-3 text-sm font-semibold text-financial-loss">{text('movementReview.count', { n: String(review.unexplained.length) })}</p>
                <ul className="mt-2 space-y-2">{unexplained.map(rowView)}</ul>
                {review.unexplained.length > ROWS_SHOWN && (<button type="button" onClick={() => setShowAll((current) => !current)} className="mt-2 text-xs font-semibold text-primary">
                    {showAll ? t('movementReview.less') : text('movementReview.more', { n: String(review.unexplained.length) })}
                </button>)}
            </>)}
        {review.explained.length > 0 && (<div className="mt-4 border-t border-border pt-3">
            <button type="button" aria-expanded={showExplained} onClick={() => setShowExplained((current) => !current)} className="text-xs font-semibold text-neutral-700">
                {t('movementReview.explainedTitle')} · {text('movementReview.explainedCount', { n: String(review.explained.length) })}
            </button>
            {showExplained && (<ul className="mt-2 space-y-2">{review.explained.map(rowView)}</ul>)}
        </div>)}
    </SectionCard>);
}
