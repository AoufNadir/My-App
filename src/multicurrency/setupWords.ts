import type { Lang } from '../contexts/LanguageContext';

// Words of the first-time setup and of the « Business » settings card (M2), in Arabic and French.
const AR = {
    step: (n: number) => `الخطوة ${n} من 4`,
    next: 'التالي', back: 'رجوع', start: 'ابدأ العمل', skip: 'تخطَّ الآن', save: 'حفظ', saved: 'حُفظ',
    baseTitle: 'بأي عملة تحسب ربحك؟',
    baseHint: 'كل الأسعار والأرباح ورأس المال تُكتب بها. لا تتغيّر بعد أول عملية.',
    currenciesTitle: 'ماذا تشتري وتبيع؟',
    currenciesHint: 'اختر كل ما تتعامل به، ويمكن إضافة غيرها لاحقاً. التحويل بينها لا يُحسب ربحاً.',
    otherCode: 'رمز عملة أخرى (مثل CHF)', add: 'إضافة', addAccount: 'إضافة حساب آخر',
    accountsTitle: (base: string) => `أين توجد أموالك بـ ${base}؟`,
    accountsHint: (base: string) => `اكتب كل مكان فيه مال بـ ${base}: الصندوق الذي في يدك، حسابك البريدي أو البنكي… سيعرض التطبيق رصيد كل واحد منها، ويسألك في كل بيع أو شراء: من أين دفعت؟ وإلى أين وصل المال؟`,
    accountsNote: 'محافظ USDT وغيرها من العملات لا تُكتب هنا: التطبيق يحسب مخزونها وحده.',
    suggestionsTitle: 'اختر بضغطة:',
    suggestions: [{ name: 'الصندوق', kind: 'cash' }, { name: 'BaridiMob', kind: 'bank' }, { name: 'CCP', kind: 'bank' }, { name: 'البنك', kind: 'bank' }, { name: 'محفظة إلكترونية', kind: 'online' }] as Array<{ name: string; kind: 'cash' | 'bank' | 'online' }>,
    kindHint: { cash: 'أوراق نقدية في يدك أو في درجك', bank: 'حساب بريدي أو بنكي (CCP، BaridiMob، بنك)', online: 'حساب على الإنترنت (Wise، PayPal…)' },
    kindQuestion: 'ما نوعه؟',
    accountName: 'اسم الحساب (مثل: الصندوق، CCP)', accountNumber: (n: number) => `الحساب ${n}`, accountKind: 'نوع الحساب', defaultCash: 'الصندوق', openingLater: 'الرصيد الموجود في كل حساب تكتبه بعد ذلك من صفحة الخزينة.',
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
    otherCode: 'Code d’une autre devise (ex. CHF)', add: 'Ajouter', addAccount: 'Ajouter un autre compte',
    accountsTitle: (base) => `Où se trouve votre argent en ${base} ?`,
    accountsHint: (base) => `Écrivez chaque endroit où vous avez des ${base} : la caisse en main, votre compte postal ou bancaire… L’app affichera le solde de chacun et vous demandera à chaque achat ou vente : d’où avez-vous payé ? où l’argent est-il arrivé ?`,
    accountsNote: 'Les portefeuilles USDT et autres devises ne s’écrivent pas ici : l’app compte leur stock seule.',
    suggestionsTitle: 'Choisir en un clic :',
    suggestions: [{ name: 'Caisse', kind: 'cash' }, { name: 'BaridiMob', kind: 'bank' }, { name: 'CCP', kind: 'bank' }, { name: 'Banque', kind: 'bank' }, { name: 'Portefeuille en ligne', kind: 'online' }],
    kindHint: { cash: 'Billets en main ou dans le tiroir', bank: 'Compte postal ou bancaire (CCP, BaridiMob, banque)', online: 'Compte en ligne (Wise, PayPal…)' },
    kindQuestion: 'Quel type ?',
    accountName: 'Nom du compte (ex. Caisse, CCP)', accountNumber: (n) => `Compte ${n}`, accountKind: 'Type de compte', defaultCash: 'Caisse', openingLater: 'Le solde de chaque compte se saisit ensuite depuis la page Trésorerie.',
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
