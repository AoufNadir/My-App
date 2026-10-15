import type { BreakdownUnit, ReportCurrency, ReportEntry, ReportKind, ReportLang, ReportPaymentMethod, ReportPeriod } from '../../utils/clientActivityReport';
import { REPORT_WORDS } from './clientActivityReportText';

/**
 * Words of the phone-size client report (V8-2, operations rewritten in V8-3), beside the A4
 * report's own (REPORT_WORDS): what is said only here (the big sentence, the account status, every
 * operation as a sentence from the client's side). Everything the two share (month names, balance
 * lines) is read from REPORT_WORDS.
 */
const isolate = (text: string) => `⁦${text}⁩`;
const frYear = (year: number) => String(year);

/** « 3 عمليات شراء », « عمليتا شراء »: the noun after an Arabic number. */
function arPurchases(count: number): string {
    if (count === 1)
        return 'عملية شراء واحدة';
    if (count === 2)
        return 'عمليتا شراء';
    const rest = count % 100;
    return rest >= 3 && rest <= 10 ? `${count} عمليات شراء` : `${count} عملية شراء`;
}

/** Where the account stands after an operation. */
export type AccountState = 'owes' | 'credit' | 'settled';

export type OperationWords = {
    /** A quantity in a sentence: « 500 USDT », « 300 يورو » (a word, not €: « اشتريتَ 300 € » reads like an amount paid) */
    quantity: (currency: ReportCurrency, quantity: string) => string;
    /** What the operation is, as a sentence from the client's side; `amount` is « 500 USDT » when the quantity is known */
    title: (entry: ReportEntry, amount: string | null, small: boolean) => string;
    /** « بسعر 252.5 DZD للواحد »: the price per unit of a purchase or of a sale to us */
    unitPrice: (price: string) => string;
    /** How it was paid or received; null when there is nothing to add (or the balance is hidden) */
    how: (entry: ReportEntry, showBalance: boolean) => string | null;
    /** Right under it: what the account holds after the operation */
    after: (state: AccountState, amount: string) => string;
    /** One line under the section title, when each operation says where the account stands */
    hint: string;
};

export type PhoneWords = {
    /** « اشتريتَ في سبتمبر » */
    heroLabel: (kind: ReportKind, period: ReportPeriod, live: boolean) => string;
    /** « بمبلغ 1 434 952 DZD » */
    heroAmount: (amount: string) => string;
    purchaseCount: (count: number) => string;
    currencyName: Record<ReportCurrency, string>;
    /** Under the average price */
    perUnit: Record<ReportCurrency, string>;
    lowestPrice: string;
    highestPrice: string;
    statusSettled: string;
    statusSettledSub: string;
    statusOwesSub: string;
    statusCreditSub: string;
    calcTitle: string;
    /** Under the opening balance of 0 when a small debt from before the period is cancelled by a write-off: « كان عليك 3 DZD فأسقطناها عنك » */
    remittedNote: (amount: string, kind: ReportKind) => string;
    smallNote: { writeOff: string; adjustment: string };
    partsTitle: (unit: BreakdownUnit) => string;
    noPurchase: string;
    operationsTitle: string;
    operation: OperationWords;
    issuedLine: (issued: string, reference: string) => string;
};

type MethodWords = Record<ReportPaymentMethod, string>;

const AR_PAID_FOR: MethodWords = {
    cash: 'دفعتَ ثمنها نقداً',
    baridi: 'دفعتَ ثمنها عبر BaridiMob',
    usdt: 'دفعتَ ثمنها بـ USDT',
    eur: 'دفعتَ ثمنها باليورو',
    other: 'دفعتَ ثمنها بطريقة أخرى',
};
const AR_RECEIVED_FOR: MethodWords = {
    cash: 'استلمتَ ثمنها نقداً',
    baridi: 'استلمتَ ثمنها عبر BaridiMob',
    usdt: 'استلمتَ ثمنها بـ USDT',
    eur: 'استلمتَ ثمنها باليورو',
    other: 'استلمتَ ثمنها بطريقة أخرى',
};
const AR_RECEIVED_MONEY: Partial<MethodWords> = {
    cash: 'استلمتَ المبلغ نقداً',
    baridi: 'استلمتَ المبلغ عبر BaridiMob',
    usdt: 'استلمتَ المبلغ بـ USDT',
    eur: 'استلمتَ المبلغ باليورو',
};

const AR_OPERATION: OperationWords = {
    quantity: (currency, quantity) => (currency === 'EUR' ? `${isolate(quantity)} يورو` : isolate(`${quantity} USDT`)),
    title: (entry, amount, small) => {
        switch (entry.kind) {
            case 'buy': return amount ? `اشتريتَ ${amount}` : entry.currency === 'EUR' ? 'اشتريتَ يورو' : 'اشتريتَ USDT';
            case 'service': return 'اشتريتَ خدمة رقمية';
            case 'payment': return entry.method === 'cash' ? 'دفعتَ نقداً' : entry.method === 'baridi' ? 'دفعتَ عبر BaridiMob' : entry.method === 'usdt' ? 'دفعتَ بـ USDT' : entry.method === 'eur' ? 'دفعتَ باليورو' : 'سدّدتَ دفعة';
            case 'saleToUs': return amount ? `بعتَ لنا ${amount}` : entry.currency === 'EUR' ? 'بعتَ لنا يورو' : 'بعتَ لنا USDT';
            case 'withdrawal': return 'سحبتَ من رصيدك';
            case 'transfer': return entry.balanceCents >= 0 ? 'حوّلتَ مبلغًا إلى عميل آخر' : 'استلمتَ مبلغًا من عميل آخر';
            case 'opening': return entry.balanceCents < 0 ? 'سُجّل في حسابك دَين سابق' : 'سُجّل في حسابك رصيد سابق';
            case 'writeOff': return small ? 'أسقطنا عنك مبلغاً صغيراً' : 'أسقطنا عنك جزءاً من دينك';
            default: return entry.balanceCents >= 0 ? 'أضفنا إلى رصيدك' : 'خصمنا من رصيدك';
        }
    },
    unitPrice: (price) => `بسعر ${price} للواحد`,
    how: (entry, showBalance) => {
        const method = entry.method || 'other';
        switch (entry.kind) {
            case 'buy':
            case 'service':
                return entry.affectsBalance ? (showBalance ? 'سُجّلت على حسابك، لم تدفعها بعد' : null) : AR_PAID_FOR[method];
            case 'saleToUs':
                return entry.affectsBalance ? (showBalance ? 'أضفنا ثمنها إلى رصيدك' : null) : AR_RECEIVED_FOR[method];
            case 'withdrawal':
                return AR_RECEIVED_MONEY[method] ?? null;
            default:
                return null;
        }
    },
    after: (state, amount) => (state === 'owes' ? `بعدها عليك ${amount}` : state === 'credit' ? `بعدها لك ${amount}` : 'بعدها حسابك مسوّى'),
    hint: 'كل عملية بتاريخها، وتحتها ما يبقى في حسابك بعدها',
};

const AR: PhoneWords = {
    heroLabel: (kind, period, live) => {
        const when = kind === 'month' ? `في ${REPORT_WORDS.ar.monthName(period.month)}` : kind === 'year' ? `في ${period.year}` : 'في هذه الفترة';
        return `اشتريتَ ${when}${live ? ' حتى اليوم' : ''}`;
    },
    heroAmount: (amount) => `بمبلغ ${amount}`,
    purchaseCount: arPurchases,
    currencyName: { USDT: 'USDT', EUR: 'اليورو' },
    perUnit: { USDT: 'DZD لكل USDT', EUR: 'DZD لكل يورو' },
    lowestPrice: 'أقل سعر',
    highestPrice: 'أعلى سعر',
    statusSettled: 'حسابك مسوّى',
    statusSettledSub: 'لا شيء عليك',
    statusOwesSub: 'يمكنك تسويته في الوقت الذي يناسبك',
    statusCreditSub: 'رصيد في صالحك',
    calcTitle: 'حسابك خطوة بخطوة',
    remittedNote: (amount, kind) => `كان عليك ${amount} في ${kind === 'month' ? 'بداية الشهر' : kind === 'year' ? 'بداية السنة' : 'بداية الفترة'} فأسقطناها عنك`,
    smallNote: { writeOff: 'مبلغ صغير أسقطناه عنك', adjustment: 'تسوية مبلغ صغير' },
    partsTitle: (unit) => (unit === 'week' ? 'مشترياتك أسبوعاً بأسبوع' : unit === 'month' ? 'مشترياتك شهراً بشهر' : 'مشترياتك سنة بسنة'),
    noPurchase: 'لا شراء',
    operationsTitle: 'عملياتك',
    operation: AR_OPERATION,
    issuedLine: (issued, reference) => `صدر في ${issued} · رقم ${reference}`,
};

const FR_PAID_FOR: MethodWords = {
    cash: 'Payé en espèces',
    baridi: 'Payé par BaridiMob',
    usdt: 'Payé en USDT',
    eur: 'Payé en euros',
    other: 'Payé autrement',
};
const FR_RECEIVED_FOR: MethodWords = {
    cash: 'Vous avez reçu le montant en espèces',
    baridi: 'Vous avez reçu le montant par BaridiMob',
    usdt: 'Vous avez reçu le montant en USDT',
    eur: 'Vous avez reçu le montant en euros',
    other: 'Vous avez reçu le montant autrement',
};
const FR_RECEIVED_MONEY: Partial<MethodWords> = {
    cash: 'Reçu en espèces',
    baridi: 'Reçu par BaridiMob',
    usdt: 'Reçu en USDT',
    eur: 'Reçu en euros',
};

const FR_OPERATION: OperationWords = {
    quantity: (currency, quantity) => (currency === 'EUR' ? `${isolate(quantity)} euros` : isolate(`${quantity} USDT`)),
    title: (entry, amount, small) => {
        switch (entry.kind) {
            case 'buy': return amount ? `Vous avez acheté ${amount}` : entry.currency === 'EUR' ? 'Vous avez acheté des euros' : 'Vous avez acheté des USDT';
            case 'service': return 'Vous avez acheté un service numérique';
            case 'payment': return entry.method === 'cash' ? 'Vous avez payé en espèces' : entry.method === 'baridi' ? 'Vous avez payé par BaridiMob' : entry.method === 'usdt' ? 'Vous avez payé en USDT' : entry.method === 'eur' ? 'Vous avez payé en euros' : 'Vous avez fait un versement';
            case 'saleToUs': return amount ? `Vous nous avez vendu ${amount}` : entry.currency === 'EUR' ? 'Vous nous avez vendu des euros' : 'Vous nous avez vendu des USDT';
            case 'withdrawal': return 'Vous avez retiré de votre solde';
            case 'transfer': return entry.balanceCents >= 0 ? 'Vous avez transféré à un autre client' : 'Vous avez reçu d’un autre client';
            case 'opening': return entry.balanceCents < 0 ? 'Une dette antérieure a été inscrite sur votre compte' : 'Un solde antérieur a été inscrit sur votre compte';
            case 'writeOff': return small ? 'Nous vous avons fait remise d’un petit montant' : 'Nous vous avons fait remise d’une partie de votre dette';
            default: return entry.balanceCents >= 0 ? 'Nous avons ajouté à votre solde' : 'Nous avons déduit de votre solde';
        }
    },
    unitPrice: (price) => `au prix de ${price} l’unité`,
    how: (entry, showBalance) => {
        const method = entry.method || 'other';
        switch (entry.kind) {
            case 'buy':
            case 'service':
                return entry.affectsBalance ? (showBalance ? 'Inscrit sur votre compte, pas encore payé' : null) : FR_PAID_FOR[method];
            case 'saleToUs':
                return entry.affectsBalance ? (showBalance ? 'Montant ajouté à votre solde' : null) : FR_RECEIVED_FOR[method];
            case 'withdrawal':
                return FR_RECEIVED_MONEY[method] ?? null;
            default:
                return null;
        }
    },
    after: (state, amount) => (state === 'owes' ? `Ensuite vous devez ${amount}` : state === 'credit' ? `Ensuite en votre faveur : ${amount}` : 'Ensuite votre compte est réglé'),
    hint: 'Chaque opération à sa date, et ce qui reste sur votre compte juste après',
};

const FR: PhoneWords = {
    heroLabel: (kind, period, live) => {
        const when = kind === 'month' ? `en ${REPORT_WORDS.fr.monthName(period.month)}` : kind === 'year' ? `en ${frYear(period.year)}` : 'sur la période';
        return `Vous avez acheté ${when}${live ? ' à ce jour' : ''}`;
    },
    heroAmount: (amount) => `pour ${amount}`,
    purchaseCount: (count) => `${count} achat${count > 1 ? 's' : ''}`,
    currencyName: { USDT: 'USDT', EUR: 'EUR' },
    perUnit: { USDT: 'DZD par USDT', EUR: 'DZD par euro' },
    lowestPrice: 'Plus bas',
    highestPrice: 'Plus haut',
    statusSettled: 'Votre compte est réglé',
    statusSettledSub: 'Rien à payer',
    statusOwesSub: 'Vous pouvez régler quand cela vous convient',
    statusCreditSub: 'Solde en votre faveur',
    calcTitle: 'Votre compte, pas à pas',
    remittedNote: (amount, kind) => `Vous deviez ${amount} ${kind === 'month' ? 'au début du mois' : kind === 'year' ? 'au début de l’année' : 'au début de la période'} et nous vous en avons fait remise`,
    smallNote: { writeOff: 'Petit montant dont nous vous avons fait remise', adjustment: 'Petit ajustement' },
    partsTitle: (unit) => (unit === 'week' ? 'Vos achats semaine par semaine' : unit === 'month' ? 'Vos achats mois par mois' : 'Vos achats année par année'),
    noPurchase: 'Aucun achat',
    operationsTitle: 'Vos opérations',
    operation: FR_OPERATION,
    issuedLine: (issued, reference) => `Émis le ${issued} · N° ${reference}`,
};

export const PHONE_WORDS: Record<ReportLang, PhoneWords> = { ar: AR, fr: FR };

/** A number kept in one piece inside a sentence. */
export const inSentence = isolate;
