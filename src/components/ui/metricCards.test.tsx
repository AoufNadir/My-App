import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PencilIcon } from '../icons/PencilIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { CurrencyAmount, type AmountSemantic, type CurrencyCode } from '../financial/CurrencyAmount';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { HeroKpiCard, type HeroKpiCardProps, type HeroKpiSecondary } from './HeroKpiCard';
import { FinancialMetricCard } from './FinancialMetricCard';

// V2-4 redrew the page hero (HeroKpiCard) and the figure tiles (FinancialMetricCard) like the
// Accueil cards. This test renders the previous cards and the new ones with the same props, in
// French and in Arabic, and checks that they show the same text and the same amounts, in the same
// order. Only the pencil button's label changed on purpose: it was always French, it now follows
// the language.

// ---- Reference: the cards before V2-4 (V2-3, commit b8dbd80), copied verbatim ----
const ACCENT_BG: Record<string, string> = {
    indigo: 'from-primary/15 via-transparent',
    teal: 'from-secondary/15 via-transparent',
    sky: 'from-primary/15 via-transparent',
    emerald: 'from-success/15 via-transparent',
    purple: 'from-secondary/15 via-transparent',
    amber: 'from-warning/15 via-transparent',
};
const ACCENT_RING: Record<string, string> = {
    indigo: 'ring-primary/15',
    teal: 'ring-secondary/15',
    sky: 'ring-primary/15',
    emerald: 'ring-success/15',
    purple: 'ring-secondary/15',
    amber: 'ring-warning/15',
};
const TrendBadge: React.FC<{
    pct: number;
}> = ({ pct }) => {
    const isPositive = pct >= 0;
    return (<span className={[
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
            isPositive ? 'bg-success-bg text-financial-profit' : 'bg-danger-bg text-financial-loss'
        ].join(' ')}>
      <span>{isPositive ? '▲' : '▼'}</span>
      <span>{Math.abs(pct).toFixed(2)}%</span>
    </span>);
};
const ReferenceHeroKpiCard: React.FC<HeroKpiCardProps> = ({ primaryLabel, primaryValue, primaryCurrency, primarySemantic, trendPct, secondary, className = '', icon, accent = 'indigo', }) => {
    const secondaryGridClass = secondary && secondary.length >= 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : secondary && secondary.length >= 3
            ? 'grid-cols-3'
            : 'grid-cols-2';
    return (<section className={[
            'relative overflow-hidden rounded-2xl ring-1 ring-neutral-200 p-4 sm:p-5',
            'bg-surface text-neutral-900',
            ACCENT_RING[accent] ?? '',
            className
        ]
            .filter(Boolean)
            .join(' ')} aria-label={primaryLabel}>
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br to-transparent ${ACCENT_BG[accent] ?? ''}`}/>

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-neutral-500">
            {primaryLabel}
          </p>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <CurrencyAmount value={primaryValue} currency={primaryCurrency} semantic={primarySemantic ?? 'plain'} size="hero" decimals={0}/>
            {typeof trendPct === 'number' && Number.isFinite(trendPct) && (<TrendBadge pct={trendPct}/>)}
          </div>
        </div>
        {icon && (<div className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center bg-neutral-100 text-neutral-600">
            {icon}
          </div>)}
      </header>

      {secondary && secondary.length > 0 && (<dl className={`mt-4 grid gap-3 ${secondaryGridClass}`}>
          {secondary.map((item, idx) => (<div key={`${item.label}-${idx}`} className="min-w-0">
              <dt className="text-xs truncate text-neutral-500">{item.label}</dt>
              <dd className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                {item.display ? (item.display) : (<CurrencyAmount value={item.value} currency={item.currency} semantic={item.semantic ?? 'plain'} size="lg" decimals={0}/>)}
                {typeof item.trendPct === 'number' && Number.isFinite(item.trendPct) && (<TrendBadge pct={item.trendPct}/>)}
              </dd>
            </div>))}
        </dl>)}
    </section>);
};
type FinancialMetricCardProps = {
    label: string;
    value: number;
    currency?: CurrencyCode | null;
    semantic?: AmountSemantic;
    icon?: React.ReactNode;
    hint?: string;
    meta?: React.ReactNode;
    valueDisplay?: React.ReactNode;
    tone?: 'neutral' | 'stock' | 'cash' | 'debt' | 'profit' | 'investor' | 'report';
    onEdit?: () => void;
    onClick?: () => void;
    className?: string;
    key?: React.Key | null;
};
const toneClasses = {
    neutral: { icon: 'text-neutral-500', bg: 'bg-neutral-100', ring: 'ring-neutral-200' },
    stock:   { icon: 'text-financial-asset', bg: 'bg-financial-asset-bg', ring: 'ring-primary/15' },
    cash:    { icon: 'text-financial-profit', bg: 'bg-financial-profit-bg', ring: 'ring-success/15' },
    debt:    { icon: 'text-financial-loss', bg: 'bg-financial-loss-bg', ring: 'ring-danger/15' },
    profit:  { icon: 'text-financial-profit', bg: 'bg-financial-profit-bg', ring: 'ring-success/15' },
    investor:{ icon: 'text-secondary', bg: 'bg-secondary/10', ring: 'ring-secondary/15' },
    report:  { icon: 'text-warning', bg: 'bg-warning-bg', ring: 'ring-warning/15' }
};
function ReferenceFinancialMetricCard({ label, value, currency = 'DZD', semantic = 'plain', icon, hint, meta, valueDisplay, tone = 'neutral', onEdit, onClick, className = '' }: FinancialMetricCardProps) {
    const toneClass = toneClasses[tone];
    return (<div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(event) => {
            if (!onClick) return;
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); }
        }} className={`group relative min-h-touch rounded-xl border p-3 shadow-card ring-1 transition-all border-border bg-surface text-neutral-900 ${toneClass.ring} ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase text-neutral-500">{label}</p>
          <div className="mt-1">
            {valueDisplay ?? <CurrencyAmount value={value} currency={currency ?? undefined} semantic={semantic} size="lg"/>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (<button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} className="flex h-touch w-touch items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200" aria-label={`Modifier ${label}`}>
              <PencilIcon className="h-4 w-4"/>
            </button>)}
          {icon && (<div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass.bg} ${toneClass.icon}`}>{icon}</div>)}
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-neutral-500">{hint}</p>}
      {meta && <div className="mt-3">{meta}</div>}
    </div>);
}
// ---- End of the reference ----

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
};
const LANGS = ['fr', 'ar'] as const;
function render(node: React.ReactElement, lang: typeof LANGS[number]) {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
}
/** What a person reads, in order: the text without the markup. */
function textOf(html: string) {
    return html
        .replace(/<!-- -->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function amountsIn(html: string): string[] {
    return [...html.matchAll(/<bdi dir="ltr">(.*?)<\/bdi>/g)].map((match) => textOf(match[1]));
}
function attr(html: string, name: string): string[] {
    return [...html.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((match) => match[1]);
}

// ---- Made-up figures: signs, zero, decimals, large values, every currency ----
const VALUES = [0, 1_234_567.89, -98_765.4, 0.4, -0.6, 250_000, 42.5];
const CURRENCIES: Array<CurrencyCode | null | undefined> = ['DZD', 'USDT', 'EUR', 'USD', null, undefined];
const SEMANTICS: Array<AmountSemantic | undefined> = [undefined, 'plain', 'auto', 'profit', 'loss', 'neutral'];
const ACCENTS: Array<HeroKpiCardProps['accent']> = [undefined, 'indigo', 'teal', 'sky', 'emerald', 'purple', 'amber'];
const TRENDS = [undefined, 12.345, -3.5, 0, Number.NaN];
const secondaryRow = (i: number): HeroKpiSecondary => ({
    label: `Ligne ${i + 1}`,
    value: VALUES[(i + 1) % VALUES.length] * (i + 2),
    currency: CURRENCIES[i % CURRENCIES.length],
    semantic: SEMANTICS[i % SEMANTICS.length],
    trendPct: TRENDS[i % TRENDS.length],
    display: i === 4 ? <span>12 / 30 opérations</span> : undefined,
});

// ---- 1. Hero: same text and amounts, every prop combination ----
let heroCases = 0;
for (const lang of LANGS) {
    VALUES.forEach((value, v) => {
        for (const currency of CURRENCIES) {
            for (let rows = 0; rows <= 5; rows += 1) {
                const props: HeroKpiCardProps = {
                    primaryLabel: `Capital ${v}`,
                    primaryValue: value,
                    primaryCurrency: currency,
                    primarySemantic: SEMANTICS[(v + rows) % SEMANTICS.length],
                    trendPct: TRENDS[(v + rows) % TRENDS.length],
                    secondary: rows === 0 && v % 2 === 0 ? undefined : Array.from({ length: rows }, (_, i) => secondaryRow(i)),
                    icon: rows % 2 === 0 ? <WalletIcon className="h-5 w-5"/> : undefined,
                    accent: ACCENTS[(v + rows) % ACCENTS.length],
                };
                const before = render(<ReferenceHeroKpiCard {...props}/>, lang);
                const after = render(<HeroKpiCard {...props}/>, lang);
                const label = `hero ${lang} value=${value} currency=${currency} rows=${rows}`;
                assert.equal(textOf(after), textOf(before), `${label}: same text`);
                assert.deepEqual(amountsIn(after), amountsIn(before), `${label}: same amounts`);
                assert.equal(amountsIn(after).length, 1 + Math.min(rows, 4), `${label}: one amount per figure`);
                assert.deepEqual(attr(after, 'aria-label'), attr(before, 'aria-label'), `${label}: same names`);
                heroCases += 1;
            }
        }
    });
}
assert.ok(heroCases >= 500, `hero cases (${heroCases})`);

// ---- 2. Figure tile: same text and amounts, every prop combination ----
const TONES: Array<FinancialMetricCardProps['tone']> = [undefined, 'neutral', 'stock', 'cash', 'debt', 'profit', 'investor', 'report'];
const noop = () => undefined;
let tileCases = 0;
for (const lang of LANGS) {
    VALUES.forEach((value, v) => {
        for (const currency of CURRENCIES) {
            TONES.forEach((tone, k) => {
                const props: FinancialMetricCardProps = {
                    label: `Stock ${v}-${k}`,
                    value,
                    currency,
                    semantic: SEMANTICS[(v + k) % SEMANTICS.length],
                    tone,
                    icon: k % 2 === 0 ? <WalletIcon className="h-4 w-4"/> : undefined,
                    hint: k % 3 === 0 ? `Prix moyen ${k}` : undefined,
                    meta: k % 4 === 1 ? <span>Mis à jour le 01/10</span> : undefined,
                    valueDisplay: k === 7 ? <span>3 clients</span> : undefined,
                    onEdit: k % 2 === 1 ? noop : undefined,
                    onClick: k % 3 === 2 ? noop : undefined,
                };
                const before = render(<ReferenceFinancialMetricCard {...props}/>, lang);
                const after = render(<FinancialMetricCard {...props}/>, lang);
                const label = `tile ${lang} value=${value} currency=${currency} tone=${tone}`;
                assert.equal(textOf(after), textOf(before), `${label}: same text`);
                assert.deepEqual(amountsIn(after), amountsIn(before), `${label}: same amounts`);
                assert.equal(after.includes('role="button"'), before.includes('role="button"'), `${label}: same click behaviour`);
                const editLabel = attr(after, 'aria-label');
                if (props.onEdit) {
                    assert.deepEqual(editLabel, [`${lang === 'fr' ? 'Modifier' : 'تعديل'} ${props.label}`], `${label}: pencil named in the page language`);
                    if (lang === 'fr')
                        assert.deepEqual(editLabel, attr(before, 'aria-label'), `${label}: same French name as before`);
                }
                else {
                    assert.deepEqual(editLabel, [], `${label}: no pencil`);
                }
                tileCases += 1;
            });
        }
    });
}
assert.ok(tileCases >= 600, `tile cases (${tileCases})`);

console.log(`metricCards.test: ${heroCases} hero and ${tileCases} tile renders match the V2-3 cards`);
