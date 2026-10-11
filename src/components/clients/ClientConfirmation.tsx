import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { MoneyField } from '../ui/MoneyField';
import { CheckIcon } from '../icons/CheckIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { useClientConfirmations } from '../../hooks/useClientConfirmations';
import type { ClientDzd, ClientTransactionDzd } from '../../types';
import { formatMoney } from '../../pages/shared/pageFormat';
import { now as currentStamp, parseAndEvaluate } from '../../utils';
import {
    buildClientConfirmationData,
    clientOperationsSince,
    clientTransferSuggestions,
    isAgreement,
    lastAgreedConfirmation,
    latestConfirmationByClient,
    openClientGaps,
    type ClientConfirmation,
    type ClientGap,
} from '../../utils/clientConfirmation';
import { getClientOperationLabel } from '../../utils/transactionTerminology';

type Side = 'debt' | 'advance';

export type ClientTransferRequest = { fromClientId: string; toClientId: string; amount: number };

type ClientConfirmationViewProps = {
    /** What clients said before, newest first */
    confirmations: readonly ClientConfirmation[];
    /** Keeps what the client said; it changes no balance */
    onSave: (data: Omit<ClientConfirmation, 'id'>) => void;
    client: ClientDzd;
    /** The app's balance for this client (positive: advance, negative: debt) */
    balance: number;
    balances: ReadonlyMap<string, number>;
    clients: readonly ClientDzd[];
    getClientFullName: (client: ClientDzd) => string;
    clientTransactions: readonly ClientTransactionDzd[];
    /** Opens the existing edit window of an operation; this window closes first */
    onEditOperation: (tx: ClientTransactionDzd) => void;
    /** Opens the existing client-to-client transfer window, filled in */
    onRecordTransfer?: (transfer: ClientTransferRequest) => void;
    /** Opens the window at once, with these entries typed (screenshots and tests) */
    defaultOpen?: boolean;
    initialSide?: Side;
    initialAmount?: string;
};

/**
 * « Confirm the client's balance » (V5-3): the row on the client page and its window. The owner
 * types what the client says; the app compares it with its own balance and, on a gap, lists the
 * operations since the two last agreed, and offers the transfer another client's opposite gap points
 * to. Saving keeps the confirmation only: it never changes a balance.
 */
export function ClientConfirmationView({ confirmations, onSave, client, balance, balances, clients, getClientFullName, clientTransactions, onEditOperation, onRecordTransfer, defaultOpen = false, initialSide, initialAmount = '' }: ClientConfirmationViewProps) {
    const { t } = useLanguage();
    const word = (key: string, values: Record<string, string> = {}) =>
        Object.entries(values).reduce((out, [name, value]) => out.replace(new RegExp(`\\{${name}\\}`, 'g'), value), String(t(`clients.confirm.${key}`)));
    const defaultSide: Side = balance < 0 ? 'debt' : 'advance';
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [side, setSide] = useState<Side>(initialSide ?? defaultSide);
    const [amount, setAmount] = useState(initialAmount);
    const [note, setNote] = useState('');
    const [justSaved, setJustSaved] = useState(false);

    // Amounts inside an Arabic sentence keep their own left-to-right order.
    const ltr = (value: string) => `⁦${value}⁩`;
    const money = (value: number, signed = false) => ltr(formatMoney(value, 'DZD', Number.isInteger(value) ? { min: 0, max: 0, showSign: signed } : { min: 2, max: 2, showSign: signed }));
    const describe = (value: number) => (Math.abs(value) < 0.005
        ? word('stateZero')
        : value < 0 ? word('stateDebt', { amount: money(-value) }) : word('stateAdvance', { amount: money(value) }));

    const typed = amount.trim();
    const typedValue = typed === '' ? null : parseAndEvaluate(typed);
    const typedValid = typedValue !== null && Number.isFinite(typedValue) && typedValue >= 0;
    const claimed: number | null = typedValid && typedValue !== null ? (typedValue === 0 ? 0 : side === 'advance' ? typedValue : -typedValue) : null;
    const draft = useMemo(() => (claimed === null ? null : buildClientConfirmationData(client.id, claimed, balance, currentStamp())), [claimed, client.id, balance]);

    const lastAgreed = useMemo(() => lastAgreedConfirmation(confirmations, client.id), [confirmations, client.id]);
    const last = useMemo(() => latestConfirmationByClient(confirmations).get(client.id) ?? null, [confirmations, client.id]);
    const hasGap = draft !== null && !isAgreement(draft.gap);
    const operations = useMemo(() => (hasGap ? clientOperationsSince(clientTransactions, client.id, lastAgreed?.timestamp ?? null) : null), [hasGap, clientTransactions, client.id, lastAgreed]);

    // Another client whose open gap is the opposite of this one.
    const names = useMemo(() => new Map(clients.map((candidate) => [candidate.id, getClientFullName(candidate)] as const)), [clients, getClientFullName]);
    const transferPairs = useMemo(() => {
        if (!draft || !hasGap)
            return [];
        const others = openClientGaps({
            confirmations: confirmations.filter((confirmation) => confirmation.clientId !== client.id),
            balances,
            now: Date.now(),
            clientIds: new Set(clients.map((candidate) => candidate.id)),
        });
        const own: ClientGap = { clientId: client.id, claimed: draft.claimed, balanceNow: balance, gap: draft.gap, confirmedAt: draft.timestamp, confirmedDate: draft.date };
        const gapOf = new Map([...others, own].map((gap) => [gap.clientId, gap.gap] as const));
        return clientTransferSuggestions([...others, own])
            .filter((pair) => pair.fromClientId === client.id || pair.toClientId === client.id)
            .map((pair) => ({ ...pair, otherGap: gapOf.get(pair.fromClientId === client.id ? pair.toClientId : pair.fromClientId) ?? 0 }));
    }, [draft, hasGap, confirmations, balances, clients, client.id, balance]);

    const open = () => {
        setSide(defaultSide);
        setAmount('');
        setNote('');
        setJustSaved(false);
        setIsOpen(true);
    };
    const close = () => setIsOpen(false);
    const save = () => {
        if (claimed === null)
            return;
        const data = buildClientConfirmationData(client.id, claimed, balance, currentStamp(), note);
        if (!data)
            return;
        onSave(data);
        setJustSaved(true);
    };
    const edit = (id: string) => {
        const tx = clientTransactions.find((candidate) => candidate.id === id);
        if (!tx)
            return;
        setIsOpen(false);
        onEditOperation(tx);
    };
    const recordTransfer = (pair: { fromClientId: string; toClientId: string; amount: number }) => {
        setIsOpen(false);
        onRecordTransfer?.(pair);
    };

    const lastSummary = last
        ? word('lastLine', { date: last.date, state: isAgreement(last.gap) ? word('lastMatch') : word('lastGap', { gap: money(last.gap, true) }) })
        : null;
    const label = (type: string) => getClientOperationLabel(type, (key: string) => String(t(key)));

    return (<>
      <button type="button" onClick={open} data-testid="client-confirmation-button" className="mt-2 flex min-h-touch w-full items-center gap-3 rounded-button border border-border bg-surface px-3 py-2 text-start">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-financial-profit/10 text-financial-profit">
          <CheckIcon className="h-5 w-5"/>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-neutral-900">{word('button')}</span>
          <span className="block truncate text-xs text-neutral-500">{lastSummary ?? word('buttonHint')}</span>
        </span>
        <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>
      </button>

      <Modal isOpen={isOpen} onClose={close} className="max-w-md bg-surface text-neutral-900">
        <ModalHeader onClose={close}>
          <ModalTitle className="text-base sm:text-lg">{word('title')}</ModalTitle>
          <p className="mt-0.5 text-sm font-normal text-neutral-500">{getClientFullName(client)}</p>
        </ModalHeader>
        <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
          <p className="rounded-button bg-surface-muted px-3 py-2 text-sm font-semibold text-neutral-900">{word('inApp', { state: describe(balance) })}</p>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-neutral-700">{word('askLabel')}</p>
            <div role="group" aria-label={word('askLabel')} className="grid grid-cols-2 gap-2">
              {(['debt', 'advance'] as const).map((option) => (<button key={option} type="button" aria-pressed={side === option} onClick={() => { setSide(option); setJustSaved(false); }}
                  className={`min-h-touch rounded-button border px-3 py-2 text-sm font-semibold transition-colors ${side === option ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-neutral-700'}`}>
                  {word(option === 'debt' ? 'sideDebt' : 'sideAdvance')}
                </button>))}
            </div>
          </div>
          <MoneyField label={word('amountLabel')} currency="DZD" value={amount} onChange={(value) => { setAmount(value); setJustSaved(false); }} placeholder="0" error={typed !== '' && !typedValid ? word('invalid') : undefined}/>

          {draft && (hasGap
            ? (<p className="text-sm font-bold text-financial-loss">{word('differ', { claimed: describe(draft.claimed), app: describe(balance), gap: money(draft.gap, true) })}</p>)
            : (<p className="flex items-center gap-1.5 text-sm font-bold text-financial-profit"><CheckIcon aria-hidden="true" className="h-4 w-4"/>{word('match')}</p>))}

          {hasGap && operations && (<section aria-label={word('title')} className="space-y-2 rounded-card border border-border bg-surface-muted p-3">
              <p className="text-xs font-semibold text-neutral-700">
                {operations.count === 0
                  ? word('noOperations')
                  : lastAgreed ? word('sinceAgreed', { count: String(operations.count), date: lastAgreed.date }) : word('sinceNever', { count: String(operations.count) })}
              </p>
              {operations.operations.length > 0 && (<ul className="space-y-1.5">
                  {operations.operations.map((operation) => (<li key={operation.id} className="flex items-center justify-between gap-2 rounded-button bg-surface px-2.5 py-2">
                      <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-xs font-semibold text-neutral-700" dir="ltr">{operation.date} {operation.time}</span>
                        <span className="text-xs font-semibold text-neutral-900">{label(operation.type)}</span>
                        <span className="text-xs font-bold tabular-nums text-neutral-900" dir="ltr">{formatMoney(operation.effect, 'DZD', { min: 0, max: 2, showSign: true })}</span>
                      </p>
                      <Button type="button" size="sm" variant="outline" onClick={() => edit(operation.id)}>{word('edit')}</Button>
                    </li>))}
                </ul>)}
            </section>)}

          {transferPairs.map((pair) => (<section key={`${pair.fromClientId}-${pair.toClientId}`} className="space-y-2 rounded-card border border-border bg-surface-muted p-3">
              <p className="text-sm font-bold text-neutral-900">{word('pairTitle')}</p>
              <p className="text-xs text-neutral-600">{word('pairBody', {
                  other: names.get(pair.fromClientId === client.id ? pair.toClientId : pair.fromClientId) ?? '',
                  gap: money(pair.otherGap, true),
                  from: names.get(pair.fromClientId) ?? '',
                  to: names.get(pair.toClientId) ?? '',
                  amount: money(pair.amount),
              })}</p>
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => recordTransfer(pair)}>{word('pairButton')}</Button>
            </section>))}

          <Input label={word('note')} value={note} onChange={(event) => { setNote(event.target.value); setJustSaved(false); }} placeholder={word('notePlaceholder')}/>
          <p className="text-xs text-neutral-500">{word('saveHint')}</p>
          {justSaved && (<p role="status" className="text-sm font-semibold text-financial-profit">{word('saved')}</p>)}
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={close}>{t('common.close')}</Button>
          <Button type="button" onClick={save} disabled={claimed === null || justSaved}>{word('save')}</Button>
        </ModalFooter>
      </Modal>
    </>);
}

type ClientConfirmationEntryProps = Omit<ClientConfirmationViewProps, 'confirmations' | 'onSave'> & {
    /** The user document, to read and keep what clients said. Without it nothing is shown. */
    userDocRef?: any;
    setAlert?: (message: string) => void;
};

/** The row and window with their storage: users/{uid}/client_confirmations. */
export function ClientConfirmationEntry({ userDocRef, setAlert, ...view }: ClientConfirmationEntryProps) {
    const { t } = useLanguage();
    const enabled = Boolean(userDocRef);
    const { confirmations, saveConfirmation } = useClientConfirmations(userDocRef, enabled, () => setAlert?.(String(t('clients.confirm.saveFailed'))));
    if (!enabled)
        return null;
    return <ClientConfirmationView {...view} confirmations={confirmations} onSave={(data) => { saveConfirmation(data); }}/>;
}
