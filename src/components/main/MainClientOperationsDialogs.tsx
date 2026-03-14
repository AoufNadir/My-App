import { memo, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { NumberInput } from '../ui/NumberInput';
import { ArrowDownIcon } from '../icons/ArrowDownIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { WalletIcon } from '../icons/WalletIcon';

type MainClientOperationsDialogsProps = Record<string, any>;

const normalizeCardName = (value: string) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatCardValue = (value: number) => Number(value.toFixed(2)).toString();

const resolveAdjustmentAutoPrice = (
    asset: string,
    treasuryCards: Array<{ name?: string; value?: number }>,
    portfolioStats: any
) => {
    if (asset !== 'USDT' && asset !== 'EUR') {
        return { value: '', sourceLabel: '', sourceType: 'none' as const };
    }

    const currency = asset;
    const cardCandidates = [
        `pma ${currency.toLowerCase()}`,
        `pam ${currency.toLowerCase()}`,
        `${currency.toLowerCase()} pma`,
        `${currency.toLowerCase()} pam`
    ];

    const matchedCard = (treasuryCards || []).find((card) => {
        const normalizedName = normalizeCardName(card?.name || '');
        return cardCandidates.some((candidate) =>
            normalizedName === candidate || normalizedName.includes(candidate)
        );
    });

    const rawCardValue = Number(matchedCard?.value || 0);
    if (rawCardValue > 0) {
        return {
            value: formatCardValue(rawCardValue),
            sourceLabel: matchedCard?.name || `PMA ${currency}`,
            sourceType: 'card' as const
        };
    }

    const fallbackValue = Number(
        currency === 'USDT'
            ? (portfolioStats?.usdt?.avgBuy || 0)
            : (portfolioStats?.eur?.avgBuy || 0)
    );

    if (fallbackValue > 0) {
        return {
            value: formatCardValue(fallbackValue),
            sourceLabel: `PAM ${currency} portefeuille`,
            sourceType: 'portfolio' as const
        };
    }

    return {
        value: '',
        sourceLabel: `Carte PMA/PAM ${currency} introuvable`,
        sourceType: 'missing' as const
    };
};

const adjustmentAssetOptions = [
    { value: 'DZD-Caisse', label: 'DZD - Caisse' },
    { value: 'DZD-Baridi', label: 'DZD - Baridi' },
    { value: 'USDT', label: 'USDT' },
    { value: 'EUR', label: 'EUR' }
] as const;

const getAdjustmentAssetLabel = (asset: string) =>
    adjustmentAssetOptions.find((option) => option.value === asset)?.label || asset;

const formatDisplayMetric = (value: number, digits = 2) =>
    new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits
    }).format(Number.isFinite(value) ? value : 0);

function MainClientOperationsDialogsComponent({
    isClientTxModalOpen,
    setIsClientTxModalOpen,
    cardBase,
    isDark,
    editingClientTx,
    t,
    clientTxType,
    setClientTxType,
    fieldBase,
    clientTxUsdtAmount,
    setClientTxUsdtAmount,
    clientTxSellPrice,
    setClientTxSellPrice,
    clientTxEurAmount,
    setClientTxEurAmount,
    clientTxEurPrice,
    setClientTxEurPrice,
    clientTxAmount,
    setClientTxAmount,
    clientTxNotes,
    setClientTxNotes,
    handleSaveClientTx,
    selectedClientId,
    isAdjustmentModalOpen,
    setIsAdjustmentModalOpen,
    editingTreasuryTx,
    adjustmentTab,
    setAdjustmentTab,
    adjustmentAsset,
    setAdjustmentAsset,
    adjustmentAmount,
    setAdjustmentAmount,
    adjustmentClientId,
    clientBalances,
    portfolioStats,
    treasuryStats,
    clientsDzd,
    getClientFullName,
    setAdjustmentClientId,
    adjustmentPrice,
    setAdjustmentPrice,
    adjustmentNote,
    setAdjustmentNote,
    treasuryCards,
    handleGlobalAdjustment,
    isSaving
}: MainClientOperationsDialogsProps) {
    const lastAutoPriceRef = useRef('');

    const adjustmentAuto = useMemo(
        () => resolveAdjustmentAutoPrice(adjustmentAsset, treasuryCards || [], portfolioStats),
        [adjustmentAsset, treasuryCards, portfolioStats]
    );

    const handleAdjustmentAssetChange = (value: string) => {
        setAdjustmentAsset(value);

        if (editingTreasuryTx) return;

        const nextAuto = resolveAdjustmentAutoPrice(value, treasuryCards || [], portfolioStats);
        setAdjustmentPrice(nextAuto.value);
        lastAutoPriceRef.current = nextAuto.value;
    };

    useEffect(() => {
        if (!isAdjustmentModalOpen || editingTreasuryTx) return;

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
    }, [
        isAdjustmentModalOpen,
        editingTreasuryTx,
        adjustmentAsset,
        adjustmentAuto.value,
        adjustmentPrice,
        setAdjustmentPrice
    ]);

    const isCryptoAdjustment = adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR';
    const isDzdAdjustment = adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi';
    const selectedAssetLabel = getAdjustmentAssetLabel(adjustmentAsset);
    const selectedClient = (clientsDzd || []).find((client: any) => client.id === adjustmentClientId);
    const selectedClientName = selectedClient ? getClientFullName(selectedClient) : 'Aucun client';
    const linkedClientBalance = Number(clientBalances?.get?.(adjustmentClientId) || 0);
    const selectedAssetMax = Number(
        adjustmentAsset === 'DZD-Caisse'
            ? (treasuryStats?.caisse || 0)
            : adjustmentAsset === 'DZD-Baridi'
                ? (treasuryStats?.baridi || 0)
                : adjustmentAsset === 'USDT'
                    ? (portfolioStats?.usdt?.available || 0)
                    : adjustmentAsset === 'EUR'
                        ? (portfolioStats?.eur?.available || 0)
                        : 0
    );
    const availableAssetBalance = Number(
        adjustmentAsset === 'USDT'
            ? (portfolioStats?.usdt?.available || 0)
            : adjustmentAsset === 'EUR'
                ? (portfolioStats?.eur?.available || 0)
                : 0
    );
    const parsedAdjustmentAmount = Number.parseFloat(adjustmentAmount || '0');
    const exceedsAvailableBalance = adjustmentTab === 'subtract' && (
        adjustmentAsset === 'USDT'
            ? parsedAdjustmentAmount > (portfolioStats?.usdt?.available || 0)
            : adjustmentAsset === 'EUR'
                ? parsedAdjustmentAmount > (portfolioStats?.eur?.available || 0)
                : adjustmentAsset === 'DZD-Caisse'
                    ? parsedAdjustmentAmount > (treasuryStats?.caisse || 0)
                    : adjustmentAsset === 'DZD-Baridi'
                        ? parsedAdjustmentAmount > (treasuryStats?.baridi || 0)
                        : false
    );
    const isConfirmDisabled = (
        isSaving ||
        !adjustmentAmount ||
        parsedAdjustmentAmount <= 0 ||
        exceedsAvailableBalance
    );
    const maxDisabled = adjustmentTab === 'add' && isDzdAdjustment && !adjustmentClientId;
    const maxValue = adjustmentTab === 'add' && isDzdAdjustment
        ? Math.abs(linkedClientBalance)
        : selectedAssetMax;
    const amountHint = adjustmentTab === 'add'
        ? (isDzdAdjustment
            ? (adjustmentClientId
                ? `MAX client: ${formatDisplayMetric(Math.abs(linkedClientBalance))} DZD.`
                : 'MAX apres selection client.')
            : `MAX selon solde ${adjustmentAsset}: ${formatDisplayMetric(selectedAssetMax)} ${adjustmentAsset}.`)
        : `MAX selon ${selectedAssetLabel}: ${formatDisplayMetric(selectedAssetMax)} ${isCryptoAdjustment ? adjustmentAsset : 'DZD'}.`;
    const confirmHelperText = isSaving
        ? 'Traitement en cours...'
        : !adjustmentAmount || parsedAdjustmentAmount <= 0
            ? 'Entrez un montant valide.'
            : exceedsAvailableBalance
                ? `Montant superieur au solde ${adjustmentAsset}.`
                : adjustmentTab === 'add'
                    ? 'Le solde sera ajoute.'
                    : 'Le solde sera retire.';
    const fieldShellClass = `${fieldBase} h-12 ${isDark ? 'border-slate-700/80 bg-slate-950/60 text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'}`;
    const maxButtonClass = `absolute right-2 top-2 text-xs px-2 py-1 rounded font-bold transition-colors ${maxDisabled
        ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
        : 'bg-sky-600 text-white hover:bg-sky-700'
        }`;
    const amountErrorText = !adjustmentAmount || parsedAdjustmentAmount <= 0
        ? 'Montant invalide'
        : exceedsAvailableBalance
            ? `Solde ${selectedAssetLabel} insuffisant`
            : '';

    return (
        <>
            <Dialog isOpen={isClientTxModalOpen} onClose={() => setIsClientTxModalOpen(false)} className={`${cardBase} max-w-lg`}>
                <DialogHeader onClose={() => setIsClientTxModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{editingClientTx ? t('transactions.editOperation') : t('transactions.newOperation')}</DialogTitle>
                </DialogHeader>
                <DialogContent className="space-y-4 px-6 pb-6">
                    {!editingClientTx && (clientTxType === 'RÃ¨glement ReÃ§u' || clientTxType === 'Paiement EffectuÃ©') && (
                        <div>
                            <Label>{t('transactions.operationType')}</Label>
                            <Select
                                id="tx_type_select"
                                value={clientTxType}
                                onChange={e => setClientTxType(e.target.value as any)}
                                className={fieldBase}
                                disabled={!!editingClientTx}
                            >
                                <option value="RÃ¨glement ReÃ§u">{t('transactions.paymentReceived')}</option>
                                <option value="Paiement EffectuÃ©">{t('transactions.paymentMade')}</option>
                            </Select>
                        </div>
                    )}

                    {clientTxType === 'Vente USDT' ? (
                        <div className="space-y-4">
                            <div>
                                <Label>{t('portfolio.qtyUsdt')}</Label>
                                <NumberInput value={clientTxUsdtAmount} onChange={e => setClientTxUsdtAmount(e.target.value)} className={fieldBase} />
                            </div>
                            <div>
                                <Label>{t('portfolio.sellingPriceDzd')}</Label>
                                <NumberInput value={clientTxSellPrice} onChange={e => setClientTxSellPrice(e.target.value)} className={fieldBase} />
                            </div>
                        </div>
                    ) : clientTxType === 'Achat EUR' ? (
                        <div className="space-y-4">
                            <div>
                                <Label>{t('transactions.qtyEur')}</Label>
                                <NumberInput value={clientTxEurAmount} onChange={e => setClientTxEurAmount(e.target.value)} className={fieldBase} />
                            </div>
                            <div>
                                <Label>{t('portfolio.buyPrice')}</Label>
                                <NumberInput value={clientTxEurPrice} onChange={e => setClientTxEurPrice(e.target.value)} className={fieldBase} />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <Label>{t('transactions.amountDzd')}</Label>
                            <div className="relative">
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={clientTxAmount}
                                    onChange={e => setClientTxAmount(e.target.value)}
                                    className={fieldBase}
                                    placeholder="+/- Montant"
                                />
                            </div>
                            <p className="mt-1 text-xs opacity-60">{t('transactions.enterPositiveNegativeValue')}</p>
                        </div>
                    )}
                    <div>
                        <Label>{t('common.notesOptional')}</Label>
                        <Input value={clientTxNotes} onChange={e => setClientTxNotes(e.target.value)} className={fieldBase} />
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => handleSaveClientTx(selectedClientId)} className="w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700">
                        {t('common.save')}
                    </Button>
                </DialogFooter>
            </Dialog>

            <Dialog isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsAdjustmentModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{editingTreasuryTx ? t('transactions.editAdjustment') : 'Ajustement Tresorerie'}</DialogTitle>
                </DialogHeader>
                <DialogContent className="space-y-3 px-6 pb-6">
                    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${isDark ? 'border-slate-800/90 bg-slate-900/60' : 'border-slate-200 bg-slate-50/90'}`}>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${adjustmentTab === 'add'
                            ? 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/20'
                            : 'bg-rose-500/12 text-rose-300 ring-rose-400/20'
                            }`}>
                            {adjustmentTab === 'add' ? <WalletIcon className="h-4 w-4" /> : <BanknotesIcon className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                {adjustmentTab === 'add' ? 'Ajouter' : 'Retirer'} - {selectedAssetLabel}
                            </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? 'bg-white/5 text-slate-300 ring-1 ring-white/10' : 'bg-white text-slate-500 shadow-sm'}`}>
                            {selectedAssetLabel}
                        </span>
                    </div>

                    <div className={`grid grid-cols-2 gap-2 rounded-2xl border p-1 ${isDark ? 'border-slate-800/90 bg-slate-900/60' : 'border-slate-200 bg-slate-50/90'}`}>
                        <button
                            onClick={() => setAdjustmentTab('add')}
                            className={`rounded-[18px] px-4 py-3 text-sm font-semibold transition-all ${adjustmentTab === 'add'
                                ? 'bg-green-600 text-white shadow-[0_12px_28px_rgba(22,163,74,0.28)]'
                                : (isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-500 hover:bg-white hover:text-slate-700')
                                }`}
                        >
                            Ajouter (+)
                        </button>
                        <button
                            onClick={() => setAdjustmentTab('subtract')}
                            className={`rounded-[18px] px-4 py-3 text-sm font-semibold transition-all ${adjustmentTab === 'subtract'
                                ? 'bg-red-600 text-white shadow-[0_12px_28px_rgba(220,38,38,0.28)]'
                                : (isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-500 hover:bg-white hover:text-slate-700')
                                }`}
                        >
                            Retirer (-)
                        </button>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <Label>{t('transactions.assetType')}</Label>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? 'bg-white/5 text-slate-300 ring-1 ring-white/10' : 'bg-white text-slate-500 shadow-sm'}`}>
                                {selectedAssetLabel}
                            </span>
                        </div>
                        <div className="relative">
                            <Select
                                value={adjustmentAsset}
                                onChange={e => handleAdjustmentAssetChange(e.target.value as any)}
                                className={`${fieldShellClass} appearance-none pr-10`}
                            >
                                {adjustmentAssetOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Select>
                            <ArrowDownIcon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                        </div>
                    </div>

                    <div>
                        <Label>{isCryptoAdjustment ? t('transactions.quantity') : t('transactions.amount')}</Label>
                        <div className="relative mt-2">
                            <NumberInput
                                value={adjustmentAmount}
                                onChange={e => setAdjustmentAmount(e.target.value)}
                                className={`${fieldShellClass} pr-20 text-base font-semibold ${amountErrorText ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                placeholder="0.00"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    if (maxDisabled) return;
                                    setAdjustmentAmount(formatCardValue(maxValue));
                                }}
                                disabled={maxDisabled}
                                className={maxButtonClass}
                                title={maxDisabled ? 'Selectionnez un client' : 'Utiliser la valeur maximale'}
                            >
                                MAX
                            </button>
                        </div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{amountHint}</p>
                        {amountErrorText ? <p className="text-red-500 text-xs mt-1">{amountErrorText}</p> : null}
                    </div>

                    {isCryptoAdjustment && (
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <Label>{t('transactions.unitPrice')}</Label>
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? 'bg-white/5 text-slate-300 ring-1 ring-white/10' : 'bg-white text-slate-500 shadow-sm'}`}>
                                    {adjustmentAuto.sourceType === 'card' ? 'PMA' : adjustmentAuto.sourceType === 'portfolio' ? 'PAM' : 'Auto'}
                                </span>
                            </div>
                            <div className="relative pb-5">
                                <NumberInput
                                    value={adjustmentPrice}
                                    onChange={e => setAdjustmentPrice(e.target.value)}
                                    className={`${fieldShellClass} pr-4 text-base font-semibold`}
                                    placeholder="Ex: 240.00"
                                />
                            </div>
                            <p className={`text-xs mt-1 ${adjustmentAuto.sourceType === 'missing' ? 'text-amber-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                {adjustmentAuto.sourceType === 'missing'
                                    ? adjustmentAuto.sourceLabel
                                    : `Auto: ${adjustmentAuto.sourceLabel}`}
                            </p>
                        </div>
                    )}

                    {isDzdAdjustment && (
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <Label>{t('transactions.linkedClientOptional')}</Label>
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? 'bg-white/5 text-slate-300 ring-1 ring-white/10' : 'bg-white text-slate-500 shadow-sm'}`}>
                                    Optionnel
                                </span>
                            </div>
                            <div className="relative">
                                <Select
                                    value={adjustmentClientId}
                                    onChange={e => setAdjustmentClientId(e.target.value)}
                                    className={`${fieldShellClass} appearance-none pr-10`}
                                >
                                    <option value="">Aucun client</option>
                                    {(clientsDzd || []).map((c: any) => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}
                                </Select>
                                <ArrowDownIcon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {adjustmentClientId ? selectedClientName : 'Optionnel'}
                            </p>
                        </div>
                    )}

                    <div>
                        <Label>{t('transactions.reason')}</Label>
                        <Input
                            value={adjustmentNote}
                            onChange={e => setAdjustmentNote(e.target.value)}
                            className={`${fieldShellClass} mt-2`}
                            placeholder="Ex: Alimentation, Frais..."
                        />
                    </div>
                </DialogContent>
                <DialogFooter className="pt-0">
                    <div className="w-full space-y-3">
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{confirmHelperText}</p>
                        <Button
                            onClick={handleGlobalAdjustment}
                            disabled={isConfirmDisabled}
                            className={`w-full rounded-2xl py-3 font-bold shadow-md transition-all ${isConfirmDisabled
                                ? 'cursor-not-allowed bg-gray-400 opacity-70'
                                : (adjustmentTab === 'add'
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-red-600 text-white hover:bg-red-700')
                                }`}
                        >
                            {isSaving ? t('common.processing') : 'Confirmer'}
                        </Button>
                    </div>
                </DialogFooter>
            </Dialog>
        </>
    );
}

const areMainClientOperationsDialogsPropsEqual = (
    prev: MainClientOperationsDialogsProps,
    next: MainClientOperationsDialogsProps
) => {
    if (
        prev.isClientTxModalOpen !== next.isClientTxModalOpen
        || prev.isAdjustmentModalOpen !== next.isAdjustmentModalOpen
    ) {
        return false;
    }

    if (!next.isClientTxModalOpen && !next.isAdjustmentModalOpen) {
        return true;
    }

    if (next.isClientTxModalOpen) {
        const sameClientTxDialog =
            prev.editingClientTx === next.editingClientTx
            && prev.clientTxType === next.clientTxType
            && prev.clientTxUsdtAmount === next.clientTxUsdtAmount
            && prev.clientTxSellPrice === next.clientTxSellPrice
            && prev.clientTxEurAmount === next.clientTxEurAmount
            && prev.clientTxEurPrice === next.clientTxEurPrice
            && prev.clientTxAmount === next.clientTxAmount
            && prev.clientTxNotes === next.clientTxNotes
            && prev.selectedClientId === next.selectedClientId
            && prev.fieldBase === next.fieldBase
            && prev.isDark === next.isDark
            && prev.cardBase === next.cardBase;
        if (!sameClientTxDialog) return false;
    }

    if (next.isAdjustmentModalOpen) {
        return (
            prev.editingTreasuryTx === next.editingTreasuryTx
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
            && prev.isSaving === next.isSaving
            && prev.fieldBase === next.fieldBase
            && prev.isDark === next.isDark
            && prev.cardBase === next.cardBase
        );
    }

    return true;
};

export const MainClientOperationsDialogs = memo(
    MainClientOperationsDialogsComponent,
    areMainClientOperationsDialogsPropsEqual
);
