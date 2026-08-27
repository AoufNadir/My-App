# ملف نية المشروع الكاملة - ProDigital Tracker

> هذا الملف مخصص لإرساله إلى Claude أو أي مساعد برمجي آخر قبل العمل على المشروع.  
> اعتبره "ذاكرة المشروع": الهدف، قواعد العمل، البنية، وأهم التحذيرات حتى لا يتم كسر المنطق المالي الحالي.

## 1. ملخص المشروع

المشروع هو تطبيق ويب لإدارة نشاط مالي يومي باسم `ProDigital Tracker`.  
الفكرة الأساسية: تتبع شراء وبيع `USDT` و `EUR` مقابل الدينار الجزائري `DZD`، مع ربط كل عملية بالعملاء، الخزينة، المستثمرين، التقارير، والمخزون.

التطبيق ليس مجرد جدول عمليات. هو نظام محاسبة مصغر يجمع بين:

- محفظة USDT/EUR مع حساب متوسط سعر الشراء `PAM`.
- سجل عملاء بالدينار مع ديون، تسبيقات، تسويات، وتحويلات بين العملاء.
- خزينة داخلية مقسمة إلى `Caisse` و `BaridiMob`.
- إدارة مستثمرين وتوزيع الأرباح عليهم بناء على الربح المحسوب من دفتر PAM.
- أصول أو خدمات يدوية `Manual Assets` لإدارة أعمال/خدمات خارج تداول USDT/EUR.
- تقارير PDF شهرية، تقارير عملاء، وتقارير مستثمرين.
- واجهة PWA تعمل على الهاتف، مع دعم فرنسي أساسي ودعم عربي جزئي.

## 2. نية المنتج

هدف التطبيق هو إعطاء صاحب النشاط لوحة واحدة يرى منها:

- كم يملك من USDT و EUR حاليا.
- كم متوسط تكلفة شراء كل عملة.
- كم الربح المحقق من البيع، بدقة تاريخية.
- من هم العملاء الذين عليهم دين أو لديهم تسبيق.
- كم يوجد في الصندوق النقدي `Caisse` وكم في `BaridiMob`.
- هل الربح قابل للتوزيع على المستثمرين، وكم نصيب كل مستثمر.
- ما هي العمليات الخطرة أو غير المتوازنة مثل بيع كمية بلا تكلفة شراء، أو دين متأخر، أو سحب مستثمر أكثر من ربحه.

النية UX: التطبيق يجب أن يكون سريعًا على الهاتف، عمليًا، كثيف المعلومات بدون ضجيج، ومناسبًا للاستخدام اليومي أثناء العمليات المالية.

## 3. التكنولوجيا الحالية

- Frontend: React 19 + TypeScript + Vite.
- Styling: Tailwind CSS v4 عبر `@tailwindcss/vite`.
- Animations: Framer Motion.
- Charts: Recharts.
- Backend/Data: Firebase Auth + Firestore.
- PWA: manifest + service worker في `public`.
- Build/deploy: Vite build + Firebase Hosting.

الأوامر الأساسية:

```bash
npm install
npm run dev
npm run build
npm run preview
```

منفذ التطوير الافتراضي في `vite.config.ts` هو `3000`.

## 4. ملفات الدخول والبنية العامة

- `src/index.tsx`: نقطة تشغيل React.
- `src/App.tsx`: يلف التطبيق بـ `LanguageProvider`.
- `src/AppContent.tsx`: يراقب Firebase Auth ويعرض شاشة الدخول أو `MainApp`.
- `src/MainApp.tsx`: مركز التطبيق، يجمع البيانات والحالة والحوارات والتنقل.
- `src/types.ts`: أهم عقود البيانات.
- `src/firebaseApp.ts`: إعداد Firebase.
- `src/firebase.ts`: طبقة توافق صغيرة فوق Firestore modular API، تعطي واجهة شبيهة بـ compat.
- `src/firebaseAuth.ts`: Auth instance ونوع المستخدم.
- `src/contexts/LanguageContext.tsx`: اللغة والاتجاه `fr/ar`.
- `src/translations/index.ts`: قاموس النصوص. الفرنسية كاملة أكثر من العربية، والعربية تسقط تلقائيًا إلى الفرنسية عند نقص المفتاح.

## 5. الشاشات الرئيسية

التنقل الرئيسي في التطبيق:

- `dashboard`: الصفحة الرئيسية، ملخص الحالة المالية والتنبيهات.
- `transactions`: سجل العمليات، يشمل عمليات المحفظة، العملاء، الخزينة، والتحويلات.
- `dzd`: العملاء وأرصدتهم وتفاصيل كل عميل.
- `statistiques`: حالة المخزون والمحفظة ومحاكاة PAM.
- `analytics`: تقارير وتحليلات شهرية وترتيب العملاء.
- `tresorerie`: الخزينة، بطاقات الخزينة، الأصول اليدوية، وأرصدة Caisse/BaridiMob.
- `investors`: المستثمرون وتوزيع الأرباح.

هناك مسار خاص للمستثمر:

- إذا كان الرابط يحتوي على `investorId`، يتم عرض `InvestorDashboardPage` كواجهة مختصرة للمستثمر.

## 6. نموذج البيانات في Firestore

كل بيانات المستخدم محفوظة تحت:

```text
users/{uid}/...
```

المجموعات الفرعية الأساسية:

- `usdt_txs`: عمليات المحفظة لكل من USDT و EUR.
- `dzd_clients`: العملاء.
- `dzd_client_txs`: عمليات أرصدة العملاء بالدينار.
- `treasury_txs`: عمليات الخزينة.
- `treasury_cards`: بطاقات أو مصادر خزينة يدوية.
- `manual_assets`: أصول/خدمات يدوية.
- `manual_asset_clients`: عملاء مرتبطون بالأصول اليدوية.
- `actifTransactions`: عمليات الأصول اليدوية.
- `investors`: المستثمرون.
- `investor_transactions`: عمليات رأس المال والربح للمستثمرين.

ملاحظة مهمة: يوجد مجلد `dataconnect` و SDK مولد باسم `src/dataconnect-generated`، لكنه يبدو مثالًا/بقايا توليد ولا يستخدمه التطبيق الحالي فعليًا في منطق العمل. المنطق الحي يعتمد على Firestore collections أعلاه.

## 7. أنواع البيانات المهمة

راجع `src/types.ts` قبل تعديل أي منطق مالي.

### `Tx`

يمثل عملية محفظة USDT/EUR:

- `type`: واحد من `buy`, `sell`, `Ajout Manuel`, `Retrait Manuel`.
- `currency`: `USDT` أو `EUR`.
- `quantity`: الكمية.
- `price`: سعر الشراء.
- `sell`: سعر البيع.
- `total`: الإجمالي بالدينار.
- `profit`: ربح محفوظ تاريخيًا، لكن لا يجب الوثوق به دائمًا للتوزيع.
- `linkedTxId`: رابط لعملية أخرى، خصوصًا تحويل EUR إلى USDT.
- `linkedClientId`, `linkedClientDzdId`: روابط قديمة أو مساعدة لعملاء DZD.
- `clientPaymentStatus`: `credit`, `baridi`, `cash`.
- `paymentMethod`: `Espèces`, `BaridiMob`, `Crédit`.
- `tags`: وسوم اختيارية للتصفية.

### `ClientDzd` و `ClientTransactionDzd`

يمثلان العميل ودفتر رصيده بالدينار.

قاعدة الإشارة:

- `montant > 0`: تسبيق/رصيد موجب للعميل أو استلام مبلغ.
- `montant < 0`: دين على العميل أو دفع مبلغ له.
- `affectsBalance === false`: صف تاريخي فقط لا يؤثر على الرصيد.

أنواع العمليات تشمل:

- `Règlement Reçu`
- `Paiement Effectué`
- `Vente USDT`
- `Vente EUR`
- `Achat EUR`
- `Solde Initial`
- `Transfert Entrant`
- `Transfert Sortant`
- `Ajustement Solde`

### `TreasuryTx`

يمثل حركة الخزينة:

- `type`: `Ajout`, `Retrait`, `Adjustment (+)`, `Adjustment (-)`, `Transfer`.
- `source` و `destination`: غالبًا `Caisse` أو `BaridiMob`.
- `amount`: دائمًا مبلغ موجب، واتجاه التأثير يأتي من `type`.
- `origin`: يوضح مصدر الحركة مثل `manual_asset`, `client_tx`, `usdt_tx`, `balance_edit`.

### المستثمرون

- `Investor`: بيانات المستثمر ورأس ماله والأرباح المحسوبة.
- `InvestorTransaction`: عمليات رأس المال والربح:
  - `deposit_capital`
  - `withdraw_capital`
  - `profit_distribution`
  - `withdraw_profit`
  - `reinvest_profit`

## 8. قواعد PAM والأرباح

أهم ملف مالي في المشروع:

- `src/utils/pamLedger.ts`

هذا الملف يحسب دفتر PAM بطريقة تاريخية مرتبة بالوقت:

- الشراء أو `Ajout Manuel` بتكلفة يزيد الكمية وتكلفة المخزون.
- البيع ينقص الكمية ويحسب الربح بناءً على متوسط الشراء التاريخي وقت البيع.
- `Retrait Manuel` ينقص الكمية بدون ربح.
- إذا تم بيع كمية أكبر من الكمية ذات التكلفة، تظهر تحذيرات مثل `oversell` أو `uncosted_quantity_sold`.
- إذا كان `tx.profit` المخزن يختلف عن الربح المشتق من PAM، تظهر `stored_mismatch`.
- تحويلات EUR -> USDT يتم اكتشافها وربطها تحليليًا عبر `linkedTxId` أو قرب الوقت والملاحظات.

قاعدة مهمة جدًا:

> لا تستخدم `tx.profit` كمصدر نهائي للحقيقة عند حساب الربح أو توزيع أرباح المستثمرين. استخدم `computePamLedger(transactions)` وخصوصًا `profitByTxId[tx.id].derivedProfit`.

السبب: توجد عمليات تاريخية فيها `profit` محفوظ قديمًا، لكن بعد تعديل شراء سابق يجب أن يتغير الربح المشتق للبيعات اللاحقة.

## 9. قواعد توزيع أرباح المستثمرين

الملف الأساسي:

- `src/hooks/useInvestorEconomics.ts`

التوزيع يعتمد على:

- الربح المشتق من `computePamLedger`.
- رأس مال كل مستثمر في لحظة البيع، وليس فقط رأس ماله الحالي.
- المستثمر لا يشارك في بيع حدث قبل دخوله أو قبل إيداع رأس ماله.
- نسبة المدير `managerFeePercentage` تخصم من الربح قبل توزيع الباقي.
- الأرباح أو الخسائر توزع تناسبيًا حسب رأس المال المؤهل وقت البيع.
- السحب وإعادة الاستثمار يتم خصمهما من `availableProfit`.

تحذيرات المستثمرين مهمة ولا يجب حذفها:

- `available_profit_negative`
- `withdrawals_exceed_derived_profit`
- `uncosted_quantity_sold`
- `negative_derived_profit`

## 10. قواعد الربط بين العمليات

عمليات التطبيق مترابطة. عند إنشاء أو تعديل أو حذف عملية، يجب الحفاظ على الروابط.

### شراء USDT/EUR

يتم من خلال `useTransactionHandlers.handleBuy`.

السيناريوهات:

- شراء بـ DZD من عميل:
  - يتم إنشاء `usdt_txs`.
  - يتم إنشاء عملية عميل في `dzd_client_txs`.
  - إذا الدفع `cash` أو `baridi` وليس دينًا، يتم إنشاء حركة خزينة `Retrait`.
  - إذا الدفع `credit`، يؤثر على رصيد العميل ولا يغير الخزينة.
- شراء USDT باستعمال EUR:
  - يتم إنشاء عملية شراء USDT.
  - يتم إنشاء عملية `Retrait Manuel` في EUR مرتبطة بالشراء.

### بيع USDT/EUR

يتم من خلال `useTransactionHandlers.handleSell`.

السيناريوهات:

- البيع دائمًا ينشئ `usdt_txs` من نوع `sell`.
- إذا الدفع `cash` أو `baridi`، قد يضيف للخزينة حسب طريقة الدفع.
- إذا الدفع `credit`، ينعكس على رصيد العميل.
- الربح القديم قد يخزن في العملية، لكن التحليل الصحيح يجب أن يرجع إلى PAM ledger.

### الحذف

الملف الأساسي:

- `src/transactionService.ts`

استخدم `applyTransactionDelete` عند حذف عملية مترابطة.  
لا تحذف وثيقة واحدة فقط إذا كانت لها روابط، لأن ذلك يترك أرصدة العملاء أو الخزينة غير متوازنة.

الحذف يبحث في:

- `dzd_client_txs`
- `treasury_txs`
- `usdt_txs`
- `actifTransactions`

ويتعامل مع الحالات القديمة مثل سحب EUR المرتبط بشراء USDT.

## 11. العملاء والديون

الملفات المهمة:

- `src/hooks/useClientHandlers.ts`
- `src/hooks/useOverdueDebtClients.ts`
- `src/pages/ClientsPage.tsx`
- `src/components/clients/*`

قواعد مهمة:

- لا يمكن حذف عميل إذا كان رصيده غير صفري.
- إذا كان رصيده صفرًا لكن لديه تاريخ، يمكن حذف العميل مع تاريخه بعد تأكيد.
- التحويل بين العملاء ينشئ زوج عمليات:
  - `Transfert Sortant`
  - `Transfert Entrant`
- الديون المتأخرة تحسب عبر FIFO بسيط:
  - الديون السالبة تدخل طابور دين.
  - المدفوعات الموجبة تغلق أقدم دين أولًا.
  - العميل يعتبر متأخرًا إذا بقي دين أقدم من `minDays`، والقيمة الافتراضية 7 أيام.

## 12. الخزينة والأصول اليدوية

الملفات المهمة:

- `src/pages/TresoreriePage.tsx`
- `src/hooks/useAssetHandlers.ts`
- `src/pages/ManualAssetPage.tsx`
- `src/pages/ManualClientPage.tsx`

الخزينة تقسم إلى:

- `Caisse`: النقد.
- `BaridiMob`: حساب بريدي موب.

الأصول اليدوية تستخدم لإدارة خدمات أو مشاريع خارج تداول العملة:

- كل أصل له عملاء.
- كل عميل له عمليات.
- `payment_received` مع `cash` أو `baridi` ينشئ أيضًا حركة خزينة.
- عند تعديل أو حذف عملية أصل يدوية، يجب تحديث أو حذف حركة الخزينة المرتبطة إن وجدت.

## 13. التقارير والتحليلات

الملفات المهمة:

- `src/hooks/useReportExports.ts`
- `src/utils/pdfReports.ts`
- `src/components/analytics/useAnalyticsViewModel.ts`
- `src/pages/AnalyticsPage.tsx`
- `src/pages/PortfolioPage.tsx`

الوظائف:

- تقرير شهري للمحفظة.
- تقرير خاص بعميل.
- تقرير خاص بمستثمر.
- ترتيب العملاء شهريًا حسب حجم التداول والربح.
- Heatmap للأرباح اليومية.
- محاكاة بيع USDT لمعرفة الربح المتوقع.
- محاكاة PAM عند شراء USDT بالدينار أو عبر EUR.

قاعدة مهمة:

> التقارير الشهرية والأرباح يجب أن تعتمد على `computePamLedger` حتى تكون متسقة مع أرباح المستثمرين.

## 14. الاستيراد والتصدير

- يوجد مكون عام لاستيراد CSV: `src/components/import/CsvImportSheet.tsx`.
- يوجد parser في `src/utils/csv.ts`.
- حاليًا يوجد تدفق لاستيراد العملاء في `MainApp.tsx`.
- الاستيراد يتجنب التكرار بالاسم أو الهاتف، وينشئ `Solde Initial` إذا توفر عمود الرصيد الابتدائي.
- يوجد تصدير/طباعة PDF عبر فتح نافذة HTML قابلة للطباعة.
- توجد مشاركة/تحميل صورة لملخص العميل باستخدام `html-to-image`.

## 15. اللغة والاتجاه

- الفرنسية هي اللغة الأكثر اكتمالًا.
- العربية مدعومة جزئيًا.
- `LanguageContext` يضبط `document.documentElement.dir` إلى `rtl` عند العربية.
- عند نقص ترجمة عربية، يعود التطبيق إلى الفرنسية.

عند إضافة نصوص جديدة:

- أضفها إلى الفرنسية أولًا.
- أضف العربية إذا كانت الشاشة مستخدمة بالعربية.
- لا تضع نصوصًا ثابتة كثيرة داخل المكونات إذا كان لها مفتاح ترجمة مناسب.

## 16. مبادئ التصميم الحالية

التطبيق مصمم كأداة عمل مالية:

- واجهة كثيفة لكن قابلة للمسح السريع.
- دعم ممتاز للهاتف.
- Bottom navigation على الهاتف.
- FAB سريع حسب الصفحة.
- بطاقات KPI واضحة.
- ألوان دلالية: أخضر للربح، أحمر للخطر/الدين، كهرماني للتحذير، أزرق/بنفسجي للتنظيم.
- لا تجعل الشاشة Landing Page؛ الصفحة الأولى هي تجربة عمل فعلية.

## 17. الأداء والتنظيم

المشروع يستخدم:

- `React.lazy` لتقسيم الصفحات الثقيلة.
- `Suspense` و `SkeletonList` أثناء التحميل.
- `memo` ومقارنات props مخصصة في `MainContentArea`.
- اشتراكات Firestore مشروطة لبعض الأقسام الثقيلة:
  - manual assets لا تشترك دائمًا.
  - المستثمرون لا يشتركون دائمًا.
  - treasury cards لا تشترك دائمًا.

عند إضافة ميزة:

- لا تضف اشتراك Firestore دائم إذا كان القسم لا يحتاجه طوال الوقت.
- اجعل الحسابات الثقيلة داخل `useMemo`.
- حافظ على تحديث العمليات المترابطة عبر batch قدر الإمكان.

## 18. الاختبارات والملفات التحققية

توجد اختبارات/سكريبتات في `scripts` ونسخ مبنية في `dist-verify`، أهمها:

- `scripts/pamLedger.test.ts`
- `scripts/pamLedger.compare-useAppData.test.ts`
- `scripts/investorEconomics.pamLedger.test.ts`
- `scripts/reconcile-pam-profit.mjs`
- `scripts/verify-pam-fix.mjs`

هذه الاختبارات توثق حالات حساسة، خصوصًا:

- الفرق بين `storedProfit` و `derivedProfit`.
- عملية تاريخية باسم `jGd0Hug9GvHZ3pxrSrDR`.
- توزيع أرباح المستثمرين بناءً على derived PAM profit.
- حالات البيع بكمية بلا تكلفة كاملة.

إذا عدلت `pamLedger.ts` أو `useInvestorEconomics.ts`، راجع هذه الاختبارات أو شغل ما يناسبها قبل اعتبار العمل منتهيًا.

## 19. ملاحظات عن حالة المستودع

- توجد ملفات كثيرة معدلة وغير متتبعة حاليًا في المستودع.
- لا تفترض أن `git status` نظيف.
- لا تستخدم `git reset` أو `checkout` لإرجاع ملفات بدون طلب صريح.
- لا تحذف مجلدات `dist-verify`, `releases`, أو `scripts` لأنها تبدو جزءًا من التحقق والنسخ السابقة.
- `old_App.tsx` ملف قديم كبير، لا تعتمد عليه إلا كمرجع تاريخي.

## 20. قواعد مهمة لأي مساعد سيعمل على المشروع

1. اقرأ `src/types.ts` قبل تعديل أي منطق بيانات.
2. اقرأ `src/utils/pamLedger.ts` قبل تعديل أي ربح، PAM، أو تقرير.
3. اقرأ `src/hooks/useInvestorEconomics.ts` قبل تعديل المستثمرين.
4. عند تعديل إنشاء/تعديل/حذف العمليات، راجع:
   - `src/hooks/useTransactionHandlers.ts`
   - `src/hooks/useClientHandlers.ts`
   - `src/transactionService.ts`
5. لا تكسر روابط `linkedTxId`, `linkedTreasuryTxId`, `linkedAssetTxId`.
6. لا تجعل `tx.profit` هو الحقيقة النهائية للأرباح.
7. لا تغير معنى الإشارة في أرصدة العملاء:
   - موجب = تسبيق/رصيد للعميل.
   - سالب = دين على العميل.
8. عند ربط عملية بالدفع النقدي أو BaridiMob، فكر هل يجب إنشاء حركة خزينة.
9. عند ربط عملية بـ `credit`، غالبًا يجب أن تؤثر على رصيد العميل لا على الخزينة.
10. عند إضافة UI جديد، حافظ على طبيعة التطبيق كأداة مالية موبايل أولًا.
11. عند إضافة نصوص، استخدم نظام الترجمة إن أمكن.
12. عند تعديل مكونات كبيرة، انتبه إلى memoization ومقارنات props الحالية.

## 21. خريطة سريعة للملفات حسب المهمة

### إضافة أو تعديل عملية شراء/بيع

- `src/hooks/useTransactionHandlers.ts`
- `src/components/main/MainTransactionDialog.tsx`
- `src/transactionService.ts`
- `src/utils/pamLedger.ts`

### تعديل العملاء

- `src/hooks/useClientHandlers.ts`
- `src/pages/ClientsPage.tsx`
- `src/components/clients/*`
- `src/components/main/MainClientCrudDialogs.tsx`
- `src/components/main/MainClientOperationsDialogs.tsx`

### تعديل الخزينة

- `src/pages/TresoreriePage.tsx`
- `src/components/treasury/*`
- `src/hooks/useAssetHandlers.ts`
- `src/components/main/MainUtilityDialogs.tsx`
- `src/components/main/MainTransferAndFilterDialogs.tsx`

### تعديل المستثمرين

- `src/hooks/useInvestorHandlers.ts`
- `src/hooks/useInvestorEconomics.ts`
- `src/pages/InvestorsPage.tsx`
- `src/pages/InvestorDetailsPage.tsx`
- `src/pages/InvestorDashboardPage.tsx`
- `src/components/investors/*`
- `src/components/investor-details/*`

### تعديل التقارير

- `src/hooks/useReportExports.ts`
- `src/utils/pdfReports.ts`
- `src/components/analytics/useAnalyticsViewModel.ts`
- `src/pages/AnalyticsPage.tsx`
- `src/pages/PortfolioPage.tsx`

### تعديل التنقل/التجربة العامة

- `src/MainApp.tsx`
- `src/components/main/MainContentArea.tsx`
- `src/components/main/AppNavigation.tsx`
- `src/components/main/MainHeaderBar.tsx`
- `src/hooks/useMainNavigation.ts`
- `src/hooks/useBackHandler.ts`

## 22. النتيجة المطلوبة من أي تطوير قادم

أي تغيير في المشروع يجب أن يحافظ على هذه النية:

- التطبيق هو دفتر مالي موثوق، وليس واجهة تجريبية.
- الأرصدة يجب أن تكون قابلة للتفسير من سجل العمليات.
- الأرباح يجب أن تكون قابلة لإعادة الحساب من التاريخ.
- المستثمرون يجب أن يحصلوا على أرباحهم بناءً على الربح المشتق الحقيقي، لا لقطات قديمة.
- العميل والخزينة والمحفظة يجب أن تبقى متزامنة عند إنشاء أو تعديل أو حذف أي عملية.
- التجربة يجب أن تبقى عملية على الهاتف وسريعة في الاستخدام اليومي.

