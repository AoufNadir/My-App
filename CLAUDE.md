# ProDigital Tracker: ما يجب أن يعرفه Claude قبل أي عمل

اقرأ هذا الملف أولاً. التفاصيل في [`docs/PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md): خريطة الكود، أين يُحسب كل رقم، قرارات صاحب المشروع، النشر، وما بقي مفتوحاً. ونية صاحب المشروع الأصلية في [`CLAUDE_PROJECT_INTENT.md`](CLAUDE_PROJECT_INTENT.md) (كُتبت قبل سبتمبر 2026، وما تغيّر بعدها مذكور في الدليل).

آخر تحديث: 2026-10-03.

## التطبيق

تطبيق ويب (PWA) لنشاط صرف في الجزائر: شراء وبيع `USDT` و`EUR` مقابل الدينار `DZD`، نقداً أو عبر BaridiMob أو بالدَّين. يحسب المخزون ومتوسط سعر الشراء (PAM) وربح كل بيع، أرصدة العملاء وديونهم، الخزينة (`Caisse` و`BaridiMob`)، رأس مال المسيّر والمستثمرين وتوزيع الأرباح، ويصدر تقارير PDF. الواجهة بالفرنسية والعربية، ومعظم الاستعمال من الهاتف.

- الموقع الرسمي: https://proodigital-7ec70.web.app (Firebase Hosting، مشروع `proodigital-7ec70`). يعمل بـ `V3-1` منذ 2026-10-03، والفرع الافتراضي في GitHub هو `stable-2026-10-03`.
- التقنية: React 19 وTypeScript وVite 6 وTailwind v4 وFirebase (Auth وFirestore).
- المستودع `AoufNadir/My-App` **عام**: لا تكتب فيه أسماء عملاء أو مستثمرين، ولا أرقاماً حقيقية، ولا بيانات دخول.

## قواعد لا تُكسر

1. **صحة الحسابات أولاً.** تغيير الواجهة لا يغيّر أي رقم ولا أي حقل محفوظ. كل مرحلة تأتي باختبار يقارن الأرقام بالنسخة السابقة.
2. **لا تغيّر منطق توزيع الأرباح.** المسيّر يأخذ حصتين عن قصد: نسبة صاحب الفكرة وحصة رأس ماله. والمستثمر المؤرشف يحتفظ بحصته. هذا قرار صاحب المشروع، وليس خطأ.
3. **قاعدة البيانات حقيقية في كل مكان.** `npm run dev` ومعاينات Vercel وقنوات معاينة Firebase تتصل كلها بنفس البيانات الحقيقية. تصفّح فقط، ولا تسجّل عملية تجريبية.
4. **النشر على الموقع الرسمي** يتم من جهاز صاحب المشروع فقط، وبعد أن يكتب «انشر» صراحة. الوصفة وطريقة الرجوع في الدليل (§11).
5. **لا ملف `.env*` عند البناء للنشر.** Vite يدمج `VITE_READ_MODELS_MODE` و`VITE_READ_MODELS_SUMMARY_WRITE_MODE` في الملفات المبنية. السلوك المختبَر هو أن يكون الاثنان غير معرّفين.
6. **لا تلمس المجلد `F:\App\My-App\My-App`** على جهاز صاحب المشروع، ففيه عمل قديم غير محفوظ في GitHub. مجلد العمل والنشر هو `F:\App\My-App\preview-stable`.
7. **الربح يُحسب من `computePamLedger`** (`src/utils/pamLedger.ts`)، لا من `tx.profit` المحفوظ.
8. **العمليات مترابطة** عبر `linkedTxId` و`linkedTreasuryTxId` و`linkedAssetTxId`. الحذف يمر عبر `applyTransactionDelete` (`src/transactionService.ts`)، والتعديل يحافظ على التاريخ الأصلي (`operationStamp`).
9. **إشارة رصيد العميل:** موجب = له عندنا، سالب = دَين عليه. السطر الذي فيه `affectsBalance === false` تاريخي فقط ولا يدخل في الرصيد.
10. **الأشهر المقفلة** (بعد توزيع الأرباح) لا تُعدَّل. بوابة الكتابة في `src/firebase.ts` ترفض ذلك، وكذلك ترفض أي كتابة مالية قبل اكتمال المزامنة مع الخادم.

## الأوامر

```bash
npm ci
npm run dev        # http://localhost:3000 — بيانات حقيقية: تصفّح فقط
npm run ci         # typecheck + كل الاختبارات + build. يجب أن ينجح قبل أي رفع
```

- `npm test` سلسلة من `node --import tsx <ملف>` في `package.json`. **أضف كل ملف اختبار جديد إلى هذه السلسلة يدوياً**، وإلا فلن يعمل.
- الاختبارات تستعمل `node:assert` دون إطار اختبار. اختبارات الشاشات تستعمل `renderToStaticMarkup` وتقارن الأرقام بنسخة مرجعية من الكود السابق.
- أنواع React غير مثبتة (`@types/react`)، لذلك المكوّنات ذات الأنواع ترفض `key`: ضعها داخل `<Fragment key>`.
- GitHub Actions يشغّل `npm run ci` على كل PR، وVercel يبني معاينة لكل فرع.

## أين أجد ماذا

| الموضوع | الملفات |
| --- | --- |
| الدخول والتنقل | `src/index.tsx`، `src/AppContent.tsx`، `src/MainApp.tsx`، `src/hooks/useMainNavigation.ts` |
| أنواع البيانات | `src/types.ts` |
| Firestore وبوابة الكتابة | `src/firebaseApp.ts`، `src/firebase.ts`، `src/hooks/useAppData.ts` |
| PAM والربح | `src/utils/pamLedger.ts` |
| المستثمرون والتوزيع | `src/hooks/useInvestorEconomics.ts`، `src/utils/profitDistribution.ts`، `src/utils/managerCapital.ts` |
| الشراء والبيع والحذف | `src/hooks/useTransactionHandlers.ts`، `src/transactionService.ts` |
| العملاء | `src/hooks/useClientHandlers.ts`، `src/utils/clientRegistry.ts`، `src/components/clients/` |
| تقرير نشاط العميل | `src/utils/clientActivityReport.ts`، `src/components/clients/ClientActivityReport*` |
| الواجهة المشتركة | `src/styles/tokens.css`، `src/components/ui/`، `src/components/cards/` |
| الترجمة | `src/translations/index.ts`، `src/utils/alertMessages.ts`، `src/utils/formMessages.ts` |

الخريطة الكاملة في الدليل (§4 و§6).

## طريقة العمل مع صاحب المشروع

- اكتب له بالعربية، بوضوح وبساطة، وبترتيب، مع مثال عند الحاجة.
- اعرض الخطة أولاً، ونفّذ بعد موافقته. لا تغيّر الحسابات أو الأرقام أو المعلومات المعروضة دون إذنه.
- الفروع مرقّمة، وكل فرع مبني على السابق: `V1-1` ثم `V1-2`… ثم `V2-1`… ثم `V3-1`. كل PR يستهدف الفرع السابق. قرر صاحب المشروع (2026-10-03) أن تُرفع كل مرحلة كمسودة PR بعد نجاح فحوصها، دون أن تسأله كل مرة. أما النشر فلا يتم إلا بعد «انشر».
- صور الواجهة تكون ببيانات وهمية فقط، ولا تُؤخذ من التطبيق الحقيقي.
- ما يحتاج قراره يُسأل بسؤال واحد واضح، مع خيارات قصيرة وتوصية.
