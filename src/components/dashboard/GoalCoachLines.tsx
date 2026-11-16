import { useLanguage } from '../../contexts/LanguageContext';
import { Fragment, type ReactNode } from 'react';
import type { GoalCoach } from '../../services/goalCoach';

/** The isolated pieces (between U+2066 and U+2069) rendered as left-to-right elements. */
function withLtr(text: string): ReactNode {
    return text.split(/\u2066|\u2069/).map((part, i) => (i % 2 ? <bdi key={i} dir="ltr">{part}</bdi> : <Fragment key={i}>{part}</Fragment>));
}

// P3 (owner): three short lines under the goal bar — where you are, where the month ends, one decision with a
// number. Plus a raise (or fall back) proposal the owner accepts or refuses. No tables, no long text.
const WORDS = {
    ar: {
        week: (w: number) => `الأسبوع ${w}/4`, ahead: 'متقدّم', behind: 'متأخر', onTrack: 'في الطريق',
        projection: (v: string) => `بهذه الوتيرة تنهي الشهر عند ${v}`,
        keep: '💡 حافظ على وتيرتك',
        quantity: (q: string) => `💡 زِد الكمية: ${q} في الأسبوع`,
        price: (p: string) => `💡 زِد السعر: ${p} لكل USDT`,
        both: (q: string, p: string) => `💡 ${q} في الأسبوع و${p} لكل USDT`,
        raise: (v: string) => `🚀 أنت متقدّم: ارفع الهدف إلى ${v}؟`,
        minimum: (v: string) => `الهدف صعب هذا الشهر: انزل إلى الأدنى ${v}؟`,
        accept: 'موافق', keepGoal: 'أبقِ هدفي', millions: 'مليون',
    },
    fr: {
        week: (w: number) => `Semaine ${w}/4`, ahead: 'En avance', behind: 'En retard', onTrack: 'Dans les temps',
        projection: (v: string) => `À ce rythme, fin du mois à ${v}`,
        keep: '💡 Gardez ce rythme',
        quantity: (q: string) => `💡 Vendez plus : ${q} par semaine`,
        price: (p: string) => `💡 Montez le prix : ${p} par USDT`,
        both: (q: string, p: string) => `💡 ${q} par semaine et ${p} par USDT`,
        raise: (v: string) => `🚀 Vous êtes en avance : objectif à ${v} ?`,
        minimum: (v: string) => `Objectif difficile ce mois : passer au minimum ${v} ?`,
        accept: 'D’accord', keepGoal: 'Garder mon objectif', millions: 'M',
    },
};

export function formatGoalAmount(value: number, millions: string): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',').replace(/,?0+$/, '')} ${millions}`;
    return `${Math.round(value).toLocaleString('fr-FR').replace(/ | /g, ' ')} DZD`;
}
const num = (value: number) => (Number.isInteger(value) ? value : value.toFixed(1)).toLocaleString('fr-FR').replace(/ | /g, ' ').replace('.', ',');

export function GoalCoachLines({ coach, minimum, onAcceptTarget, onKeep }: { coach: GoalCoach; minimum: number; onAcceptTarget?: (target: number) => void; onKeep?: () => void }) {
    const { lang } = useLanguage();
    const w = WORDS[lang];
    // Each number with its sign and unit is one isolated piece, so Arabic text never reverses it.
    const iso = (text: string) => `\u2066${text}\u2069`;
    const amount = (v: number) => iso(formatGoalAmount(v, w.millions));
    const qty = (v: number) => iso(`+${num(v)} USDT`);
    const perUnit = (v: number) => iso(`+${num(v)} DZD`);
    const { review, advice } = coach;
    const statusText = review.status === 'ahead' ? `${w.ahead} ${amount(Math.abs(review.gap))} ✅`
        : review.status === 'on_track' ? `${w.onTrack} ✅`
            : `${w.behind} ${amount(Math.abs(review.gap))} 🔶`;
    const adviceText = advice.kind === 'quantity' ? w.quantity(qty(advice.extraQtyPerWeek))
        : advice.kind === 'price' ? w.price(perUnit(advice.extraPerUnit))
            : advice.kind === 'both' ? w.both(qty(advice.extraQtyPerWeek), perUnit(advice.extraPerUnit))
                : w.keep;
    const proposal = review.proposedTarget ? { text: w.raise(amount(review.proposedTarget)), target: review.proposedTarget }
        : review.proposeMinimum && minimum > 0 ? { text: w.minimum(amount(minimum)), target: minimum } : null;
    return (<span className="flex flex-col gap-1 text-xs" data-testid="goal-coach">
      <span className="font-semibold text-neutral-800">{withLtr(`${w.week(review.week).replace(/(\d\/4)/, iso('$1'))} · ${statusText}`)}</span>
      <span className="text-neutral-500">{withLtr(w.projection(amount(review.projection)))}</span>
      <span className="font-bold text-primary">{withLtr(adviceText)}</span>
      {proposal && onAcceptTarget && (<span className="mt-1 flex flex-wrap items-center gap-2 rounded-button bg-primary/5 px-2 py-1.5" onClick={(event) => event.stopPropagation()}>
          <span className="min-w-0 flex-1 font-semibold text-neutral-800">{withLtr(proposal.text)}</span>
          <span role="button" tabIndex={0} onClick={() => onAcceptTarget(proposal.target)} onKeyDown={(e) => { if (e.key === 'Enter') onAcceptTarget(proposal.target); }} className="rounded-full bg-primary px-3 py-1 font-bold text-white">{w.accept}</span>
          <span role="button" tabIndex={0} onClick={() => onKeep?.()} onKeyDown={(e) => { if (e.key === 'Enter') onKeep?.(); }} className="rounded-full border border-border bg-surface px-3 py-1 font-semibold text-neutral-700">{w.keepGoal}</span>
        </span>)}
    </span>);
}
