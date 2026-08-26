import { memo, useEffect, useMemo, useRef } from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../ui/Modal';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { NumberInput } from '../ui/NumberInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ArrowDownIcon } from '../icons/ArrowDownIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { TransactionPreviewCard, type PreviewRow } from '../ui/TransactionPreviewCard';
import { MoneyField } from '../ui/MoneyField';
import { parseAndEvaluate } from '../../utils';
import { formatMoney } from '../../pages/shared/pageFormat';
import { normalizeLedgerLabel } from '../../utils/financialUx';
type MainClientOperationsDialogsProps = Record<string, any>;
const normalizeCardName = (value: string) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const formatCardValue = (value: number) => Number(value.toFixed(2)).toString();
type TranslateFn = (key: string) => unknown;
const getDisplayLabel = (t: TranslateFn | undefined, key: string, fallback: string) => {
    const value = t?.(key);
    return typeof value === 'string' && value !== key ? value : fallback;
};
const formatMessage = (t: TranslateFn | undefined, key: string, fallback: string, values: Record<string, string | number> = {}) => Object.entries(values)
    .reduce((message, [name, value]) => message.split(`{${name}}`).join(String(value)), getDisplayLabel(t, key, fallback));
const resolveAdjustmentAutoPrice = (asset: string, treasuryCards: Array<{
    name?: string;
    value?: number;
}>, portfolioStats: any, t?: TranslateFn) => {
    if (asset !== 'USDT' && asset !== 'EUR') {
        return { value: '', sourceLabel: '', sourceType: 'none' as const };
    }
    const currency = asset;
    const pamLabel = getDisplayLabel(t, 'portfolio.currentPam', 'PAM');
    const cardCandidates = [
        `pma ${currency.toLowerCase()}`,
        `pam ${currency.toLowerCase()}`,
        `${currency.toLowerCase()} pma`,
        `${currency.toLowerCase()} pam`
    ];
    const matchedCard = (treasuryCards || []).find((card) => {
        const normalizedName = normalizeCardName(card?.name || '');
        return cardCandidates.some((candidate) => normalizedName === candidate || normalizedName.includes(candidate));
    });
    const rawCardValue = Number(matchedCard?.value || 0);
    if (rawCardValue > 0) {
        return {
            value: formatCardValue(rawCardValue),
            sourceLabel: (matchedCard?.name || `${pamLabel} ${currency}`).replace(/\bpma\b/gi, 'PAM'),
            sourceType: 'card' as const
        };
    }
    const fallbackValue = Number(currency === 'USDT'
        ? (portfolioStats?.usdt?.avgBuy || 0)
        : (portfolioStats?.eur?.avgBuy || 0));
    if (fallbackValue > 0) {
        return {
            value: formatCardValue(fallbackValue),
            sourceLabel: `${pamLabel} ${currency} — ${getDisplayLabel(t, 'nav.portfolio', 'portefeuille')}`,
            sourceType: 'portfolio' as const
        };
    }
    return {
        value: '',
        sourceLabel: getDisplayLabel(t, 'transactions.pamCardMissing', 'Carte PAM {currency} introuvable').replace('{currency}', currency),
        sourceType: 'missing' as const
    };
};
const adjustmentAssetOptions = [
    { value: 'DZD-Caisse', label: 'DZD - Caisse' },
    { value: 'DZD-Baridi', label: 'DZD - Baridi' },
    { value: 'USDT', label: 'USDT' },
    { value: 'EUR', label: 'EUR' }
] as const;
const getAdjustmentAssetLabel = (asset: string) => adjustmentAssetOptions.find((option) => option.value === asset)?.label || asset;
const formatDisplayMetric = (value: number, digits = 2) => new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
}).format(Number.isFinite(value) ? value : 0);
function MainClientOperationsDialogsComponent({ isClientTxModalOpen, setIsClientTxModalOpen, editingClientTx, t, clientTxType, setClientTxType, fieldBase, clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice, clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice, clientTxAmount, setClientTxAmount, clientTxNotes, setClientTxNotes, clientTxPaymentStatus = 'cash', setClientTxPaymentStatus, clientTxLinkedClientId, clientTxReceiverClientId = 'none', setClientTxReceiverClientId, handleSaveClientTx, selectedClientId, isAdjustmentModalOpen, setIsAdjustmentModalOpen, editingTreasuryTx, adjustmentTab, setAdjustmentTab, adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount, adjustmentClientId, clientBalances, portfolioStats, treasuryStats, clientsDzd, getClientFullName, setAdjustmentClientId, adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote, treasuryCards, handleGlobalAdjustment, isSaving }: MainClientOperationsDialogsProps) {
    const lastAutoPriceRef = useRef('');
    const normalizedClientTxType = normalizeLedgerLabel(clientTxType || '');
    const isClientSettlementTx = normalizedClientTxType === 'Règlement Reçu' || normalizedClientTxType === 'Paiement Effectué';
    const isClientPaymentReceived = normalizedClientTxType === 'Règlement Reçu';
    const isClientPaymentMade = normalizedClientTxType === 'Paiement Effectué';
    const settlementPaymentStatus = clientTxPaymentStatus === 'baridi' ? 'baridi' : 'cash';
    const clientSettlementWalletLabel = String(settlementPaymentStatus === 'baridi' ? t('transactions.baridi') : t('transactions.cash'));
    const clientSettlementHint = String(isClientPaymentReceived ? t('transactions.clientTreasuryAddHint') : t('transactions.clientTreasuryRetraitHint'))
        .replace('{wallet}', clientSettlementWalletLabel);
    const parsedClientTxAmount = parseAndEvaluate(clientTxAmount);
    const clientTxTargetClientId = clientTxLinkedClientId && clientTxLinkedClientId !== 'none'
        ? clientTxLinkedClientId
        : selectedClientId;
    const receiverClientOptions = useMemo(() => (clientsDzd || [])
        .filter((client: any) => client.id !== clientTxTargetClientId)
        .map((client: any) => ({ value: client.id, label: getClientFullName(client) })), [clientsDzd, clientTxTargetClientId, getClientFullName]);
    const receiverClient = (clientsDzd || []).find((client: any) => client.id === clientTxReceiverClientId) || null;
    const canUseReceiverClient = !editingClientTx && isClientPaymentReceived;
    const hasReceiverClient = canUseReceiverClient && clientTxReceiverClientId !== 'none' && Boolean(receiverClient);
    const receiverClientName = receiverClient ? getClientFullName(receiverClient) : '';
    const clientTxMaxAmount = Math.abs(Number(clientBalances?.get?.(clientTxTargetClientId) || 0));
    const clientTxMaxDisabled = !isClientSettlementTx || clientTxMaxAmount <= 0.005;
    const clientSettlementWalletBalance = clientSettlementWalletLabel === 'Caisse'
        ? Number(treasuryStats?.caisse || 0)
        : Number(treasuryStats?.baridi || 0);
    const clientSettlementWalletInsufficient = (isClientSettlementTx
        && !editingClientTx
        && !isClientPaymentReceived
        && !hasReceiverClient
        && Number.isFinite(parsedClientTxAmount)
        && Math.abs(parsedClientTxAmount) > clientSettlementWalletBalance + 0.01);
    const adjustmentAuto = useMemo(() => resolveAdjustmentAutoPrice(adjustmentAsset, treasuryCards || [], portfolioStats, t), [adjustmentAsset, treasuryCards, portfolioStats, t]);
    const handleAdjustmentAssetChange = (value: string) => {
        setAdjustmentAsset(value);
        if (editingTreasuryTx)
            return;
        const nextAuto = resolveAdjustmentAutoPrice(value, treasuryCards || [], portfolioStats, t);
        setAdjustmentPrice(nextAuto.value);
        lastAutoPriceRef.current = nextAuto.value;
    };
    useEffect(() => {
        if (isClientTxModalOpen && isClientSettlementTx && clientTxPaymentStatus === 'credit') {
            setClientTxPaymentStatus?.('cash');
        }
    }, [isClientTxModalOpen, isClientSettlementTx, clientTxPaymentStatus, setClientTxPaymentStatus]);
    useEffect(() => {
        if (!isClientTxModalOpen || !setClientTxReceiverClientId)
            return;
        if (!canUseReceiverClient && clientTxReceiverClientId !== 'none') {
            setClientTxReceiverClientId('none');
            return;
        }
        if (clientTxReceiverClientId !== 'none' && clientTxReceiverClientId === clientTxTargetClientId) {
            setClientTxReceiverClientId('none');
        }
    }, [isClientTxModalOpen, canUseReceiverClient, clientTxReceiverClientId, clientTxTargetClientId, setClientTxReceiverClientId]);
    useEffect(() => {
        if (!isAdjustmentModalOpen || editingTreasuryTx)
            return;
        if (adjustmentAsset !== 'USDT' && adjustmentAsset !== 'EUR') {
            if (adjustmentPrice === lastAutoPriceRef.current && adjustmentPrice !== '') {
                setAdjustmentPrice('');
            }
            lastAutoPriceRef.current = '';
            return;
        }
        if (!adjustmentPrice || adjustmentPrice === lastAutoPriceRef.current) {
            if (adjustmentPrice !== adjustmentAuto.value) {
                setAdjustmentPrice(adjustmentAuto.value);
            }
        }
        lastAutoPriceRef.current = adjustmentAuto.value;
    }, [isAdjustmentModalOpen, editingTreasuryTx, adjustmentAsset, adjustmentAuto.value, adjustmentPrice, setAdjustmentPrice]);
    const isCryptoAdjustment = adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR';
    const isDzdAdjustment = adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi';
    const selectedAssetLabel = getAdjustmentAssetLabel(adjustmentAsset);
    const selectedClient = (clientsDzd || []).find((client: any) => client.id === adjustmentClientId);
    const selectedClientName = selectedClient ? getClientFullName(selectedClient) : getDisplayLabel(t, 'transactions.noClient', 'Aucun client');
    const linkedClientBalance = Number(clientBalances?.get?.(adjustmentClientId) || 0);
    const selectedAssetMax = Number(adjustmentAsset === 'DZD-Caisse'
        ? (treasuryStats?.caisse || 0)
        : adjustmentAsset === 'DZD-Baridi'
            ? (treasuryStats?.baridi || 0)
            : adjustmentAsset === 'USDT'
                ? (portfolioStats?.usdt?.available || 0)
                : adjustmentAsset === 'EUR'
                    ? (portfolioStats?.eur?.available || 0)
                    : 0);
    const availableAssetBalance = Number(adjustmentAsset === 'USDT'
        ? (portfolioStats?.usdt?.available || 0)
        : adjustmentAsset === 'EUR'
            ? (portfolioStats?.eur?.available || 0)
            : 0);
    const parsedAdjustmentAmount = Number.parseFloat(adjustmentAmount || '0');
    const exceedsAvailableBalance = adjustmentTab === 'subtract' && (adjustmentAsset === 'USDT'
        ? parsedAdjustmentAmount > (portfolioStats?.usdt?.available || 0)
        : adjustmentAsset === 'EUR'
            ? parsedAdjustmentAmount > (portfolioStats?.eur?.available || 0)
            : adjustmentAsset === 'DZD-Caisse'
                ? parsedAdjustmentAmount > (treasuryStats?.caisse || 0)
                : adjustmentAsset === 'DZD-Baridi'
                    ? parsedAdjustmentAmount > (treasuryStats?.baridi || 0)
                    : false);
    const isConfirmDisabled = (isSaving ||
        !adjustmentAmount ||
        parsedAdjustmentAmount <= 0 ||
        exceedsAvailableBalance);
    const linkedClientMax = isDzdAdjustment
        ? (adjustmentTab === 'add'
            ? Math.max(0, -linkedClientBalance)
            : Math.max(0, linkedClientBalance))
        : 0;
    const usesClientMax = isDzdAdjustment && !!adjustmentClientId;
    const usesAssetMax = !usesClientMax && !(adjustmentTab === 'add' && isDzdAdjustment);
    const maxValue = usesClientMax ? linkedClientMax : (usesAssetMax ? selectedAssetMax : 0);
    const maxDisabled = maxValue <= 0;
    const maxButtonTitle = maxDisabled
        ? (usesClientMax
            ? (adjustmentTab === 'add'
                ? getDisplayLabel(t, 'transactions.noClientDebtToSettle', 'Aucune dette client à régler')
                : getDisplayLabel(t, 'transactions.noClientCreditToRefund', 'Aucun solde en faveur du client à rembourser'))
            : (adjustmentTab === 'add' && isDzdAdjustment
                ? getDisplayLabel(t, 'transactions.selectClientFirst', 'Sélectionnez un client')
                : getDisplayLabel(t, 'transactions.noMaximumAvailable', 'Aucune valeur maximale disponible')))
        : getDisplayLabel(t, 'transactions.useMaximumValue', 'Utiliser la valeur maximale');
    const amountHint = usesClientMax
        ? (linkedClientMax > 0
            ? formatMessage(t, 'transactions.maxClientBalance', 'Maximum applicable au client : {amount} DZD.', { amount: formatDisplayMetric(linkedClientMax) })
            : (adjustmentTab === 'add'
                ? getDisplayLabel(t, 'transactions.noClientDebtToSettle', 'Aucune dette client à régler')
                : getDisplayLabel(t, 'transactions.noClientCreditToRefund', 'Aucun solde en faveur du client à rembourser')))
        : adjustmentTab === 'add' && isDzdAdjustment
            ? getDisplayLabel(t, 'transactions.maxAfterClientSelection', 'Maximum disponible après sélection du client.')
            : formatMessage(t, 'transactions.maxAssetBalance', 'Maximum selon {asset} : {amount} {currency}.', {
                asset: selectedAssetLabel,
                amount: formatDisplayMetric(selectedAssetMax),
                currency: isCryptoAdjustment ? adjustmentAsset : 'DZD'
            });
    const confirmHelperText = isSaving
        ? getDisplayLabel(t, 'common.processing', 'Traitement...')
        : !adjustmentAmount || parsedAdjustmentAmount <= 0
            ? getDisplayLabel(t, 'transactions.enterValidAmount', 'Saisissez un montant valide.')
            : exceedsAvailableBalance
                ? formatMessage(t, 'transactions.amountExceedsAssetBalance', 'Le montant dépasse le solde {asset}.', { asset: adjustmentAsset })
                : adjustmentTab === 'add'
                    ? getDisplayLabel(t, 'transactions.balanceWillBeAdded', 'Le solde sera ajouté.')
                    : getDisplayLabel(t, 'transactions.balanceWillBeRemoved', 'Le solde sera retiré.');
    const amountErrorText = !adjustmentAmount || parsedAdjustmentAmount <= 0
        ? getDisplayLabel(t, 'common.invalidAmount', 'Montant invalide')
        : exceedsAvailableBalance
            ? formatMessage(t, 'transactions.insufficientAssetBalance', 'Solde {asset} insuffisant', { asset: selectedAssetLabel })
            : '';
    const modalHeaderClass = 'sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5';
    const modalFooterClass = 'sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5';
    return (<>
            <Modal isOpen={isClientTxModalOpen} onClose={() => setIsClientTxModalOpen(false)} className="max-w-lg bg-surface">
                <ModalHeader onClose={() => setIsClientTxModalOpen(false)} className={modalHeaderClass}>
                    <ModalTitle className="text-base sm:text-lg">{editingClientTx ? t('transactions.editOperation') : t('transactions.newOperation')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                    {!editingClientTx && isClientSettlementTx && (<div>
                            <Label>{t('transactions.operationType')}</Label>
                            <Select id="tx_type_select" value={normalizedClientTxType} onChange={e => setClientTxType(e.target.value as any)} disabled={!!editingClientTx}>
                                <option value="Règlement Reçu">{t('transactions.paymentReceived')}</option>
                                <option value="Paiement Effectué">{t('transactions.paymentMade')}</option>
                            </Select>
                        </div>)}

                    {isClientSettlementTx && (<div className="rounded-2xl border border-border bg-surface-muted p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <Label>{t('transactions.settlementMethod')}</Label>
                                <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-semibold uppercase text-neutral-500 shadow-sm">
                                    {isClientPaymentReceived ? t('transactions.add') : t('transactions.withdraw')}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                { value: 'cash', label: t('transactions.cash'), icon: <WalletIcon className="h-4 w-4"/>, activeClass: 'border-financial-profit bg-success-bg text-financial-profit' },
                { value: 'baridi', label: t('transactions.baridi'), icon: <BanknotesIcon className="h-4 w-4"/>, activeClass: 'border-primary bg-primary/10 text-primary' }
            ].map((option) => {
                const isActive = settlementPaymentStatus === option.value;
                return (<button key={option.value} type="button" onClick={() => setClientTxPaymentStatus?.(option.value)} className={`flex min-h-14 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition-all ${isActive
                        ? option.activeClass
                        : 'border-border bg-surface text-neutral-600 hover:border-border-strong'}`}>
                                            {option.icon}
                                            <span className="truncate">{option.label}</span>
                                        </button>);
            })}
                            </div>
                            <p className={`mt-2 text-xs leading-5 ${clientSettlementWalletInsufficient ? 'text-financial-loss' : 'text-neutral-500'}`}>
                                {clientSettlementWalletInsufficient
                ? formatMessage(t, 'transactions.insufficientAssetBalance', 'Solde {asset} insuffisant.', { asset: clientSettlementWalletLabel })
                : clientSettlementHint}
                            </p>
                        </div>)}

                    {canUseReceiverClient && (<div>
                            <Label>{t('transactions.receivedBy')}</Label>
                            <SearchableSelect
                                value={clientTxReceiverClientId}
                                onChange={(value) => setClientTxReceiverClientId?.(value)}
                                options={receiverClientOptions}
                                fieldClassName={fieldBase}
                                searchPlaceholder={t('transactions.searchReceivingClient')}
                                emptyOptionLabel={isClientPaymentReceived ? t('transactions.walletSelf') : t('transactions.selectedClientWallet')}
                                emptyValue="none"
                                noResultsLabel={t('transactions.noOtherClientFound')}
                                clearable
                                clearLabel={isClientPaymentReceived ? t('transactions.walletSelf') : t('transactions.selectedClientWallet')}
                            />
                            <p className="mt-1 text-xs text-neutral-500">
                                {hasReceiverClient && isClientPaymentReceived
                                    ? formatMessage(t, 'transactions.receiptTransferredDebt', 'Aucun encaissement dans {wallet}. La dette est transférée à {client}.', { wallet: clientSettlementWalletLabel, client: receiverClientName })
                                    : hasReceiverClient && isClientPaymentMade
                                        ? formatMessage(t, 'transactions.payoutTransferredCredit', 'Aucun remboursement depuis {wallet}. Le solde en faveur du client est transféré à {client}.', { wallet: clientSettlementWalletLabel, client: receiverClientName })
                                        : isClientPaymentReceived
                                            ? formatMessage(t, 'transactions.receiptWalletFallback', 'Laissez vide si vous avez encaissé vous-même dans {wallet}.', { wallet: clientSettlementWalletLabel })
                                            : formatMessage(t, 'transactions.payoutWalletFallback', 'Laissez vide si le client sélectionné a reçu le remboursement depuis {wallet}.', { wallet: clientSettlementWalletLabel })}
                            </p>
                        </div>)}

                    {normalizedClientTxType === 'Vente USDT' ? (<div className="space-y-4">
                                                                    <div>
                                                                        <MoneyField label={t('portfolio.qtyUsdt')} value={clientTxUsdtAmount} onChange={setClientTxUsdtAmount} currency="USDT" onMax={() => setClientTxUsdtAmount(portfolioStats.usdt.available.toFixed(2))} placeholder="0.00"/>
                                                                    </div>
                                                                    <div>
                                                                        <Label>{t('portfolio.sellingPriceDzd')}</Label>
                                                                        <NumberInput value={clientTxSellPrice} onChange={e => setClientTxSellPrice(e.target.value)}/>
                                                                    </div>
                                                                </div>) : normalizedClientTxType === 'Achat EUR' ? (<div className="space-y-4">
                                                                    <div>
                                                                        <MoneyField label={t('transactions.qtyEur')} value={clientTxEurAmount} onChange={setClientTxEurAmount} currency="EUR" onMax={() => setClientTxEurAmount(portfolioStats.eur.available.toFixed(2))} placeholder="0.00"/>
                                                                    </div>
                                                                    <div>
                                                                        <Label>{t('portfolio.buyPrice')}</Label>
                                                                        <NumberInput value={clientTxEurPrice} onChange={e => setClientTxEurPrice(e.target.value)}/>
                                                                    </div>
                                                                </div>) : (<div>
                            <Label>{t('transactions.amountDzd')}</Label>
                            <div className="relative">
                                <Input type="text" inputMode="decimal" value={clientTxAmount} onChange={e => setClientTxAmount(e.target.value)} className="pe-20" placeholder={t('transactions.signedAmountPlaceholder')}/>
                                {isClientSettlementTx && (<button type="button" onClick={() => {
                    if (clientTxMaxDisabled)
                        return;
                    setClientTxAmount(formatCardValue(clientTxMaxAmount));
                }} disabled={clientTxMaxDisabled} className={`absolute end-1 top-1/2 flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-md px-2 text-xs font-bold transition-colors ${clientTxMaxDisabled
                    ? 'cursor-not-allowed bg-neutral-200 text-neutral-400'
                    : 'bg-primary text-white hover:bg-primary-dark'}`}>
                                        {t('common.max')}
                                    </button>)}
                            </div>
                            <p className="mt-1 text-xs opacity-60">
                                {isClientSettlementTx ? t('transactions.enterPositiveSettlementAmount') : t('transactions.enterPositiveNegativeValue')}
                            </p>
                        </div>)}
                    {(() => {
            let rows: PreviewRow[] = [];
            let error: string | undefined;
            let valid = false;
            if (normalizedClientTxType === 'Vente USDT') {
                const qty = parseAndEvaluate(clientTxUsdtAmount);
                const price = parseAndEvaluate(clientTxSellPrice);
                if (qty > 0 && price > 0) {
                    valid = true;
                    rows = [
                        { label: t('portfolio.qtyUsdt'), value: qty, currency: 'USDT' },
                        { label: t('portfolio.sellingPriceDzd'), value: price, currency: 'DZD' },
                        { label: t('transactions.totalAmount'), value: qty * price, currency: 'DZD', emphasize: true }
                    ];
                    if (qty > (portfolioStats?.usdt?.available || 0))
                        error = formatMessage(t, 'transactions.insufficientAssetBalance', 'Solde {asset} insuffisant', { asset: 'USDT' });
                }
            }
            else if (normalizedClientTxType === 'Achat EUR') {
                const qty = parseAndEvaluate(clientTxEurAmount);
                const price = parseAndEvaluate(clientTxEurPrice);
                if (qty > 0 && price > 0) {
                    valid = true;
                    rows = [
                        { label: t('transactions.qtyEur'), value: qty, currency: 'EUR' },
                        { label: t('portfolio.buyPrice'), value: price, currency: 'DZD' },
                        { label: t('transactions.totalAmount'), value: qty * price, currency: 'DZD', emphasize: true }
                    ];
                }
            }
            else {
                const amt = parseAndEvaluate(clientTxAmount);
                if (Number.isFinite(amt) && amt !== 0) {
                    valid = true;
                    const isReceived = normalizedClientTxType === 'Règlement Reçu';
                    rows = [
                        { label: t('transactions.clientBalanceImpact'), value: Math.abs(amt), currency: 'DZD', semantic: isReceived ? 'profit' : 'loss', emphasize: true }
                    ];
                    if (isClientSettlementTx && hasReceiverClient) {
                        rows.push({
                            label: isReceived
                                ? formatMessage(t, 'transactions.transferredDebt', 'Dette transférée à {client}', { client: receiverClientName })
                                : formatMessage(t, 'transactions.transferredClientCredit', 'Solde en faveur transféré à {client}', { client: receiverClientName }),
                            value: Math.abs(amt),
                            currency: 'DZD',
                            semantic: isReceived ? 'loss' : 'profit'
                        });
                    }
                    else if (isClientSettlementTx) {
                        rows.push({
                            label: `${t('transactions.treasuryMovement')} (${clientSettlementWalletLabel})`,
                            value: Math.abs(amt),
                            currency: 'DZD',
                            semantic: isReceived ? 'profit' : 'loss'
                        });
                    }
                    if (clientSettlementWalletInsufficient)
                        error = formatMessage(t, 'transactions.insufficientAssetBalance', 'Solde {asset} insuffisant', { asset: clientSettlementWalletLabel });
                }
            }
            if (!valid)
                return null;
            return (<TransactionPreviewCard title={t('transactions.confirmAndSave')} rows={rows.filter(r => r.label !== 'Type')} error={error}/>);
        })()}
                </ModalContent>
                <ModalFooter className={modalFooterClass}>
                    {(() => {
            const isVenteUsdt = normalizedClientTxType === 'Vente USDT';
            const isAchatEur = normalizedClientTxType === 'Achat EUR';
            const qtyVal = isVenteUsdt
                ? parseAndEvaluate(clientTxUsdtAmount)
                : isAchatEur
                    ? parseAndEvaluate(clientTxEurAmount)
                    : 0;
            const priceVal = isVenteUsdt
                ? parseAndEvaluate(clientTxSellPrice)
                : isAchatEur
                    ? parseAndEvaluate(clientTxEurPrice)
                    : 0;
            const amtVal = parseAndEvaluate(clientTxAmount);
            const exceedsUsdt = isVenteUsdt && qtyVal > (portfolioStats?.usdt?.available || 0);
            const isInvalid = (isVenteUsdt || isAchatEur)
                ? (qtyVal <= 0 || priceVal <= 0 || exceedsUsdt)
                : (!Number.isFinite(amtVal) || amtVal === 0 || (isClientSettlementTx && amtVal <= 0) || clientSettlementWalletInsufficient);
            const isDisabled = isSaving || isInvalid;
            return (<Button onClick={() => handleSaveClientTx(selectedClientId)} disabled={isDisabled} className={`w-full rounded-xl py-3 font-bold text-white ${isDisabled ? 'bg-neutral-400 cursor-not-allowed' : 'bg-success hover:opacity-95'}`}>
                                {isSaving ? t('common.processing') : exceedsUsdt ? formatMessage(t, 'transactions.insufficientAssetBalance', 'Solde {asset} insuffisant', { asset: 'USDT' }) : t('common.save')}
                            </Button>);
        })()}
                </ModalFooter>
            </Modal>

            <Modal isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} className="max-w-md bg-surface">
                <ModalHeader onClose={() => setIsAdjustmentModalOpen(false)} className={modalHeaderClass}>
                    <ModalTitle className="text-base sm:text-lg">{editingTreasuryTx ? t('transactions.editAdjustment') : t('transactions.treasuryAdjustment')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
                    <div className="flex gap-1 rounded-xl p-1 bg-neutral-100">
                        <button type="button" onClick={() => setAdjustmentTab('add')} className={`min-h-touch flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${adjustmentTab === 'add'
            ? 'bg-success text-white shadow-sm'
            : 'text-neutral-600 hover:text-neutral-800'}`}>
                            {t('transactions.addTo')}
                        </button>
                        <button type="button" onClick={() => setAdjustmentTab('subtract')} className={`min-h-touch flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${adjustmentTab === 'subtract'
            ? 'bg-danger text-white shadow-sm'
            : 'text-neutral-600 hover:text-neutral-800'}`}>
                            {t('transactions.withdrawFrom')}
                        </button>
                    </div>

                    <div>
                        <Label>{t('transactions.assetType')}</Label>
                        <div className="relative mt-1">
                            <Select value={adjustmentAsset} onChange={e => handleAdjustmentAssetChange(e.target.value as any)} className="h-12 appearance-none pe-10">
                                {adjustmentAssetOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                            </Select>
                            <ArrowDownIcon className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"/>
                        </div>
                    </div>

                    <MoneyField label={isCryptoAdjustment ? t('transactions.quantity') : t('transactions.amount')} value={adjustmentAmount} onChange={setAdjustmentAmount} currency={isCryptoAdjustment ? (adjustmentAsset as 'USDT' | 'EUR') : 'DZD'} placeholder="0.00" onMax={() => {
            if (maxDisabled)
                return;
            setAdjustmentAmount(formatCardValue(maxValue));
        }} maxDisabled={maxDisabled} hint={amountHint} error={amountErrorText || undefined}/>

                    {isCryptoAdjustment && (<MoneyField label={t('transactions.unitPrice')} value={adjustmentPrice} onChange={setAdjustmentPrice} currency="DZD" placeholder="Ex: 240.00" hint={adjustmentAuto.sourceType === 'missing'
                ? adjustmentAuto.sourceLabel
                : `${t('transactions.pamAuto')}: ${adjustmentAuto.sourceLabel}`}/>)}

                    {isDzdAdjustment && (<div>
                            <Label>{t('transactions.linkedClientOptional')} <span className="text-xs font-normal text-neutral-400">({t('common.optional')})</span></Label>
                            <div className="mt-1">
                                <SearchableSelect value={adjustmentClientId} onChange={setAdjustmentClientId} options={(clientsDzd || []).map((client: any) => ({ value: client.id, label: getClientFullName(client) }))} searchPlaceholder={t('transactions.searchClient')} emptyOptionLabel={t('transactions.noClient')} emptyValue="" noResultsLabel={t('transactions.noClientFound')} clearable clearLabel={t('transactions.clearClient')}/>
                            </div>
                        </div>)}

                    {(() => {
            const qty = parsedAdjustmentAmount;
            if (!Number.isFinite(qty) || qty <= 0)
                return null;
            const sign = adjustmentTab === 'add' ? 1 : -1;
            const rows: PreviewRow[] = [];
            if (isCryptoAdjustment) {
                const price = parseAndEvaluate(adjustmentPrice);
                const totalDzd = qty * price;
                const nextAvailable = availableAssetBalance + sign * qty;
                rows.push({ label: t('transactions.quantity'), value: qty, currency: adjustmentAsset as 'USDT' | 'EUR' });
                if (price > 0) {
                    rows.push({ label: t('transactions.unitPrice'), value: price, currency: 'DZD' });
                    rows.push({ label: t('transactions.equivalentDzd'), value: totalDzd, currency: 'DZD', emphasize: true });
                }
                rows.push({ label: t('transactions.balanceAfterOperation'), value: nextAvailable, currency: adjustmentAsset as 'USDT' | 'EUR', semantic: 'auto' });
            }
            else {
                const nextTreasury = selectedAssetMax + sign * qty;
                rows.push({ label: t('transactions.amount'), value: qty, currency: 'DZD' });
                rows.push({ label: formatMessage(t, 'transactions.balanceAfterOperationForAsset', 'Solde après l’opération ({asset})', { asset: selectedAssetLabel }), value: nextTreasury, currency: 'DZD', semantic: 'auto' });
            }
            return (<TransactionPreviewCard title={t('transactions.confirmAndSave')} rows={rows} error={exceedsAvailableBalance ? formatMessage(t, 'transactions.insufficientAssetBalance', 'Solde {asset} insuffisant', { asset: selectedAssetLabel }) : undefined}/>);
        })()}
                </ModalContent>
                <ModalFooter className={modalFooterClass}>
                    <div className="flex gap-2 w-full">
                        <Button onClick={() => setIsAdjustmentModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold transition-colors bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleGlobalAdjustment} disabled={isConfirmDisabled} className={`flex-1 py-3 rounded-xl font-bold text-white shadow-sm transition-colors ${isConfirmDisabled
            ? 'cursor-not-allowed bg-neutral-400 opacity-70'
            : 'bg-primary hover:bg-primary-dark'}`} title={!isConfirmDisabled ? undefined : confirmHelperText}>
                            {isSaving ? t('common.processing') : t('common.confirm')}
                        </Button>
                    </div>
                </ModalFooter>
            </Modal>
        </>);
}
const areMainClientOperationsDialogsPropsEqual = (prev: MainClientOperationsDialogsProps, next: MainClientOperationsDialogsProps) => {
    if (prev.isClientTxModalOpen !== next.isClientTxModalOpen
        || prev.isAdjustmentModalOpen !== next.isAdjustmentModalOpen) {
        return false;
    }
    if (!next.isClientTxModalOpen && !next.isAdjustmentModalOpen) {
        return true;
    }
    if (next.isClientTxModalOpen) {
        const sameClientTxDialog = prev.editingClientTx === next.editingClientTx
            && prev.clientTxType === next.clientTxType
            && prev.clientTxUsdtAmount === next.clientTxUsdtAmount
            && prev.clientTxSellPrice === next.clientTxSellPrice
            && prev.clientTxEurAmount === next.clientTxEurAmount
            && prev.clientTxEurPrice === next.clientTxEurPrice
            && prev.clientTxAmount === next.clientTxAmount
            && prev.clientTxNotes === next.clientTxNotes
            && prev.clientTxPaymentStatus === next.clientTxPaymentStatus
            && prev.clientTxLinkedClientId === next.clientTxLinkedClientId
            && prev.clientTxReceiverClientId === next.clientTxReceiverClientId
            && prev.selectedClientId === next.selectedClientId
            && prev.clientsDzd === next.clientsDzd
            && prev.clientBalances === next.clientBalances
            && prev.treasuryStats === next.treasuryStats;
        if (!sameClientTxDialog)
            return false;
    }
    if (next.isAdjustmentModalOpen) {
        return (prev.editingTreasuryTx === next.editingTreasuryTx
            && prev.adjustmentTab === next.adjustmentTab
            && prev.adjustmentAsset === next.adjustmentAsset
            && prev.adjustmentAmount === next.adjustmentAmount
            && prev.adjustmentClientId === next.adjustmentClientId
            && prev.clientBalances === next.clientBalances
            && prev.portfolioStats === next.portfolioStats
            && prev.treasuryStats === next.treasuryStats
            && prev.clientsDzd === next.clientsDzd
            && prev.adjustmentPrice === next.adjustmentPrice
            && prev.adjustmentNote === next.adjustmentNote
            && prev.treasuryCards === next.treasuryCards
            && prev.isSaving === next.isSaving);
    }
    return true;
};
export const MainClientOperationsDialogs = memo(MainClientOperationsDialogsComponent, areMainClientOperationsDialogsPropsEqual);
