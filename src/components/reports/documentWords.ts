import { translations } from '../../translations';
import type { ReportSheetLang } from './ReportSheet';

// The words of the monthly, personal-expenses and treasury reports (V3-6). A report has its own
// language, chosen when it is sent, so it does not use the app's t(): `reportTranslator(lang)` reads
// the app's wording in the report's language, for the names the app already gives to operations.

const lookup = (dictionary: unknown, key: string): unknown => key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dictionary);

/** The app's t() for one language, French where a key is missing in Arabic. */
export function reportTranslator(lang: ReportSheetLang): (key: string) => string {
    return (key) => {
        const value = lookup(translations[lang], key) ?? lookup(translations.fr, key);
        return typeof value === 'string' ? value : key;
    };
}

export const monthNames = (lang: ReportSheetLang): string[] => translations[lang].common.months;
export const weekdayNames = (lang: ReportSheetLang): string[] => translations[lang].common.weekdaysLong;

export type CommonReportWords = {
    brandTagline: string;
    reference: string;
    issued: string;
    period: string;
    /** « Client inconnu » */
    unknownClient: string;
    /** A sale or purchase that no client is attached to */
    notLinked: string;
    footer: string;
};

export const COMMON_REPORT_WORDS: Record<ReportSheetLang, CommonReportWords> = {
    ar: {
        brandTagline: 'صرف العملات',
        reference: 'رقم',
        issued: 'صدر في',
        period: 'الفترة',
        unknownClient: 'عميل غير معروف',
        notLinked: 'غير مرتبط',
        footer: 'وثيقة أنشأها تطبيق ProDigital تلقائيًا من سجلاتك.',
    },
    fr: {
        brandTagline: 'Change de devises',
        reference: 'N°',
        issued: 'Émis le',
        period: 'Période',
        unknownClient: 'Client inconnu',
        notLinked: 'Non lié',
        footer: 'Document généré automatiquement par ProDigital à partir de vos enregistrements.',
    },
};

export type MonthlyReportWords = {
    title: string;
    summaryTitle: string;
    realizedProfit: string;
    operations: string;
    topClient: string;
    usdtBoughtSold: string;
    eurBoughtSold: string;
    cumulativeProfit: string;
    buys: string;
    sells: string;
    clientMovements: string;
    portfolioTitle: string;
    usdtAvailable: string;
    eurAvailable: string;
    avgBuy: string;
    uncostedTitle: string;
    uncostedCount: string;
    uncostedQuantity: string;
    uncostedHidden: (count: number) => string;
    uncostedNote: string;
    colDate: string;
    colOperation: string;
    colCurrency: string;
    colSoldQuantity: string;
    colWithoutCost: string;
    colDerivedProfit: string;
    rankingTitle: (count: number) => string;
    colRank: string;
    colClient: string;
    colUsdtBuys: string;
    colUsdtSales: string;
    colVolume: string;
    colProfit: string;
    colOps: string;
    rankingHidden: (count: number) => string;
    rankingEmpty: string;
    operationsTitle: (count: number) => string;
    colType: string;
    colQuantity: string;
    colUnitPrice: string;
    colTotal: string;
    colNotes: string;
    operationsHidden: (count: number) => string;
    operationsEmpty: string;
    movementsTitle: (count: number) => string;
    colAmount: string;
    movementsHidden: (count: number) => string;
    movementsEmpty: string;
};

export const MONTHLY_REPORT_WORDS: Record<ReportSheetLang, MonthlyReportWords> = {
    ar: {
        title: 'التقرير الشهري',
        summaryTitle: 'الملخص التنفيذي',
        realizedProfit: 'ربح المبيعات المحقق (PAM)',
        operations: 'العمليات',
        topClient: 'أفضل عميل — ربح المبيعات (PAM)',
        usdtBoughtSold: 'USDT المشترى / المباع',
        eurBoughtSold: 'EUR المشترى / المباع',
        cumulativeProfit: 'ربح المبيعات التراكمي (PAM)',
        buys: 'مشتريات المحفظة',
        sells: 'مبيعات المحفظة',
        clientMovements: 'حركات العملاء',
        portfolioTitle: 'حالة المحفظة (الحالية)',
        usdtAvailable: 'USDT المتاح',
        eurAvailable: 'EUR المتاح',
        avgBuy: 'متوسط سعر الشراء (PAM)',
        uncostedTitle: 'تنبيهات محاسبية — متوسط سعر الشراء (PAM)',
        uncostedCount: 'عمليات بيع معنيّة',
        uncostedQuantity: 'كمية بلا تكلفة',
        uncostedHidden: (count) => `${count} عملية أخرى غير معروضة في هذا الملخص.`,
        uncostedNote: 'تنبيه للعلم فقط: هذه المبالغ غير مخصومة من الربح المحقق.',
        colDate: 'التاريخ',
        colOperation: 'العملية',
        colCurrency: 'العملة',
        colSoldQuantity: 'الكمية المباعة',
        colWithoutCost: 'بلا تكلفة',
        colDerivedProfit: 'الربح المحسوب',
        rankingTitle: (count) => `أفضل عملاء الشهر (${count})`,
        colRank: '#',
        colClient: 'العميل',
        colUsdtBuys: 'مشتريات USDT',
        colUsdtSales: 'مبيعات USDT',
        colVolume: 'الحجم',
        colProfit: 'الربح',
        colOps: 'عمليات',
        rankingHidden: (count) => `${count} عميل آخر غير معروض في هذا الملخص.`,
        rankingEmpty: 'لا يوجد ترتيب للعملاء في هذه الفترة.',
        operationsTitle: (count) => `تفاصيل عمليات المحفظة (${count})`,
        colType: 'النوع',
        colQuantity: 'الكمية',
        colUnitPrice: 'سعر الوحدة',
        colTotal: 'المجموع',
        colNotes: 'ملاحظات',
        operationsHidden: (count) => `${count} عملية إضافية غير معروضة ليبقى التقرير مقروءًا.`,
        operationsEmpty: 'لا توجد عمليات محفظة مسجلة في هذه الفترة.',
        movementsTitle: (count) => `حركات العملاء بالدينار (${count})`,
        colAmount: 'المبلغ',
        movementsHidden: (count) => `${count} حركة عميل إضافية غير معروضة.`,
        movementsEmpty: 'لا توجد حركات عملاء بالدينار في هذه الفترة.',
    },
    fr: {
        title: 'Rapport mensuel',
        summaryTitle: 'Synthèse exécutive',
        realizedProfit: 'Profit de vente réalisé (PAM)',
        operations: 'Opérations',
        topClient: 'Top client — profit de vente (PAM)',
        usdtBoughtSold: 'USDT acheté / vendu',
        eurBoughtSold: 'EUR acheté / vendu',
        cumulativeProfit: 'Profit de vente cumulé (PAM)',
        buys: 'Achats Portefeuille',
        sells: 'Ventes Portefeuille',
        clientMovements: 'Mouvements clients',
        portfolioTitle: 'État du portefeuille (actuel)',
        usdtAvailable: 'USDT disponible',
        eurAvailable: 'EUR disponible',
        avgBuy: 'Prix moyen d’achat (PAM)',
        uncostedTitle: 'Alertes comptables — prix moyen d’achat (PAM)',
        uncostedCount: 'Ventes concernées',
        uncostedQuantity: 'Quantité sans coût',
        uncostedHidden: (count) => `${count} autre(s) transaction(s) masquée(s) dans cette synthèse.`,
        uncostedNote: 'Alerte informative uniquement : ces montants ne sont pas retirés du profit réalisé.',
        colDate: 'Date',
        colOperation: 'Opération',
        colCurrency: 'Devise',
        colSoldQuantity: 'Quantité vendue',
        colWithoutCost: 'Sans coût',
        colDerivedProfit: 'Profit dérivé',
        rankingTitle: (count) => `Top clients du mois (${count})`,
        colRank: '#',
        colClient: 'Client',
        colUsdtBuys: 'Achats USDT',
        colUsdtSales: 'Ventes USDT',
        colVolume: 'Volume',
        colProfit: 'Profit',
        colOps: 'Ops',
        rankingHidden: (count) => `${count} autre(s) client(s) non affiché(s) dans cette synthèse.`,
        rankingEmpty: 'Aucun classement client disponible sur cette période.',
        operationsTitle: (count) => `Détail des opérations portefeuille (${count})`,
        colType: 'Type',
        colQuantity: 'Quantité',
        colUnitPrice: 'Prix unit.',
        colTotal: 'Total',
        colNotes: 'Notes',
        operationsHidden: (count) => `${count} opération(s) supplémentaire(s) masquée(s) pour garder le rapport lisible.`,
        operationsEmpty: 'Aucune opération portefeuille enregistrée sur cette période.',
        movementsTitle: (count) => `Mouvements clients DZD (${count})`,
        colAmount: 'Montant',
        movementsHidden: (count) => `${count} mouvement(s) client supplémentaire(s) masqué(s).`,
        movementsEmpty: 'Aucun mouvement client DZD sur cette période.',
    },
};

export type ExpensesReportWords = {
    title: string;
    day: string;
    week: string;
    month: string;
    year: string;
    /** « Semaine du 5 oct. » */
    weekOf: string;
    noPreviousPeriod: string;
    versusPrevious: string;
    summaryTitle: string;
    totalSpent: string;
    operationCount: string;
    averagePerDay: string;
    profitConsumed: string;
    profitToWithdraw: string;
    previousPeriod: string;
    biggestTitle: string;
    biggestFallback: string;
    noExpense: string;
    detailTitle: string;
    colDate: string;
    colTime: string;
    colSource: string;
    colNote: string;
    colAmount: string;
    confirmedExpense: string;
    settled: string;
    emptyPeriod: string;
    finalTotal: string;
    signature: string;
};

export const EXPENSES_REPORT_WORDS: Record<ReportSheetLang, ExpensesReportWords> = {
    ar: {
        title: 'تقرير المصاريف الشخصية',
        day: 'يوم',
        week: 'أسبوع',
        month: 'شهر',
        year: 'سنة',
        weekOf: 'أسبوع',
        noPreviousPeriod: 'لا توجد فترة سابقة للمقارنة',
        versusPrevious: 'مقارنة بالفترة السابقة',
        summaryTitle: 'الملخص',
        totalSpent: 'إجمالي المصروف',
        operationCount: 'عدد العمليات',
        averagePerDay: 'المعدل اليومي',
        profitConsumed: '% من الربح المستهلك',
        profitToWithdraw: 'ربح المدير القابل للسحب',
        previousPeriod: 'الفترة السابقة',
        biggestTitle: 'أكبر مصروف',
        biggestFallback: 'مصروف',
        noExpense: 'لا يوجد مصروف.',
        detailTitle: 'تفاصيل العمليات',
        colDate: 'التاريخ',
        colTime: 'الوقت',
        colSource: 'المصدر',
        colNote: 'ملاحظة',
        colAmount: 'المبلغ',
        confirmedExpense: 'مصروف شخصي مؤكد',
        settled: 'تمت التسوية',
        emptyPeriod: 'لا مصاريف في هذه الفترة.',
        finalTotal: 'المجموع النهائي',
        signature: 'التوقيع',
    },
    fr: {
        title: 'Rapport de dépenses personnelles',
        day: 'Jour',
        week: 'Semaine',
        month: 'Mois',
        year: 'Année',
        weekOf: 'Semaine du',
        noPreviousPeriod: 'Pas de période précédente comparable',
        versusPrevious: 'vs période précédente',
        summaryTitle: 'Résumé',
        totalSpent: 'Total dépensé',
        operationCount: 'Nombre d’opérations',
        averagePerDay: 'Moyenne / jour',
        profitConsumed: '% du profit consommé',
        profitToWithdraw: 'Profit gérant à retirer',
        previousPeriod: 'Période précédente',
        biggestTitle: 'Plus grosse dépense',
        biggestFallback: 'Dépense',
        noExpense: 'Aucune dépense.',
        detailTitle: 'Détail des opérations',
        colDate: 'Date',
        colTime: 'Heure',
        colSource: 'Source',
        colNote: 'Note',
        colAmount: 'Montant',
        confirmedExpense: 'Dépense personnelle confirmée',
        settled: 'Régularisé',
        emptyPeriod: 'Aucune dépense pour cette période.',
        finalTotal: 'Total final',
        signature: 'Signature',
    },
};

export type TreasuryReportWords = {
    title: string;
    situationAt: string;
    balancesTitle: string;
    caisse: string;
    baridi: string;
    netFlow: string;
    totalIn: string;
    totalOut: string;
    movementCount: string;
    movementsTitle: (count: number) => string;
    colDate: string;
    colTime: string;
    colType: string;
    colSource: string;
    colAmount: string;
    colNotes: string;
    empty: string;
};

export const TREASURY_REPORT_WORDS: Record<ReportSheetLang, TreasuryReportWords> = {
    ar: {
        title: 'تقرير الخزينة',
        situationAt: 'الوضع في',
        balancesTitle: 'الأرصدة الحالية',
        caisse: 'الصندوق',
        baridi: 'بريدي موب',
        netFlow: 'صافي التدفق (الفترة)',
        totalIn: 'إجمالي الداخل',
        totalOut: 'إجمالي الخارج',
        movementCount: 'الحركات',
        movementsTitle: (count) => `حركات الخزينة (${count})`,
        colDate: 'التاريخ',
        colTime: 'الوقت',
        colType: 'النوع',
        colSource: 'المصدر',
        colAmount: 'المبلغ (DZD)',
        colNotes: 'ملاحظات',
        empty: 'لا توجد حركات.',
    },
    fr: {
        title: 'Rapport de trésorerie',
        situationAt: 'Situation au',
        balancesTitle: 'Soldes actuels',
        caisse: 'Caisse',
        baridi: 'BaridiMob',
        netFlow: 'Flux net (période)',
        totalIn: 'Total entrées',
        totalOut: 'Total sorties',
        movementCount: 'Mouvements',
        movementsTitle: (count) => `Mouvements de trésorerie (${count})`,
        colDate: 'Date',
        colTime: 'Heure',
        colType: 'Type',
        colSource: 'Source',
        colAmount: 'Montant (DZD)',
        colNotes: 'Notes',
        empty: 'Aucun mouvement.',
    },
};
