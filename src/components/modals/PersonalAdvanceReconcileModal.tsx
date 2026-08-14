import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { MoneyField } from '../ui/MoneyField';
import { CurrencyAmount } from '../financial/CurrencyAmount';

import { InfoIcon } from '../icons/InfoIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import type { TreasuryTx } from '../../types';
import { evaluatePersonalAdvanceReconciliation } from '../../utils/personalExpenses';

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

    if (!advanceTx) {
        return null;
    }

    const advanceAmount = Number(advanceTx.amount || 0);
    const reconciliation = evaluatePersonalAdvanceReconciliation(actualAmount, advanceAmount);
    const returnAmount = reconciliation.returnAmount;
    const hasError = !reconciliation.isValid;
    const errorTitle = reconciliation.error === 'exceeds'
        ? "Le retour ne peut pas depasser l'avance prise"
        : reconciliation.error === 'invalid'
            ? 'Montant invalide'
            : reconciliation.error === 'negative'
                ? 'Le montant doit etre positif ou zero'
                : undefined;
    const errorMessage = reconciliation.error === 'exceeds' ? (
        <span className="inline-flex flex-wrap items-center gap-1">
            Le retour ne peut pas depasser l'avance prise
            <CurrencyAmount value={advanceAmount} currency="DZD" semantic="plain" size="sm" decimals={0}/>
        </span>
    ) : errorTitle;
    const returnSource = advanceTx.source || 'Caisse';

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
            <ModalHeader onClose={onClose} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                <ModalTitle className="text-base sm:text-lg">Regulariser l'avance</ModalTitle>
                <p className="mt-0.5 text-sm font-normal text-neutral-500">Indique ce qui revient a {returnSource}</p>
            </ModalHeader>

            <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                <Card variant="flat" className="p-4">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-neutral-500">Avance prise</span>
                        <CurrencyAmount value={advanceAmount} currency="DZD" semantic="plain" size="xl" decimals={0}/>
                    </div>
                    <dl className="mt-3 space-y-1 text-xs">
                        <DetailLine label="Date" value={`${advanceTx.date} · ${advanceTx.time}`} />
                        <DetailLine label="Source" value={advanceTx.source || '-'} />
                        {advanceTx.notes && <DetailLine label="Note" value={advanceTx.notes} />}
                    </dl>
                </Card>

                <MoneyField
                    label="Montant retourne"
                    value={actualAmount}
                    onChange={setActualAmount}
                    currency="DZD"
                    placeholder="0"
                    hint={(
                        <span className="inline-flex flex-wrap items-center gap-1">
                            Avance prise:
                            <CurrencyAmount value={advanceAmount} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                        </span>
                    )}
                    error={errorMessage}
                    autoFocus
                />

                <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setActualAmount(String(advanceAmount))}>
                        Tout retourner
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setActualAmount('0')}>
                        Tout depense
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
                                {returnAmount > 0 ? `Retour automatique a ${returnSource}` : 'Aucun retour'}
                            </span>
                            {returnAmount > 0 && (
                                <CurrencyAmount value={returnAmount} currency="DZD" semantic="profit" size="xl" showSign decimals={0}/>
                            )}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
                            <span>Depense finale</span>
                            <CurrencyAmount value={reconciliation.actualSpent} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                        </div>
                    </Card>
                )}

                <div className="flex items-start gap-2 rounded-lg bg-info-bg p-3 text-xs text-info">
                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                        Saisis le montant que tu as remis dans {returnSource}. Le reste sera considere comme depense personnelle et ton profit sera ajuste.
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
                        {isSaving ? t('common.processing') : 'Confirmer'}
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
