import type { InvestorTransaction } from '../../types';
import { translations } from '../../translations';
import type { InvestorReportOperationKind } from '../../utils/investorReport';
import type { ReportSheetLang } from '../reports/ReportSheet';

type PaymentSource = NonNullable<InvestorTransaction['paymentSource']>;

/**
 * Words of the investor report. The report has its own language, chosen when it is sent (an
 * investor can get French while the app is in Arabic), so it does not use the app's t(). The
 * operations keep the names the investor page gives them.
 */
export type InvestorReportWords = {
    brandTagline: string;
    title: string;
    reference: string;
    issued: string;
    investor: string;
    manager: string;
    period: string;
    /** « من X إلى Y », « منذ X », « حتى X », « كل السجل » */
    from: string;
    to: string;
    since: string;
    until: string;
    allHistory: string;
    /** Followed by the date the situation is given at */
    situationAt: string;
    capital: string;
    availableProfit: string;
    estimatedValue: string;
    fundShare: string;
    notes: string;
    performanceTitle: string;
    periodProfit: string;
    periodYield: string;
    movementCount: string;
    deposits: string;
    reinvested: string;
    /** The manager's profit kept in the business, in place of « reinvested » */
    retained: string;
    profitOut: string;
    /** The manager's personal expenses, in place of « profit withdrawn » */
    personalExpenses: string;
    netMovement: string;
    noMovement: string;
    operationsTitle: string;
    colDate: string;
    colOperation: string;
    colAmount: string;
    noOperation: string;
    operation: Record<InvestorReportOperationKind, string>;
    source: Record<PaymentSource, string>;
    footer: string;
};

function operationNames(lang: ReportSheetLang): Record<InvestorReportOperationKind, string> {
    const investors = translations[lang].investors;
    return {
        deposit: investors.txDepositCapital,
        withdrawCapital: investors.txWithdrawCapital,
        personalExpenseCapital: investors.txPersonalExpenseCapital,
        withdrawProfit: investors.txWithdrawProfit,
        personalExpense: investors.txPersonalExpense,
        reinvest: investors.txReinvestProfit,
        retained: investors.profitsReinvestedInCapital,
        distribution: investors.txProfitDistribution,
    };
}

function sourceNames(lang: ReportSheetLang): Record<PaymentSource, string> {
    const words = translations[lang].transactions;
    return { Caisse: words.cash, BaridiMob: words.baridi, USDT: 'USDT', EUR: 'EUR' };
}

export const INVESTOR_REPORT_WORDS: Record<ReportSheetLang, InvestorReportWords> = {
    ar: {
        brandTagline: 'صرف العملات',
        title: 'تقرير المستثمر',
        reference: 'رقم',
        issued: 'صدر في',
        investor: 'المستثمر',
        manager: 'المدير',
        period: 'الفترة',
        from: 'من',
        to: 'إلى',
        since: 'منذ',
        until: 'حتى',
        allHistory: 'كل السجل',
        situationAt: 'الوضع في',
        capital: 'رأس المال',
        availableProfit: 'الربح المتاح',
        estimatedValue: 'القيمة التقديرية',
        fundShare: 'الحصة من الصندوق',
        notes: 'ملاحظات',
        performanceTitle: 'الأداء والحركات',
        periodProfit: 'صافي ربح الفترة',
        periodYield: 'مردود الفترة',
        movementCount: 'عدد الحركات',
        deposits: 'إضافات رأس المال',
        reinvested: 'أعيد استثماره',
        retained: 'الأرباح المحتفظ بها',
        profitOut: 'سحب الأرباح',
        personalExpenses: 'المصاريف الشخصية',
        netMovement: 'صافي الحركة',
        noMovement: 'لا حركة في هذه الفترة.',
        operationsTitle: 'تفاصيل العمليات',
        colDate: 'التاريخ',
        colOperation: 'العملية',
        colAmount: 'المبلغ (DZD)',
        noOperation: 'لا عملية في هذه الفترة.',
        operation: operationNames('ar'),
        source: sourceNames('ar'),
        footer: 'هذا التقرير ملخص لحسابك الاستثماري مع ProDigital. إذا وجدت أي فرق، راسلنا خلال 7 أيام.',
    },
    fr: {
        brandTagline: 'Change de devises',
        title: 'Rapport investisseur',
        reference: 'N°',
        issued: 'Émis le',
        investor: 'Investisseur',
        manager: 'Gérant',
        period: 'Période',
        from: 'Du',
        to: 'au',
        since: 'Depuis le',
        until: 'Jusqu’au',
        allHistory: 'Tout l’historique',
        situationAt: 'Situation au',
        capital: 'Capital',
        availableProfit: 'Profit disponible',
        estimatedValue: 'Valeur estimée',
        fundShare: 'Part du fonds',
        notes: 'Notes',
        performanceTitle: 'Performance et mouvements',
        periodProfit: 'Profit net de la période',
        periodYield: 'Rendement de la période',
        movementCount: 'Nombre de mouvements',
        deposits: 'Ajouts capital',
        reinvested: 'Réinvesti',
        retained: 'Bénéfices conservés',
        profitOut: 'Retraits bénéfices',
        personalExpenses: 'Dépenses personnelles',
        netMovement: 'Mouvement net',
        noMovement: 'Aucun mouvement sur cette période.',
        operationsTitle: 'Détail des opérations',
        colDate: 'Date',
        colOperation: 'Opération',
        colAmount: 'Montant (DZD)',
        noOperation: 'Aucune opération sur cette période.',
        operation: operationNames('fr'),
        source: sourceNames('fr'),
        footer: 'Ce rapport résume votre compte d’investissement chez ProDigital. Signalez-nous toute différence sous 7 jours.',
    },
};
