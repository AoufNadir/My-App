import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { NumberInput } from '../ui/NumberInput';
import { ArrowRightLeftIcon } from '../icons/ArrowRightLeftIcon';

export type MainSearchResult =
  | { id: string; kind: 'client'; title: string; subtitle: string; clientId: string; timestamp: number }
  | { id: string; kind: 'transaction'; title: string; subtitle: string; timestamp: number };

type GlobalSearchDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  cardBase: string;
  isDark: boolean;
  fieldBase: string;
  subtleText: string;
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

export function GlobalSearchDialog({
  isOpen,
  onClose,
  cardBase,
  isDark,
  fieldBase,
  subtleText,
  query,
  setQuery,
  results,
  onSelectResult,
  title,
  placeholder,
  noResultsText,
  clientsText,
  transactionsText
}: GlobalSearchDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} className={`${cardBase} max-w-2xl`}>
      <DialogHeader onClose={onClose} isDark={isDark}>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogContent className="px-6 pb-6 space-y-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={fieldBase}
          placeholder={placeholder}
          autoFocus
        />
        <div className={`rounded-xl border max-h-[50vh] overflow-y-auto ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          {!query.trim() ? (
            <p className={`p-4 text-sm ${subtleText}`}>Ctrl+K</p>
          ) : results.length === 0 ? (
            <p className={`p-4 text-sm ${subtleText}`}>{noResultsText}</p>
          ) : (
            <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => onSelectResult(result)}
                  className={`w-full text-left p-3 transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{result.title}</p>
                      <p className={`text-xs mt-0.5 ${subtleText} truncate`}>{result.subtitle || '-'}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wide ${result.kind === 'client' ? (isDark ? 'bg-sky-900/50 text-sky-300' : 'bg-sky-100 text-sky-700') : (isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-700')}`}>
                      {result.kind === 'client' ? clientsText : transactionsText}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type WalletTransferDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  cardBase: string;
  isDark: boolean;
  subtleText: string;
  fieldBase: string;
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

export function WalletTransferDialog({
  isOpen,
  onClose,
  cardBase,
  isDark,
  subtleText,
  fieldBase,
  amount,
  setAmount,
  source,
  setSource,
  destination,
  setDestination,
  notes,
  setNotes,
  onMax,
  onSwap,
  onConfirm,
  isInvalid,
  isSaving,
  caisseBalance,
  baridiBalance,
  title,
  subtitle,
  amountLabel,
  fromLabel,
  toLabel,
  sourceLabel,
  destinationLabel,
  notesOptionalLabel,
  sameAccountErrorText,
  processingText,
  confirmText
}: WalletTransferDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} className={`${cardBase} max-w-sm`}>
      <DialogHeader onClose={onClose} isDark={isDark}>
        <DialogTitle>{title}</DialogTitle>
        <p className={`text-sm ${subtleText} mt-1 font-normal`}>{subtitle}</p>
      </DialogHeader>
      <DialogContent className="px-6 pb-6 space-y-4">
        <div>
          <Label>{amountLabel} (DZD)</Label>
          <div className="relative">
            <NumberInput
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={fieldBase}
              placeholder="0.00"
            />
            <button
              onClick={onMax}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-sky-600 text-white px-2 py-1 rounded hover:bg-sky-700 transition-colors font-bold"
            >
              MAX
            </button>
          </div>
        </div>

        <div>
          <Label>{fromLabel} ({sourceLabel})</Label>
          <Select
            value={source}
            onChange={e => setSource(e.target.value as 'Caisse' | 'BaridiMob')}
            className={fieldBase}
          >
            <option value="Caisse">Caisse - Solde: {caisseBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</option>
            <option value="BaridiMob">BaridiMob - Solde: {baridiBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</option>
          </Select>
        </div>

        <div className="flex justify-center -my-2 z-10 relative">
          <button
            onClick={onSwap}
            className={`p-2 rounded-full border shadow-sm transition-all hover:scale-110 active:scale-95 ${isDark ? 'bg-slate-800 border-slate-600 text-sky-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-sky-600 hover:bg-slate-50'}`}
            title="Swap source and destination"
          >
            <ArrowRightLeftIcon className="w-4 h-4 rotate-90 sm:rotate-0" />
          </button>
        </div>

        <div>
          <Label>{toLabel} ({destinationLabel})</Label>
          <Select
            value={destination}
            onChange={e => setDestination(e.target.value as 'Caisse' | 'BaridiMob')}
            className={fieldBase}
          >
            <option value="BaridiMob">BaridiMob - Solde: {baridiBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</option>
            <option value="Caisse">Caisse - Solde: {caisseBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</option>
          </Select>
          {source === destination && (
            <p className="text-xs text-red-500 mt-1">{sameAccountErrorText}</p>
          )}
        </div>

        <div>
          <Label>{notesOptionalLabel}</Label>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={fieldBase}
            placeholder="Note..."
          />
        </div>
      </DialogContent>
      <DialogFooter>
        <Button
          onClick={onConfirm}
          disabled={isInvalid}
          className={`w-full font-bold py-3 rounded-xl shadow-md transition-all ${isInvalid
            ? 'bg-gray-400 cursor-not-allowed opacity-70'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
        >
          {isSaving ? processingText : confirmText}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

type DateFilterDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  cardBase: string;
  isDark: boolean;
  fieldBase: string;
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

export function DateFilterDialog({
  isOpen,
  onClose,
  cardBase,
  isDark,
  fieldBase,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onClear,
  onApply,
  title,
  startLabel,
  endLabel,
  clearLabel,
  applyLabel
}: DateFilterDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} className={`${cardBase} max-w-md`}>
      <DialogHeader onClose={onClose} isDark={isDark}>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogContent className="px-6 pb-6 space-y-4">
        <div>
          <Label>{startLabel}</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fieldBase} />
        </div>
        <div>
          <Label>{endLabel}</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={fieldBase} />
        </div>
      </DialogContent>
      <DialogFooter>
        <Button onClick={onClear} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>{clearLabel}</Button>
        <Button onClick={onApply} className="w-full bg-sky-600 text-white">{applyLabel}</Button>
      </DialogFooter>
    </Dialog>
  );
}

type ClientOption = {
  id: string;
  label: string;
};

type ClientTransferDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  cardBase: string;
  isDark: boolean;
  subtleText: string;
  fieldBase: string;
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
};

export function ClientTransferDialog({
  isOpen,
  onClose,
  cardBase,
  isDark,
  subtleText,
  fieldBase,
  fromClientId,
  setFromClientId,
  toClientId,
  setToClientId,
  amount,
  setAmount,
  notes,
  setNotes,
  onSave,
  isSaving,
  clients,
  fromBalance,
  toBalance,
  onMaxFrom,
  title,
  infoText,
  fromLabel,
  toLabel,
  amountLabel,
  notesLabel,
  filterClientsLabel,
  balanceLabel,
  dinarLabel,
  confirmLabel
}: ClientTransferDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} className={`${cardBase} max-w-lg`}>
      <DialogHeader onClose={onClose} isDark={isDark}><DialogTitle>{title}</DialogTitle></DialogHeader>
      <DialogContent className="px-6 pb-6 space-y-4">
        <div className="p-3 bg-sky-500/10 rounded-lg text-sm text-sky-600 dark:text-sky-400 mb-2">{infoText}</div>
        <div>
          <Label>{fromLabel}</Label>
          <Select value={fromClientId} onChange={e => setFromClientId(e.target.value)} className={fieldBase}>
            <option value="">-- {filterClientsLabel} --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          {fromClientId && (
            <p className={`text-xs mt-1 ${subtleText}`}>
              {balanceLabel} : {fromBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {dinarLabel}
            </p>
          )}
        </div>
        <div>
          <Label>{toLabel}</Label>
          <Select value={toClientId} onChange={e => setToClientId(e.target.value)} className={fieldBase}>
            <option value="">-- {filterClientsLabel} --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          {toClientId && (
            <p className={`text-xs mt-1 ${subtleText}`}>
              {balanceLabel} : {toBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {dinarLabel}
            </p>
          )}
        </div>
        <div>
          <Label>{amountLabel}</Label>
          <div className="relative">
            <NumberInput value={amount} onChange={e => setAmount(e.target.value)} className={fieldBase} />
            {fromClientId && (
              <button
                onClick={onMaxFrom}
                className="absolute right-2 top-2 text-xs bg-sky-600 text-white px-2 py-1 rounded hover:bg-sky-700 transition-colors"
              >
                Max
              </button>
            )}
          </div>
        </div>
        <div>
          <Label>{notesLabel}</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
        </div>
      </DialogContent>
      <DialogFooter>
        <Button onClick={onSave} disabled={isSaving} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl">{confirmLabel}</Button>
      </DialogFooter>
    </Dialog>
  );
}

type TreasuryBalanceEditDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  cardBase: string;
  isDark: boolean;
  fieldBase: string;
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

export function TreasuryBalanceEditDialog({
  isOpen,
  onClose,
  cardBase,
  isDark,
  fieldBase,
  asset,
  value,
  onValueChange,
  onValueBlur,
  notes,
  setNotes,
  onSave,
  titlePrefix,
  descriptionText,
  newBalanceLabel,
  dinarLabel,
  notesOptionalLabel,
  reasonPlaceholder,
  saveLabel
}: TreasuryBalanceEditDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} className={`${cardBase} max-w-sm`}>
      <DialogHeader onClose={onClose} isDark={isDark}>
        <DialogTitle>{titlePrefix} {asset}</DialogTitle>
      </DialogHeader>
      <DialogContent className="px-6 pb-6 space-y-4">
        <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-blue-600 dark:text-blue-400 mb-2">
          {descriptionText}
        </div>
        <div>
          <Label>{newBalanceLabel} ({dinarLabel})</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onBlur={onValueBlur}
            className={`${fieldBase} text-2xl font-bold text-center`}
          />
        </div>
        <div>
          <Label>{notesOptionalLabel}</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} placeholder={reasonPlaceholder} />
        </div>
      </DialogContent>
      <DialogFooter>
        <Button onClick={onSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">{saveLabel}</Button>
      </DialogFooter>
    </Dialog>
  );
}

type PortfolioBalanceEditDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  cardBase: string;
  isDark: boolean;
  fieldBase: string;
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

export function PortfolioBalanceEditDialog({
  isOpen,
  onClose,
  cardBase,
  isDark,
  fieldBase,
  asset,
  value,
  onValueChange,
  onValueBlur,
  notes,
  setNotes,
  onSave,
  isSaving,
  titlePrefix,
  descriptionText,
  newBalanceLabel,
  notesOptionalLabel,
  reasonPlaceholder,
  saveLabel,
  savingLabel
}: PortfolioBalanceEditDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} className={`${cardBase} max-w-sm`}>
      <DialogHeader onClose={onClose} isDark={isDark}>
        <DialogTitle>{titlePrefix} {asset}</DialogTitle>
      </DialogHeader>
      <DialogContent className="px-6 pb-6 space-y-4">
        <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-blue-600 dark:text-blue-400 mb-2">
          {descriptionText}
        </div>
        <div>
          <Label>{newBalanceLabel} ({asset})</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onBlur={onValueBlur}
            className={`${fieldBase} text-2xl font-bold text-center`}
          />
        </div>
        <div>
          <Label>{notesOptionalLabel}</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} placeholder={reasonPlaceholder} />
        </div>
      </DialogContent>
      <DialogFooter>
        <Button onClick={onSave} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">{isSaving ? savingLabel : saveLabel}</Button>
      </DialogFooter>
    </Dialog>
  );
}
