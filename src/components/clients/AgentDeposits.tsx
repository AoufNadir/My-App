import { useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { BottomSheet } from '../ui/BottomSheet';
import { useAgentChecks } from '../../hooks/useAgentChecks';
import { matchDeposits, parseAmounts, pendingDeposits, type AgentDeposit, type MatchLine } from '../../utils/agentDeposits';
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

export function AgentDeposits({ agent, rows, allRows, transactions, clients, nameOf, userDocRef, onTransfer, onCollect, setAlert }: {
    agent: ClientDzd;
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
        return pendingDeposits(rows as unknown as Array<{ id: string; montant?: number; timestamp?: number; affectsBalance?: boolean; linkedTxId?: string; notes?: string; type?: string }>, checks.collected, checks.since, (row) => {
            const other = row.linkedTxId ? byId.get(row.linkedTxId) : undefined;
            const sale = row.linkedTxId ? txById.get(row.linkedTxId) : undefined;
            const clientId = (other && other.clientId !== agent.id ? other.clientId : undefined) ?? sale?.linkedClientId;
            return { clientId, label: clientName(clientId) || row.notes || row.type || '—' };
        });
    }, [rows, allRows, transactions, clients, nameOf, agent.id, checks.collected, checks.since]);
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
        {checks.since === 0 && deposits.length > 0 && <button type="button" onClick={() => checks.startFrom(new Date(new Date().setHours(0, 0, 0, 0)).getTime())} className="text-xs font-semibold text-neutral-600 underline">{w.startToday}</button>}
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
    const { lang } = useLanguage();
    const w = W[lang];
    const [mode, setMode] = useState<'count' | 'paste'>('count');
    const [amounts, setAmounts] = useState<number[]>([]);
    const [draft, setDraft] = useState('');
    const [pasted, setPasted] = useState('');
    const [choice, setChoice] = useState<Record<number, Resolution>>({});
    const [pick, setPick] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);
    const result = useMemo(() => matchDeposits(deposits, amounts), [deposits, amounts]);
    const noOf = (d?: AgentDeposit) => deposits.find((x) => x.id === d?.id)?.no;
    const add = () => { const [v] = parseAmounts(draft); if (v) { setAmounts([...amounts, v]); setDraft(''); } };
    const last = result.lines[result.lines.length - 1];
    const needs = result.lines.filter((l) => (l.kind === 'near' || l.kind === 'ambiguous') && !choice[l.counted.index] || (l.kind === 'ambiguous' && choice[l.counted.index] === 'client' && !pick[l.counted.index]));
    const lineDeposit = (l: MatchLine) => (l.kind === 'ambiguous' ? l.candidates!.find((d) => d.id === pick[l.counted.index]) ?? l.candidates![0] : l.deposit);
    const collectTotal = result.lines.reduce((s, l) => s + (choice[l.counted.index] === 'paper' && lineDeposit(l) ? lineDeposit(l)!.amount : l.counted.amount), 0);
    const confirm = async () => {
        if (needs.length > 0) { setAlert?.(`⚠️ ${w.needChoice}`); return; }
        setSaving(true);
        try {
            const collectedIds: string[] = [];
            for (const l of result.lines) {
                const dep = lineDeposit(l);
                if (l.kind === 'extra' || !dep) continue;
                collectedIds.push(dep.id);
                const res = choice[l.counted.index];
                if (l.difference === 0 || res !== 'client' || !dep.clientId || !onTransfer) continue;
                // Short: the gap goes back onto the client (debt); over: the client is credited.
                const gap = Math.abs(l.difference);
                const ok = l.difference < 0
                    ? await onTransfer({ fromClientId: agent.id, toClientId: dep.clientId, amount: gap, notes: `${w.short(fmt(gap))} · #${noOf(dep)}` })
                    : await onTransfer({ fromClientId: dep.clientId, toClientId: agent.id, amount: gap, notes: `${w.over(fmt(gap))} · #${noOf(dep)}` });
                if (!ok) throw new Error('transfer refused');
            }
            await markCollected(collectedIds, { lastCheckAt: Date.now() });
            onClose();
            onCollect(Math.round(collectTotal * 100) / 100, w.note(collectedIds.length));
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };
    const badge = (l: MatchLine) => {
        const map = { exact: ['bg-financial-profit-bg text-financial-profit', '✅ ' + w.exact], near: ['bg-financial-debt-bg text-financial-debt', '⚠️ ' + w.near], ambiguous: ['bg-amber-100 text-amber-900', '❓ ' + w.ambiguous], extra: ['bg-financial-loss-bg text-financial-loss', '➕ ' + w.extra] } as const;
        const [cls, text] = map[l.kind];
        return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{text}</span>;
    };
    const lineView = (l: MatchLine) => {
        const dep = l.kind === 'ambiguous' ? undefined : l.deposit;
        return (<div key={l.counted.index} className="space-y-1.5 rounded-button border border-border bg-surface p-2">
          <div className="flex items-center gap-2 text-sm">
            {badge(l)}
            <span className="min-w-0 flex-1 truncate font-semibold">{dep ? `#${noOf(dep)} ${dep.label}` : l.kind === 'ambiguous' ? l.candidates!.map((d) => `#${noOf(d)} ${d.label}`).join(' / ') : ''}</span>
            <button type="button" onClick={() => setAmounts(amounts.filter((_, i) => i !== l.counted.index))} className="shrink-0 text-[11px] text-neutral-500 underline">{w.remove}</button>
          </div>
          <div className="flex justify-between text-xs text-neutral-700"><span>{w.counted} <bdi dir="ltr" className="font-bold">{fmt(l.counted.amount)}</bdi></span>
            {(dep || l.kind === 'ambiguous') && <span>{w.due} <bdi dir="ltr" className="font-bold">{fmt((dep ?? l.candidates![0]).amount)}</bdi></span>}
            {l.difference !== 0 && l.kind !== 'extra' && <span className={`font-bold ${l.difference < 0 ? 'text-financial-loss' : 'text-financial-profit'}`}>{l.difference < 0 ? w.short(fmt(-l.difference)) : w.over(fmt(l.difference))}</span>}
          </div>
          {l.kind === 'ambiguous' && (<div className="flex flex-wrap gap-1"><span className="text-[11px] font-semibold text-neutral-600">{w.either}</span>
              {l.candidates!.map((d) => (<button key={d.id} type="button" onClick={() => { setPick({ ...pick, [l.counted.index]: d.id }); setChoice({ ...choice, [l.counted.index]: choice[l.counted.index] ?? 'client' }); }} className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${pick[l.counted.index] === d.id ? 'border-primary bg-primary text-white' : 'border-border'}`}>#{noOf(d)} {d.label}</button>))}</div>)}
          {(l.kind === 'near' || l.kind === 'ambiguous') && l.difference !== 0 && (<div className="flex flex-wrap gap-1">
              {(['client', 'agent', 'paper'] as const).map((r) => (<button key={r} type="button" onClick={() => setChoice({ ...choice, [l.counted.index]: r })} className={`rounded-full border px-2 py-1 text-[11px] font-bold ${choice[l.counted.index] === r ? 'border-primary bg-primary text-white' : 'border-border text-neutral-700'}`}>{r === 'client' ? w.toClient : r === 'agent' ? w.toAgent : w.paper}</button>))}
            </div>)}
        </div>);
    };
    return (<BottomSheet isOpen onClose={onClose} title={w.sheet}>
      <div data-testid="agent-check" className="flex flex-col gap-3 px-4 pb-5 pt-2">
        <div className="flex rounded-button bg-surface-muted p-1">
          {(['count', 'paste'] as const).map((m) => (<button key={m} type="button" onClick={() => setMode(m)} className={`h-9 flex-1 rounded-button text-sm font-bold ${mode === m ? 'bg-surface text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>{m === 'count' ? w.countNow : w.paste}</button>))}
        </div>
        {mode === 'count' ? (<div className="space-y-2">
            <div className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} inputMode="decimal" dir="ltr" placeholder={w.amount} autoFocus className="h-12 min-w-0 flex-1 rounded-button border border-border bg-surface px-3 text-lg font-bold"/>
              <button type="button" onClick={add} className="h-12 shrink-0 rounded-button bg-primary px-4 text-sm font-bold text-white">{w.next}</button>
            </div>
            {last && lineView(last)}
          </div>) : (<div className="space-y-2">
            <p className="text-xs text-neutral-600">{w.pasteHint}</p>
            <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} dir="ltr" className="w-full rounded-button border border-border bg-surface p-2 text-sm"/>
            <button type="button" onClick={() => setAmounts(parseAmounts(pasted))} className="h-11 w-full rounded-button bg-primary text-sm font-bold text-white">{w.read}</button>
          </div>)}
        {amounts.length > 0 && (<>
            <div className="flex justify-between rounded-button bg-surface-muted px-3 py-2 text-sm font-bold text-neutral-900">
              <span>{w.counted} <bdi dir="ltr">{fmt(result.countedTotal)}</bdi></span>
              <span>{w.due} <bdi dir="ltr">{fmt(result.dueTotal)}</bdi></span>
            </div>
            <div className="space-y-1.5">{result.lines.map(lineView)}</div>
            {result.missing.length > 0 && (<div className="rounded-button border border-dashed border-border p-2 text-xs text-neutral-600"><p className="font-semibold">{w.missing}</p>
                {result.missing.map((d) => <p key={d.id}>#{deposits.find((x) => x.id === d.id)?.no} {d.label} · <bdi dir="ltr">{fmt(d.amount)}</bdi></p>)}</div>)}
            <p className="text-xs text-neutral-600">{w.confirmHint('')} <bdi dir="ltr" className="font-bold">{fmt(collectTotal)} DZD</bdi></p>
            <button type="button" onClick={confirm} disabled={saving} className="h-12 rounded-button bg-financial-profit text-sm font-bold text-white disabled:opacity-50">{w.confirm}</button>
          </>)}
      </div>
    </BottomSheet>);
}
