import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { MoneyField } from '../ui/MoneyField';
import { DatePicker } from '../ui/DatePicker';
import { Textarea } from '../ui/Textarea';
import { CurrencyAmount } from '../financial/CurrencyAmount';

import { Tabs } from '../ui/Tabs';
import { useLanguage } from '../../contexts/LanguageContext';

interface DeliveryExpenseModalProps {
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
    treasuryStats: {
        caisse: number;
        baridi: number;
    };
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
    treasuryStats,
    onSave,
}: DeliveryExpenseModalProps) {
    const { t } = useLanguage();
    const availableBalance = method === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
            <ModalHeader onClose={onClose} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                <ModalTitle className="text-base sm:text-lg">{t('delivery.title')}</ModalTitle>
                <p className="mt-0.5 text-sm font-normal text-neutral-500">{t('delivery.description')}</p>
            </ModalHeader>

            <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                <MoneyField
                    label={t('delivery.amount')}
                    value={amount}
                    onChange={setAmount}
                    currency="DZD"
                    hint={(
                        <span className="inline-flex flex-wrap items-center gap-1">
                            {t('delivery.availableBalance')}:
                            <CurrencyAmount value={availableBalance} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                        </span>
                    )}
                    placeholder="0"
                />

                <div>
                    <Label>{t('delivery.method')}</Label>
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
            </ModalContent>

            <ModalFooter className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                <div className="flex w-full gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="button" className="flex-1" onClick={onSave} loading={isSaving}>
                        {isSaving ? t('common.processing') : t('common.save')}
                    </Button>
                </div>
            </ModalFooter>
        </Modal>
    );
}
