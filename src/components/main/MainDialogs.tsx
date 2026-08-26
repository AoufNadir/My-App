import React from 'react';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { MoneyField } from '../ui/MoneyField';
import { DatePicker } from '../ui/DatePicker';
import { TransactionPreviewCard, type PreviewRow } from '../ui/TransactionPreviewCard';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ArrowRightLeftIcon } from '../icons/ArrowRightLeftIcon';
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
      <ModalHeader onClose={onClose} className="border-b border-border px-4 py-3">
        <ModalTitle className="text-base">{title}</ModalTitle>
      </ModalHeader>
      <ModalContent className="p-4 space-y-3">
        <div className="relative">
          <Input value={query} onChange={(e) => { setQuery(e.target.value); }} placeholder={placeholder} autoFocus className="pe-16"/>
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-neutral-400 hidden sm:block">
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
                  <div className="sticky top-0 z-10 bg-surface-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-border">
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
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${group.color}`}>
                              {group.label}
                            </span>
                          </div>
                        </button>);
                })}
                  </div>
                </div>))}
            </div>)}
        </div>
        {results.length > 0 && (<p className="text-center text-[10px] text-neutral-400">
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
export function WalletTransferDialog({ isOpen, onClose, amount, setAmount, source, setSource, destination, setDestination, notes, setNotes, onMax, onSwap, onConfirm, isInvalid, isSaving, caisseBalance, baridiBalance, title, subtitle, amountLabel, fromLabel, toLabel, sourceLabel, destinationLabel, notesOptionalLabel, sameAccountErrorText, processingText, confirmText }: WalletTransferDialogProps) {
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
      <ModalHeader onClose={onClose} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
        <ModalTitle className="text-base sm:text-lg">{title}</ModalTitle>
        <p className="mt-0.5 text-sm font-normal text-neutral-500">{subtitle}</p>
      </ModalHeader>
      <ModalContent className="px-4 py-4 sm:px-5 space-y-4">
        <MoneyField label={amountLabel} value={amount} onChange={setAmount} currency="DZD" placeholder="0.00" onMax={onMax} maxDisabled={(source === 'Caisse' ? caisseBalance : baridiBalance) <= 0}/>

        <div className="space-y-3">
          <div>
            <Label>{fromLabel}</Label>
            <Select value={source} onChange={e => setSource(e.target.value as 'Caisse' | 'BaridiMob')} className="mt-1">
              <option value="Caisse">Caisse — {formatMoney(caisseBalance, 'DZD')}</option>
              <option value="BaridiMob">BaridiMob — {formatMoney(baridiBalance, 'DZD')}</option>
            </Select>
          </div>

          <div className="flex justify-center">
            <button type="button" onClick={onSwap} className="min-h-touch min-w-touch rounded-full bg-neutral-100 p-2 text-primary transition-colors hover:bg-neutral-200" title="Swap source and destination" aria-label="Swap">
              <ArrowRightLeftIcon className="w-4 h-4 rotate-90"/>
            </button>
          </div>

          <div>
            <Label>{toLabel}</Label>
            <Select value={destination} onChange={e => setDestination(e.target.value as 'Caisse' | 'BaridiMob')} className="mt-1">
              <option value="BaridiMob">BaridiMob — {formatMoney(baridiBalance, 'DZD')}</option>
              <option value="Caisse">Caisse — {formatMoney(caisseBalance, 'DZD')}</option>
            </Select>
            {source === destination && (<p className="mt-1 text-xs text-danger">{sameAccountErrorText}</p>)}
          </div>
        </div>

        {(() => {
            const amt = parseAndEvaluate(amount);
            if (!Number.isFinite(amt) || amt <= 0 || source === destination)
                return null;
            const sourceBalance = source === 'Caisse' ? caisseBalance : baridiBalance;
            const destBalance = destination === 'Caisse' ? caisseBalance : baridiBalance;
            const nextSource = sourceBalance - amt;
            const nextDest = destBalance + amt;
            const insufficient = nextSource < 0;
            const rows: PreviewRow[] = [
                { label: source, value: nextSource, currency: 'DZD', semantic: insufficient ? 'loss' : 'auto' },
                { label: destination, value: nextDest, currency: 'DZD', semantic: 'profit' }
            ];
            return (<TransactionPreviewCard title="Résumé après transfert" rows={rows} error={insufficient ? 'Solde insuffisant' : undefined}/>);
        })()}
      </ModalContent>
      <ModalFooter className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex gap-2 w-full">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={isInvalid} className="flex-1">
            {isSaving ? processingText : confirmText}
          </Button>
        </div>
      </ModalFooter>
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
    onMaxFrom?: () => void;
    title: string;
    infoText: string;
    fromLabel: string;
    toLabel: string;
    amountLabel: string;
    notesLabel: string;
    filterClientsLabel: string;
    balanceLabel: string;
    dinarLabel: string;
    sourceStatusLabel: string;
    destinationStatusLabel: string;
    owesProjectLabel: string;
    clientAdvanceLabel: string;
    settledLabel: string;
    transferPreviewLabel: string;
    confirmLabel: string;
};
const getTransferBalanceStatus = (balance: number, labels: {
    owesProjectLabel: string;
    clientAdvanceLabel: string;
    settledLabel: string;
}) => balance < -0.005
    ? labels.owesProjectLabel
    : balance > 0.005
        ? labels.clientAdvanceLabel
        : labels.settledLabel;
export function ClientTransferDialog({ isOpen, onClose, fromClientId, setFromClientId, toClientId, setToClientId, amount, setAmount, notes, setNotes, onSave, isSaving, clients, fromBalance, toBalance, title, infoText, fromLabel, toLabel, amountLabel, notesLabel, filterClientsLabel, balanceLabel, dinarLabel, sourceStatusLabel, destinationStatusLabel, owesProjectLabel, clientAdvanceLabel, settledLabel, transferPreviewLabel, confirmLabel }: ClientTransferDialogProps) {
    const statusLabels = { owesProjectLabel, clientAdvanceLabel, settledLabel };
    const renderBalancePreview = (label: string, before: number, after: number) => (<div className="rounded-xl border border-border bg-surface px-3 py-2">
        <p className="text-sm font-semibold text-neutral-900">{label}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-neutral-700" dir="ltr">{formatMoney(before, 'DZD')}</span>
          <span className="text-neutral-400">-&gt;</span>
          <span className="font-bold text-primary" dir="ltr">{formatMoney(after, 'DZD')}</span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{getTransferBalanceStatus(after, statusLabels)}</p>
      </div>);
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
      <ModalHeader onClose={onClose} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
        <ModalTitle className="text-base sm:text-lg">{title}</ModalTitle>
        <p className="mt-0.5 text-sm font-normal text-neutral-500">{infoText}</p>
      </ModalHeader>
      <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
        <div>
          <Label>{fromLabel}</Label>
          <div className="mt-1">
            <SearchableSelect value={fromClientId} onChange={setFromClientId} options={clients.map((client) => ({ value: client.id, label: client.label }))} fieldClassName="" searchPlaceholder="Rechercher un client..." emptyOptionLabel={`-- ${filterClientsLabel} --`} emptyValue="" noResultsLabel="Aucun client trouvé" clearable clearLabel="Supprimer le client source"/>
          </div>
          {fromClientId && (<p className="mt-1 text-xs text-neutral-500">
              {balanceLabel}: {formatMoney(fromBalance, 'DZD')}
            </p>)}
        </div>
        <div>
          <Label>{toLabel}</Label>
          <div className="mt-1">
            <SearchableSelect value={toClientId} onChange={setToClientId} options={clients.map((client) => ({ value: client.id, label: client.label }))} fieldClassName="" searchPlaceholder="Rechercher un client..." emptyOptionLabel={`-- ${filterClientsLabel} --`} emptyValue="" noResultsLabel="Aucun client trouvé" clearable clearLabel="Supprimer le client destination"/>
          </div>
          {toClientId && (<p className="mt-1 text-xs text-neutral-500">
              {balanceLabel}: {formatMoney(toBalance, 'DZD')}
            </p>)}
        </div>
        <MoneyField label={amountLabel} value={amount} onChange={setAmount} currency="DZD" hint={dinarLabel}/>
        {(() => {
            const amt = parseAndEvaluate(amount);
            if (!fromClientId || !toClientId || fromClientId === toClientId)
                return null;
            if (!Number.isFinite(amt) || amt <= 0)
                return null;
            const nextFrom = fromBalance + amt;
            const nextTo = toBalance - amt;
            return (<div className="rounded-2xl border border-border bg-surface-muted p-3">
              <p className="text-xs font-bold uppercase text-neutral-500">{transferPreviewLabel}</p>
              <div className="mt-2 space-y-2">
                {renderBalancePreview(sourceStatusLabel, fromBalance, nextFrom)}
                {renderBalancePreview(destinationStatusLabel, toBalance, nextTo)}
              </div>
            </div>);
        })()}
      </ModalContent>
      <ModalFooter className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
        {(() => {
            const amt = parseAndEvaluate(amount);
            const sameClient = fromClientId && toClientId && fromClientId === toClientId;
            const invalid = isSaving
                || !fromClientId
                || !toClientId
                || sameClient
                || !Number.isFinite(amt)
                || amt <= 0;
            const buttonLabel = sameClient
                ? 'Source = destination'
                : (!fromClientId || !toClientId)
                    ? 'Sélectionnez les deux clients'
                    : confirmLabel;
            return (<div className="flex gap-2 w-full">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Annuler
              </Button>
              <Button onClick={onSave} disabled={invalid} className="flex-1" title={invalid && !isSaving ? buttonLabel : undefined}>
                {invalid && !isSaving && (sameClient || (!fromClientId || !toClientId)) ? 'Confirmer' : buttonLabel}
              </Button>
            </div>);
        })()}
      </ModalFooter>
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
    titlePrefix: string;
    descriptionText: string;
    newBalanceLabel: string;
    dinarLabel: string;
    notesOptionalLabel: string;
    reasonPlaceholder: string;
    saveLabel: string;
};
export function TreasuryBalanceEditDialog({ isOpen, onClose, asset, value, onValueChange, onValueBlur, notes, setNotes, onSave, titlePrefix, descriptionText, newBalanceLabel, dinarLabel, notesOptionalLabel, reasonPlaceholder, saveLabel }: TreasuryBalanceEditDialogProps) {
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-sm bg-surface text-neutral-900">
      <ModalHeader onClose={onClose}>
        <ModalTitle>{titlePrefix} {asset}</ModalTitle>
      </ModalHeader>
      <ModalContent className="px-6 pb-6 space-y-4">
        <div className="mb-2 rounded-lg bg-primary/10 p-3 text-sm text-primary">
          {descriptionText}
        </div>
        <MoneyField label={`${newBalanceLabel} (${dinarLabel})`} value={value} onChange={onValueChange} onBlur={onValueBlur} currency="DZD"/>
        <Input label={notesOptionalLabel} value={notes} onChange={e => setNotes(e.target.value)} placeholder={reasonPlaceholder}/>
      </ModalContent>
      <ModalFooter>
        <Button onClick={onSave} className="w-full">{saveLabel}</Button>
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
};
export function PortfolioBalanceEditDialog({ isOpen, onClose, asset, value, onValueChange, onValueBlur, notes, setNotes, onSave, isSaving, titlePrefix, descriptionText, newBalanceLabel, notesOptionalLabel, reasonPlaceholder, saveLabel, savingLabel }: PortfolioBalanceEditDialogProps) {
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-sm bg-surface text-neutral-900">
      <ModalHeader onClose={onClose} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
        <ModalTitle className="text-base sm:text-lg">{titlePrefix} {asset}</ModalTitle>
        <p className="mt-0.5 text-sm font-normal text-neutral-500">{descriptionText}</p>
      </ModalHeader>
      <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
        <MoneyField label={newBalanceLabel} value={value} onChange={onValueChange} onBlur={onValueBlur} currency={asset} placeholder="0"/>
        <Input label={notesOptionalLabel} value={notes} onChange={e => setNotes(e.target.value)} placeholder={reasonPlaceholder}/>
      </ModalContent>
      <ModalFooter className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="button" className="flex-1" onClick={onSave} loading={isSaving}>{isSaving ? savingLabel : saveLabel}</Button>
        </div>
      </ModalFooter>
    </Modal>);
}
