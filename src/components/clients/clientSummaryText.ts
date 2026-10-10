import type { ReportEntry } from '../../utils/clientActivityReport';
import type { SummaryRowContext } from '../../utils/clientSummary';
import { isolate, type ReportSheetLang } from '../reports/ReportSheet';
import { currencyUnit, formatPrice, formatQuantity } from './clientActivityReportText';

/**
 * What each operation of the client summary says, written for the client who reads it: « you
 * bought », « you paid us in cash », « transfer from another client's account ». Only what the
 * ledger row itself says is claimed: the way it was paid, and that another client's account was
 * involved (never whose). Our buy price, profit and notes are not read here.
 */

export type SummaryRowText = {
    title: string;
    /** Short phrases under the title (price, how it was paid), after the date */
    details: string[];
};

type Words = {
    /** « 207,52 USDT » kept in one piece inside the sentence */
    quantity: (quantity: number, currency: string) => string;
    buy: (quantity: string | null, currency: 'USDT' | 'EUR') => string;
    saleToUs: (quantity: string | null, currency: 'USDT' | 'EUR') => string;
    service: string;
    unitPrice: (price: string, unit: string) => string;
    /** How a purchase of the client was settled */
    onAccount: string;
    paidBy: { cash: string; baridi: string; usdt: string; eur: string; other: string };
    paidViaOther: { cash: string; baridi: string; unknown: string };
    /** How the client was paid for what they sold us */
    receivedOnAccount: string;
    receivedBy: { cash: string; baridi: string; eur: string; other: string };
    receivedViaOther: string;
    payment: { cash: string; baridi: string; usdt: string; eur: string; other: string };
    withdrawal: { cash: string; baridi: string; other: string };
    otherPaid: { cash: string; baridi: string; unknown: string };
    otherPaidDetail: string;
    advanceForOther: string;
    advanceForOtherDetail: string;
    transferIn: string;
    transferOut: string;
    adjustmentIn: string;
    adjustmentOut: string;
    opening: string;
    writeOff: string;
};

const AR: Words = {
    quantity: (quantity, currency) => isolate(`${formatQuantity(quantity)} ${currency}`),
    buy: (quantity, currency) => (quantity ? `اشتريتَ ${quantity}` : currency === 'EUR' ? 'اشتريتَ يورو' : 'اشتريتَ USDT'),
    saleToUs: (quantity, currency) => (quantity ? `بعتَ لنا ${quantity}` : currency === 'EUR' ? 'بعتَ لنا يورو' : 'بعتَ لنا USDT'),
    service: 'خدمة رقمية',
    unitPrice: (price, unit) => `بسعر\u00A0${isolate(`${price}\u00A0DZD`)}\u00A0لكل\u00A0${unit}`,
    onAccount: 'سُجّلت على حسابك',
    paidBy: { cash: 'دفعتَ نقداً', baridi: 'دفعتَ عبر BaridiMob', usdt: 'دفعتَ بـ USDT', eur: 'دفعتَ باليورو', other: 'مدفوعة' },
    paidViaOther: { cash: 'دفعتَ نقداً إلى عميل آخر', baridi: 'دفعتَ عبر BaridiMob إلى حساب عميل آخر', unknown: 'دفعتَ عبر حساب عميل آخر' },
    receivedOnAccount: 'أُضيف المبلغ إلى رصيدك',
    receivedBy: { cash: 'استلمتَ المبلغ نقداً', baridi: 'استلمتَ المبلغ عبر BaridiMob', eur: 'استلمتَ المبلغ باليورو', other: 'استلمتَ المبلغ' },
    receivedViaOther: 'استلمتَ المبلغ عبر حساب عميل آخر',
    payment: { cash: 'دفعتَ لنا نقداً', baridi: 'دفعتَ لنا عبر BaridiMob', usdt: 'دفعتَ لنا بـ USDT', eur: 'دفعتَ لنا باليورو', other: 'دفعة على حسابك' },
    withdrawal: { cash: 'استلمتَ منا نقداً', baridi: 'استلمتَ منا عبر BaridiMob', other: 'سحب من رصيدك' },
    otherPaid: { cash: 'استلمتَ دفعة عميل آخر نقداً', baridi: 'استلمتَ دفعة عميل آخر عبر BaridiMob', unknown: 'استلمتَ دفعة عميل آخر' },
    otherPaidDetail: 'خُصمت من رصيدك',
    advanceForOther: 'دفعتَ نقداً لعميل آخر نيابةً عنا',
    advanceForOtherDetail: 'أُضيفت إلى رصيدك',
    transferIn: 'تحويل من حساب عميل آخر إلى حسابك',
    transferOut: 'تحويل من حسابك إلى حساب عميل آخر',
    adjustmentIn: 'تعديل: إضافة إلى رصيدك',
    adjustmentOut: 'تعديل: خصم من رصيدك',
    opening: 'الرصيد الافتتاحي',
    writeOff: 'تخفيض من دينك',
};

const FR: Words = {
    quantity: (quantity, currency) => `${formatQuantity(quantity)} ${currency}`,
    buy: (quantity, currency) => (quantity ? `Achat de ${quantity}` : currency === 'EUR' ? 'Achat EUR' : 'Achat USDT'),
    saleToUs: (quantity, currency) => (quantity ? `Vente de ${quantity} à ProDigital` : currency === 'EUR' ? 'Vente EUR à ProDigital' : 'Vente USDT à ProDigital'),
    service: 'Service numérique',
    unitPrice: (price, unit) => `à\u00A0${price}\u00A0DZD\u00A0/\u00A0${unit}`,
    onAccount: 'porté sur votre compte',
    paidBy: { cash: 'payé en espèces', baridi: 'payé par BaridiMob', usdt: 'payé en USDT', eur: 'payé en euros', other: 'réglé' },
    paidViaOther: { cash: 'payé en espèces à un autre client', baridi: 'payé par BaridiMob sur le compte d’un autre client', unknown: 'payé via le compte d’un autre client' },
    receivedOnAccount: 'montant crédité sur votre solde',
    receivedBy: { cash: 'montant reçu en espèces', baridi: 'montant reçu par BaridiMob', eur: 'montant reçu en euros', other: 'montant reçu' },
    receivedViaOther: 'montant reçu via le compte d’un autre client',
    payment: { cash: 'Versement en espèces', baridi: 'Versement par BaridiMob', usdt: 'Versement en USDT', eur: 'Versement en euros', other: 'Versement sur votre compte' },
    withdrawal: { cash: 'Retrait en espèces', baridi: 'Retrait par BaridiMob', other: 'Retrait sur votre solde' },
    otherPaid: { cash: 'Paiement d’un autre client reçu en espèces', baridi: 'Paiement d’un autre client reçu par BaridiMob', unknown: 'Paiement d’un autre client reçu' },
    otherPaidDetail: 'déduit de votre solde',
    advanceForOther: 'Règlement en espèces à un autre client pour notre compte',
    advanceForOtherDetail: 'crédité sur votre solde',
    transferIn: 'Transfert reçu d’un autre compte client',
    transferOut: 'Transfert vers un autre compte client',
    adjustmentIn: 'Ajustement : crédité sur votre solde',
    adjustmentOut: 'Ajustement : déduit de votre solde',
    opening: 'Solde d’ouverture',
    writeOff: 'Remise sur votre dette',
};

const WORDS: Record<ReportSheetLang, Words> = { ar: AR, fr: FR };

const channelKey = (entry: ReportEntry, context: SummaryRowContext): 'cash' | 'baridi' | undefined => {
    if (context.channel)
        return context.channel;
    return entry.method === 'cash' || entry.method === 'baridi' ? entry.method : undefined;
};

/** « 252,51 DZD per USDT » for a purchase or a sale to us with a known quantity and DZD amount. */
function priceDetail(entry: ReportEntry, w: Words): string[] {
    if (!entry.quantity || !entry.currency || entry.dzdCents === null || (entry.eurAmount && !entry.affectsBalance))
        return [];
    return [w.unitPrice(formatPrice(entry.dzdCents / 100 / entry.quantity), currencyUnit(entry.currency))];
}

/** How a purchase of the client was settled. */
function paidWay(entry: ReportEntry, context: SummaryRowContext, w: Words): string[] {
    if (entry.affectsBalance)
        return [w.onAccount];
    const channel = channelKey(entry, context);
    if (context.viaOtherClient)
        return [channel ? w.paidViaOther[channel] : w.paidViaOther.unknown];
    return [w.paidBy[entry.method && entry.method in w.paidBy ? entry.method : 'other']];
}

/** How the client was paid for what they sold us. */
function receivedWay(entry: ReportEntry, context: SummaryRowContext, w: Words): string[] {
    if (entry.affectsBalance)
        return [w.receivedOnAccount];
    const channel = channelKey(entry, context);
    if (context.viaOtherClient)
        return [w.receivedViaOther];
    if (entry.method === 'eur')
        return [w.receivedBy.eur];
    return [channel ? w.receivedBy[channel] : w.receivedBy.other];
}

export function summaryRowText(entry: ReportEntry, context: SummaryRowContext, lang: ReportSheetLang): SummaryRowText {
    const w = WORDS[lang];
    const channel = channelKey(entry, context);
    const quantity = entry.quantity && entry.currency ? w.quantity(entry.quantity, currencyUnit(entry.currency)) : null;
    const currency = entry.currency === 'EUR' ? 'EUR' : 'USDT';
    switch (entry.kind) {
        case 'buy':
            return { title: w.buy(quantity, currency), details: [...priceDetail(entry, w), ...paidWay(entry, context, w)] };
        case 'service':
            return { title: w.service, details: paidWay(entry, context, w) };
        case 'saleToUs':
            return { title: w.saleToUs(quantity, currency), details: [...priceDetail(entry, w), ...receivedWay(entry, context, w)] };
        case 'payment': {
            const method = entry.method && entry.method in w.payment ? entry.method : 'other';
            return { title: w.payment[method], details: [] };
        }
        case 'withdrawal':
            if (context.onBehalf)
                return { title: channel ? w.otherPaid[channel] : w.otherPaid.unknown, details: [w.otherPaidDetail] };
            return { title: w.withdrawal[channel ?? 'other'], details: [] };
        case 'transfer':
            return { title: entry.balanceCents >= 0 ? w.transferIn : w.transferOut, details: [] };
        case 'opening':
            return { title: w.opening, details: [] };
        case 'writeOff':
            return { title: w.writeOff, details: [] };
        default:
            if (context.onBehalf)
                return { title: w.advanceForOther, details: [w.advanceForOtherDetail] };
            return { title: entry.balanceCents >= 0 ? w.adjustmentIn : w.adjustmentOut, details: [] };
    }
}
