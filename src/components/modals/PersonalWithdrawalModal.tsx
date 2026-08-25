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
import type { PortfolioStats, TreasuryTx } from '../../types';
import type { FinancialWallet, ProjectExpensePreview } from '../../utils/digitalServiceAccounting';
import { getWalletCurrency, isAssetWallet } from '../../utils/digitalServiceAccounting';

interface PersonalWithdrawalModalProps {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    amount: string;
    setAmount: (v: string) => void;
    method: FinancialWallet;
    setMethod: (v: FinancialWallet) => void;
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
    portfolioStats: PortfolioStats;
    preview: ProjectExpensePreview | null;
    managerAvailableProfit: number;
    managerCapitalInvested: number;
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
    portfolioStats,
    preview,
    managerAvailableProfit,
    managerCapitalInvested,
    managerExists,
    editingTx = null,
    onSave,
}: PersonalWithdrawalModalProps) {
    const { t } = useLanguage();
    const currency = getWalletCurrency(method);
    const currentSourceCredit = (editingTx?.expenseWallet || editingTx?.source) === method
        ? Number(editingTx.originalAmount ?? editingTx.amount ?? 0)
        : 0;
    const availableBalance = (method === 'Caisse'
        ? treasuryStats.caisse
        : method === 'BaridiMob'
            ? treasuryStats.baridi
            : method === 'USDT'
                ? Number(portfolioStats.usdt.available || 0)
                : Number(portfolioStats.eur.available || 0)) + currentSourceCredit;
    const parsedAmountRaw = parseAndEvaluate(amount);
    const parsedAmount = Number.isFinite(parsedAmountRaw) ? parsedAmountRaw : 0;
    const parsedAmountDzd = preview?.amountDzd ?? parsedAmount;
    const currentProfitCredit = editingTx && editingTx.advanceState !== 'pending'
        ? Number(editingTx.profitAmountDzd ?? editingTx.settledAmount ?? editingTx.amount ?? 0)
        : 0;
    const currentCapitalCredit = editingTx && editingTx.advanceState !== 'pending'
        ? Number(editingTx.capitalAmountDzd ?? 0)
        : 0;
    const availableProfitForExpense = Math.max(0, managerAvailableProfit + currentProfitCredit);
    const capitalDrawAmount = mode === 'expense'
        ? Math.max(0, parsedAmountDzd - availableProfitForExpense)
        : 0;
    const availableCapitalForExpense = Math.max(0, managerCapitalInvested + currentCapitalCredit);
    const exceedsCapital = mode === 'expense' && capitalDrawAmount > availableCapitalForExpense + 0.005;
    const exceedsBalance = parsedAmount > availableBalance + 0.005;
    const hasError = !managerExists || (parsedAmount > 0 && (exceedsCapital || exceedsBalance));

    const handleExpenseMax = () => setAmount(availableBalance.toFixed(currency === 'DZD' ? 0 : 2));
    const handleAdvanceMax = () => setAmount(availableBalance.toFixed(currency === 'DZD' ? 0 : 2));

    const sourceInsufficient = String(t('personalWithdrawal.sourceInsufficient')).replace('{source}', method);
    const errorTitle = !managerExists
        ? t('personalWithdrawal.managerMissing')
        : exceedsCapital
            ? t('personalWithdrawal.capitalInsufficient')
            : exceedsBalance
                ? sourceInsufficient
                : undefined;
    const errorMessage = !managerExists ? errorTitle : exceedsCapital ? (
        <span className="inline-flex flex-wrap items-center gap-1">
            {t('personalWithdrawal.capitalInsufficient')}
            <CurrencyAmount value={availableCapitalForExpense} currency="DZD" semantic="plain" size="sm" decimals={0}/>
        </span>
    ) : exceedsBalance ? (
        <span className="inline-flex flex-wrap items-center gap-1">
            {sourceInsufficient}
            <CurrencyAmount value={availableBalance} currency={currency} semantic="plain" size="sm" decimals={currency === 'DZD' ? 0 : 2}/>
        </span>
    ) : undefined;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
            <ModalHeader onClose={onClose} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                <ModalTitle className="text-base sm:text-lg">
                    {editingTx ? t('personalWithdrawal.editTitle') : t('personalWithdrawal.title')}
                </ModalTitle>
                <p className="mt-0.5 text-sm font-normal text-neutral-500">
                    {mode === 'advance'
                        ? t('personalWithdrawal.advanceSubtitle')
                        : t('personalWithdrawal.expenseSubtitle')}
                </p>
            </ModalHeader>

            <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                <Tabs
                    tabs={[
                        { id: 'expense', label: t('personalWithdrawal.expenseDirect') },
                        { id: 'advance', label: t('personalWithdrawal.advance') },
                    ]}
                    activeTab={mode}
                    onChange={(next) => setMode(next as 'expense' | 'advance')}
                    variant="pills"
                />

                <MoneyField
                    label={t('personalWithdrawal.amount') as string}
                    value={amount}
                    onChange={setAmount}
                    hint={(
                        <span className="inline-flex flex-wrap items-center gap-1">
                            {mode === 'advance' ? t('personalWithdrawal.deductedLater') : `${t('personalWithdrawal.availableProfitHint')}:`}
                            {mode !== 'advance' && (
                                <CurrencyAmount value={availableProfitForExpense} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                            )}
                            <span>· {method}:</span>
                            <CurrencyAmount value={availableBalance} currency={currency} semantic="plain" size="sm" decimals={currency === 'DZD' ? 0 : 2}/>
                        </span>
                    )}
                    error={errorMessage}
                    currency={currency}
                    placeholder="0"
                    onMax={mode === 'expense' ? handleExpenseMax : handleAdvanceMax}
                />

                {mode === 'expense' && capitalDrawAmount > 0.005 && !exceedsCapital && parsedAmount > 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-warning-bg p-3 text-xs text-warning">
                        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="inline-flex flex-wrap items-center gap-1">
                            <span>{t('personalWithdrawal.capitalWarning')}</span>
                            <CurrencyAmount value={capitalDrawAmount} currency="DZD" semantic="loss" size="sm" decimals={0}/>
                        </p>
                    </div>
                )}

                <div>
                    <Label>{t('personalWithdrawal.source')}</Label>
                    <Tabs
                        tabs={[
                            { id: 'Caisse', label: t('transactions.cash') },
                            { id: 'BaridiMob', label: t('transactions.baridi') },
                            { id: 'USDT', label: 'USDT' },
                            { id: 'EUR', label: 'EUR' },
                        ]}
                        activeTab={method}
                        onChange={(next) => setMethod(next as FinancialWallet)}
                        variant="pills"
                        className="mt-1"
                    />
                </div>

                {preview && isAssetWallet(method) && (
                    <div className="rounded-xl bg-surface-muted p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-neutral-500">{t('delivery.valueDzd')}</span>
                            <CurrencyAmount value={preview.amountDzd} currency="DZD" semantic="loss" size="sm" decimals={0}/>
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                            {t('delivery.autoPma')}: {preview.rateToDzd.toFixed(2)} DZD
                        </div>
                    </div>
                )}

                <div>
                    <Label>{t('personalWithdrawal.date')}</Label>
                    <DatePicker value={date} onChange={setDate} className="mt-1" />
                </div>

                <Input
                    label={t('personalWithdrawal.purpose') as string}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t('personalWithdrawal.purposePlaceholder') as string}
                />

                <div className={[
                    'flex items-start gap-2 rounded-lg p-3 text-xs',
                    mode === 'advance' ? 'bg-warning-bg text-warning' : 'bg-info-bg text-info',
                ].join(' ')}>
                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                        {mode === 'advance'
                            ? t('personalWithdrawal.advanceInfo')
                            : t('personalWithdrawal.expenseInfo')}
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