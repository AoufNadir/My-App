import { Fragment, useState, type ReactNode } from 'react';
import { SectionCard } from '../cards';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { CapitalUse, ClientTrend, Insight } from '../../utils/analyticsInsights';

// V18: the new blocks of the Analyse page, in the owner's words, Arabic and French. Display only.

const fmt = (v: number, digits = 0) => (Math.round(v * 10 ** digits) / 10 ** digits).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/\u202f|\u00a0/g, ' ');
const N = ({ children, className = '' }: { children: ReactNode; className?: string }) => <bdi dir="ltr" className={`whitespace-nowrap tabular-nums ${className}`}>{children}</bdi>;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;

const W = {
    ar: {
        insights: '⚡ أشياء تستحق انتباهك', nothing: 'لا شيء يستحق التنبيه في هذه الفترة.',
        credit: 'البيع بالدَّين أرخص من الدفع الفوري', creditBody: (c: string, n: string) => <>هامشك بالدَّين <N>{c}</N> دج/USDT مقابل <N>{n}</N> عند الدفع الفوري</>,
        falling: (name: string) => `${name} يشتري أقل`, fallingBody: (pct: string, now: string, before: string) => <><N>{pct}</N> من الفترة السابقة · <N>{now}</N> USDT بدل <N>{before}</N></>,
        debts: 'جزء من رأس المال في الديون', debtsBody: (amount: string, pct: string) => <><N>{amount}</N> دج عند العملاء (<N>{pct}</N> من رأس المال) لا تربح شيئاً</>,
        stock: 'المخزون ينتظر طويلاً', stockBody: (days: string) => <>يبقى المخزون نحو <N>{days}</N> يوماً قبل بيعه</>,
        impactHint: 'الرقم على اليسار: أثره بالدينار في الفترة',
        capital: 'هل مالي يعمل جيداً؟', perMillion: 'ربح كل مليون دج في الشهر', stockDays: 'يوماً يبقى المخزون قبل بيعه', debtShare: 'من رأس المال عند العملاء',
        clients: 'العملاء', best: 'الأفضل', rising: 'يصعدون ↑', falling2: 'ينزلون ↓', noTrend: 'لا تغيّر كبير عن الفترة السابقة.',
        weekdays: 'الربح حسب أيام الأسبوع', days: ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
        goal: 'الهدف', forecast: 'التوقع لنهاية الشهر',
    },
    fr: {
        insights: '⚡ À regarder', nothing: 'Rien à signaler sur cette période.',
        credit: 'La vente à crédit rapporte moins', creditBody: (c: string, n: string) => <>Marge à crédit <N>{c}</N> DZD/USDT contre <N>{n}</N> payé tout de suite</>,
        falling: (name: string) => `${name} achète moins`, fallingBody: (pct: string, now: string, before: string) => <><N>{pct}</N> par rapport à la période d’avant · <N>{now}</N> USDT au lieu de <N>{before}</N></>,
        debts: 'Une part du capital dort dans les dettes', debtsBody: (amount: string, pct: string) => <><N>{amount}</N> DZD chez les clients (<N>{pct}</N> du capital) ne rapportent rien</>,
        stock: 'Le stock attend longtemps', stockBody: (days: string) => <>Le stock attend environ <N>{days}</N> jours avant d’être vendu</>,
        impactHint: 'À gauche : l’effet en dinars sur la période',
        capital: 'Mon argent travaille-t-il bien ?', perMillion: 'de bénéfice par million de DZD et par mois', stockDays: 'jours d’attente du stock', debtShare: 'du capital chez les clients',
        clients: 'Clients', best: 'Les meilleurs', rising: 'En hausse ↑', falling2: 'En baisse ↓', noTrend: 'Pas de grand changement par rapport à la période d’avant.',
        weekdays: 'Bénéfice par jour de la semaine', days: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
        goal: 'Objectif', forecast: 'Fin de mois à ce rythme',
    },
};
export type Lang2 = 'ar' | 'fr';

export function GoalForecast({ lang, profit, goal, forecast }: { lang: Lang2; profit: number; goal: number; forecast: number | null }) {
    const w = W[lang];
    if (!(goal > 0) && forecast === null) return null;
    const pct = goal > 0 ? Math.min(100, Math.max(0, (profit / goal) * 100)) : 0;
    return (<div data-testid="an-goal" className="mt-3">
      {goal > 0 && (<div className="relative h-2.5 rounded-full bg-neutral-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <span className="absolute inset-y-0 start-0 rounded-full bg-primary" style={{ width: `${pct}%` }}/>
        </div>)}
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs font-semibold text-neutral-600">
        {goal > 0 && <span>{w.goal} <N>{fmt(goal)}</N></span>}
        {forecast !== null && <span>{w.forecast} ≈ <N>{fmt(forecast)}</N>{goal > 0 ? (forecast >= goal ? ' ✅' : ' ⚠️') : ''}</span>}
      </div>
    </div>);
}

export function InsightsCard({ lang, insights, clientName }: { lang: Lang2; insights: Insight[]; clientName: (id: string) => string }) {
    const w = W[lang];
    const tone = ['bg-financial-loss-bg text-financial-loss', 'bg-financial-debt-bg text-financial-debt', 'bg-primary/10 text-primary'];
    const row = (i: Insight): [string, ReactNode, ReactNode] => {
        switch (i.kind) {
            case 'credit_margin': return [w.credit, w.creditBody(fmt(i.creditMargin, 2), fmt(i.nowMargin, 2)), <N>{signed(-i.impact)}</N>];
            case 'client_falling': return [w.falling(clientName(i.clientId)), w.fallingBody(`${Math.round(i.change * 100)}%`, fmt(i.now), fmt(i.before)), <N>{signed(-i.impact)}</N>];
            case 'debts': return [w.debts, w.debtsBody(fmt(i.debts), `${Math.round(i.share * 100)}%`), <N>{signed(-i.impact)}</N>];
            case 'stock_days': return [w.stock, w.stockBody(fmt(i.days)), <N>{fmt(i.days)}</N>];
        }
    };
    return (<SectionCard title={w.insights}>
      <div data-testid="an-insights">
        {insights.length === 0 && <p className="text-sm text-neutral-500">{w.nothing}</p>}
        {insights.map((i, index) => {
            const [title, body, value] = row(i);
            return (<Fragment key={`${i.kind}-${index}`}>
              <div className="flex items-start gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
                <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tone[index] ?? tone[2]}`}>{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-neutral-900">{title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-neutral-600">{body}</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-financial-loss">{value}</span>
              </div>
            </Fragment>);
        })}
        {insights.some((i) => i.impact > 0) && <p className="mt-1 text-[11px] text-neutral-400">{w.impactHint}</p>}
      </div>
    </SectionCard>);
}

export function EffectBars({ rows }: { rows: Array<{ key: string; title: string; value: number }> }) {
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
    return (<div data-testid="an-effects" className="flex flex-col gap-2">
      {rows.map((r) => (<Fragment key={r.key}>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0 text-neutral-700">{r.title}</span>
            <span className="relative h-3 flex-1 rounded-full bg-surface-muted">
              <span className={`absolute inset-y-0 start-0 rounded-full ${r.value >= 0 ? 'bg-financial-profit' : 'bg-financial-loss'}`} style={{ width: `${Math.max(4, (Math.abs(r.value) / max) * 100)}%` }}/>
            </span>
            <N className={`w-24 shrink-0 text-end font-bold ${r.value >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>{signed(r.value)}</N>
          </div>
        </Fragment>))}
    </div>);
}

export function CapitalUseCard({ lang, use }: { lang: Lang2; use: CapitalUse }) {
    const w = W[lang];
    const tile = (value: ReactNode, label: string, warn = false) => (<div className="min-w-0 rounded-button bg-surface-muted px-2.5 py-2">
        <div className={`text-lg font-bold ${warn ? 'text-financial-debt' : 'text-neutral-900'}`}>{value}</div>
        <div className="text-[11.5px] leading-snug text-neutral-500">{label}</div>
      </div>);
    return (<SectionCard title={w.capital}>
      <div data-testid="an-capital" className="grid grid-cols-3 gap-2">
        {tile(use.profitPerMillion !== null ? <N>{fmt(use.profitPerMillion)}</N> : '—', w.perMillion)}
        {tile(use.stockDays !== null ? <N>{fmt(use.stockDays)}</N> : '—', w.stockDays, use.stockDays !== null && use.stockDays > 10)}
        {tile(use.debtShare !== null ? <N>{`${Math.round(use.debtShare * 100)}%`}</N> : '—', w.debtShare, use.debtShare !== null && use.debtShare >= 0.15)}
      </div>
    </SectionCard>);
}

export function ClientsCard({ lang, best, trends, clientName }: { lang: Lang2; best: ReactNode; trends: { rising: ClientTrend[]; falling: ClientTrend[] }; clientName: (id: string) => string }) {
    const w = W[lang];
    const [tab, setTab] = useState<'best' | 'rising' | 'falling'>('best');
    const list = tab === 'rising' ? trends.rising : trends.falling;
    return (<SectionCard title={w.clients}>
      <div data-testid="an-clients" className="flex flex-col gap-2">
        <SegmentedControl<'best' | 'rising' | 'falling'> ariaLabel={w.clients} value={tab} onChange={setTab} options={[{ id: 'best', label: w.best }, { id: 'rising', label: w.rising }, { id: 'falling', label: w.falling2 }]}/>
        {tab === 'best' ? best : list.length === 0 ? <p className="text-sm text-neutral-500">{w.noTrend}</p> : list.map((c) => (<Fragment key={c.clientId}>
            <div className="flex items-baseline justify-between gap-3 border-t border-border py-2 text-sm first:border-t-0">
              <span className="min-w-0 truncate font-semibold text-neutral-900">{clientName(c.clientId)}</span>
              <span className="shrink-0 text-xs text-neutral-500"><N>{fmt(c.before)}</N> → <N className="font-bold text-neutral-900">{fmt(c.now)}</N> USDT <N className={c.change >= 0 ? 'text-financial-profit' : 'text-financial-loss'}>{`${c.change >= 0 ? '+' : ''}${Math.round(c.change * 100)}%`}</N></span>
            </div>
          </Fragment>))}
      </div>
    </SectionCard>);
}

export function WeekdayRows({ lang, values }: { lang: Lang2; values: number[] }) {
    const w = W[lang];
    const max = Math.max(1, ...values.map((v) => Math.abs(v)));
    return (<div data-testid="an-weekdays" className="mt-2">
      <p className="mb-1 text-xs font-semibold text-neutral-500">{w.weekdays}</p>
      {values.map((v, i) => (<Fragment key={i}>
          <div className="flex items-center gap-2 py-0.5 text-xs">
            <span className="w-16 shrink-0 text-neutral-600">{w.days[i]}</span>
            <span className="relative h-2 flex-1 rounded-full bg-surface-muted"><span className="absolute inset-y-0 start-0 rounded-full bg-primary/70" style={{ width: `${(Math.max(0, v) / max) * 100}%` }}/></span>
            <N className="w-16 shrink-0 text-end font-semibold">{fmt(v)}</N>
          </div>
        </Fragment>))}
    </div>);
}
