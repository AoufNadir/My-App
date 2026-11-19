import type { ReactNode } from 'react';
import { AlertCard } from '../cards';
import { Button } from '../ui/Button';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import type { GuardFinding } from '../../services/guardChecks';

// V17-1: one line of the guard in the bell: what looks wrong, with the numbers, and two buttons: open it, or « it is right ».

const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
const n = (v: number) => <bdi dir="ltr" className="whitespace-nowrap tabular-nums">{fmt(v)}</bdi>;
const dzd = (v: number) => <bdi dir="ltr" className="whitespace-nowrap tabular-nums">{fmt(v)} DZD</bdi>;
const d = (ts: number) => { const x = new Date(ts); return <bdi dir="ltr">{`${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`}</bdi>; };

const W = {
    ar: {
        kind: (o: string) => (o === 'personal_expense' ? 'مصروف شخصي' : 'مصروف المشروع'),
        side: (s: 'buy' | 'sell') => (s === 'sell' ? 'بيع' : 'شراء'),
        open: 'افتح',
        ok: 'هذا صحيح',
        duplicate: (f: Extract<GuardFinding, { kind: 'duplicate_expense' }>) => [`مصروف مكرّر؟`, <>{W.ar.kind(f.origin)} {dzd(f.amount)} يوم {d(f.timestamp)} · ومثله {n(f.otherAmount)} يوم {d(f.otherTimestamp)}</>],
        unusual: (f: Extract<GuardFinding, { kind: 'unusual_expense' }>) => [`مبلغ غير معتاد`, <>{W.ar.kind(f.origin)} {dzd(f.amount)} يوم {d(f.timestamp)} · المعتاد نحو {n(f.usual)}</>],
        price: (f: Extract<GuardFinding, { kind: 'price_far' }>) => [`سعر بعيد عن المعتاد`, <>{W.ar.side(f.side)} {f.currency} بسعر {n(f.price)} يوم {d(f.timestamp)} · المعتاد نحو {n(f.usual)}</>],
        loss: (f: Extract<GuardFinding, { kind: 'sale_below_cost' }>) => [`بيع بخسارة`, <>{f.currency} بسعر {n(f.price)} تحت متوسط الشراء {n(f.average)} يوم {d(f.timestamp)} · خسارة {dzd(f.loss)}</>],
        twin: (f: Extract<GuardFinding, { kind: 'twin_operation' }>) => [`عملية مكرّرة؟`, <>{W.ar.side(f.side)} {n(f.quantity)} {f.currency} بسعر {n(f.price)} مرتين خلال دقائق يوم {d(f.timestamp)}</>],
        negative: (f: Extract<GuardFinding, { kind: 'negative_wallet' }>) => [`رصيد سالب`, <>{f.wallet}: {n(f.balance)} · راجع آخر الحركات أو قم بالجرد</>],
        fee: (f: Extract<GuardFinding, { kind: 'fee_change' }>) => [`تغيّرت نسبة الإدارة`, <>{f.from === null ? '' : <>من {n(f.from)}% </>}إلى {n(f.to)}% يوم {d(f.timestamp)} · تُطبَّق على كل بيع بعدها</>],
        advance: (f: Extract<GuardFinding, { kind: 'open_advance' }>) => [`سلفة لم تُسوَّ`, <>{dzd(f.amount)} منذ {n(f.days)} يوماً · سوِّها مصروفاً أو أرجع المال</>],
    },
    fr: {
        kind: (o: string) => (o === 'personal_expense' ? 'Dépense perso' : 'Frais du projet'),
        side: (s: 'buy' | 'sell') => (s === 'sell' ? 'Vente' : 'Achat'),
        open: 'Ouvrir',
        ok: 'C’est juste',
        duplicate: (f: Extract<GuardFinding, { kind: 'duplicate_expense' }>) => [`Dépense en double ?`, <>{W.fr.kind(f.origin)} {dzd(f.amount)} le {d(f.timestamp)} · et {n(f.otherAmount)} le {d(f.otherTimestamp)}</>],
        unusual: (f: Extract<GuardFinding, { kind: 'unusual_expense' }>) => [`Montant inhabituel`, <>{W.fr.kind(f.origin)} {dzd(f.amount)} le {d(f.timestamp)} · d’habitude environ {n(f.usual)}</>],
        price: (f: Extract<GuardFinding, { kind: 'price_far' }>) => [`Prix loin de l’habitude`, <>{W.fr.side(f.side)} {f.currency} à {n(f.price)} le {d(f.timestamp)} · d’habitude environ {n(f.usual)}</>],
        loss: (f: Extract<GuardFinding, { kind: 'sale_below_cost' }>) => [`Vente à perte`, <>{f.currency} à {n(f.price)} sous le prix moyen {n(f.average)} le {d(f.timestamp)} · perte {dzd(f.loss)}</>],
        twin: (f: Extract<GuardFinding, { kind: 'twin_operation' }>) => [`Opération en double ?`, <>{W.fr.side(f.side)} {n(f.quantity)} {f.currency} à {n(f.price)} deux fois en quelques minutes le {d(f.timestamp)}</>],
        negative: (f: Extract<GuardFinding, { kind: 'negative_wallet' }>) => [`Solde négatif`, <>{f.wallet} : {n(f.balance)} · vérifiez les derniers mouvements ou faites l’inventaire</>],
        fee: (f: Extract<GuardFinding, { kind: 'fee_change' }>) => [`Taux de gestion modifié`, <>{f.from === null ? '' : <>de {n(f.from)} % </>}à {n(f.to)} % le {d(f.timestamp)} · s’applique à chaque vente suivante</>],
        advance: (f: Extract<GuardFinding, { kind: 'open_advance' }>) => [`Avance non régularisée`, <>{dzd(f.amount)} depuis {n(f.days)} jours · régularisez-la ou rendez l’argent</>],
    },
};

export function guardText(f: GuardFinding, lang: 'ar' | 'fr'): [string, ReactNode] {
    const w = W[lang];
    switch (f.kind) {
        case 'duplicate_expense': return w.duplicate(f) as [string, ReactNode];
        case 'unusual_expense': return w.unusual(f) as [string, ReactNode];
        case 'price_far': return w.price(f) as [string, ReactNode];
        case 'sale_below_cost': return w.loss(f) as [string, ReactNode];
        case 'twin_operation': return w.twin(f) as [string, ReactNode];
        case 'negative_wallet': return w.negative(f) as [string, ReactNode];
        case 'fee_change': return w.fee(f) as [string, ReactNode];
        case 'open_advance': return w.advance(f) as [string, ReactNode];
    }
}

export function GuardAlertCard({ finding, lang, onOpen, onOk }: { finding: GuardFinding; lang: 'ar' | 'fr'; onOpen?: () => void; onOk: () => void }) {
    const [title, detail] = guardText(finding, lang);
    const urgent = finding.kind === 'negative_wallet' || finding.kind === 'duplicate_expense' || finding.kind === 'twin_operation';
    return (<div data-testid="guard-alert" data-kind={finding.kind}>
      <AlertCard tone={urgent ? 'warning' : 'info'} icon={<AlertTriangleIcon className="h-5 w-5"/>} title={`🛡️ ${title}`} detail={detail} footer={<>
        {onOpen && <Button type="button" size="sm" onClick={onOpen} className="font-bold">{W[lang].open}</Button>}
        <Button type="button" size="sm" variant="ghost" onClick={onOk}>{W[lang].ok}</Button>
      </>}/>
    </div>);
}
