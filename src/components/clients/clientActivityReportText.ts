import type { BalanceLineKey, ReportCurrency, ReportEntry, ReportKind, ReportLang, ReportPaymentMethod, ReportPeriod } from '../../utils/clientActivityReport';

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
    /** Short name used in the price trend and the comparison table */
    periodShort: (period: ReportPeriod) => string;
    currencyTitle: Record<ReportCurrency, string>;
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
    balanceTitle: string;
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
    leadQuantities: (quantities: string) => string;
    leadFirstWeek: (amount: string) => string;
    leadWeekNoPrevious: (amount: string, previousWeek: number) => string;
    leadWeek: (amount: string, change: string, previousWeek: number) => string;
    leadWeekLive: (amount: string) => string;
    leadMonth: (amount: string, month: number, change: string | null, previousMonth: number) => string;
    leadMonthLive: (amount: string, month: number) => string;
    leadYear: (amount: string, year: number, bestMonth: number | null, bestAmount: string, isLive: boolean) => string;
    sinceJanuary: (year: number) => string;
    biggest: (month: number) => string;
    onDay: string;
    comparisonTitle: (period: ReportPeriod) => string;
    colWeek: string;
    colMonth: string;
    colSpent: string;
    colChange: string;
    /** Under a row that is still running */
    running: string;
    total: string;
    operationsTitle: string;
    operationsYear: string;
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
    title: { week: 'تقرير النشاط الأسبوعي', month: 'تقرير النشاط الشهري', year: 'تقرير النشاط السنوي' },
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
        : period.kind === 'month' ? `${MONTHS.ar[period.month]} ${period.year}` : `سنة ${period.year}`),
    periodShort: (period) => (period.kind === 'week' ? `الأسبوع ${period.week}` : period.kind === 'month' ? MONTHS.ar[period.month] : String(period.year)),
    currencyTitle: { USDT: 'USDT التي اشتريتها', EUR: 'اليورو الذي اشتريته' },
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
    balanceTitle: 'حساب رصيدك',
    balanceStart: { week: 'رصيدك في بداية الأسبوع', month: 'رصيدك في بداية الشهر', year: 'رصيدك في بداية السنة' },
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
    leadQuantities: (quantities) => `اشتريت في هذه الفترة ${quantities}.`,
    leadFirstWeek: (amount) => `أنفقت في الأسبوع الأول من الشهر ${amount}. المقارنة تبدأ من الأسبوع القادم.`,
    leadWeekNoPrevious: (amount, previousWeek) => `أنفقت هذا الأسبوع ${amount}. لم تشترِ في الأسبوع ${previousWeek}، فلا مقارنة.`,
    leadWeek: (amount, change, previousWeek) => `أنفقت هذا الأسبوع ${amount}، أي ${change} مقارنة بالأسبوع ${previousWeek}.`,
    leadWeekLive: (amount) => `أنفقت هذا الأسبوع حتى اليوم ${amount}.`,
    leadMonth: (amount, month, change, previousMonth) => `أنفقت في ${MONTHS.ar[month]} ${amount}${change ? `، أي ${change} مقارنة بـ${MONTHS.ar[previousMonth]}.` : '.'}`,
    leadMonthLive: (amount, month) => `أنفقت في ${MONTHS.ar[month]} حتى اليوم ${amount}.`,
    leadYear: (amount, year, bestMonth, bestAmount, isLive) => `أنفقت في ${year}${isLive ? ' حتى اليوم' : ''} ${amount}.${bestMonth !== null ? ` أكثر شهر: ${MONTHS.ar[bestMonth]} (${bestAmount}).` : ''}`,
    sinceJanuary: (year) => `منذ بداية ${year}`,
    biggest: (month) => `أكبر عملية في ${MONTHS.ar[month]}`,
    onDay: 'يوم',
    comparisonTitle: (period) => (period.kind === 'year'
        ? `أشهر ${period.year}: ما أنفقته في كل شهر`
        : `أسابيع ${MONTHS.ar[period.month]} ${period.year}: ما أنفقته في كل أسبوع`),
    colWeek: 'الأسبوع',
    colMonth: 'الشهر',
    colSpent: 'ما أنفقته (DZD)',
    colChange: 'مقارنة بما قبله',
    running: 'حتى اليوم',
    total: 'المجموع',
    operationsTitle: 'عملياتك في هذه الفترة',
    operationsYear: 'تفاصيل عمليات كل شهر في تقريره الشهري.',
    colDate: 'التاريخ',
    colOperation: 'العملية',
    colAmount: 'المبلغ (DZD)',
    colBalance: 'الرصيد بعدها',
    operation: (entry) => {
        switch (entry.kind) {
            case 'buy': return entry.currency === 'EUR' ? 'شراء يورو' : 'شراء USDT';
            case 'service': return 'خدمة رقمية';
            case 'payment': return entry.method === 'cash' ? 'دفعة نقداً' : entry.method === 'baridi' ? 'دفعة BaridiMob' : entry.method === 'usdt' ? 'دفعة بـ USDT' : entry.method === 'eur' ? 'دفعة باليورو' : 'دفعة';
            case 'saleToUs': return entry.currency === 'EUR' ? 'بيع يورو لنا' : 'بيع USDT لنا';
            case 'withdrawal': return 'سحب من رصيدك';
            case 'transfer': return entry.balanceCents >= 0 ? 'تحويل لصالحك' : 'تحويل على حسابك';
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
    title: { week: 'Rapport d’activité hebdomadaire', month: 'Rapport d’activité mensuel', year: 'Rapport d’activité annuel' },
    reference: 'N°',
    issued: 'Émis le',
    client: 'Client',
    period: 'Période',
    from: 'du',
    to: 'au',
    soFar: 'à aujourd’hui',
    monthName: (month) => MONTHS.fr[month],
    weekLabel: (week) => `Semaine ${week}`,
    periodName: (period) => (period.kind === 'week'
        ? `Semaine ${period.week} ${frMonthOf(period.month)} ${period.year}`
        : period.kind === 'month' ? `${capitalize(MONTHS.fr[period.month])} ${period.year}` : `Année ${period.year}`),
    periodShort: (period) => (period.kind === 'week' ? `Semaine ${period.week}` : period.kind === 'month' ? capitalize(MONTHS.fr[period.month]) : String(period.year)),
    currencyTitle: { USDT: 'USDT achetés', EUR: 'EUR achetés' },
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
    balanceTitle: 'Le calcul de votre solde',
    balanceStart: { week: 'Solde au début de la semaine', month: 'Solde au début du mois', year: 'Solde au début de l’année' },
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
    leadQuantities: (quantities) => `Achats de la période : ${quantities}.`,
    leadFirstWeek: (amount) => `Première semaine du mois : ${amount} dépensés. La comparaison commence la semaine prochaine.`,
    leadWeekNoPrevious: (amount, previousWeek) => `Cette semaine : ${amount} dépensés. Aucun achat en semaine ${previousWeek}, donc pas de comparaison.`,
    leadWeek: (amount, change, previousWeek) => `Cette semaine : ${amount} dépensés, soit ${change} par rapport à la semaine ${previousWeek}.`,
    leadWeekLive: (amount) => `Cette semaine à ce jour : ${amount} dépensés.`,
    leadMonth: (amount, month, change, previousMonth) => `En ${MONTHS.fr[month]} : ${amount} dépensés${change ? `, soit ${change} par rapport à ${MONTHS.fr[previousMonth]}.` : '.'}`,
    leadMonthLive: (amount, month) => `En ${MONTHS.fr[month]} à ce jour : ${amount} dépensés.`,
    leadYear: (amount, year, bestMonth, bestAmount, isLive) => `En ${year}${isLive ? ' à ce jour' : ''} : ${amount} dépensés.${bestMonth !== null ? ` Mois le plus fort : ${MONTHS.fr[bestMonth]} (${bestAmount}).` : ''}`,
    sinceJanuary: (year) => `Depuis le 1er janvier ${year}`,
    biggest: (month) => `Plus gros achat ${frMonthOf(month)}`,
    onDay: 'le',
    comparisonTitle: (period) => (period.kind === 'year'
        ? `Mois de ${period.year} : vos dépenses mois par mois`
        : `Semaines ${frMonthOf(period.month)} ${period.year} : vos dépenses semaine par semaine`),
    colWeek: 'Semaine',
    colMonth: 'Mois',
    colSpent: 'Dépensé (DZD)',
    colChange: 'vs précédent',
    running: 'en cours',
    total: 'Total',
    operationsTitle: 'Vos opérations sur la période',
    operationsYear: 'Le détail de chaque mois est dans son rapport mensuel.',
    colDate: 'Date',
    colOperation: 'Opération',
    colAmount: 'Montant (DZD)',
    colBalance: 'Solde après',
    operation: (entry) => {
        switch (entry.kind) {
            case 'buy': return entry.currency === 'EUR' ? 'Achat EUR' : 'Achat USDT';
            case 'service': return 'Service numérique';
            case 'payment': return entry.method === 'cash' ? 'Versement espèces' : entry.method === 'baridi' ? 'Versement BaridiMob' : entry.method === 'usdt' ? 'Versement en USDT' : entry.method === 'eur' ? 'Versement en euros' : 'Versement';
            case 'saleToUs': return entry.currency === 'EUR' ? 'Vente EUR à ProDigital' : 'Vente USDT à ProDigital';
            case 'withdrawal': return 'Retrait sur votre solde';
            case 'transfer': return entry.balanceCents >= 0 ? 'Transfert en votre faveur' : 'Transfert à votre charge';
            case 'opening': return 'Solde d’ouverture';
            case 'writeOff': return 'Remise sur votre dette';
            default: return entry.balanceCents >= 0 ? 'Ajout à votre solde' : 'Déduction de votre solde';
        }
    },
    onAccount: 'sur compte',
    footer: 'Ce rapport résume vos opérations avec ProDigital. Signalez-nous toute différence sous 7 jours.',
};

export const REPORT_WORDS: Record<ReportLang, ReportWords> = { ar: AR, fr: FR };

const numberFormats = new Map<string, Intl.NumberFormat>();
function numberFormat(min: number, max: number) {
    const key = `${min}-${max}`;
    if (!numberFormats.has(key))
        numberFormats.set(key, new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max }));
    return numberFormats.get(key)!;
}
const compactFormat = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumSignificantDigits: 3 });
// French groups thousands with a narrow space, too thin to see in small print: a normal no-break
// space keeps 1 030 000 readable on paper and on a phone.
const wideSpaces = (text: string) => text.replace(/\u202F/g, '\u00A0');

/** DZD in cents, whole dinars unless the report shows cents. */
export const formatDzdCents = (cents: number, showCents: boolean) => wideSpaces(numberFormat(showCents ? 2 : 0, showCents ? 2 : 0).format(Math.abs(cents) / 100));
export const formatQuantity = (quantity: number) => wideSpaces(numberFormat(0, 2).format(quantity));
export const formatPrice = (price: number) => wideSpaces(numberFormat(2, 2).format(price));
export const formatEurPrice = (price: number) => wideSpaces(numberFormat(2, 4).format(price));
export const formatEur = (amount: number) => wideSpaces(numberFormat(2, 2).format(amount));
export const formatCompactDzd = (cents: number) => wideSpaces(compactFormat.format(cents / 100));
export const formatPercent = (pct: number) => `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`;
const pad2 = (value: number) => String(value).padStart(2, '0');
export const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
};
export const formatDayMonth = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
};
export const currencyUnit = (currency: ReportCurrency) => (currency === 'EUR' ? '€' : 'USDT');
