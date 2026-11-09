import { FINANCIAL_WALLETS, WalletPicker, walletBalancesOf } from '../ui/WalletPicker';
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { MoneyField } from '../ui/MoneyField';
import { DatePicker } from '../ui/DatePicker';
import { Textarea } from '../ui/Textarea';
import { FormCard } from '../ui/FormCard';
import { OperationFooter, type OperationFooterStat } from '../ui/OperationFooter';
import { SegmentedControl } from '../ui/SegmentedControl';
import { CurrencyAmount } from '../financial/CurrencyAmount';

import { useLanguage } from '../../contexts/LanguageContext';
import { parseAndEvaluate } from '../../utils';
import { formatMoney } from '../../pages/shared/pageFormat';
import type { PortfolioStats } from '../../types';
import type { FinancialWallet, ProjectExpensePreview } from '../../utils/digitalServiceAccounting';
import { getWalletCurrency, isAssetWallet } from '../../utils/digitalServiceAccounting';

interface DeliveryExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    amount: string;
    setAmount: (v: string) => void;
    /** null: not chosen yet (V13-5) */
    method: FinancialWallet | null;
    setMethod: (v: FinancialWallet) => void;
    date: string;
    setDate: (v: string) => void;
    note: string;
    setNote: (v: string) => void;
    /** V12-12: who was paid; required */
    payee?: string;
    setPayee?: (v: string) => void;
    treasuryStats: {
        caisse: number;
        baridi: number;
    };
    portfolioStats: PortfolioStats;
    preview: ProjectExpensePreview | null;
    onSave: () => void;
}

export function DeliveryExpenseModal({
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
    payee = '',
    setPayee,
    treasuryStats,
    portfolioStats,
    preview,
    onSave,
}: DeliveryExpenseModalProps) {
    const { t } = useLanguage();
    // V13-5: no wallet until the owner picks one.
    const balances = walletBalancesOf(treasuryStats, portfolioStats);
    const currency = method ? getWalletCurrency(method) : 'DZD';
    const availableBalance = method ? Number(balances[method] || 0) : 0;

    // Display only: the amount checked against the chosen wallet like the save does (it still
    // alerts on its own), and the amount kept visible at the bottom.
    const typedAmount = parseAndEvaluate(amount);
    const hasAmount = Number.isFinite(typedAmount) && typedAmount > 0;
    const exceedsBalance = hasAmount && typedAmount > availableBalance + 0.005;
    const footerStats: OperationFooterStat[] = [];
    if (hasAmount) {
        footerStats.push({ label: t('delivery.amount'), value: formatMoney(typedAmount, currency, { min: currency === 'DZD' ? 0 : 2, max: 2 }), tone: 'loss' });
        if (preview && method && isAssetWallet(method))
            footerStats.push({ label: t('delivery.valueDzd'), value: formatMoney(preview.amountDzd, 'DZD', { min: 0, max: 0 }) });
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
            <ModalHeader onClose={onClose}>
                <ModalTitle className="text-base sm:text-lg">{t('delivery.title')}</ModalTitle>
                <ModalDescription>{t('delivery.description')}</ModalDescription>
            </ModalHeader>

            <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
                {setPayee && (<FormCard>
                    <Input label={t('delivery.payee') as string} value={payee} onChange={(event) => setPayee(event.target.value)} placeholder={t('delivery.payeePlaceholder') as string} autoComplete="off"/>
                    <p className="text-xs text-neutral-500">{t('delivery.payeeHint')}</p>
                </FormCard>)}
                <FormCard>
                <MoneyField
                    label={t('delivery.amount')}
                    value={amount}
                    onChange={setAmount}
                    currency={currency}
                    hint={(
                        <span className="inline-flex flex-wrap items-center gap-1">
                            {t('delivery.availableBalance')}:
                            <CurrencyAmount value={availableBalance} currency={currency} semantic="plain" size="sm" decimals={currency === 'DZD' ? 0 : 2}/>
                        </span>
                    )}
                    error={exceedsBalance ? (
                        <span className="inline-flex flex-wrap items-center gap-1">
                            {t('formErrors.insufficientBalance')} · {t('delivery.availableBalance')}:
                            <CurrencyAmount value={availableBalance} currency={currency} semantic="plain" size="sm" decimals={currency === 'DZD' ? 0 : 2}/>
                        </span>
                    ) : undefined}
                    placeholder="0"
                />

                <div>
                    <Label>{t('delivery.method')}</Label>
                    <WalletPicker value={method} onChange={(next) => setMethod(next as FinancialWallet)} wallets={FINANCIAL_WALLETS} labels={{ Caisse: t('transactions.cash') as string, BaridiMob: t('transactions.baridi') as string }} balances={balances} ariaLabel={t('delivery.method') as string} chooseLabel={t('transactions.walletChoose') as string}/>
                </div>

                {preview && method && isAssetWallet(method) && (
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
                </FormCard>

                <FormCard>
                <div>
                    <Label>{t('delivery.date')}</Label>
                    <DatePicker value={date} onChange={setDate} className="mt-1" />
                </div>

                <Textarea
                    label={t('delivery.notesOptional')}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t('delivery.notePlaceholder')}
                    rows={3}
                />
                </FormCard>
            </ModalContent>

            <OperationFooter stats={footerStats}>
                <Button type="button" variant="outline" onClick={onClose}>
                    {t('common.cancel')}
                </Button>
                <Button type="button" onClick={onSave} loading={isSaving} disabled={Boolean(setPayee) && payee.trim().length < 2}>
                    {isSaving ? t('common.processing') : t('common.save')}
                </Button>
            </OperationFooter>
        </Modal>
    );
}
