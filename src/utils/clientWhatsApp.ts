import { formatDate, formatDzdCents } from '../components/reports/reportFormat';
import { clientReportLanguageKey, savedReportLanguage } from '../components/reports/reportLanguage';
import type { ReportSheetLang } from '../components/reports/ReportSheet';
import { formatWaNumber, openWhatsAppChooser, openWhatsAppMessenger } from './whatsapp';

/**
 * The WhatsApp message to a client: a warm greeting first, then the state of their account in a
 * gentle tone (a friendly reminder when they owe, a plain note when the balance is theirs or
 * settled). It says only the client's own balance. It is written in the language remembered for
 * that client (the one of their reports), the app's language until one was chosen.
 */

type BalanceKind = 'owes' | 'credit' | 'zero';
type Words = {
    hello: (name: string, hour: number) => string;
    wish: string;
    intro: Record<BalanceKind, (date: string) => string>;
    /** The amount line: none when the account is settled */
    amountLine: { owes: (amount: string) => string; credit: (amount: string) => string };
    outro: Record<BalanceKind, string>;
    thanks: string;
};

const AR: Words = {
    hello: (name) => `السلام عليكم ${name} 🌹`,
    wish: 'نتمنى أن تكونوا بأفضل حال.',
    intro: {
        owes: (date) => `تذكير لطيف بحسابكم لدينا بتاريخ ${date}:`,
        credit: (date) => `للعلم، حسابكم لدينا بتاريخ ${date} في صالحكم:`,
        zero: (date) => `حسابكم لدينا مسوّى بتاريخ ${date}، ولا شيء مستحق.`,
    },
    amountLine: {
        owes: (amount) => `المبلغ المتبقي في ذمتكم: ${amount} DZD`,
        credit: (amount) => `الرصيد المتوفر لكم: ${amount} DZD`,
    },
    outro: {
        owes: 'يمكنكم تسويته في الوقت المناسب لكم، ونبقى في خدمتكم دائماً.',
        credit: 'نبقى في خدمتكم متى شئتم.',
        zero: 'نبقى في خدمتكم متى شئتم.',
    },
    thanks: 'شكراً لثقتكم 🙏',
};
const FR: Words = {
    hello: (name, hour) => `${hour >= 18 ? 'Bonsoir' : 'Bonjour'} ${name} 🌹`,
    wish: "J'espère que vous allez bien.",
    intro: {
        owes: (date) => `Petit rappel amical concernant votre compte chez nous au ${date} :`,
        credit: (date) => `Pour information, votre compte chez nous au ${date} est en votre faveur :`,
        zero: (date) => `Votre compte chez nous est à jour au ${date} : rien à régler.`,
    },
    amountLine: {
        owes: (amount) => `Solde restant à régler : ${amount} DZD`,
        credit: (amount) => `Solde disponible pour vous : ${amount} DZD`,
    },
    outro: {
        owes: 'Vous pouvez le régulariser quand cela vous convient, nous restons à votre disposition.',
        credit: 'Nous restons à votre disposition.',
        zero: 'Nous restons à votre disposition.',
    },
    thanks: 'Merci pour votre confiance 🙏',
};
const WORDS: Record<ReportSheetLang, Words> = { ar: AR, fr: FR };

export type ClientWhatsAppInput = {
    name: string;
    /** The client's balance: negative = the client owes us, positive = it is theirs (same as the app) */
    balance: number;
    lang: ReportSheetLang;
    now?: Date;
};

export function clientWhatsAppMessage({ name, balance, lang, now = new Date() }: ClientWhatsAppInput): string {
    const w = WORDS[lang];
    // Cents, like the balance shown everywhere: a dust of 0.004 DZD is a settled account.
    const cents = Math.round((Number.isFinite(balance) ? balance : 0) * 100);
    const kind: BalanceKind = cents < 0 ? 'owes' : cents > 0 ? 'credit' : 'zero';
    const lines = [w.hello(name.trim(), now.getHours()), w.wish, '', w.intro[kind](formatDate(now.getTime()))];
    if (kind !== 'zero') lines.push(w.amountLine[kind](formatDzdCents(cents, true)));
    lines.push('', w.outro[kind], w.thanks);
    return lines.join('\n');
}

export type ClientWhatsAppTarget = {
    clientId: string;
    name: string;
    balance: number;
    /** The app's language: the message's language until the client has a remembered one */
    appLang: string;
};

/** The message for this client, in the language they read. */
export function clientWhatsAppMessageFor(target: ClientWhatsAppTarget, now?: Date): string {
    const lang = savedReportLanguage(clientReportLanguageKey(target.clientId)) ?? (target.appLang === 'ar' ? 'ar' : 'fr');
    return clientWhatsAppMessage({ name: target.name, balance: target.balance, lang, now });
}

/**
 * Opens the client's chat with the message ready. A client without a usable phone number gets
 * WhatsApp's contact chooser instead, so the button works on every row.
 */
export function openClientWhatsApp(target: ClientWhatsAppTarget & { phone?: string }, now?: Date): void {
    const text = clientWhatsAppMessageFor(target, now);
    if (target.phone && formatWaNumber(target.phone)) openWhatsAppMessenger(target.phone, text);
    else openWhatsAppChooser(text);
}
