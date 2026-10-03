import { useMemo } from 'react';
import type { ClientDzd, PortfolioStats } from '../../types';
import type { DigitalServicePreview, DigitalServiceSaleWallet, FinancialWallet } from '../../utils/digitalServiceAccounting';
import { getWalletCurrency } from '../../utils/digitalServiceAccounting';
import { useLanguage } from '../../contexts/LanguageContext';
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { MoneyField } from '../ui/MoneyField';
import { SearchableSelect } from '../ui/SearchableSelect';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Textarea } from '../ui/Textarea';
import { FormCard } from '../ui/FormCard';
import { OperationFooter, type OperationFooterStat } from '../ui/OperationFooter';
import { formatMoney } from '../../pages/shared/pageFormat';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { PlusIcon } from '../icons/PlusIcon';
import { selectableClients } from '../../utils/clientRegistry';

type DigitalServiceSaleModalProps = {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    clientId: string;
    setClientId: (value: string) => void;
    serviceName: string;
    setServiceName: (value: string) => void;
    purchaseWallet: FinancialWallet;
    setPurchaseWallet: (value: FinancialWallet) => void;
    purchaseAmount: string;
    setPurchaseAmount: (value: string) => void;
    saleWallet: DigitalServiceSaleWallet;
    setSaleWallet: (value: DigitalServiceSaleWallet) => void;
    saleAmount: string;
    setSaleAmount: (value: string) => void;
    date: string;
    setDate: (value: string) => void;
    note: string;
    setNote: (value: string) => void;
    clientsDzd: ClientDzd[];
    treasuryStats: {
        caisse: number;
        baridi: number;
    };
    portfolioStats: PortfolioStats;
    preview: DigitalServicePreview | null;
    onOpenClientModal: (client: ClientDzd | null) => void;
    onSave: () => void;
};

function getClientName(client: ClientDzd) {
    return client.fullName || client.nom || 'Client';
}

function walletBalance(wallet: FinancialWallet, treasuryStats: DigitalServiceSaleModalProps['treasuryStats'], portfolioStats: PortfolioStats) {
    if (wallet === 'Caisse') return treasuryStats.caisse;
    if (wallet === 'BaridiMob') return treasuryStats.baridi;
    if (wallet === 'USDT') return Number(portfolioStats.usdt.available || 0);
    return Number(portfolioStats.eur.available || 0);
}

export function DigitalServiceSaleModal({
    isOpen,
    onClose,
    isSaving,
    clientId,
    setClientId,
    serviceName,
    setServiceName,
    purchaseWallet,
    setPurchaseWallet,
    purchaseAmount,
    setPurchaseAmount,
    saleWallet,
    setSaleWallet,
    saleAmount,
    setSaleAmount,
    date,
    setDate,
    note,
    setNote,
    clientsDzd,
    treasuryStats,
    portfolioStats,
    preview,
    onOpenClientModal,
    onSave,
}: DigitalServiceSaleModalProps) {
    const { t } = useLanguage();
    const fieldBase = 'rounded-xl border-border bg-surface text-neutral-900';
    const clientOptions = useMemo(() => selectableClients(clientsDzd, [clientId]).map((client) => ({
        value: client.id,
        label: getClientName(client),
    })), [clientsDzd, clientId]);
    const purchaseCurrency = getWalletCurrency(purchaseWallet);
    const saleCurrency = getWalletCurrency(saleWallet);
    const purchaseAvailable = walletBalance(purchaseWallet, treasuryStats, portfolioStats);

    // Display only: once a sale price is typed, the sale and its margin stay visible at the bottom
    // (the same numbers as the summary above).
    const footerStats: OperationFooterStat[] = preview && saleAmount.trim() !== '' ? [
        { label: t('digitalServices.saleValueDzd'), value: formatMoney(preview.saleAmountDzd, 'DZD', { min: 0, max: 0 }) },
        { label: t('digitalServices.margin'), value: formatMoney(preview.profitDzd, 'DZD', { min: 0, max: 0, showSign: true }), tone: preview.profitDzd < 0 ? 'loss' : 'profit' },
    ] : [];

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg bg-surface text-neutral-900">
            <ModalHeader onClose={onClose}>
                <ModalTitle className="text-base sm:text-lg">{t('digitalServices.title')}</ModalTitle>
                <ModalDescription>{t('digitalServices.subtitle')}</ModalDescription>
            </ModalHeader>

            <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
                <FormCard>
                <div>
                    <Label>{t('transactions.primaryClient')}</Label>
                    <div className="mt-1 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                            <SearchableSelect
                                value={clientId}
                                onChange={setClientId}
                                options={clientOptions}
                                fieldClassName={fieldBase}
                                searchPlaceholder={t('transactions.searchClient') as string}
                                emptyOptionLabel={t('transactions.noClient') as string}
                                emptyValue=""
                                noResultsLabel={t('transactions.noClientFound') as string}
                                clearable
                                clearLabel={t('transactions.clearClient') as string}
                            />
                        </div>
                        <button type="button" onClick={() => onOpenClientModal(null)} aria-label={t('common.newClient') as string} title={t('common.newClient') as string} className="inline-flex h-touch w-touch shrink-0 items-center justify-center rounded-button border border-border-strong bg-surface text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-light">
                            <PlusIcon aria-hidden="true" className="h-5 w-5"/>
                        </button>
                    </div>
                </div>

                <div>
                    <Label>{t('digitalServices.serviceName')}</Label>
                    <Input value={serviceName} onChange={(event) => setServiceName(event.target.value)} className="mt-1" placeholder={t('digitalServices.servicePlaceholder') as string}/>
                </div>
                </FormCard>

                <FormCard title={t('digitalServices.purchaseWallet')}>
                    <SegmentedControl size="md" columns={2} ariaLabel={t('digitalServices.purchaseWallet') as string} value={purchaseWallet} onChange={(next) => setPurchaseWallet(next as FinancialWallet)} options={[
                        { id: 'Caisse', label: t('transactions.cash'), tone: 'primary' },
                        { id: 'BaridiMob', label: t('transactions.baridi'), tone: 'primary' },
                        { id: 'USDT', label: 'USDT', tone: 'primary' },
                        { id: 'EUR', label: 'EUR', tone: 'primary' },
                    ]}/>
                    <MoneyField
                        label={t('digitalServices.purchaseAmount')}
                        value={purchaseAmount}
                        onChange={setPurchaseAmount}
                        currency={purchaseCurrency}
                        placeholder="0"
                        hint={(
                            <span className="inline-flex flex-wrap items-center gap-1">
                                {t('delivery.availableBalance')}:
                                <CurrencyAmount value={purchaseAvailable} currency={purchaseCurrency} semantic="plain" size="sm" decimals={purchaseCurrency === 'DZD' ? 0 : 2}/>
                            </span>
                        )}
                    />
                </FormCard>

                <FormCard title={t('digitalServices.saleWallet')}>
                    <SegmentedControl size="md" columns={3} ariaLabel={t('digitalServices.saleWallet') as string} value={saleWallet} onChange={(next) => setSaleWallet(next as DigitalServiceSaleWallet)} options={[
                        { id: 'Caisse', label: t('transactions.cash'), tone: 'primary' },
                        { id: 'BaridiMob', label: t('transactions.baridi'), tone: 'primary' },
                        { id: 'Credit', label: t('transactions.credit'), tone: 'debt' },
                        { id: 'USDT', label: 'USDT', tone: 'primary' },
                        { id: 'EUR', label: 'EUR', tone: 'primary' },
                    ]}/>
                    <MoneyField
                        label={t('digitalServices.saleAmount')}
                        value={saleAmount}
                        onChange={setSaleAmount}
                        currency={saleCurrency}
                        placeholder="0"
                    />
                    {preview && (
                        <div className="rounded-button bg-surface-muted p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-neutral-500">{t('digitalServices.purchaseValueDzd')}</span>
                                <CurrencyAmount value={preview.purchaseAmountDzd} currency="DZD" semantic="loss" size="sm" decimals={0}/>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-neutral-500">{t('digitalServices.saleValueDzd')}</span>
                                <CurrencyAmount value={preview.saleAmountDzd} currency="DZD" semantic="profit" size="sm" decimals={0}/>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2 font-bold">
                                <span>{t('digitalServices.margin')}</span>
                                <CurrencyAmount value={preview.profitDzd} currency="DZD" semantic="auto" size="md" decimals={0} showSign/>
                            </div>
                        </div>
                    )}
                </FormCard>

                <FormCard>
                <div>
                    <Label>{t('delivery.date')}</Label>
                    <DatePicker value={date} onChange={setDate} className="mt-1"/>
                </div>

                <Textarea
                    label={t('delivery.notesOptional')}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t('digitalServices.notePlaceholder')}
                    rows={3}
                />
                </FormCard>
            </ModalContent>

            <OperationFooter stats={footerStats}>
                <Button type="button" variant="outline" onClick={onClose}>
                    {t('common.cancel')}
                </Button>
                <Button type="button" onClick={onSave} loading={isSaving}>
                    {isSaving ? t('common.processing') : t('common.save')}
                </Button>
            </OperationFooter>
        </Modal>
    );
}
