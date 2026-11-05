import type { Lang } from '../contexts/LanguageContext';

// Words of the first-time setup and of the « Business » settings card (M2), in Arabic and French.
const AR = {
    step: (n: number) => `الخطوة ${n} من 4`,
    next: 'التالي', back: 'رجوع', start: 'ابدأ العمل', skip: 'تخطَّ الآن', save: 'حفظ', saved: 'حُفظ',
    baseTitle: 'بأي عملة تحسب ربحك؟',
    baseHint: 'كل الأسعار والأرباح ورأس المال تُكتب بها. لا تتغيّر بعد أول عملية.',
    currenciesTitle: 'ماذا تشتري وتبيع؟',
    currenciesHint: 'اختر كل ما تتعامل به، ويمكن إضافة غيرها لاحقاً. التحويل بينها لا يُحسب ربحاً.',
    otherCode: 'رمز عملة أخرى (مثل CHF)', add: 'إضافة',
    accountsTitle: (base: string) => `حسابات ${base}`,
    accountsHint: (base: string) => `الحسابات التي تدفع منها وتستلم فيها ${base}: صندوق نقدي، بنك، محفظة إلكترونية. مخزون العملات الأخرى رقم واحد لكل عملة، مهما تعددت المحافظ.`,
    accountName: 'اسم الحساب', openingLater: 'الرصيد الافتتاحي يُسجَّل بعد ذلك كحركة في الخزينة، فيبقى أثره في السجل.',
    kind: { cash: 'نقد', bank: 'بنك', online: 'إلكتروني' },
    identityTitle: 'هوية تقاريرك', identityHint: 'تظهر في تقارير PDF وصور الملخص التي ترسلها لعملائك. اختيارية.',
    businessName: 'اسم النشاط', logo: 'الشعار', pickLogo: 'اختر صورة الشعار', removeLogo: 'إزالة',
    errors: { no_currency: 'اختر عملة واحدة على الأقل غير عملة الأساس.', no_account: 'أضف حساباً واحداً على الأقل.', logo_too_big: 'الصورة كبيرة جداً.', bad_currency: 'رمز عملة غير صالح.' },
    cardTitle: 'النشاط والعملات',
    cardHint: 'عملة الأساس، والعملات التي تتعامل بها، وحساباتك، وهوية التقارير. لا يتغيّر أي رصيد عند الحفظ.',
    baseLocked: (base: string) => `عملة الأساس: ${base} (ثابتة)`,
    legacyAccounts: 'الحسابات الحالية',
};
const FR: typeof AR = {
    step: (n) => `Étape ${n} sur 4`,
    next: 'Suivant', back: 'Retour', start: 'Commencer', skip: 'Passer pour l’instant', save: 'Enregistrer', saved: 'Enregistré',
    baseTitle: 'Dans quelle devise comptez-vous vos bénéfices ?',
    baseHint: 'Prix, bénéfices et capital s’écrivent dans cette devise. Elle ne change plus après la première opération.',
    currenciesTitle: 'Qu’achetez-vous et vendez-vous ?',
    currenciesHint: 'Choisissez tout ce que vous traitez ; d’autres pourront être ajoutées. Une conversion entre elles n’est pas un bénéfice.',
    otherCode: 'Code d’une autre devise (ex. CHF)', add: 'Ajouter',
    accountsTitle: (base) => `Comptes en ${base}`,
    accountsHint: (base) => `Les comptes d’où vous payez et où vous recevez des ${base} : caisse, banque, portefeuille en ligne. Le stock des autres devises reste un seul chiffre par devise, quel que soit le nombre de portefeuilles.`,
    accountName: 'Nom du compte', openingLater: 'Le solde d’ouverture s’enregistre ensuite comme mouvement de trésorerie, pour en garder la trace.',
    kind: { cash: 'Espèces', bank: 'Banque', online: 'En ligne' },
    identityTitle: 'Identité de vos rapports', identityHint: 'Visible sur les PDF et images envoyés à vos clients. Facultatif.',
    businessName: 'Nom de l’activité', logo: 'Logo', pickLogo: 'Choisir l’image du logo', removeLogo: 'Retirer',
    errors: { no_currency: 'Choisissez au moins une devise autre que la devise de base.', no_account: 'Ajoutez au moins un compte.', logo_too_big: 'Image trop lourde.', bad_currency: 'Code de devise invalide.' },
    cardTitle: 'Activité et devises',
    cardHint: 'Devise de base, devises traitées, comptes et identité des rapports. Aucun solde ne change à l’enregistrement.',
    baseLocked: (base) => `Devise de base : ${base} (fixe)`,
    legacyAccounts: 'Comptes actuels',
};
export const SETUP_WORDS: Record<Lang, typeof AR> = { ar: AR, fr: FR };

/** Shrinks a chosen image to at most 256 px and a JPEG/PNG data URL small enough to be stored on the user document. */
export function compressLogo(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error('image'));
            image.onload = () => {
                const scale = Math.min(1, 256 / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
                const png = canvas.toDataURL('image/png');
                resolve(png.length < 130_000 ? png : canvas.toDataURL('image/jpeg', 0.8));
            };
            image.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}
