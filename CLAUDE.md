# ProDigital Tracker: ما يجب أن يعرفه Claude قبل أي عمل

اقرأ هذا الملف أولاً. التفاصيل في [`docs/PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md): خريطة الكود، أين يُحسب كل رقم، قرارات صاحب المشروع، النشر، وما بقي مفتوحاً. ونية صاحب المشروع الأصلية في [`CLAUDE_PROJECT_INTENT.md`](CLAUDE_PROJECT_INTENT.md) (كُتبت قبل سبتمبر 2026، وما تغيّر بعدها مذكور في الدليل).

آخر تحديث: 2026-10-10.

## التطبيق

تطبيق ويب (PWA) لنشاط صرف في الجزائر: شراء وبيع `USDT` و`EUR` مقابل الدينار `DZD`، نقداً أو عبر BaridiMob أو بالدَّين. يحسب المخزون ومتوسط سعر الشراء (PAM) وربح كل بيع، أرصدة العملاء وديونهم، الخزينة (`Caisse` و`BaridiMob`)، رأس مال المسيّر والمستثمرين وتوزيع الأرباح، ويصدر تقارير PDF. الواجهة بالفرنسية والعربية، ومعظم الاستعمال من الهاتف.

- الموقع الرسمي: https://proodigital-7ec70.web.app (Firebase Hosting، مشروع `proodigital-7ec70`). يعمل بـ `V3-1` منذ 2026-10-03، وكوده في الفرع المستقر `stable-2026-10-03`. والفرع الافتراضي في GitHub هو `stable-2026-10-03` (تحقق منه في 2026-10-10).
- التقنية: React 19 وTypeScript وVite 6 وTailwind v4 وFirebase (Auth وFirestore).
- المستودع `AoufNadir/My-App` **عام**: لا تكتب فيه أسماء عملاء أو مستثمرين، ولا أرقاماً حقيقية، ولا بيانات دخول.

## أين توقف العمل (2026-10-10)

- آخر عمل في الفرع `V4-1`: أربع مسودات فحوصها ناجحة ولم تُنشر: `V3-3` (PR #22، تقرير العميل من تاريخ إلى تاريخ)، و`V3-4` (PR #23، تنبيه المستثمرين كل 3 أشهر)، و`V3-5` (PR #24، الإطار المشترك للتقارير وتقرير المستثمر على شكل تقرير العميل)، و`V4-1` (PR #25، أرباح الأعمال الأخرى في بطاقة منفصلة في الرئيسية، و«ربحي الحقيقي» من بيع USDT وEUR فقط).
- من طلبي صاحب المشروع (2026-10-09): الأول تمّ في `V4-1`. والثاني، حقول نسخ لعناوين محافظ العميل (BEP20 وTRC20)، هو `V4-2` من `V4-1`. سُمّيا `V4` لأن `V3-6` و`V3-7` محجوزتان لبقية التقارير (الدليل §8).
- بعدهما `V3-6` و`V3-7` (بقية تقارير PDF على شكل تقرير العميل)، فوق آخر فرع في السلسلة. خطة التقارير في الدليل (§9).
- ينتظر صاحب المشروع: تجربة المسودات من `V3-3` إلى `V4-1`، وحذف الفروع القديمة بعد أن يكتب «احذف» (الدليل §13)، وسؤال واحد: هل تُفصل أرباح الخدمات أيضاً في صفحة المسيّر (الدليل §13، البند 17).

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
| تنبيه المستثمرين كل 3 أشهر | `src/utils/investorTerms.ts`، `src/hooks/useInvestorTerms.ts`، `src/components/investors/InvestorTermAlert.tsx` |
| أرباح الأعمال الأخرى (الخدمات) في الرئيسية، منفصلة عن ربح USDT وEUR | `src/utils/serviceProfitOverview.ts`، `src/components/dashboard/ServiceProfitCard.tsx`، و`dailyOverview.ownerProfitSplit` في `src/MainApp.tsx` |
| التقارير على شكل تقرير العميل (الإطار المشترك) | `src/components/reports/`، `src/components/investor-details/InvestorReport*`، `src/utils/investorReport.ts` |
| التقارير القديمة (تنتقل في `V3-6` و`V3-7`) | `src/utils/pdfReports.ts`، `src/hooks/useReportExports.ts` |
| الواجهة المشتركة | `src/styles/tokens.css`، `src/components/ui/`، `src/components/cards/` |
| الترجمة | `src/translations/index.ts`، `src/utils/alertMessages.ts`، `src/utils/formMessages.ts` |

الخريطة الكاملة في الدليل (§4 و§6).

## طريقة العمل مع صاحب المشروع

- اكتب له بالعربية، بوضوح وبساطة، وبترتيب، مع مثال عند الحاجة.
- اعرض الخطة أولاً، ونفّذ بعد موافقته. لا تغيّر الحسابات أو الأرقام أو المعلومات المعروضة دون إذنه.
- الفرع الرئيسي `stable-2026-10-03`، ونسخته الاحتياطية `backup-stable-2026-10-03` لا تُعدَّل. الفروع مرقّمة، وكل فرع مبني على السابق: `V3-3` من `stable-2026-10-03`، ثم `V3-4` من `V3-3`، ثم `V3-5` من `V3-4`، ثم `V4-1` من `V3-5`… وكل PR يستهدف الفرع السابق. قرر صاحب المشروع (2026-10-03) أن تُرفع كل مرحلة كمسودة PR بعد نجاح فحوصها، دون أن تسأله كل مرة. أما النشر فلا يتم إلا بعد «انشر».
- صور الواجهة تكون ببيانات وهمية فقط، ولا تُؤخذ من التطبيق الحقيقي.
- ما يحتاج قراره يُسأل بسؤال واحد واضح، مع خيارات قصيرة وتوصية.
