import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { MoneyField } from '../ui/MoneyField';
import { Textarea } from '../ui/Textarea';
import { CurrencyAmount } from '../financial/CurrencyAmount';

import { InfoIcon } from '../icons/InfoIcon';
import { useLanguage } from '../../contexts/LanguageContext';
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
    const returnSource = advanceWallet;
    const withSource = (key: string) => String(t(key)).replace('{source}', returnSource);
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
            <CurrencyAmount value={advanceAmount} currency={advanceCurrency} semantic="plain" size="sm" decimals={advanceCurrency === 'DZD' ? 0 : 2}/>
        </span>
    ) : errorTitle;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
            <ModalHeader onClose={onClose} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                <ModalTitle className="text-base sm:text-lg">{t('personalAdvance.title')}</ModalTitle>
                <p className="mt-0.5 text-sm font-normal text-neutral-500">{withSource('personalAdvance.subtitle')}</p>
            </ModalHeader>

            <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                <Card variant="flat" className="p-4">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-neutral-500">{t('personalAdvance.advanceTaken')}</span>
                        <CurrencyAmount value={advanceAmount} currency={advanceCurrency} semantic="plain" size="xl" decimals={advanceCurrency === 'DZD' ? 0 : 2}/>
                    </div>
                    <dl className="mt-3 space-y-1 text-xs">
                        <DetailLine label={t('common.dateWord') as string} value={`${advanceTx.date} · ${advanceTx.time}`} />
                        <DetailLine label={t('common.source') as string} value={advanceWallet} />
                        {advanceCurrency !== 'DZD' && (
                            <DetailLine label={t('delivery.valueDzd') as string} value={`${advanceAmountDzd.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD`} />
                        )}
                        {advanceTx.notes && <DetailLine label={t('common.notes') as string} value={advanceTx.notes} />}
                    </dl>
                </Card>

                <MoneyField
                                    label={t('personalAdvance.returnedAmount') as string}
                                    value={actualAmount}
                                    onChange={setActualAmount}
                                    currency={advanceCurrency}
                                    placeholder="0"
                                    hint={(
                                        <span className="inline-flex flex-wrap items-center gap-1">
                                            {t('personalAdvance.advanceTakenHint')}:
                                            <CurrencyAmount value={advanceAmount} currency={advanceCurrency} semantic="plain" size="sm" decimals={advanceCurrency === 'DZD' ? 0 : 2}/>
                                        </span>
                                    )}
                                    error={errorMessage}
                                    autoFocus
                                    onMax={() => setActualAmount(String(advanceAmount))}
                                />

                <Textarea
                    label={t('personalAdvance.spentDescription') as string}
                    value={spentDescription}
                    onChange={(event) => setSpentDescription(event.target.value)}
                    placeholder={t('personalAdvance.spentPlaceholder') as string}
                    helperText={t('personalAdvance.spentDescriptionHint') as string}
                    rows={3}
                />

                <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setActualAmount(String(advanceAmount))}>
                        {t('personalAdvance.returnAll')}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setActualAmount('0')}>
                        {t('personalAdvance.spendAll')}
                    </Button>
                </div>

                {reconciliation.isValid && (
                    <Card className={[
                        'p-4',
                        returnAmount > 0 ? 'border-success/20 bg-success-bg' : 'bg-surface-muted',
                    ].join(' ')}>
                        <div className="flex items-center justify-between gap-3">
                            <span className={[
                                'text-sm font-medium',
                                returnAmount > 0 ? 'text-success' : 'text-neutral-500',
                            ].join(' ')}>
                                {returnAmount > 0 ? withSource('personalAdvance.autoReturn') : t('personalAdvance.noReturn')}
                            </span>
                            {returnAmount > 0 && (
                                <CurrencyAmount value={returnAmount} currency={advanceCurrency} semantic="profit" size="xl" showSign decimals={advanceCurrency === 'DZD' ? 0 : 2}/>
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
                    </Card>
                )}

                <div className="flex items-start gap-2 rounded-lg bg-info-bg p-3 text-xs text-info">
                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                        {withSource('personalAdvance.help')}
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
                        disabled={hasError}
                        loading={isSaving}
                        title={errorTitle}
                    >
                        {isSaving ? t('common.processing') : t('common.confirm')}
                    </Button>
                </div>
            </ModalFooter>
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
