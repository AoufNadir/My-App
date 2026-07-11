import React, { useState } from 'react';
import { Button } from '../ui/Button';
import type { PoOrderHandlers } from '../../hooks/usePoOrderHandlers';
import type {
    PoCashLocation,
    PoCurrency,
    PoCurrencyCode,
    PoPaymentMethod,
    PoPaymentMethodType,
    PoPricingTier,
} from '../../types';

type Lang = 'fr' | 'ar';

type CatalogManagerProps = {
    lang: Lang;
    currencies: PoCurrency[];
    pricingTiers: PoPricingTier[];
    paymentMethods: PoPaymentMethod[];
    cashLocations: PoCashLocation[];
    handlers: PoOrderHandlers;
    setAlert: (message: string) => void;
};

const fieldClass = 'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-neutral-900 focus:border-primary focus:ring-2 focus:ring-primary';

type Strings = {
    seedHint: string; seedCatalog: string; seedOk: string; error: string;
    currencies: string; addCurrency: string; code: string; label: string; minOrder: string; maxOrder: string; add: string;
    active: string; inactive: string; noCurrencies: string;
    tiers: string; addTier: string; minQty: string; maxQty: string; unitPrice: string; noTiers: string;
    methods: string; addMethod: string; type: string; noMethods: string;
    locations: string; addLocation: string; noLocations: string;
    typeBaridimob: string; typeCash: string; typeBankTransfer: string; typeOther: string;
    saveOk: string;
};

function buildStrings(lang: Lang): Strings {
    return lang === 'ar'
        ? {
            seedHint: 'لا توجد عملات بعد. أنشئ كتالوجًا افتراضيًا للبدء أو أضف عملة يدويًا أدناه.',
            seedCatalog: 'إنشاء كتالوج افتراضي', seedOk: 'تم إنشاء الكتالوج الافتراضي.', error: 'حدث خطأ. حاول مرة أخرى.',
            currencies: 'العملات', addCurrency: 'إضافة عملة', code: 'الرمز', label: 'التسمية',
            minOrder: 'الحد الأدنى', maxOrder: 'الحد الأقصى', add: 'إضافة',
            active: 'مفعّل', inactive: 'معطّل', noCurrencies: 'لا توجد عملات.',
            tiers: 'شرائح الأسعار', addTier: 'إضافة شريحة سعر', minQty: 'من', maxQty: 'إلى', unitPrice: 'السعر (دج)',
            noTiers: 'لا توجد شرائح أسعار لهذه العملة بعد.',
            methods: 'طرق الدفع', addMethod: 'إضافة طريقة دفع', type: 'النوع', noMethods: 'لا توجد طرق دفع.',
            locations: 'نقاط الكاش', addLocation: 'إضافة نقطة كاش', noLocations: 'لا توجد نقاط كاش.',
            typeBaridimob: 'باريدي موب', typeCash: 'نقدًا', typeBankTransfer: 'تحويل بنكي', typeOther: 'أخرى',
            saveOk: 'تم الحفظ.',
        }
        : {
            seedHint: 'Aucune devise pour le moment. Créez un catalogue par défaut ou ajoutez une devise manuellement ci-dessous.',
            seedCatalog: 'Créer un catalogue par défaut', seedOk: 'Catalogue par défaut créé.', error: 'Une erreur est survenue. Réessayez.',
            currencies: 'Devises', addCurrency: 'Ajouter une devise', code: 'Code', label: 'Libellé',
            minOrder: 'Min.', maxOrder: 'Max.', add: 'Ajouter',
            active: 'Actif', inactive: 'Inactif', noCurrencies: 'Aucune devise.',
            tiers: 'Paliers de prix', addTier: 'Ajouter un palier', minQty: 'De', maxQty: 'À', unitPrice: 'Prix (DZD)',
            noTiers: 'Aucun palier de prix pour cette devise.',
            methods: 'Moyens de paiement', addMethod: 'Ajouter un moyen de paiement', type: 'Type', noMethods: 'Aucun moyen de paiement.',
            locations: 'Points cash', addLocation: 'Ajouter un point cash', noLocations: 'Aucun point cash.',
            typeBaridimob: 'BaridiMob', typeCash: 'Espèces', typeBankTransfer: 'Virement bancaire', typeOther: 'Autre',
            saveOk: 'Enregistré.',
        };
}

function ActiveToggle({ active, onToggle, s }: { active: boolean; onToggle: () => void; s: Strings }) {
    const [busy, setBusy] = useState(false);
    return (
        <button
            type="button"
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onToggle(); } finally { setBusy(false); } }}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                active ? 'bg-success-bg text-success' : 'bg-neutral-100 text-neutral-500'
            }`}
        >
            {active ? s.active : s.inactive}
        </button>
    );
}

type CurrencyCardProps = {
    currency: PoCurrency;
    tiers: PoPricingTier[];
    s: Strings;
    handlers: PoOrderHandlers;
    setAlert: (message: string) => void;
    typeLabel: (t: PoPaymentMethodType) => string;
};

const CurrencyCard: React.FC<CurrencyCardProps> = ({ currency, tiers, s, handlers, setAlert }) => {
    const [minQty, setMinQty] = useState('');
    const [maxQty, setMaxQty] = useState('');
    const [unitPriceDzd, setUnitPriceDzd] = useState('');
    const [minOrder, setMinOrder] = useState(String(currency.minOrder));
    const [maxOrder, setMaxOrder] = useState(String(currency.maxOrder));
    const [busy, setBusy] = useState(false);

    const ownTiers = tiers.filter((t) => t.currencyId === currency.id).sort((a, b) => a.minQty - b.minQty);
    const limitsDirty = minOrder !== String(currency.minOrder) || maxOrder !== String(currency.maxOrder);

    const handleAddTier = async () => {
        const min = Number(minQty);
        const max = Number(maxQty);
        const price = Number(unitPriceDzd);
        if (!min || !max || !price || max < min) return;
        setBusy(true);
        try {
            await handlers.addPricingTier({ currencyId: currency.id, minQty: min, maxQty: max, unitPriceDzd: price });
            setMinQty(''); setMaxQty(''); setUnitPriceDzd('');
        } catch {
            setAlert(`❌ ${s.error}`);
        } finally {
            setBusy(false);
        }
    };

    const handleSaveLimits = async () => {
        const min = Number(minOrder);
        const max = Number(maxOrder);
        if (!min || !max || max < min) return;
        setBusy(true);
        try {
            await handlers.updateCurrencyLimits(currency.id, min, max);
            setAlert(`✅ ${s.saveOk}`);
        } catch {
            setAlert(`❌ ${s.error}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <span className="font-semibold text-neutral-900">{currency.label}</span>
                    <span className="ms-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{currency.code}</span>
                </div>
                <ActiveToggle
                    active={currency.active}
                    onToggle={() => handlers.setCurrencyActive(currency.id, !currency.active)}
                    s={s}
                />
            </div>

            <div className="flex items-center gap-2">
                <input type="number" className={fieldClass} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder={s.minOrder} />
                <input type="number" className={fieldClass} value={maxOrder} onChange={(e) => setMaxOrder(e.target.value)} placeholder={s.maxOrder} />
                {limitsDirty && (
                    <Button variant="outline" size="sm" loading={busy} onClick={handleSaveLimits} className="shrink-0">{s.add}</Button>
                )}
            </div>

            <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{s.tiers}</p>
                {ownTiers.length === 0 ? (
                    <p className="text-xs text-neutral-400">{s.noTiers}</p>
                ) : (
                    <ul className="space-y-1">
                        {ownTiers.map((tier) => (
                            <li key={tier.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-neutral-700">
                                    {tier.minQty} – {tier.maxQty} {currency.code} = {tier.unitPriceDzd.toLocaleString('fr-DZ')} DZD
                                </span>
                                <ActiveToggle
                                    active={tier.active}
                                    onToggle={() => handlers.setTierActive(tier.id, !tier.active)}
                                    s={s}
                                />
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                    <input type="number" className={fieldClass} value={minQty} onChange={(e) => setMinQty(e.target.value)} placeholder={s.minQty} />
                    <input type="number" className={fieldClass} value={maxQty} onChange={(e) => setMaxQty(e.target.value)} placeholder={s.maxQty} />
                    <input type="number" className={fieldClass} value={unitPriceDzd} onChange={(e) => setUnitPriceDzd(e.target.value)} placeholder={s.unitPrice} />
                    <Button variant="outline" size="sm" loading={busy} onClick={handleAddTier} className="shrink-0">{s.add}</Button>
                </div>
            </div>
        </div>
    );
}

function AddCurrencyForm({ s, handlers, setAlert }: { s: Strings; handlers: PoOrderHandlers; setAlert: (m: string) => void }) {
    const [code, setCode] = useState<PoCurrencyCode>('USDT');
    const [label, setLabel] = useState('');
    const [minOrder, setMinOrder] = useState('');
    const [maxOrder, setMaxOrder] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const min = Number(minOrder);
        const max = Number(maxOrder);
        if (!label.trim() || !min || !max || max < min) return;
        setBusy(true);
        try {
            await handlers.addCurrency({ code, label: label.trim(), minOrder: min, maxOrder: max });
            setLabel(''); setMinOrder(''); setMaxOrder('');
        } catch {
            setAlert(`❌ ${s.error}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end">
            <label className="text-xs font-medium text-neutral-600">
                {s.code}
                <select className={`${fieldClass} mt-1`} value={code} onChange={(e) => setCode(e.target.value as PoCurrencyCode)}>
                    <option value="USDT">USDT</option>
                    <option value="EUR">EUR</option>
                </select>
            </label>
            <label className="text-xs font-medium text-neutral-600 col-span-2 sm:col-span-1">
                {s.label}
                <input className={`${fieldClass} mt-1`} value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-neutral-600">
                {s.minOrder}
                <input type="number" className={`${fieldClass} mt-1`} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-neutral-600">
                {s.maxOrder}
                <input type="number" className={`${fieldClass} mt-1`} value={maxOrder} onChange={(e) => setMaxOrder(e.target.value)} />
            </label>
            <Button variant="primary" size="sm" loading={busy} onClick={submit} className="sm:h-10">{s.addCurrency}</Button>
        </div>
    );
}

function PaymentMethodsSection({ methods, s, handlers, setAlert, typeLabel }: {
    methods: PoPaymentMethod[];
    s: Strings;
    handlers: PoOrderHandlers;
    setAlert: (m: string) => void;
    typeLabel: (t: PoPaymentMethodType) => string;
}) {
    const [type, setType] = useState<PoPaymentMethodType>('baridimob');
    const [label, setLabel] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!label.trim()) return;
        setBusy(true);
        try {
            await handlers.addPaymentMethod({ type, label: label.trim() });
            setLabel('');
        } catch {
            setAlert(`❌ ${s.error}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2">
            <p className="text-sm font-bold uppercase tracking-wider text-neutral-500">{s.methods}</p>
            {methods.length === 0 ? (
                <p className="text-xs text-neutral-400">{s.noMethods}</p>
            ) : (
                <ul className="space-y-1">
                    {methods.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-neutral-700">{m.label} · {typeLabel(m.type)}</span>
                            <ActiveToggle active={m.active} onToggle={() => handlers.setPaymentMethodActive(m.id, !m.active)} s={s} />
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex items-center gap-1.5">
                <select className={fieldClass} value={type} onChange={(e) => setType(e.target.value as PoPaymentMethodType)}>
                    <option value="baridimob">{s.typeBaridimob}</option>
                    <option value="cash">{s.typeCash}</option>
                    <option value="bank_transfer">{s.typeBankTransfer}</option>
                    <option value="other">{s.typeOther}</option>
                </select>
                <input className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={s.label} />
                <Button variant="outline" size="sm" loading={busy} onClick={submit} className="shrink-0">{s.add}</Button>
            </div>
        </div>
    );
}

function CashLocationsSection({ locations, s, handlers, setAlert }: {
    locations: PoCashLocation[];
    s: Strings;
    handlers: PoOrderHandlers;
    setAlert: (m: string) => void;
}) {
    const [label, setLabel] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!label.trim()) return;
        setBusy(true);
        try {
            await handlers.addCashLocation({ label: label.trim() });
            setLabel('');
        } catch {
            setAlert(`❌ ${s.error}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2">
            <p className="text-sm font-bold uppercase tracking-wider text-neutral-500">{s.locations}</p>
            {locations.length === 0 ? (
                <p className="text-xs text-neutral-400">{s.noLocations}</p>
            ) : (
                <ul className="space-y-1">
                    {locations.map((loc) => (
                        <li key={loc.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-neutral-700">{loc.label}</span>
                            <ActiveToggle active={loc.active} onToggle={() => handlers.setCashLocationActive(loc.id, !loc.active)} s={s} />
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex items-center gap-1.5">
                <input className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={s.label} />
                <Button variant="outline" size="sm" loading={busy} onClick={submit} className="shrink-0">{s.add}</Button>
            </div>
        </div>
    );
}

// Full CRUD for the order-system catalog. Every write here is read live by
// approved clients via usePoClientData (same po_* collections, onSnapshot) —
// this is the link between the admin and client pages.
export function CatalogManager({ lang, currencies, pricingTiers, paymentMethods, cashLocations, handlers, setAlert }: CatalogManagerProps) {
    const s = buildStrings(lang);
    const [seeding, setSeeding] = useState(false);

    const typeLabel = (t: PoPaymentMethodType) => ({
        baridimob: s.typeBaridimob, cash: s.typeCash, bank_transfer: s.typeBankTransfer, other: s.typeOther,
    }[t]);

    const handleSeed = async () => {
        setSeeding(true);
        try {
            await handlers.seedCatalog();
            setAlert(`✅ ${s.seedOk}`);
        } catch {
            setAlert(`❌ ${s.error}`);
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="space-y-5">
            {currencies.length === 0 && (
                <div className="space-y-2 rounded-lg border border-warning/30 bg-warning-bg p-3">
                    <p className="text-sm text-warning">{s.seedHint}</p>
                    <Button variant="primary" size="sm" loading={seeding} onClick={handleSeed}>{s.seedCatalog}</Button>
                </div>
            )}

            <div className="space-y-2">
                <p className="text-sm font-bold uppercase tracking-wider text-neutral-500">{s.currencies}</p>
                {currencies.length === 0 ? (
                    <p className="text-xs text-neutral-400">{s.noCurrencies}</p>
                ) : (
                    <div className="space-y-3">
                        {currencies.map((cur) => (
                            <CurrencyCard
                                key={cur.id}
                                currency={cur}
                                tiers={pricingTiers}
                                s={s}
                                handlers={handlers}
                                setAlert={setAlert}
                                typeLabel={typeLabel}
                            />
                        ))}
                    </div>
                )}
                <AddCurrencyForm s={s} handlers={handlers} setAlert={setAlert} />
            </div>

            <PaymentMethodsSection methods={paymentMethods} s={s} handlers={handlers} setAlert={setAlert} typeLabel={typeLabel} />
            <CashLocationsSection locations={cashLocations} s={s} handlers={handlers} setAlert={setAlert} />
        </div>
    );
}
