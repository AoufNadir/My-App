import type { BreakdownUnit, ReportCurrency, ReportKind, ReportLang, ReportPeriod } from '../../utils/clientActivityReport';
import { REPORT_WORDS } from './clientActivityReportText';

/**
 * Words of the phone-size client report (V8-2), beside the A4 report's own (REPORT_WORDS): what is
 * said only here (the big sentence, the price against the month before, the account status).
 * Everything the two share (month names, operation names, balance lines) is read from REPORT_WORDS.
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

export type PriceDirection = 'up' | 'down' | 'same';

export type PhoneWords = {
    /** « اشتريتَ في سبتمبر » */
    heroLabel: (kind: ReportKind, period: ReportPeriod, live: boolean) => string;
    /** « بمبلغ 1 434 952 DZD » */
    heroAmount: (amount: string) => string;
    purchaseCount: (count: number) => string;
    /** The spending against the period before, in one chip: « ▲ أكثر من أغسطس بـ 18% » */
    spendChip: (direction: PriceDirection, percent: string, previous: ReportPeriod) => string;
    currencyName: Record<ReportCurrency, string>;
    /** Under the average price */
    perUnit: Record<ReportCurrency, string>;
    /** The average price against the period before, in one line */
    priceVs: (direction: PriceDirection, difference: string, previousAverage: string, previous: ReportPeriod) => string;
    lowestPrice: string;
    highestPrice: string;
    statusSettled: string;
    statusSettledSub: string;
    statusOwesSub: string;
    statusCreditSub: string;
    calcTitle: string;
    /** The balance before the period, as a sentence: « كان عليك 3 في بداية الشهر » */
    startedOwing: (amount: string, kind: ReportKind) => string;
    /** Under a small amount that cancels the debt before the period */
    remitted: string;
    smallNote: { writeOff: string; adjustment: string };
    partsTitle: (unit: BreakdownUnit) => string;
    noPurchase: string;
    operationsTitle: string;
    balanceAfter: string;
    issuedLine: (issued: string, reference: string) => string;
};

const AR: PhoneWords = {
    heroLabel: (kind, period, live) => {
        const when = kind === 'month' ? `في ${REPORT_WORDS.ar.monthName(period.month)}` : kind === 'year' ? `في ${period.year}` : 'في هذه الفترة';
        return `اشتريتَ ${when}${live ? ' حتى اليوم' : ''}`;
    },
    heroAmount: (amount) => `بمبلغ ${amount}`,
    purchaseCount: arPurchases,
    spendChip: (direction, percent, previous) => {
        const than = previous.kind === 'month' ? REPORT_WORDS.ar.monthName(previous.month) : previous.kind === 'year' ? String(previous.year) : 'الفترة السابقة';
        return direction === 'same' ? `= مثل ${than}` : `${direction === 'up' ? '▲ أكثر' : '▼ أقل'} من ${than} بـ ${percent}`;
    },
    currencyName: { USDT: 'USDT', EUR: 'اليورو' },
    perUnit: { USDT: 'DZD لكل USDT', EUR: 'DZD لكل يورو' },
    priceVs: (direction, difference, previousAverage, previous) => {
        const than = previous.kind === 'month' ? REPORT_WORDS.ar.monthName(previous.month) : previous.kind === 'year' ? String(previous.year) : 'الفترة السابقة';
        if (direction === 'same')
            return `= نفس سعر ${than} (${previousAverage})`;
        return `${direction === 'up' ? '▲ أعلى' : '▼ أقل'} من ${than} (${previousAverage}) بـ ${difference}`;
    },
    lowestPrice: 'أقل سعر',
    highestPrice: 'أعلى سعر',
    statusSettled: 'حسابك مسوّى',
    statusSettledSub: 'لا شيء عليك',
    statusOwesSub: 'يمكنك تسويته في الوقت الذي يناسبك',
    statusCreditSub: 'رصيد في صالحك',
    calcTitle: 'حسابك خطوة بخطوة',
    startedOwing: (amount, kind) => `كان عليك ${amount} في ${kind === 'month' ? 'بداية الشهر' : kind === 'year' ? 'بداية السنة' : 'بداية الفترة'}`,
    remitted: 'أسقطناها عنك',
    smallNote: { writeOff: 'مبلغ صغير أسقطناه عنك', adjustment: 'تسوية مبلغ صغير' },
    partsTitle: (unit) => (unit === 'week' ? 'مشترياتك أسبوعاً بأسبوع' : unit === 'month' ? 'مشترياتك شهراً بشهر' : 'مشترياتك سنة بسنة'),
    noPurchase: 'لا شراء',
    operationsTitle: 'عملياتك',
    balanceAfter: 'الرصيد بعدها',
    issuedLine: (issued, reference) => `صدر في ${issued} · رقم ${reference}`,
};

const FR: PhoneWords = {
    heroLabel: (kind, period, live) => {
        const when = kind === 'month' ? `en ${REPORT_WORDS.fr.monthName(period.month)}` : kind === 'year' ? `en ${frYear(period.year)}` : 'sur la période';
        return `Vous avez acheté ${when}${live ? ' à ce jour' : ''}`;
    },
    heroAmount: (amount) => `pour ${amount}`,
    purchaseCount: (count) => `${count} achat${count > 1 ? 's' : ''}`,
    spendChip: (direction, percent, previous) => {
        const than = previous.kind === 'month' ? `qu’en ${REPORT_WORDS.fr.monthName(previous.month)}` : previous.kind === 'year' ? `qu’en ${previous.year}` : 'que la période précédente';
        return direction === 'same' ? `= Autant ${than}` : `${direction === 'up' ? '▲' : '▼'} ${percent} de ${direction === 'up' ? 'plus' : 'moins'} ${than}`;
    },
    currencyName: { USDT: 'USDT', EUR: 'EUR' },
    perUnit: { USDT: 'DZD par USDT', EUR: 'DZD par euro' },
    priceVs: (direction, difference, previousAverage, previous) => {
        const than = previous.kind === 'month' ? `qu’en ${REPORT_WORDS.fr.monthName(previous.month)}` : previous.kind === 'year' ? `qu’en ${previous.year}` : 'que la période précédente';
        if (direction === 'same')
            return `= Même prix ${than} (${previousAverage})`;
        return `${direction === 'up' ? '▲' : '▼'} ${difference} de ${direction === 'up' ? 'plus' : 'moins'} ${than} (${previousAverage})`;
    },
    lowestPrice: 'Plus bas',
    highestPrice: 'Plus haut',
    statusSettled: 'Votre compte est réglé',
    statusSettledSub: 'Rien à payer',
    statusOwesSub: 'Vous pouvez régler quand cela vous convient',
    statusCreditSub: 'Solde en votre faveur',
    calcTitle: 'Votre compte, pas à pas',
    startedOwing: (amount, kind) => `Vous deviez ${amount} ${kind === 'month' ? 'au début du mois' : kind === 'year' ? 'au début de l’année' : 'au début de la période'}`,
    remitted: 'Nous vous en avons fait remise',
    smallNote: { writeOff: 'Petit montant dont nous vous avons fait remise', adjustment: 'Petit ajustement' },
    partsTitle: (unit) => (unit === 'week' ? 'Vos achats semaine par semaine' : unit === 'month' ? 'Vos achats mois par mois' : 'Vos achats année par année'),
    noPurchase: 'Aucun achat',
    operationsTitle: 'Vos opérations',
    balanceAfter: 'Solde après',
    issuedLine: (issued, reference) => `Émis le ${issued} · N° ${reference}`,
};

export const PHONE_WORDS: Record<ReportLang, PhoneWords> = { ar: AR, fr: FR };

/** A number kept in one piece inside a sentence. */
export const inSentence = isolate;
