import { useState, useMemo, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { parseAndEvaluate } from '../../utils';
import { formatNumber } from '../../pages/shared/pageFormat';
import {
    ClientTierType, PaymentMethod,
    getVolumeBracket,
    computeVIPAnchoredPrice,
    MARKET_PRICE_STORAGE_KEYS, PAYMENT_DAYS,
    readEditablePremiums, saveEditablePremiums, EditablePremiums,
} from '../../utils/pricingMatrix';

const fmt0 = (n: number) => formatNumber(n, { min: 0, max: 0 });
const fmt2 = (n: number) => formatNumber(n, { min: 2, max: 2 });
const fmtPrice = (n: number) => Number.isInteger(n) ? `${n}` : fmt2(n);

type Currency = 'USDT' | 'EUR';
type ClientEntry = { id: string; name: string };
type TxEntry = { type: string; currency: string; linkedClientId?: string; quantity: number; sell?: number; price?: number; timestamp: number };
type PortfolioSide = { available: number; avgBuy: number };

type Props = {
    isOpen: boolean;
    onClose: () => void;
    portfolioStats: { usdt: PortfolioSide; eur: PortfolioSide };
    clients?: ClientEntry[];
    clientLoyaltyMap?: Map<string, 'vip' | 'regular' | 'petit' | 'new' | 'inactive' | 'fournisseur'>;
    transactions?: TxEntry[];
    minimumGoal?: number;
    avgMonthlyVol?: number;
};

const TIERS: { key: ClientTierType; label: string }[] = [
    { key: 'vip', label: 'VIP' }, { key: 'regular', label: 'Régulier' },
    { key: 'petit', label: 'Petit' }, { key: 'new', label: 'Nouveau' },
];
const PAYMENTS: { key: PaymentMethod; label: string }[] = [
    { key: 'cash', label: 'Cash' },
    { key: 'credit_short', label: `Crédit ${PAYMENT_DAYS.credit_short}j` },
    { key: 'credit_long', label: `Crédit ${PAYMENT_DAYS.credit_long}j` },
];

const loadVipPrice = (c: Currency) => localStorage.getItem(c === 'USDT' ? MARKET_PRICE_STORAGE_KEYS.usdt : MARKET_PRICE_STORAGE_KEYS.eur) || '';
const saveVipPrice = (c: Currency, v: string) => { if (parseFloat(v) > 0) localStorage.setItem(c === 'USDT' ? MARKET_PRICE_STORAGE_KEYS.usdt : MARKET_PRICE_STORAGE_KEYS.eur, v); };

function NumberEdit({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-400">{label}</span>
            <input type="number" value={value} step="0.5" min="0" max="5"
                onChange={e => onChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm font-bold text-neutral-800 text-center focus:outline-none focus:ring-1 focus:ring-primary/50"/>
        </div>
    );
}

export function LayeredPriceCalculator({ isOpen, onClose, portfolioStats, clients = [], clientLoyaltyMap, transactions = [], minimumGoal = 0, avgMonthlyVol = 0 }: Props) {
    const [currency, setCurrency] = useState<Currency>('USDT');
    const [vipInput, setVipInput] = useState('');
    const [qty, setQty] = useState('');
    const [tier, setTier] = useState<ClientTierType>('regular');
    const [payment, setPayment] = useState<PaymentMethod>('cash');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showEdit, setShowEdit] = useState(false);

    // Editable premiums
    const [premiums, setPremiums] = useState<EditablePremiums>(readEditablePremiums);
    const [draftP, setDraftP] = useState({ r: '', pe: '', n: '', vm: '', vs: '', ps: '', pl: '' });

    useEffect(() => {
        if (isOpen) {
            setVipInput(loadVipPrice(currency));
            const p = readEditablePremiums();
            setPremiums(p);
            setDraftP({ r: String(p.tierRegular), pe: String(p.tierPetit), n: String(p.tierNew), vm: String(p.volMedium), vs: String(p.volSmall), ps: String(p.payShort), pl: String(p.payLong) });
        }
    }, [isOpen, currency]);

    const savePremiums = () => {
        const p: EditablePremiums = {
            tierRegular: parseFloat(draftP.r) || 0, tierPetit: parseFloat(draftP.pe) || 0, tierNew: parseFloat(draftP.n) || 0,
            volMedium: parseFloat(draftP.vm) || 0, volSmall: parseFloat(draftP.vs) || 0,
            payShort: parseFloat(draftP.ps) || 0, payLong: parseFloat(draftP.pl) || 0,
        };
        saveEditablePremiums(p);
        setPremiums(p);
        setShowEdit(false);
    };

    const side = currency === 'USDT' ? portfolioStats.usdt : portfolioStats.eur;
    const pam = side.avgBuy;
    const floorMargin = minimumGoal > 0 && avgMonthlyVol > 0 ? minimumGoal / avgMonthlyVol : 0;

    const filteredClients = useMemo(() => {
        if (!search.trim()) return clients.slice(0, 6);
        const q = search.toLowerCase();
        return clients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
    }, [clients, search]);

    const selectClient = (c: ClientEntry) => {
        setSelectedId(c.id); setSearch(c.name);
        const raw = clientLoyaltyMap?.get(c.id);
        setTier(raw === 'vip' ? 'vip' : raw === 'regular' ? 'regular' : raw === 'petit' ? 'petit' : 'new');
    };

    const lastPrice = useMemo(() => {
        if (!selectedId) return 0;
        const tx = transactions.filter(t => t.type === 'sell' && t.currency === currency && t.linkedClientId === selectedId).sort((a, b) => b.timestamp - a.timestamp)[0];
        return tx ? (tx.sell ?? tx.price ?? 0) : 0;
    }, [selectedId, transactions, currency]);

    const result = useMemo(() => {
        const quantity = parseAndEvaluate(qty);
        const vip = parseAndEvaluate(vipInput);
        if (pam <= 0 || quantity <= 0 || vip <= 0) return null;
        const b = computeVIPAnchoredPrice({ vipPrice: vip, pam, tier, qty: quantity, method: payment, floorMargin, customPremiums: premiums });
        return { ...b, quantity, profitUnit: b.finalPrice - pam, profit: (b.finalPrice - pam) * quantity };
    }, [qty, vipInput, pam, tier, payment, floorMargin, premiums]);

    const handleVipChange = (v: string) => { setVipInput(v); saveVipPrice(currency, v); };
    const bracket = parseAndEvaluate(qty) > 0 ? getVolumeBracket(parseAndEvaluate(qty)) : null;
    const vipParsed = parseAndEvaluate(vipInput);

    const tierBtnCls = (active: boolean) => `flex-1 rounded-xl border py-2.5 text-[12px] font-bold transition-colors ${active ? 'border-primary bg-primary/8 text-primary shadow-sm' : 'border-border text-neutral-500 hover:border-neutral-300'}`;
    const payBtnCls = (active: boolean) => `flex-1 rounded-xl border py-2.5 text-[12px] font-bold transition-colors ${active ? 'border-primary bg-primary/8 text-primary shadow-sm' : 'border-border text-neutral-500 hover:border-neutral-300'}`;
    const segCls = (active: boolean) => `flex-1 min-h-[40px] rounded-lg text-sm font-bold transition-colors ${active ? 'bg-primary text-white' : 'text-neutral-600 hover:text-neutral-800'}`;

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title="Calculatrice de prix" className="max-w-lg mx-auto">
            <div className="px-4 pb-6 space-y-3">

                {/* Currency */}
                <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
                    <button type="button" onClick={() => { setCurrency('USDT'); setQty(''); setSelectedId(null); setSearch(''); }} className={segCls(currency === 'USDT')}>USDT</button>
                    <button type="button" onClick={() => { setCurrency('EUR'); setQty(''); setSelectedId(null); setSearch(''); }} className={segCls(currency === 'EUR')}>EUR</button>
                </div>

                {/* VIP base price */}
                <div className="rounded-xl border border-border bg-surface-muted p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-neutral-600">Prix de base — VIP</p>
                        <button type="button" onClick={() => setShowEdit(v => !v)}
                            className="text-[11px] font-semibold text-primary hover:underline">
                            {showEdit ? 'Fermer' : 'Modifier les taux'}
                        </button>
                    </div>
                    <input
                        type="number"
                        value={vipInput}
                        onChange={e => handleVipChange(e.target.value)}
                        placeholder="Ex: 248"
                        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-xl font-extrabold text-neutral-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {vipParsed > 0 && pam > 0 && (
                        <div dir="ltr" className="flex gap-3 text-[11px] text-neutral-400">
                            <span>PAM: <span className="font-bold text-neutral-600">{fmt2(pam)}</span></span>
                            <span>Marge: <span className="font-bold text-financial-profit">+{fmt2(vipParsed - pam)}/U</span></span>
                            {floorMargin > 0 && <span>Plancher: <span className="font-bold text-neutral-600">{fmt2(pam + floorMargin)}</span></span>}
                        </div>
                    )}
                </div>

                {/* Editable premiums panel */}
                {showEdit && (
                    <div className="rounded-xl border border-primary/20 bg-primary/3 p-3 space-y-3">
                        <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">Suppléments (DZD au-dessus du prix VIP)</p>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-neutral-400 text-center">Client</p>
                                <NumberEdit label="Régulier" value={draftP.r} onChange={v => setDraftP(d => ({...d, r: v}))}/>
                                <NumberEdit label="Petit" value={draftP.pe} onChange={v => setDraftP(d => ({...d, pe: v}))}/>
                                <NumberEdit label="Nouveau" value={draftP.n} onChange={v => setDraftP(d => ({...d, n: v}))}/>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-neutral-400 text-center">Volume</p>
                                <NumberEdit label="100–500 U" value={draftP.vm} onChange={v => setDraftP(d => ({...d, vm: v}))}/>
                                <NumberEdit label="< 100 U" value={draftP.vs} onChange={v => setDraftP(d => ({...d, vs: v}))}/>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-neutral-400 text-center">Paiement</p>
                                <NumberEdit label={`Crédit ${PAYMENT_DAYS.credit_short}j`} value={draftP.ps} onChange={v => setDraftP(d => ({...d, ps: v}))}/>
                                <NumberEdit label={`Crédit ${PAYMENT_DAYS.credit_long}j`} value={draftP.pl} onChange={v => setDraftP(d => ({...d, pl: v}))}/>
                            </div>
                        </div>
                        <button type="button" onClick={savePremiums}
                            className="w-full rounded-xl bg-primary text-white text-sm font-bold py-2.5 hover:bg-primary/90 transition-colors">
                            Enregistrer
                        </button>
                    </div>
                )}

                {/* Quantity */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                            placeholder={`Quantité ${currency}`}
                            className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40"/>
                        <button type="button" onClick={() => setQty(side.available.toFixed(2))}
                            className="rounded-xl bg-primary/10 text-primary text-xs font-bold px-3 py-2.5">MAX</button>
                    </div>
                    {bracket && (
                        <p className="text-[11px] text-neutral-400 px-1">
                            {bracket === 'large' ? `> 500 ${currency}` : bracket === 'medium' ? `100–500 ${currency}` : `< 100 ${currency}`}
                            {' '}
                            <span dir="ltr" className={`font-bold ${(bracket === 'large' ? 0 : bracket === 'medium' ? premiums.volMedium : premiums.volSmall) === 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                {bracket === 'large' ? '(base)' : `+${fmt2(bracket === 'medium' ? premiums.volMedium : premiums.volSmall)}`}
                            </span>
                        </p>
                    )}
                </div>

                {/* Client search */}
                <div className="space-y-1.5">
                    <input type="text" value={search}
                        onChange={e => { setSearch(e.target.value); setSelectedId(null); }}
                        placeholder="Rechercher un client"
                        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40"/>
                    {!selectedId && search.trim() && filteredClients.length > 0 && (
                        <div className="rounded-xl border border-border overflow-hidden divide-y divide-neutral-100">
                            {filteredClients.map(c => (
                                <button key={c.id} type="button" onClick={() => selectClient(c)}
                                    className="w-full px-4 py-2.5 text-sm text-start font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors">
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    )}
                    {lastPrice > 0 && <p className="text-[11px] text-neutral-400 px-1">Dernier prix : <span className="font-bold text-neutral-600">{fmtPrice(lastPrice)} DZD</span></p>}
                </div>

                {/* Tier */}
                <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide px-0.5">Type de client</p>
                    <div className="grid grid-cols-4 gap-1.5">
                        {TIERS.map(t => {
                            const p = t.key === 'vip' ? 0 : t.key === 'regular' ? premiums.tierRegular : t.key === 'petit' ? premiums.tierPetit : premiums.tierNew;
                            return (
                                <button key={t.key} type="button" onClick={() => { setTier(t.key); setSelectedId(null); }} className={tierBtnCls(tier === t.key)}>
                                    <div>{t.label}</div>
                                    <div dir="ltr" className={`text-[10px] mt-0.5 ${p === 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                        {p === 0 ? 'base' : `+${fmt2(p)}`}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Payment */}
                <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide px-0.5">Paiement</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {PAYMENTS.map(p => {
                            const prem = p.key === 'cash' ? 0 : p.key === 'credit_short' ? premiums.payShort : premiums.payLong;
                            return (
                                <button key={p.key} type="button" onClick={() => setPayment(p.key)} className={payBtnCls(payment === p.key)}>
                                    <div>{p.label}</div>
                                    <div dir="ltr" className={`text-[10px] mt-0.5 ${prem === 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                        {prem === 0 ? 'base' : `+${fmt2(prem)}`}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Result */}
                {result ? (
                    <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/8 to-primary/3 p-4 space-y-3">
                        <div className="flex items-end justify-between">
                            <div>
                                <p dir="ltr" className="text-[2.8rem] leading-none font-black tabular-nums text-primary tracking-tight">
                                    {fmtPrice(result.finalPrice)}
                                    <span className="text-base font-bold text-neutral-400 ml-1">DZD</span>
                                </p>
                                {result.premiumAboveVip > 0.01 ? (
                                    <p dir="ltr" className="text-[12px] font-semibold mt-1 text-financial-loss">+{fmt2(result.premiumAboveVip)} DZD vs VIP</p>
                                ) : (
                                    <p className="text-[12px] font-semibold mt-1 text-financial-profit">Prix VIP (base)</p>
                                )}
                            </div>
                            <button type="button" onClick={() => navigator.clipboard?.writeText(fmtPrice(result.finalPrice))}
                                className="rounded-xl bg-primary/10 text-primary text-xs font-bold px-3 py-2.5 hover:bg-primary/20 transition-colors">
                                Copier
                            </button>
                        </div>

                        {/* Breakdown */}
                        <div className="rounded-xl bg-surface/70 border border-border overflow-hidden text-[12px]">
                            <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border-b border-neutral-100">
                                <span className="font-semibold text-neutral-600">Base VIP</span>
                                <span dir="ltr" className="font-bold text-neutral-800">{fmtPrice(result.vipPrice)} DZD</span>
                            </div>
                            {[
                                { label: TIERS.find(t => t.key === tier)!.label, val: result.tierPremium },
                                { label: result.bracket === 'large' ? `> 500 ${currency}` : result.bracket === 'medium' ? `100–500 ${currency}` : `< 100 ${currency}`, val: result.volumePremium },
                                { label: PAYMENTS.find(p => p.key === payment)!.label, val: result.paymentPremium },
                            ].map(row => (
                                <div key={row.label} className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">{row.label}</span>
                                    <span dir="ltr" className={`font-bold ${row.val === 0 ? 'text-neutral-300' : 'text-financial-loss'}`}>
                                        {row.val === 0 ? '—' : `+${fmt2(row.val)}`}
                                    </span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-3 py-2 bg-neutral-50">
                                <span className="font-semibold text-neutral-600">Total supplément</span>
                                <span dir="ltr" className={`font-bold ${result.totalPremium === 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                    {result.totalPremium === 0 ? '—' : `+${fmt2(result.totalPremium)} DZD`}
                                </span>
                            </div>
                        </div>

                        {result.clampedToFloor && (
                            <p className="text-[11px] font-semibold text-warning text-center">
                                Plancher appliqué ({fmtPrice(result.floorPrice)} DZD minimum)
                            </p>
                        )}

                        <div className="flex items-center justify-between text-sm border-t border-border/50 pt-2">
                            <span className="text-neutral-500">Profit sur {fmt0(result.quantity)} {currency}</span>
                            <span dir="ltr" className="font-extrabold text-financial-profit tabular-nums">+{fmt0(result.profit)} DZD</span>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-border py-8 text-center">
                        <p className="text-sm text-neutral-400">
                            {vipParsed <= 0 ? 'Entrez le prix de base (VIP)' : 'Entrez la quantité'}
                        </p>
                    </div>
                )}
            </div>
        </BottomSheet>
    );
}
