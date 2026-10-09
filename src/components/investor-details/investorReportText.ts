import type { ReportSheetLang } from '../reports/ReportSheet';
import type { InvestorReportRowKind } from '../../utils/investorReport';

/**
 * Words of the investor report. Like the client report it has its own language, chosen when it is
 * sent, so it does not use the app's t(). The row names are the investor page's (getTxMeta).
 */
export type InvestorReportWords = {
    brandTagline: string;
    title: string;
    reference: string;
    issued: string;
    investor: string;
    manager: string;
    period: string;
    periodText: (startTs: number | null, endTs: number | null, date: (timestamp: number) => string) => string;
    situationTitle: string;
    capital: string;
    availableProfit: string;
    estimatedValue: string;
    share: string;
    notes: string;
    performanceTitle: string;
    periodProfit: string;
    yield: string;
    movementCount: string;
    capitalAdded: string;
    reinvested: string;
    retained: string;
    profitOut: string;
    personalExpenses: string;
    capitalWithdrawn: string;
    netMovement: string;
    noMovement: string;
    operationsTitle: string;
    noOperation: string;
    colDate: string;
    colType: string;
    colAmount: string;
    colSource: string;
    colNotes: string;
    kind: Record<InvestorReportRowKind, string>;
    footer: string;
};

export const INVESTOR_REPORT_WORDS: Record<ReportSheetLang, InvestorReportWords> = {
    ar: {
        brandTagline: 'صرف العملات',
        title: 'تقرير المستثمر',
        reference: 'رقم',
        issued: 'صدر في',
        investor: 'المستثمر',
        manager: 'المسيّر',
        period: 'الفترة',
        periodText: (startTs, endTs, date) => (startTs != null && endTs != null
            ? `من ${date(startTs)} إلى ${date(endTs)}`
            : startTs != null ? `ابتداءً من ${date(startTs)}` : endTs != null ? `حتى ${date(endTs)}` : 'كل السجل'),
        situationTitle: 'الوضع في تاريخ النهاية',
        capital: 'رأس المال الحالي',
        availableProfit: 'الربح المتاح',
        estimatedValue: 'القيمة التقديرية',
        share: 'الحصة من الصندوق',
        notes: 'ملاحظات',
        performanceTitle: 'الأداء والحركات',
        periodProfit: 'صافي ربح الفترة',
        yield: 'مردود الفترة',
        movementCount: 'عدد الحركات',
        capitalAdded: 'إضافات رأس المال',
        reinvested: 'أعيد استثماره',
        retained: 'الأرباح المحتفظ بها',
        profitOut: 'سحب الأرباح',
        personalExpenses: 'المصاريف الشخصية',
        capitalWithdrawn: 'سحب رأس المال',
        netMovement: 'صافي الحركة',
        noMovement: 'لا توجد حركات في هذه الفترة.',
        operationsTitle: 'تفاصيل العمليات',
        noOperation: 'لا توجد عمليات في هذه الفترة.',
        colDate: 'التاريخ',
        colType: 'النوع',
        colAmount: 'المبلغ',
        colSource: 'المصدر',
        colNotes: 'ملاحظة',
        kind: {
            profitDistribution: 'توزيع ربح',
            withdrawProfit: 'سحب ربح',
            personalExpense: 'مصروف شخصي',
            reinvestProfit: 'إعادة استثمار',
            retainedProfit: 'الأرباح المحتفظ بها داخل المشروع',
            depositCapital: 'إضافة رأس مال',
            personalExpenseCapital: 'مصروف شخصي من رأس المال',
            withdrawCapital: 'سحب رأس مال',
        },
        footer: 'هذا التقرير ملخص لاستثمارك مع ProDigital. إذا وجدت أي فرق، راسلنا خلال 7 أيام.',
    },
    fr: {
        brandTagline: 'Change de devises',
        title: 'Rapport investisseur',
        reference: 'N°',
        issued: 'Émis le',
        investor: 'Investisseur',
        manager: 'Gérant',
        period: 'Période',
        periodText: (startTs, endTs, date) => (startTs != null && endTs != null
            ? `du ${date(startTs)} au ${date(endTs)}`
            : startTs != null ? `à partir du ${date(startTs)}` : endTs != null ? `jusqu’au ${date(endTs)}` : 'Tout l’historique'),
        situationTitle: 'Situation à la date de fin',
        capital: 'Capital actuel',
        availableProfit: 'Profit disponible',
        estimatedValue: 'Valeur estimée',
        share: 'Part du fonds',
        notes: 'Notes',
        performanceTitle: 'Performance et mouvements',
        periodProfit: 'Profit net de la période',
        yield: 'Rendement de la période',
        movementCount: 'Nombre de mouvements',
        capitalAdded: 'Ajouts capital',
        reinvested: 'Réinvesti',
        retained: 'Bénéfices conservés',
        profitOut: 'Retraits bénéfices',
        personalExpenses: 'Dépenses personnelles',
        capitalWithdrawn: 'Retraits capital',
        netMovement: 'Mouvement net',
        noMovement: 'Aucun mouvement sur cette période.',
        operationsTitle: 'Détail des opérations',
        noOperation: 'Aucune opération sur cette période.',
        colDate: 'Date',
        colType: 'Type',
        colAmount: 'Montant',
        colSource: 'Source',
        colNotes: 'Notes',
        kind: {
            profitDistribution: 'Distribution de profit',
            withdrawProfit: 'Retrait de profit',
            personalExpense: 'Dépense personnelle',
            reinvestProfit: 'Réinvestissement',
            retainedProfit: 'Bénéfices conservés dans le projet',
            depositCapital: 'Ajout de capital',
            personalExpenseCapital: 'Dépense personnelle (capital)',
            withdrawCapital: 'Retrait de capital',
        },
        footer: 'Ce rapport résume votre investissement chez ProDigital. Signalez-nous toute différence sous 7 jours.',
    },
};
