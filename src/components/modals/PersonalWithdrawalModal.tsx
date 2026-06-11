import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { MoneyField } from '../ui/MoneyField';
import { DatePicker } from '../ui/DatePicker';
import { CurrencyAmount } from '../financial/CurrencyAmount';

import { Tabs } from '../ui/Tabs';
import { InfoIcon } from '../icons/InfoIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { parseAndEvaluate } from '../../utils';
import type { TreasuryTx } from '../../types';

interface PersonalWithdrawalModalProps {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    amount: string;
    setAmount: (v: string) => void;
    method: 'Caisse' | 'BaridiMob';
    setMethod: (v: 'Caisse' | 'BaridiMob') => void;
    date: string;
    setDate: (v: string) => void;
    note: string;
    setNote: (v: string) => void;
    mode: 'expense' | 'advance';
    setMode: (v: 'expense' | 'advance') => void;
    treasuryStats: {
        caisse: number;
        baridi: number;
    };
    managerAvailableProfit: number;
    managerExists: boolean;
    editingTx?: TreasuryTx | null;
    onSave: () => void;
}

export function PersonalWithdrawalModal({
    isOpen,
    onClose,
    isSaving,
    amount,
    setAmount,
    method,
    setMethod,
    date,
    setDate,
    note,
    setNote,
    mode,
    setMode,
    treasuryStats,
    managerAvailableProfit,
    managerExists,
    editingTx = null,
    onSave,
}: PersonalWithdrawalModalProps) {
    const { t } = useLanguage();
    const currentSourceCredit = editingTx?.source === method ? Number(editingTx.amount || 0) : 0;
    const availableBalance = (method === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi) + currentSourceCredit;
    const parsedAmountRaw = parseAndEvaluate(amount);
    const parsedAmount = Number.isFinite(parsedAmountRaw) ? parsedAmountRaw : 0;
    const currentExpenseCredit = editingTx && editingTx.advanceState !== 'pending'
        ? Number(editingTx.settledAmount ?? editingTx.amount ?? 0)
        : 0;
    const exceedsProfit = mode === 'expense' && parsedAmount > managerAvailableProfit + currentExpenseCredit + 0.005;
    const exceedsBalance = parsedAmount > availableBalance + 0.005;
    const hasError = !managerExists || (parsedAmount > 0 && (exceedsProfit || exceedsBalance));
    const errorTitle = !managerExists
        ? 'Aucun gérant défini. Désignez un investisseur comme gérant.'
        : exceedsProfit
            ? 'Depasse ton profit disponible'
            : exceedsBalance
                ? `Solde ${method} insuffisant`
                : undefined;
    const errorMessage = !managerExists ? errorTitle : exceedsProfit ? (
        <span className="inline-flex flex-wrap items-center gap-1">
            Depasse ton profit disponible
            <CurrencyAmount value={managerAvailableProfit} currency="DZD" semantic="plain" size="sm" decimals={0}/>
        </span>
    ) : exceedsBalance ? (
        <span className="inline-flex flex-wrap items-center gap-1">
            Solde {method} insuffisant
            <CurrencyAmount value={availableBalance} currency="DZD" semantic="plain" size="sm" decimals={0}/>
        </span>
    ) : undefined;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
            <ModalHeader onClose={onClose} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                <ModalTitle className="text-base sm:text-lg">
                    {editingTx ? 'Modifier le prelevement' : 'Mon prelevement'}
                </ModalTitle>
                <p className="mt-0.5 text-sm font-normal text-neutral-500">
                    {mode === 'advance'
                        ? 'Avance - a regulariser plus tard'
                        : 'Depense personnelle deduite de ton profit'}
                </p>
            </ModalHeader>

            <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                <Tabs
                    tabs={[
                        { id: 'expense', label: 'Depense directe' },
                        { id: 'advance', label: 'Avance' },
                    ]}
                    activeTab={mode}
                    onChange={(next) => setMode(next as 'expense' | 'advance')}
                    variant="pills"
                />

                <MoneyField
                    label="Montant"
                    value={amount}
                    onChange={setAmount}
                    currency="DZD"
                    hint={(
                        <span className="inline-flex flex-wrap items-center gap-1">
                            {mode === 'advance' ? 'Deduit du profit a la regularisation' : 'Ton profit dispo:'}
                            {mode !== 'advance' && (
                                <CurrencyAmount value={managerAvailableProfit} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                            )}
                            <span>· {method}:</span>
                            <CurrencyAmount value={availableBalance} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                        </span>
                    )}
                    error={errorMessage}
                    placeholder="0"
                />

                <div>
                    <Label>Source</Label>
                    <Tabs
                        tabs={[
                            { id: 'Caisse', label: t('transactions.cash') },
                            { id: 'BaridiMob', label: t('transactions.baridi') },
                        ]}
                        activeTab={method}
                        onChange={(next) => setMethod(next as 'Caisse' | 'BaridiMob')}
                        variant="pills"
                        className="mt-1"
                    />
                </div>

                <div>
                    <Label>Date</Label>
                    <DatePicker value={date} onChange={setDate} className="mt-1" />
                </div>

                <Input
                    label="Pour quoi ?"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Ex: Carburant, Cafe, Restaurant..."
                />

                <div className={[
                    'flex items-start gap-2 rounded-lg p-3 text-xs',
                    mode === 'advance' ? 'bg-warning-bg text-warning' : 'bg-info-bg text-info',
                ].join(' ')}>
                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                        {mode === 'advance'
                            ? 'Tu pourras regulariser plus tard en saisissant le montant reellement depense. Le reste sera retourne automatiquement.'
                            : 'Sera deduit de ton profit disponible uniquement. Les autres investisseurs ne sont pas affectes.'}
                    </p>
                </div>
            </ModalContent>

            <ModalFooter className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                <div className="flex w-full gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="button"
                        className="flex-1"
                        onClick={onSave}
                        disabled={hasError || parsedAmount <= 0}
                        loading={isSaving}
                        title={errorTitle}
                    >
                        {isSaving ? t('common.processing') : (editingTx ? 'Mettre a jour' : (mode === 'advance' ? "Prendre l'avance" : 'Enregistrer'))}
                    </Button>
                </div>
            </ModalFooter>
        </Modal>
    );
}
