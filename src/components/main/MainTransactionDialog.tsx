import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { MoneyField } from '../ui/MoneyField';
import { SectionHeading } from '../ui/SectionHeading';
import { ClientLinker } from './ClientLinker';
import { SparklesIcon } from '../icons/SparklesIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { parseAndEvaluate } from '../../utils';
import { formatNumber } from '../../pages/shared/pageFormat';
import { getFirstValidationMessage } from '../../utils/financialUx';
type MainTransactionDialogProps = Record<string, any>;
export function MainTransactionDialog({ mode, editingTx, closeForm, openForm, cardBase, t, subtleText, fieldBase, buyUsdtMode, setBuyUsdtMode, setEurDzdPrice, portfolioStats, buyUsdtAmount, setBuyUsdtAmount, isTotalManual, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal, setIsTotalManual, formValidation, linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, clientPaymentStatus, setClientPaymentStatus, buyEurForUsdtAmount, setBuyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, setEurUsdtRate, sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal, sellSettlementCurrency, setSellSettlementCurrency, sellEurToDzdRate, setSellEurToDzdRate, suggestedSellingPrice, suggestedUsdtEurSellPrice, suggestedSellingPriceEur, suggestedProfitMargin, profitPercent, setProfitPercent, buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal, clientBalances, handleBuy, handleSell, isSaving }: MainTransactionDialogProps) {
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
    const activeSuggestedSellingPrice = activeCurrency === 'EUR' ? suggestedSellingPriceEur : suggestedSellingPrice;
    const baseSuggestedPriceDzd = activeSuggestedSellingPrice && parseFloat(activeSuggestedSellingPrice) > 0
        ? parseFloat(activeSuggestedSellingPrice)
        : (activeStats.avgBuy + parseAndEvaluate(suggestedProfitMargin));
    const configuredUsdtEurPrice = parseFloat(suggestedUsdtEurSellPrice || '0');
    const hasUsdtEurSuggested = isUsdtSellSettledInEur && configuredUsdtEurPrice > 0;
    const sellSuggestedPrice = hasUsdtEurSuggested && sellEurToDzdRateValue > 0
        ? configuredUsdtEurPrice * sellEurToDzdRateValue
        : baseSuggestedPriceDzd;
    const displayedSellSuggestedPrice = hasUsdtEurSuggested
        ? configuredUsdtEurPrice
        : isUsdtSellSettledInEur && sellEurToDzdRateValue > 0
            ? sellSuggestedPrice / sellEurToDzdRateValue
            : sellSuggestedPrice;
    const sellPriceUnitLabel = isUsdtSellSettledInEur ? 'EUR/USDT' : t('common.dinar');
    const sellTotalCurrencyLabel = isUsdtSellSettledInEur ? 'EUR' : t('common.dinar');
    const formatSellTotalInput = (value: number) => isUsdtSellSettledInEur ? value.toFixed(2) : value.toFixed(0);
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
        setSellTotal(selectedClientTotalLabel);
        setIsTotalManual(true);
        const price = parseAndEvaluate(sellPrice);
        if (price > 0) {
            setSellAmount((selectedClientTotal / price).toFixed(2));
        }
    };
    const applySellBalanceMax = () => {
        setSellAmount(activeStats.available.toFixed(2));
        const price = parseAndEvaluate(sellPrice);
        if (price > 0) {
            setSellTotal(formatSellTotalInput(activeStats.available * price));
        }
    };
    const applySuggestedSellPrice = () => {
        const price = displayedSellSuggestedPrice;
        setSellPrice(price.toFixed(isUsdtSellSettledInEur ? 4 : 2));
        setProfitPercent((sellSuggestedPrice - activeStats.avgBuy).toFixed(2));
        const qty = parseAndEvaluate(sellAmount);
        setIsTotalManual(false);
        if (qty > 0) {
            setSellTotal(formatSellTotalInput(qty * price));
        }
    };
    const formatPreviewNumber = (value: number, fractionDigits = 2) => Number.isFinite(value)
        ? value.toLocaleString('fr-FR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
        : '0';
    const transactionSummary = (() => {
        if (!mode || (mode === 'buy_usdt' && !buyUsdtMode))
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
            ? totalInput * sellEurToDzdRateValue
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
    const segBase = 'bg-neutral-100';
    const segItem = (active: boolean, activeClass: string) => `flex-1 min-h-touch py-2 text-sm font-semibold rounded-lg transition-colors ${active
        ? activeClass
        : ('text-neutral-600 hover:text-neutral-800')} ${editingTx ? 'cursor-not-allowed opacity-70' : ''}`;
    return (<Modal isOpen={mode !== null} onClose={closeForm} className="bg-surface max-w-md">
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
                            <span>PAM: <span dir="ltr" className="font-semibold text-neutral-700 tabular-nums">{activeStats.avgBuy.toFixed(2)} {t('common.dinar')}</span></span>
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
                }} currency="USDT" error={formValidation.errors['buyUsdtAmount']}/>
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
                            </div>)}

                        {/* Buy USDT with EUR */}
                        {buyUsdtMode === 'with_eur' && (<div className="space-y-3">
                                <MoneyField label={t('transactions.quantity')} value={buyEurForUsdtAmount} onChange={setBuyEurForUsdtAmount} currency="EUR" onMax={() => setBuyEurForUsdtAmount(portfolioStats.eur.available.toString())} error={formValidation.errors['buyEurForUsdtAmount']} hint={`${t('portfolio.currentBalanceEur')}: ${portfolioStats.eur.available.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`}/>
                                <MoneyField label={t('portfolio.buyPriceEur')} value={eurDzdPrice} onChange={setEurDzdPrice} currency="DZD" error={formValidation.errors['eurDzdPrice']} hint={t('transactions.basedOnPamEur')}/>
                                <MoneyField label={t('portfolio.rateEurUsdt')} value={eurUsdtRate} onChange={setEurUsdtRate} error={formValidation.errors['eurUsdtRate']} placeholder="Ex: 0.92"/>
                                {(() => {
                    const eurQty = parseAndEvaluate(buyEurForUsdtAmount);
                    const rate = parseAndEvaluate(eurUsdtRate);
                    const usdtQty = (eurQty > 0 && rate > 0) ? (eurQty / rate) : 0;
                    if (usdtQty <= 0)
                        return null;
                    const totalAfter = portfolioStats.usdt.available + usdtQty;
                    return (<div className="rounded-xl border border-success/20 bg-financial-profit-bg p-3">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="text-xs text-financial-profit">{t('transactions.quantity')} USDT</span>
                                                <span dir="ltr" className="text-lg font-bold text-financial-profit tabular-nums">{formatNumber(usdtQty, { min: 0, max: 2 })}</span>
                                            </div>
                                            <div className={`mt-1 flex items-baseline justify-between gap-3 text-xs text-neutral-500`}>
                                                <span>{t('transactions.newBalance')}</span>
                                                <span dir="ltr" className="font-semibold tabular-nums">{totalAfter.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span>
                                            </div>
                                        </div>);
                })()}
                            </div>)}

                        {/* Sell USDT/EUR */}
                        {isSellMode && (<div className="space-y-3">
                                {mode === 'sell_usdt' && (<div>
                                        <p className="text-xs font-medium mb-1.5 text-neutral-500">{t('transactions.settlementCurrency')}</p>
                                        <div className={`flex gap-1 rounded-xl p-1 ${segBase}`}>
                                            <button type="button" onClick={() => {
                        const rate = parseAndEvaluate(sellEurToDzdRate);
                        const currentPrice = parseAndEvaluate(sellPrice);
                        const nextPrice = sellSettlementCurrency === 'EUR' && rate > 0 && currentPrice > 0
                            ? currentPrice * rate
                            : currentPrice;
                        setSellSettlementCurrency('DZD');
                        if (nextPrice > 0)
                            setSellPrice(nextPrice.toFixed(2));
                        const qty = parseAndEvaluate(sellAmount);
                        setIsTotalManual(false);
                        if (qty > 0 && nextPrice > 0)
                            setSellTotal((qty * nextPrice).toFixed(0));
                    }} className={segItem(sellSettlementCurrency !== 'EUR', 'bg-primary text-white shadow-sm')}>
                                                DZD
                                            </button>
                                            <button type="button" onClick={() => {
                        setSellSettlementCurrency('EUR');
                        setLinkedClientDzdId('none');
                        setClientPaymentStatus('cash');
                        const nextRate = Number(portfolioStats.eur.avgBuy || 0);
                        const nextUsdtEurPrice = parseAndEvaluate(suggestedUsdtEurSellPrice || '0');
                        if (!sellEurToDzdRate && nextRate > 0)
                            setSellEurToDzdRate(nextRate.toFixed(2));
                        if (nextUsdtEurPrice > 0) {
                            setSellPrice(nextUsdtEurPrice.toFixed(4));
                            if (nextRate > 0)
                                setProfitPercent(((nextUsdtEurPrice * nextRate) - activeStats.avgBuy).toFixed(2));
                            const qty = parseAndEvaluate(sellAmount);
                            if (qty > 0)
                                setSellTotal((qty * nextUsdtEurPrice).toFixed(2));
                            else
                                setSellTotal('');
                        }
                        else {
                            setSellPrice('');
                            setSellTotal('');
                            setProfitPercent('');
                        }
                        setIsTotalManual(false);
                    }} className={segItem(sellSettlementCurrency === 'EUR', 'bg-primary text-white shadow-sm')}>
                                                EUR
                                            </button>
                                        </div>
                                    </div>)}

                                <MoneyField label={t('transactions.quantity')} value={sellAmount} onChange={(val) => {
                    setSellAmount(val);
                    const qty = parseAndEvaluate(val);
                    const price = parseAndEvaluate(sellPrice);
                    setIsTotalManual(false);
                    if (qty > 0 && price > 0)
                        setSellTotal(formatSellTotalInput(qty * price));
                }} onBlur={() => {
                    const qty = parseAndEvaluate(sellAmount);
                    if (!isNaN(qty) && qty > 0)
                        setSellAmount(qty.toFixed(2));
                }} currency={activeCurrency as 'USDT' | 'EUR'} onMax={applySellBalanceMax} hint={`${t('common.balance')}: ${activeStats.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeCurrency}`} error={formValidation.errors['sellAmount']}/>

                                <MoneyField label={isUsdtSellSettledInEur ? t('transactions.eurReceived') : t('transactions.totalAmount')} value={sellTotal} onChange={(val) => {
                    setSellTotal(val);
                    if (val) {
                        setIsTotalManual(true);
                        const total = parseAndEvaluate(val);
                        const price = parseAndEvaluate(sellPrice);
                        if (total > 0 && price > 0)
                            setSellAmount((total / price).toFixed(2));
                    }
                    else {
                        setIsTotalManual(false);
                        const qty = parseAndEvaluate(sellAmount);
                        const price = parseAndEvaluate(sellPrice);
                        if (qty > 0 && price > 0)
                            setSellTotal(formatSellTotalInput(qty * price));
                    }
                }} onBlur={() => {
                    const total = parseAndEvaluate(sellTotal);
                    if (!isNaN(total) && total > 0)
                        setSellTotal(isUsdtSellSettledInEur ? total.toFixed(2) : Math.round(total).toString());
                }} currency={sellTotalCurrencyLabel === 'EUR' ? 'EUR' : 'DZD'} onMax={applyClientMaxToSellTotal} maxDisabled={isUsdtSellSettledInEur || !hasPrimaryClient || selectedClientTotal <= 0} error={formValidation.errors['sellTotal']}/>

                                {isUsdtSellSettledInEur && (<MoneyField label={t('portfolio.rateEurDzd')} value={sellEurToDzdRate} onChange={(val) => {
                        setSellEurToDzdRate(val);
                        const rate = parseAndEvaluate(val);
                        const priceEur = parseAndEvaluate(sellPrice);
                        const qty = parseAndEvaluate(sellAmount);
                        if (rate > 0 && priceEur > 0)
                            setProfitPercent(((priceEur * rate) - activeStats.avgBuy).toFixed(2));
                        setIsTotalManual(false);
                        if (qty > 0 && priceEur > 0)
                            setSellTotal((qty * priceEur).toFixed(2));
                    }} currency="DZD" placeholder="Ex: 250" error={formValidation.errors['sellEurToDzdRate']} hint={`PAM EUR: ${(portfolioStats.eur.avgBuy || 0).toFixed(2)} ${t('common.dinar')}`}/>)}

                                {/* Price field with suggested button + margin hint */}
                                <div>
                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                        <span className="text-sm text-neutral-700">{t('transactions.sellPrice')} ({sellPriceUnitLabel})</span>
                                        {sellSuggestedPrice > 0 && (<button type="button" onClick={applySuggestedSellPrice} className="min-h-touch text-xs font-semibold px-2 py-1 rounded-md transition-colors bg-info-bg text-info hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                                PAM +{(sellSuggestedPrice - activeStats.avgBuy).toFixed(2)}
                                            </button>)}
                                    </div>
                                    <MoneyField label="" value={sellPrice} onChange={(val) => {
                    setSellPrice(val);
                    const price = parseAndEvaluate(val);
                    const qty = parseAndEvaluate(sellAmount);
                    setIsTotalManual(false);
                    if (qty > 0 && price > 0)
                        setSellTotal(formatSellTotalInput(qty * price));
                    if (activeStats.avgBuy > 0 && price > 0) {
                        const effectivePriceDzd = isUsdtSellSettledInEur ? price * sellEurToDzdRateValue : price;
                        setProfitPercent((effectivePriceDzd - activeStats.avgBuy).toFixed(2));
                    }
                }} className="-mt-2" error={formValidation.errors['sellPrice']}/>
                                    <div className="mt-1.5 grid gap-1 text-xs text-neutral-500 sm:grid-cols-2 sm:items-center">
                                        <span dir="ltr" className="min-w-0 tabular-nums">PAM: {activeStats.avgBuy.toFixed(2)} {t('common.dinar')}</span>
                                        {parseAndEvaluate(profitPercent) !== 0 && (<span dir="ltr" className={`min-w-0 tabular-nums sm:text-right ${parseAndEvaluate(profitPercent) > 0 ? 'text-financial-profit font-medium' : 'text-financial-loss font-medium'}`}>
                                                Marge: {parseAndEvaluate(profitPercent) > 0 ? '+' : ''}{parseAndEvaluate(profitPercent).toFixed(2)} {t('common.dinar')}
                                            </span>)}
                                    </div>
                                </div>

                                <ClientLinker {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus }} allowBaridiDzdLink hidePaymentStatus={isUsdtSellSettledInEur} hideLinkedDzdClient={isUsdtSellSettledInEur} errorMessage={formValidation.errors['linkedClientId']} hasError={!!formValidation.errors['linkedClientId']} errorMessageDzd={formValidation.errors['linkedClientDzdId']} hasErrorDzd={!!formValidation.errors['linkedClientDzdId']}/>
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
                }} currency="EUR" error={formValidation.errors['buyEurAmount']}/>
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
                }} currency="DZD" error={formValidation.errors['buyEurTotal']} hint={t('transactions.autoCalc')} placeholder={t('transactions.autoCalc')}/>
                                <ClientLinker {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, clientPaymentStatus, setClientPaymentStatus }} errorMessage={formValidation.errors['linkedClientId']} hasError={!!formValidation.errors['linkedClientId']} errorMessageDzd={formValidation.errors['linkedClientDzdId']} hasErrorDzd={!!formValidation.errors['linkedClientDzdId']}/>
                            </div>)}

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
                {(mode !== 'buy_usdt' || buyUsdtMode) && (<div className="flex gap-2 w-full">
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
        </Modal>);
}
