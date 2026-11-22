import { useState } from 'react';
import { db } from '../../firebase';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSubscribers, type AccessRequest, type AccessRow } from '../../hooks/useAccess';
import { useOwnerContact } from './AccessScreens';
import { ACCESS_DURATIONS, daysLeft, extendedUntil, type AccessDurationId } from '../../utils/access';

// V21-1 (owner): the operator activates, extends or stops the accounts of his customers. Writes access/{uid} only
// (the Firestore rules allow it to the operator alone); a customer's own data is never read here.
const W = {
    fr: {
        requests: 'Nouvelles demandes', subscribers: 'Abonnés', none: 'Aucune', noneSubs: 'Aucun abonné',
        durations: { trial: 'Essai 14 j', month: '1 mois', quarter: '3 mois', year: '1 an' } as Record<AccessDurationId, string>,
        activate: 'Activer :', extend: 'Prolonger :', stop: 'Arrêter',
        until: (d: string) => `jusqu’au ${d}`, left: (n: number) => `${n} j restants`, ended: 'Terminé (lecture seule)',
        confirmStop: 'Arrêter cet abonnement maintenant ? Le compte passe en lecture seule.',
        error: 'Enregistrement impossible.',
        contact: 'Votre WhatsApp (affiché aux comptes en attente)', save: 'Enregistrer', saved: 'Enregistré',
    },
    ar: {
        requests: 'طلبات جديدة', subscribers: 'المشتركون', none: 'لا شيء', noneSubs: 'لا مشترك',
        durations: { trial: 'تجربة 14 يوماً', month: 'شهر', quarter: '3 أشهر', year: 'سنة' } as Record<AccessDurationId, string>,
        activate: 'فعّل:', extend: 'مدّد:', stop: 'أوقف',
        until: (d: string) => `حتى ${d}`, left: (n: number) => `باقٍ ${n} يوماً`, ended: 'انتهى (قراءة فقط)',
        confirmStop: 'أوقف هذا الاشتراك الآن؟ يصير الحساب قراءة فقط.',
        error: 'تعذّر الحفظ.',
        contact: 'رقم واتساب الخاص بك (يظهر للحسابات المنتظرة)', save: 'احفظ', saved: 'حُفظ',
    },
};

const dateText = (ms: number) => new Date(ms).toLocaleDateString('fr-FR');

export function SubscribersSettings() {
    const { lang } = useLanguage();
    const w = W[lang];
    const { requests, subscribers } = useSubscribers(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const savedContact = useOwnerContact();
    const [contact, setContact] = useState<string | null>(null);
    const [contactSaved, setContactSaved] = useState(false);
    const saveContact = () => write('contact', async () => {
        await db.collection('app_config').doc('contact').set({ whatsapp: (contact ?? savedContact).replace(/[^\d+ ]/g, '').trim().slice(0, 20) });
        setContactSaved(true);
    });
    const now = Date.now();
    const write = async (uid: string, run: () => Promise<unknown>) => {
        setBusy(uid); setError(null);
        try { await run(); } catch (e) { console.error(e); setError(w.error); } finally { setBusy(null); }
    };
    const activate = (r: AccessRequest, days: number) => write(r.uid, async () => {
        const batch = db.batch();
        batch.set(db.collection('access').doc(r.uid), { until: extendedUntil(null, days, now), name: r.name, phone: r.phone, email: r.email, activatedAt: now });
        batch.delete(db.collection('access_requests').doc(r.uid));
        await batch.commit();
    });
    const extend = (s: AccessRow, days: number) => write(s.uid, () => db.collection('access').doc(s.uid).set({ until: extendedUntil(s.until, days, now) }, { merge: true }));
    const stop = (s: AccessRow) => { if (window.confirm(w.confirmStop)) void write(s.uid, () => db.collection('access').doc(s.uid).set({ until: now }, { merge: true })); };
    const chip = 'h-9 rounded-button border border-border bg-surface px-3 text-xs font-bold text-neutral-800 disabled:opacity-50';
    const durations = (onPick: (days: number) => void, uid: string) => (<div className="flex flex-wrap gap-1.5">
        {ACCESS_DURATIONS.map((d) => (<button key={d.id} type="button" disabled={busy === uid} onClick={() => onPick(d.days)} className={chip}>{w.durations[d.id]}</button>))}
      </div>);
    return (<div data-testid="subscribers" className="space-y-4">
      {error && <p role="alert" className="text-xs font-semibold text-financial-loss">{error}</p>}
      <section className="space-y-2">
        <label className="block"><span className="block text-xs font-semibold text-neutral-700">{w.contact}</span>
          <div className="mt-1 flex gap-2">
            <input value={contact ?? savedContact} inputMode="tel" dir="ltr" placeholder="0555 00 00 00" onChange={(e) => { setContact(e.target.value); setContactSaved(false); }} className="h-11 min-w-0 flex-1 rounded-button border border-border bg-surface px-3 text-sm text-neutral-900"/>
            <button type="button" disabled={busy === 'contact'} onClick={saveContact} className="h-11 shrink-0 rounded-button bg-primary px-4 text-sm font-bold text-white disabled:opacity-50">{contactSaved ? w.saved : w.save}</button>
          </div>
        </label>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-neutral-900">{w.requests} · {requests.length}</h3>
        {requests.length === 0 && <p className="text-xs text-neutral-600">{w.none}</p>}
        {requests.map((r) => (<div key={r.uid} className="space-y-2 rounded-card border border-primary/40 bg-surface p-3">
            <div className="text-sm font-bold text-neutral-900">{r.name}</div>
            <div className="text-xs text-neutral-600" dir="ltr">{[r.phone, r.email].filter(Boolean).join(' · ')}</div>
            <div className="text-xs text-neutral-500">{r.requestedAt ? dateText(r.requestedAt) : ''}</div>
            <div className="text-xs font-semibold text-neutral-700">{w.activate}</div>
            {durations((days) => activate(r, days), r.uid)}
          </div>))}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-neutral-900">{w.subscribers} · {subscribers.length}</h3>
        {subscribers.length === 0 && <p className="text-xs text-neutral-600">{w.noneSubs}</p>}
        {subscribers.map((s) => {
            const ended = s.until <= now;
            return (<div key={s.uid} className="space-y-2 rounded-card border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-neutral-900">{s.name || s.email || s.uid}</div>
                  <div className="text-xs text-neutral-600" dir="ltr">{[s.phone, s.email].filter(Boolean).join(' · ')}</div>
                </div>
                <div className={`shrink-0 text-end text-xs font-semibold ${ended ? 'text-financial-loss' : 'text-neutral-700'}`}>
                  {ended ? w.ended : (<>{w.until(dateText(s.until))}<br/>{w.left(daysLeft(s.until, now))}</>)}
                </div>
              </div>
              <div className="text-xs font-semibold text-neutral-700">{w.extend}</div>
              {durations((days) => extend(s, days), s.uid)}
              {!ended && (<button type="button" disabled={busy === s.uid} onClick={() => stop(s)} className="text-xs font-semibold text-financial-loss underline">{w.stop}</button>)}
            </div>);
        })}
      </section>
    </div>);
}
