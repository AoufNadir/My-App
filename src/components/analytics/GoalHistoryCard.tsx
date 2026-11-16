import { useLanguage } from '../../contexts/LanguageContext';
import type { GoalHistoryRow } from '../../services/goalHistory';

// P6: « Historique des objectifs »: one short line per month, the goal, what was made, and a mark.
const MONTHS = {
    ar: ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
};
const WORDS = { ar: { title: 'سجل الأهداف', goal: 'الهدف', made: 'حققت', now: 'جارٍ' }, fr: { title: 'Historique des objectifs', goal: 'Objectif', made: 'Réalisé', now: 'en cours' } };
const amount = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(2).replace('.', ',').replace(/,?0+$/, '')} M` : `${Math.round(v).toLocaleString('fr-FR').replace(/ | /g, ' ')}`);

export function GoalHistoryCard({ rows }: { rows: readonly GoalHistoryRow[] }) {
    const { lang } = useLanguage();
    if (rows.length === 0) return null;
    const w = WORDS[lang];
    return (<section className="rounded-card border border-border bg-surface px-4 py-3" data-testid="goal-history">
      <h3 className="mb-2 text-sm font-bold text-neutral-900">{w.title}</h3>
      <ul className="divide-y divide-border">
        {rows.map((row) => {
            const [y, m] = row.key.split('-').map(Number);
            const mark = row.inProgress ? `⏳ ${w.now}` : row.reached ? '✅' : '❌';
            return (<li key={row.key} className="flex items-center justify-between gap-2 py-2 text-xs">
              <span className="font-semibold text-neutral-800">{MONTHS[lang][m - 1]} {y}</span>
              <span className="text-neutral-600">{w.goal} <bdi dir="ltr" className="font-bold">{amount(row.goal)}</bdi> · {w.made} <bdi dir="ltr" className={`font-bold ${row.reached ? 'text-financial-profit' : 'text-neutral-900'}`}>{amount(row.achieved)}</bdi> {mark}</span>
            </li>);
        })}
      </ul>
    </section>);
}
