import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FormCard } from '../ui/FormCard';
import { MoneyField } from '../ui/MoneyField';
import { OperationFooter, type OperationFooterStat } from '../ui/OperationFooter';
import { Textarea } from '../ui/Textarea';
import { CurrencyAmount } from '../financial/CurrencyAmount';

import { InfoIcon } from '../icons/InfoIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatMoney } from '../../pages/shared/pageFormat';
import { walletDisplayName } from '../../utils/formMessages';
import type { TreasuryTx } from '../../types';
import type { FinancialWallet } from '../../utils/digitalServiceAccounting';
import { getWalletCurrency } from '../../utils/digitalServiceAccounting';
import { evaluatePersonalAdvanceReconciliation } from '../../utils/personalExpenses';

interface PersonalAdvanceReconcileModalProps {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    advanceTx: TreasuryTx | null;
    actualAmount: string;
    setActualAmount: (v: string) => void;
    spentDescription: string;
    setSpentDescription: (v: string) => void;
    onSave: () => void;
}

export function PersonalAdvanceReconcileModal({
    isOpen,
    onClose,
    isSaving,
    advanceTx,
    actualAmount,
    setActualAmount,
    spentDescription,
    setSpentDescription,
    onSave,
}: PersonalAdvanceReconcileModalProps) {
    const { t } = useLanguage();

    if (!advanceTx) {
        return null;
    }

    const advanceWallet = (advanceTx.expenseWallet || advanceTx.source || 'Caisse') as FinancialWallet;
    const advanceCurrency = getWalletCurrency(advanceWallet);
    const advanceAmount = Number(advanceTx.originalAmount ?? advanceTx.amount ?? 0);
    const rateToDzd = Number(advanceTx.conversionRateToDzd || 1);
    const advanceAmountDzd = Number(advanceTx.amountDzd ?? advanceTx.amount ?? 0);
    const reconciliation = evaluatePersonalAdvanceReconciliation(actualAmount, advanceAmount);
    const returnAmount = reconciliation.returnAmount;
    const returnAmountDzd = returnAmount * rateToDzd;
    const actualSpentDzd = reconciliation.actualSpent * rateToDzd;
    const hasError = !reconciliation.isValid;
    const returnSource = walletDisplayName(advanceWallet, t);
    const withSource = (key: string) => String(t(key)).replace('{source}', returnSource);
    const advanceDecimals = advanceCurrency === 'DZD' ? 0 : 2;
    const errorTitle = reconciliation.error === 'exceeds'
        ? t('personalAdvance.exceeds')
        : reconciliation.error === 'invalid'
            ? t('common.invalidAmount')
            : reconciliation.error === 'negative'
                ? t('personalAdvance.negative')
                : undefined;
    const errorMessage = reconciliation.error === 'exceeds' ? (
        <span className="inline-flex flex-wrap items-center gap-1">
            {t('personalAdvance.exceeds')}
            <CurrencyAmount value={advanceAmount} currency={advanceCurrency} semantic="plain" size="sm" decimals={advanceDecimals}/>
        </span>
    ) : errorTitle;

    // Display only: why Confirm is off (the same rule as the button), and the result at the bottom.
    const blockedReason = hasError && !isSaving
        ? (errorTitle ? String(errorTitle) : String(t('personalAdvance.enterReturnedAmount')))
        : undefined;
    const footerStats: OperationFooterStat[] = reconciliation.isValid ? [
        { label: t('personalAdvance.returnedAmount'), value: formatMoney(returnAmount, advanceCurrency, { min: advanceDecimals, max: advanceDecimals }), tone: returnAmount > 0 ? 'profit' : 'plain' },
        { label: t('personalAdvance.finalExpense'), value: formatMoney(actualSpentDzd, 'DZD', { min: 0, max: 0 }), tone: actualSpentDzd > 0 ? 'loss' : 'plain' },
    ] : [];

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
            <ModalHeader onClose={onClose}>
                <ModalTitle className="text-base sm:text-lg">{t('personalAdvance.title')}</ModalTitle>
                <ModalDescription>{withSource('personalAdvance.subtitle')}</ModalDescription>
            </ModalHeader>

            <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
                <FormCard>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-neutral-600">{t('personalAdvance.advanceTaken')}</span>
                        <CurrencyAmount value={advanceAmount} currency={advanceCurrency} semantic="plain" size="xl" decimals={advanceDecimals}/>
                    </div>
                    <dl className="space-y-1.5 border-t border-border pt-3 text-xs">
                        <DetailLine label={t('common.dateWord') as string} value={`${advanceTx.date} · ${advanceTx.time}`} />
                        <DetailLine label={t('common.source') as string} value={returnSource} />
                        {advanceCurrency !== 'DZD' && (
                            <DetailLine label={t('delivery.valueDzd') as string} value={`${advanceAmountDzd.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD`} />
                        )}
                        {advanceTx.notes && <DetailLine label={t('common.notes') as string} value={advanceTx.notes} />}
                    </dl>
                </FormCard>

                <FormCard>
                    <MoneyField
                        label={t('personalAdvance.returnedAmount') as string}
                        value={actualAmount}
                        onChange={setActualAmount}
                        currency={advanceCurrency}
                        placeholder="0"
                        hint={(
                            <span className="inline-flex flex-wrap items-center gap-1">
                                {t('personalAdvance.advanceTakenHint')}:
                                <CurrencyAmount value={advanceAmount} currency={advanceCurrency} semantic="plain" size="sm" decimals={advanceDecimals}/>
                            </span>
                        )}
                        error={errorMessage}
                        autoFocus
                    />

                    <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setActualAmount(String(advanceAmount))}>
                            {t('personalAdvance.returnAll')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setActualAmount('0')}>
                            {t('personalAdvance.spendAll')}
                        </Button>
                    </div>

                    <Textarea
                        label={t('personalAdvance.spentDescription') as string}
                        value={spentDescription}
                        onChange={(event) => setSpentDescription(event.target.value)}
                        placeholder={t('personalAdvance.spentPlaceholder') as string}
                        helperText={t('personalAdvance.spentDescriptionHint') as string}
                        rows={3}
                    />
                </FormCard>

                {reconciliation.isValid && (
                    <div className={[
                        'rounded-card border p-4',
                        returnAmount > 0 ? 'border-success/20 bg-success-bg' : 'border-border bg-surface',
                    ].join(' ')}>
                        <div className="flex items-center justify-between gap-3">
                            <span className={[
                                'text-sm font-semibold',
                                returnAmount > 0 ? 'text-success' : 'text-neutral-500',
                            ].join(' ')}>
                                {returnAmount > 0 ? withSource('personalAdvance.autoReturn') : t('personalAdvance.noReturn')}
                            </span>
                            {returnAmount > 0 && (
                                <CurrencyAmount value={returnAmount} currency={advanceCurrency} semantic="profit" size="xl" showSign decimals={advanceDecimals}/>
                            )}
                        </div>
                        {returnAmount > 0 && advanceCurrency !== 'DZD' && (
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
                                <span>{t('delivery.valueDzd')}</span>
                                <CurrencyAmount value={returnAmountDzd} currency="DZD" semantic="profit" size="sm" decimals={0}/>
                            </div>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
                            <span>{t('personalAdvance.finalExpense')}</span>
                            <CurrencyAmount value={actualSpentDzd} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-2 rounded-card border border-info/25 bg-financial-asset-bg p-3 text-xs leading-relaxed text-neutral-700">
                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-financial-asset" />
                    <p>
                        {withSource('personalAdvance.help')}
                    </p>
                </div>
            </ModalContent>

            <OperationFooter stats={footerStats} reason={blockedReason} reasonTone={reconciliation.error === 'empty' ? 'missing' : 'fix'}>
                <Button type="button" variant="outline" onClick={onClose}>
                    {t('common.cancel')}
                </Button>
                <Button
                    type="button"
                    onClick={onSave}
                    disabled={hasError}
                    loading={isSaving}
                    title={blockedReason}
                >
                    {isSaving ? t('common.processing') : t('common.confirm')}
                </Button>
            </OperationFooter>
        </Modal>
    );
}

type DetailLineProps = {
    label: string;
    value: string;
};

function DetailLine({ label, value }: DetailLineProps) {
    return (
        <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">{label}</dt>
            <dd className="min-w-0 truncate text-end font-medium text-neutral-700">
                {value}
            </dd>
        </div>
    );
}
