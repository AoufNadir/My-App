import { useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { BottomSheet } from '../ui/BottomSheet';
import { useAgentChecks } from '../../hooks/useAgentChecks';
import { matchDeposits, outstandingOnly, parseAmounts, pendingDeposits, type AgentDeposit, type MatchLine } from '../../utils/agentDeposits';
import type { ClientDzd, ClientTransactionDzd } from '../../types';

// V27-1 (owner): on the intermediary's page (« أمين »): the deposits not collected yet, numbered, and « Vérifier » —
// count each bundle (or paste the friend's list) and the app says whose it is and what is missing.
type Resolution = 'client' | 'agent' | 'paper';
const W = {
    fr: {
        title: 'Dépôts à encaisser', total: 'Total', none: 'Aucun dépôt en attente.', check: 'Vérifier les dépôts',
        startToday: 'Commencer le suivi aujourd’hui (les anciens sont déjà encaissés)', since: (d: string) => `Suivi depuis le ${d}`,
        sheet: 'Vérifier les dépôts', countNow: 'Je compte', paste: 'Coller une liste', amount: 'Montant de la liasse', next: 'Suivant',
        pasteHint: 'Collez la liste (un montant par ligne, comme sur le papier).', read: 'Lire la liste',
        exact: 'Exact', near: 'Écart', ambiguous: 'À trancher', extra: 'Sans dépôt', missing: 'Pas encore compté (reste pour la prochaine fois)',
        counted: 'Compté', due: 'Attendu', diff: 'Écart',
        short: (n: string) => `manque ${n}`, over: (n: string) => `en trop ${n}`,
        toClient: 'Sur le client', toAgent: 'Sur l’intermédiaire', paper: 'Erreur d’écriture (montant complet)',
        either: 'Lequel ?', remove: 'Retirer', confirm: 'Confirmer l’encaissement', confirmHint: (_n: string) => 'Ensuite, encaissement en espèces à enregistrer :',
        needChoice: 'Choisissez pour chaque écart.', saved: '✅ Dépôts vérifiés.',
        note: (n: number) => `Encaissement de ${n} dépôt(s) vérifiés`,
    },
    ar: {
        title: 'أمانات لم تُحصَّل', total: 'المجموع', none: 'لا أمانة منتظرة.', check: 'فحص الأمانات',
        startToday: 'ابدأ المتابعة من اليوم (القديمة حُصّلت)', since: (d: string) => `المتابعة منذ ${d}`,
        sheet: 'فحص الأمانات', countNow: 'أعدّ الآن', paste: 'ألصق قائمة', amount: 'مبلغ الربطة', next: 'التالي',
        pasteHint: 'ألصق القائمة (مبلغ في كل سطر، كما في الورقة).', read: 'اقرأ القائمة',
        exact: 'مطابق', near: 'فرق', ambiguous: 'غير محسوم', extra: 'بلا أمانة', missing: 'لم تُعدّ بعد (تبقى للمرة القادمة)',
        counted: 'المعدود', due: 'المستحق', diff: 'الفرق',
        short: (n: string) => `ناقص ${n}`, over: (n: string) => `زائد ${n}`,
        toClient: 'على العميل', toAgent: 'على الوسيط', paper: 'خطأ في الكتابة (المبلغ كامل)',
        either: 'أيّهما؟', remove: 'حذف', confirm: 'تأكيد التحصيل', confirmHint: (_n: string) => 'بعدها تحصيل نقدي، اضغط «حفظ»:',
        needChoice: 'اختر مصير كل فرق.', saved: '✅ فُحصت الأمانات.',
        note: (n: number) => `تحصيل ${n} أمانة مفحوصة`,
    },
};
const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ /g, ' ');
const dateOf = (ts: number) => (ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '');

export function AgentDeposits({ agent, owed, rows, allRows, transactions, clients, nameOf, userDocRef, onTransfer, onCollect, setAlert }: {
    agent: ClientDzd;
    /** What the intermediary holds for the owner (his debt), so only those deposits are listed. */
    owed: number;
    rows: ReadonlyArray<ClientTransactionDzd>;
    allRows: ReadonlyArray<ClientTransactionDzd>;
    transactions: ReadonlyArray<{ id?: string; linkedClientId?: string }>;
    clients: ReadonlyArray<ClientDzd>;
    nameOf: (c: ClientDzd) => string;
    userDocRef: any;
    onTransfer?: (p: { fromClientId: string; toClientId: string; amount: number; notes?: string }) => Promise<boolean>;
    onCollect: (amount: number, notes: string) => void;
    setAlert?: (m: string) => void;
}) {
    const { lang } = useLanguage();
    const w = W[lang];
    const checks = useAgentChecks(userDocRef, agent.id);
    const deposits = useMemo(() => {
        const byId = new Map(allRows.map((r) => [r.id, r]));
        const txById = new Map(transactions.map((t) => [t.id, t]));
        const clientName = (id?: string) => { const c = id ? clients.find((x) => x.id === id) : undefined; return c ? nameOf(c) : ''; };
        return outstandingOnly(pendingDeposits(rows as unknown as Array<{ id: string; montant?: number; timestamp?: number; affectsBalance?: boolean; linkedTxId?: string; notes?: string; type?: string }>, checks.collected, checks.since, (row) => {
            const other = row.linkedTxId ? byId.get(row.linkedTxId) : undefined;
            const sale = row.linkedTxId ? txById.get(row.linkedTxId) : undefined;
            const clientId = (other && other.clientId !== agent.id ? other.clientId : undefined) ?? sale?.linkedClientId;
            return { clientId, label: clientName(clientId) || row.notes || row.type || '—' };
        }), owed);
    }, [rows, allRows, transactions, clients, nameOf, agent.id, checks.collected, checks.since, owed]);
    const numbered = deposits.map((d, i) => ({ ...d, no: i + 1 }));
    const total = deposits.reduce((s, d) => s + d.amount, 0);
    const [open, setOpen] = useState(false);
    if (!checks.loaded) return null;
    return (<section data-testid="agent-deposits" className="rounded-card border border-primary/30 bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-neutral-900">{w.title} · <bdi dir="ltr">{deposits.length}</bdi></h3>
        <bdi dir="ltr" className="text-sm font-black text-primary">{fmt(total)} DZD</bdi>
      </div>
      {checks.since > 0 && <p className="mt-0.5 text-[11px] text-neutral-500">{w.since(new Date(checks.since).toLocaleDateString('fr-FR'))}</p>}
      {deposits.length === 0 ? <p className="py-2 text-xs text-neutral-600">{w.none}</p> : (<ol className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {numbered.map((d) => (<li key={d.id} className="flex items-center gap-2 rounded-button bg-surface-muted px-2 py-1.5 text-sm">
              <span className="w-8 shrink-0 font-black text-primary" dir="ltr">#{d.no}</span>
              <span className="min-w-0 flex-1 truncate">{d.label}</span>
              <span className="shrink-0 text-[11px] text-neutral-500" dir="ltr">{dateOf(d.timestamp)}</span>
              <bdi dir="ltr" className="shrink-0 font-bold">{fmt(d.amount)}</bdi>
            </li>))}
        </ol>)}
      <div className="mt-2 flex flex-col gap-1.5">
        {deposits.length > 0 && <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-button bg-primary text-sm font-bold text-white">{w.check}</button>}
      </div>
      {open && <AgentCheckSheet deposits={numbered} onClose={() => setOpen(false)} agent={agent} onTransfer={onTransfer} onCollect={onCollect} markCollected={checks.markCollected} setAlert={setAlert}/>}
    </section>);
}

function AgentCheckSheet({ deposits, onClose, agent, onTransfer, onCollect, markCollected, setAlert }: {
    deposits: Array<AgentDeposit & { no: number }>;
    onClose: () => void;
    agent: ClientDzd;
    onTransfer?: (p: { fromClientId: string; toClientId: string; amount: number; notes?: string }) => Promise<boolean>;
    onCollect: (amount: number, notes: string) => void;
    markCollected: (ids: string[], extra?: Record<string, unknown>) => Promise<void>;
    setAlert?: (m: string) => void;
}) {
    // V27-2 (owner): one screen, the deposits themselves. A bundle that is right: ✓ on its line. A bundle that is not:
    // its amount in the box on top, the app finds its line and writes the gap there. Two lines alike: tap the right one.
    const { lang } = useLanguage();
    const ar = lang === 'ar';
    const T = ar ? {
        hint: 'الربطة صحيحة؟ اضغط ✓ على سطرها. مختلفة؟ اكتب مبلغها هنا:', ok: 'إدخال', paste: 'لصق قائمة كاملة', read: 'اقرأ', cancel: 'إلغاء',
        wait: 'لم تُعدّ', short: 'ناقص', over: 'زائد', debt: 'دَين على العميل', full: 'المبلغ كامل (خطأ كتابة)', onAgent: 'اتركه على الوسيط',
        which: 'المبلغ يطابق أكثر من أمانة. اضغط على السطر الصحيح:', none: 'لا أمانة قريبة من هذا المبلغ', counted: 'عددت', of: 'من', confirm: 'تأكيد التحصيل',
        choose: 'اختر لكل فرق: دَين على العميل أو المبلغ كامل.', undo: 'تراجع', note: (n: number) => `تحصيل ${n} أمانة مفحوصة`,
    } : {
        hint: 'Liasse juste ? ✓ sur sa ligne. Différente ? Tapez son montant ici :', ok: 'Valider', paste: 'Coller une liste complète', read: 'Lire', cancel: 'Annuler',
        wait: 'Pas compté', short: 'manque', over: 'en trop', debt: 'Dette du client', full: 'Montant complet (erreur d’écriture)', onAgent: 'Laisser sur l’intermédiaire',
        which: 'Ce montant correspond à plusieurs dépôts. Touchez la bonne ligne :', none: 'Aucun dépôt proche de ce montant', counted: 'Compté', of: 'sur', confirm: 'Confirmer l’encaissement',
        choose: 'Pour chaque écart : dette du client ou montant complet.', undo: 'Annuler', note: (n: number) => `Encaissement de ${n} dépôt(s) vérifiés`,
    };
    const [counted, setCounted] = useState<Record<string, number>>({});
    const [res, setRes] = useState<Record<string, Resolution>>({});
    const [draft, setDraft] = useState('');
    const [asking, setAsking] = useState<{ amount: number; ids: string[] } | null>(null);
    const [notFound, setNotFound] = useState<number | null>(null);
    const [pasteOpen, setPasteOpen] = useState(false);
    const [pasted, setPasted] = useState('');
    const [saving, setSaving] = useState(false);
    const free = deposits.filter((d) => counted[d.id] === undefined);
    const place = (amount: number) => {
        const m = matchDeposits(free, [amount]).lines[0];
        setNotFound(null); setAsking(null);
        if (m.kind === 'exact' || m.kind === 'near') setCounted((c) => ({ ...c, [m.deposit!.id]: amount }));
        else if (m.kind === 'ambiguous') setAsking({ amount, ids: m.candidates!.map((d) => d.id) });
        else setNotFound(amount);
    };
    const submit = () => { const [v] = parseAmounts(draft); if (v) { place(v); setDraft(''); } };
    const readList = () => {
        // The whole list at once, with the same matching (equal amounts first, then the nearest, never a guess).
        const result = matchDeposits(free, parseAmounts(pasted));
        const next = { ...counted };
        for (const l of result.lines) if ((l.kind === 'exact' || l.kind === 'near') && l.deposit) next[l.deposit.id] = l.counted.amount;
        setCounted(next);
        const left = result.lines.filter((l) => l.kind === 'ambiguous' || l.kind === 'extra');
        if (left[0]?.kind === 'ambiguous') setAsking({ amount: left[0].counted.amount, ids: left[0].candidates!.map((d) => d.id) });
        else if (left[0]) setNotFound(left[0].counted.amount);
        setPasteOpen(false); setPasted('');
    };
    const gap = (d: AgentDeposit) => (counted[d.id] === undefined ? 0 : Math.round((counted[d.id] - d.amount) * 100) / 100);
    const done = deposits.filter((d) => counted[d.id] !== undefined);
    const unresolved = done.filter((d) => gap(d) !== 0 && !res[d.id]);
    const cash = done.reduce((s, d) => s + (res[d.id] === 'paper' ? d.amount : counted[d.id]), 0);
    const due = deposits.reduce((s, d) => s + d.amount, 0);
    const confirm = async () => {
        if (unresolved.length > 0) { setAlert?.(`⚠️ ${T.choose}`); return; }
        setSaving(true);
        try {
            for (const d of done) {
                const g = gap(d);
                if (g === 0 || res[d.id] !== 'client' || !d.clientId || !onTransfer) continue;
                const amount = Math.abs(g);
                const ok = g < 0
                    ? await onTransfer({ fromClientId: agent.id, toClientId: d.clientId, amount, notes: `${T.short} ${fmt(amount)} · #${d.no}` })
                    : await onTransfer({ fromClientId: d.clientId, toClientId: agent.id, amount, notes: `${T.over} ${fmt(amount)} · #${d.no}` });
                if (!ok) throw new Error('transfer refused');
            }
            await markCollected(done.map((d) => d.id), { lastCheckAt: Date.now() });
            onClose();
            onCollect(Math.round(cash * 100) / 100, T.note(done.length));
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };
    const chip = (on: boolean) => `rounded-full border px-2.5 py-1 text-[11px] font-bold ${on ? 'border-primary bg-primary text-white' : 'border-border text-neutral-700'}`;
    return (<BottomSheet isOpen onClose={onClose} title={W[lang].sheet}>
      <div data-testid="agent-check" className="flex flex-col gap-2 px-4 pb-28 pt-1">
        <p className="text-xs text-neutral-600">{T.hint}</p>
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} inputMode="decimal" dir="ltr" placeholder={ar ? "مبلغ الربطة" : "Montant de la liasse"} className="h-12 min-w-0 flex-1 rounded-button border border-border bg-surface px-3 text-lg font-bold"/>
          <button type="button" onClick={submit} className="h-12 shrink-0 rounded-button bg-primary px-4 text-sm font-bold text-white">{T.ok}</button>
        </div>
        <button type="button" onClick={() => setPasteOpen(!pasteOpen)} className="self-start text-xs font-semibold text-primary underline">{T.paste}</button>
        {pasteOpen && (<div className="space-y-2 rounded-button border border-border p-2">
            <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} dir="ltr" className="w-full rounded-button border border-border bg-surface p-2 text-sm"/>
            <button type="button" onClick={readList} className="h-10 w-full rounded-button bg-primary text-sm font-bold text-white">{T.read}</button>
          </div>)}
        {asking && <p role="alert" className="rounded-button bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">{T.which} <bdi dir="ltr">{fmt(asking.amount)}</bdi></p>}
        {notFound !== null && <p role="alert" className="rounded-button bg-financial-loss-bg px-3 py-2 text-xs font-bold text-financial-loss">{T.none}: <bdi dir="ltr">{fmt(notFound)}</bdi></p>}
        <ul className="space-y-1.5">
          {deposits.map((d) => {
            const isDone = counted[d.id] !== undefined;
            const g = gap(d);
            const picked = asking?.ids.includes(d.id);
            return (<li key={d.id} data-testid="agent-line" className={`rounded-button border p-2 ${picked ? 'border-amber-500 bg-amber-50' : isDone ? (g === 0 ? 'border-financial-profit/40 bg-financial-profit-bg' : 'border-financial-debt/40 bg-financial-debt-bg') : 'border-border bg-surface'}`}>
              <div className="flex items-center gap-2" onClick={picked ? () => { setCounted((c) => ({ ...c, [d.id]: asking!.amount })); setAsking(null); } : undefined}>
                <span className="w-8 shrink-0 text-sm font-black text-primary" dir="ltr">#{d.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-900">{d.label}</span>
                  <span className="block text-[11px] text-neutral-500">
                    <bdi dir="ltr">{fmt(d.amount)}</bdi>{isDone && g !== 0 && <> → <bdi dir="ltr" className="font-bold text-neutral-800">{fmt(counted[d.id])}</bdi> · <b className={g < 0 ? 'text-financial-loss' : 'text-financial-profit'}>{g < 0 ? T.short : T.over} <bdi dir="ltr">{fmt(Math.abs(g))}</bdi></b></>}
                  </span>
                </span>
                {isDone
                    ? <button type="button" onClick={() => { const c = { ...counted }; delete c[d.id]; setCounted(c); }} className="shrink-0 text-[11px] text-neutral-500 underline">{T.undo}</button>
                    : !picked && <button type="button" aria-label="✓" onClick={() => setCounted((c) => ({ ...c, [d.id]: d.amount }))} className="flex h-10 w-12 shrink-0 items-center justify-center rounded-button border border-financial-profit/50 text-lg font-black text-financial-profit">✓</button>}
              </div>
              {isDone && g !== 0 && (<div className="mt-1.5 flex flex-wrap gap-1">
                  <button type="button" onClick={() => setRes({ ...res, [d.id]: 'client' })} className={chip(res[d.id] === 'client')}>{T.debt}</button>
                  <button type="button" onClick={() => setRes({ ...res, [d.id]: 'paper' })} className={chip(res[d.id] === 'paper')}>{T.full}</button>
                  <button type="button" onClick={() => setRes({ ...res, [d.id]: 'agent' })} className={chip(res[d.id] === 'agent')}>{T.onAgent}</button>
                </div>)}
            </li>);
          })}
        </ul>
      </div>
      <div className="sticky bottom-0 border-t border-border bg-surface px-4 py-3">
        <div className="mb-2 flex justify-between text-sm font-bold text-neutral-900">
          <span>{T.counted} <bdi dir="ltr">{done.length}</bdi> {T.of} <bdi dir="ltr">{deposits.length}</bdi></span>
          <span>{ar ? 'المبلغ' : 'Montant'} <bdi dir="ltr">{fmt(cash)}</bdi> <span className="font-normal text-neutral-500">{ar ? 'من' : 'sur'}</span> <bdi dir="ltr">{fmt(due)}</bdi></span>
        </div>
        <button type="button" onClick={confirm} disabled={saving || done.length === 0} className="h-12 w-full rounded-button bg-financial-profit text-sm font-bold text-white disabled:opacity-50">{T.confirm}</button>
      </div>
    </BottomSheet>);
}
