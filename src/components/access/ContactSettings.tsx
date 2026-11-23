import { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { formatWaNumber } from '../../utils/whatsapp';
import { useLanguage } from '../../contexts/LanguageContext';

// V25-3 (owner): « Contact avec les clients » — where a waiting account reaches the owner: a WhatsApp number and/or a
// Telegram username, kept in app_config/contact (every signed-in account reads it, the operator alone writes it).
export type OwnerContact = { whatsapp: string; telegram: string };

/** Digits with the country code (0555… → 213555…). */
export const whatsappDigits = (raw: string): string => formatWaNumber(raw);
/** A Telegram username without « @ » nor a link (5–32 letters, digits, « _ »), or '' when not valid. */
export const telegramName = (raw: string): string => {
    const name = raw.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '');
    if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(name)) return name;
    // V25-5: a phone number works too (t.me/+447…): stored as « +digits ».
    if (/^[+0\d][\d\s().-]{6,}$/.test(name)) { const digits = formatWaNumber(name); return digits.length >= 8 ? `+${digits}` : ''; }
    return '';
};
export function whatsappLink(contact: OwnerContact, message: string): string | null {
    const digits = whatsappDigits(contact.whatsapp);
    return digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}
export function telegramLink(contact: OwnerContact): string | null {
    const name = telegramName(contact.telegram);
    return name ? `https://t.me/${name}` : null;
}
export const hasContact = (contact: OwnerContact): boolean => Boolean(whatsappLink(contact, '') || telegramLink(contact));

export function useOwnerContact(): OwnerContact & { loaded: boolean } {
    const [state, setState] = useState<OwnerContact & { loaded: boolean }>({ whatsapp: '', telegram: '', loaded: false });
    useEffect(() => db.collection('app_config').doc('contact').onSnapshot((snap) => {
        const data = (snap.exists ? snap.data() : {}) as { whatsapp?: unknown; telegram?: unknown };
        setState({ whatsapp: String(data.whatsapp ?? ''), telegram: String(data.telegram ?? ''), loaded: true });
    }, {}, () => setState({ whatsapp: '', telegram: '', loaded: true })), []);
    return state;
}

const W = {
    fr: {
        intro: 'Les comptes qui attendent leur activation voient ces boutons pour vous joindre. Un des deux suffit.',
        whatsapp: 'Votre numéro WhatsApp', telegram: 'Telegram : nom d’utilisateur ou numéro',
        save: 'Enregistrer', saved: 'Enregistré', error: 'Enregistrement impossible.',
        badTelegram: 'Telegram invalide : un nom (5 à 32 lettres, chiffres ou « _ ») ou un numéro.',
        none: 'Aucun contact enregistré : les comptes en attente ne voient pas comment vous joindre.',
        preview: 'Ce que voit le client', waBtn: 'Contacter sur WhatsApp', tgBtn: 'Contacter sur Telegram',
    },
    ar: {
        intro: 'تظهر هذه الأزرار للحسابات التي تنتظر التفعيل لتتواصل معك. يكفي واحد منهما.',
        whatsapp: 'رقم واتساب الخاص بك', telegram: 'تلغرام: اسم المستخدم أو الرقم',
        save: 'احفظ', saved: 'حُفظ', error: 'تعذّر الحفظ.',
        badTelegram: 'تلغرام غير صالح: اسم (من 5 إلى 32 حرفاً أو رقماً أو «_») أو رقم هاتف.',
        none: 'لم تحفظ أي وسيلة تواصل: الحسابات المنتظرة لا ترى كيف تتواصل معك.',
        preview: 'ما يراه الزبون', waBtn: 'تواصل عبر واتساب', tgBtn: 'تواصل عبر تلغرام',
    },
};

export function ContactSettings() {
    const { lang } = useLanguage();
    const w = W[lang];
    const saved = useOwnerContact();
    const [draft, setDraft] = useState<OwnerContact | null>(null);
    const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const form = draft ?? saved;
    const tgInvalid = form.telegram.trim() !== '' && !telegramName(form.telegram);
    const save = async () => {
        if (tgInvalid) return;
        setState('saving');
        try {
            await db.collection('app_config').doc('contact').set({
                whatsapp: form.whatsapp.replace(/[^\d+ ]/g, '').trim().slice(0, 20),
                telegram: telegramName(form.telegram),
            });
            setDraft(null); setState('saved');
        } catch (e) { console.error(e); setState('error'); }
    };
    const input = 'mt-1 h-11 w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900';
    const preview = { whatsapp: form.whatsapp, telegram: form.telegram };
    return (<div data-testid="contact-settings" className="space-y-3">
      <p className="text-xs text-neutral-600">{w.intro}</p>
      {saved.loaded && !hasContact(saved) && (<p role="alert" className="rounded-button bg-financial-debt-bg px-3 py-2 text-xs font-semibold text-financial-debt">{w.none}</p>)}
      <label className="block"><span className="block text-xs font-semibold text-neutral-700">{w.whatsapp}</span>
        <input value={form.whatsapp} inputMode="tel" dir="ltr" placeholder="0555 00 00 00 / +44 7…" onChange={(e) => { setDraft({ ...form, whatsapp: e.target.value }); setState('idle'); }} className={input}/></label>
      <label className="block"><span className="block text-xs font-semibold text-neutral-700">{w.telegram}</span>
        <input value={form.telegram} dir="ltr" placeholder="@nom_utilisateur / +44 7…" autoCapitalize="none" onChange={(e) => { setDraft({ ...form, telegram: e.target.value }); setState('idle'); }} className={input}/></label>
      {tgInvalid && <p role="alert" className="text-xs font-semibold text-financial-loss">{w.badTelegram}</p>}
      {state === 'error' && <p role="alert" className="text-xs font-semibold text-financial-loss">{w.error}</p>}
      <button type="button" disabled={state === 'saving' || tgInvalid || !draft} onClick={save} className="h-11 w-full rounded-button bg-primary text-sm font-bold text-white disabled:opacity-50">{state === 'saved' && !draft ? w.saved : w.save}</button>
      {hasContact(preview) && (<div className="space-y-2 rounded-card border border-dashed border-border p-3">
          <p className="text-xs font-semibold text-neutral-500">{w.preview}</p>
          {whatsappLink(preview, '') && <span className="flex h-11 items-center justify-center rounded-button border border-[#25D366]/40 bg-[#25D366]/10 text-sm font-bold text-neutral-800">{w.waBtn}</span>}
          {telegramLink(preview) && <span className="flex h-11 items-center justify-center rounded-button border border-[#229ED9]/40 bg-[#229ED9]/10 text-sm font-bold text-neutral-800">{w.tgBtn}</span>}
        </div>)}
    </div>);
}
