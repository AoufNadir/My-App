import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { MoneyField } from '../ui/MoneyField';
import { Textarea } from '../ui/Textarea';
import { SectionHeading } from '../ui/SectionHeading';
import { ClientLinker } from './ClientLinker';
import { SmartPricePanel } from './SmartPricePanel';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SparklesIcon } from '../icons/SparklesIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { parseAndEvaluate } from '../../utils';
import { formatNumber } from '../../pages/shared/pageFormat';
import { getFirstValidationMessage } from '../../utils/financialUx';
import { getTransactionTagLabel } from '../../utils/transactionTerminology';

const QUICK_TAGS = [
    { value: 'OTC', labelKey: 'transactions.quickTagOtc' },
    { value: 'Urgent', labelKey: 'transactions.quickTagUrgent' },
    { value: 'Gros compte', labelKey: 'transactions.quickTagLargeAccount' },
    { value: 'Livraison', labelKey: 'transactions.quickTagDelivery' },
    // Keep the old stored value for existing filters and historical records.
    { value: 'Crédit', labelKey: 'transactions.quickTagDeferredPayment' }
] as const;

function TagInput({ tags, setTags, t }: { tags: string[]; setTags: (t: string[]) => void; t: (key: string) => string }) {
    const [input, setInput] = React.useState('');
    const addTag = (raw: string) => {
        const tag = raw.trim();
        if (!tag || tags.includes(tag)) return;
        setTags([...tags, tag]);
        setInput('');
    };
    const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));
    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700">{t('transactions.tags')}</p>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {getTransactionTagLabel(tag, t)}
                            <button type="button" onClick={() => removeTag(tag)} className="text-primary/60 hover:text-primary" aria-label={`${t('transactions.removeTag')} ${getTransactionTagLabel(tag, t)}`}>×</button>
                        </span>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.filter(({ value }) => !tags.includes(value)).map(({ value, labelKey }) => (
                    <button key={value} type="button" onClick={() => addTag(value)} className="rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-[11px] font-medium text-neutral-500 hover:border-primary hover:text-primary transition-colors">
                        + {t(labelKey)}
                    </button>
                ))}
            </div>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); } }}
                placeholder={t('transactions.addTagPlaceholder')}
                className="h-9 w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
        </div>
    );
}

type MainTransactionDialogProps = Record<string, any>;
type LastEditedSellField = 'eurReceived' | 'quantity' | 'total' | 'price';
type SellCalculationBasis = Exclude<LastEditedSellField, 'price'>;
export function MainTransactionDialog({ mode, editingTx, closeForm, openForm, t, fieldBase, buyUsdtMode, setBuyUsdtMode, setEurDzdPrice, portfolioStats, treasuryStats, buyUsdtAmount, setBuyUsdtAmount, isTotalManual, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal, setIsTotalManual, formValidation, linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, clientPaymentStatus, setClientPaymentStatus, creditDueDate, setCreditDueDate, pendingCreditRisk, confirmCreditRisk, cancelCreditRisk, notes, setNotes, txTags, setTxTags, buyEurForUsdtAmount, setBuyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, setEurUsdtRate, sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal, sellSettlementCurrency, setSellSettlementCurrency, sellEurToDzdRate, setSellEurToDzdRate, profitPercent, setProfitPercent, buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal, clientBalances, handleBuy, handleSell, isSaving, buyRestriction, setBuyRestriction, realPurchaseTime, setRealPurchaseTime, smartPricingByCurrency, smartQuoteRef }: MainTransactionDialogProps) {
    const [sellUsdtSourceSelected, setSellUsdtSourceSelected] = React.useState(false);
    const [lastEditedSellField, setLastEditedSellField] = React.useState<LastEditedSellField>('quantity');
    const sellCalculationBasisRef = React.useRef<SellCalculationBasis>('quantity');
    const unlockPreviewTime = React.useMemo(() => {
        if (!realPurchaseTime || buyRestriction !== 'locked_24h') return null;
        const parts = realPurchaseTime.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1] || '0', 10);
        if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return new Date(d.getTime() + 24 * 60 * 60 * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }, [realPurchaseTime, buyRestriction]);
    const hasPrimaryClient = Boolean(linkedClientId && linkedClientId !== 'none');
    const selectedClientTotal = hasPrimaryClient
        ? Math.abs(Number(clientBalances?.get?.(linkedClientId) || 0))
        : 0;
    const selectedClientTotalLabel = Number(selectedClientTotal.toFixed(2)).toString();
    const isSellMode = mode === 'sell_usdt' || mode === 'sell_eur';
    const isBuyMode = mode === 'buy_usdt' || mode === 'buy_eur';
    const activeCurrency = mode === 'buy_eur' || mode === 'sell_eur' ? 'EUR' : 'USDT';
    const activeStats = activeCurrency === 'EUR' ? portfolioStats.eur : portfolioStats.usdt;
    const isUsdtSellSettledInEur = mode === 'sell_usdt' && sellSettlementCurrency === 'EUR';
    const sellEurToDzdRateValue = parseAndEvaluate(sellEurToDzdRate);
    const pamEurToDzdRate = Number(portfolioStats.eur.avgBuy || 0);
    const pamEurToDzdRateInput = pamEurToDzdRate > 0 ? pamEurToDzdRate.toFixed(2) : '';
    const effectiveSellEurToDzdRateValue = isUsdtSellSettledInEur ? pamEurToDzdRate : sellEurToDzdRateValue;
    const sellPriceUnitLabel = isUsdtSellSettledInEur ? 'EUR/USDT' : t('common.dinar');
    const sellTotalCurrencyLabel = isUsdtSellSettledInEur ? 'EUR' : t('common.dinar');
    const formatSellTotalInput = (value: number) => isUsdtSellSettledInEur ? value.toFixed(2) : value.toFixed(0);
    const formatSellQuantityInput = (value: number) => {
        if (!Number.isFinite(value) || value <= 0)
            return '';
        return value.toFixed(2);
    };
    const activeSellTotalField = (): 'eurReceived' | 'total' => isUsdtSellSettledInEur ? 'eurReceived' : 'total';
    const markSellFieldEdited = (field: LastEditedSellField) => {
        setLastEditedSellField(field);
        if (field !== 'price')
            sellCalculationBasisRef.current = field;
    };
    const updateSellTotalFromQuantity = (quantity: number, price: number) => {
        if (quantity > 0 && price > 0)
            setSellTotal(formatSellTotalInput(quantity * price));
        else if (quantity <= 0)
            setSellTotal('');
    };
    const updateSellQuantityFromTotal = (total: number, price: number) => {
        if (total > 0 && price > 0)
            setSellAmount(formatSellQuantityInput(total / price));
        else if (total <= 0)
            setSellAmount('');
    };
    const updateSellPriceMargin = (price: number) => {
        if (activeStats.avgBuy <= 0 || price <= 0)
            return;
        const effectivePriceDzd = isUsdtSellSettledInEur ? price * effectiveSellEurToDzdRateValue : price;
        setProfitPercent((effectivePriceDzd - activeStats.avgBuy).toFixed(2));
    };
    const updateSellLinkedFieldsAfterPriceChange = (price: number) => {
        if (price <= 0)
            return;
        const calculationBasis = lastEditedSellField === 'price'
            ? sellCalculationBasisRef.current
            : lastEditedSellField;
        if (calculationBasis === 'total' || calculationBasis === 'eurReceived') {
            setIsTotalManual(true);
            updateSellQuantityFromTotal(parseAndEvaluate(sellTotal), price);
            return;
        }
        setIsTotalManual(false);
        updateSellTotalFromQuantity(parseAndEvaluate(sellAmount), price);
    };
    React.useEffect(() => {
        setSellUsdtSourceSelected(mode === 'sell_usdt' && (!!sellAmount || !!sellPrice));
        setLastEditedSellField('quantity');
        sellCalculationBasisRef.current = 'quantity';
    }, [mode, editingTx?.id]);
    React.useEffect(() => {
        if (!isUsdtSellSettledInEur)
            return;
        if (sellEurToDzdRate !== pamEurToDzdRateInput)
            setSellEurToDzdRate(pamEurToDzdRateInput);
    }, [isUsdtSellSettledInEur, pamEurToDzdRateInput, sellEurToDzdRate, setSellEurToDzdRate]);
    const switchOperation = (operation: 'buy' | 'sell') => {
        if (editingTx)
            return;
        if (operation === 'buy') {
            openForm(activeCurrency === 'EUR' ? 'buy_eur' : 'buy_usdt');
            return;
        }
        openForm(activeCurrency === 'EUR' ? 'sell_eur' : 'sell_usdt');
    };
    const switchCurrency = (currency: 'USDT' | 'EUR') => {
        if (editingTx)
            return;
        if (isSellMode) {
            openForm(currency === 'EUR' ? 'sell_eur' : 'sell_usdt');
            return;
        }
        openForm(currency === 'EUR' ? 'buy_eur' : 'buy_usdt');
    };
    const applyClientMaxToBuyTotal = () => {
        if (!hasPrimaryClient || selectedClientTotal <= 0)
            return;
        setBuyUsdtTotal(selectedClientTotalLabel);
        setIsTotalManual(true);
        const price = parseAndEvaluate(buyUsdtPrice);
        if (price > 0) {
            setBuyUsdtAmount((selectedClientTotal / price).toFixed(2));
        }
    };
    const applyClientMaxToSellTotal = () => {
        if (isUsdtSellSettledInEur)
            return;
        if (!hasPrimaryClient || selectedClientTotal <= 0)
            return;
        markSellFieldEdited('total');
        setSellTotal(selectedClientTotalLabel);
        setIsTotalManual(true);
        const price = parseAndEvaluate(sellPrice);
        if (price > 0) {
            updateSellQuantityFromTotal(selectedClientTotal, price);
        }
    };
    const applySellBalanceMax = () => {
            markSellFieldEdited('quantity');
            setSellAmount(activeStats.available.toFixed(2));
            const price = parseAndEvaluate(sellPrice);
            if (price > 0) {
                setIsTotalManual(false);
                updateSellTotalFromQuantity(activeStats.available, price);
            }
        };
        // Funding source for Buy = linked client's payment status (matches handleBuy):
        //   credit -> no direct treasury wallet (client-funded)
        //   cash    -> Caisse
        //   baridi  -> BaridiMob
        const isFundingCredit = clientPaymentStatus === 'credit';
        const fundingWalletBalance = isFundingCredit
            ? 0
            : (clientPaymentStatus === 'baridi'
                ? (treasuryStats?.baridi || 0)
                : (treasuryStats?.caisse || 0));
        const applyBuyUsdtDzdQuantityMax = () => {
            // MAX for Buy USDT/DZD quantity = actual funding wallet balance / price
            const price = parseAndEvaluate(buyUsdtPrice);
            if (price > 0 && !isFundingCredit && fundingWalletBalance > 0) {
                setBuyUsdtAmount((fundingWalletBalance / price).toFixed(2));
            }
        };
        const buyUsdtDzdQtyMaxDisabled = isFundingCredit || parseAndEvaluate(buyUsdtPrice) <= 0 || fundingWalletBalance <= 0;
        const applyBuyUsdtEurQuantityMax = () => {
            // MAX for Buy USDT/EUR quantity = EUR available
            setBuyEurForUsdtAmount(portfolioStats.eur.available.toFixed(2));
        };
        const buyEurForUsdtQtyMaxDisabled = portfolioStats.eur.available <= 0;
        const applyBuyEurQuantityMax = () => {
            // MAX for Buy EUR quantity = actual funding wallet balance / price
            const price = parseAndEvaluate(buyEurPrice);
            if (price > 0 && !isFundingCredit && fundingWalletBalance > 0) {
                setBuyEurAmount((fundingWalletBalance / price).toFixed(2));
            }
        };
        const buyEurQtyMaxDisabled = isFundingCredit || parseAndEvaluate(buyEurPrice) <= 0 || fundingWalletBalance <= 0;
        const applyBuyEurTotalMax = () => {
            // MAX for Buy EUR total = actual funding wallet balance
            if (isFundingCredit || fundingWalletBalance <= 0)
                return;
            setBuyEurTotal(Math.round(fundingWalletBalance).toString());
            setIsTotalManual(true);
            const price = parseAndEvaluate(buyEurPrice);
            if (price > 0) {
                setBuyEurAmount((fundingWalletBalance / price).toFixed(2));
            }
        };
        const buyEurTotalMaxDisabled = isFundingCredit || fundingWalletBalance <= 0;
        const chooseSellWithDzd = () => {
        setSellSettlementCurrency('DZD');
        setIsTotalManual(false);
        setSellUsdtSourceSelected(true);
    };
    const chooseSellWithEur = () => {
        setSellSettlementCurrency('EUR');
        setLinkedClientDzdId('none');
        setClientPaymentStatus('cash');
        setSellEurToDzdRate(pamEurToDzdRateInput);
        setSellPrice('');
        setSellTotal('');
        setProfitPercent('');
        setIsTotalManual(false);
        setSellUsdtSourceSelected(true);
    };
    const formatPreviewNumber = (value: number, fractionDigits = 2) => Number.isFinite(value)
        ? value.toLocaleString('fr-FR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
        : '0';
    const transactionSummary = (() => {
        if (!mode || (mode === 'buy_usdt' && !buyUsdtMode) || (mode === 'sell_usdt' && !editingTx && !sellUsdtSourceSelected))
            return null;
        const isSell = mode.startsWith('sell');
        const quantity = isSell
            ? parseAndEvaluate(sellAmount)
            : mode === 'buy_eur'
                ? parseAndEvaluate(buyEurAmount)
                : parseAndEvaluate(buyUsdtAmount);
        const price = isSell
            ? parseAndEvaluate(sellPrice)
            : mode === 'buy_eur'
                ? parseAndEvaluate(buyEurPrice)
                : parseAndEvaluate(buyUsdtPrice);
        const liveTotal = quantity > 0 && price > 0 ? quantity * price : 0;
        const userSellTotal = parseAndEvaluate(sellTotal);
        const userBuyEurTotal = parseAndEvaluate(buyEurTotal);
        const userBuyUsdtTotal = parseAndEvaluate(buyUsdtTotal);
        const sellTotalEffective = isTotalManual && userSellTotal > 0 ? userSellTotal : liveTotal;
        const buyEurTotalEffective = isTotalManual && userBuyEurTotal > 0 ? userBuyEurTotal : liveTotal;
        const buyUsdtTotalEffective = isTotalManual && userBuyUsdtTotal > 0 ? userBuyUsdtTotal : liveTotal;
        const totalInput = isSell
            ? sellTotalEffective
            : mode === 'buy_eur'
                ? buyEurTotalEffective
                : buyUsdtTotalEffective;
        const saleValueDzd = isSell && isUsdtSellSettledInEur
            ? totalInput * effectiveSellEurToDzdRateValue
            : totalInput;
        const soldCostDzd = isSell ? quantity * activeStats.avgBuy : 0;
        const profitEstimate = isSell && price > 0 && activeStats.avgBuy > 0
            ? saleValueDzd - soldCostDzd
            : null;
        if (quantity <= 0 && price <= 0 && totalInput <= 0)
            return null;
        return { quantity, price, total: totalInput, profitEstimate };
    })();
    const disabledReason = getFirstValidationMessage(formValidation?.errors, t('transactions.validationReason') || t('common.fillAllFields'));
    const isChoosingSource = (mode === 'buy_usdt' && !buyUsdtMode) || (mode === 'sell_usdt' && !editingTx && !sellUsdtSourceSelected);
    const segBase = 'bg-neutral-100';
    const segItem = (active: boolean, activeClass: string) => `flex-1 min-h-touch py-2 text-sm font-semibold rounded-lg transition-colors ${active
        ? activeClass
        : ('text-neutral-600 hover:text-neutral-800')} ${editingTx ? 'cursor-not-allowed opacity-70' : ''}`;
    const renderSellQuantityField = () => (
        <MoneyField label={t('transactions.quantity')} value={sellAmount} onChange={(val) => {
            markSellFieldEdited('quantity');
            setSellAmount(val);
            const qty = parseAndEvaluate(val);
            const price = parseAndEvaluate(sellPrice);
            setIsTotalManual(false);
            updateSellTotalFromQuantity(qty, price);
        }} onBlur={() => {
            const qty = parseAndEvaluate(sellAmount);
            if (!isNaN(qty) && qty > 0)
                setSellAmount(qty.toFixed(2));
        }} currency={activeCurrency as 'USDT' | 'EUR'} onMax={applySellBalanceMax} hint={`${t('common.balance')}: ${activeStats.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeCurrency}`} error={formValidation.errors['sellAmount']}/>
    );
    const renderSellPriceField = () => (
        <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm text-neutral-700">{t('transactions.sellPrice')} ({sellPriceUnitLabel})</span>
            </div>
            <MoneyField label="" value={sellPrice} onChange={(val) => {
                markSellFieldEdited('price');
                setSellPrice(val);
                const price = parseAndEvaluate(val);
                updateSellLinkedFieldsAfterPriceChange(price);
                updateSellPriceMargin(price);
            }} className="-mt-2" error={formValidation.errors['sellPrice']}/>
            <div className="mt-1.5 grid gap-1 text-xs text-neutral-500 sm:grid-cols-2 sm:items-center">
                <span dir="ltr" className="min-w-0 tabular-nums">{t('portfolio.currentPam')}: {activeStats.avgBuy.toFixed(2)} {t('common.dinar')}</span>
                {parseAndEvaluate(profitPercent) !== 0 && (<span dir="ltr" className={`min-w-0 tabular-nums sm:text-end ${parseAndEvaluate(profitPercent) > 0 ? 'text-financial-profit font-medium' : 'text-financial-loss font-medium'}`}>
                        {t('transactions.unitMargin')}: {parseAndEvaluate(profitPercent) > 0 ? '+' : ''}{parseAndEvaluate(profitPercent).toFixed(2)} {t('common.dinar')}
                    </span>)}
            </div>
        </div>
    );
    const renderSellTotalField = () => (
        <MoneyField label={isUsdtSellSettledInEur ? t('transactions.eurReceived') : t('transactions.totalAmount')} value={sellTotal} onChange={(val) => {
            markSellFieldEdited(activeSellTotalField());
            setSellTotal(val);
            if (val) {
                setIsTotalManual(true);
                const total = parseAndEvaluate(val);
                const price = parseAndEvaluate(sellPrice);
                updateSellQuantityFromTotal(total, price);
            }
            else {
                setIsTotalManual(false);
            }
        }} onBlur={() => {
            const total = parseAndEvaluate(sellTotal);
            if (!isNaN(total) && total > 0)
                setSellTotal(isUsdtSellSettledInEur ? total.toFixed(2) : Math.round(total).toString());
        }} currency={sellTotalCurrencyLabel === 'EUR' ? 'EUR' : 'DZD'} onMax={isUsdtSellSettledInEur ? undefined : applyClientMaxToSellTotal} maxDisabled={!hasPrimaryClient || selectedClientTotal <= 0} error={formValidation.errors['sellTotal']}/>
    );
    const renderReadonlyEurRateField = () => (
        <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-700">{t('portfolio.rateEurDzd')} (DZD)</p>
            <div className={`flex min-h-input w-full items-center justify-between rounded-button border px-3 py-2 ${formValidation.errors['sellEurToDzdRate'] ? 'border-danger ring-1 ring-danger' : 'border-border-strong'} bg-surface-muted text-neutral-600`}>
                <span dir="ltr" className="tabular-nums">{pamEurToDzdRateInput || '0.00'}</span>
                <span className="text-xs text-neutral-400">DZD</span>
            </div>
            <p className={`mt-1 text-xs ${formValidation.errors['sellEurToDzdRate'] ? 'font-medium text-danger' : 'text-neutral-500'}`}>
                {formValidation.errors['sellEurToDzdRate'] || `${t('portfolio.currentPam')} EUR (lecture seule) : ${pamEurToDzdRateInput || '0.00'} DZD`}
            </p>
        </div>
    );
    const activeSmartPricing = smartPricingByCurrency?.[activeCurrency as 'USDT' | 'EUR'];
    // Learned repayment behavior of the linked client (DZD ledger, currency-independent).
    const linkedDebtState = hasPrimaryClient ? activeSmartPricing?.debtByClientId?.get(linkedClientId) : undefined;
    const learnedSettleDays = linkedDebtState && linkedDebtState.avgSettleDays !== null && linkedDebtState.settledLotCount > 0
        ? Math.max(1, Math.round(linkedDebtState.avgSettleDays))
        : null;
    // Credit due-date prefill: today + the client's average settle delay.
    // Only fills an EMPTY field (user edits always win); clients without
    // settled credit history keep it empty — the engine prices by policy default.
    React.useEffect(() => {
        if (!isSellMode || isUsdtSellSettledInEur || editingTx) return;
        if (clientPaymentStatus !== 'credit' || creditDueDate) return;
        if (learnedSettleDays === null) return;
        setCreditDueDate(new Date(Date.now() + learnedSettleDays * 86_400_000).toISOString().slice(0, 10));
    }, [isSellMode, isUsdtSellSettledInEur, editingTx, clientPaymentStatus, linkedClientId, creditDueDate, learnedSettleDays, setCreditDueDate]);
    return (<><Modal isOpen={mode !== null} onClose={closeForm} className="bg-surface max-w-md">
            <ModalHeader onClose={closeForm} className="sticky top-0 z-20 border-b border-border backdrop-blur px-4 py-3 sm:px-5 bg-surface/95">
                <ModalTitle className="text-base sm:text-lg">{editingTx ? t('common.edit') : t('transactions.newTransaction')}</ModalTitle>
            </ModalHeader>

            <ModalContent className="px-4 py-4 space-y-4 sm:px-5">
                {mode && (<>
                        {/* Compact segmented controls — Operation + Currency */}
                        <div className="space-y-2">
                            <div className={`flex gap-1 rounded-xl p-1 ${segBase}`}>
                                <button type="button" onClick={() => switchOperation('buy')} disabled={!!editingTx} className={segItem(isBuyMode, 'bg-success text-white shadow-sm')}>
                                    {t('transactions.buy')}
                                </button>
                                <button type="button" onClick={() => switchOperation('sell')} disabled={!!editingTx} className={segItem(isSellMode, 'bg-danger text-white shadow-sm')}>
                                    {t('transactions.sell')}
                                </button>
                            </div>
                            <div className={`flex gap-1 rounded-xl p-1 ${segBase}`}>
                                <button type="button" onClick={() => switchCurrency('USDT')} disabled={!!editingTx} className={segItem(activeCurrency === 'USDT', 'bg-primary text-white shadow-sm')}>
                                    USDT
                                </button>
                                <button type="button" onClick={() => switchCurrency('EUR')} disabled={!!editingTx} className={segItem(activeCurrency === 'EUR', 'bg-primary text-white shadow-sm')}>
                                    EUR
                                </button>
                            </div>
                        </div>

                        {/* Inline balance + PAM hint (not a card) */}
                        <div className={`flex items-center justify-between text-xs text-neutral-500 px-1`}>
                            <span>{t('common.balance')}: <span dir="ltr" className="font-semibold text-neutral-700 tabular-nums">{activeStats.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {activeCurrency}</span></span>
                            <span>{t('portfolio.currentPam')}: <span dir="ltr" className="font-semibold text-neutral-700 tabular-nums">{activeStats.avgBuy.toFixed(2)} {t('common.dinar')}</span></span>
                        </div>

                        {/* Buy USDT: choose funding source */}
                        {mode === 'buy_usdt' && !buyUsdtMode && (<div className="space-y-3 pt-1">
                                <div>
                                    <SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>
                                        {t('transactions.fundingQuestion')}
                                    </SectionHeading>
                                    <p className="mt-1 text-sm text-neutral-500">{t('transactions.fundingHint')}</p>
                                </div>
                                <div className="space-y-2">
                                    <button type="button" onClick={() => setBuyUsdtMode('with_dzd')} className="flex min-h-touch w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-start transition-colors bg-surface-muted hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-financial-asset-bg text-primary">
                                                <BanknotesIcon className="h-5 w-5"/>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-base font-semibold">{t('portfolio.buyWithDzd')}</p>
                                                <p className={`text-xs text-neutral-500`}>{t('common.dinar')}</p>
                                            </div>
                                        </div>
                                        <ChevronRightIcon className={`h-5 w-5 shrink-0 text-neutral-400`}/>
                                    </button>
                                    <button type="button" onClick={() => { setBuyUsdtMode('with_eur'); setEurDzdPrice(portfolioStats.eur.avgBuy.toFixed(2)); }} className="flex min-h-touch w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-start transition-colors bg-surface-muted hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-financial-asset-bg text-primary">
                                                <WalletIcon className="h-5 w-5"/>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-base font-semibold">{t('portfolio.buyWithEur')}</p>
                                                <p className={`text-xs text-neutral-500`}>EUR</p>
                                            </div>
                                        </div>
                                        <ChevronRightIcon className={`h-5 w-5 shrink-0 text-neutral-400`}/>
                                    </button>
                                </div>
                            </div>)}

                        {/* Sell USDT: choose settlement source */}
                        {mode === 'sell_usdt' && !sellUsdtSourceSelected && !editingTx && (<div className="space-y-3 pt-1">
                                <div>
                                    <SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>
                                        {t('transactions.saleSourceQuestion')}
                                    </SectionHeading>
                                    <p className="mt-1 text-sm text-neutral-500">{t('transactions.saleSourceHint')}</p>
                                </div>
                                <div className="space-y-2">
                                    <button type="button" onClick={chooseSellWithDzd} className="flex min-h-touch w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-start transition-colors bg-surface-muted hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-financial-asset-bg text-primary">
                                                <BanknotesIcon className="h-5 w-5"/>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-base font-semibold">{t('portfolio.sellWithDzd')}</p>
                                                <p className={`text-xs text-neutral-500`}>{t('common.dinar')}</p>
                                            </div>
                                        </div>
                                        <ChevronRightIcon className={`h-5 w-5 shrink-0 text-neutral-400`}/>
                                    </button>
                                    <button type="button" onClick={chooseSellWithEur} className="flex min-h-touch w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-start transition-colors bg-surface-muted hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-financial-asset-bg text-primary">
                                                <WalletIcon className="h-5 w-5"/>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-base font-semibold">{t('portfolio.sellWithEur')}</p>
                                                <p className={`text-xs text-neutral-500`}>EUR</p>
                                            </div>
                                        </div>
                                        <ChevronRightIcon className={`h-5 w-5 shrink-0 text-neutral-400`}/>
                                    </button>
                                </div>
                            </div>)}

                        {/* Buy USDT with DZD */}
                        {buyUsdtMode === 'with_dzd' && (<div className="space-y-3">
                                                        <MoneyField label={t('transactions.quantity')} value={buyUsdtAmount} onChange={(val) => {
                                            setBuyUsdtAmount(val);
                                            const qty = parseAndEvaluate(val);
                                            const price = parseAndEvaluate(buyUsdtPrice);
                                            setIsTotalManual(false);
                                            if (qty > 0 && price > 0)
                                                setBuyUsdtTotal((qty * price).toFixed(0));
                                            else if (qty === 0 || val === '')
                                                setBuyUsdtTotal('');
                                        }} onBlur={() => {
                                            const qty = parseAndEvaluate(buyUsdtAmount);
                                            if (!isNaN(qty) && qty > 0)
                                                setBuyUsdtAmount(qty.toFixed(2));
                                        }} currency="USDT" onMax={applyBuyUsdtDzdQuantityMax} maxDisabled={buyUsdtDzdQtyMaxDisabled} error={formValidation.errors['buyUsdtAmount']}/>
                                <MoneyField label={t('transactions.buyPrice')} value={buyUsdtPrice} onChange={(val) => {
                    setBuyUsdtPrice(val);
                    const qty = parseAndEvaluate(buyUsdtAmount);
                    const price = parseAndEvaluate(val);
                    setIsTotalManual(false);
                    if (qty > 0 && price > 0)
                        setBuyUsdtTotal((qty * price).toFixed(0));
                    else if (price === 0 || val === '')
                        setBuyUsdtTotal('');
                }} currency="DZD" error={formValidation.errors['buyUsdtPrice']}/>
                                <MoneyField label={t('transactions.totalAmount')} value={buyUsdtTotal} onChange={(val) => {
                    setBuyUsdtTotal(val);
                    if (val) {
                        setIsTotalManual(true);
                        const total = parseAndEvaluate(val);
                        const price = parseAndEvaluate(buyUsdtPrice);
                        if (total > 0 && price > 0)
                            setBuyUsdtAmount((total / price).toFixed(2));
                    }
                    else {
                        setIsTotalManual(false);
                        const qty = parseAndEvaluate(buyUsdtAmount);
                        const price = parseAndEvaluate(buyUsdtPrice);
                        if (qty > 0 && price > 0)
                            setBuyUsdtTotal((qty * price).toFixed(0));
                    }
                }} onBlur={() => {
                    const total = parseAndEvaluate(buyUsdtTotal);
                    if (!isNaN(total) && total > 0)
                        setBuyUsdtTotal(Math.round(total).toString());
                }} currency="DZD" onMax={applyClientMaxToBuyTotal} maxDisabled={!hasPrimaryClient || selectedClientTotal <= 0} error={formValidation.errors['buyUsdtTotal']} hint={t('transactions.autoCalc')} placeholder={t('transactions.autoCalc')}/>
                                <ClientLinker {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus }} errorMessage={formValidation.errors['linkedClientId']} hasError={!!formValidation.errors['linkedClientId']} errorMessageDzd={formValidation.errors['linkedClientDzdId']} hasErrorDzd={!!formValidation.errors['linkedClientDzdId']}/>
                                <div className="space-y-1.5">
                                    <p className="text-sm font-medium text-neutral-700">{t('transactions.stockAvailability')}</p>
                                    <div className="flex gap-1 rounded-xl p-1 bg-neutral-100">
                                        <button type="button" onClick={() => setBuyRestriction('free')} className={`flex-1 min-h-touch py-2 text-sm font-semibold rounded-lg transition-colors ${buyRestriction !== 'locked_24h' ? 'bg-success text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-800'}`}>
                                            Disponible
                                        </button>
                                        <button type="button" onClick={() => setBuyRestriction('locked_24h')} className={`flex-1 min-h-touch py-2 text-sm font-semibold rounded-lg transition-colors ${buyRestriction === 'locked_24h' ? 'bg-warning text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-800'}`}>
                                            Bloqué 24h
                                        </button>
                                    </div>
                                    {buyRestriction === 'locked_24h' && (<>
                                        <p className="text-xs text-warning px-1">{t('transactions.stockLock24h')}</p>
                                        <div className="flex items-center gap-2 px-1 pt-0.5">
                                            <label className="text-xs font-medium text-neutral-600 whitespace-nowrap">{t('transactions.actualPurchaseTime')}</label>
                                            <input type="time" value={realPurchaseTime ?? ''} onChange={(e) => setRealPurchaseTime(e.target.value)} className="h-8 rounded-lg border border-border bg-surface px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/50"/>
                                            {unlockPreviewTime && (<span className="text-xs text-warning whitespace-nowrap">→ {unlockPreviewTime}</span>)}
                                        </div>
                                    </>)}
                                </div>
                            </div>)}

                        {/* Buy USDT with EUR */}
                        {buyUsdtMode === 'with_eur' && (<div className="space-y-3">
                                                        <MoneyField label={t('transactions.quantity')} value={buyEurForUsdtAmount} onChange={setBuyEurForUsdtAmount} currency="EUR" onMax={applyBuyUsdtEurQuantityMax} maxDisabled={buyEurForUsdtQtyMaxDisabled} error={formValidation.errors['buyEurForUsdtAmount']} hint={`${t('portfolio.currentBalanceEur')}: ${portfolioStats.eur.available.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`}/>
                                <MoneyField label={t('portfolio.rateEurUsdt')} value={eurUsdtRate} onChange={setEurUsdtRate} error={formValidation.errors['eurUsdtRate']} placeholder="Ex: 0.92"/>
                                <MoneyField label={t('portfolio.buyPriceEur')} value={eurDzdPrice} onChange={setEurDzdPrice} currency="DZD" error={formValidation.errors['eurDzdPrice']} hint={t('transactions.basedOnPamEur')} readOnly/>
                                {(() => {
                    const eurQty = parseAndEvaluate(buyEurForUsdtAmount);
                    const eurPrice = parseAndEvaluate(eurDzdPrice);
                    const rate = parseAndEvaluate(eurUsdtRate);
                    const usdtQty = (eurQty > 0 && rate > 0) ? (eurQty / rate) : 0;
                    if (usdtQty <= 0)
                        return null;
                    const totalAfter = portfolioStats.usdt.available + usdtQty;
                    const incomingUnitCostDzd = eurPrice > 0 && rate > 0 ? eurPrice * rate : 0;
                    const projectedPamUsdt = incomingUnitCostDzd > 0
                        ? (Number(portfolioStats.usdt.costBasis || 0) + (usdtQty * incomingUnitCostDzd))
                          / (Number(portfolioStats.usdt.purchasedQty || 0) + usdtQty)
                        : 0;
                    return (<div className="rounded-xl border border-success/20 bg-financial-profit-bg p-3">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="text-xs text-financial-profit">{t('transactions.quantity')} USDT</span>
                                                <span dir="ltr" className="text-lg font-bold text-financial-profit tabular-nums">{formatNumber(usdtQty, { min: 0, max: 2 })}</span>
                                            </div>
                                            <div className={`mt-1 flex items-baseline justify-between gap-3 text-xs text-neutral-500`}>
                                                <span>{t('transactions.newBalance')}</span>
                                                <span dir="ltr" className="font-semibold tabular-nums">{totalAfter.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span>
                                            </div>
                                            {projectedPamUsdt > 0 && (
                                                <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-neutral-500">
                                                    <span>{t('portfolio.currentPam')} USDT</span>
                                                    <span dir="ltr" className="font-semibold tabular-nums">{formatNumber(projectedPamUsdt, { min: 2, max: 2 })} DZD</span>
                                                </div>
                                            )}
                                        </div>);
                })()}
                                <div className="space-y-1.5">
                                    <p className="text-sm font-medium text-neutral-700">{t('transactions.stockAvailability')}</p>
                                    <div className="flex gap-1 rounded-xl p-1 bg-neutral-100">
                                        <button type="button" onClick={() => setBuyRestriction('free')} className={`flex-1 min-h-touch py-2 text-sm font-semibold rounded-lg transition-colors ${buyRestriction !== 'locked_24h' ? 'bg-success text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-800'}`}>
                                            Disponible
                                        </button>
                                        <button type="button" onClick={() => setBuyRestriction('locked_24h')} className={`flex-1 min-h-touch py-2 text-sm font-semibold rounded-lg transition-colors ${buyRestriction === 'locked_24h' ? 'bg-warning text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-800'}`}>
                                            Bloqué 24h
                                        </button>
                                    </div>
                                    {buyRestriction === 'locked_24h' && (<>
                                        <p className="text-xs text-warning px-1">{t('transactions.stockLock24h')}</p>
                                        <div className="flex items-center gap-2 px-1 pt-0.5">
                                            <label className="text-xs font-medium text-neutral-600 whitespace-nowrap">{t('transactions.actualPurchaseTime')}</label>
                                            <input type="time" value={realPurchaseTime ?? ''} onChange={(e) => setRealPurchaseTime(e.target.value)} className="h-8 rounded-lg border border-border bg-surface px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/50"/>
                                            {unlockPreviewTime && (<span className="text-xs text-warning whitespace-nowrap">→ {unlockPreviewTime}</span>)}
                                        </div>
                                    </>)}
                                </div>
                            </div>)}

                        {/* Sell USDT/EUR */}
                        {isSellMode && (mode !== 'sell_usdt' || sellUsdtSourceSelected || !!editingTx) && (<div className="space-y-3">
                                {mode === 'sell_usdt' && (<div>
                                        <p className="text-xs font-medium mb-1.5 text-neutral-500">{t('transactions.settlementCurrency')}</p>
                                        <div className={`flex gap-1 rounded-xl p-1 ${segBase}`}>
                                            <button type="button" onClick={chooseSellWithDzd} className={segItem(sellSettlementCurrency !== 'EUR', 'bg-primary text-white shadow-sm')}>
                                                DZD
                                            </button>
                                            <button type="button" onClick={chooseSellWithEur} className={segItem(sellSettlementCurrency === 'EUR', 'bg-primary text-white shadow-sm')}>
                                                EUR
                                            </button>
                                        </div>
                                    </div>)}

                                {isUsdtSellSettledInEur ? (<>
                                    {renderSellTotalField()}
                                    {renderSellPriceField()}
                                    {renderSellQuantityField()}
                                    {renderReadonlyEurRateField()}
                                </>) : (<>
                                    {renderSellQuantityField()}
                                    {renderSellPriceField()}
                                    {renderSellTotalField()}
                                </>)}

                                <ClientLinker {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus }} allowBaridiDzdLink hidePaymentStatus={isUsdtSellSettledInEur} hideLinkedDzdClient={isUsdtSellSettledInEur} errorMessage={formValidation.errors['linkedClientId']} hasError={!!formValidation.errors['linkedClientId']} errorMessageDzd={formValidation.errors['linkedClientDzdId']} hasErrorDzd={!!formValidation.errors['linkedClientDzdId']}/>
                                {!isUsdtSellSettledInEur && clientPaymentStatus === 'credit' && (
                                    <label className="block text-sm font-medium text-neutral-700">
                                        {t('smartPricing.dueDate')}
                                        <input
                                            type="date"
                                            value={creditDueDate || ''}
                                            min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                                            onChange={(event) => setCreditDueDate(event.target.value)}
                                            className={`mt-1.5 min-h-input w-full rounded-xl border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${formValidation.errors.creditDueDate ? 'border-danger' : 'border-border'}`}
                                            aria-invalid={!!formValidation.errors.creditDueDate}
                                        />
                                        {formValidation.errors.creditDueDate && <span role="alert" className="mt-1 block text-xs text-financial-loss">{formValidation.errors.creditDueDate}</span>}
                                        {learnedSettleDays !== null && (
                                            <span className="mt-1 block text-xs font-normal text-neutral-500">
                                                {(t('smartPricing.avgSettleHint') as string).replace('{days}', String(learnedSettleDays))}
                                            </span>
                                        )}
                                    </label>
                                )}
                                {!isUsdtSellSettledInEur && activeSmartPricing && (
                                    <SmartPricePanel
                                        smartPricing={activeSmartPricing}
                                        currency={activeCurrency as 'USDT' | 'EUR'}
                                        clientId={linkedClientId || 'none'}
                                        quantity={parseAndEvaluate(sellAmount)}
                                        payment={(clientPaymentStatus || 'cash') as 'cash' | 'baridi' | 'credit'}
                                        creditDueDate={creditDueDate}
                                        available={activeStats.available}
                                        currentPrice={parseAndEvaluate(sellPrice)}
                                        isEditing={!!editingTx}
                                        onApplyPrice={(p: number) => {
                                            markSellFieldEdited('price');
                                            setSellPrice(p.toFixed(2));
                                            updateSellPriceMargin(p);
                                            updateSellLinkedFieldsAfterPriceChange(p);
                                        }}
                                        smartQuoteRef={smartQuoteRef}
                                    />
                                )}
                            </div>)}

                        {/* Buy EUR */}
                        {mode === 'buy_eur' && (<div className="space-y-3">
                                                        <MoneyField label={t('transactions.quantity')} value={buyEurAmount} onChange={(val) => {
                                            setBuyEurAmount(val);
                                            const qty = parseAndEvaluate(val);
                                            const price = parseAndEvaluate(buyEurPrice);
                                            setIsTotalManual(false);
                                            if (qty > 0 && price > 0)
                                                setBuyEurTotal((qty * price).toFixed(0));
                                            else if (qty === 0 || val === '')
                                                setBuyEurTotal('');
                                        }} currency="EUR" onMax={applyBuyEurQuantityMax} maxDisabled={buyEurQtyMaxDisabled} error={formValidation.errors['buyEurAmount']}/>
                                                        <MoneyField label={t('portfolio.buyPriceEur')} value={buyEurPrice} onChange={(val) => {
                                            setBuyEurPrice(val);
                                            const qty = parseAndEvaluate(buyEurAmount);
                                            const price = parseAndEvaluate(val);
                                            setIsTotalManual(false);
                                            if (qty > 0 && price > 0)
                                                setBuyEurTotal((qty * price).toFixed(0));
                                            else if (price === 0 || val === '')
                                                setBuyEurTotal('');
                                        }} currency="DZD" error={formValidation.errors['buyEurPrice']} hint={t('transactions.basedOnPamEur')}/>
                                                        <MoneyField label={t('transactions.totalAmount')} value={buyEurTotal} onChange={(val) => {
                                            setBuyEurTotal(val);
                                            if (val) {
                                                setIsTotalManual(true);
                                                const total = parseAndEvaluate(val);
                                                const price = parseAndEvaluate(buyEurPrice);
                                                if (total > 0 && price > 0)
                                                    setBuyEurAmount((total / price).toFixed(2));
                                            }
                                            else {
                                                setIsTotalManual(false);
                                                const qty = parseAndEvaluate(buyEurAmount);
                                                const price = parseAndEvaluate(buyEurPrice);
                                                if (qty > 0 && price > 0)
                                                    setBuyEurTotal((qty * price).toFixed(0));
                                            }
                                        }} onBlur={() => {
                                            const total = parseAndEvaluate(buyEurTotal);
                                            if (!isNaN(total) && total > 0)
                                                setBuyEurTotal(Math.round(total).toString());
                                        }} currency="DZD" onMax={applyBuyEurTotalMax} maxDisabled={buyEurTotalMaxDisabled} error={formValidation.errors['buyEurTotal']} hint={t('transactions.autoCalc')} placeholder={t('transactions.autoCalc')}/>
                                <ClientLinker {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus }} errorMessage={formValidation.errors['linkedClientId']} hasError={!!formValidation.errors['linkedClientId']} errorMessageDzd={formValidation.errors['linkedClientDzdId']} hasErrorDzd={!!formValidation.errors['linkedClientDzdId']}/>
                            </div>)}

                        {/* Notes + Tags (optional) */}
                        {!isChoosingSource && (<>
                            <Textarea
                                label={t('common.notesOptional') as string}
                                value={notes ?? ''}
                                onChange={(e) => setNotes?.(e.target.value)}
                                rows={2}
                                placeholder="Ex: remarque, contexte..."
                                className="resize-none text-sm"
                            />
                            {setTxTags && (
                                <TagInput
                                    tags={Array.isArray(txTags) ? txTags : []}
                                    setTags={(newTags) => setTxTags(newTags)}
                                    t={t}
                                />
                            )}
                        </>)}

                        {/* Compact summary (only when there's data) */}
                        {transactionSummary && transactionSummary.profitEstimate !== null && (<div className={`rounded-xl px-3 py-2 text-sm flex items-center justify-between gap-2 ${transactionSummary.profitEstimate >= 0 ? 'bg-financial-profit-bg' : 'bg-financial-loss-bg'}`}>
                                <span className={`text-xs font-medium ${transactionSummary.profitEstimate >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                    {t('transactions.estimatedProfit')}
                                </span>
                                <span dir="ltr" className={`font-bold tabular-nums ${transactionSummary.profitEstimate >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                    {transactionSummary.profitEstimate >= 0 ? '+' : ''}{formatPreviewNumber(transactionSummary.profitEstimate, 0)} DZD
                                </span>
                            </div>)}
                    </>)}
            </ModalContent>

            <ModalFooter className="sticky bottom-0 z-20 border-t border-border backdrop-blur px-4 py-3 sm:px-5 bg-surface/95">
                {!isChoosingSource && (<div className="flex gap-2 w-full">
                        <Button onClick={closeForm} variant="outline" className="flex-1 py-3 rounded-xl font-bold transition-colors bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={mode?.startsWith('buy') ? handleBuy : handleSell} disabled={!formValidation.isValid || isSaving} className={`flex-1 py-3 rounded-xl font-bold text-white shadow-sm transition-colors ${!formValidation.isValid || isSaving ? 'bg-neutral-400 cursor-not-allowed opacity-70' : 'bg-primary hover:bg-primary-dark'}`} title={!formValidation.isValid ? disabledReason : undefined}>
                            {isSaving ? (<div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin"/>
                                    <span>{t('common.processing')}</span>
                                </div>) : (t('transactions.confirm'))}
                        </Button>
                    </div>)}
            </ModalFooter>
        </Modal>
        <ConfirmDialog
            isOpen={!!pendingCreditRisk}
            onClose={cancelCreditRisk}
            onConfirm={confirmCreditRisk}
            title={t('smartPricing.creditRiskTitle')}
            description={pendingCreditRisk ? `${t('smartPricing.creditRiskDescription')} ${t('smartPricing.projectedDebt')}: ${formatNumber(pendingCreditRisk.creditRisk.projectedDebt, { min: 0, max: 0 })} DZD · ${t('smartPricing.creditLimit')}: ${formatNumber(pendingCreditRisk.creditRisk.creditLimit, { min: 0, max: 0 })} DZD · ${t('smartPricing.overdueDays')}: ${pendingCreditRisk.creditRisk.oldestOverdueDays}` : ''}
            confirmLabel={t('smartPricing.creditRiskConfirm')}
            cancelLabel={t('common.cancel')}
            variant="warning"
            loading={isSaving}
        />
    </>);
}
