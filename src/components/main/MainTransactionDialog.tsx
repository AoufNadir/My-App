import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { ClientLinker } from './ClientLinker';
import { SparklesIcon } from '../icons/SparklesIcon';
import { parseAndEvaluate } from '../../utils';

type MainTransactionDialogProps = Record<string, any>;

export function MainTransactionDialog({
    mode,
    editingTx,
    closeForm,
    openForm,
    cardBase,
    isDark,
    t,
    subtleText,
    fieldBase,
    buyUsdtMode,
    setBuyUsdtMode,
    setEurDzdPrice,
    portfolioStats,
    buyUsdtAmount,
    setBuyUsdtAmount,
    isTotalManual,
    buyUsdtPrice,
    setBuyUsdtPrice,
    buyUsdtTotal,
    setBuyUsdtTotal,
    setIsTotalManual,
    formValidation,
    linkedClientId,
    setLinkedClientId,
    linkedClientDzdId,
    setLinkedClientDzdId,
    openClientModal,
    clientsDzd,
    clientPaymentStatus,
    setClientPaymentStatus,
    notes,
    setNotes,
    buyEurForUsdtAmount,
    setBuyEurForUsdtAmount,
    eurDzdPrice,
    eurUsdtRate,
    setEurUsdtRate,
    sellAmount,
    setSellAmount,
    sellPrice,
    setSellPrice,
    sellTotal,
    setSellTotal,
    suggestedSellingPrice,
    suggestedSellingPriceEur,
    suggestedProfitMargin,
    profitPercent,
    setProfitPercent,
    buyEurAmount,
    setBuyEurAmount,
    buyEurPrice,
    setBuyEurPrice,
    buyEurTotal,
    setBuyEurTotal,
    clientBalances,
    handleBuy,
    handleSell,
    isSaving
}: MainTransactionDialogProps) {
    const hasPrimaryClient = Boolean(linkedClientId && linkedClientId !== 'none');
    const selectedClientTotal = hasPrimaryClient
        ? Math.abs(Number(clientBalances?.get?.(linkedClientId) || 0))
        : 0;
    const selectedClientTotalLabel = Number(selectedClientTotal.toFixed(2)).toString();
    const isSellMode = mode === 'sell_usdt' || mode === 'sell_eur';
    const isBuyMode = mode === 'buy_usdt' || mode === 'buy_eur';
    const activeCurrency = mode === 'buy_eur' || mode === 'sell_eur' ? 'EUR' : 'USDT';
    const activeStats = activeCurrency === 'EUR' ? portfolioStats.eur : portfolioStats.usdt;
    const activeSuggestedSellingPrice = activeCurrency === 'EUR' ? suggestedSellingPriceEur : suggestedSellingPrice;
    const sellSuggestedPrice = activeSuggestedSellingPrice && parseFloat(activeSuggestedSellingPrice) > 0
        ? parseFloat(activeSuggestedSellingPrice)
        : (activeStats.avgBuy + parseAndEvaluate(suggestedProfitMargin));
    const switchOperation = (operation: 'buy' | 'sell') => {
        if (editingTx) return;
        if (operation === 'buy') {
            openForm(activeCurrency === 'EUR' ? 'buy_eur' : 'buy_usdt');
            return;
        }
        openForm(activeCurrency === 'EUR' ? 'sell_eur' : 'sell_usdt');
    };
    const switchCurrency = (currency: 'USDT' | 'EUR') => {
        if (editingTx) return;
        if (isSellMode) {
            openForm(currency === 'EUR' ? 'sell_eur' : 'sell_usdt');
            return;
        }
        openForm(currency === 'EUR' ? 'buy_eur' : 'buy_usdt');
    };

    const applyClientMaxToBuyTotal = () => {
        if (!hasPrimaryClient || selectedClientTotal <= 0) return;
        setBuyUsdtTotal(selectedClientTotalLabel);
        setIsTotalManual(true);

        const price = parseAndEvaluate(buyUsdtPrice);
        if (price > 0) {
            setBuyUsdtAmount((selectedClientTotal / price).toFixed(2));
        }
    };

    const applyClientMaxToSellTotal = () => {
        if (!hasPrimaryClient || selectedClientTotal <= 0) return;
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
            setSellTotal((activeStats.available * price).toFixed(0));
        }
    };

    return (
            <Dialog isOpen={mode !== null} onClose={closeForm} className={`${cardBase} max-w-lg`}>
                <DialogHeader onClose={closeForm} isDark={isDark}><DialogTitle>{editingTx ? t('common.edit') : t('transactions.newTransaction')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    {mode && (
                        <>
                            <div className="space-y-3">
                                <div className={`rounded-2xl border p-3 ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => switchOperation('buy')}
                                            disabled={!!editingTx}
                                            className={`py-2 rounded-xl text-sm font-bold transition-all ${isBuyMode ? 'bg-emerald-600 text-white' : (isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600')} ${editingTx ? 'cursor-not-allowed opacity-70' : ''}`}
                                        >
                                            {t('transactions.buy')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => switchOperation('sell')}
                                            disabled={!!editingTx}
                                            className={`py-2 rounded-xl text-sm font-bold transition-all ${isSellMode ? 'bg-rose-600 text-white' : (isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600')} ${editingTx ? 'cursor-not-allowed opacity-70' : ''}`}
                                        >
                                            {t('transactions.sell')}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => switchCurrency('USDT')}
                                            disabled={!!editingTx}
                                            className={`py-2 rounded-xl text-sm font-bold transition-all ${activeCurrency === 'USDT' ? 'bg-sky-600 text-white' : (isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600')} ${editingTx ? 'cursor-not-allowed opacity-70' : ''}`}
                                        >
                                            USDT
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => switchCurrency('EUR')}
                                            disabled={!!editingTx}
                                            className={`py-2 rounded-xl text-sm font-bold transition-all ${activeCurrency === 'EUR' ? 'bg-amber-600 text-white' : (isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600')} ${editingTx ? 'cursor-not-allowed opacity-70' : ''}`}
                                        >
                                            EUR
                                        </button>
                                    </div>
                                </div>

                                <div className={`grid grid-cols-2 gap-3 rounded-2xl border p-3 ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                                    <div>
                                        <p className={`text-xs uppercase tracking-wide ${subtleText}`}>{t('common.balance')}</p>
                                        <p className="text-lg font-bold">{activeStats.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {activeCurrency}</p>
                                    </div>
                                    <div>
                                        <p className={`text-xs uppercase tracking-wide ${subtleText}`}>{t('portfolio.currentPam')}</p>
                                        <p className="text-lg font-bold">{activeStats.avgBuy.toFixed(2)} {t('common.dinar')}</p>
                                    </div>
                                </div>
                            </div>

                            {mode === 'buy_usdt' && !buyUsdtMode && (
                                <>
                                    <div className="text-center mb-6">
                                        <UnifiedTitle
                                            as="h3"
                                            isDark={isDark}
                                            variant="section"
                                            className="justify-center mb-1"
                                            icon={<SparklesIcon className="w-4 h-4" />}
                                        >
                                            {t('transactions.howDidYouBuy')}
                                        </UnifiedTitle>
                                        <p className={`text-sm ${subtleText}`}>{t('transactions.selectCurrency')}</p>
                                    </div>
                                    <div className="space-y-3">
                                        <Button onClick={() => setBuyUsdtMode('with_dzd')} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl font-bold shadow-md flex items-center justify-center">
                                            {t('portfolio.buyWithDzd')} ({t('common.dinar')})
                                        </Button>
                                        <Button onClick={() => { setBuyUsdtMode('with_eur'); setEurDzdPrice(portfolioStats.eur.avgBuy.toFixed(2)); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-md flex items-center justify-center">
                                            {t('portfolio.buyWithEur')} (EUR)
                                        </Button>
                                    </div>
                                </>
                            )}
                            {(buyUsdtMode || mode === 'buy_eur' || mode === 'sell_usdt' || mode === 'sell_eur') && (
                                <div className="space-y-3">

                                    {/* CASE 0: Buy USDT with DZD - REDESIGNED */}
                                    {buyUsdtMode === 'with_dzd' && (
                                        <>
                                            <div>
                                                <Label>{t('transactions.qtyUsdt')}</Label>
                                                <NumberInput
                                                    value={buyUsdtAmount}
                                                    onChange={e => {
                                                        setBuyUsdtAmount(e.target.value);
                                                        // Auto-calculate total when quantity changes ONLY IF NOT MANUAL
                                                        if (!isTotalManual) {
                                                            const qty = parseAndEvaluate(e.target.value);
                                                            const price = parseAndEvaluate(buyUsdtPrice);
                                                            if (qty > 0 && price > 0) {
                                                                setBuyUsdtTotal((qty * price).toFixed(0));
                                                            } else if (qty === 0 || e.target.value === '') {
                                                                setBuyUsdtTotal('');
                                                            }
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        const qty = parseAndEvaluate(buyUsdtAmount);
                                                        if (!isNaN(qty) && qty > 0) {
                                                            setBuyUsdtAmount(qty.toFixed(2));
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyUsdtAmount'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {formValidation.errors['buyUsdtAmount'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyUsdtAmount']}</p>}
                                            </div>
                                            <div>
                                                <Label>{t('transactions.buyPrice')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={buyUsdtPrice}
                                                    onChange={e => {
                                                        setBuyUsdtPrice(e.target.value);
                                                        // Auto-calculate total when price changes ONLY IF NOT MANUAL
                                                        if (!isTotalManual) {
                                                            const qty = parseAndEvaluate(buyUsdtAmount);
                                                            const price = parseAndEvaluate(e.target.value);
                                                            if (qty > 0 && price > 0) {
                                                                setBuyUsdtTotal((qty * price).toFixed(0));
                                                            } else if (price === 0 || e.target.value === '') {
                                                                setBuyUsdtTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyUsdtPrice'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {formValidation.errors['buyUsdtPrice'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyUsdtPrice']}</p>}
                                            </div>
                                            <div>
                                                <Label>{t('transactions.totalAmount')} ({t('common.dinar')})</Label>
                                                <div className="relative">
                                                    <NumberInput
                                                        value={buyUsdtTotal}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setBuyUsdtTotal(val);
                                                            if (val) {
                                                                setIsTotalManual(true);
                                                                // Bidirectional: Calculate Quantity from Total
                                                                const total = parseAndEvaluate(val);
                                                                const price = parseAndEvaluate(buyUsdtPrice);
                                                                if (total > 0 && price > 0) {
                                                                    setBuyUsdtAmount((total / price).toFixed(2));
                                                                }
                                                            } else {
                                                                setIsTotalManual(false);
                                                                // Immediate auto-calc when cleared
                                                                const qty = parseAndEvaluate(buyUsdtAmount);
                                                                const price = parseAndEvaluate(buyUsdtPrice);
                                                                if (qty > 0 && price > 0) setBuyUsdtTotal((qty * price).toFixed(0));
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            const total = parseAndEvaluate(buyUsdtTotal);
                                                            if (!isNaN(total) && total > 0) {
                                                                setBuyUsdtTotal(Math.round(total).toString());
                                                            }
                                                        }}
                                                        className={`${fieldBase} ${formValidation.errors['buyUsdtTotal'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                        placeholder={t('transactions.autoCalc')}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={applyClientMaxToBuyTotal}
                                                        disabled={!hasPrimaryClient || selectedClientTotal <= 0}
                                                        className={`absolute right-2 top-2 text-xs px-2 py-1 rounded font-bold transition-colors ${!hasPrimaryClient || selectedClientTotal <= 0
                                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
                                                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                            }`}
                                                    >
                                                        {t('common.max')}
                                                    </button>
                                                </div>
                                                {formValidation.errors['buyUsdtTotal'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyUsdtTotal']}</p>}
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.autoCalc')}</p>
                                            </div>
                                            <ClientLinker
                                                {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }}
                                                errorMessage={formValidation.errors['linkedClientId']}
                                                hasError={!!formValidation.errors['linkedClientId']}
                                                errorMessageDzd={formValidation.errors['linkedClientDzdId']}
                                                hasErrorDzd={!!formValidation.errors['linkedClientDzdId']}
                                            />
                                            <div>
                                                <Label>{t('common.notesOptional')}</Label>
                                                <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                                            </div>
                                        </>
                                    )}

                                    {/* CASE 1: Buy USDT with EUR (Layout requested by user) */}
                                    {buyUsdtMode === 'with_eur' && (
                                        <>
                                            <div>
                                                <Label>{t('transactions.qtyEur')}</Label>
                                                <div className="relative">
                                                    <NumberInput
                                                        value={buyEurForUsdtAmount}
                                                        onChange={e => {
                                                            setBuyEurForUsdtAmount(e.target.value);
                                                        }}
                                                        className={`${fieldBase} ${formValidation.errors['buyEurForUsdtAmount'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    />
                                                    {formValidation.errors['buyEurForUsdtAmount'] && <p className="text-red-500 text-xs mt-1 absolute -bottom-5 left-0">{formValidation.errors['buyEurForUsdtAmount']}</p>}
                                                    <button onClick={() => setBuyEurForUsdtAmount(portfolioStats.eur.available.toString())} className="absolute right-2 top-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">{t('common.max')}</button>
                                                </div>
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('portfolio.currentBalanceEur')}: {portfolioStats.eur.available.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</p>
                                            </div>

                                            <div>
                                                <Label>{t('portfolio.buyPriceEur')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={eurDzdPrice}
                                                    onChange={e => {
                                                        setEurDzdPrice(e.target.value);
                                                    }}
                                                    className={fieldBase}
                                                />
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.basedOnPamEur')}</p>
                                                {formValidation.errors['eurDzdPrice'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['eurDzdPrice']}</p>}
                                            </div>
                                            <div>
                                                <Label>{t('portfolio.rateEurUsdt')}</Label>
                                                <NumberInput
                                                    value={eurUsdtRate}
                                                    onChange={e => {
                                                        setEurUsdtRate(e.target.value);
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['eurUsdtRate'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    placeholder="Ex: 0.92"
                                                />
                                                {formValidation.errors['eurUsdtRate'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['eurUsdtRate']}</p>}
                                            </div>

                                            {/* Calculated USDT Quantity Message */}
                                            {(() => {
                                                const eurQty = parseAndEvaluate(buyEurForUsdtAmount);
                                                const rate = parseAndEvaluate(eurUsdtRate);
                                                const usdtQty = (eurQty > 0 && rate > 0) ? (eurQty / rate) : 0;
                                                const currentUsdtBalance = portfolioStats.usdt.available;
                                                const totalAfterPurchase = currentUsdtBalance + usdtQty;

                                                if (usdtQty > 0) {
                                                    return (
                                                        <div className="p-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                                                            <div>
                                                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('transactions.quantity')} USDT</p>
                                                                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                                                                    {usdtQty.toFixed(2)} USDT
                                                                </p>
                                                            </div>

                                                            <div className="pt-2 border-t border-emerald-500/20">
                                                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('transactions.newBalance')}</p>
                                                                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                                                    {totalAfterPurchase.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            <div><Label>{t('common.notesOptional')}</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} /></div>
                                        </>
                                    )}

                                    {/* CASE 2: Sell Asset */}
                                    {isSellMode && (
                                        <>
                                            <div>
                                                <Label>{activeCurrency === 'EUR' ? t('transactions.qtyEur') : t('transactions.qtyUsdt')}</Label>
                                                <div className="relative">
                                                    <NumberInput
                                                        value={sellAmount}
                                                        onChange={e => {
                                                            setSellAmount(e.target.value);
                                                            // Calculate total when quantity changes ONLY IF NOT MANUAL
                                                            if (!isTotalManual) {
                                                                const qty = parseAndEvaluate(e.target.value);
                                                                const price = parseAndEvaluate(sellPrice);
                                                                if (qty > 0 && price > 0) {
                                                                    setSellTotal((qty * price).toFixed(0));
                                                                }
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            const qty = parseAndEvaluate(sellAmount);
                                                            if (!isNaN(qty) && qty > 0) {
                                                                setSellAmount(qty.toFixed(2));
                                                            }
                                                        }}
                                                        className={fieldBase}
                                                        placeholder="0.00"
                                                    />
                                                    <button onClick={applySellBalanceMax} className="absolute right-2 top-2 text-xs bg-sky-600 text-white px-2 py-1 rounded">{t('common.max')}</button>
                                                </div>
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('common.balance')}: {activeStats.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {activeCurrency}</p>
                                                {formValidation.errors['sellAmount'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['sellAmount']}</p>}
                                            </div>

                                            <div>
                                                <Label>{t('transactions.totalAmount')} ({t('common.dinar')})</Label>
                                                <div className="relative">
                                                    <NumberInput
                                                        value={sellTotal}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setSellTotal(val);
                                                            if (val) {
                                                                setIsTotalManual(true);
                                                                // Bidirectional: Calculate Quantity from Total
                                                                const total = parseAndEvaluate(val);
                                                                const price = parseAndEvaluate(sellPrice);
                                                                if (total > 0 && price > 0) {
                                                                    setSellAmount((total / price).toFixed(2));
                                                                }
                                                            } else {
                                                                setIsTotalManual(false);
                                                                // Immediate auto-calc when cleared
                                                                const qty = parseAndEvaluate(sellAmount);
                                                                const price = parseAndEvaluate(sellPrice);
                                                                if (qty > 0 && price > 0) setSellTotal((qty * price).toFixed(0));
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            const total = parseAndEvaluate(sellTotal);
                                                            if (!isNaN(total) && total > 0) {
                                                                setSellTotal(Math.round(total).toString());
                                                            }
                                                        }}
                                                        className={`${fieldBase} ${formValidation.errors['sellTotal'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                        placeholder="0.00"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={applyClientMaxToSellTotal}
                                                        disabled={!hasPrimaryClient || selectedClientTotal <= 0}
                                                        className={`absolute right-2 top-2 text-xs px-2 py-1 rounded font-bold transition-colors ${!hasPrimaryClient || selectedClientTotal <= 0
                                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
                                                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                            }`}
                                                    >
                                                        {t('common.max')}
                                                    </button>
                                                </div>
                                                {formValidation.errors['sellTotal'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['sellTotal']}</p>}
                                            </div>

                                            <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-400">{t('portfolio.currentPam')}:</span>
                                                    <span className="font-bold">{activeStats.avgBuy.toFixed(2)} {t('common.dinar')}</span>
                                                </div>
                                                <div
                                                    className="flex justify-between text-sm mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => {
                                                        const price = sellSuggestedPrice;
                                                        setSellPrice(price.toFixed(2));
                                                        setProfitPercent((price - activeStats.avgBuy).toFixed(2));
                                                        // Update total if not manual
                                                        const qty = parseAndEvaluate(sellAmount);
                                                        if (!isTotalManual && qty > 0) {
                                                            setSellTotal((qty * price).toFixed(0));
                                                        }
                                                    }}
                                                >
                                                    <span className="text-yellow-500">{t('portfolio.suggestedPrice')} (+{(sellSuggestedPrice - activeStats.avgBuy).toFixed(2)} DA):</span>
                                                    <span className="font-bold text-yellow-500 underline decoration-dotted underline-offset-2">{sellSuggestedPrice.toFixed(2)} {t('common.dinar')}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <Label>{t('transactions.sellPrice')} ({t('common.dinar')})</Label>
                                                    <NumberInput
                                                        value={sellPrice}
                                                        onChange={e => {
                                                            setSellPrice(e.target.value);
                                                            const price = parseAndEvaluate(e.target.value);
                                                            const qty = parseAndEvaluate(sellAmount);

                                                            // Update total when price changes ONLY IF NOT MANUAL
                                                            if (!isTotalManual && qty > 0 && price > 0) {
                                                                setSellTotal((qty * price).toFixed(0));
                                                            }

                                                            // Update margin when price changes
                                                            if (activeStats.avgBuy > 0 && price > 0) {
                                                                const margin = price - activeStats.avgBuy;
                                                                setProfitPercent(margin.toFixed(2));
                                                            }
                                                        }}
                                                        className={`${fieldBase} ${formValidation.errors['sellPrice'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    />
                                                    {formValidation.errors['sellPrice'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['sellPrice']}</p>}
                                                </div>
                                                <div>
                                                    <Label>{t('portfolio.margin')} ({t('common.dinar')})</Label>
                                                    <NumberInput
                                                        value={profitPercent}
                                                        onChange={e => {
                                                            setProfitPercent(e.target.value);
                                                            const margin = parseAndEvaluate(e.target.value);
                                                            if (margin >= 0 && activeStats.avgBuy > 0) {
                                                                const newPrice = activeStats.avgBuy + margin;
                                                                setSellPrice(newPrice.toFixed(2));

                                                                // Update total based on new price ONLY IF NOT MANUAL
                                                                const qty = parseAndEvaluate(sellAmount);
                                                                if (!isTotalManual && qty > 0) {
                                                                    setSellTotal((qty * newPrice).toFixed(0));
                                                                }
                                                            }
                                                        }}
                                                        className={fieldBase}
                                                        placeholder="DZD"
                                                    />
                                                </div>
                                            </div>
                                            <ClientLinker
                                                {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }}
                                                errorMessage={formValidation.errors['linkedClientId']}
                                                hasError={!!formValidation.errors['linkedClientId']}
                                                errorMessageDzd={formValidation.errors['linkedClientDzdId']}
                                                hasErrorDzd={!!formValidation.errors['linkedClientDzdId']}
                                            />
                                            <div><Label>{t('common.notesOptional')}</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} /></div>
                                        </>
                                    )}

                                    {/* CASE 3: Buy EUR (Standard) - REDESIGNED */}
                                    {mode === 'buy_eur' && (
                                        <div className="space-y-4">
                                            <div>
                                                <Label>{t('transactions.qtyEur')}</Label>
                                                <NumberInput
                                                    value={buyEurAmount}
                                                    onChange={e => {
                                                        setBuyEurAmount(e.target.value);
                                                        // Auto-calculate total when quantity changes ONLY IF NOT MANUAL
                                                        if (!isTotalManual) {
                                                            const qty = parseAndEvaluate(e.target.value);
                                                            const price = parseAndEvaluate(buyEurPrice);
                                                            if (qty > 0 && price > 0) {
                                                                setBuyEurTotal((qty * price).toFixed(0));
                                                            } else if (qty === 0 || e.target.value === '') {
                                                                setBuyEurTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyEurAmount'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {formValidation.errors['buyEurAmount'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyEurAmount']}</p>}
                                            </div>
                                            <div>
                                                <Label>{t('portfolio.buyPriceEur')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={buyEurPrice}
                                                    onChange={e => {
                                                        setBuyEurPrice(e.target.value);
                                                        // Auto-calculate total when price changes ONLY IF NOT MANUAL
                                                        if (!isTotalManual) {
                                                            const qty = parseAndEvaluate(buyEurAmount);
                                                            const price = parseAndEvaluate(e.target.value);
                                                            if (qty > 0 && price > 0) {
                                                                setBuyEurTotal((qty * price).toFixed(0));
                                                            } else if (price === 0 || e.target.value === '') {
                                                                setBuyEurTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyEurPrice'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {formValidation.errors['buyEurPrice'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyEurPrice']}</p>}
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.basedOnPamEur')}</p>
                                            </div>
                                            <div>
                                                <Label>{t('transactions.totalAmount')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={buyEurTotal}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setBuyEurTotal(val);
                                                        if (val) {
                                                            setIsTotalManual(true);
                                                            // Bidirectional: Calculate Quantity from Total
                                                            const total = parseAndEvaluate(val);
                                                            const price = parseAndEvaluate(buyEurPrice);
                                                            if (total > 0 && price > 0) {
                                                                setBuyEurAmount((total / price).toFixed(2));
                                                            }
                                                        } else {
                                                            setIsTotalManual(false);
                                                            // Immediate auto-calc when cleared
                                                            const qty = parseAndEvaluate(buyEurAmount);
                                                            const price = parseAndEvaluate(buyEurPrice);
                                                            if (qty > 0 && price > 0) setBuyEurTotal((qty * price).toFixed(0));
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        const total = parseAndEvaluate(buyEurTotal);
                                                        if (!isNaN(total) && total > 0) {
                                                            setBuyEurTotal(Math.round(total).toString());
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyEurTotal'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    placeholder={t('transactions.autoCalc')}
                                                />
                                                {formValidation.errors['buyEurTotal'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyEurTotal']}</p>}
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.autoCalc')}</p>
                                            </div>
                                            <ClientLinker
                                                {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }}
                                                errorMessage={formValidation.errors['linkedClientId']}
                                                hasError={!!formValidation.errors['linkedClientId']}
                                                errorMessageDzd={formValidation.errors['linkedClientDzdId']}
                                                hasErrorDzd={!!formValidation.errors['linkedClientDzdId']}
                                            />
                                            <div>
                                                <Label>{t('common.notesOptional')}</Label>
                                                <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                                            </div>
                                        </div>
                                    )}

                                    {/* CASE 4: Buy USDT (Standard) */}
                                    {mode === 'buy_usdt' && !buyUsdtMode && (
                                        <div className="space-y-4">
                                            <div>
                                                <Label>{t('transactions.qtyUsdt')}</Label>
                                                <NumberInput value={buyUsdtAmount} onChange={e => setBuyUsdtAmount(e.target.value)} className={fieldBase} />
                                            </div>
                                            <div>
                                                <Label>{t('transactions.buyPrice')} ({t('common.dinar')})</Label>
                                                <NumberInput value={buyUsdtPrice} onChange={e => setBuyUsdtPrice(e.target.value)} className={fieldBase} />
                                            </div>
                                            <ClientLinker {...{ linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
                                            <div>
                                                <Label>{t('common.notesOptional')}</Label>
                                                <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                    {/* Validation Alert */}
                    {!formValidation.isValid && (
                        <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                <span className="text-red-500 font-bold">!</span>
                            </div>
                            <p className="text-sm text-red-500 font-medium">
                                {t('common.fillAllFields') || "Veuillez remplir correctement tous les champs obligatoires."}
                            </p>
                        </div>
                    )}
                </DialogContent>
                <DialogFooter>
                    {(mode !== 'buy_usdt' || buyUsdtMode) && (
                        <div className="flex gap-3 w-full">
                            <Button onClick={closeForm} className={`flex-1 ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} text-slate-800 dark:text-slate-200 py-3 rounded-xl font-bold`}>{t('common.cancel')}</Button>
                            <Button
                                onClick={mode?.startsWith('buy') ? handleBuy : handleSell}
                                disabled={!formValidation.isValid || isSaving}
                                className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all ${!formValidation.isValid || isSaving ? 'bg-slate-400 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/40 hover:-translate-y-0.5'}`}
                            >
                                {isSaving ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{t('common.processing')}</span>
                                    </div>
                                ) : (
                                    t('transactions.confirm')
                                )}
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </Dialog>
    );
}

