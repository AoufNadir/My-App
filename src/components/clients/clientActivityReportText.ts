import type { BalanceLineKey, BreakdownUnit, ReportCurrency, ReportEntry, ReportKind, ReportLang, ReportPaymentMethod, ReportPeriod } from '../../utils/clientActivityReport';
import { periodDays } from '../../utils/clientActivityReport';

/**
 * Words of the client activity report. The report has its own language, chosen when it is sent
 * (a client can get French while the app is in Arabic), so it does not use the app's t().
 */
const MONTHS: Record<ReportLang, string[]> = {
    ar: ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const frMonthOf = (month: number) => (/^[aeiou]/.test(MONTHS.fr[month]) ? `d’${MONTHS.fr[month]}` : `de ${MONTHS.fr[month]}`);
/** 3 أيام, 11 يوماً, 100 يوم: the noun after an Arabic number. */
function arDays(count: number): string {
    if (count === 1)
        return 'يوم واحد';
    if (count === 2)
        return 'يومان';
    const rest = count % 100;
    if (rest >= 3 && rest <= 10)
        return `${count} أيام`;
    return rest >= 11 ? `${count} يوماً` : `${count} يوم`;
}

export type ReportWords = {
    brandTagline: string;
    title: Record<ReportKind, string>;
    reference: string;
    issued: string;
    client: string;
    period: string;
    from: string;
    to: string;
    soFar: string;
    monthName: (month: number) => string;
    weekLabel: (week: number) => string;
    periodName: (period: ReportPeriod) => string;
    averagePrice: string;
    yourAveragePrice: string;
    amount: string;
    purchases: string;
    paidInEur: string;
    ofWhichPaidInEur: string;
    services: string;
    servicesCount: string;
    paid: string;
    allPaidBy: Record<ReportPaymentMethod, string>;
    method: Record<ReportPaymentMethod, string>;
    balanceStart: Record<ReportKind, string>;
    balanceLine: Record<BalanceLineKey, string>;
    remainingOwed: string;
    remainingCredit: string;
    balanceNow: string;
    owes: string;
    credit: string;
    allPaid: (amount: string) => string;
    balanceZero: string;
    leadNone: string;
    /** V14-2: no purchase, but other operations below (sales to us, payments, transfers) */
    leadNoneWithOps: string;
    /** V14-2: nothing at all in the period */
    noOperations: string;
    sinceJanuary: (year: number) => string;
    biggest: (month: number) => string;
    onDay: string;
    /** Under a row that is still running */
    running: string;
    total: string;
    operationsTitle: string;
    colDate: string;
    colOperation: string;
    colAmount: string;
    colBalance: string;
    operation: (entry: ReportEntry) => string;
    onAccount: string;
    footer: string;
};

const AR: ReportWords = {
    brandTagline: 'صرف العملات',
    title: { range: 'تقرير النشاط', month: 'تقرير النشاط الشهري', year: 'تقرير النشاط السنوي' },
    reference: 'رقم',
    issued: 'صدر في',
    client: 'العميل',
    period: 'الفترة',
    from: 'من',
    to: 'إلى',
    soFar: 'حتى اليوم',
    monthName: (month) => MONTHS.ar[month],
    weekLabel: (week) => `الأسبوع ${week}`,
    periodName: (period) => (period.kind === 'week'
        ? `الأسبوع ${period.week} من ${MONTHS.ar[period.month]} ${period.year}`
        : period.kind === 'month' ? `${MONTHS.ar[period.month]} ${period.year}` : period.kind === 'year' ? `سنة ${period.year}` : arDays(periodDays(period))),
    averagePrice: 'متوسط السعر',
    yourAveragePrice: 'متوسط سعرك',
    amount: 'المبلغ',
    purchases: 'عدد العمليات',
    paidInEur: 'دفعتها باليورو',
    ofWhichPaidInEur: 'منها دفعتها باليورو',
    services: 'خدمات رقمية',
    servicesCount: 'عدد الخدمات',
    paid: 'ما دفعته',
    allPaidBy: { cash: 'كلها نقداً', baridi: 'كلها عبر BaridiMob', usdt: 'كلها بـ USDT', eur: 'كلها باليورو', other: 'كلها مدفوعة' },
    method: { cash: 'نقداً', baridi: 'BaridiMob', usdt: 'USDT', eur: 'باليورو', other: 'دفعات أخرى' },
    balanceStart: { range: 'رصيدك في بداية الفترة', month: 'رصيدك في بداية الشهر', year: 'رصيدك في بداية السنة' },
    balanceLine: {
        purchases: 'مشترياتك',
        payments: 'دفعاتك',
        saleToUs: 'ما بعته لنا',
        withdrawal: 'سحب من رصيدك',
        transfer: 'تحويلات',
        opening: 'الرصيد الافتتاحي',
        writeOff: 'تخفيض من دينك',
        adjustment: 'تعديلات على الرصيد',
    },
    remainingOwed: 'الباقي عليك',
    remainingCredit: 'الباقي لك',
    balanceNow: 'رصيدك الآن',
    owes: 'عليك',
    credit: 'لك',
    allPaid: (amount) => `دفعت كل ما اشتريته في هذه الفترة (${amount}). رصيدك صفر.`,
    balanceZero: 'رصيدك صفر في بداية الفترة ونهايتها.',
    leadNone: 'لم تشترِ في هذه الفترة.',
    leadNoneWithOps: 'لم تشترِ منّا في هذه الفترة؛ عملياتك أدناه.',
    noOperations: 'لا توجد عمليات في هذه الفترة.',
    sinceJanuary: (year) => `منذ بداية ${year}`,
    biggest: (month) => `أكبر عملية في ${MONTHS.ar[month]}`,
    onDay: 'يوم',
    running: 'حتى اليوم',
    total: 'المجموع',
    operationsTitle: 'عملياتك في هذه الفترة',
    colDate: 'التاريخ',
    colOperation: 'العملية',
    colAmount: 'المبلغ (DZD)',
    colBalance: 'الرصيد بعدها',
    operation: (entry) => {
        switch (entry.kind) {
            case 'buy': return entry.currency === 'EUR' ? 'شراء يورو' : entry.currency === 'RMB' ? 'شراء RMB' : 'شراء USDT';
            case 'service': return 'خدمة رقمية';
            case 'payment': return entry.method === 'cash' ? 'دفعة نقداً' : entry.method === 'baridi' ? 'دفعة BaridiMob' : entry.method === 'usdt' ? 'دفعة بـ USDT' : entry.method === 'eur' ? 'دفعة باليورو' : 'دفعة';
            case 'saleToUs': return entry.currency === 'EUR' ? 'بيع يورو لنا' : entry.currency === 'RMB' ? 'بيع RMB لنا' : 'بيع USDT لنا';
            case 'withdrawal': return 'سحب من رصيدك';
            case 'transfer': return entry.balanceCents >= 0 ? 'دفعتَ عنّا لعميل آخر' : 'استلمتَ مالنا من عميل آخر';
            case 'opening': return 'الرصيد الافتتاحي';
            case 'writeOff': return 'تخفيض من دينك';
            default: return entry.balanceCents >= 0 ? 'إضافة إلى رصيدك' : 'خصم من رصيدك';
        }
    },
    onAccount: 'على الحساب',
    footer: 'هذا التقرير ملخص لعملياتك مع ProDigital. إذا وجدت أي فرق، راسلنا خلال 7 أيام.',
};

const FR: ReportWords = {
    brandTagline: 'Change de devises',
    title: { range: 'Rapport d’activité', month: 'Rapport d’activité mensuel', year: 'Rapport d’activité annuel' },
    reference: 'N°',
    issued: 'Émis le',
    client: 'Client',
    period: 'Période',
    from: 'du',
    to: 'au',
    soFar: 'à aujourd’hui',
    monthName: (month) => MONTHS.fr[month],
    weekLabel: (week) => `Semaine ${week}`,
    periodName: (period) => {
        if (period.kind === 'week')
            return `Semaine ${period.week} ${frMonthOf(period.month)} ${period.year}`;
        if (period.kind === 'month')
            return `${capitalize(MONTHS.fr[period.month])} ${period.year}`;
        if (period.kind === 'year')
            return `Année ${period.year}`;
        const days = periodDays(period);
        return days === 1 ? '1 jour' : `${days} jours`;
    },
    averagePrice: 'Prix moyen',
    yourAveragePrice: 'Votre prix moyen',
    amount: 'Montant',
    purchases: 'Nombre d’achats',
    paidInEur: 'Payés en euros',
    ofWhichPaidInEur: 'Dont payés en euros',
    services: 'Services numériques',
    servicesCount: 'Nombre de services',
    paid: 'Total payé',
    allPaidBy: { cash: 'Tout en espèces', baridi: 'Tout par BaridiMob', usdt: 'Tout en USDT', eur: 'Tout en euros', other: 'Tout réglé' },
    method: { cash: 'Espèces', baridi: 'BaridiMob', usdt: 'USDT', eur: 'Euros', other: 'Autres règlements' },
    balanceStart: { range: 'Solde au début de la période', month: 'Solde au début du mois', year: 'Solde au début de l’année' },
    balanceLine: {
        purchases: 'Vos achats',
        payments: 'Vos versements',
        saleToUs: 'Vos ventes à ProDigital',
        withdrawal: 'Retraits sur votre solde',
        transfer: 'Transferts',
        opening: 'Solde d’ouverture',
        writeOff: 'Remise sur votre dette',
        adjustment: 'Ajustements du solde',
    },
    remainingOwed: 'Reste à payer',
    remainingCredit: 'Reste en votre faveur',
    balanceNow: 'Solde actuel',
    owes: 'à payer',
    credit: 'en votre faveur',
    allPaid: (amount) => `Vous avez tout réglé sur la période (${amount}). Solde à zéro.`,
    balanceZero: 'Solde à zéro au début et à la fin de la période.',
    leadNone: 'Aucun achat sur cette période.',
    leadNoneWithOps: 'Aucun achat chez nous sur cette période ; vos opérations sont ci-dessous.',
    noOperations: 'Aucune opération sur cette période.',
    sinceJanuary: (year) => `Depuis le 1er janvier ${year}`,
    biggest: (month) => `Plus gros achat ${frMonthOf(month)}`,
    onDay: 'le',
    running: 'en cours',
    total: 'Total',
    operationsTitle: 'Vos opérations sur la période',
    colDate: 'Date',
    colOperation: 'Opération',
    colAmount: 'Montant (DZD)',
    colBalance: 'Solde après',
    operation: (entry) => {
        switch (entry.kind) {
            case 'buy': return entry.currency === 'EUR' ? 'Achat EUR' : entry.currency === 'RMB' ? 'Achat RMB' : 'Achat USDT';
            case 'service': return 'Service numérique';
            case 'payment': return entry.method === 'cash' ? 'Versement espèces' : entry.method === 'baridi' ? 'Versement BaridiMob' : entry.method === 'usdt' ? 'Versement en USDT' : entry.method === 'eur' ? 'Versement en euros' : 'Versement';
            case 'saleToUs': return entry.currency === 'EUR' ? 'Vente EUR à ProDigital' : entry.currency === 'RMB' ? 'Vente RMB à ProDigital' : 'Vente USDT à ProDigital';
            case 'withdrawal': return 'Retrait sur votre solde';
            case 'transfer': return entry.balanceCents >= 0 ? 'Vous avez payé pour nous un autre client' : 'Vous avez reçu notre argent d’un autre client';
            case 'opening': return 'Solde d’ouverture';
            case 'writeOff': return 'Remise sur votre dette';
            default: return entry.balanceCents >= 0 ? 'Ajout à votre solde' : 'Déduction de votre solde';
        }
    },
    onAccount: 'sur compte',
    footer: 'Ce rapport résume vos opérations avec ProDigital. Signalez-nous toute différence sous 7 jours.',
};

export const REPORT_WORDS: Record<ReportLang, ReportWords> = { ar: AR, fr: FR };

export { formatCompactDzd, formatDate, formatDayMonth, formatDzdCents, formatEur, formatEurPrice, formatPercent, formatPrice, formatQuantity } from '../reports/reportFormat';
export const currencyUnit = (currency: ReportCurrency) => (currency === 'EUR' ? '€' : currency === 'RMB' ? 'RMB' : 'USDT');
