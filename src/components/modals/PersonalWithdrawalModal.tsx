import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { MoneyField } from '../ui/MoneyField';
import { DatePicker } from '../ui/DatePicker';
import { FormCard } from '../ui/FormCard';
import { OperationFooter, type OperationFooterStat } from '../ui/OperationFooter';
import { SegmentedControl } from '../ui/SegmentedControl';
import { CurrencyAmount } from '../financial/CurrencyAmount';

import { InfoIcon } from '../icons/InfoIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { parseAndEvaluate } from '../../utils';
import { formatMoney } from '../../pages/shared/pageFormat';
import { walletDisplayName } from '../../utils/formMessages';
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
    const methodName = walletDisplayName(method, t);
    const sourceInsufficient = String(t('personalWithdrawal.sourceInsufficient')).replace('{source}', methodName);
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

    // Display only: why Save is off (the same rule as the button), and the amount at the bottom.
    const isSaveDisabled = hasError || parsedAmount <= 0;
    const blockedReason = isSaveDisabled && !isSaving
        ? (errorTitle ? String(errorTitle) : String(t('transactions.enterValidAmount')))
        : undefined;
    const footerStats: OperationFooterStat[] = [];
    if (parsedAmount > 0) {
        footerStats.push({ label: t('personalWithdrawal.amount'), value: formatMoney(parsedAmount, currency, { min: currency === 'DZD' ? 0 : 2, max: 2 }), tone: 'loss' });
        if (preview && isAssetWallet(method))
            footerStats.push({ label: t('delivery.valueDzd'), value: formatMoney(preview.amountDzd, 'DZD', { min: 0, max: 0 }) });
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
            <ModalHeader onClose={onClose}>
                <ModalTitle className="text-base sm:text-lg">
                    {editingTx ? t('personalWithdrawal.editTitle') : t('personalWithdrawal.title')}
                </ModalTitle>
                <ModalDescription>
                    {mode === 'advance'
                        ? t('personalWithdrawal.advanceSubtitle')
                        : t('personalWithdrawal.expenseSubtitle')}
                </ModalDescription>
            </ModalHeader>

            <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
                <FormCard>
                <SegmentedControl size="md" ariaLabel={t('personalWithdrawal.title') as string} value={mode} onChange={(next) => setMode(next as 'expense' | 'advance')} options={[
                    { id: 'expense', label: t('personalWithdrawal.expenseDirect'), tone: 'loss' },
                    { id: 'advance', label: t('personalWithdrawal.advance'), tone: 'debt' },
                ]}/>

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
                            <span>· {methodName}:</span>
                            <CurrencyAmount value={availableBalance} currency={currency} semantic="plain" size="sm" decimals={currency === 'DZD' ? 0 : 2}/>
                        </span>
                    )}
                    error={errorMessage}
                    currency={currency}
                    placeholder="0"
                />

                {mode === 'expense' && capitalDrawAmount > 0.005 && !exceedsCapital && parsedAmount > 0 && (
                    <div className="flex items-start gap-2 rounded-button bg-financial-debt-bg p-3 text-xs text-financial-debt">
                        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="inline-flex flex-wrap items-center gap-1">
                            <span>{t('personalWithdrawal.capitalWarning')}</span>
                            <CurrencyAmount value={capitalDrawAmount} currency="DZD" semantic="loss" size="sm" decimals={0}/>
                        </p>
                    </div>
                )}
                </FormCard>

                <FormCard>
                <div>
                    <Label>{t('personalWithdrawal.source')}</Label>
                    <SegmentedControl size="md" columns={2} ariaLabel={t('personalWithdrawal.source') as string} value={method} onChange={(next) => setMethod(next as FinancialWallet)} options={[
                        { id: 'Caisse', label: t('transactions.cash'), tone: 'primary' },
                        { id: 'BaridiMob', label: t('transactions.baridi'), tone: 'primary' },
                        { id: 'USDT', label: 'USDT', tone: 'primary' },
                        { id: 'EUR', label: 'EUR', tone: 'primary' },
                    ]}/>
                </div>

                {preview && isAssetWallet(method) && (
                    <div className="rounded-button bg-surface-muted p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-neutral-500">{t('delivery.valueDzd')}</span>
                            <CurrencyAmount value={preview.amountDzd} currency="DZD" semantic="loss" size="sm" decimals={0}/>
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                            {t('delivery.autoPma')}: <span dir="ltr" className="tabular-nums">{preview.rateToDzd.toFixed(2)} DZD</span>
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
                </FormCard>

                <div className={[
                    'flex items-start gap-2 rounded-card border p-3 text-xs leading-relaxed',
                    mode === 'advance' ? 'border-warning/30 bg-financial-debt-bg text-neutral-700' : 'border-info/25 bg-financial-asset-bg text-neutral-700',
                ].join(' ')}>
                    <InfoIcon className={`mt-0.5 h-4 w-4 shrink-0 ${mode === 'advance' ? 'text-financial-debt' : 'text-financial-asset'}`} />
                    <p>
                        {mode === 'advance'
                            ? t('personalWithdrawal.advanceInfo')
                            : t('personalWithdrawal.expenseInfo')}
                    </p>
                </div>
            </ModalContent>

            <OperationFooter stats={footerStats} reason={blockedReason} reasonTone={parsedAmount > 0 ? 'fix' : 'missing'}>
                <Button type="button" variant="outline" onClick={onClose}>
                    {t('common.cancel')}
                </Button>
                <Button
                    type="button"
                    onClick={onSave}
                    disabled={hasError || parsedAmount <= 0}
                    loading={isSaving}
                    title={blockedReason}
                >
                    {isSaving ? t('common.processing') : (editingTx ? t('investorDialog.update') : (mode === 'advance' ? t('personalWithdrawal.takeAdvance') : t('common.save')))}
                </Button>
            </OperationFooter>
        </Modal>
    );
}
