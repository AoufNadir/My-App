import React from 'react';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import { MoneyField } from '../ui/MoneyField';
import { DatePicker } from '../ui/DatePicker';
import { FormCard } from '../ui/FormCard';
import { OperationFooter } from '../ui/OperationFooter';
import { TransactionPreviewCard, type PreviewRow } from '../ui/TransactionPreviewCard';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ArrowRightLeftIcon } from '../icons/ArrowRightLeftIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { parseAndEvaluate } from '../../utils';
import { formatMoney } from '../../pages/shared/pageFormat';
export type MainSearchResult = {
    id: string;
    kind: 'client';
    title: string;
    subtitle: string;
    clientId: string;
    timestamp: number;
} | {
    id: string;
    kind: 'investor';
    title: string;
    subtitle: string;
    investorId: string;
    timestamp: number;
} | {
    id: string;
    kind: 'transaction';
    title: string;
    subtitle: string;
    timestamp: number;
};
type GlobalSearchDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    query: string;
    setQuery: (value: string) => void;
    results: MainSearchResult[];
    onSelectResult: (result: MainSearchResult) => void;
    title: string;
    placeholder: string;
    noResultsText: string;
    clientsText: string;
    transactionsText: string;
};
export function GlobalSearchDialog({ isOpen, onClose, query, setQuery, results, onSelectResult, title, placeholder, noResultsText, clientsText, transactionsText }: GlobalSearchDialogProps) {
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const listRef = React.useRef<HTMLDivElement>(null);
    // Reset selection when results change
    React.useEffect(() => { setSelectedIndex(0); }, [results]);
    // Keyboard navigation
    React.useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && results.length > 0) {
                e.preventDefault();
                onSelectResult(results[selectedIndex]);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, results, selectedIndex, onSelectResult]);
    // Scroll selected item into view
    React.useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);
    // Group results
    const investors = results.filter((r) => r.kind === 'investor');
    const clients = results.filter((r) => r.kind === 'client');
    const transactions = results.filter((r) => r.kind === 'transaction');
    const groups = [
        { label: 'Investisseurs', items: investors, color: 'bg-warning-bg text-warning' },
        { label: clientsText, items: clients, color: 'bg-primary/10 text-primary' },
        { label: transactionsText, items: transactions, color: 'bg-neutral-100 text-neutral-700' },
    ].filter((g) => g.items.length > 0);
    let globalIdx = -1;
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl bg-surface text-neutral-900">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base">{title}</ModalTitle>
      </ModalHeader>
      <ModalContent className="p-4 space-y-3">
        <div className="relative">
          <Input value={query} onChange={(e) => { setQuery(e.target.value); }} placeholder={placeholder} autoFocus className="pe-16"/>
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-muted px-1.5 py-0.5 text-xs font-bold text-neutral-400 hidden sm:block">
            Ctrl K
          </span>
        </div>
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto rounded-xl border border-border">
          {!query.trim() ? (<div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="text-2xl">🔍</span>
              <p className="text-sm text-neutral-500">Tapez pour rechercher clients, investisseurs ou transactions</p>
              <p className="text-xs text-neutral-400">Ctrl+K pour ouvrir · Échap pour fermer · ↑↓ pour naviguer</p>
            </div>) : results.length === 0 ? (<div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="text-2xl">😕</span>
              <p className="text-sm text-neutral-500">{noResultsText}</p>
              <p className="text-xs text-neutral-400">pour "<span className="font-semibold">{query}</span>"</p>
            </div>) : (<div>
              {groups.map((group) => (<div key={group.label}>
                  <div className="sticky top-0 z-10 bg-surface-muted px-3 py-1.5 text-[13px] font-bold text-neutral-500 border-b border-border">
                    {group.label} ({group.items.length})
                  </div>
                  <div className="divide-y divide-border">
                    {group.items.map((result) => {
                    globalIdx++;
                    const idx = globalIdx;
                    const isActive = idx === selectedIndex;
                    return (<button key={result.id} data-index={idx} onClick={() => onSelectResult(result)} onMouseEnter={() => setSelectedIndex(idx)} className={`w-full min-h-touch px-4 py-3 text-start transition-colors ${isActive ? 'bg-primary/5' : 'hover:bg-neutral-50'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold truncate text-sm">{result.title}</p>
                              <p className="mt-0.5 truncate text-xs text-neutral-500">{result.subtitle || '—'}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${group.color}`}>
                              {group.label}
                            </span>
                          </div>
                        </button>);
                })}
                  </div>
                </div>))}
            </div>)}
        </div>
        {results.length > 0 && (<p className="text-center text-xs text-neutral-400">
            ↑↓ naviguer · Entrée sélectionner · Échap fermer
          </p>)}
      </ModalContent>
    </Modal>);
}
type WalletTransferDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    amount: string;
    setAmount: (value: string) => void;
    source: 'Caisse' | 'BaridiMob';
    setSource: (value: 'Caisse' | 'BaridiMob') => void;
    destination: 'Caisse' | 'BaridiMob';
    setDestination: (value: 'Caisse' | 'BaridiMob') => void;
    notes: string;
    setNotes: (value: string) => void;
    onMax: () => void;
    onSwap: () => void;
    onConfirm: () => void;
    isInvalid: boolean;
    isSaving: boolean;
    caisseBalance: number;
    baridiBalance: number;
    title: string;
    subtitle: string;
    amountLabel: string;
    fromLabel: string;
    toLabel: string;
    sourceLabel: string;
    destinationLabel: string;
    notesOptionalLabel: string;
    sameAccountErrorText: string;
    processingText: string;
    confirmText: string;
};
type InternalWallet = 'Caisse' | 'BaridiMob';
const getOppositeWallet = (wallet: InternalWallet): InternalWallet => wallet === 'Caisse' ? 'BaridiMob' : 'Caisse';
const walletBalance = (wallet: InternalWallet, caisseBalance: number, baridiBalance: number) => wallet === 'Caisse' ? caisseBalance : baridiBalance;
type WalletChoiceCardProps = {
    wallet: InternalWallet;
    /** The wallet's name in the page language */
    name: string;
    balance: number;
    selected?: boolean;
    readOnly?: boolean;
    helperText?: string;
    onClick?: () => void;
};
function WalletChoiceCard({ name, balance, selected = false, readOnly = false, helperText, onClick }: WalletChoiceCardProps) {
    const content = (<>
      <span className="text-sm font-bold text-neutral-900">{name}</span>
      <span dir="ltr" className="mt-1 text-xs font-semibold tabular-nums text-neutral-500">{formatMoney(balance, 'DZD')}</span>
      {helperText && <span className="mt-1 text-[11px] font-semibold text-neutral-400">{helperText}</span>}
    </>);
    const classes = [
        `flex ${readOnly ? 'min-h-[66px]' : 'min-h-[74px]'} w-full flex-col items-start justify-center rounded-button border px-3.5 py-3 text-start transition-colors`,
        readOnly
            ? 'border-border bg-surface-muted text-neutral-700'
            : selected
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-border bg-surface',
        readOnly ? 'cursor-default' : 'hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
    ].join(' ');
    if (readOnly) {
        return (<div className={classes}>{content}</div>);
    }
    return (<button type="button" onClick={onClick} aria-pressed={selected} className={classes}>
      {content}
    </button>);
}
export function WalletTransferDialog({ isOpen, onClose, amount, setAmount, source, setSource, destination, setDestination, notes, setNotes, onMax, onSwap, onConfirm, isInvalid, isSaving, caisseBalance, baridiBalance, title, subtitle, amountLabel, fromLabel, toLabel, sourceLabel, destinationLabel, notesOptionalLabel, sameAccountErrorText, processingText, confirmText }: WalletTransferDialogProps) {
    const { t } = useLanguage();
    const destinationWallet = getOppositeWallet(source);
    React.useEffect(() => {
        if (isOpen && destination !== destinationWallet) {
            setDestination(destinationWallet);
        }
    }, [isOpen, destination, destinationWallet, setDestination]);
    const handleSourceChange = (nextSource: InternalWallet) => {
        setSource(nextSource);
        setDestination(getOppositeWallet(nextSource));
    };
    // Display only: the wallet names in the page language, why Confirm is off, and the amount kept
    // visible at the bottom. The confirm rule itself (isInvalid) comes from MainApp unchanged.
    const walletName = (wallet: InternalWallet) => (wallet === 'Caisse' ? t('transactions.cash') : t('transactions.baridi')) as string;
    const typedAmount = parseAndEvaluate(amount);
    const hasAmount = !!amount && Number.isFinite(typedAmount) && typedAmount > 0;
    const blockedReason = !isInvalid || isSaving
        ? undefined
        : source === destination
            ? sameAccountErrorText
            : !hasAmount
                ? t('transactions.enterValidAmount') as string
                : typedAmount > walletBalance(source, caisseBalance, baridiBalance)
                    ? t('formErrors.insufficientBalance') as string
                    : undefined;
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{title}</ModalTitle>
        <ModalDescription>{subtitle}</ModalDescription>
      </ModalHeader>
      <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
        <FormCard>
          <MoneyField label={amountLabel} value={amount} onChange={setAmount} currency="DZD" placeholder="0.00" onMax={onMax}/>
        </FormCard>

        <FormCard>
          <div>
            <Label>{fromLabel}</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <WalletChoiceCard wallet="Caisse" name={walletName('Caisse')} balance={caisseBalance} selected={source === 'Caisse'} onClick={() => handleSourceChange('Caisse')}/>
              <WalletChoiceCard wallet="BaridiMob" name={walletName('BaridiMob')} balance={baridiBalance} selected={source === 'BaridiMob'} onClick={() => handleSourceChange('BaridiMob')}/>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-px flex-1 bg-border"/>
            <button type="button" onClick={onSwap} className="inline-flex h-touch w-touch items-center justify-center rounded-full border border-border bg-surface text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-light" title={t('transactions.swapWallets') as string} aria-label={t('transactions.swapWallets') as string}>
              <ArrowRightLeftIcon aria-hidden="true" className="h-4 w-4 rotate-90"/>
            </button>
            <span aria-hidden="true" className="h-px flex-1 bg-border"/>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <Label>{toLabel}</Label>
              <span className="text-xs font-medium text-neutral-500">{t('transactions.automatic')}</span>
            </div>
            <div className="mt-2">
              <WalletChoiceCard wallet={destinationWallet} name={walletName(destinationWallet)} balance={walletBalance(destinationWallet, caisseBalance, baridiBalance)} readOnly helperText={destinationLabel}/>
            </div>
            {source === destination && (<p className="mt-1 text-xs font-medium text-danger">{sameAccountErrorText}</p>)}
          </div>

          {(() => {
            const amt = parseAndEvaluate(amount);
            if (!Number.isFinite(amt) || amt <= 0 || source === destination)
                return null;
            const sourceBalance = source === 'Caisse' ? caisseBalance : baridiBalance;
            const destBalance = destinationWallet === 'Caisse' ? caisseBalance : baridiBalance;
            const nextSource = sourceBalance - amt;
            const nextDest = destBalance + amt;
            const insufficient = nextSource < 0;
            const rows: PreviewRow[] = [
                { label: walletName(source), value: nextSource, currency: 'DZD', semantic: insufficient ? 'loss' : 'auto' },
                { label: walletName(destinationWallet), value: nextDest, currency: 'DZD', semantic: 'profit' }
            ];
            return (<TransactionPreviewCard title={t('transactions.afterTransferSummary') as string} rows={rows} error={insufficient ? t('formErrors.insufficientBalance') as string : undefined}/>);
        })()}
        </FormCard>
      </ModalContent>
      <OperationFooter stats={hasAmount ? [{ label: amountLabel, value: formatMoney(typedAmount, 'DZD') }] : []} reason={blockedReason} reasonTone={hasAmount ? 'fix' : 'missing'}>
        <Button onClick={onClose} variant="outline">
          {t('common.cancel')}
        </Button>
        <Button onClick={onConfirm} disabled={isInvalid}>
          {isSaving ? processingText : confirmText}
        </Button>
      </OperationFooter>
    </Modal>);
}
type DateFilterDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    startDate: string;
    setStartDate: (value: string) => void;
    endDate: string;
    setEndDate: (value: string) => void;
    onClear: () => void;
    onApply: () => void;
    title: string;
    startLabel: string;
    endLabel: string;
    clearLabel: string;
    applyLabel: string;
};
export function DateFilterDialog({ isOpen, onClose, startDate, setStartDate, endDate, setEndDate, onClear, onApply, title, startLabel, endLabel, clearLabel, applyLabel }: DateFilterDialogProps) {
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
      <ModalHeader onClose={onClose}>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      <ModalContent className="px-6 pb-6 space-y-4">
        <div>
          <Label>{startLabel}</Label>
          <DatePicker value={startDate} onChange={setStartDate} className="mt-1"/>
        </div>
        <div>
          <Label>{endLabel}</Label>
          <DatePicker value={endDate} onChange={setEndDate} className="mt-1"/>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button onClick={onClear} variant="outline" className="w-full">{clearLabel}</Button>
        <Button onClick={onApply} className="w-full">{applyLabel}</Button>
      </ModalFooter>
    </Modal>);
}
type ClientOption = {
    id: string;
    label: string;
};
type ClientTransferDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    fromClientId: string;
    setFromClientId: (value: string) => void;
    toClientId: string;
    setToClientId: (value: string) => void;
    amount: string;
    setAmount: (value: string) => void;
    notes: string;
    setNotes: (value: string) => void;
    onSave: () => void;
    isSaving: boolean;
    clients: ClientOption[];
    fromBalance: number;
    toBalance: number;
    onMaxFrom: () => void;
    title: string;
    infoText: string;
    fromLabel: string;
    toLabel: string;
    amountLabel: string;
    notesLabel: string;
    filterClientsLabel: string;
    balanceLabel: string;
    dinarLabel: string;
    confirmLabel: string;
    date?: string;
    setDate?: (value: string) => void;
    time?: string;
    setTime?: (value: string) => void;
    dateLabel?: string;
    timeLabel?: string;
    maxDisabled?: boolean;
};
export function ClientTransferDialog({ isOpen, onClose, fromClientId, setFromClientId, toClientId, setToClientId, amount, setAmount, notes, setNotes, onSave, isSaving, clients, fromBalance, toBalance, onMaxFrom, title, infoText, fromLabel, toLabel, amountLabel, notesLabel, filterClientsLabel, balanceLabel, dinarLabel, confirmLabel, date, setDate, time, setTime, dateLabel, timeLabel, maxDisabled = false }: ClientTransferDialogProps) {
    const { t } = useLanguage();
    const amt = parseAndEvaluate(amount);
    const sameClient = fromClientId && toClientId && fromClientId === toClientId;
    const invalid = isSaving
        || !fromClientId
        || !toClientId
        || sameClient
        || !Number.isFinite(amt)
        || amt <= 0;
    // Display only: why Confirm is off, said next to the button instead of in a hidden tooltip.
    const hasAmount = Number.isFinite(amt) && amt > 0;
    const blockedReason = !invalid || isSaving
        ? undefined
        : sameClient
            ? t('formErrors.sameClient') as string
            : (!fromClientId || !toClientId)
                ? t('formErrors.selectBothClients') as string
                : t('transactions.enterValidAmount') as string;
    const clientOptions = clients.map((client) => ({ value: client.id, label: client.label }));
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{title}</ModalTitle>
        <ModalDescription>{infoText}</ModalDescription>
      </ModalHeader>
      <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
        <FormCard>
        <div>
          <Label>{fromLabel}</Label>
          <div className="mt-1">
            <SearchableSelect value={fromClientId} onChange={setFromClientId} options={clientOptions} fieldClassName={sameClient ? 'border-danger ring-1 ring-danger' : ''} searchPlaceholder={t('transactions.searchClient') as string} emptyOptionLabel={`-- ${filterClientsLabel} --`} emptyValue="" noResultsLabel={t('transactions.noClientFound') as string} clearable clearLabel={t('transactions.clearSourceClient') as string}/>
          </div>
          {fromClientId && (<p className="mt-1 text-xs text-neutral-500">
              {balanceLabel}: <span dir="ltr" className="font-semibold tabular-nums text-neutral-700">{formatMoney(fromBalance, 'DZD')}</span>
            </p>)}
        </div>
        <div>
          <Label>{toLabel}</Label>
          <div className="mt-1">
            <SearchableSelect value={toClientId} onChange={setToClientId} options={clientOptions} fieldClassName={sameClient ? 'border-danger ring-1 ring-danger' : ''} searchPlaceholder={t('transactions.searchClient') as string} emptyOptionLabel={`-- ${filterClientsLabel} --`} emptyValue="" noResultsLabel={t('transactions.noClientFound') as string} clearable clearLabel={t('transactions.clearTargetClient') as string}/>
          </div>
          {toClientId && (<p className="mt-1 text-xs text-neutral-500">
              {balanceLabel}: <span dir="ltr" className="font-semibold tabular-nums text-neutral-700">{formatMoney(toBalance, 'DZD')}</span>
            </p>)}
          {sameClient && (<p className="mt-1 text-xs font-medium text-danger">{t('formErrors.sameClient')}</p>)}
        </div>
        </FormCard>
        <FormCard>
        <MoneyField label={amountLabel} value={amount} onChange={setAmount} currency="DZD" onMax={fromClientId ? onMaxFrom : undefined} maxLabel="MAX" maxDisabled={maxDisabled}/>
        {setDate && setTime && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{dateLabel || 'Date'}</Label>
              <div className="mt-1">
                <DatePicker value={date ?? ''} onChange={setDate} ariaLabel={dateLabel || 'Date'}/>
              </div>
            </div>
            <div>
              <Label>{timeLabel || 'Heure'}</Label>
              <div className="mt-1">
                <Input value={time ?? ''} onChange={(e) => setTime(e.target.value)} placeholder="HH:mm" type="time"/>
              </div>
            </div>
          </div>
        )}
        {(() => {
            const amt = parseAndEvaluate(amount);
            if (!fromClientId || !toClientId || fromClientId === toClientId)
                return null;
            if (!Number.isFinite(amt) || amt <= 0)
                return null;
            const nextFrom = fromBalance + amt;
            const nextTo = toBalance - amt;
            const rows: PreviewRow[] = [
                { label: fromLabel, value: nextFrom, currency: 'DZD', semantic: 'profit' },
                { label: toLabel, value: nextTo, currency: 'DZD', semantic: 'auto' }
            ];
            return (<TransactionPreviewCard title={t('transactions.afterTransferSummary') as string} rows={rows}/>);
        })()}
        </FormCard>
      </ModalContent>
      <OperationFooter stats={hasAmount ? [{ label: amountLabel, value: formatMoney(amt, 'DZD') }] : []} reason={blockedReason} reasonTone={sameClient ? 'fix' : 'missing'}>
        <Button onClick={onClose} variant="outline">
          {t('common.cancel')}
        </Button>
        <Button onClick={onSave} disabled={invalid} loading={isSaving} title={blockedReason}>
          {confirmLabel}
        </Button>
      </OperationFooter>
    </Modal>);
}
type TreasuryBalanceEditDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    asset: 'Caisse' | 'BaridiMob';
    value: string;
    onValueChange: (value: string) => void;
    onValueBlur: () => void;
    notes: string;
    setNotes: (value: string) => void;
    onSave: () => void;
    /** The whole title in the page language, e.g. "Modifier Solde Caisse". */
    title: string;
    descriptionText: string;
    newBalanceLabel: string;
    notesOptionalLabel: string;
    reasonPlaceholder: string;
    saveLabel: string;
    cancelLabel: string;
};
export function TreasuryBalanceEditDialog({ isOpen, onClose, value, onValueChange, onValueBlur, notes, setNotes, onSave, title, descriptionText, newBalanceLabel, notesOptionalLabel, reasonPlaceholder, saveLabel, cancelLabel }: TreasuryBalanceEditDialogProps) {
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-sm bg-surface text-neutral-900">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{title}</ModalTitle>
        <p className="mt-0.5 text-sm font-normal text-neutral-500">{descriptionText}</p>
      </ModalHeader>
      <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
        <MoneyField label={newBalanceLabel} value={value} onChange={onValueChange} onBlur={onValueBlur} currency="DZD"/>
        <Input label={notesOptionalLabel} value={notes} onChange={e => setNotes(e.target.value)} placeholder={reasonPlaceholder}/>
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>{cancelLabel}</Button>
        <Button type="button" onClick={onSave}>{saveLabel}</Button>
      </ModalFooter>
    </Modal>);
}
type PortfolioBalanceEditDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    asset: 'USDT' | 'EUR';
    value: string;
    onValueChange: (value: string) => void;
    onValueBlur: () => void;
    notes: string;
    setNotes: (value: string) => void;
    onSave: () => void;
    isSaving: boolean;
    titlePrefix: string;
    descriptionText: string;
    newBalanceLabel: string;
    notesOptionalLabel: string;
    reasonPlaceholder: string;
    saveLabel: string;
    savingLabel: string;
    cancelLabel: string;
};
export function PortfolioBalanceEditDialog({ isOpen, onClose, asset, value, onValueChange, onValueBlur, notes, setNotes, onSave, isSaving, titlePrefix, descriptionText, newBalanceLabel, notesOptionalLabel, reasonPlaceholder, saveLabel, savingLabel, cancelLabel }: PortfolioBalanceEditDialogProps) {
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-sm bg-surface text-neutral-900">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{titlePrefix} {asset}</ModalTitle>
        <p className="mt-0.5 text-sm font-normal text-neutral-500">{descriptionText}</p>
      </ModalHeader>
      <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
        <MoneyField label={newBalanceLabel} value={value} onChange={onValueChange} onBlur={onValueBlur} currency={asset} placeholder="0"/>
        <Input label={notesOptionalLabel} value={notes} onChange={e => setNotes(e.target.value)} placeholder={reasonPlaceholder}/>
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>{cancelLabel}</Button>
        <Button type="button" onClick={onSave} loading={isSaving}>{isSaving ? savingLabel : saveLabel}</Button>
      </ModalFooter>
    </Modal>);
}
