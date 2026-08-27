import { useMemo } from 'react';
import type { ClientDzd, PortfolioStats } from '../../types';
import type { DigitalServicePreview, DigitalServiceSaleWallet, FinancialWallet } from '../../utils/digitalServiceAccounting';
import { getWalletCurrency } from '../../utils/digitalServiceAccounting';
import { useLanguage } from '../../contexts/LanguageContext';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { MoneyField } from '../ui/MoneyField';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Tabs } from '../ui/Tabs';
import { Textarea } from '../ui/Textarea';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { PlusIcon } from '../icons/PlusIcon';

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
    const clientOptions = useMemo(() => clientsDzd.map((client) => ({
        value: client.id,
        label: getClientName(client),
    })), [clientsDzd]);
    const purchaseCurrency = getWalletCurrency(purchaseWallet);
    const saleCurrency = getWalletCurrency(saleWallet);
    const purchaseAvailable = walletBalance(purchaseWallet, treasuryStats, portfolioStats);

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg bg-surface text-neutral-900">
            <ModalHeader onClose={onClose} className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                <ModalTitle className="text-base sm:text-lg">{t('digitalServices.title')}</ModalTitle>
                <p className="mt-0.5 text-sm font-normal text-neutral-500">{t('digitalServices.subtitle')}</p>
            </ModalHeader>

            <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
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
                        <Button type="button" variant="outline" className="h-touch w-touch shrink-0 rounded-xl p-0" onClick={() => onOpenClientModal(null)} aria-label={t('clients.newClient') as string}>
                            <PlusIcon className="h-5 w-5"/>
                        </Button>
                    </div>
                </div>

                <div>
                    <Label>{t('digitalServices.serviceName')}</Label>
                    <Input value={serviceName} onChange={(event) => setServiceName(event.target.value)} className="mt-1" placeholder={t('digitalServices.servicePlaceholder') as string}/>
                </div>

                <div className="rounded-xl border border-border p-3">
                    <Label>{t('digitalServices.purchaseWallet')}</Label>
                    <Tabs
                        tabs={[
                            { id: 'Caisse', label: t('transactions.cash') },
                            { id: 'BaridiMob', label: t('transactions.baridi') },
                            { id: 'USDT', label: 'USDT' },
                            { id: 'EUR', label: 'EUR' },
                        ]}
                        activeTab={purchaseWallet}
                        onChange={(next) => setPurchaseWallet(next as FinancialWallet)}
                        variant="pills"
                        className="mt-1"
                    />
                    <div className="mt-3">
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
                    </div>
                </div>

                <div className="rounded-xl border border-border p-3">
                    <Label>{t('digitalServices.saleWallet')}</Label>
                    <Tabs
                        tabs={[
                            { id: 'Caisse', label: t('transactions.cash') },
                            { id: 'BaridiMob', label: t('transactions.baridi') },
                            { id: 'Credit', label: t('transactions.credit') },
                            { id: 'USDT', label: 'USDT' },
                            { id: 'EUR', label: 'EUR' },
                        ]}
                        activeTab={saleWallet}
                        onChange={(next) => setSaleWallet(next as DigitalServiceSaleWallet)}
                        variant="pills"
                        className="mt-1"
                    />
                    <div className="mt-3">
                        <MoneyField
                            label={t('digitalServices.saleAmount')}
                            value={saleAmount}
                            onChange={setSaleAmount}
                            currency={saleCurrency}
                            placeholder="0"
                        />
                    </div>
                </div>

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

                {preview && (
                    <div className="rounded-xl bg-surface-muted p-3 text-sm">
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
