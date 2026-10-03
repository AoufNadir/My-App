import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { MoneyField } from '../ui/MoneyField';
import { Textarea } from '../ui/Textarea';
import { FormCard } from '../ui/FormCard';
import { SegmentedControl } from '../ui/SegmentedControl';
import { OperationFooter, type OperationFooterStat } from '../ui/OperationFooter';
import { ClientLinker } from './ClientLinker';
import { SmartPricePanel } from './SmartPricePanel';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { parseAndEvaluate } from '../../utils';
import { formatNumber } from '../../pages/shared/pageFormat';
import { translateFormMessage } from '../../utils/formMessages';
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
                        <span key={tag} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-primary/10 pe-1 ps-3 text-xs font-bold text-primary dark:text-primary-light">
                            {getTransactionTagLabel(tag, t)}
                            <button type="button" onClick={() => removeTag(tag)} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-base leading-none text-primary/70 hover:bg-primary/10 hover:text-primary" aria-label={`${t('transactions.removeTag')} ${getTransactionTagLabel(tag, t)}`}>×</button>
                        </span>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.filter(({ value }) => !tags.includes(value)).map(({ value, labelKey }) => (
                    <button key={value} type="button" onClick={() => addTag(value)} className="inline-flex min-h-8 items-center rounded-full border border-dashed border-border-strong px-3 text-xs font-semibold text-neutral-600 transition-colors hover:border-primary hover:text-primary">
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
                aria-label={t('transactions.addTagPlaceholder')}
                className="min-h-10 w-full rounded-button border border-border-strong bg-surface px-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
        </div>
    );
}

type MainTransactionDialogProps = Record<string, any>;
type LastEditedSellField = 'eurReceived' | 'quantity' | 'total' | 'price';
type SellCalculationBasis = Exclude<LastEditedSellField, 'price'>;
export function MainTransactionDialog({ mode, editingTx, closeForm, openForm, t, fieldBase, buyUsdtMode, setBuyUsdtMode, setEurDzdPrice, portfolioStats, buyUsdtAmount, setBuyUsdtAmount, isTotalManual, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal, setIsTotalManual, formValidation, linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, clientPaymentStatus, setClientPaymentStatus, creditDueDate, setCreditDueDate, pendingCreditRisk, confirmCreditRisk, cancelCreditRisk, notes, setNotes, txTags, setTxTags, buyEurForUsdtAmount, setBuyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, setEurUsdtRate, sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal, sellSettlementCurrency, setSellSettlementCurrency, sellEurToDzdRate, setSellEurToDzdRate, profitPercent, setProfitPercent, buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal, clientBalances, handleBuy, handleSell, isSaving, buyRestriction, setBuyRestriction, realPurchaseTime, setRealPurchaseTime, smartPricingByCurrency, smartQuoteRef }: MainTransactionDialogProps) {
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
    const isChoosingSource = (mode === 'buy_usdt' && !buyUsdtMode) || (mode === 'sell_usdt' && !editingTx && !sellUsdtSourceSelected);
    // Display only: nothing from here to the end of the window changes what is saved.
    // A calm form: an empty field never turns red. What is still missing, or the first typed value
    // to correct, is said once next to the Confirm button, in the reader's language.
    const fieldValues: Record<string, unknown> = { buyUsdtAmount, buyUsdtPrice, buyUsdtTotal, buyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, buyEurAmount, buyEurPrice, buyEurTotal, sellAmount, sellPrice, sellTotal, sellEurToDzdRate: pamEurToDzdRateInput, linkedClientId, linkedClientDzdId, creditDueDate };
    const isFieldFilled = (field: string) => {
        const value = fieldValues[field];
        return value !== undefined && value !== null && value !== '' && value !== 'none';
    };
    const fieldError = (field: string) => (isFieldFilled(field) ? translateFormMessage(formValidation.errors[field], t) : undefined);
    const errorEntries = Object.entries((formValidation?.errors || {}) as Record<string, string>).filter(([, message]) => Boolean(message));
    const entryToFix = errorEntries.find(([field]) => isFieldFilled(field));
    const reasonEntry = entryToFix ?? errorEntries[0];
    const saveBlockedReason = formValidation.isValid
        ? undefined
        : (reasonEntry ? translateFormMessage(reasonEntry[1], t) : undefined) || (t('transactions.validationReason') as string) || (t('common.fillAllFields') as string);
    // The total stays visible at the bottom: the same number as the Total field.
    const totalFieldValue = isSellMode ? sellTotal : mode === 'buy_eur' ? buyEurTotal : buyUsdtMode === 'with_dzd' ? buyUsdtTotal : '';
    const totalFieldNumber = parseAndEvaluate(totalFieldValue || '');
    const totalFieldCurrency = isUsdtSellSettledInEur ? 'EUR' : 'DZD';
    const footerStats: OperationFooterStat[] = [];
    if (!isChoosingSource && Number.isFinite(totalFieldNumber) && totalFieldNumber > 0)
        footerStats.push({
            label: isUsdtSellSettledInEur ? t('transactions.eurReceived') : t('transactions.totalAmount'),
            value: `${totalFieldNumber.toLocaleString('fr-FR', { minimumFractionDigits: totalFieldCurrency === 'EUR' ? 2 : 0, maximumFractionDigits: 2 })} ${totalFieldCurrency}`,
        });
    if (!isChoosingSource && transactionSummary && transactionSummary.profitEstimate !== null)
        footerStats.push({
            label: t('transactions.estimatedProfit'),
            value: `${transactionSummary.profitEstimate >= 0 ? '+' : ''}${formatPreviewNumber(transactionSummary.profitEstimate, 0)} DZD`,
            tone: transactionSummary.profitEstimate >= 0 ? 'profit' : 'loss',
        });
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
        }} currency={activeCurrency as 'USDT' | 'EUR'} onMax={applySellBalanceMax} hint={`${t('common.balance')}: ${activeStats.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeCurrency}`} error={fieldError('sellAmount')}/>
    );
    const renderSellPriceField = () => (
        <div>
            <MoneyField label={`${t('transactions.sellPrice')} (${sellPriceUnitLabel})`} value={sellPrice} onChange={(val) => {
                markSellFieldEdited('price');
                setSellPrice(val);
                const price = parseAndEvaluate(val);
                updateSellLinkedFieldsAfterPriceChange(price);
                updateSellPriceMargin(price);
            }} error={fieldError('sellPrice')}/>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-neutral-500">
                <span className="min-w-0">{t('portfolio.currentPam')}: <span dir="ltr" className="font-semibold tabular-nums text-neutral-700">{activeStats.avgBuy.toFixed(2)} {t('common.dinar')}</span></span>
                {parseAndEvaluate(profitPercent) !== 0 && (<span className={`min-w-0 font-semibold ${parseAndEvaluate(profitPercent) > 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                        {t('transactions.unitMargin')}: <span dir="ltr" className="tabular-nums">{parseAndEvaluate(profitPercent) > 0 ? '+' : ''}{parseAndEvaluate(profitPercent).toFixed(2)} {t('common.dinar')}</span>
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
        }} currency={sellTotalCurrencyLabel === 'EUR' ? 'EUR' : 'DZD'} onMax={isUsdtSellSettledInEur ? undefined : applyClientMaxToSellTotal} maxDisabled={!hasPrimaryClient || selectedClientTotal <= 0} error={fieldError('sellTotal')}/>
    );
    const readonlyEurRateError = translateFormMessage(formValidation.errors['sellEurToDzdRate'], t);
    const renderReadonlyEurRateField = () => (
        <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-700">{t('portfolio.rateEurDzd')} (DZD)</p>
            <div className={`flex min-h-input w-full items-center justify-between rounded-button border px-3 py-2 ${readonlyEurRateError ? 'border-danger ring-1 ring-danger' : 'border-border-strong'} bg-surface-muted text-neutral-600`}>
                <span dir="ltr" className="tabular-nums">{pamEurToDzdRateInput || '0.00'}</span>
                <span className="text-xs text-neutral-400">DZD</span>
            </div>
            <p className={`mt-1 text-xs ${readonlyEurRateError ? 'font-medium text-danger' : 'text-neutral-500'}`}>
                {readonlyEurRateError || <>{t('portfolio.currentPam')} EUR ({t('transactions.readOnly')}) : <span dir="ltr" className="tabular-nums">{pamEurToDzdRateInput || '0.00'} DZD</span></>}
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
    const renderSourceChoice = (onClick: () => void, icon: React.ReactNode, title: string, detail: string) => (
        <button type="button" onClick={onClick} className="flex min-h-touch w-full items-center gap-3 rounded-button px-2 py-2.5 text-start transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-financial-asset-bg text-financial-asset">{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-neutral-900">{title}</span>
                <span className="block text-xs text-neutral-500">{detail}</span>
            </span>
            <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>
        </button>
    );
    const renderStockAvailability = () => (
        <FormCard title={t('transactions.stockAvailability')}>
            <SegmentedControl size="md" ariaLabel={t('transactions.stockAvailability') as string} value={buyRestriction === 'locked_24h' ? 'locked_24h' : 'free'} onChange={(restriction) => setBuyRestriction(restriction)} options={[
                { id: 'free', label: t('transactions.stockFree'), tone: 'profit' },
                { id: 'locked_24h', label: t('transactions.stockLocked24h'), tone: 'debt' },
            ]}/>
            {buyRestriction === 'locked_24h' && (<div className="space-y-2 rounded-button bg-financial-debt-bg px-3 py-2.5">
                <p className="text-xs leading-relaxed text-financial-debt">{t('transactions.stockLock24h')}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <label htmlFor="real_purchase_time" className="text-xs font-semibold text-neutral-700">{t('transactions.actualPurchaseTime')}</label>
                    <input id="real_purchase_time" type="time" value={realPurchaseTime ?? ''} onChange={(e) => setRealPurchaseTime(e.target.value)} className="h-9 rounded-button border border-border-strong bg-surface px-2 text-sm tabular-nums text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/50"/>
                    {unlockPreviewTime && (<span className="text-xs font-semibold text-financial-debt">{t('transactions.unlocksAt')} <span dir="ltr" className="tabular-nums">{unlockPreviewTime}</span></span>)}
                </div>
            </div>)}
        </FormCard>
    );
    const clientLinkerErrors = { errorMessage: fieldError('linkedClientId'), hasError: !!fieldError('linkedClientId'), errorMessageDzd: fieldError('linkedClientDzdId'), hasErrorDzd: !!fieldError('linkedClientDzdId') };
    const creditDueDateError = translateFormMessage(formValidation.errors.creditDueDate, t);
    // The due date of a deferred payment: asked when selling on credit, and when buying EUR on
    // credit, whose save check has always required it. The average delay below is how fast the
    // client pays us back, so it is shown for a sale only.
    const renderCreditDueDateField = (showSettleHint: boolean) => (
        <div>
            <label htmlFor="credit_due_date" className="mb-1.5 block text-sm font-medium text-neutral-700">{t('smartPricing.dueDate')}</label>
            <input
                id="credit_due_date"
                type="date"
                value={creditDueDate || ''}
                min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                onChange={(event) => setCreditDueDate(event.target.value)}
                className={`min-h-input w-full rounded-button border bg-surface px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 ${creditDueDateError ? 'border-danger ring-1 ring-danger' : 'border-border-strong'}`}
                aria-invalid={!!creditDueDateError}
            />
            {creditDueDateError && <span role="alert" className="mt-1 block text-xs font-medium text-financial-loss">{creditDueDateError}</span>}
            {showSettleHint && learnedSettleDays !== null && (
                <span className="mt-1 block text-xs text-neutral-500">
                    {(t('smartPricing.avgSettleHint') as string).replace('{days}', String(learnedSettleDays))}
                </span>
            )}
        </div>
    );
    return (<><Modal isOpen={mode !== null} onClose={closeForm} className="bg-surface max-w-md">
            <ModalHeader onClose={closeForm}>
                <ModalTitle className="text-base sm:text-lg">{editingTx ? t('common.edit') : t('transactions.newTransaction')}</ModalTitle>
            </ModalHeader>

            <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
                {mode && (<>
                        {/* What: operation and currency, then the balance and average price they act on */}
                        <FormCard>
                            <div className="grid grid-cols-2 gap-2">
                                <SegmentedControl size="md" ariaLabel={t('transactions.operationType') as string} value={isBuyMode ? 'buy' : 'sell'} onChange={switchOperation} disabled={!!editingTx} options={[
                                    { id: 'buy', label: <><ArrowDownLeftIcon aria-hidden="true" className="h-4 w-4 shrink-0"/>{t('transactions.buy')}</>, tone: 'profit' },
                                    { id: 'sell', label: <><ArrowUpRightIcon aria-hidden="true" className="h-4 w-4 shrink-0"/>{t('transactions.sell')}</>, tone: 'loss' },
                                ]}/>
                                <SegmentedControl size="md" ariaLabel={t('transactions.currencyLabel') as string} value={activeCurrency as 'USDT' | 'EUR'} onChange={switchCurrency} disabled={!!editingTx} options={[
                                    { id: 'USDT', label: 'USDT', tone: 'primary' },
                                    { id: 'EUR', label: 'EUR', tone: 'primary' },
                                ]}/>
                            </div>
                            <dl className="grid grid-cols-2 gap-2">
                                <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
                                    <dt className="truncate text-[11px] font-semibold text-neutral-500">{t('common.balance')}</dt>
                                    <dd className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900"><span dir="ltr">{activeStats.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {activeCurrency}</span></dd>
                                </div>
                                <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
                                    <dt className="truncate text-[11px] font-semibold text-neutral-500">{t('portfolio.currentPam')}</dt>
                                    <dd className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900"><span dir="ltr">{activeStats.avgBuy.toFixed(2)} {t('common.dinar')}</span></dd>
                                </div>
                            </dl>
                        </FormCard>

                        {/* Buy USDT: choose funding source */}
                        {mode === 'buy_usdt' && !buyUsdtMode && (<FormCard title={t('transactions.fundingQuestion')} description={t('transactions.fundingHint')}>
                                <div className="-mx-2 -my-1 divide-y divide-border">
                                    {renderSourceChoice(() => setBuyUsdtMode('with_dzd'), <BanknotesIcon className="h-5 w-5"/>, t('portfolio.buyWithDzd'), t('common.dinar'))}
                                    {renderSourceChoice(() => { setBuyUsdtMode('with_eur'); setEurDzdPrice(portfolioStats.eur.avgBuy.toFixed(2)); }, <WalletIcon className="h-5 w-5"/>, t('portfolio.buyWithEur'), 'EUR')}
                                </div>
                            </FormCard>)}

                        {/* Sell USDT: choose settlement source */}
                        {mode === 'sell_usdt' && !sellUsdtSourceSelected && !editingTx && (<FormCard title={t('transactions.saleSourceQuestion')} description={t('transactions.saleSourceHint')}>
                                <div className="-mx-2 -my-1 divide-y divide-border">
                                    {renderSourceChoice(chooseSellWithDzd, <BanknotesIcon className="h-5 w-5"/>, t('portfolio.sellWithDzd'), t('common.dinar'))}
                                    {renderSourceChoice(chooseSellWithEur, <WalletIcon className="h-5 w-5"/>, t('portfolio.sellWithEur'), 'EUR')}
                                </div>
                            </FormCard>)}

                        {/* Buy USDT with DZD */}
                        {buyUsdtMode === 'with_dzd' && (<>
                                <FormCard title={t('transactions.stepAmounts')}>
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
                }} currency="USDT" error={fieldError('buyUsdtAmount')}/>
                                <MoneyField label={t('transactions.buyPrice')} value={buyUsdtPrice} onChange={(val) => {
                    setBuyUsdtPrice(val);
                    const qty = parseAndEvaluate(buyUsdtAmount);
                    const price = parseAndEvaluate(val);
                    setIsTotalManual(false);
                    if (qty > 0 && price > 0)
                        setBuyUsdtTotal((qty * price).toFixed(0));
                    else if (price === 0 || val === '')
                        setBuyUsdtTotal('');
                }} currency="DZD" error={fieldError('buyUsdtPrice')}/>
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
                }} currency="DZD" onMax={applyClientMaxToBuyTotal} maxDisabled={!hasPrimaryClient || selectedClientTotal <= 0} error={fieldError('buyUsdtTotal')} hint={t('transactions.autoCalc')}/>
                                </FormCard>
                                <FormCard title={t('transactions.clientAndSettlement')}>
                                <ClientLinker {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus }} {...clientLinkerErrors}/>
                                </FormCard>
                                {renderStockAvailability()}
                            </>)}

                        {/* Buy USDT with EUR */}
                        {buyUsdtMode === 'with_eur' && (<>
                                <FormCard title={t('transactions.stepAmounts')}>
                                <MoneyField label={t('transactions.quantity')} value={buyEurForUsdtAmount} onChange={setBuyEurForUsdtAmount} currency="EUR" onMax={() => setBuyEurForUsdtAmount(portfolioStats.eur.available.toString())} error={fieldError('buyEurForUsdtAmount')} hint={`${t('portfolio.currentBalanceEur')}: ${portfolioStats.eur.available.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`}/>
                                <MoneyField label={t('portfolio.rateEurUsdt')} value={eurUsdtRate} onChange={setEurUsdtRate} error={fieldError('eurUsdtRate')} placeholder="Ex: 0.92"/>
                                <MoneyField label={t('portfolio.buyPriceEur')} value={eurDzdPrice} onChange={setEurDzdPrice} currency="DZD" error={fieldError('eurDzdPrice')} hint={t('transactions.basedOnPamEur')} readOnly/>
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
                    return (<div className="rounded-button border border-success/20 bg-financial-profit-bg p-3">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="text-xs font-semibold text-financial-profit">{t('transactions.quantity')} USDT</span>
                                                <span dir="ltr" className="text-lg font-extrabold text-financial-profit tabular-nums">{formatNumber(usdtQty, { min: 0, max: 2 })}</span>
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-neutral-600">
                                                <span>{t('transactions.newBalance')}</span>
                                                <span dir="ltr" className="font-semibold tabular-nums">{totalAfter.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span>
                                            </div>
                                            {projectedPamUsdt > 0 && (
                                                <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-neutral-600">
                                                    <span>{t('portfolio.currentPam')} USDT</span>
                                                    <span dir="ltr" className="font-semibold tabular-nums">{formatNumber(projectedPamUsdt, { min: 2, max: 2 })} DZD</span>
                                                </div>
                                            )}
                                        </div>);
                })()}
                                </FormCard>
                                {renderStockAvailability()}
                            </>)}

                        {/* Sell USDT/EUR */}
                        {isSellMode && (mode !== 'sell_usdt' || sellUsdtSourceSelected || !!editingTx) && (<>
                                <FormCard title={t('transactions.stepAmounts')}>
                                {mode === 'sell_usdt' && (<div>
                                        <p className="mb-1.5 text-sm font-medium text-neutral-700">{t('transactions.settlementCurrency')}</p>
                                        <SegmentedControl size="md" ariaLabel={t('transactions.settlementCurrency') as string} value={sellSettlementCurrency === 'EUR' ? 'EUR' : 'DZD'} onChange={(currency) => (currency === 'EUR' ? chooseSellWithEur() : chooseSellWithDzd())} options={[
                                            { id: 'DZD', label: 'DZD', tone: 'primary' },
                                            { id: 'EUR', label: 'EUR', tone: 'primary' },
                                        ]}/>
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
                                </FormCard>

                                <FormCard title={t('transactions.clientAndSettlement')}>
                                <ClientLinker {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus }} allowBaridiDzdLink hidePaymentStatus={isUsdtSellSettledInEur} hideLinkedDzdClient={isUsdtSellSettledInEur} {...clientLinkerErrors}/>
                                {!isUsdtSellSettledInEur && clientPaymentStatus === 'credit' && renderCreditDueDateField(true)}
                                </FormCard>
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
                            </>)}

                        {/* Buy EUR */}
                        {mode === 'buy_eur' && (<>
                                <FormCard title={t('transactions.stepAmounts')}>
                                <MoneyField label={t('transactions.quantity')} value={buyEurAmount} onChange={(val) => {
                    setBuyEurAmount(val);
                    const qty = parseAndEvaluate(val);
                    const price = parseAndEvaluate(buyEurPrice);
                    setIsTotalManual(false);
                    if (qty > 0 && price > 0)
                        setBuyEurTotal((qty * price).toFixed(0));
                    else if (qty === 0 || val === '')
                        setBuyEurTotal('');
                }} currency="EUR" error={fieldError('buyEurAmount')}/>
                                <MoneyField label={t('portfolio.buyPriceEur')} value={buyEurPrice} onChange={(val) => {
                    setBuyEurPrice(val);
                    const qty = parseAndEvaluate(buyEurAmount);
                    const price = parseAndEvaluate(val);
                    setIsTotalManual(false);
                    if (qty > 0 && price > 0)
                        setBuyEurTotal((qty * price).toFixed(0));
                    else if (price === 0 || val === '')
                        setBuyEurTotal('');
                }} currency="DZD" error={fieldError('buyEurPrice')} hint={t('transactions.basedOnPamEur')}/>
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
                }} currency="DZD" error={fieldError('buyEurTotal')} hint={t('transactions.autoCalc')}/>
                                </FormCard>
                                <FormCard title={t('transactions.clientAndSettlement')}>
                                <ClientLinker {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus }} {...clientLinkerErrors}/>
                                {clientPaymentStatus === 'credit' && renderCreditDueDateField(false)}
                                </FormCard>
                            </>)}

                        {/* Notes + Tags (optional) */}
                        {!isChoosingSource && (<FormCard>
                            <Textarea
                                label={t('common.notesOptional') as string}
                                value={notes ?? ''}
                                onChange={(e) => setNotes?.(e.target.value)}
                                rows={2}
                                placeholder={t('transactions.notesPlaceholder') as string}
                                className="resize-none text-sm"
                            />
                            {setTxTags && (
                                <TagInput
                                    tags={Array.isArray(txTags) ? txTags : []}
                                    setTags={(newTags) => setTxTags(newTags)}
                                    t={t}
                                />
                            )}
                        </FormCard>)}
                    </>)}
            </ModalContent>

            {!isChoosingSource && (<OperationFooter stats={footerStats} reason={saveBlockedReason} reasonTone={entryToFix ? 'fix' : 'missing'}>
                    <Button onClick={closeForm} variant="outline">
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={mode?.startsWith('buy') ? handleBuy : handleSell} disabled={!formValidation.isValid} loading={isSaving} title={saveBlockedReason}>
                        {isSaving ? t('common.processing') : t('transactions.confirm')}
                    </Button>
                </OperationFooter>)}
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
