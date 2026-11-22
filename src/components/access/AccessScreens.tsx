import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseAuth';
import { db } from '../../firebase';
import { useLanguage } from '../../contexts/LanguageContext';
import { daysLeft, type AccessState } from '../../utils/access';

// V21-1 (owner): what a customer sees before his activation, and the line shown near the end of his subscription.
// The operator's WhatsApp number (app_config/contact, written by him in « Abonnés »): digits with the country code.
export const whatsappDigits = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    return digits.startsWith('0') ? `213${digits.slice(1)}` : digits;
};
export function useOwnerContact() {
    const [whatsapp, setWhatsapp] = useState('');
    useEffect(() => db.collection('app_config').doc('contact').onSnapshot((snap) => {
        setWhatsapp(snap.exists ? String((snap.data() as { whatsapp?: unknown }).whatsapp ?? '') : '');
    }, {}, () => setWhatsapp('')), []);
    return whatsapp;
}

const W = {
    fr: {
        title: 'Votre compte attend son activation',
        text: 'Envoyez votre demande. Après le paiement de l’abonnement, votre compte est activé et vous commencez.',
        name: 'Nom et prénom', phone: 'Téléphone',
        send: 'Envoyer la demande', sending: 'Envoi…',
        sent: 'Demande envoyée. Vous pourrez commencer dès l’activation de votre compte.',
        contact: 'Contacter sur WhatsApp',
        nameNeeded: 'Écrivez votre nom.', error: 'Envoi impossible. Réessayez.',
        logout: 'Se déconnecter',
        expiring: (d: number) => `Votre abonnement se termine dans ${d} jour${d > 1 ? 's' : ''}. Renouvelez-le pour continuer à enregistrer.`,
        expired: 'Votre abonnement est terminé : lecture seule. Vos données restent visibles et vous pouvez prendre une sauvegarde. Renouvelez pour enregistrer à nouveau.',
        readOnly: 'Abonnement terminé : lecture seule. Renouvelez pour enregistrer.',
    },
    ar: {
        title: 'حسابك ينتظر التفعيل',
        text: 'أرسل طلبك. بعد دفع الاشتراك يُفعَّل حسابك وتبدأ العمل.',
        name: 'الاسم واللقب', phone: 'الهاتف',
        send: 'أرسل طلب التفعيل', sending: 'جارٍ الإرسال…',
        sent: 'أُرسل الطلب. تستطيع البدء فور تفعيل حسابك.',
        contact: 'تواصل عبر واتساب',
        nameNeeded: 'اكتب اسمك.', error: 'تعذّر الإرسال. حاول مرة أخرى.',
        logout: 'تسجيل الخروج',
        expiring: (d: number) => `اشتراكك ينتهي بعد ${d} ${d > 1 ? 'أيام' : 'يوم'}. جدّده لتواصل التسجيل.`,
        expired: 'انتهى اشتراكك: قراءة فقط. بياناتك ظاهرة وتستطيع أخذ نسخة احتياطية. جدّد اشتراكك لتسجّل من جديد.',
        readOnly: 'انتهى الاشتراك: قراءة فقط. جدّده لتسجّل.',
    },
};
export const readOnlyMessage = (lang: 'fr' | 'ar') => W[lang].readOnly;

export function PendingActivationScreen({ uid, email, displayName = '' }: { uid: string; email: string; displayName?: string }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const contact = whatsappDigits(useOwnerContact());
    // V22-1: the request is sent as soon as a new account arrives (name from Google or the e-mail), so the operator
    // hears of every sign-up even if the customer never presses the button; the form only completes it.
    useEffect(() => db.collection('access_requests').doc(uid).onSnapshot((snap) => {
        if (snap.exists) { const d = snap.data() as { name?: string; phone?: string }; setName((v) => v || d.name || ''); setPhone((v) => v || d.phone || ''); return; }
        if ((snap as { metadata?: { fromCache?: boolean } }).metadata?.fromCache !== false) return; // only once the server said « none »
        const autoName = (displayName || email.split('@')[0] || 'Nouveau compte').trim().slice(0, 80);
        db.collection('access_requests').doc(uid).set({ name: autoName, phone: '', email: email.slice(0, 120), requestedAt: Date.now() }).catch((e: unknown) => console.error(e));
    }, { includeMetadataChanges: true }), [uid]);
    const send = async () => {
        if (!name.trim()) { setError(w.nameNeeded); return; }
        setError(null); setStatus('sending');
        try {
            await db.collection('access_requests').doc(uid).set({ name: name.trim().slice(0, 80), phone: phone.trim().slice(0, 30), email: email.slice(0, 120), requestedAt: Date.now() });
            setStatus('sent'); setCompleted(true);
        } catch (e) { console.error(e); setError(w.error); setStatus('idle'); }
    };
    const input = 'mt-1 h-12 w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900';
    return (<div data-testid="pending-activation" className="min-h-screen bg-app-bg">
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-black text-neutral-900">{w.title}</h1>
        <p className="text-sm text-neutral-700">{w.text}</p>
        <label className="block"><span className="block text-xs font-semibold text-neutral-700">{w.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input}/></label>
        <label className="block"><span className="block text-xs font-semibold text-neutral-700">{w.phone}</span>
          <input value={phone} inputMode="tel" dir="ltr" onChange={(e) => setPhone(e.target.value)} className={input}/></label>
        {error && <p role="alert" className="text-sm font-semibold text-financial-loss">{error}</p>}
        {completed && <p role="status" className="rounded-card bg-primary/10 px-3 py-3 text-sm font-semibold text-primary">{w.sent}</p>}
        <button type="button" onClick={send} disabled={status === 'sending'} className="h-12 rounded-button bg-primary text-sm font-bold text-white">{status === 'sending' ? w.sending : w.send}</button>
        {contact.length >= 8 && (<a href={`https://wa.me/${contact}`} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center rounded-button border border-border bg-surface text-sm font-bold text-neutral-800">{w.contact}</a>)}
        <button type="button" onClick={() => signOut(auth).catch(() => undefined)} className="mt-auto text-sm font-semibold text-neutral-600 underline">{w.logout}</button>
      </div>
    </div>);
}

export function AccessBanner({ state, until }: { state: AccessState; until: number | null }) {
    const { lang } = useLanguage();
    const w = W[lang];
    if (state !== 'expiring' && state !== 'expired') return null;
    const text = state === 'expired' ? w.expired : w.expiring(daysLeft(until ?? 0, Date.now()));
    return (<div role="status" data-testid="access-banner" className={`relative z-[250] px-4 py-2 text-center text-xs font-semibold ${state === 'expired' ? 'bg-financial-loss text-white' : 'bg-amber-100 text-amber-900'}`}>{text}</div>);
}
