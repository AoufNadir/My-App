import { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { MoneyField } from '../ui/MoneyField';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { InfoIcon } from '../icons/InfoIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import type { TreasuryTx } from '../../types';
import { evaluatePersonalAdvanceReconciliation } from '../../utils/personalExpenses';
import { parseAndEvaluate } from '../../utils';
import { roundM } from '../../utils/money';

interface PersonalAdvanceReconcileModalProps {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    advanceTx: TreasuryTx | null;
    actualAmount: string;
    setActualAmount: (v: string) => void;
    onSave: () => void;
}

export function PersonalAdvanceReconcileModal({
    isOpen,
    onClose,
    isSaving,
    advanceTx,
    actualAmount,
    setActualAmount,
    onSave,
}: PersonalAdvanceReconcileModalProps) {
    const { t } = useLanguage();
    const [spentInput, setSpentInput] = useState('');
    const [returnedInput, setReturnedInput] = useState('');

    const advanceAmount = Number(advanceTx?.amount || 0);

    useEffect(() => {
        if (isOpen && advanceTx) {
            const rawReturned = actualAmount || '';
            setReturnedInput(rawReturned);
            const parsedReturned = parseAndEvaluate(rawReturned);
            if (Number.isFinite(parsedReturned) && parsedReturned >= 0) {
                const spent = Math.max(0, advanceAmount - parsedReturned);
                setSpentInput(String(roundM(spent)));
            } else if (rawReturned.trim() === '') {
                setSpentInput('');
            }
        }
    }, [isOpen, advanceTx]);

    if (!advanceTx) {
        return null;
    }

    const reconciliation = evaluatePersonalAdvanceReconciliation(returnedInput, advanceAmount);
    const returnAmount = reconciliation.returnAmount;
    const returnSource = advanceTx.source || 'Caisse';
    const withSource = (key: string) => String(t(key)).replace('{source}', returnSource);

    // Validation checks for spent input
    const parsedSpent = parseAndEvaluate(spentInput);
    const isSpentExceeded = Number.isFinite(parsedSpent) && parsedSpent > advanceAmount + 0.005;
    const isSpentNegative = Number.isFinite(parsedSpent) && parsedSpent < -0.005;
    const isSpentInvalid = spentInput.trim() !== '' && !Number.isFinite(parsedSpent);

    const spentErrorMessage = isSpentExceeded ? (
        <span className="inline-flex flex-wrap items-center gap-1">
            {t('personalAdvance.exceedsSpent')}
            <CurrencyAmount value={advanceAmount} currency="DZD" semantic="plain" size="sm" decimals={0}/>
        </span>
    ) : isSpentNegative ? (
        t('personalAdvance.negative')
    ) : isSpentInvalid ? (
        t('common.invalidAmount')
    ) : undefined;

    const returnedErrorMessage = reconciliation.error === 'exceeds' ? (
        <span className="inline-flex flex-wrap items-center gap-1">
            {t('personalAdvance.exceeds')}
            <CurrencyAmount value={advanceAmount} currency="DZD" semantic="plain" size="sm" decimals={0}/>
        </span>
    ) : reconciliation.error === 'invalid' ? (
        t('common.invalidAmount')
    ) : reconciliation.error === 'negative' ? (
        t('personalAdvance.negative')
    ) : undefined;

    const hasError = !reconciliation.isValid || isSpentExceeded || isSpentNegative || isSpentInvalid;

    const handleSpentChange = (val: string) => {
        setSpentInput(val);
        if (val.trim() === '') {
            setReturnedInput('');
            setActualAmount('');
            return;
        }
        const parsed = parseAndEvaluate(val);
        if (Number.isFinite(parsed) && parsed >= 0) {
            const ret = Math.max(0, roundM(advanceAmount - parsed));
            const retStr = String(ret);
            setReturnedInput(retStr);
            setActualAmount(retStr);
        }
    };

    const handleReturnedChange = (val: string) => {
        setReturnedInput(val);
        setActualAmount(val);
        if (val.trim() === '') {
            setSpentInput('');
            return;
        }
        const parsed = parseAndEvaluate(val);
        if (Number.isFinite(parsed) && parsed >= 0) {
            const spent = Math.max(0, roundM(advanceAmount - parsed));
            setSpentInput(String(spent));
        }
    };

    const handleReturnAll = () => {
        const retStr = String(advanceAmount);
        setReturnedInput(retStr);
        setSpentInput('0');
        setActualAmount(retStr);
    };

    const handleSpendAll = () => {
        setReturnedInput('0');
        setSpentInput(String(advanceAmount));
        setActualAmount('0');
    };

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
                        <CurrencyAmount value={advanceAmount} currency="DZD" semantic="plain" size="xl" decimals={0}/>
                    </div>
                    <dl className="mt-3 space-y-1 text-xs">
                        <DetailLine label={t('common.dateWord') as string} value={`${advanceTx.date} · ${advanceTx.time}`} />
                        <DetailLine label={t('common.source') as string} value={advanceTx.source || '-'} />
                        {advanceTx.notes && <DetailLine label={t('common.notes') as string} value={advanceTx.notes} />}
                    </dl>
                </Card>

                <div className="space-y-3">
                    <MoneyField
                        label={t('personalAdvance.spentAmount') as string}
                        value={spentInput}
                        onChange={handleSpentChange}
                        currency="DZD"
                        placeholder="0"
                        hint={t('personalAdvance.spentHint') as string}
                        error={spentErrorMessage}
                        autoFocus
                    />

                    <MoneyField
                        label={t('personalAdvance.returnedAmount') as string}
                        value={returnedInput}
                        onChange={handleReturnedChange}
                        currency="DZD"
                        placeholder="0"
                        hint={(
                            <span className="inline-flex flex-wrap items-center gap-1">
                                {t('personalAdvance.advanceTakenHint')}:
                                <CurrencyAmount value={advanceAmount} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                            </span>
                        )}
                        error={returnedErrorMessage}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleSpendAll}>
                        {t('personalAdvance.spendAll')}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleReturnAll}>
                        {t('personalAdvance.returnAll')}
                    </Button>
                </div>

                {reconciliation.isValid && !hasError && (
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
                                <CurrencyAmount value={returnAmount} currency="DZD" semantic="profit" size="xl" showSign decimals={0}/>
                            )}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
                            <span>{t('personalAdvance.finalExpense')}</span>
                            <CurrencyAmount value={reconciliation.actualSpent} currency="DZD" semantic="plain" size="sm" decimals={0}/>
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
