import { useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { BottomSheet } from '../ui/BottomSheet';
import { useAgentChecks } from '../../hooks/useAgentChecks';
import { matchDeposits, outstandingOnly, parseAmounts, pendingDeposits, type AgentDeposit, type MatchLine } from '../../utils/agentDeposits';
import type { ClientDzd, ClientTransactionDzd } from '../../types';
import { openWhatsAppChooser, openWhatsAppMessenger } from '../../utils/whatsapp';

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
    onCollect: (amount: number, notes: string) => Promise<boolean>;
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
    // V27-4: a deposit marked collected that is newer than one still listed: marks written by a check whose collect was
    // not saved (before V27-4). The owner can rebuild the list from the balance.
    const oldestListed = deposits.length ? Math.min(...deposits.map((d) => d.timestamp)) : Infinity;
    const marksLookWrong = rows.some((r) => checks.collected.has(r.id) && Number(r.timestamp) > oldestListed && Number(r.montant) < 0);
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
      {/* V27-4: a list larger than what he owes means wrong « collected » marks (a check confirmed without its collect,
          before V27-4): they can be cleared, and the list is rebuilt from his balance alone. */}
      {deposits.length > 0 && marksLookWrong && (<div role="alert" className="mt-2 rounded-button bg-financial-debt-bg px-3 py-2 text-xs text-financial-debt">
          <p className="font-bold">{lang === 'ar' ? 'أمانات معلّمة «محصّلة» دون تحصيل مسجّل. القائمة قد لا تكون صحيحة.' : 'Des dépôts sont marqués encaissés sans encaissement enregistré : la liste peut être fausse.'}</p>
          <button type="button" onClick={() => checks.resetMarks()} className="mt-1 font-bold underline">{lang === 'ar' ? 'أعد الضبط من رصيده' : 'Recalculer depuis son solde'}</button>
        </div>)}
      <div className="mt-2 flex flex-col gap-1.5">
        {deposits.length > 0 && <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-button bg-primary text-sm font-bold text-white">{w.check}</button>}
      </div>
      {open && <AgentCheckSheet clients={clients} nameOf={nameOf} deposits={numbered} onClose={() => setOpen(false)} agent={agent} onTransfer={onTransfer} onCollect={onCollect} markCollected={checks.markCollected} setAlert={setAlert}/>}
    </section>);
}

function AgentCheckSheet({ clients, nameOf, deposits, onClose, agent, onTransfer, onCollect, markCollected, setAlert }: {
    clients: ReadonlyArray<ClientDzd>;
    nameOf: (c: ClientDzd) => string;
    deposits: Array<AgentDeposit & { no: number }>;
    onClose: () => void;
    agent: ClientDzd;
    onTransfer?: (p: { fromClientId: string; toClientId: string; amount: number; notes?: string }) => Promise<boolean>;
    onCollect: (amount: number, notes: string) => Promise<boolean>;
    markCollected: (ids: string[], extra?: Record<string, unknown>) => Promise<void>;
    setAlert?: (m: string) => void;
}) {
    // V27-2 (owner): one screen, the deposits themselves. A bundle that is right: ✓ on its line. A bundle that is not:
    // its amount in the box on top, the app finds its line and writes the gap there. Two lines alike: tap the right one.
    const { lang } = useLanguage();
    const ar = lang === 'ar';
    const T = ar ? {
        hint: 'اضغط ✓ على أمانة الربطة. أو اكتب مبلغها هنا ثم ✓:', ok: 'إدخال', paste: 'لصق قائمة كاملة', read: 'اقرأ', cancel: 'إلغاء',
        wait: 'لم تُعدّ', short: 'ناقص', over: 'زائد', debt: 'دَين عليه', full: 'المبلغ كامل', onAgent: 'على الوسيط',
        which: 'المبلغ يطابق أكثر من أمانة. اضغط على السطر الصحيح:', none: 'لا أمانة قريبة من هذا المبلغ', counted: 'عددت', of: 'من', confirm: 'تأكيد التحصيل',
        choose: 'اختر لكل فرق: دَين عليه، أو المبلغ كامل، أو على الوسيط.', undo: 'تراجع', pick: 'اضغط ✓ على السطر الصحيح.', doneTitle: 'انتهى الفحص', noGap: 'كل الأمانات مطابقة.', gapsTitle: 'العملاء الذين فيهم فرق', message: 'أرسل رسالة', collect: (n: string) => `تحصيل ${n} نقداً`, note: (n: number) => `تحصيل ${n} أمانة مفحوصة`,
    } : {
        hint: '✓ sur le dépôt de la liasse. Ou tapez son montant ici, puis ✓ :', ok: 'Valider', paste: 'Coller une liste complète', read: 'Lire', cancel: 'Annuler',
        wait: 'Pas compté', short: 'manque', over: 'en trop', debt: 'Sa dette', full: 'Montant complet', onAgent: 'Sur l’intermédiaire',
        which: 'Ce montant correspond à plusieurs dépôts. Touchez la bonne ligne :', none: 'Aucun dépôt proche de ce montant', counted: 'Compté', of: 'sur', confirm: 'Confirmer l’encaissement',
        choose: 'Pour chaque écart : sa dette, montant complet ou sur l’intermédiaire.', undo: 'Annuler', pick: 'Touchez ✓ sur la bonne ligne.', doneTitle: 'Vérification terminée', noGap: 'Tous les dépôts sont justes.', gapsTitle: 'Clients avec un écart', message: 'Envoyer un message', collect: (n: string) => `Encaisser ${n} en espèces`, note: (n: number) => `Encaissement de ${n} dépôt(s) vérifiés`,
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
    // V27-3: while an amount is typed, only the deposits it can be are shown (the nearest first).
    const typed = parseAmounts(draft)[0] ?? 0;
    const near = (d: AgentDeposit) => Math.abs(typed - d.amount) <= Math.max(d.amount * 0.05, 1000);
    const shown = typed > 0 ? free.filter(near).sort((a, b) => Math.abs(typed - a.amount) - Math.abs(typed - b.amount)) : deposits;
    const [summary, setSummary] = useState<{ cash: number; count: number; gaps: Array<{ d: AgentDeposit & { no: number }; gap: number; counted: number }> } | null>(null);
    const place = (amount: number) => {
        const m = matchDeposits(free, [amount]).lines[0];
        setNotFound(null); setAsking(null);
        if (m.kind === 'exact' || m.kind === 'near') setCounted((c) => ({ ...c, [m.deposit!.id]: amount }));
        else if (m.kind === 'ambiguous') setAsking({ amount, ids: m.candidates!.map((d) => d.id) });
        else setNotFound(amount);
    };
    const submit = () => {
        if (!typed) return;
        const m = matchDeposits(free, [typed]).lines[0];
        if (m.kind === 'ambiguous') { setAsking({ amount: typed, ids: m.candidates!.map((d) => d.id) }); return; } // stays filtered: tap the right line
        place(typed); setDraft('');
    };
    const tick = (d: AgentDeposit) => { setCounted((c) => ({ ...c, [d.id]: typed > 0 ? typed : d.amount })); setDraft(''); setAsking(null); setNotFound(null); };
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
            // V27-4: the cash collect is written here too: no « Nouvelle opération » window after.
            const total = Math.round(cash * 100) / 100;
            if (total > 0 && !(await onCollect(total, T.note(done.length)))) throw new Error('collect refused');
            await markCollected(done.map((d) => d.id), { lastCheckAt: Date.now() });
            const gaps = done.filter((d) => gap(d) !== 0 && res[d.id] === 'client');
            const doneText = ar ? `✅ حُصّل ${fmt(total)} DZD نقداً في الصندوق.` : `✅ ${fmt(total)} DZD encaissés en espèces dans la Caisse.`;
            if (gaps.length === 0) { setAlert?.(doneText); onClose(); return; }
            setAlert?.(doneText);
            setSummary({ cash: Math.round(cash * 100) / 100, count: done.length, gaps: done.filter((d) => gap(d) !== 0 && res[d.id] === 'client').map((d) => ({ d, gap: gap(d), counted: counted[d.id] })) });
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };
    if (summary) {
        const message = (g: { d: AgentDeposit; gap: number; counted: number }) => {
            const c = clients.find((x) => x.id === g.d.clientId);
            const name = c ? nameOf(c) : g.d.label;
            const date = new Date(g.d.timestamp).toLocaleDateString('fr-FR');
            const a = (v: number) => `${fmt(v)} DZD`;
            return ar
                ? (g.gap < 0
                    ? `السلام عليكم ${name}،\n\nاستلمنا دفعتكم بتاريخ ${date}: ${a(g.counted)} بدل ${a(g.d.amount)}.\nالباقي عليكم: *${a(-g.gap)}*.\n\nمع خالص التحية،\nProDigital`
                    : `السلام عليكم ${name}،\n\nاستلمنا دفعتكم بتاريخ ${date}: ${a(g.counted)} بدل ${a(g.d.amount)}.\nالزيادة *${a(g.gap)}* سُجّلت لكم رصيداً عندنا.\n\nمع خالص التحية،\nProDigital`)
                : (g.gap < 0
                    ? `Bonjour ${name},\n\nNous avons reçu votre paiement du ${date} : ${a(g.counted)} au lieu de ${a(g.d.amount)}.\nIl reste à régler : *${a(-g.gap)}*.\n\nCordialement,\nProDigital`
                    : `Bonjour ${name},\n\nNous avons reçu votre paiement du ${date} : ${a(g.counted)} au lieu de ${a(g.d.amount)}.\nLe surplus de *${a(g.gap)}* est porté à votre crédit.\n\nCordialement,\nProDigital`);
        };
        const send = (g: { d: AgentDeposit; gap: number; counted: number }) => {
            const phone = clients.find((x) => x.id === g.d.clientId)?.phone;
            if (phone) openWhatsAppMessenger(phone, message(g)); else openWhatsAppChooser(message(g));
        };
        return (<BottomSheet isOpen onClose={onClose} title={T.doneTitle}>
          <div data-testid="agent-summary" className="flex flex-col gap-3 px-4 pb-5 pt-1">
            {summary.gaps.length > 0 && (<>
              <h3 className="text-sm font-bold text-neutral-900">{T.gapsTitle} · <bdi dir="ltr">{summary.gaps.length}</bdi></h3>
              <ul className="space-y-1.5">{summary.gaps.map((g) => (<li key={g.d.id} className="flex items-center gap-2 rounded-button border border-border bg-surface p-2">
                  <span className="w-8 shrink-0 text-sm font-black text-primary" dir="ltr">#{g.d.no}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{g.d.label}</span>
                    <b className={`text-xs ${g.gap < 0 ? 'text-financial-loss' : 'text-financial-profit'}`}>{g.gap < 0 ? T.short : T.over} <bdi dir="ltr">{fmt(Math.abs(g.gap))}</bdi></b></span>
                  <button type="button" onClick={() => send(g)} className="h-10 shrink-0 rounded-button border border-[#25D366]/50 bg-[#25D366]/10 px-3 text-xs font-bold text-neutral-800">{T.message}</button>
                </li>))}</ul>
            </>)}
            <p className="rounded-button bg-financial-profit-bg px-3 py-2 text-xs font-bold text-financial-profit">✅ {ar ? 'حُصّل' : 'Encaissé'} <bdi dir="ltr">{fmt(summary.cash)} DZD</bdi> {ar ? 'نقداً في الصندوق.' : 'en espèces (Caisse).'}</p>
            <button type="button" onClick={onClose} className="h-12 rounded-button bg-primary text-sm font-bold text-white">{ar ? 'إنهاء' : 'Terminer'}</button>
          </div>
        </BottomSheet>);
    }
    // V27-5 (owner): the box is at the bottom, right above the phone's keyboard; the lines it can be stay visible above
    // it. A line that matches what is typed is lit (pulsing frame) with a big « Confirm » and both amounts side by side.
    const inputRow = (<div className="flex gap-2">
        <input value={draft} onChange={(e) => { setDraft(e.target.value); setAsking(null); setNotFound(null); }} onKeyDown={(e) => { if (e.key === 'Enter' && shown.length === 1 && typed > 0) tick(shown[0]); }} enterKeyHint="done" inputMode="decimal" dir="ltr" placeholder={ar ? 'اكتب مبلغ الربطة' : 'Montant de la liasse'} className="h-12 min-w-0 flex-1 rounded-button border-2 border-primary/40 bg-surface px-3 text-lg font-bold focus:border-primary focus:outline-none"/>
        {typed > 0 && <button type="button" aria-label={ar ? 'مسح' : 'Effacer'} onClick={() => setDraft('')} className="h-12 w-12 shrink-0 rounded-button border border-border text-lg text-neutral-500">×</button>}
      </div>);
    return (<BottomSheet isOpen onClose={onClose} title={W[lang].sheet}>
      <div data-testid="agent-check" className="flex flex-col gap-2 px-4 pb-44 pt-1">
        {typed === 0 && (<div className="flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-600">{ar ? 'اضغط ✓ على أمانة الربطة، أو اكتب مبلغها في الأسفل.' : '✓ sur le dépôt de la liasse, ou tapez son montant en bas.'}</p>
            <button type="button" onClick={() => setPasteOpen(!pasteOpen)} className="shrink-0 text-xs font-semibold text-primary underline">{T.paste}</button>
          </div>)}
        {pasteOpen && typed === 0 && (<div className="space-y-2 rounded-button border border-border p-2">
            <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} dir="ltr" className="w-full rounded-button border border-border bg-surface p-2 text-sm"/>
            <button type="button" onClick={readList} className="h-10 w-full rounded-button bg-primary text-sm font-bold text-white">{T.read}</button>
          </div>)}
        {typed > 0 && shown.length > 1 && <p role="status" className="rounded-button bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">{T.which} {T.pick}</p>}
        <ul className="space-y-1.5">
          {typed > 0 && shown.length === 0 && <li className="rounded-button bg-financial-loss-bg px-3 py-3 text-sm font-bold text-financial-loss">{T.none}: <bdi dir="ltr">{fmt(typed)}</bdi></li>}
          {shown.map((d) => {
            const isDone = counted[d.id] !== undefined;
            const g = gap(d);
            const candidate = typed > 0 && !isDone;
            const preview = candidate ? Math.round((typed - d.amount) * 100) / 100 : 0;
            return (<li key={d.id} data-testid="agent-line" className={`rounded-button border p-2 transition-colors ${candidate ? 'animate-[pulse_1.6s_ease-in-out_infinite] border-2 border-primary bg-primary/5 shadow-card' : isDone ? (g === 0 ? 'border-financial-profit/40 bg-financial-profit-bg' : 'border-financial-debt/40 bg-financial-debt-bg') : 'border-border bg-surface'}`}>
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-sm font-black text-primary" dir="ltr">#{d.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-900">{d.label}</span>
                  {candidate ? (<span className="mt-0.5 grid grid-cols-3 gap-1 text-[11px]">
                      <span><span className="block text-neutral-500">{ar ? 'المسجّل' : 'Attendu'}</span><bdi dir="ltr" className="font-bold text-neutral-800">{fmt(d.amount)}</bdi></span>
                      <span><span className="block text-neutral-500">{ar ? 'المعدود' : 'Compté'}</span><bdi dir="ltr" className="font-bold text-neutral-800">{fmt(typed)}</bdi></span>
                      <span><span className="block text-neutral-500">{ar ? 'الفرق' : 'Écart'}</span>{preview === 0 ? <b className="text-financial-profit">{ar ? 'مطابق' : 'Juste'}</b> : <b className={preview < 0 ? 'text-financial-loss' : 'text-financial-profit'}>{preview < 0 ? T.short : T.over} <bdi dir="ltr">{fmt(Math.abs(preview))}</bdi></b>}</span>
                    </span>) : (<span className="block text-[11px] text-neutral-500">
                      <bdi dir="ltr">{fmt(d.amount)}</bdi>{isDone && g !== 0 && <> → <bdi dir="ltr" className="font-bold text-neutral-800">{fmt(counted[d.id])}</bdi> · <b className={g < 0 ? 'text-financial-loss' : 'text-financial-profit'}>{g < 0 ? T.short : T.over} <bdi dir="ltr">{fmt(Math.abs(g))}</bdi></b></>}
                    </span>)}
                </span>
                {isDone
                    ? <button type="button" onClick={() => { const c = { ...counted }; delete c[d.id]; setCounted(c); }} className="shrink-0 text-[11px] text-neutral-500 underline">{T.undo}</button>
                    : candidate
                        ? <button type="button" aria-label="✓" onClick={() => tick(d)} className="flex h-12 shrink-0 items-center justify-center gap-1 rounded-button bg-primary px-3 text-sm font-black text-white shadow-card">✓ {ar ? 'أكّد' : 'OK'}</button>
                        : <button type="button" aria-label="✓" onClick={() => tick(d)} className="flex h-10 w-12 shrink-0 items-center justify-center rounded-button border border-financial-profit/50 text-lg font-black text-financial-profit">✓</button>}
              </div>
              {isDone && g !== 0 && (<div className="mt-2 border-t border-black/5 pt-2">
                  <p className="mb-1.5 text-[11px] font-semibold text-neutral-600">{ar ? `الفرق ${fmt(Math.abs(g))}: على من؟` : `Écart de ${fmt(Math.abs(g))} : sur qui ?`}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([['client', T.debt], ['paper', T.full], ['agent', T.onAgent]] as const).map(([key, text]) => (<button key={key} type="button" onClick={() => setRes({ ...res, [d.id]: key })} className={`flex min-h-10 items-center justify-center rounded-button border px-1 text-center text-xs font-bold leading-tight ${res[d.id] === key ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-neutral-700'}`}>{text}</button>))}
                  </div>
                </div>)}
            </li>);
          })}
        </ul>
      </div>
      <div className="sticky bottom-0 space-y-2 border-t border-border bg-surface px-4 py-3">
        {inputRow}
        {typed === 0 && (<>
          <div className="flex justify-between text-sm font-bold text-neutral-900">
            <span>{T.counted} <bdi dir="ltr">{done.length}</bdi> {T.of} <bdi dir="ltr">{deposits.length}</bdi></span>
            <span>{ar ? 'المبلغ' : 'Montant'} <bdi dir="ltr">{fmt(cash)}</bdi> <span className="font-normal text-neutral-500">{ar ? 'من' : 'sur'}</span> <bdi dir="ltr">{fmt(due)}</bdi></span>
          </div>
          <button type="button" onClick={confirm} disabled={saving || done.length === 0} className="h-12 w-full rounded-button bg-financial-profit text-sm font-bold text-white disabled:opacity-50">{T.confirm}</button>
        </>)}
      </div>
    </BottomSheet>);
}
