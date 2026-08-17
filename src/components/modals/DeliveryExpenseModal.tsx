import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { MoneyField } from '../ui/MoneyField';
import { DatePicker } from '../ui/DatePicker';
import { Textarea } from '../ui/Textarea';
import { CurrencyAmount } from '../financial/CurrencyAmount';

import { Tabs } from '../ui/Tabs';
import { useLanguage } from '../../contexts/LanguageContext';
import type { PortfolioStats } from '../../types';
import type { FinancialWallet, ProjectExpensePreview } from '../../utils/digitalServiceAccounting';
import { getWalletCurrency, isAssetWallet } from '../../utils/digitalServiceAccounting';

interface DeliveryExpenseModalProps {
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
    treasuryStats,
    portfolioStats,
    preview,
    onSave,
}: DeliveryExpenseModalProps) {
    const { t } = useLanguage();
    const currency = getWalletCurrency(method);
    const availableBalance = method === 'Caisse'
        ? treasuryStats.caisse
        : method === 'BaridiMob'
            ? treasuryStats.baridi
            : method === 'USDT'
                ? Number(portfolioStats.usdt.available || 0)
                : Number(portfolioStats.eur.available || 0);

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
                    currency={currency}
                    hint={(
                        <span className="inline-flex flex-wrap items-center gap-1">
                            {t('delivery.availableBalance')}:
                            <CurrencyAmount value={availableBalance} currency={currency} semantic="plain" size="sm" decimals={currency === 'DZD' ? 0 : 2}/>
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
