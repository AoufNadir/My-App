import type { ReactNode } from 'react';
import type { ActionItem } from './ActionCenter';
import type { AbsentClient } from '../../services/goalAlerts';
import type { CoachAdvice } from '../../services/goalCoach';

// P5: the bell's goal alerts as short rows: a number and a decision, in the owner's language.
export type GoalAlerts = {
    absent: Array<AbsentClient & { name: string }>;
    stock: { needed: number; stock: number } | null;
    lastWeek: { week: number; earned: number; expected: number; advice: CoachAdvice } | null;
};

const n = (v: number) => <bdi dir="ltr">{Math.round(v).toLocaleString('fr-FR').replace(/ | /g, ' ')}</bdi>;
const W = {
    ar: {
        absentTitle: (name: string) => `${name} غائب`,
        absentBody: (q: ReactNode, d: ReactNode) => <>يشتري عادة {q} USDT في الشهر · لم يشترِ منذ {d} يوماً</>,
        stockTitle: 'مخزون الهدف',
        stockBody: (need: ReactNode, have: ReactNode) => <>للهدف تحتاج {need} USDT · مخزونك {have}</>,
        weekTitle: (w: number) => `الهدف · الأسبوع ${w}`,
        weekBody: (e: ReactNode, x: ReactNode, a: string) => <>{e} من {x} DZD · القادم: {a}</>,
        advice: { keep: 'حافظ على وتيرتك', quantity: 'زِد الكمية', price: 'زِد السعر', both: 'زِد الكمية والسعر' },
    },
    fr: {
        absentTitle: (name: string) => `${name} ne passe plus`,
        absentBody: (q: ReactNode, d: ReactNode) => <>Achète d’habitude {q} USDT par mois · rien depuis {d} jours</>,
        stockTitle: 'Stock pour l’objectif',
        stockBody: (need: ReactNode, have: ReactNode) => <>L’objectif demande {need} USDT · votre stock {have}</>,
        weekTitle: (w: number) => `Objectif · semaine ${w}`,
        weekBody: (e: ReactNode, x: ReactNode, a: string) => <>{e} sur {x} DZD · la suivante : {a}</>,
        advice: { keep: 'gardez ce rythme', quantity: 'vendez plus', price: 'montez le prix', both: 'plus de volume et de prix' },
    },
};

export function goalAlertRows(alerts: GoalAlerts | null | undefined, lang: 'ar' | 'fr', icons: { client: ReactNode; stock: ReactNode; week: ReactNode }, onOpenClient?: (id: string) => void): Array<{ item: ActionItem; signature: string }> {
    if (!alerts) return [];
    const w = W[lang];
    const rows: Array<{ item: ActionItem; signature: string }> = [];
    for (const c of alerts.absent) {
        rows.push({ signature: `${Math.floor(c.daysSince / 7)}`, item: { id: `goal-absent-${c.clientId}`, tone: 'debt', icon: icons.client, title: w.absentTitle(c.name), detail: w.absentBody(n(c.monthlyQty), n(c.daysSince)), onOpen: onOpenClient ? () => onOpenClient(c.clientId) : undefined } });
    }
    if (alerts.stock) rows.push({ signature: `${alerts.stock.needed}|${Math.floor(alerts.stock.stock / 500)}`, item: { id: 'goal-stock', tone: 'debt', icon: icons.stock, title: w.stockTitle, detail: w.stockBody(n(alerts.stock.needed), n(alerts.stock.stock)) } });
    if (alerts.lastWeek) {
        const lw = alerts.lastWeek;
        rows.push({ signature: `${lw.week}`, item: { id: 'goal-week', tone: lw.earned >= lw.expected ? 'profit' : 'primary', icon: icons.week, title: w.weekTitle(lw.week), detail: w.weekBody(n(lw.earned), n(lw.expected), w.advice[lw.advice.kind]) } });
    }
    return rows;
}
