import { useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { NumberInput } from '../ui/NumberInput';

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

export function MainClientOperationsDialogs({
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

    return (
        <>
            {/* 2. CLIENT TX MODAL - Updated to use Select for Type d'Actif */}
            <Dialog isOpen={isClientTxModalOpen} onClose={() => setIsClientTxModalOpen(false)} className={`${cardBase} max-w-lg`}>
                <DialogHeader onClose={() => setIsClientTxModalOpen(false)} isDark={isDark}><DialogTitle>{editingClientTx ? t('transactions.editOperation') : t('transactions.newOperation')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    {/* SIMPLIFIED CLIENT TX MODAL CONTENT */}

                    {/* HIDE TYPE SELECTOR IF EDITING OR IF IT WAS PRE-SELECTED FROM DROPDOWN */}
                    {!editingClientTx && (clientTxType === 'Règlement Reçu' || clientTxType === 'Paiement Effectué') && (
                        <div><Label>{t('transactions.operationType')}</Label><Select id="tx_type_select" value={clientTxType} onChange={e => setClientTxType(e.target.value as any)} className={fieldBase} disabled={!!editingClientTx}><option value="Règlement Reçu">{t('transactions.paymentReceived')}</option><option value="Paiement Effectué">{t('transactions.paymentMade')}</option></Select></div>
                    )}

                    {/* REMOVED: Source Selector (Type d'Actif) */}
                    {/* REMOVED: Payment Status Selector (Statut du Paiement) */}

                    {clientTxType === 'Vente USDT' ? (
                        <div className="space-y-4"><div><Label>{t('portfolio.qtyUsdt')}</Label><NumberInput value={clientTxUsdtAmount} onChange={e => setClientTxUsdtAmount(e.target.value)} className={fieldBase} /></div><div><Label>{t('portfolio.sellingPriceDzd')}</Label><NumberInput value={clientTxSellPrice} onChange={e => setClientTxSellPrice(e.target.value)} className={fieldBase} /></div></div>
                    ) : clientTxType === 'Achat EUR' ? (
                        <div className="space-y-4"><div><Label>{t('transactions.qtyEur')}</Label><NumberInput value={clientTxEurAmount} onChange={e => setClientTxEurAmount(e.target.value)} className={fieldBase} /></div><div><Label>{t('portfolio.buyPrice')}</Label><NumberInput value={clientTxEurPrice} onChange={e => setClientTxEurPrice(e.target.value)} className={fieldBase} /></div></div>
                    ) : (
                        <div>
                            <Label>{t('transactions.amountDzd')}</Label>
                            <div className="relative">
                                {/* ALLOW NEGATIVE VALUES: Use Input type="number" or NumberInput without restrictions if possible. 
                                    Our NumberInput might restrict? Let's check. 
                                    If NumberInput restricts, use standard Input. 
                                    User said: "يقبل القيم الموجبة والسالبة دون أي قيود"
                                */}
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={clientTxAmount}
                                    onChange={e => setClientTxAmount(e.target.value)}
                                    className={fieldBase}
                                    placeholder="+/- Montant"
                                />
                            </div>
                            <p className="text-xs mt-1 opacity-60">{t('transactions.enterPositiveNegativeValue')}</p>
                        </div>
                    )}
                    <div><Label>{t('common.notesOptional')}</Label><Input value={clientTxNotes} onChange={e => setClientTxNotes(e.target.value)} className={fieldBase} /></div>
                </DialogContent>
                <DialogFooter><Button onClick={() => handleSaveClientTx(selectedClientId)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl">{t('common.save')}</Button></DialogFooter>
            </Dialog>

            {/* 3. TREASURY ADJUSTMENT MODAL REDESIGNED */}
            <Dialog isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsAdjustmentModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{editingTreasuryTx ? t('transactions.editAdjustment') : 'Ajustement Trésorerie'}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">

                    {/* 1. Mode Toggle (Ajouter / Retirer) */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <button
                            onClick={() => setAdjustmentTab('add')}
                            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${adjustmentTab === 'add' ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Ajouter (+)
                        </button>
                        <button
                            onClick={() => setAdjustmentTab('subtract')}
                            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${adjustmentTab === 'subtract' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Retirer (-)
                        </button>
                    </div>

                    {/* 2. Type d'Actif */}
                    <div>
                        <Label>{t('transactions.assetType')}</Label>
                        <Select value={adjustmentAsset} onChange={e => handleAdjustmentAssetChange(e.target.value as any)} className={fieldBase}>
                            <option value="DZD-Caisse">DZD - Caisse</option>
                            <option value="DZD-Baridi">DZD - Baridi</option>
                            <option value="USDT">USDT</option>
                            <option value="EUR">EUR</option>
                        </Select>
                    </div>

                    {/* 3. Montant (+ MAX button if Client Selected) */}
                    <div>
                        <Label>{adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR' ? t('transactions.quantity') : t('transactions.amount')}</Label>
                        <div className="relative">
                            <NumberInput
                                value={adjustmentAmount}
                                onChange={e => setAdjustmentAmount(e.target.value)}
                                className={fieldBase}
                                placeholder="0.00"
                            />
                            {/* MAX BUTTON - ALWAYS VISIBLE, logic depends on Asset Type */}
                            <button
                                onClick={() => {
                                    // LOGIC 1: Caisse / Baridi -> Client Balance
                                    if (adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') {
                                        if (adjustmentClientId) {
                                            const clientBal = clientBalances.get(adjustmentClientId) || 0;
                                            setAdjustmentAmount(Math.abs(clientBal).toString());
                                        }
                                    }
                                    // LOGIC 2: USDT / EUR -> Available Balance
                                    else if (adjustmentAsset === 'USDT') {
                                        setAdjustmentAmount((portfolioStats?.usdt?.available || 0).toString());
                                    }
                                    else if (adjustmentAsset === 'EUR') {
                                        setAdjustmentAmount((portfolioStats?.eur?.available || 0).toString());
                                    }
                                }}
                                disabled={
                                    (adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && !adjustmentClientId
                                }
                                className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded transition-colors font-bold ${((adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && !adjustmentClientId)
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500' // Disabled Style
                                    : (isDark ? 'bg-slate-600 text-gray-200 hover:bg-slate-500' : 'bg-slate-200 text-gray-700 hover:bg-slate-300') // Enabled Style
                                    }`}
                                title={
                                    (adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && !adjustmentClientId
                                        ? "Sélectionnez un client"
                                        : "Utiliser le solde disponible"
                                }
                            >
                                MAX
                            </button>
                        </div>
                    </div>

                    {/* 4. Prix Unitaire (Visible only if USDT/EUR) */}
                    {(adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR') && (
                        <div>
                            <Label>{t('transactions.unitPrice')}</Label>
                            <NumberInput value={adjustmentPrice} onChange={e => setAdjustmentPrice(e.target.value)} className={fieldBase} placeholder="Ex: 240.00" />
                            <p className={`text-xs mt-1 ${adjustmentAuto.sourceType === 'missing' ? 'text-amber-500' : 'opacity-70'}`}>
                                {adjustmentAuto.sourceType === 'missing'
                                    ? adjustmentAuto.sourceLabel
                                    : `Auto: ${adjustmentAuto.sourceLabel}`}
                            </p>
                        </div>
                    )}

                    {/* 5. Client Lié (Visible only if DZD) */}
                    {(adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && (
                        <div>
                            <div className="flex justify-between">
                                <Label>{t('transactions.linkedClientOptional')}</Label>
                                <span className="text-xs text-gray-400">Optionnel</span>
                            </div>
                            <Select value={adjustmentClientId} onChange={e => setAdjustmentClientId(e.target.value)} className={fieldBase}>
                                <option value="">Aucun client</option>
                                {clientsDzd.map(c => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}
                            </Select>
                        </div>
                    )}

                    {/* 6. Motif */}
                    <div>
                        <Label>{t('transactions.reason')}</Label>
                        <Input value={adjustmentNote} onChange={e => setAdjustmentNote(e.target.value)} className={fieldBase} placeholder="Ex: Alimentation, Frais..." />
                    </div>

                </DialogContent>
                <DialogFooter>
                    <Button
                        onClick={handleGlobalAdjustment}
                        disabled={
                            isSaving ||
                            !adjustmentAmount || parseFloat(adjustmentAmount) <= 0 ||
                            (adjustmentTab === 'subtract' && (
                                adjustmentAsset === 'USDT' ? parseFloat(adjustmentAmount) > (portfolioStats?.usdt?.available || 0) :
                                    adjustmentAsset === 'EUR' ? parseFloat(adjustmentAmount) > (portfolioStats?.eur?.available || 0) : false
                            ))
                        }
                        className={`w-full font-bold py-3 rounded-xl shadow-md transition-all ${(isSaving || !adjustmentAmount || parseFloat(adjustmentAmount) <= 0 || (adjustmentTab === 'subtract' && (
                            adjustmentAsset === 'USDT' ? parseFloat(adjustmentAmount) > (portfolioStats?.usdt?.available || 0) :
                                adjustmentAsset === 'EUR' ? parseFloat(adjustmentAmount) > (portfolioStats?.eur?.available || 0) : false
                        )))
                            ? 'bg-gray-400 cursor-not-allowed opacity-70'
                            : (adjustmentTab === 'add' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white')
                            }`}
                    >
                        {isSaving ? t('common.processing') : 'Confirmer'}
                    </Button>
                </DialogFooter>
            </Dialog>
        </>
    );
}
