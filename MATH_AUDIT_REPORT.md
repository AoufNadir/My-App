# 🔍 MATH_AUDIT_REPORT — ProDigital Tracker

**تاريخ التدقيق:** 2026-05-08
**المدقّق:** Claude (Opus 4.7) — مدقّق مالي ومراجع رياضي
**النطاق:** مراجعة فقط (read-only audit) — لا تعديل لأي كود قبل موافقة المالك.
**المرجع الرئيسي:** [CLAUDE_PROJECT_INTENT.md](CLAUDE_PROJECT_INTENT.md)

---

## 🎯 القاعدة الذهبية المعتمدة

> **`CLAUDE_PROJECT_INTENT.md §8`:** لا تستخدم `tx.profit` كمصدر نهائي للحقيقة عند حساب الربح أو توزيع أرباح المستثمرين. استخدم `computePamLedger(transactions)` و خصوصًا `profitByTxId[tx.id].derivedProfit`.

كل حكم في هذا التقرير يستند إلى هذه القاعدة كحجر زاوية.

---

## 🗺️ هيكل التقرير

| القسم | الموضوع | الحالة |
|------|---------|---------|
| **A** | محفظة USDT/EUR و PAM | ✅ مكتمل |
| **B** | العملاء والديون بالدينار | ⏸️ في انتظار موافقة المالك |
| **C** | الخزينة (Caisse / BaridiMob) | ⏸️ في انتظار موافقة المالك |
| **D** | المستثمرون وتوزيع الأرباح | ⏸️ في انتظار موافقة المالك |
| **E** | التقارير والتحليلات (متضمّنة **E-X**: فحص `useReportExports.ts` لضمان تمرير `profitByTxId` صحيحًا إلى `pdfReports.ts`) | ⏸️ في انتظار موافقة المالك |
| **F** | نقاط الخطر العشر — الإجابة الموثّقة | ⏸️ يُكتب في النهاية |
| **G** | الإحصائيات والملخّص التنفيذي | ⏸️ يُكتب في النهاية |
| **H** | اختبارات Regression الموصى بإضافتها (يُحدَّث مع كل قسم) | 🔄 يبدأ مع القسم A |

> **التزامًا بطلب المالك:** "ابدأ بالقسم A (PAM)، ثم انتظر موافقتي قبل الانتقال للقسم التالي."

### 📋 جدول نقاط الخطر العشر (التقييم الأوّلي — يُحسم في القسم F)

| # | نقطة الخطر | الحالة الأوّلية | يُحسم في |
|---|------------|------------------|-----------|
| 1 | استخدام `tx.profit` بدل `derivedProfit` | ❌ **انتهاك مؤكّد** ([pdfReports.ts:426](src/utils/pdfReports.ts#L426)) | القسم E |
| 2 | عدم تحديث PAM تاريخيًا عند تعديل شراء قديم | ✅ **محمي** ([pamLedger.test.ts:205-227](scripts/pamLedger.test.ts#L205)) | القسم A ✓ |
| 3 | فواصل عشرية بدون decimal.js | 🔍 **محسوم نتيجة فحص `utils/money.ts`** (انظر القسم التالي) | أدناه ✓ |
| 4 | القسمة على صفر | ✅ **محمي** بشكل عام (3 مواضع موثّقة في القسم A) | القسم A ✓ |
| 5 | خلط العملات في الجمع | 🔍 **يحتاج فحص** | القسم E |
| 6 | `managerFee` على الخسارة (H3) | 🔍 **يحتاج توضيح المالك — Q1 أدناه** | القسم D |
| 7 | توزيع الخسائر بين المستثمرين | 🔍 **يحتاج فحص** (تعديل التقييم بناء على طلب المالك) | القسم D |
| 8 | تزامن الخزينة مع العمليات | 🔍 **يحتاج فحص** (تعديل التقييم بناء على طلب المالك) | الأقسام B + C |
| 9 | Transfert Entrant/Sortant مجموع = 0 | 🔍 **يحتاج فحص edge cases** | القسم B |
| 10 | حالة `jGd0Hug9GvHZ3pxrSrDR` | ✅ **مغطّاة بالاختبارات** | القسم A ✓ |

---

## 🧮 منهجية الدقّة العددية (تنفيذ التعديل #1 — فحص `utils/money.ts` قبل أي معادلة)

> **التزامًا بطلب المالك:** "اقرأ `src/utils/money.ts` كأول خطوة في المرحلة 2 قبل أي شيء آخر."
>
> هذا الحكم الحاسم يؤثّر على تقييم ~80% من معادلات هذا التقرير.

### الحكم الحاسم بعد قراءة `src/utils/money.ts:1-54`

| السؤال | الجواب الحاسم |
|--------|----------------|
| هل يستخدم `decimal.js` أو مكتبة عشرية متخصّصة؟ | ❌ **لا** — لا توجد أي مكتبة عشرية في المشروع. |
| هل يستخدم Banker's rounding (round-half-to-even)؟ | ❌ **لا** — لا تطبيق صريح لذلك في أي ملف. |
| هل يستخدم `Math.round`؟ | ✅ **نعم** — عبر مسار "Integer Cents" في `money.ts`. |
| الاستراتيجية الفعلية للـ DZD | **Integer-Cent Helpers**: `value × 100 → Math.round → عمليات على أعداد صحيحة → ÷ 100`. |
| الاستراتيجية الفعلية لـ PAM | `round2(x) = Number(x.toFixed(2))` — **مختلفة عن `money.ts`**. |

### الكود المرجعي

```typescript
// money.ts (DZD-aggregations)
export const toCents  = (n: number): number => Math.round((n || 0) * 100);
export const fromCents = (c: number): number => c / 100;
export const addM = (a, b) => fromCents(toCents(a) + toCents(b));
export const sumM = (vals) => fromCents(vals.reduce((a, v) => a + toCents(v), 0));
```

```typescript
// pamLedger.ts (PAM/quantities/profit)
function round2(value: number): number {
  return Number(Number(value || 0).toFixed(2));
}
```

### سلوك `Math.round` في JavaScript

- يُقرِّب نصف الوحدة نحو **الموجب اللانهائي** (`half-up toward +∞`).
- أمثلة: `Math.round(0.5)=1`, `Math.round(-0.5)=0`, `Math.round(1.5)=2`, `Math.round(-1.5)=-1`.
- ⚠️ **ليس Banker's rounding** — يُسبّب تحيّزًا طفيفًا في القيم السالبة نحو الصفر.

### سلوك `Number.toFixed(2)` (ما يستخدمه `pamLedger`)

- في V8 (Node + Chromium): **round-half-to-larger-magnitude** نظريًا، لكن **يتأثر بالتمثيل الثنائي IEEE 754**.
- ⚠️ **مشكلة موثّقة:** `(1.005).toFixed(2)` يُرجع `"1.00"` (وليس `"1.01"`) لأن 1.005 لا يُمثَّل بدقة في float64.
- نتيجة عملية: انحرافات نصف-قرش (0.005 DZD) في حالات حدّية متفرّقة.

### 📊 تأثير على تقييم المعادلات في هذا التقرير

| نوع الحساب | الآلية | درجة الأمان |
|------------|--------|---------------|
| تجميعات DZD البحتة (أرصدة عملاء، خزينة، توزيع مستثمرين) | `money.ts` (Integer Cents) | 🟢 **آمنة** من float drift |
| متوسط الشراء (PAM)، الربح المشتق، تكلفة منزوعة | `pamLedger.round2` (`.toFixed(2)`) | 🟡 **قد تنحرف ≤ 0.01 DZD** في حالات حدّية |
| كميات USDT/EUR | `round2` على الكمية + `.toFixed(2)` على الإدخال | 🟡 **فقد دقّة USDT** (8 منازل بلوكشينية → 2 في النظام) |

### 🔑 الخلاصة المعتمدة في كل التقييمات أدناه

- **`utils/money.ts` ممتاز ولا يحتاج `decimal.js`** للحالات التي يُستخدم فيها (DZD).
- **`pamLedger.ts` يستخدم آلية مختلفة (`round2`/`.toFixed`)** قد تتسبّب في انحراف قرش في حالات حدّية، لكن متّسقة داخليًا.
- **عدم توحيد الاثنين تحت سقف واحد قرار قائم** — لا توصية بتغييره دون موافقة المالك.

---

## ❓ أسئلة مفتوحة للمالك (تتراكم خلال التدقيق)

### Q1 — H3: رسم المدير على صفقات الخسارة (تنفيذ التعديل #4)

**السيناريو الرقمي الواضح:**

> صفقة بيع تُنتج خسارة `derivedProfit = -1000 DZD`، نسبة المدير `managerFeePercentage = 20%`.

**حالة الكود الحالية ([useInvestorEconomics.ts:184-190](src/hooks/useInvestorEconomics.ts#L184)):**

```typescript
const investorPool   = roundM(derivedProfit * (1 - managerFeeRatio));
//                   = -1000 × (1 - 0.20) = -800
const distributedToInvestors = sumM(distributeProportionally(investorPool, weights));
//                   = -800
const rowManagerShare = subM(derivedProfit, distributedToInvestors);
//                   = -1000 - (-800) = -200
```

**النتيجة الحالية:** المستثمرون يتحمّلون **800 DZD** من الخسارة، والمدير يتحمّل **200 DZD**.

**أيّ السلوكيات الثلاثة تريده عند الخسارة؟**

| الخيار | سلوك الخسارة على -1000 DZD مع نسبة 20% | المستثمرون | المدير |
|--------|---------------------------------------------|--------------|---------|
| **(أ)** | المدير يتحمّل 200 من الخسارة (السلوك الحالي) | -800 | -200 |
| **(ب)** | المستثمرون يتحمّلون كامل الخسارة، والمدير = 0 | -1000 | 0 |
| **(ج)** | تُلغى نسبة المدير عند الخسارة (manager fee = 0% إذا `derivedProfit < 0`) | -1000 | 0 |

> ملاحظة: (ب) و (ج) متطابقتان عدديًا في الخسارة، لكن مختلفتان في التطبيق: (ب) يطبَّق بشرط على `investorPool`، (ج) يطبَّق بشرط على `managerFeeRatio`. (ج) أنظف منطقيًا.

**أحتاج إجابتك قبل بدء القسم D** (ليس قبل B أو C).

### Q2 — A-015: تقريب USDT إلى منزلتين عشريتين

هل القرار نهائي، أم يجب رفع الدقة لاحقًا (مثلًا 6 منازل لاستيراد بايننس)؟

### Q3 — A-013: `Math.round(totalCost)` و `Math.round(totalRevenue)`

هل إفقاد المنزلتين العشريتين على totalCost / totalRevenue قرار متعمَّد، أم يجب الحفاظ عليهما؟

### Q4 — A-011: كشف EUR→USDT بالنافذة الزمنية فقط

هل تريد إدراج فحص المبلغ + قيد one-to-one، أم النافذة الزمنية وحدها كافية في ممارستك اليومية؟

---

# 🟦 القسم A — محفظة USDT/EUR و PAM

**الملفات المعنيّة:**
- [src/utils/pamLedger.ts](src/utils/pamLedger.ts) (486 سطر)
- [src/hooks/useTransactionHandlers.ts](src/hooks/useTransactionHandlers.ts) (917 سطر)
- [src/utils/money.ts](src/utils/money.ts) (54 سطر) — أدوات الدقة العددية
- [scripts/pamLedger.test.ts](scripts/pamLedger.test.ts) (331 سطر) — حالات حرجة موثّقة

**الثوابت العامة (`pamLedger.ts:107-110`):**
| الثابت | القيمة | الاستخدام |
|--------|--------|-----------|
| `DEFAULT_TOLERANCE_DZD` | `1` | عتبة الفرق بين `storedProfit` و `derivedProfit` لتفعيل `stored_mismatch` |
| `DEFAULT_ZERO_EPSILON` | `0.005` | عتبة "صفر فعّال" — أقل من ذلك يُعتبر صفرًا |
| `DEFAULT_CONVERSION_WINDOW_MS` | `60_000` (دقيقة واحدة) | نافذة كشف تحويل EUR→USDT تلقائيًا |
| `CURRENCIES` | `['USDT', 'EUR']` | العملات المدعومة في دفتر PAM |

---

### 🆔 A-001 — معادلة متوسط سعر الشراء التاريخي (PAM)

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:282](src/utils/pamLedger.ts#L282)
- **🏷️ التصنيف:** PAM / متوسط شراء
- **📐 الكود الفعلي:**
  ```typescript
  const avgBefore = statsBefore.purchasedQty > 0 ? statsBefore.costBasis / statsBefore.purchasedQty : 0;
  ```
- **📝 الصيغة الرياضية:**
  $$\text{avgBuy} = \begin{cases} \dfrac{\text{costBasis}_{\text{قبل}}}{\text{purchasedQty}_{\text{قبل}}} & \text{إذا } \text{purchasedQty} > 0 \\ 0 & \text{خلاف ذلك} \end{cases}$$
- **🎯 الهدف:** حساب متوسط سعر شراء العملة لحظة قبل عملية البيع، اعتمادًا على إجمالي تكلفة كل المشتريات السابقة مقسومًا على إجمالي الكمية المشتراة. هذا ليس FIFO ولا LIFO، بل **متوسط مرجّح تراكمي تاريخي**.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - الحساب **لحظي** عند كل بيع (`statsBefore`)، أي يعكس الواقع التاريخي وليس الواقع الحالي.
  - الحماية من القسمة على صفر صريحة (`purchasedQty > 0`).
  - يُعيد `computePamLedger` احتساب `avgBefore` بالكامل من السجل في كل مرة، فلا يثق بـ `tx.profit` المخزن — هذا ما يجعل تعديل شراء قديم يُحدِّث جميع البيعات اللاحقة تلقائيًا (الاختبار: [scripts/pamLedger.test.ts:205-227](scripts/pamLedger.test.ts#L205)).

---

### 🆔 A-002 — معادلة الربح المشتق `derivedProfit`

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:293-295](src/utils/pamLedger.ts#L293)
- **🏷️ التصنيف:** ربح / مشتق
- **📐 الكود الفعلي:**
  ```typescript
  const derivedProfit = flags.legacyFallback && !isFinitePositive(effectiveSellPrice)
    ? 0
    : round2((effectiveSellPrice - avgBefore) * quantity);
  ```
- **📝 الصيغة الرياضية:**
  $$\text{derivedProfit} = \big(P_{\text{بيع فعلي}} - \text{avgBuy}_{\text{تاريخي}}\big) \times Q$$
  حيث $P_{\text{بيع فعلي}} = \dfrac{\text{sellTotal}}{Q}$ (انظر A-004).
- **🎯 الهدف:** حساب الربح الحقيقي لكل بيع بالاعتماد على متوسط الشراء التاريخي وليس على `tx.profit` المخزن.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - تُقرَّب النتيجة إلى منزلتين عشريتين عبر `round2()`.
  - في حالة الـ `legacyFallback` مع سعر بيع غير صالح → النتيجة `0` بدل `NaN/Infinity`.
  - **هذه هي الدالة المعتمدة في توزيع المستثمرين** ([useInvestorEconomics.ts:171](src/hooks/useInvestorEconomics.ts#L171)).
  - تتطابق مع التحقّق الصارم في [scripts/investorEconomics.pamLedger.test.ts:79-106](scripts/investorEconomics.pamLedger.test.ts#L79) لحالة `jGd0Hug9GvHZ3pxrSrDR` (derived = 849، stored = 2944.06).

---

### 🆔 A-003 — `effectiveSellPrice` (السعر الفعلي للبيع)

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:284-288](src/utils/pamLedger.ts#L284)
- **🏷️ التصنيف:** ربح / تطبيع السعر
- **📐 الكود الفعلي:**
  ```typescript
  const sellPrice = asNumber(tx.sell, 0);
  const formulaSellTotal = quantity * sellPrice;
  const txTotal = asNumber(tx.total, 0);
  flags.manualTotalPresent = isFinitePositive(tx.total) && Math.abs(txTotal - formulaSellTotal) > toleranceDzd;
  const sellTotal = flags.manualTotalPresent ? txTotal : formulaSellTotal;
  const effectiveSellPrice = quantity > 0 ? sellTotal / quantity : sellPrice;
  ```
- **📝 الصيغة الرياضية:**
  - $\text{formulaSellTotal} = Q \times \text{tx.sell}$
  - **manualTotalPresent** $= \big(\text{tx.total} > 0\big) \;\wedge\; \big(\lvert \text{tx.total} - \text{formulaSellTotal} \rvert > 1\,\text{DZD}\big)$
  - $\text{sellTotal} = \begin{cases} \text{tx.total} & \text{إذا manualTotalPresent} \\ \text{formulaSellTotal} & \text{خلاف ذلك} \end{cases}$
  - $P_{\text{بيع فعلي}} = \begin{cases} \text{sellTotal}/Q & Q>0 \\ \text{tx.sell} & Q=0 \end{cases}$
- **🎯 الهدف:** السماح للمستخدم بإدخال إجمالي يدوي يختلف عن `quantity × sell` (مثلًا: تقريب لحظي أو خصم على العميل) واعتماده كإيراد فعلي للبيع.
- **✅ الحكم:** **صحيحة** — مع ملاحظة دلالية مهمة.
- **💡 الملاحظة:**
  - عتبة 1 DZD مناسبة لتجنّب أخطاء التقريب البسيطة، لكن قد تتجاهل تلاعبًا مدروسًا أصغر من 1 DZD.
  - هذه الآلية تعمل كـ **override** قانوني، ويُسجَّل تحذير `manual_total_present` (info) للتدقيق.

---

### 🆔 A-004 — كشف "البيع الزائد" (`oversell`)

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:290](src/utils/pamLedger.ts#L290)
- **🏷️ التصنيف:** تحذير / مخزون
- **📐 الكود الفعلي:**
  ```typescript
  flags.oversell = quantity > statsBefore.available + zeroEpsilon;
  ```
- **📝 الصيغة الرياضية:**
  $$\text{oversell} = \big(Q_{\text{بيع}} > \text{available}_{\text{قبل}} + 0.005\big)$$
  حيث `available = purchasedQty + (any quantity-only Ajout Manuel) - sells - Retrait Manuel`.
- **🎯 الهدف:** كشف بيع كميات لا توجد في المخزون (متاح) قبل البيع — حالة محاسبية حرجة.
- **✅ الحكم:** **صحيحة** ولكن ⚠️ **لا توقف العملية**؛ مجرّد علامة تحذيرية severity=`high`.
- **💡 الملاحظة:**
  - استخدام `zeroEpsilon = 0.005` يحمي من float drift.
  - النظام يستمر في الحساب رغم العلامة، ما يعني أن `derivedProfit` قد يكون مضلِّلًا في هذه الحالة.
  - هذا متّسق مع نية المشروع (`CLAUDE_PROJECT_INTENT.md §8`): العلامة للإبلاغ، لا للحجب.

---

### 🆔 A-005 — كشف "كمية بلا تكلفة" (`uncostedQuantitySold`)

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:289, 291](src/utils/pamLedger.ts#L289)
- **🏷️ التصنيف:** تحذير / تكلفة
- **📐 الكود الفعلي:**
  ```typescript
  const quantityWithoutCostBasis = Math.max(0, quantity - statsBefore.purchasedQty);
  ...
  flags.uncostedQuantitySold = quantityWithoutCostBasis > zeroEpsilon;
  ```
- **📝 الصيغة الرياضية:**
  $$\text{quantityWithoutCostBasis} = \max\big(0, \;Q_{\text{بيع}} - \text{purchasedQty}_{\text{قبل}}\big)$$
  $$\text{uncosted} = \big(\text{quantityWithoutCostBasis} > 0.005\big)$$
- **🎯 الهدف:** الكشف عن بيع كمية تتجاوز الكمية ذات تكلفة معروفة (التي تساهم في `costBasis`). يحدث عادة بعد `Ajout Manuel` بدون `total`.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - شدّة التحذير: `high` إذا اقترن بـ `oversell`، وإلا `warning` ([pamLedger.ts:324](src/utils/pamLedger.ts#L324)).
  - يُعرض في تقرير PDF كقسم خاص ([pdfReports.ts:429-478](src/utils/pdfReports.ts#L429)) ويُنبَّه عليه في توزيع المستثمرين ([useInvestorEconomics.ts:209-220](src/hooks/useInvestorEconomics.ts#L209)).

---

### 🆔 A-006 — `legacyFallback` (السقوط القديم)

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:292-295](src/utils/pamLedger.ts#L292)
- **🏷️ التصنيف:** ربح / حماية
- **📐 الكود الفعلي:**
  ```typescript
  flags.legacyFallback = statsBefore.purchasedQty <= zeroEpsilon || !isFinitePositive(effectiveSellPrice);
  const derivedProfit = flags.legacyFallback && !isFinitePositive(effectiveSellPrice)
    ? 0
    : round2((effectiveSellPrice - avgBefore) * quantity);
  ```
- **📝 الصيغة الرياضية:**
  $$\text{legacyFallback} = (\text{purchasedQty} \le 0.005) \;\vee\; \neg\text{isFinitePositive}(P_{\text{بيع فعلي}})$$
- **🎯 الهدف:** التعامل مع البيعات التي ليس لها تاريخ شراء كافٍ أو سعر بيع غير صالح.
- **✅ الحكم:** **صحيحة** — مع ملاحظة دلالية.
- **💡 الملاحظة:**
  - الشرط لإرجاع `0` هو `legacyFallback && !isFinitePositive(price)`.
  - **حالة دقيقة:** إذا `purchasedQty ≤ 0.005` لكن السعر صالح → الحساب يستمر بمتوسط شراء = 0، فيكون `derivedProfit = sellPrice × quantity` (ربح يساوي الإيراد كاملًا)، مع تفعيل `legacyFallback` و `uncostedQuantitySold`. هذا قد يضخّم الأرباح المُسجّلة عبر `derivedProfit` في حالات هجرة بيانات قديمة لا تحوي تاريخ شراء.
  - السلوك هذا متعمد ومُعلَن (تحذير) لكن يجب على المالك معرفته.

---

### 🆔 A-007 — كشف `storedMismatch`

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:296-299, 337-345](src/utils/pamLedger.ts#L296)
- **🏷️ التصنيف:** ربح / تسوية
- **📐 الكود الفعلي:**
  ```typescript
  const hasStoredProfit = Number.isFinite(Number(tx.profit));
  const storedProfit = hasStoredProfit ? round2(asNumber(tx.profit)) : null;
  const difference = storedProfit === null ? null : round2(storedProfit - derivedProfit);
  flags.storedMismatch = difference !== null && Math.abs(difference) > toleranceDzd;
  ```
- **📝 الصيغة الرياضية:**
  $$\Delta = \text{storedProfit} - \text{derivedProfit}$$
  $$\text{storedMismatch} = \big(\lvert \Delta \rvert > 1\,\text{DZD}\big)$$
- **🎯 الهدف:** كشف العمليات التي يختلف فيها الربح المخزن `tx.profit` عن الربح المشتق من سجل PAM (بسبب تعديل شراء قديم أو هجرة بيانات).
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - شدّة التحذير: `high` إذا `|Δ| > 1000` DZD، وإلا `warning` ([pamLedger.ts:342](src/utils/pamLedger.ts#L342)).
  - **مغطّاة بالاختبار** ([scripts/pamLedger.test.ts:189-203](scripts/pamLedger.test.ts#L189)) لحالة `jGd0Hug9GvHZ3pxrSrDR`: stored=2944.06، derived=849، Δ=2095.06.

---

### 🆔 A-008 — تحديث المخزون عند الشراء `buy` و `Ajout Manuel`

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:362-388](src/utils/pamLedger.ts#L362)
- **🏷️ التصنيف:** PAM / مخزون / تكلفة
- **📐 الكود الفعلي:**
  ```typescript
  if (tx.type === 'buy' || tx.type === 'Ajout Manuel') {
    stats.available = round2(stats.available + quantity);
    quantityChange = quantity;
  }
  ...
  if (tx.type === 'Ajout Manuel' && isFinitePositive(tx.total)) {
    const total = round2(asNumber(tx.total));
    stats.purchasedQty = round2(stats.purchasedQty + quantity);
    stats.costBasis = round2(stats.costBasis + total);
    costBasisChange = total;
  } else if (tx.type === 'buy') {
    const total = round2(asNumber(tx.total, 0));
    stats.purchasedQty = round2(stats.purchasedQty + quantity);
    stats.costBasis = round2(stats.costBasis + total);
    costBasisChange = total;
    if (!isFinitePositive(tx.total)) {
      // missing_buy_total warning
    }
  }
  ```
- **📝 الصيغة الرياضية:**
  - `buy` أو `Ajout Manuel` بـ `total > 0`:
    $$\text{purchasedQty} \mathrel{+}= Q,\quad \text{costBasis} \mathrel{+}= \text{tx.total}$$
  - `Ajout Manuel` بدون `total` (qty-only):
    $$\text{available} \mathrel{+}= Q \quad\text{لكن}\quad \text{purchasedQty,\;costBasis}\;\text{تبقى بلا تغيير}$$
- **🎯 الهدف:** تمييز بين:
  1. شراء حقيقي يضيف كمية وتكلفة → يؤثر على PAM.
  2. تعديل مخزون يدوي بدون تكلفة (مثل ربح/هدية/استرداد) → يزيد المتاح فقط.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - عملية `buy` بدون `total > 0` تُسجَّل تحذيرًا `missing_buy_total` لكنها تُحدّث `purchasedQty` بـ `total = 0`، ما يخفّض المتوسط (`avgBuy = costBasis / purchasedQty` يصبح أقل). هذه ظاهرة مُتعمَّدة لكنها تستحق ملاحظة المالك.
  - `Ajout Manuel` بدون `total` يُفعِّل `quantityOnlyAdjustment` (info) ويزيد `available` بدون تغيير `purchasedQty`، فينتج عنه فجوة قد تظهر لاحقًا كـ `uncostedQuantitySold` في البيع.

---

### 🆔 A-009 — تحديث المخزون عند البيع `sell` و `Retrait Manuel` (نموذج إزالة الكلفة)

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:389-399](src/utils/pamLedger.ts#L389)
- **🏷️ التصنيف:** PAM / إزالة كلفة
- **📐 الكود الفعلي:**
  ```typescript
  } else if (tx.type === 'sell' || tx.type === 'Retrait Manuel') {
    const avgBuy = statsBefore.purchasedQty > 0 ? statsBefore.costBasis / statsBefore.purchasedQty : 0;
    const removedQty = Math.min(quantity, statsBefore.purchasedQty);
    const removedCost = round2(removedQty * avgBuy);
    stats.purchasedQty = round2(stats.purchasedQty - removedQty);
    stats.costBasis = round2(stats.costBasis - removedCost);
    costBasisChange = -removedCost;
    if (stats.purchasedQty < 0.00001) {
      stats.purchasedQty = 0;
      stats.costBasis = 0;
    }
  }
  ```
- **📝 الصيغة الرياضية:**
  - `removedQty` = $\min(Q_{\text{بيع}}, \text{purchasedQty}_{\text{قبل}})$ — لا تتجاوز الكمية ذات التكلفة.
  - `removedCost` = `removedQty × avgBuy` (نموذج إزالة بمتوسط مرجّح، **ليس FIFO/LIFO**).
  - $\text{purchasedQty} \mathrel{-}= \text{removedQty},\;\; \text{costBasis} \mathrel{-}= \text{removedCost}$.
- **🎯 الهدف:** الحفاظ على **متوسط شراء ثابت بعد البيع** (طالما لم يقع شراء جديد بسعر مختلف). هذا هو السلوك المتوقع لنموذج المتوسط المرجّح: البيع لا يغيّر المتوسط، الشراء فقط يغيّره.
- **✅ الحكم:** **صحيحة** ومتسقة مع نموذج `Weighted Average Cost`.
- **💡 الملاحظة:**
  - **تأكيد رياضي:** قبل البيع: $\text{avg} = C/Q$. بعده: $C' = C - \text{avg}\cdot Q_{\text{بيع}}$, $Q' = Q - Q_{\text{بيع}}$. فإن $\text{avg}' = C'/Q' = (C - (C/Q)\cdot Q_{\text{بيع}}) / (Q - Q_{\text{بيع}}) = C\cdot(Q - Q_{\text{بيع}})/(Q\cdot(Q - Q_{\text{بيع}})) = C/Q = \text{avg}$. ✓
  - عتبة الصفر `< 0.00001` (1e-5) أصغر من `zeroEpsilon = 0.005` — متعمَّد لتنظيف float drift فقط.
  - في حالة `oversell` ($Q_{\text{بيع}} > \text{purchasedQty}$): الكلفة لا يمكن إزالة أكثر من الموجود، لذلك `removedQty` تُقصَر، لكن `available` تنخفض حتى السالب (انظر A-010).

---

### 🆔 A-010 — تطبيع `available` السالب إلى صفر

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:402-406](src/utils/pamLedger.ts#L402)
- **🏷️ التصنيف:** تطبيع / حماية
- **📐 الكود الفعلي:**
  ```typescript
  if (Math.abs(stats.available) < zeroEpsilon) {
    stats.available = 0;
    stats.purchasedQty = 0;
    stats.costBasis = 0;
  }
  ```
- **📝 الصيغة الرياضية:**
  $$\text{إذا } \lvert \text{available} \rvert < 0.005 \;\Rightarrow\; \text{available} = \text{purchasedQty} = \text{costBasis} = 0$$
- **🎯 الهدف:** "إعادة ضبط" المخزون إلى صفر عند تفريغه فعليًا، لتجنّب float drift يُنتج قيمًا مثل `0.0000003`.
- **✅ الحكم:** **صحيحة** ومحافظة.
- **💡 الملاحظة:**
  - تطبيق هذه القاعدة فقط داخل النافذة `[-0.005, +0.005]`. خارج هذه النافذة، `available` السالب يُحفظ كما هو ويُعرض كرقم سالب (يدلّ على `oversell` تاريخي لم يُغطَّ بشراء جديد).

---

### 🆔 A-011 — كشف تحويل EUR → USDT (تلقائيًا)

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:196-221](src/utils/pamLedger.ts#L196)
- **🏷️ التصنيف:** كشف / ربط
- **📐 الكود الفعلي:**
  ```typescript
  function findEurConversionRelatedTxIds(transactions: InternalTx[], conversionWindowMs: number): Set<string> {
    const eurWithdrawals = transactions.filter((tx) => (
      normalizeCurrency(tx.currency) === 'EUR'
      && tx.type === 'Retrait Manuel'
      && (hasConversionNote(tx) || Boolean(tx.linkedTxId))
    ));
    const usdtBuys = transactions.filter((tx) => normalizeCurrency(tx.currency) === 'USDT' && tx.type === 'buy');
    for (const withdrawal of eurWithdrawals) {
      const linkedBuy = usdtBuys.find((buy) => {
        const linked = withdrawal.linkedTxId === buyId || buy.linkedTxId === withdrawalId;
        const nearInTime = Math.abs(asNumber(buy.timestamp) - asNumber(withdrawal.timestamp)) <= conversionWindowMs;
        return linked || nearInTime;
      });
      ...
    }
  }
  ```
  حيث `hasConversionNote = String(tx.notes || '').toLowerCase().includes('achat de')` ([pamLedger.ts:192-194](src/utils/pamLedger.ts#L192)).
- **📝 المنطق الرياضي/الزمني:**
  - مرشحات سحب EUR: `currency=EUR ∧ type='Retrait Manuel' ∧ (notes contains 'achat de' ∨ has linkedTxId)`.
  - مرشحات شراء USDT: `currency=USDT ∧ type='buy'`.
  - تطابق: $\text{linked} \;\vee\; (\lvert t_{\text{شراء}} - t_{\text{سحب}} \rvert \le 60{,}000\text{ms})$.
- **🎯 الهدف:** الربط التحليلي بين سحب EUR والشراء بـ USDT بحيث يُمكن تمييزه في التقارير والتحذيرات (`eur_conversion_related`).
- **✅ الحكم:** **صحيحة** ولكن ⚠️ **مشبوهة في حالات حدّية**.
- **💡 الملاحظة الحرجة:**
  - الشرط `linked || nearInTime` يعني أن **أي** شراء USDT في نطاق ±60 ثانية من سحب EUR (حتى لو غير مقصود) سيُربط — يستخدم `find()` فيُختار أول مطابق فقط، مما قد ينتج ربطًا خاطئًا في يوم نشط.
  - لا يتحقّق من تطابق المبلغ (EUR قيمة × سعر تحويل ≈ USDT × سعر USDT).
  - لا يقتصر على واحد-إلى-واحد، فربما شراءان متتاليان يطابقان نفس السحب.
  - **توصية للنقاش (لا يُنفّذ بدون موافقة):** إضافة فحص مبلغ تقديري + ضمان عدم استخدام نفس الـ `usdtBuy` مرتين.

---

### 🆔 A-012 — أثر تحويل EUR → USDT في `useTransactionHandlers.handleBuy`

- **📁 الملف:السطر:** [src/hooks/useTransactionHandlers.ts:79-85, 281-293](src/hooks/useTransactionHandlers.ts#L79)
- **🏷️ التصنيف:** PAM / تحويل
- **📐 الكود الفعلي:**
  ```typescript
  const usdtFromEurCalc = useMemo(() => {
    const eurQty = parseAndEvaluate(buyEurForUsdtAmount);
    const eurPrice = parseAndEvaluate(eurDzdPrice);
    const rate = parseAndEvaluate(eurUsdtRate);
    if (eurQty <= 0 || eurPrice <= 0 || rate <= 0) return null;
    return { usdtQty: eurQty / rate, usdtPriceDzd: eurPrice * rate, totalCostDzd: (eurQty / rate) * (eurPrice * rate) };
  }, ...);
  ...
  // creation of linked Retrait Manuel EUR row:
  batch.set(userDocRef.collection('usdt_txs').doc(), {
    timestamp: timestamp - 1, type: 'Retrait Manuel', currency: 'EUR',
    quantity: eurSpentForConversion, ...
    notes: `Achat de ${quantity.toFixed(2)} USDT`, linkedTxId: mainTxId
  });
  ```
- **📝 الصيغة الرياضية:**
  - $\text{usdtQty} = \dfrac{\text{eurQty}}{\text{rate}}$
  - $\text{usdtPriceDzd} = \text{eurPrice} \times \text{rate}$
  - $\text{totalCostDzd} = \text{usdtQty} \times \text{usdtPriceDzd} = \text{eurQty} \times \text{eurPrice}$ ✓ (متطابق جبريًا)
- **🎯 الهدف:**
  1. تحويل وحدات: العميل يشتري USDT بإنفاق EUR. الكمية USDT = EUR ÷ سعر USDT بالـ EUR.
  2. تكلفة USDT بالدينار = سعر EUR بالـ DZD × سعر USDT بالـ EUR.
  3. إنشاء صف `Retrait Manuel EUR` بـ `timestamp - 1` لربطه بصف الشراء USDT.
- **✅ الحكم:** **صحيحة** رياضيًا، **مشبوهة دلاليًا** في نقطة `timestamp - 1`.
- **💡 الملاحظة:**
  - **تأكيد جبري:** $\text{eurQty} \times \text{eurPrice} = \dfrac{\text{eurQty}}{\text{rate}} \times \text{eurPrice} \times \text{rate}$ = صحيح ✓.
  - **مشكلة ترتيب زمني:** استخدام `timestamp - 1` لضمان أن سحب EUR يُحسب قبل شراء USDT في `pamLedger`. لكن في `pamLedger.sortTransactions` الترتيب مزدوج: timestamp ثم index. فإن وقع شراء آخر بنفس `timestamp - 1` (نادر لكن ممكن) قد ينقلب الترتيب.
  - **نقطة قياس مهمة:** الـ `eurSpentForConversion` يُستخدم كـ `quantity` للسحب — هذا يعني أن `usdtFromEurCalc.usdtQty` (بعد `.toFixed(2)`) قد لا يعكس بالضبط `eurSpentForConversion / rate` بسبب التقريب → فرق دقيق محتمل بين سجل EUR وسجل USDT.

---

### 🆔 A-013 — `handleBuy` — حساب `totalCost`

- **📁 الملف:السطر:** [src/hooks/useTransactionHandlers.ts:269-277](src/hooks/useTransactionHandlers.ts#L269)
- **🏷️ التصنيف:** PAM / تكلفة
- **📐 الكود الفعلي:**
  ```typescript
  let totalCost = quantity * price;
  if (isTotalManual) {
    if (mode === 'buy_usdt' && buyUsdtMode === 'with_dzd') totalCost = parseAndEvaluate(buyUsdtTotal);
    else if (mode === 'buy_eur') totalCost = parseAndEvaluate(buyEurTotal);
  }
  if (mode === 'buy_usdt' && buyUsdtMode === 'with_eur' && usdtFromEurCalc) {
    totalCost = usdtFromEurCalc.totalCostDzd;
  }
  totalCost = Math.round(totalCost);
  ```
- **📝 الصيغة الرياضية:**
  - $\text{totalCost} = Q \times P$ (افتراضيًا).
  - يتجاوز إذا `isTotalManual = true`.
  - يُعاد ضبطه دائمًا إلى تكلفة EUR→USDT في وضع التحويل (يلغي override يدويًا).
  - يُقرَّب إلى أقرب دينار صحيح.
- **🎯 الهدف:** تثبيت تكلفة الشراء بالدينار قبل الكتابة إلى Firestore.
- **✅ الحكم:** **صحيحة** ولكن ⚠️ **سلوك دلالي يستحق إبراز**.
- **💡 الملاحظة:**
  - `Math.round(totalCost)` يُفقد الفرق بين 100.49 و 100.51 → خسارة دقّة بـ 0.5 DZD لكل عملية، لكن متناغم مع المبدأ "DZD لا تقبل عشرات أصغر من واحد فعليًا".
  - `usdtFromEurCalc.totalCostDzd` **يتجاوز** `isTotalManual` — قد يربك المستخدم إن أدخل مبلغًا يدويًا في وضع التحويل.

---

### 🆔 A-014 — `handleSell` — حساب `profit` المخزن و `totalRevenue`

- **📁 الملف:السطر:** [src/hooks/useTransactionHandlers.ts:412-417](src/hooks/useTransactionHandlers.ts#L412)
- **🏷️ التصنيف:** ربح مخزن / إيراد
- **📐 الكود الفعلي:**
  ```typescript
  const avg = sellAssetStats.avgBuy;
  const profit = Number(((sell - avg) * quantity).toFixed(2));
  const totalInput = parseAndEvaluate(sellTotal);
  let totalRevenue = quantity * sell;
  if (isTotalManual && totalInput > 0) totalRevenue = totalInput;
  totalRevenue = Math.round(totalRevenue);
  ```
- **📝 الصيغة الرياضية:**
  - $\text{profit}_{\text{مخزن}} = (\text{sell} - \text{avgBuy}_{\text{حالي}}) \times Q$
  - $\text{totalRevenue} = \text{round}(\text{isTotalManual}\,?\,\text{tx.total}\,:\,Q \times \text{sell})$
- **🎯 الهدف:** كتابة `tx.profit` كلقطة (snapshot) عند البيع. سيُستخدم لاحقًا كاحتياطي `?? tx.profit` فقط (انظر القسم E).
- **✅ الحكم:** **مشبوهة** ⚠️ — وفق القاعدة الذهبية.
- **💡 الملاحظة الحرجة:**
  - **`avg` المستخدم هنا هو `portfolioStats.usdt.avgBuy` الحالي**، أي **بعد كل العمليات حتى الآن**، وليس `historicalAvgBuy` لحظة البيع.
  - في **معظم الحالات** يكون متطابقًا (لأن البيع يحدث "الآن")، لكن إذا كان المستخدم يُدخل بيعًا تاريخيًا قديمًا (`timestamp` في الماضي) بينما PAM الحالي مختلف، **`profit` المُخزن يصبح خاطئًا فورًا**.
  - هذه هي أحد الأسباب المباشرة لوجود فروق مثل حالة `jGd0Hug9GvHZ3pxrSrDR`.
  - **`tx.profit` هنا لقطة فقط — `pamLedger.computePamLedger` هو المرجع.** يجب التأكيد أن أي تقرير لا يستخدمها (انظر القسم E، حيث ستظهر مخالفة موثّقة في `pdfReports.ts:426`).

---

### 🆔 A-015 — `getTxQuantity` — تطبيع الكمية

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:156-158](src/utils/pamLedger.ts#L156)
- **🏷️ التصنيف:** تطبيع / دقّة
- **📐 الكود الفعلي:**
  ```typescript
  function getTxQuantity(tx: Tx): number {
    return round2(Math.abs(asNumber(tx.quantity, 0)));
  }
  ```
- **📝 الصيغة الرياضية:** $Q = \text{round2}(\lvert \text{tx.quantity} \rvert)$ مع `round2 = Number(value.toFixed(2))`.
- **🎯 الهدف:** ضمان كميات موجبة وذات منزلتين عشريتين.
- **✅ الحكم:** **مشبوهة** ⚠️ — مخاطر دقّة في USDT.
- **💡 الملاحظة الحرجة:**
  - **USDT يدعم 8 منازل عشرية على البلوكشين**؛ التقريب إلى منزلتين يُفقد الدقة. مثال: 100.12345678 USDT → 100.12 USDT (فرق 0.00345678 ≈ 0.0035 USDT).
  - هذا التقريب **ثابت في النظام** (يُطبَّق أيضًا في [useTransactionHandlers.ts:256, 260, 409](src/hooks/useTransactionHandlers.ts#L256))، لذا التطبيق متّسق ذاتيًا، لكنه قد يخلق فروقات صغيرة عند مقارنة مع تقارير منصّات خارجية.
  - **سؤال للمالك (سيُسجَّل في القسم G):** هل التطبيق مخصّص للأرقام المُقرَّبة عمدًا، أم نحتاج رفع الدقة إلى 8 منازل؟

---

### 🆔 A-016 — `normalizeZero` — تنظيف float drift

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:116-119](src/utils/pamLedger.ts#L116)
- **🏷️ التصنيف:** تطبيع / دقّة
- **📐 الكود الفعلي:**
  ```typescript
  function normalizeZero(value: number, zeroEpsilon: number): number {
    const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
    return Object.is(safe, -0) || Math.abs(safe) < zeroEpsilon ? 0 : round2(safe);
  }
  ```
- **📝 الصيغة الرياضية:**
  $$\text{normalizeZero}(x) = \begin{cases} 0 & \lvert x \rvert < \varepsilon \;\vee\; x = -0 \;\vee\; x = \text{NaN/Inf} \\ \text{round2}(x) & \text{خلاف ذلك} \end{cases}$$
- **🎯 الهدف:** القضاء على القيم القريبة من الصفر بفعل تراكم float، وإرجاع الأصفار الموجبة فقط (الفرق `+0` مقابل `-0` مهم في العرض).
- **✅ الحكم:** **صحيحة** وممتازة.
- **💡 الملاحظة:** التحقّق من `Object.is(safe, -0)` متعمَّد ودقيق — يمنع ظهور `-0` في تقارير PDF.

---

### 🆔 A-017 — أدوات الدقة في `utils/money.ts`

- **📁 الملف:السطر:** [src/utils/money.ts:1-54](src/utils/money.ts)
- **🏷️ التصنيف:** دقّة / حماية
- **📐 الكود الفعلي:**
  ```typescript
  export const toCents = (n: number): number => Math.round((n || 0) * 100);
  export const fromCents = (c: number): number => c / 100;
  export const addM = (a: number, b: number): number => fromCents(toCents(a) + toCents(b));
  export const subM = (a: number, b: number): number => fromCents(toCents(a) - toCents(b));
  export const mulM = (a: number, qty: number): number => fromCents(Math.round(toCents(a) * (qty || 0)));
  export const divM = (a: number, qty: number): number => { if (!qty) return 0; return fromCents(Math.round(toCents(a) / qty)); };
  export const sumM = (values: ReadonlyArray<number>): number => fromCents(values.reduce((acc, v) => acc + toCents(v), 0));
  export const roundM = (n: number): number => fromCents(toCents(n));
  ```
- **📝 المنطق:** كل الحسابات المالية تتحول إلى **سنتات صحيحة (integer cents)** قبل الجمع/الطرح، ثم تُعاد إلى دينار. هذا تطبيق نموذجي لـ "Integer-Cent Money Helpers".
- **🎯 الهدف:** تجنّب float drift في التجميعات (مثلًا `0.1 + 0.2 = 0.30000000000000004` في JS).
- **✅ الحكم:** **صحيحة** ومتّسقة مع أفضل الممارسات.
- **💡 الملاحظة:**
  - **تقييم مقابل decimal.js:** `money.ts` كافٍ تمامًا للعملة (DZD، EUR — منزلتان). لا حاجة فعلية لـ `decimal.js`.
  - **الحماية من القسمة على صفر** صريحة في `divM`.
  - **عدم استخدامها بشكل شامل في `pamLedger.ts`:** يستخدم `pamLedger` مباشرة `+/-` و `Math.round` و `round2` بدل `addM/subM`. هذا متعمَّد لأن `pamLedger` يعمل على وحدات USDT/EUR (وليس على DZD حصرًا)، لكنه يخلق ازدواجية. **سؤال للمالك:** هل توحيد الكل تحت `money.ts` مرغوب؟

---

### 🆔 A-018 — `distributeProportionally` — توزيع بأكبر-بقايا (Hare-Niemeyer)

- **📁 الملف:السطر:** [src/utils/money.ts:36-54](src/utils/money.ts#L36)
- **🏷️ التصنيف:** توزيع / دقّة
- **📐 الكود الفعلي:**
  ```typescript
  export const distributeProportionally = (total, weights) => {
    const totalCents = toCents(total);
    const weightSum = weights.reduce((acc, w) => acc + (w || 0), 0);
    if (weightSum <= 0) return weights.map(() => 0);
    const raw = weights.map((w) => (totalCents * (w || 0)) / weightSum);
    const floored = raw.map((r) => Math.floor(r));
    const remainder = totalCents - floored.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainder; k++) floored[order[k % order.length].i] += 1;
    return floored.map(fromCents);
  };
  ```
- **📝 المنطق:**
  1. حصة خام لكل وزن: $\text{raw}_i = \text{totalCents} \times w_i / \sum w$
  2. تقريب لأسفل (floor) لكل حصة.
  3. توزيع البقايا (cents المتبقية) على أصحاب أكبر جزء كسري أولًا.
- **🎯 الهدف:** ضمان أن مجموع الحصص = الإجمالي بالضبط (لا فقدان قرش).
- **✅ الحكم:** **صحيحة** — تطبيق سليم لـ "Largest Remainder Method".
- **💡 الملاحظة:**
  - تُستخدم في [useInvestorEconomics.ts:185-188](src/hooks/useInvestorEconomics.ts#L185) لتوزيع `investorPool` على المستثمرين تناسبيًا (تفاصيل في القسم D).
  - ضمان `weightSum <= 0 → كل الحصص = 0` (حماية من القسمة على صفر).

---

### 🆔 A-019 — تجميع الأرباح حسب العملة (`byCurrency`)

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:457-470](src/utils/pamLedger.ts#L457)
- **🏷️ التصنيف:** تقرير / تجميع
- **📐 الكود الفعلي:**
  ```typescript
  const byCurrency = CURRENCIES.reduce((acc, currency) => {
    const rows = sellProfitRows.filter((row) => row.currency === currency);
    const derivedProfit = round2(rows.reduce((sum, row) => sum + row.derivedProfit, 0));
    const storedProfit = round2(rows.reduce((sum, row) => sum + (row.storedProfit || 0), 0));
    acc[currency] = { derivedProfit, storedProfit, difference: round2(storedProfit - derivedProfit) };
    return acc;
  }, ...);
  const derivedProfit = round2(CURRENCIES.reduce((sum, currency) => sum + byCurrency[currency].derivedProfit, 0));
  const storedProfit = round2(CURRENCIES.reduce((sum, currency) => sum + byCurrency[currency].storedProfit, 0));
  ```
- **📝 الصيغة الرياضية:**
  - لكل عملة $c \in \{\text{USDT}, \text{EUR}\}$:
    $$\text{derivedProfit}_c = \sum_{\text{row} \in \text{sellRows}_c} \text{row.derivedProfit}$$
  - الإجمالي:
    $$\text{derivedProfit}_{\text{إجمالي}} = \sum_c \text{derivedProfit}_c$$
- **🎯 الهدف:** إعطاء صورة موحّدة عن الأرباح لكل عملة وللإجمالي.
- **✅ الحكم:** **صحيحة** **بشرط** أن `derivedProfit` لكل صف يُحسب بالـ DZD (وهو كذلك بحكم A-002).
- **💡 الملاحظة:**
  - **عدم خلط عملات:** الأرباح (`derivedProfit`) **بالـ DZD** لكل من USDT و EUR لأنها فرق سعر مضروب في كمية، والسعر بالـ DZD/وحدة → الناتج بالـ DZD. ✓
  - عند الجمع `USDT.derivedProfit + EUR.derivedProfit` يبقى **بالـ DZD** — لا خلط عملات في النتيجة النهائية.
  - **هذا هو الافتراض الضمني الذي يستند إليه `pdfReports.ts:487` ونفترض صحّته** (سيُؤكَّد في القسم E).

---

### 🆔 A-020 — ترتيب العمليات قبل الحساب

- **📁 الملف:السطر:** [src/utils/pamLedger.ts:160-168](src/utils/pamLedger.ts#L160)
- **🏷️ التصنيف:** ترتيب / دقّة
- **📐 الكود الفعلي:**
  ```typescript
  function sortTransactions(transactions: Tx[]): InternalTx[] {
    return transactions
      .map((tx, index) => ({ ...tx, currency: normalizeCurrency(tx.currency), __ledgerIndex: index }))
      .sort((a, b) => {
        const timestampDiff = asNumber(a.timestamp, 0) - asNumber(b.timestamp, 0);
        if (timestampDiff !== 0) return timestampDiff;
        return a.__ledgerIndex - b.__ledgerIndex;
      }) as InternalTx[];
  }
  ```
- **📝 المنطق:** ترتيب مزدوج: `timestamp` أولًا، ثم `__ledgerIndex` (أصلي في المصفوفة) كفاصل عند التساوي.
- **🎯 الهدف:** ضمان أن الأحداث تُحسب بالترتيب الزمني الصحيح. `__ledgerIndex` يحسم التساوي ويحفظ ترتيب الإدخال.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - `timestamp - 1` المستخدم في `handleBuy` لإنشاء صف EUR قبل صف USDT (انظر A-012) **يعتمد على هذا الترتيب**.
  - مخاطرة: إذا اعتمد المستخدم على ضبط `timestamp` يدويًا لعمليات قديمة، قد يقلب الترتيب → سيظهر كـ `storedMismatch` تلقائيًا.

---

## 📊 إحصائيات أولية للقسم A

| البند | العدد |
|------|------|
| إجمالي المعادلات الموثّقة في القسم A | **20** |
| ✅ صحيحة | **15** |
| ⚠️ مشبوهة (تستحق توضيحًا أو فحصًا) | **5** (A-006, A-011, A-013, A-014, A-015) |
| ❌ خاطئة | **0** |
| 🤔 تحتاج توضيحًا | **0** |

### ⚠️ نقاط مشبوهة في القسم A — للنقاش مع المالك قبل الانتقال

1. **A-006 (`legacyFallback`):** ربح مضخّم محتمل عند `purchasedQty ≤ 0.005` مع سعر بيع صالح (يصبح الربح = الإيراد كاملًا).
2. **A-011 (كشف EUR→USDT):** `find()` بدون فحص مبلغ ولا قيد one-to-one قد يربط شراء USDT بسحب EUR لا يمتّ له بصلة عند ضغط زمني.
3. **A-013 (`Math.round(totalCost)`):** إفقاد دقّة دون نصف دينار في كل عملية شراء — متّسق مع روح DZD لكن يستحق تأكيد.
4. **A-014 (`tx.profit` المخزَّن في handleSell):** يستخدم `portfolioStats.usdt.avgBuy` الحالي وليس historicalAvgBuy — لقطة قد تنحرف فورًا لو أُدخلت عملية تاريخية.
5. **A-015 (تقريب USDT إلى منزلتين):** فقد دقة USDT (8 منازل بلوكشينية → 2 في النظام).

### ✅ نقاط متينة للحفاظ عليها

- **PAM = متوسط مرجّح تاريخي** بحساب `avgBefore` لحظي (A-001) — تطبيق سليم.
- **حماية شاملة من القسمة على صفر** في 3 نقاط على الأقل (A-001, A-003, A-018).
- **تحذيرات مفصّلة وغير مُربكة:** كل علامة (`oversell`, `uncosted_quantity_sold`, `stored_mismatch`, `manual_total_present`, `legacy_fallback`, `eur_conversion_related`, `quantity_only_adjustment`, `missing_buy_total`) لها كود وشدّة ورسالة.
- **`utils/money.ts` ممتاز** — Integer-cent helpers + Largest-remainder distribution.
- **اختبارات الانحدار قائمة** على حالة `jGd0Hug9GvHZ3pxrSrDR` (stored=2944.06، derived=849).

---

---

# 🟩 القسم B — العملاء والديون بالدينار الجزائري (DZD)

**الملفات المعنيّة:**
- [src/hooks/useAppData.ts:240-247](src/hooks/useAppData.ts#L240) — حساب أرصدة العملاء
- [src/hooks/useClientHandlers.ts](src/hooks/useClientHandlers.ts) (385 سطر) — CRUD العملاء وعملياتهم
- [src/hooks/useOverdueDebtClients.ts](src/hooks/useOverdueDebtClients.ts) (137 سطر) — FIFO الديون المتأخرة
- [src/types.ts](src/types.ts) — `ClientTransactionDzd`, `OverdueDebtClient`

**الثوابت العامة في القسم B:**

| الثابت | القيمة | الاستخدام | الموقع |
|--------|--------|-----------|---------|
| `CLIENT_DELETE_EPSILON` | `0.01` | عتبة "رصيد صفري" لحذف العميل + tolerance لتطابق `Transfert` counterpart | [useClientHandlers.ts:8](src/hooks/useClientHandlers.ts#L8) |
| `EPSILON` (Overdue) | `0.005` | عتبة "صفر فعّال" في FIFO طابور الديون | [useOverdueDebtClients.ts:13](src/hooks/useOverdueDebtClients.ts#L13) |
| `DAY_MS` | `24 * 60 * 60 * 1000` | يوم بالمللي ثانية لحساب عمر الدين | [useOverdueDebtClients.ts:12](src/hooks/useOverdueDebtClients.ts#L12) |
| `minDays` (افتراضي) | `7` | عمر الدين الحدّي لاعتباره متأخرًا | [useOverdueDebtClients.ts:26](src/hooks/useOverdueDebtClients.ts#L26) |
| `paymentMethodMap` | `{ credit: 'Crédit', cash: 'Espèces', baridi: 'BaridiMob' }` | تعيين طريقة الدفع لـ Firestore | [useClientHandlers.ts:302](src/hooks/useClientHandlers.ts#L302) |

---

### 🆔 B-001 — حساب الرصيد الحالي للعميل من `dzd_client_txs`

- **📁 الملف:السطر:** [src/hooks/useAppData.ts:240-247](src/hooks/useAppData.ts#L240)
- **🏷️ التصنيف:** رصيد / تجميع
- **📐 الكود الفعلي:**
  ```typescript
  const clientBalances = useMemo(() => {
    const balances = new Map<string, number>();
    clientsDzd.forEach(c => balances.set(c.id, 0));
    clientTransactionsDzd.forEach(tx => {
      if (tx.affectsBalance === false) return;
      balances.set(tx.clientId, (balances.get(tx.clientId) || 0) + tx.montant);
    });
    return balances;
  }, [clientsDzd, clientTransactionsDzd]);
  ```
- **📝 الصيغة الرياضية:**
  $$\text{balance}_{\text{client}} = \sum_{\substack{tx \in \text{client\_txs} \\ tx.\text{affectsBalance} \ne \text{false}}} tx.\text{montant}$$
- **🎯 الهدف:** اشتقاق الرصيد الحالي لكل عميل من سجل عملياته بالكامل، مع تجاهل الصفوف التاريخية ذات `affectsBalance === false`.
- **✅ الحكم:** **صحيحة** ⚠️ مع ملاحظة دقّة.
- **💡 الملاحظة الحرجة:**
  - يستخدم `+` المباشر **وليس `addM` من `money.ts`** — هذا يفتح بابًا لـ **float drift** عند تراكم آلاف العمليات بمنازل عشرية. مثال: 1000 عملية بـ `0.1 DZD` كل واحدة قد تنتج `99.9999...8` بدل `100.00`.
  - **لا يوجد `round2` أو `normalizeZero`** عند نهاية الجمع.
  - في الممارسة، كل المبالغ الجارية تنطبق عبر `Math.round` على `totalCost`/`totalRevenue` في `useTransactionHandlers` (انظر A-013)، فالمصدر يدخل كأعداد صحيحة دائمًا تقريبًا → الانحراف نظري وليس عملي. لكنه **يستحق `addM`** لمتانة المستقبل.
- **🔗 يُستخدم في:** [useClientHandlers.ts:78, 163](src/hooks/useClientHandlers.ts#L78), [TresoreriePage.tsx](src/pages/TresoreriePage.tsx), `totals.totalDettes`/`totalAvances` في [useAppData.ts:267-272](src/hooks/useAppData.ts#L267).

---

### 🆔 B-002 — قاعدة الإشارة `montant` (موجب=تسبيق، سالب=دين)

- **📁 الملف:السطر:** [src/hooks/useClientHandlers.ts:303](src/hooks/useClientHandlers.ts#L303)
- **🏷️ التصنيف:** رصيد / إشارة
- **📐 الكود الفعلي:**
  ```typescript
  const montant = (clientTxType === 'Règlement Reçu') ? amount : -amount;
  ```
- **📝 المنطق:**
  - `Règlement Reçu` → `montant = +|amount|` (تسبيق/استلام مبلغ من العميل).
  - أي نوع آخر (`Paiement Effectué`, `Vente USDT`, `Vente EUR`, ...) → `montant = -|amount|` (دين/دفع للعميل).
  - حالات خاصة بأنواعها الأصلية (`Solde Initial`, `Ajustement Solde`, `Transfert Entrant/Sortant`) لا تمرّ عبر هذه الدالة بل تُكتب مباشرة بإشارة محسوبة في كل سياق.
- **🎯 الهدف:** تطبيق قاعدة الإشارة الموثّقة في `CLAUDE_PROJECT_INTENT.md §7`: موجب=للعميل، سالب=على العميل.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - `amount` يأتي من `parseAndEvaluate(clientTxAmount)` الذي قد ينتج قيمة سالبة إذا أدخل المستخدم `-100`. ثم `montant = -(-100) = +100` لـ `Paiement Effectué` — قد يُربك. لكن واجهة المستخدم تأخذ المبلغ كقيمة مطلقة عادةً (`Math.abs(tx.montant)` في `openClientTxModal:260`).
  - الإشارة هنا تُحدَّد فقط من **النوع**، لذلك المستخدم لا يستطيع كسرها.

---

### 🆔 B-003 — معادلة `Ajustement Solde` (دلتا الرصيد)

- **📁 الملف:السطر:** [src/hooks/useClientHandlers.ts:78-87](src/hooks/useClientHandlers.ts#L78)
- **🏷️ التصنيف:** رصيد / تعديل يدوي
- **📐 الكود الفعلي:**
  ```typescript
  const currentBal = clientBalances.get(editingClient.id) || 0;
  const newBal = parseAndEvaluate(clientBalanceInput);
  if (!isNaN(newBal) && Math.abs(newBal - currentBal) > 0.01) {
    const { date, time, timestamp } = now();
    await userDocRef.collection('dzd_client_txs').add({
      clientId: editingClient.id, timestamp, date, time,
      montant: newBal - currentBal, type: 'Ajustement Solde',
      notes: 'Mise à jour manuelle du solde', paymentMethod: 'Crédit'
    });
  }
  ```
- **📝 الصيغة الرياضية:**
  $$\Delta = \text{newBalance}_{\text{مدخل}} - \text{currentBalance}$$
  $$\text{ينشأ صف Ajustement Solde إذا } \lvert \Delta \rvert > 0.01\,\text{DZD}$$
- **🎯 الهدف:** السماح للمستخدم بضبط رصيد العميل مباشرة دون كتابة عملية عادية، مع توثيق التغيير في السجل (الفرق فقط، لا الرصيد المطلق).
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - **لا يستخدم `subM`**: `newBal - currentBal` قد يُنتج float drift نظريًا، لكن `currentBal` نفسه ناتج من جمع `montant` السابقة (B-001)، فالخطأ التراكمي موجود لكن غالبًا < 0.005.
  - `paymentMethod: 'Crédit'` ثابت — أي أن `Ajustement Solde` لا يولّد حركة خزينة (متّسق مع نية المشروع — هذا تعديل دفتري بحت).
  - حماية ضمنية: `Math.abs(Δ) > 0.01` يمنع إنشاء صفوف عبثية للفروق < 0.01 DZD.

---

### 🆔 B-004 — `Solde Initial` عند إنشاء عميل جديد

- **📁 الملف:السطر:** [src/hooks/useClientHandlers.ts:97-103](src/hooks/useClientHandlers.ts#L97)
- **🏷️ التصنيف:** رصيد / تهيئة
- **📐 الكود الفعلي:**
  ```typescript
  const initBal = parseAndEvaluate(initialBalance);
  if (initBal !== 0 && !isNaN(initBal)) {
    const { date, time, timestamp } = now();
    await userDocRef.collection('dzd_client_txs').add({
      clientId: ref.id, timestamp, date, time,
      type: 'Solde Initial', montant: initBal, notes: 'Solde initial', paymentMethod: 'Crédit'
    });
  }
  ```
- **📝 الصيغة الرياضية:**
  $$\text{صف Solde Initial} \;:\; \text{montant} = \text{initBal} \quad (\text{موجب أو سالب}) \quad \text{إذا } \text{initBal} \ne 0$$
- **🎯 الهدف:** إنشاء نقطة بداية في تاريخ العميل (تسبيق سابق أو دين موروث).
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - يقبل قيمًا سالبة (دين أولي) وموجبة (تسبيق أولي).
  - شرط `!== 0` صارم — لا يُسمح بصف `Solde Initial = 0`، وهو سلوك صحيح.
  - **`paymentMethod: 'Crédit'` ثابت** — مثل `Ajustement Solde`، لا يولّد حركة خزينة.

---

### 🆔 B-005 — تطابق `Transfert Entrant`/`Transfert Sortant` (counterpart matching)

- **📁 الملف:السطر:** [src/hooks/useClientHandlers.ts:118-138](src/hooks/useClientHandlers.ts#L118)
- **🏷️ التصنيف:** تحويل / ربط
- **📐 الكود الفعلي:**
  ```typescript
  const findTransferCounterpart = (tx: ClientTransactionDzd) => {
    if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant') return null;
    const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
    const counterpartAmount = -tx.montant;
    const candidates = clientTransactionsDzd.filter((candidate) =>
      candidate.id !== tx.id
      && candidate.clientId !== tx.clientId
      && candidate.type === counterpartType
      && candidate.date === tx.date
      && candidate.time === tx.time
      && Math.abs(candidate.montant - counterpartAmount) <= CLIENT_DELETE_EPSILON
      && Math.abs(candidate.timestamp - tx.timestamp) <= 1
    );
    if (candidates.length === 0) return null;
    return [...candidates].sort(
      (left, right) => Math.abs(left.timestamp - tx.timestamp) - Math.abs(right.timestamp - tx.timestamp)
    )[0];
  };
  ```
- **📝 المنطق المركّب (5 شروط متزامنة):**
  - النوع المعاكس (`Sortant` ↔ `Entrant`).
  - مبلغ معاكس: $\lvert \text{candidate.montant} - (-\text{tx.montant}) \rvert \le 0.01$.
  - **نفس `date` و `time` و `timestamp` ضمن نطاق 1ms**.
  - عميل مختلف.
  - عند تعدّد المرشحين → يُختار الأقرب زمنيًا.
- **🎯 الهدف:** تحديد الزوج الكامل للتحويل بين عميلين بحيث يمكن حذفه كوحدة واحدة (الحفاظ على المجموع الجبري = 0).
- **✅ الحكم:** **مشبوهة** ⚠️.
- **💡 الملاحظة الحرجة:**
  - **نطاق `±1ms` مشدّد جدًا**: لو فشلت كتابة batch في Firestore بعد latency فأعيدت الكتابة بمللي ثانية مختلفة، **لن يتطابق الزوج**. اعتمادًا على آلية `now()` (ربما `Date.now()`)، الـ batch يكتب بنفس timestamp عمليًا.
  - **لا يضمن one-to-one**: لو كان هناك تحويلان متطابقان عند نفس الـ date/time/timestamp بمبالغ متطابقة، `candidates` ستحوي اثنين، يُؤخذ الأقرب — لكن المرشح الثاني سيظل بدون شريك في عملية الحذف اللاحقة. **سيناريو نادر جدًا** لكنه غير محصَّن.
  - **مجموع جبري = 0 بالبناء فقط**: التحقّق هنا فقط عند الحذف. لا يوجد تحقّق ثابت بأن **كل** `Transfert Sortant` له `Transfert Entrant` في النظام (الـ orphan لن يُكتشف).

---

### 🆔 B-006 — منع حذف العميل ذي الرصيد غير الصفري

- **📁 الملف:السطر:** [src/hooks/useClientHandlers.ts:163-168](src/hooks/useClientHandlers.ts#L163)
- **🏷️ التصنيف:** حذف / حماية
- **📐 الكود الفعلي:**
  ```typescript
  const balance = clientBalances.get(client.id) || 0;
  if (Math.abs(balance) > CLIENT_DELETE_EPSILON) {
    setClientToDelete(client);
    setClientDeleteMode('blocked');
    return false;
  }
  ```
- **📝 الصيغة:**
  $$\text{يُحظر الحذف إذا } \lvert \text{balance} \rvert > 0.01 \;\text{DZD}$$
- **🎯 الهدف:** منع حذف عميل لديه رصيد فعلي (دين أو تسبيق) لتجنّب فقد أثر مالي.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - عتبة 0.01 DZD واسعة كافية لاستيعاب float drift من B-001.
  - الحذف بالتاريخ يُسمح به فقط حين `balance ≈ 0` (سطر 200-227).

---

### 🆔 B-007 — FIFO طابور الديون (إغلاق أقدم دين أولًا)

- **📁 الملف:السطر:** [src/hooks/useOverdueDebtClients.ts:48-95](src/hooks/useOverdueDebtClients.ts#L48)
- **🏷️ التصنيف:** ديون / FIFO
- **📐 الكود الفعلي (مختصر):**
  ```typescript
  const debtQueue: DebtLot[] = [];
  let availableCredit = 0;
  for (const tx of clientTxs) {  // مرتبة زمنيًا تصاعديًا
    const amount = Number(tx.montant || 0);
    if (Math.abs(amount) <= EPSILON) continue;

    if (amount < 0) {                        // عملية دين جديدة
      let incomingDebt = Math.abs(amount);
      if (availableCredit > EPSILON) {       // التسبيق السابق يقابلها أولًا
        const consumedCredit = Math.min(availableCredit, incomingDebt);
        availableCredit -= consumedCredit;
        incomingDebt -= consumedCredit;
      }
      if (incomingDebt > EPSILON) {
        debtQueue.push({ timestamp, date, remaining: incomingDebt });
      }
    } else {                                  // عملية دفع موجبة
      let remainingPayment = amount;
      while (remainingPayment > EPSILON && debtQueue.length > 0) {
        const oldestDebt = debtQueue[0];
        const consumed = Math.min(remainingPayment, oldestDebt.remaining);
        oldestDebt.remaining -= consumed;
        remainingPayment -= consumed;
        if (oldestDebt.remaining <= EPSILON) debtQueue.shift();
      }
      if (remainingPayment > EPSILON) availableCredit += remainingPayment;
    }
  }
  ```
- **📝 المنطق الرياضي/الزمني:**
  1. **الديون السالبة تدخل طابور FIFO** (يُحسم منها أي رصيد سابق `availableCredit` أولًا).
  2. **الدفعات الموجبة تُغلق أقدم دين أولًا** (`debtQueue[0]`)، الزائد يُضاف إلى `availableCredit`.
- **🎯 الهدف:** تتبّع عمر كل لوت دين بدقة لمعرفة المتأخر.
- **✅ الحكم:** **صحيحة** — تنفيذ نموذجي لـ FIFO.
- **💡 الملاحظة:**
  - **حماية ممتازة من float drift**: `EPSILON = 0.005` يُغلق الدين عند `≤ 0.005` بدل `= 0`.
  - **availableCredit التقاط ذكي**: لو دفع العميل قبل أن يُسجَّل دين، الفائض يصبح "تسبيق متاح" يُستخدم لتغطية أول دين قادم.
  - الترتيب الزمني للعمليات يتم في سطر 45: `clientTxs.slice().sort((a, b) => a.timestamp - b.timestamp)`.

---

### 🆔 B-008 — حساب عمر الدين ومقارنته بـ `minDays`

- **📁 الملف:السطر:** [src/hooks/useOverdueDebtClients.ts:98-102](src/hooks/useOverdueDebtClients.ts#L98)
- **🏷️ التصنيف:** ديون / تأخر
- **📐 الكود الفعلي:**
  ```typescript
  const overdueLots = debtQueue.filter((lot) => {
    if (lot.remaining <= EPSILON) return false;
    const days = Math.floor((nowTs - lot.timestamp) / DAY_MS);
    return days > minDays;
  });
  ```
- **📝 الصيغة الرياضية:**
  $$\text{days} = \left\lfloor \frac{\text{nowTs} - \text{lot.timestamp}}{86\,400\,000} \right\rfloor$$
  $$\text{متأخر} = (\text{lot.remaining} > 0.005) \;\wedge\; (\text{days} > 7)$$
- **🎯 الهدف:** عمر الدين بالأيام الكاملة (floor) > 7 أيام افتراضيًا.
- **✅ الحكم:** **صحيحة** — مع ملاحظة دلالية.
- **💡 الملاحظة:**
  - استخدام `Math.floor` يعني أن الدين عمره 7 أيام و23 ساعة لا يُعتبر متأخرًا (`days = 7`، لا `> 7`).
  - دلاليًا: `> minDays` يعني "أقدم من 7 أيام **كاملة**"، أي على الأقل اليوم الثامن. هذا قد يحتاج توضيحًا في الواجهة (هل المستخدم يعتقد أنه "بعد 7 أيام"؟).

---

### 🆔 B-009 — `overdueAmount` (الدين المعروض)

- **📁 الملف:السطر:** [src/hooks/useOverdueDebtClients.ts:106-109](src/hooks/useOverdueDebtClients.ts#L106)
- **🏷️ التصنيف:** ديون / عرض
- **📐 الكود الفعلي:**
  ```typescript
  const currentDebtAbs = Math.abs(Math.min(currentBalance, 0));
  const overdueAmount = Number(currentDebtAbs.toFixed(2));
  if (overdueAmount <= EPSILON) continue;
  ```
- **📝 الصيغة الرياضية:**
  $$\text{overdueAmount} = \left| \min(\text{currentBalance}, 0) \right| \;\text{(rounded to 2 decimals)}$$
- **🎯 الهدف:** عرض **الرصيد السالب الحالي بالكامل** (ليس مجموع لوتات الدين المتأخرة فقط) لـ "التماشي مع شاشة تفاصيل العميل" (تعليق سطر 107).
- **✅ الحكم:** **مشبوهة دلاليًا** ⚠️.
- **💡 الملاحظة الحرجة:**
  - **عدم تطابق رياضي محتمل**: `overdueAmount` هو الرصيد الحالي السالب الكلي، **بينما** `overdueLots` يقتصر على اللوتات > 7 أيام. لذا قد يحدث:
    - عميل عليه دين 1000 DZD منذ يومين (داخل tolerance) + دين 500 DZD منذ شهر (متأخر).
    - الرصيد الحالي = -1500.
    - `overdueLots` تحوي لوتًا واحدًا بـ 500.
    - `overdueAmount` المعروض = **1500** ✗ بدل **500** ✓.
  - السبب الموثَّق هو "parity مع شاشة تفاصيل العميل"، لكنه يُظهر دينًا حديثًا كأنه متأخر.
  - **توصية للنقاش (لا يُنفّذ بدون موافقة):** عرض القيمتين معًا (الدين الكلي + الدين المتأخر فقط) أو إعادة تسمية الحقل ليعكس "الدين الكلي للعميل ذو دين متأخر".

---

### 🆔 B-010 — `daysOverdue` (عمر أقدم دين متأخر)

- **📁 الملف:السطر:** [src/hooks/useOverdueDebtClients.ts:111-115](src/hooks/useOverdueDebtClients.ts#L111)
- **🏷️ التصنيف:** ديون / عرض
- **📐 الكود الفعلي:**
  ```typescript
  const oldestUnpaidTimestamp = overdueLots.reduce(
    (min, lot) => Math.min(min, lot.timestamp),
    overdueLots[0].timestamp
  );
  const daysOverdue = Math.floor((nowTs - oldestUnpaidTimestamp) / DAY_MS);
  ```
- **📝 الصيغة الرياضية:**
  $$t_{\text{أقدم}} = \min_{\text{lot} \in \text{overdueLots}} \text{lot.timestamp}$$
  $$\text{daysOverdue} = \left\lfloor \frac{\text{nowTs} - t_{\text{أقدم}}}{86\,400\,000} \right\rfloor$$
- **🎯 الهدف:** عرض عمر أقدم لوت دين غير مسدَّد كمؤشر شدّة التأخر.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:** بناء `oldestUnpaidTimestamp` فيه redundancy: `reduce` بقيمة ابتدائية `overdueLots[0].timestamp` — يعمل لكن `Math.min(...overdueLots.map(l => l.timestamp))` أقصر. لا أثر على الصحّة.

---

### 🆔 B-011 — ترتيب قائمة المتأخرين

- **📁 الملف:السطر:** [src/hooks/useOverdueDebtClients.ts:130-134](src/hooks/useOverdueDebtClients.ts#L130)
- **🏷️ التصنيف:** عرض / ترتيب
- **📐 الكود الفعلي:**
  ```typescript
  return results.sort((a, b) => {
    if (b.overdueAmount !== a.overdueAmount) return b.overdueAmount - a.overdueAmount;
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return a.fullName.localeCompare(b.fullName);
  });
  ```
- **📝 المنطق:** ترتيب ثلاثي:
  1. `overdueAmount` تنازليًا (الأكثر دينًا أولًا).
  2. ثم `daysOverdue` تنازليًا (الأقدم أولًا عند تساوي المبلغ).
  3. ثم اسم العميل تصاعديًا.
- **🎯 الهدف:** عرض الأكثر إلحاحًا أولًا.
- **✅ الحكم:** **صحيحة**.

---

### 🆔 B-012 — تزامن خزينة العميل عند `cash`/`baridi`

- **📁 الملف:السطر:** [src/hooks/useClientHandlers.ts:313-330, 342-350](src/hooks/useClientHandlers.ts#L313)
- **🏷️ التصنيف:** خزينة / ربط
- **📐 الكود الفعلي (إنشاء عملية جديدة):**
  ```typescript
  if (clientPaymentStatus !== 'credit') {
    const treasuryRef = userDocRef.collection('treasury_txs').doc();
    const tType = (clientTxType === 'Règlement Reçu') ? 'Ajout' : 'Retrait';
    batch.set(treasuryRef, {
      timestamp, date, time, type: tType,
      source: clientPaymentStatus === 'cash' ? 'Caisse' : 'BaridiMob',
      amount, notes: `Client: ${targetClientName} - ...`,
      linkedTxId: clientTxRef.id, origin: 'client_tx'
    });
    batch.update(clientTxRef, { linkedTxId: treasuryRef.id });
  }
  ```
- **📝 المنطق:**
  - `clientTxType === 'Règlement Reçu'` ⇒ `treasury.type = 'Ajout'` (دخول للخزينة).
  - أي نوع آخر (`Paiement Effectué`, ...) ⇒ `treasury.type = 'Retrait'`.
  - `source` يُحدَّد من `clientPaymentStatus` (`cash` → `Caisse`، `baridi` → `BaridiMob`).
  - **ربط ثنائي**: `treasury.linkedTxId = clientTx.id` و `clientTx.linkedTxId = treasury.id`.
- **🎯 الهدف:** ضمان أن كل دفع/استلام نقدي/بريدي يُسجَّل في الخزينة بإشارة صحيحة.
- **✅ الحكم:** **صحيحة** ⚠️ مع ملاحظة لا تخصّ الصحّة الرياضية.
- **💡 الملاحظة:**
  - **أمان batch atomicity**: في Firestore، `batch.set` ثم `batch.update` ينفذان معًا → الربط الثنائي محفوظ ذرّيًا. ✓
  - **حالة التعديل** (سطر 311-331): إذا التغيير `cash → credit`، يُحذف صف الخزينة + تحذف خاصة `linkedTxId`. إذا `cash → baridi`، يُحدَّث `source` فقط (لا حذف). **منطق صحيح**.
  - **النقطة المشبوهة:** في حالة التعديل، إذا `clientPaymentStatus === 'credit'` لكن `editingClientTx.linkedTxId` ضائع/تالف (لا treasury مطابق)، `batch.delete` على ref غير موجود قد يفشل. ⚠️ يحتاج فحص سلوك Firestore على `delete()` على وثيقة غير موجودة (في الغالب يتجاهلها بهدوء).

---

### 🆔 B-013 — تطابق `paymentMethodMap` بين القراءة والكتابة

- **📁 الملف:السطر:** [src/hooks/useClientHandlers.ts:265-267, 302](src/hooks/useClientHandlers.ts#L265)
- **🏷️ التصنيف:** ترميز / توافق
- **📐 الكود الفعلي:**
  ```typescript
  // Read (line 265-267):
  if (existingPaymentMethod === 'Crédit' || existingPaymentMethod === 'Crédit' || !existingPaymentMethod) setClientPaymentStatus('credit');
  else if (existingPaymentMethod === 'Espèces' || existingPaymentMethod === 'Espèces') setClientPaymentStatus('cash');
  else if (existingPaymentMethod === 'BaridiMob') setClientPaymentStatus('baridi');

  // Write (line 302):
  const paymentMethodMap = { credit: 'Crédit', cash: 'Espèces', baridi: 'BaridiMob' };
  ```
- **🎯 الهدف:** التوافق بين البيانات القديمة (مع/بدون encoding) والقيم الجديدة.
- **✅ الحكم:** **مشبوهة لأسباب encoding** ⚠️.
- **💡 الملاحظة:**
  - **مشكلة encoding واضحة**: في الكود تظهر `'Crédit'` و `'Espèces'` كنفس النص (الكود قد يحوي بصمات mojibake مثل `Crédit` أو UTF-8 mis-encoded). نتيجة:
    - لو خُزِّن `existingPaymentMethod === 'Crédit'` بـ encoding مختلف عن الذي يُقارَن به الآن → الفرع لن يُنفَّذ.
    - السطر 265 يكرّر نفس النص مرتين (`'Crédit' || 'Crédit'`) — قد يكون سهوًا لمعالجة encoding مزدوج.
  - **هذا ليس خطأ رياضيًا** بل خطأ توافق بيانات قد يقفل العميل في `clientPaymentStatus = 'credit'` افتراضيًا حتى لو الواقع غير ذلك.
  - **توصية للنقاش (لا يُنفّذ بدون موافقة):** توحيد encoding عبر تطبيع `existingPaymentMethod` بـ `String(...).normalize('NFC')` قبل المقارنة، أو الانتقال إلى enum بكلمات إنجليزية.

---

### 🆔 B-014 — حذف `Transfert` بكامل زوجه (سلامة المجموع الجبري)

- **📁 الملف:السطر:** [src/hooks/useClientHandlers.ts:200-227](src/hooks/useClientHandlers.ts#L200)
- **🏷️ التصنيف:** حذف / تكامل
- **📐 الكود الفعلي:**
  ```typescript
  for (const tx of clientHistory) {
    clientTxIdsToDelete.add(tx.id);
    const transferCounterpart = findTransferCounterpart(tx);
    if (transferCounterpart) {
      clientTxIdsToDelete.add(transferCounterpart.id);
    }
    if (tx.linkedTxId && treasuryTxIds.has(tx.linkedTxId)) {
      treasuryTxIdsToDelete.add(tx.linkedTxId);
    }
  }
  for (const treasuryTx of treasuryTransactions) {
    if (treasuryTx.linkedTxId && clientTxIdsToDelete.has(treasuryTx.linkedTxId)) {
      treasuryTxIdsToDelete.add(treasuryTx.id);
    }
  }
  ```
- **📝 المنطق:** عند حذف عميل بتاريخه:
  1. كل صفوف العميل تُحذف.
  2. كل counterpart لـ `Transfert` (بحسب B-005) يُحذف من العميل الآخر.
  3. كل `treasury_tx` المرتبط بصف عميل يُحذف.
- **🎯 الهدف:** الحفاظ على المجموع الجبري `Σ Transfert = 0` بعد الحذف.
- **✅ الحكم:** **مشبوهة** ⚠️ — تتبع B-005.
- **💡 الملاحظة الحرجة:**
  - تعتمد كليًا على نجاح `findTransferCounterpart`. لو فشل التطابق (مثلًا فرق `timestamp > 1ms`)، **سيُحذف الـ `Transfert Sortant` ويبقى `Transfert Entrant` يتيمًا** — رصيد العميل الآخر سيقفز بـ `+amount` بشكل غير مبرَّر.
  - لا يوجد فحص ما-بعد-الحذف للتأكد من أن المجموع الجبري للتحويلات في النظام لا يزال صفرًا.
  - **هذا أحد أهم سيناريوهات تكامل البيانات الواجب اختبارها** (سيُضاف اختبار في القسم H).

---

## 📊 إحصائيات أولية للقسم B

| البند | العدد |
|------|------|
| إجمالي المعادلات الموثّقة في القسم B | **14** |
| ✅ صحيحة | **9** |
| ⚠️ مشبوهة (تستحق توضيحًا أو فحصًا) | **5** (B-001, B-005, B-009, B-013, B-014) |
| ❌ خاطئة | **0** |
| 🤔 تحتاج توضيحًا | **0** |

### ⚠️ نقاط مشبوهة في القسم B — للنقاش مع المالك

1. **B-001 (`+` المباشر بدل `addM`):** الأرصدة عرضة لـ float drift نظري عند تراكم العمليات. عمليًا محدود لأن المدخلات `Math.round`-ed، لكنه يكسر تجانس استخدام `money.ts`.
2. **B-005 (Transfer counterpart):** نطاق `±1ms` مشدّد + لا قيد one-to-one. سيناريوهات نادرة قد تكسر السلامة.
3. **B-009 (`overdueAmount` = الرصيد الكلي):** الرقم المعروض هو الرصيد السالب الكلي وليس مجموع اللوتات المتأخرة فقط. قد يضلل المستخدم.
4. **B-013 (encoding `paymentMethod`):** مقارنات نصية مع رموز UTF-8 معتمدة على encoding، وتكرار `'Crédit' || 'Crédit'` يُلمح إلى مشكلة موثّقة سابقًا.
5. **B-014 (حذف Transfer مع counterpart):** نقطة هشاشة موثّقة — أي فشل في `findTransferCounterpart` يخلق "أيتام" في الطرف الآخر.

### ✅ نقاط متينة في القسم B

- **B-007 (FIFO الديون):** تنفيذ نموذجي بحماية ممتازة من float drift عبر `EPSILON = 0.005`، ومنطق `availableCredit` ذكي للتسبيقات السابقة.
- **B-006 (حماية الحذف):** `Math.abs(balance) > 0.01` كافٍ لاستيعاب الانحرافات.
- **B-002 (قاعدة الإشارة):** الإشارة تُحدَّد من النوع وحده — لا يستطيع المستخدم كسرها.

### ❓ سؤال مفتوح للمالك بناء على القسم B

**Q5 — B-009 (`overdueAmount`):** هل العرض الحالي (الرصيد السالب الكلي) متعمَّد لتجنّب التشتيت في الواجهة، أم يجب فصل "الدين الكلي" عن "الدين المتأخر فقط"؟

---

## ⏸️ نهاية القسم B

**القسم C (الخزينة Caisse / BaridiMob) جاهز للبدء فور موافقتك.**

---

# 🟨 القسم C — الخزينة (Caisse / BaridiMob) والأصول اليدوية

**الملفات المعنيّة:**
- [src/hooks/useAppData.ts:193-265](src/hooks/useAppData.ts#L193) — `treasuryStats`, `assetClientBalances`, `assetBalances`
- [src/pages/TresoreriePage.tsx](src/pages/TresoreriePage.tsx) (120 سطر) — `manualCardsTotal`, `positionNette`, `capitalTotal`
- [src/hooks/useAssetHandlers.ts](src/hooks/useAssetHandlers.ts) (304 سطر) — CRUD الأصول اليدوية + ربط الخزينة

**الثوابت العامة في القسم C:**

| الثابت / السلوك | القيمة | الموقع |
|------------------|--------|---------|
| Treasury `normalizeZero` epsilon | `< 0.005` | [useAppData.ts:194](src/hooks/useAppData.ts#L194) |
| Asset client delete tolerance | `Math.abs(bal) > 0.01` | [useAssetHandlers.ts:235](src/hooks/useAssetHandlers.ts#L235) |
| Asset client adjustment threshold | `Math.abs(newBalance - currentBalance) > 0.01` | [useAssetHandlers.ts:205](src/hooks/useAssetHandlers.ts#L205) |
| Treasury tx amount guard | `!Number.isFinite(amount) \|\| amount <= 0 → skip` | [useAppData.ts:213](src/hooks/useAppData.ts#L213) |

**أنواع `treasury_tx.type`:** `Ajout`, `Retrait`, `Adjustment (+)`, `Adjustment (-)`, `Transfer`.
**قيم `origin`:** `manual_asset`, `client_tx`, `usdt_tx`, `balance_edit` (وفق `CLAUDE_PROJECT_INTENT.md §7`).

---

### 🆔 C-001 — حساب رصيد `Caisse` و `BaridiMob`

- **📁 الملف:السطر:** [src/hooks/useAppData.ts:209-237](src/hooks/useAppData.ts#L209)
- **🏷️ التصنيف:** خزينة / تجميع
- **📐 الكود الفعلي:**
  ```typescript
  let caisse = 0, baridi = 0;
  treasuryTransactions.forEach(tx => {
    const amount = Number(tx.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;

    if (tx.type === 'Transfer') { /* انظر C-002 */ return; }

    let factor = 0;
    if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)') factor = 1;
    else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)') factor = -1;

    const source = txData.source
      || (txData.asset === 'DZD-Caisse' ? 'Caisse' : txData.asset === 'DZD-Baridi' ? 'BaridiMob' : null);

    if (source === 'Caisse') caisse += (amount * factor);
    if (source === 'BaridiMob') baridi += (amount * factor);
  });
  return { caisse: normalizeZero(caisse), baridi: normalizeZero(baridi) };
  ```
- **📝 الصيغة الرياضية:**
  $$\text{caisse} = \sum_{\substack{tx \;:\; \text{src=Caisse} \\ tx.\text{type} \in \{\text{Ajout, Adj+}\}}} \text{amount} \;-\; \sum_{\substack{tx \;:\; \text{src=Caisse} \\ tx.\text{type} \in \{\text{Retrait, Adj-}\}}} \text{amount} \;+\; \text{أثر Transfer (C-002)}$$
- **🎯 الهدف:** اشتقاق رصيد كل خزينة من سجل `treasury_txs` بالكامل.
- **✅ الحكم:** **صحيحة** ⚠️ مع ملاحظة دقّة.
- **💡 الملاحظة:**
  - **`amount` دائمًا موجب**: الاتجاه يأتي من `type` (متّسق مع `CLAUDE_PROJECT_INTENT.md §7`).
  - **حماية ضد القيم غير الصالحة**: `!Number.isFinite || amount <= 0 → skip` (سطر 213).
  - **يستخدم `+/-` المباشر بدل `addM`/`subM`** — مثل B-001، عرضة لـ float drift نظري لكن المدخلات موجبة عادةً (`Math.round` في useTransactionHandlers).
  - **`normalizeZero` في النهاية** يحمي من float drift في النتيجة (`< 0.005 → 0` ثم `toFixed(2)`).
  - **`factor = 0` لأي type غير معروف** — يتجاهل الصف بصمت (لا تحذير). ⚠️ قد يخفي بيانات تالفة.

---

### 🆔 C-002 — معالجة `Transfer` بين الخزينتين

- **📁 الملف:السطر:** [src/hooks/useAppData.ts:215-225](src/hooks/useAppData.ts#L215)
- **🏷️ التصنيف:** خزينة / تحويل
- **📐 الكود الفعلي:**
  ```typescript
  if (tx.type === 'Transfer') {
    const legacy = parseLegacyTransfer(txData.asset);
    const from = resolveWallet(txData.source) || legacy.from;
    const to = resolveWallet(txData.destination) || legacy.to;
    if (!from || !to || from === to) return;
    if (from === 'Caisse') caisse -= amount;
    if (from === 'BaridiMob') baridi -= amount;
    if (to === 'Caisse') caisse += amount;
    if (to === 'BaridiMob') baridi += amount;
    return;
  }
  ```
- **📝 الصيغة الرياضية:**
  $$\Delta\text{caisse}_{\text{transfer}} = \begin{cases} -\text{amount} & \text{إذا from=Caisse} \\ +\text{amount} & \text{إذا to=Caisse} \\ 0 & \text{غير ذلك} \end{cases}$$
  $$\sum (\Delta\text{caisse}_{\text{transfer}} + \Delta\text{baridi}_{\text{transfer}}) = 0 \quad \text{لكل صف Transfer}$$
- **🎯 الهدف:** تحويل المبلغ من خزينة إلى أخرى مع ضمان أن المجموع الكلي للنظام لا يتغيّر.
- **✅ الحكم:** **صحيحة** — مجموع جبري = 0 مضمون.
- **💡 الملاحظة:**
  - **حماية ضد التحويل إلى نفس الخزينة**: `from === to → return`.
  - **حماية ضد المصدر/الوجهة المفقودين**: `!from || !to → return`.
  - **lex-flexible**: يقبل `source`/`destination` الجديدة و`asset` القديم (legacy parser).

---

### 🆔 C-003 — `parseLegacyTransfer` (تحليل صيغة قديمة)

- **📁 الملف:السطر:** [src/hooks/useAppData.ts:202-207](src/hooks/useAppData.ts#L202)
- **🏷️ التصنيف:** توافق / قديم
- **📐 الكود الفعلي:**
  ```typescript
  const parseLegacyTransfer = (rawAsset?: string) => {
    if (!rawAsset) return { from: null, to: null };
    const match = /from\s+(.+?)\s+to\s+(.+)/i.exec(rawAsset);
    if (!match) return { from: null, to: null };
    return { from: resolveWallet(match[1]), to: resolveWallet(match[2]) };
  };
  ```
- **📝 المنطق:** regex `/from (.+?) to (.+)/i` على نص `tx.asset` (مثلًا `"from Caisse to BaridiMob"`).
- **🎯 الهدف:** قراءة بيانات تاريخية لم تكن تستخدم `source`/`destination` الموحّدة.
- **✅ الحكم:** **صحيحة** — توافق رجعي مفيد.
- **💡 الملاحظة:** الـ regex لا تتعامل مع لغات/تنسيقات بديلة (مثل `de Caisse à BaridiMob`)، لكن هذا متعمَّد لأن الصيغة القديمة كانت بالإنجليزية.

---

### 🆔 C-004 — `resolveWallet` (تطبيع اسم الخزينة)

- **📁 الملف:السطر:** [src/hooks/useAppData.ts:195-201](src/hooks/useAppData.ts#L195)
- **🏷️ التصنيف:** تطبيع / تطابق
- **📐 الكود الفعلي:**
  ```typescript
  const resolveWallet = (raw: any) => {
    if (!raw) return null;
    const normalized = String(raw).toLowerCase();
    if (normalized.includes('caisse')) return 'Caisse';
    if (normalized.includes('baridi')) return 'BaridiMob';
    return null;
  };
  ```
- **📝 المنطق:** lowercase + includes.
- **🎯 الهدف:** قبول صيغ مختلفة (`"caisse"`, `"Caisse"`, `"DZD-Caisse"`, `"my caisse"`) وتطبيعها.
- **✅ الحكم:** **مشبوهة** ⚠️.
- **💡 الملاحظة:**
  - **هشاشة محتملة**: نص يحوي `"caisse-baridi"` (مثلًا اسم وصفي) سيُحَلّ كـ `Caisse` لأن `includes('caisse')` يأتي أولًا. لا يفترض حدوث هذا في بياناتك، لكن يستحق ذكرًا.
  - **لا normalization Unicode**: مثلما في B-013، نص بـ encoding غير NFC قد لا يطابق `'caisse'` رغم تشابهه بصريًا.

---

### 🆔 C-005 — `manualCardsTotal` (مجموع البطاقات اليدوية)

- **📁 الملف:السطر:** [src/pages/TresoreriePage.tsx:53-56](src/pages/TresoreriePage.tsx#L53)
- **🏷️ التصنيف:** خزينة / تجميع
- **📐 الكود الفعلي:**
  ```typescript
  const manualCardsTotal = useMemo(
    () => treasuryCards.reduce((acc, card) => acc + (Number(card.value) || 0), 0),
    [treasuryCards]
  );
  ```
- **📝 الصيغة الرياضية:**
  $$\text{manualCardsTotal} = \sum_{\text{card} \in \text{treasuryCards}} \text{Number(card.value)}$$
- **🎯 الهدف:** مجموع قيم بطاقات الخزينة اليدوية (مصادر خزينة إضافية مسجَّلة بقيمة ثابتة).
- **✅ الحكم:** **صحيحة** ⚠️ مع ملاحظة `addM` (مماثلة لـ B-001).
- **💡 الملاحظة:**
  - استخدام `+` المباشر — `addM`/`sumM` أنسب نظريًا.
  - `Number(card.value) || 0` يحمي من قيم غير صالحة، لكن يحوّل `NaN`/`undefined` إلى 0 بدون تحذير.

---

### 🆔 C-006 — `positionNette` (الموقف الصافي للعملاء/الأصول)

- **📁 الملف:السطر:** [src/pages/TresoreriePage.tsx:58-59](src/pages/TresoreriePage.tsx#L58)
- **🏷️ التصنيف:** خزينة / تجميع
- **📐 الكود الفعلي:**
  ```typescript
  const dettesAbs = Math.abs(totalDettes);
  const positionNette = totalAvances - dettesAbs;
  ```
- **📝 الصيغة الرياضية:**
  $$\text{dettesAbs} = \lvert \text{totalDettes} \rvert$$
  $$\text{positionNette} = \text{totalAvances} - \text{dettesAbs}$$
  حيث:
  - `totalAvances` = $\sum_{b > 0} b$ (مجموع أرصدة العملاء/الأصول الموجبة = تسبيقات/ودائع).
  - `totalDettes` = $\sum_{b < 0} b$ (سالب لأن $b<0$).
  - `dettesAbs` = الدين المستحق علينا للعملاء... **انتبه:** هل هذا "ديون لنا" أم "ديون علينا"؟

- **🎯 الهدف:** عرض الموقف الصافي بين ما "نَدِين به للعملاء" (avances/تسبيقات) و"ما يدينه العملاء لنا" (dettes/أرصدة سالبة).
- **✅ الحكم:** **صحيحة دلاليًا** — مع ملاحظة قراءة الإشارة.
- **💡 الملاحظة الحرجة (مرجع لقاعدة الإشارة في B-002):**
  - `b > 0`: تسبيق للعميل = **نحن نَدِين بهذا المبلغ للعميل** (خصم على الشركة).
  - `b < 0`: دين على العميل = **العميل يَدِين لنا** (أصل للشركة).
  - `dettesAbs` = $|\sum b<0|$ = إجمالي ما يدينه العملاء **لنا** (أصل).
  - `totalAvances` = ما نَدِين به **لهم** (خصم).
  - `positionNette = avances - dettesAbs > 0` ⇒ نَدِين أكثر مما يَدِينون لنا (خصوم تتجاوز الأصول الجارية).
  - `positionNette < 0` ⇒ يَدِينون لنا أكثر (أصول تتجاوز الخصوم).
- **توافق مع المعادلة:** ✓ `positionNette` كما يفهمه التطبيق هو "صافي الإلتزامات تجاه العملاء" (موجب = ندين أكثر).

---

### 🆔 C-007 — `capitalTotal` (رأس المال الكلي للنظام)

- **📁 الملف:السطر:** [src/pages/TresoreriePage.tsx:60-64](src/pages/TresoreriePage.tsx#L60)
- **🏷️ التصنيف:** تقرير / محاسبة كلية
- **📐 الكود الفعلي:**
  ```typescript
  const capitalTotal = (Number(caisseBalance) || 0)
    + (Number(baridiBalance) || 0)
    + (Number(portfolioValue) || 0)
    + manualCardsTotal
    - positionNette;
  ```
- **📝 الصيغة الرياضية:**
  $$\text{capitalTotal} = \text{caisse} + \text{baridi} + \text{portfolio} + \text{manualCards} - (\text{avances} - \text{dettesAbs})$$
  $$= \text{caisse} + \text{baridi} + \text{portfolio} + \text{manualCards} - \text{avances} + \text{dettesAbs}$$
- **🎯 الهدف:** **حقوق الملكية الكلية** = الأصول - الخصوم.
- **✅ الحكم:** **صحيحة محاسبيًا** ✓.
- **💡 شرح محاسبي مفصّل:**
  - **الأصول:** نقد (`caisse + baridi`) + مخزون عملات (`portfolio`) + بطاقات يدوية (`manualCards`) + ديون مستحقة لنا (`dettesAbs`).
  - **الخصوم:** تسبيقات العملاء (`avances`).
  - **حقوق الملكية = الأصول - الخصوم** = `caisse + baridi + portfolio + manualCards + dettesAbs - avances` ✓ (يطابق المعادلة).
  - **`portfolioValue` يجب أن يأتي بالـ DZD** (قيمة USDT × سعر السوق + قيمة EUR × سعر السوق). [يحتاج فحص في القسم E].
- **⚠️ ملاحظات على المخاطر:**
  1. **عدم تضمين `assetBalances` (الأصول اليدوية):** `capitalTotal` لا يضم رصيد الأصول اليدوية مباشرة — لكن `totalDettes` و `totalAvances` في `useAppData.ts:267-272` يضمّان `assetBalances` ضمن المجموع. **هذا قد يكون متعمَّدًا** (الأصول اليدوية تشبه ديون/تسبيقات لا أصولًا) لكن يستحق توضيح.
  2. **`portfolioValue` ليس بالضرورة بالـ DZD المحدَّث**: يعتمد على من يحسبه ويمرّره للصفحة. سؤال للمالك أدناه.

---

### 🆔 C-008 — `assetClientBalances` (رصيد العميل في أصل يدوي)

- **📁 الملف:السطر:** [src/hooks/useAppData.ts:250-257](src/hooks/useAppData.ts#L250)
- **🏷️ التصنيف:** أصل يدوي / تجميع
- **📐 الكود الفعلي:**
  ```typescript
  const assetClientBalances = useMemo(() => {
    const map = new Map<string, number>();
    manualAssetTransactions.forEach(tx => {
      const key = `${tx.actifId}_${tx.clientId}`;
      map.set(key, (map.get(key) || 0) + tx.amount);
    });
    return map;
  }, [manualAssetTransactions]);
  ```
- **📝 الصيغة الرياضية:**
  $$\text{balance}(\text{actifId}, \text{clientId}) = \sum_{\substack{tx \in \text{actifTxs} \\ tx.\text{actifId}=A, tx.\text{clientId}=C}} tx.\text{amount}$$
- **🎯 الهدف:** رصيد كل عميل ضمن كل أصل يدوي (مفتاح مركّب).
- **✅ الحكم:** **مشبوهة** ⚠️.
- **💡 الملاحظة الحرجة:**
  - **لا فلتر `affectsBalance`**: على عكس `clientBalances` (B-001) الذي يتجاهل `affectsBalance === false`، **هنا كل العمليات تُجمع بدون استثناء**. إذا أُضيف لاحقًا حقل `affectsBalance` للعمليات اليدوية، سينكسر الحساب.
  - **استخدام `+` المباشر**: مثل B-001, C-005.
  - **مفتاح مركّب آمن**: `${actifId}_${clientId}` — لا تصادم.

---

### 🆔 C-009 — `assetBalances` (مجموع رصيد كل أصل)

- **📁 الملف:السطر:** [src/hooks/useAppData.ts:259-265](src/hooks/useAppData.ts#L259)
- **🏷️ التصنيف:** أصل يدوي / تجميع
- **📐 الكود الفعلي:**
  ```typescript
  const assetBalances = useMemo(() => {
    const map = new Map<string, number>();
    manualAssetTransactions.forEach(tx => {
      map.set(tx.actifId, (map.get(tx.actifId) || 0) + tx.amount);
    });
    return map;
  }, [manualAssetTransactions]);
  ```
- **📝 الصيغة:** $\text{balance}(A) = \sum_{tx \in \text{actifTxs}_A} tx.\text{amount}$.
- **🎯 الهدف:** مجموع كل أرصدة عملاء كل أصل.
- **✅ الحكم:** **صحيحة** — مع نفس ملاحظات C-008 (لا فلتر، `+` مباشر).

---

### 🆔 C-010 — ربط `manual_asset.payment_received` بالخزينة

- **📁 الملف:السطر:** [src/hooks/useAssetHandlers.ts:107-123](src/hooks/useAssetHandlers.ts#L107)
- **🏷️ التصنيف:** أصل يدوي / تزامن خزينة
- **📐 الكود الفعلي:**
  ```typescript
  if (data.type === 'payment_received' && (data.paymentMethod === 'cash' || data.paymentMethod === 'baridi')) {
    const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
    batch.set(treasuryTxRef, {
      timestamp: data.timestamp,
      date: data.date,
      time: data.time,
      type: 'Ajout',
      source: data.paymentMethod === 'cash' ? 'Caisse' : 'BaridiMob',
      amount: Math.abs(Number(data.amount)),
      notes: `Paiement ${client?.fullName || 'Client'} - ${asset?.name || 'Actif'}`,
      origin: 'manual_asset',
      linkedAssetTxId: assetTxRef.id
    });
    batch.update(assetTxRef, { linkedTreasuryTxId: treasuryTxRef.id });
  }
  ```
- **📝 المنطق:**
  - شرط الإنشاء: `payment_received && paymentMethod ∈ {cash, baridi}`.
  - `treasury_tx.type = 'Ajout'` دائمًا (دخول للخزينة).
  - `amount = |Number(data.amount)|` — موجب دائمًا.
  - ربط ثنائي عبر `linkedAssetTxId` ↔ `linkedTreasuryTxId`.
  - `origin = 'manual_asset'` للتمييز.
- **🎯 الهدف:** ضمان أن دفع العميل في أصل يدوي ينعكس في الخزينة.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - **حالات مفقودة محتملة:**
    - **`expense` (مصروف على أصل يدوي):** الكود لا يُنشئ صف خزينة `Retrait` لأي نوع غير `payment_received`. إذا كان لديك "expense paid in cash" يستهلك من الخزينة، فلن يُسجَّل تلقائيًا. **يحتاج تأكيد المالك إن كان هذا مقصودًا.**
    - **`adjustment`:** نوع `'adjustment'` (يُستخدم للـ Solde Initial وتعديلات يدوية) لا يربط بالخزينة — منطقي (تعديل دفتري بحت).
  - **عدم وجود تحديث لربط Treasury عند تعديل عملية أصل يدوي:** `handleCreateAssetTransaction` يُنشئ فقط. إذا عُدِّلت عملية لاحقًا، الربط القائم قد يصبح غير متّسق. **يحتاج فحص `handleUpdate` للأصول اليدوية** — يبدو أنه لا يوجد في `useAssetHandlers.ts` (فقط Create + Delete).

---

### 🆔 C-011 — `Solde Initial` للعميل في أصل يدوي

- **📁 الملف:السطر:** [src/hooks/useAssetHandlers.ts:158-171](src/hooks/useAssetHandlers.ts#L158)
- **🏷️ التصنيف:** أصل يدوي / تهيئة
- **📐 الكود الفعلي:**
  ```typescript
  const initialBal = typeof input?.balance === 'number' ? input.balance : parseFloat(assetClientBalance);
  if (!Number.isNaN(initialBal) && initialBal !== 0) {
    await userDocRef.collection('actifTransactions').add({
      actifId: assetId, clientId: clientRef.id,
      type: 'adjustment', amount: initialBal,
      date: ..., time: ..., timestamp: ...,
      notes: 'Solde Initial'
    });
  }
  ```
- **📝 الصيغة:** صف `adjustment` بـ `amount = initialBal` (موجب أو سالب).
- **🎯 الهدف:** تأسيس رصيد أولي للعميل في أصل يدوي.
- **✅ الحكم:** **صحيحة** — مماثلة لـ B-004.
- **💡 الملاحظة:** يستخدم `parseFloat` بدل `parseAndEvaluate` (مساعد التطبيق). لا يقبل تعابير حسابية مثل `"100+50"`. ❓ **اتساق مع B-004**.

---

### 🆔 C-012 — `Ajustement Solde` لعميل أصل يدوي (دلتا)

- **📁 الملف:السطر:** [src/hooks/useAssetHandlers.ts:202-217](src/hooks/useAssetHandlers.ts#L202)
- **🏷️ التصنيف:** أصل يدوي / تعديل
- **📐 الكود الفعلي:**
  ```typescript
  const currentBalance = assetClientBalances.get(`${targetAssetId}_${clientId}`) || 0;
  const newBalance = typeof input?.balance === 'number' ? input.balance : parseFloat(assetClientBalance);
  if (!Number.isNaN(newBalance) && Math.abs(newBalance - currentBalance) > 0.01) {
    await userDocRef.collection('actifTransactions').add({
      actifId: targetAssetId, clientId,
      type: 'adjustment', amount: newBalance - currentBalance,
      date: ..., time: ..., timestamp: ...,
      notes: 'Ajustement manuel du solde'
    });
  }
  ```
- **📝 الصيغة:** $\Delta = \text{newBalance} - \text{currentBalance}$، صف `adjustment` بهذا الفرق إذا $|\Delta| > 0.01$.
- **🎯 الهدف:** نفس B-003 لكن للأصول اليدوية.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:** متّسقة مع B-003 في العتبة (0.01 DZD) والمنطق. جيد.

---

### 🆔 C-013 — منع حذف عميل أصل يدوي بِرصيد غير صفري

- **📁 الملف:السطر:** [src/hooks/useAssetHandlers.ts:230-238](src/hooks/useAssetHandlers.ts#L230)
- **🏷️ التصنيف:** حذف / حماية
- **📐 الكود الفعلي:**
  ```typescript
  const bal = assetClientBalances.get(`${client.assetId}_${clientId}`) || 0;
  if (Math.abs(bal) > 0.01) {
    setAlert('⚠️ Impossible de supprimer : Solde non nul.');
    return;
  }
  ```
- **📝 المنطق:** عتبة 0.01 DZD مماثلة لـ B-006.
- **🎯 الهدف:** منع فقدان أثر مالي.
- **✅ الحكم:** **صحيحة** ومتّسقة.
- **💡 الملاحظة:** **لا توجد آلية حذف بالتاريخ كما في B-014**. عميل أصل يدوي ذو رصيد صفري + تاريخ غير صفري يُحذَف — لكن **عملياته في `actifTransactions` تبقى يتيمة**. ⚠️ **مشبوهة**: يحتاج فحص هل الـ `clientId` المرجعي تُحذف عملياته أيضًا.

---

### 🆔 C-014 — منع حذف أصل بـ عمليات

- **📁 الملف:السطر:** [src/hooks/useAssetHandlers.ts:80-84](src/hooks/useAssetHandlers.ts#L80)
- **🏷️ التصنيف:** حذف / حماية
- **📐 الكود الفعلي:**
  ```typescript
  if (txCount > 0) {
    setAlert('⚠️ Impossible de supprimer : Transactions existantes.');
    return;
  }
  ```
- **🎯 الهدف:** منع حذف أصل لا يزال له تاريخ.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:** أبسط من B-006 — لا يوجد خيار "حذف بالتاريخ" للأصول. أكثر تحفّظًا.

---

## 📊 إحصائيات أولية للقسم C

| البند | العدد |
|------|------|
| إجمالي المعادلات الموثّقة في القسم C | **14** |
| ✅ صحيحة | **9** |
| ⚠️ مشبوهة (تستحق توضيحًا أو فحصًا) | **5** (C-001, C-004, C-008, C-010, C-013) |
| ❌ خاطئة | **0** |
| 🤔 تحتاج توضيحًا | **0** |

### ⚠️ نقاط مشبوهة في القسم C — للنقاش مع المالك

1. **C-001 (treasuryStats):** `+/-` مباشر بدل `addM/subM`، و `factor = 0` لأي type غير معروف يتجاهل صفًا بصمت.
2. **C-004 (`resolveWallet`):** `includes('caisse')` على نص يحوي `"caisse-baridi"` يفضّل Caisse — هشاشة نظرية.
3. **C-008 (`assetClientBalances`):** لا فلتر `affectsBalance` — تفاوت مع B-001.
4. **C-010 (manual_asset → treasury):** يربط فقط `payment_received` وليس `expense`. لا يوجد handler `update` للعمليات. سؤال للمالك.
5. **C-013 (حذف عميل أصل يدوي):** لا حذف بالتاريخ كما في B-014 — قد يخلّف عمليات يتيمة في `actifTransactions`.

### ✅ نقاط متينة في القسم C

- **C-002 (`Transfer` بين الخزينتين):** المجموع الجبري = 0 مضمون رياضيًا (نقص = زيادة بنفس amount). حماية ممتازة ضد `from === to`.
- **C-006 (`positionNette`) و C-007 (`capitalTotal`):** معادلة محاسبية صحيحة `حقوق الملكية = الأصول - الخصوم` تأخذ الإشارات بشكل سليم.
- **C-014 (حذف أصل):** حماية صارمة `txCount > 0 → block` — متحفّظة.

### ❓ أسئلة جديدة مفتوحة للمالك بناء على القسم C

**Q6 — C-007 (`capitalTotal`):** هل `portfolioValue` المُمرَّر للصفحة محسوب بالـ DZD المحدَّث (سعر سوقي حالي × مخزون)، أم بقيمة دفترية (PAM × مخزون)؟ **يحتاج فحص في القسم E** ولكن سؤال مبدئي.

**Q7 — C-010 (مصاريف الأصول اليدوية):** عند تسجيل `expense` لأصل يدوي بدفع `cash`/`baridi`، هل **يجب** أن يُنشأ صف خزينة `Retrait` تلقائيًا؟ السلوك الحالي: لا.

**Q8 — C-013 (حذف عميل أصل يدوي):** هل هو متعمَّد ألا يدعم النظام "حذف بالتاريخ" كما في B-014، أم يجب إضافته؟

---

## ⏸️ نهاية القسم C

**القسم D (المستثمرون وتوزيع الأرباح) جاهز للبدء فور موافقتك.**

> **تذكير:** Q1 (manager fee on loss — السلوك أ/ب/ج) **مطلوب الإجابة عليه قبل القسم D** لأن التقييمات هناك تعتمد على نية المالك.

---

# 🟧 القسم D — المستثمرون وتوزيع الأرباح

> **🔑 قرار نهائي موثَّق لـ Q1 (manager fee on loss) — مُحدَّث 2026-05-08:**
>
> **"الجميع يتحمل الخسارة حسب نسب المشاركة، وليس المدير وحده."**
>
> عند خسارة `-1000 DZD` ونسبة مدير `20%`: المستثمرون يتحمّلون `-800` (حسب رؤوس أموالهم النسبية)، والمدير يتحمّل `-200` (حسب نسبته). **الخسارة موزَّعة بالتناسب على كل الأطراف**، مماثل تمامًا لتوزيع الأرباح. **D-007 صحيحة نهائيًا — لا تعديل مطلوب على المنطق.**

**الملفات المعنيّة:**
- [src/hooks/useInvestorEconomics.ts](src/hooks/useInvestorEconomics.ts) (282 سطر)
- [src/utils/money.ts](src/utils/money.ts) — `addM`, `subM`, `roundM`, `sumM`, `distributeProportionally`
- [src/utils/pamLedger.ts](src/utils/pamLedger.ts) — مصدر `derivedProfit` (انظر A-002)
- [scripts/investorEconomics.pamLedger.test.ts](scripts/investorEconomics.pamLedger.test.ts) — حالات حرجة

**الثوابت العامة في القسم D:**

| الثابت / السلوك | القيمة | الموقع |
|------------------|--------|---------|
| `availableProfit` warning threshold | `< -0.01` | [useInvestorEconomics.ts:243](src/hooks/useInvestorEconomics.ts#L243) |
| `withdrawalsExceedProfit` threshold | `> totalProfit + 0.01` | [useInvestorEconomics.ts:253](src/hooks/useInvestorEconomics.ts#L253) |
| `managerFeeRatio` clamping | `[0, 1]` | [useInvestorEconomics.ts:153](src/hooks/useInvestorEconomics.ts#L153) |

---

### 🆔 D-001 — بناء قاعدة المستثمر (`InvestorBase`)

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:81-122](src/hooks/useInvestorEconomics.ts#L81)
- **🏷️ التصنيف:** مستثمر / تجميع رأس المال
- **📐 الكود الفعلي:**
  ```typescript
  const movementTxs = myTxs.filter((tx) =>
    tx.type === 'deposit_capital'
    || tx.type === 'reinvest_profit'
    || tx.type === 'withdraw_capital'
  );
  const currentCapitalFromMovements = movementTxs.reduce((sum, tx) => {
    if (tx.type === 'withdraw_capital') return subM(sum, tx.amount);
    return addM(sum, tx.amount);
  }, 0);
  const withdrawnProfit = myTxs.filter((tx) => tx.type === 'withdraw_profit')
    .reduce((sum, tx) => addM(sum, tx.amount), 0);
  const reinvestedProfit = myTxs.filter((tx) => tx.type === 'reinvest_profit')
    .reduce((sum, tx) => addM(sum, tx.amount), 0);
  return {
    ...inv, entryTs: toMs(inv.entryDate), txs: myTxs,
    hasCapitalMovements: movementTxs.length > 0,
    capitalInvested: movementTxs.length > 0 ? currentCapitalFromMovements : inv.initialCapital,
    withdrawnProfit, reinvestedProfit,
  };
  ```
- **📝 الصيغة الرياضية:**
  $$\text{capitalInvested} = \begin{cases} \sum_{\text{tx} \in \text{movements}} \pm\text{tx.amount} & \text{إذا توجد حركات} \\ \text{inv.initialCapital} & \text{خلاف ذلك} \end{cases}$$
  حيث `movements ⊆ {deposit_capital, reinvest_profit, withdraw_capital}`، إشارة `withdraw_capital` سالبة.
- **🎯 الهدف:** اشتقاق رأس المال الحالي للمستثمر إما من حركات `investor_transactions` أو من حقل `inv.initialCapital` (للمستثمرين دون أي حركة).
- **✅ الحكم:** **صحيحة** — يستخدم `addM`/`subM` (محمي من float drift).
- **💡 الملاحظة:**
  - **`reinvest_profit` تُحسب كـ `+capital`**: ربح مُستثمر ⇒ يُضاف إلى رأس المال (سلوك صحيح).
  - **fallback إلى `initialCapital` فقط لمن لم يكن لديه أي حركة** (`hasCapitalMovements=false`). أي مستثمر يفتح حسابًا بحركة واحدة ينتقل تمامًا إلى نموذج الحركات (`initialCapital` يُهمل).
  - **`withdrawnProfit` و `reinvestedProfit` منفصلان** عن `capitalInvested` لاستخدامهما في `availableProfit` (D-013).

---

### 🆔 D-002 — `capitalAtTs` (رأس المال عند لحظة البيع)

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:124-142](src/hooks/useInvestorEconomics.ts#L124)
- **🏷️ التصنيف:** مستثمر / رأس مال تاريخي
- **📐 الكود الفعلي:**
  ```typescript
  function capitalAtTs(inv: InvestorBase, ts: number): number {
    const movementsUntilTs = inv.txs.filter((tx) =>
      toMs(tx.timestamp) <= ts
      && (tx.type === 'deposit_capital' || tx.type === 'reinvest_profit' || tx.type === 'withdraw_capital')
    );
    if (movementsUntilTs.length === 0) {
      return inv.hasCapitalMovements ? 0 : inv.initialCapital;
    }
    return movementsUntilTs.reduce((sum, tx) => {
      if (tx.type === 'withdraw_capital') return subM(sum, tx.amount);
      return addM(sum, tx.amount);
    }, 0);
  }
  ```
- **📝 الصيغة الرياضية:**
  $$\text{capitalAtTs}(t) = \sum_{\substack{\text{tx} \in \text{movements} \\ \text{tx.timestamp} \le t}} \pm\text{tx.amount}$$
  مع `0` لمن له حركات لكن لا واحدة منها قبل `t`، و `initialCapital` لمن ليس له حركات أصلًا.
- **🎯 الهدف:** **رأس المال المؤهل لحظة كل بيع تاريخي** — يضمن أن المستثمر لا يستفيد من أرباح قبل دخوله، ولا يُحرم من حصة من بيعات بعد دخوله بسبب سحب لاحق.
- **✅ الحكم:** **صحيحة** — معادلة محورية في عدالة التوزيع.
- **💡 الملاحظة:**
  - **منطق `hasCapitalMovements`:** لو كان للمستثمر حركة واحدة لكنها بعد `ts` → `movementsUntilTs.length === 0` → يُرجع `0` (وليس `initialCapital`)، فلا يأخذ حصة. **سلوك صحيح ودقيق**.
  - **الأداء:** هذه الدالة تُستدعى لكل (مستثمر × بيع) — تعقيد O(N×M). للأنظمة الكبيرة قد يحتاج caching، لكن لا يؤثر على الصحة.

---

### 🆔 D-003 — `chronologicalDerivedSells` (فرز البيعات للتوزيع)

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:144-148](src/hooks/useInvestorEconomics.ts#L144)
- **🏷️ التصنيف:** ربح / فلترة
- **📐 الكود الفعلي:**
  ```typescript
  function chronologicalDerivedSells(pamLedger: PamLedgerResult): PamLedgerSellProfitRow[] {
    return [...pamLedger.sellProfitRows]
      .filter((row) => Number.isFinite(Number(row.derivedProfit)) && Number(row.derivedProfit || 0) !== 0)
      .sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
  }
  ```
- **📝 المنطق:**
  - **استبعاد:** البيعات بـ `derivedProfit === 0` أو غير صالح.
  - **ترتيب:** زمنيًا تصاعديًا.
- **🎯 الهدف:** اقتصار التوزيع على البيعات ذات الأثر المالي.
- **✅ الحكم:** **صحيحة** ⚠️ مع ملاحظة دقيقة.
- **💡 الملاحظة الحرجة:**
  - **استبعاد `derivedProfit === 0`**: يبدو منطقيًا (لا ربح ⇒ لا توزيع)، لكن يستبعد أيضًا **البيعات ذات الربح الصفري الحقيقي** التي قد تحوي علامات تحذيرية (`oversell`, `uncosted`, `legacyFallback`). هذه البيعات لا تؤثر على `totalProfit` لكن **تُفقد تحذيراتها للمستثمرين** (لن تَمرّ عبر حلقة `for (const sellRow of ...)` في سطر 169-228 لإصدار تحذير `uncosted_quantity_sold`).
  - **يحتاج تأكيد المالك**: هل تريد إصدار تحذيرات `uncosted` حتى لو الربح صفر؟

---

### 🆔 D-004 — تطبيع `managerFeeRatio` (clamping)

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:152-153](src/hooks/useInvestorEconomics.ts#L152)
- **🏷️ التصنيف:** نسبة المدير / حماية
- **📐 الكود الفعلي:**
  ```typescript
  const feePercent = parseFloat(input.managerFeePercentage) || 0;
  const managerFeeRatio = Math.max(0, Math.min(1, feePercent / 100));
  ```
- **📝 الصيغة الرياضية:**
  $$\text{managerFeeRatio} = \max\big(0,\; \min(1,\; \text{feePercent}/100)\big)$$
- **🎯 الهدف:** ضمان أن النسبة بين 0% و 100% حتى لو أُدخلت قيمة سلبية أو > 100.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:** `parseFloat('abc') = NaN`، و `NaN || 0 = 0` ⇒ نسبة افتراضية صفر عند إدخال غير صحيح. آمن.

---

### 🆔 D-005 — تحديد المستثمرين المؤهلين لكل بيع

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:173-176](src/hooks/useInvestorEconomics.ts#L173)
- **🏷️ التصنيف:** أهلية / إنصاف
- **📐 الكود الفعلي:**
  ```typescript
  const eligible = investorsBase
    .filter((inv) => inv.entryTs <= sellTs)
    .map((inv) => ({ id: inv.id, cap: Math.max(0, capitalAtTs(inv, sellTs)) }))
    .filter((item) => item.cap > 0);
  ```
- **📝 المنطق المركّب:**
  1. `entryTs <= sellTs` — المستثمر دخل قبل البيع.
  2. `capitalAtTs > 0` — لديه رأس مال موجب لحظة البيع.
  3. `Math.max(0, ...)` — حماية من رأس مال سالب (لو سحب أكثر مما أودع).
- **🎯 الهدف:** ضمان أن **المستثمر لا يشارك في بيع قبل دخوله أو قبل إيداع رأس ماله** (نية صريحة في `CLAUDE_PROJECT_INTENT.md §9`).
- **✅ الحكم:** **صحيحة** ✓ — تنفيذ نموذجي.
- **💡 الملاحظة:**
  - **`entryTs <= sellTs` بـ `≤` صارمًا**: لو دخل المستثمر ودفع رأس ماله **بنفس** millisecond للبيع، يُعتبر مؤهلًا. عمليًا نادر لكن مهم.
  - **`Math.max(0, cap)`**: لو سحب أكثر مما أودع (`capitalAtTs < 0`) → يُحوَّل إلى 0 — **لا يأخذ حصة سالبة** (أي لا يتحمّل خسارة)، وهو سلوك دلاليًا صحيح.

---

### 🆔 D-006 — حالة `totalCapAtSell <= 0` → `unallocatedProfit`

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:178-182](src/hooks/useInvestorEconomics.ts#L178)
- **🏷️ التصنيف:** توزيع / حماية
- **📐 الكود الفعلي:**
  ```typescript
  const totalCapAtSell = eligible.reduce((sum, item) => sum + item.cap, 0);
  if (totalCapAtSell <= 0) {
    unallocatedProfit = addM(unallocatedProfit, derivedProfit);
    continue;
  }
  ```
- **📝 الصيغة:**
  $$\text{إذا } \sum_{\text{eligible}} \text{cap} \le 0 \;\Rightarrow\; \text{unallocatedProfit} \mathrel{+}= \text{derivedProfit}$$
- **🎯 الهدف:**
  1. حماية من القسمة على صفر في `distributeProportionally`.
  2. **لقطة محاسبية:** البيعات قبل وجود مستثمرين (مرحلة "صاحب الشركة فقط") تتجمّع في `unallocatedProfit`.
- **✅ الحكم:** **صحيحة** ⚠️ مع ملاحظة دلالية.
- **💡 الملاحظة الحرجة (تكرار للنقطة H4 من خطة التدقيق):**
  - **`unallocatedProfit` لا يُعاد توزيعه لاحقًا.** إذا ظهر مستثمر أول بعد بيعة ربحت 5000 DZD، تلك الـ 5000 تبقى "مُعلَّقة" بلا مالك في الحساب، ولا تظهر في `managerShare` ولا في حصة أي مستثمر.
  - رياضيًا: `derivedProfit_total = managerShare + investorShare + unallocatedProfit`، و `reconciliationDifference = derivedProfit - (managerShare + investorShare) - unallocatedProfit` (تقريبًا — انظر D-016).
  - **سؤال للمالك (Q9):** هل `unallocatedProfit` يُعتبر ملك المدير ضمنيًا، أم رأس مال شركة منفصل؟ إن كان للمدير، يجب إضافته إلى `managerShare` صراحةً.

---

### 🆔 D-007 — توزيع الربح: `investorPool` و `rowManagerShare` (المعادلة المركزية)

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:184-194](src/hooks/useInvestorEconomics.ts#L184)
- **🏷️ التصنيف:** توزيع / مركزي
- **📐 الكود الفعلي:**
  ```typescript
  const investorPool = roundM(derivedProfit * (1 - managerFeeRatio));
  const shares = distributeProportionally(
    investorPool,
    eligible.map((item) => item.cap),
  );
  const distributedToInvestors = sumM(shares);
  const rowManagerShare = subM(derivedProfit, distributedToInvestors);

  distributedDerivedProfit = addM(distributedDerivedProfit, derivedProfit);
  managerShare = addM(managerShare, rowManagerShare);
  investorShare = addM(investorShare, distributedToInvestors);
  ```
- **📝 الصيغة الرياضية:**
  $$\text{investorPool} = \text{round}_M\big(\text{derivedProfit} \times (1 - r)\big), \quad r = \text{managerFeeRatio}$$
  $$\text{shares}_i = \text{distributeProportionally}(\text{investorPool}, \{\text{cap}_j\})_i$$
  $$\text{distributedToInvestors} = \sum_i \text{shares}_i \quad (\equiv \text{investorPool} \text{ بفضل largest-remainder})$$
  $$\text{rowManagerShare} = \text{derivedProfit} - \text{distributedToInvestors}$$
- **🎯 الهدف:** خصم نسبة المدير **قبل** التوزيع التناسبي للمستثمرين.
- **✅ الحكم:** **صحيحة** — مع تطبيق السلوك (أ) لـ Q1.
- **💡 الملاحظة الحرجة (السلوك على الخسارة — H3):**
  - **مثال (-1000 DZD، نسبة 20%):**
    - `investorPool = -1000 × 0.8 = -800`
    - `distributedToInvestors = -800` (يُوزَّع على cap-weighted)
    - `rowManagerShare = -1000 - (-800) = -200`
    - **النتيجة:** المستثمرون يتحمّلون 800 من الخسارة، المدير يتحمّل 200 — السلوك (أ).
  - **رياضياً سليم** لمن يقبل أن المدير يتشارك المخاطر بنفس النسبة. **بديل (ب)** يتطلب: `if (derivedProfit < 0) investorPool = derivedProfit` (المستثمرون يتحمّلون كل الخسارة). **بديل (ج)** يتطلب: `effectiveRatio = derivedProfit < 0 ? 0 : managerFeeRatio`.
  - **متى يكون `largest-remainder` دقيقًا للأرقام السالبة؟** الدالة `distributeProportionally` تستخدم `Math.floor` على `raw`، والـ `raw` هنا سالب، فـ `Math.floor(-2.7) = -3` (وليس -2). هذا يعني التوزيع السالب يميل **بعيدًا عن الصفر** قبل توزيع البقية. النتيجة لا تزال صحيحة (sum = total) لكن السلوك يستحق اختبارًا (T-D-005).

---

### 🆔 D-008 — تحذير `negative_derived_profit` (خسارة مُوزَّعة)

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:196-207](src/hooks/useInvestorEconomics.ts#L196)
- **🏷️ التصنيف:** تحذير / خسارة
- **📐 الكود الفعلي:**
  ```typescript
  if (derivedProfit < 0) {
    for (const item of eligible) {
      addWarning(warnings, warningsByInvestor, {
        code: 'negative_derived_profit',
        severity: 'warning',
        investorId: item.id,
        txId: sellRow.txId,
        amount: derivedProfit,
        message: 'Derived PAM profit is negative; current behavior distributes the loss proportionally.',
      });
    }
  }
  ```
- **🎯 الهدف:** إعلام كل مستثمر مؤهل بصراحة أن خسارة وُزِّعت على رأس ماله.
- **✅ الحكم:** **صحيحة** — رسالة واضحة + شدّة `warning`.
- **💡 الملاحظة:** التحذير ينطبق **بغض النظر** عن الخيار (أ/ب/ج) لـ Q1 — مفيد دائمًا.

---

### 🆔 D-009 — تحذير `uncosted_quantity_sold` للمستثمر

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:209-220](src/hooks/useInvestorEconomics.ts#L209)
- **🏷️ التصنيف:** تحذير / كمية بلا تكلفة
- **📐 الكود الفعلي:**
  ```typescript
  if (sellRow.flags.uncostedQuantitySold) {
    for (const item of eligible) {
      addWarning(warnings, warningsByInvestor, {
        code: 'uncosted_quantity_sold',
        severity: sellRow.flags.oversell ? 'high' : 'warning',
        investorId: item.id,
        txId: sellRow.txId,
        amount: sellRow.quantityWithoutCostBasis,
        message: 'Investor profit includes a sell row with uncostedQuantitySold.',
      });
    }
  }
  ```
- **🎯 الهدف:** نقل تحذير PAM (A-005) من مستوى الخزانة إلى مستوى المستثمر.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:** الشدّة `high` عند اقتران `oversell` مطابق لقاعدة A-005.

---

### 🆔 D-010 — تجميع حصص المستثمرين

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:222-227](src/hooks/useInvestorEconomics.ts#L222)
- **🏷️ التصنيف:** توزيع / تراكم
- **📐 الكود الفعلي:**
  ```typescript
  eligible.forEach((item, index) => {
    distributedProfitByInvestor.set(
      item.id,
      addM(distributedProfitByInvestor.get(item.id) || 0, shares[index]),
    );
  });
  ```
- **📝 الصيغة:** $\text{totalProfit}_{\text{inv}} = \sum_{\text{sells}} \text{share}_{\text{inv, sell}}$.
- **🎯 الهدف:** تراكم حصص المستثمر عبر كل البيعات.
- **✅ الحكم:** **صحيحة** — يستخدم `addM` (محمي).

---

### 🆔 D-011 — `totalCurrentCapital` لحساب `sharePercentage` العرضي

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:230-238](src/hooks/useInvestorEconomics.ts#L230)
- **🏷️ التصنيف:** عرض / نسبة
- **📐 الكود الفعلي:**
  ```typescript
  const totalCurrentCapital = investorsBase.reduce((sum, inv) => {
    if (!inv.isActive || inv.capitalInvested <= 0) return sum;
    return sum + inv.capitalInvested;
  }, 0);

  const currentShare = inv.isActive && totalCurrentCapital > 0
    ? Math.max(0, inv.capitalInvested) / totalCurrentCapital
    : 0;
  ```
- **📝 الصيغة:**
  $$\text{sharePercentage}_{\text{inv}} = \begin{cases} \dfrac{\max(0, \text{capitalInvested})}{\sum_{\text{active, cap>0}} \text{capitalInvested}} & \text{إذا inv نشط ومجموع} > 0 \\ 0 & \text{خلاف ذلك} \end{cases}$$
- **🎯 الهدف:** نسبة عرض المستثمر من إجمالي رأس المال **الحالي** فقط (لاستخدام UI).
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة:**
  - **استخدام `+` المباشر** بدل `addM` (مماثل لـ B-001، C-005).
  - **لا تُستخدم في حسابات التوزيع** — فقط للعرض. الحسابات الفعلية تستخدم `capitalAtTs` (D-002).
  - **`!inv.isActive`** يُستثنى — مفيد لإخفاء المستثمرين السابقين.

---

### 🆔 D-012 — `availableProfit` (الربح المتاح للسحب)

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:239-241](src/hooks/useInvestorEconomics.ts#L239)
- **🏷️ التصنيف:** سحب / ربح متاح
- **📐 الكود الفعلي:**
  ```typescript
  const totalProfit = distributedProfitByInvestor.get(inv.id) || 0;
  const withdrawnAndReinvested = addM(inv.withdrawnProfit, inv.reinvestedProfit);
  const availableProfit = subM(totalProfit, withdrawnAndReinvested);
  ```
- **📝 الصيغة الرياضية:**
  $$\text{availableProfit} = \text{totalProfit} - (\text{withdrawnProfit} + \text{reinvestedProfit})$$
- **🎯 الهدف:** الربح القابل للسحب (`withdraw_profit`) أو إعادة الاستثمار (`reinvest_profit`).
- **✅ الحكم:** **صحيحة** — يستخدم `addM`/`subM`.
- **💡 الملاحظة الحرجة:**
  - **`reinvest_profit` يُخصم من `availableProfit`** (لأن قيمته انتقلت إلى رأس المال). **سلوك صحيح**: لا يستطيع المستثمر سحب نفس المبلغ مرتين.
  - **`reinvest_profit` يُضاف إلى `capitalInvested`** (D-001) — يُحدِث رأس المال ويُحدِث `availableProfit` معًا. متّسق.

---

### 🆔 D-013 — تحذير `available_profit_negative`

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:243-251](src/hooks/useInvestorEconomics.ts#L243)
- **🏷️ التصنيف:** تحذير / تنبيه عالي
- **📐 الكود الفعلي:**
  ```typescript
  if (availableProfit < -0.01) {
    addWarning(warnings, warningsByInvestor, {
      code: 'available_profit_negative',
      severity: 'high',
      investorId: inv.id,
      amount: availableProfit,
      message: 'Investor availableProfit is negative after derived PAM profit recalculation.',
    });
  }
  ```
- **📝 الصيغة:** $\text{availableProfit} < -0.01 \;\Rightarrow\; \text{تحذير high}$.
- **🎯 الهدف:** كشف الحالات التي يكون فيها المستثمر سحب/أعاد استثمار **أكثر** من ربحه المشتق الفعلي (يحدث عند إعادة حساب PAM بعد تعديل تاريخي).
- **✅ الحكم:** **صحيحة** — تحذير حرج موثَّق في `CLAUDE_PROJECT_INTENT.md §9`.
- **💡 الملاحظة:** عتبة `-0.01` تستوعب float drift صغير.

---

### 🆔 D-014 — تحذير `withdrawals_exceed_derived_profit`

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:253-261](src/hooks/useInvestorEconomics.ts#L253)
- **🏷️ التصنيف:** تحذير / تنبيه عالي
- **📐 الكود الفعلي:**
  ```typescript
  if (withdrawnAndReinvested > 0 && withdrawnAndReinvested > totalProfit + 0.01) {
    addWarning(warnings, warningsByInvestor, {
      code: 'withdrawals_exceed_derived_profit',
      severity: 'high',
      investorId: inv.id,
      amount: subM(withdrawnAndReinvested, totalProfit),
      message: 'Investor withdrawals plus reinvested profit exceed derived totalProfit.',
    });
  }
  ```
- **📝 الصيغة:** $(\text{withdrawnAndReinvested} > 0) \wedge (\text{withdrawnAndReinvested} > \text{totalProfit} + 0.01) \;\Rightarrow\; \text{تحذير}$.
- **🎯 الهدف:** كشف صريح لحالة سحب أكثر من الربح الفعلي.
- **✅ الحكم:** **صحيحة** — مكمّلة لـ D-013.
- **💡 الملاحظة:** هذا التحذير و D-013 قد يطلَقان معًا في نفس الحالة (تكرار مفيد للوضوح).

---

### 🆔 D-015 — `reconciliationDifference` (التسوية الكلية)

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:272-281](src/hooks/useInvestorEconomics.ts#L272)
- **🏷️ التصنيف:** تسوية / تحقق
- **📐 الكود الفعلي:**
  ```typescript
  return {
    derivedInvestors,
    warnings,
    totals: {
      derivedProfit: distributedDerivedProfit,
      managerShare,
      investorShare,
      unallocatedProfit,
      reconciliationDifference: subM(distributedDerivedProfit, addM(managerShare, investorShare)),
    },
  };
  ```
- **📝 الصيغة:**
  $$\text{reconciliationDifference} = \text{distributedDerivedProfit} - (\text{managerShare} + \text{investorShare})$$
- **🎯 الهدف:** التحقق الذاتي من تسوية التوزيع — يجب أن يساوي صفرًا في الحالات الصحيحة.
- **✅ الحكم:** **صحيحة** — مع ملاحظة دقّة.
- **💡 الملاحظة:**
  - **`distributedDerivedProfit` لا تتضمّن `unallocatedProfit`** (سطر 192 يُضاف فقط داخل حلقة eligible، أي بعد تخطي البيعات بـ `totalCapAtSell <= 0`). فعلًا، الـ `reconciliationDifference` يُحسب على البيعات الموزَّعة فقط، لذا = 0 رياضيًا (`derivedProfit = investorPool + (derivedProfit - investorPool) = investorShare + managerShare`).
  - الاختبار في `investorEconomics.pamLedger.test.ts:101` يتحقق `reconciliationDifference === 0` ⇒ موثَّق.

---

### 🆔 D-016 — حماية `investor.entryDate` غير الصالحة

- **📁 الملف:السطر:** [src/hooks/useInvestorEconomics.ts:60-67](src/hooks/useInvestorEconomics.ts#L60)
- **🏷️ التصنيف:** حماية / تطبيع
- **📐 الكود الفعلي:**
  ```typescript
  function toMs(value: unknown): number {
    if (typeof value === 'number') return value;
    if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
      return (value as { toMillis: () => number }).toMillis();
    }
    const parsed = new Date(value as string).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  ```
- **🎯 الهدف:** قبول `number`, Firestore `Timestamp` (مع `toMillis`)، أو `Date`/`string`.
- **✅ الحكم:** **صحيحة**.
- **💡 الملاحظة الحرجة:**
  - **fallback إلى `0`**: لو فشل التحليل، `entryTs = 0` ⇒ المستثمر **يُعتبر مؤهلًا لكل البيعات في التاريخ** (لأن `0 <= sellTs` دائمًا). هذا قد يربك التوزيع لو كان التاريخ تالفًا في Firestore.
  - **توصية للنقاش (لا يُنفّذ بدون موافقة):** fallback إلى `Number.MAX_SAFE_INTEGER` بدل `0` ⇒ مستثمر بتاريخ غير صالح لا يأخذ حصة أبدًا حتى يُصلَّح.

---

## 📊 إحصائيات أولية للقسم D

| البند | العدد |
|------|------|
| إجمالي المعادلات الموثّقة في القسم D | **16** |
| ✅ صحيحة | **12** |
| ⚠️ مشبوهة (تستحق توضيحًا أو فحصًا) | **4** (D-003, D-006, D-007, D-016) |
| ❌ خاطئة | **0** |
| 🤔 تحتاج توضيحًا | **0** |

### ⚠️ نقاط مشبوهة في القسم D — للنقاش مع المالك

1. **D-007 (السلوك على الخسارة):** افتُرض السلوك (أ) — **يحتاج تأكيد Q1 من المالك**.
2. **D-006 (`unallocatedProfit`):** بيعات قبل وجود مستثمرين تتراكم بلا توزيع لاحق — Q9 جديد.
3. **D-003 (استبعاد `derivedProfit === 0`):** يُفقد تحذيرات `uncosted` على البيعات الصفرية.
4. **D-016 (fallback `entryTs = 0`):** تاريخ تالف ⇒ مستثمر مؤهل لكل البيعات. مخاطرة عند هجرة بيانات.

### ✅ نقاط متينة في القسم D

- **D-002 (`capitalAtTs`) و D-005 (eligibility):** تنفيذ نموذجي للعدالة الزمنية — المستثمر لا يأخذ من بيعات قبل دخوله، لا من سحوبات بعد دخوله.
- **D-007 (`distributeProportionally` + largest remainder):** ضمان أن `sum(shares) = investorPool` بالضبط (لا فقدان قرش).
- **D-013 و D-014 (تحذيرات السحب):** تنبيهات شديدة موثّقة في `CLAUDE_PROJECT_INTENT.md §9`.
- **D-015 (`reconciliationDifference`):** فحص ذاتي مدمج في كل استدعاء — مغطّى باختبار.

### ❓ أسئلة جديدة مفتوحة للمالك بناء على القسم D

**Q9 — D-006 (`unallocatedProfit`):** هل تريد:
- **(أ)** تركه كما هو (يبقى مُعلَّقًا في مجموع منفصل)؟ ← السلوك الحالي.
- **(ب)** إضافته إلى `managerShare` تلقائيًا (المدير يأخذ كل ربح قبل دخول المستثمرين)؟
- **(ج)** توزيعه على أول بيعة فيها مستثمرون مؤهلون؟

**Q10 — D-003 (استبعاد البيعات بـ `derivedProfit === 0`):** هل يجب إصدار تحذيرات `uncosted_quantity_sold` للمستثمرين حتى لو كان الربح الصافي صفرًا؟

---

## ⏸️ نهاية القسم D

**القسم E (التقارير والتحليلات) — الأخير قبل F و G — جاهز للبدء فور موافقتك.**

> **تذكير:** القسم E سيتضمّن **E-X** (فحص `useReportExports.ts` لتمرير `profitByTxId`) كما تم تثبيته في الهيكل.

---

# 🟪 القسم E — التقارير والتحليلات

**الملفات المعنيّة:**
- [src/components/analytics/useAnalyticsViewModel.ts](src/components/analytics/useAnalyticsViewModel.ts) (209 سطر)
- [src/hooks/useReportExports.ts](src/hooks/useReportExports.ts) (160 سطر) — **يتضمّن E-X الإلزامي**
- [src/utils/pdfReports.ts](src/utils/pdfReports.ts) (1067 سطر)

**القسم الفرعي E-X** (تنفيذ التعديل #2 الإلزامي): فحص ما إذا كان `useReportExports.ts` يمرّر `profitByTxId` إلى `pdfReports.ts` — **النتيجة حاسمة في حسم نقطة الخطر #1**.

---

## 🚨 E-X — فحص `useReportExports.ts` و تمرير `profitByTxId` (تعديل إلزامي #2)

- **📁 الملف:السطر:** [src/hooks/useReportExports.ts:90-115](src/hooks/useReportExports.ts#L90), [src/hooks/useReportExports.ts:52-88](src/hooks/useReportExports.ts#L52)
- **🏷️ التصنيف:** ربط / تكامل قاعدة ذهبية
- **📐 الكود الفعلي (handleExportUsdtReport — التقرير الشهري):**
  ```typescript
  const handleExportUsdtReport = async () => {
    const { buildMonthlyPdfReport, openPdfPrintWindow } = await loadPdfReports();
    const report = buildMonthlyPdfReport({
      month: usdtReportMonth,
      year: usdtReportYear,
      monthLabel: monthLabels[usdtReportMonth] || `${usdtReportMonth + 1}`,
      transactions,
      clientTransactions: clientTransactionsDzd,
      clients: clientsDzd,
      getClientName: getClientFullName,
      portfolioStats
      // ❌ NO `profitByTxId` PASSED
      // ❌ NO `pamLedger` PASSED
    });
    ...
  };
  ```
- **📐 الكود الفعلي (handleExportClientReport):**
  ```typescript
  const report = buildClientPdfReport({
    clientId, month, year, monthLabel, clients, clientTransactions, transactions,
    clientBalance, getClientName,
    // ❌ NO `profitByTxId` PASSED
  });
  ```
- **🎯 الهدف الموثَّق:** كان يجب تمرير `profitByTxId` (أو `pamLedger`) إلى `pdfReports` ليستخدمه `getRealizedProfit` بدلاً من السقوط على `tx.profit`.
- **❌ الحكم: خاطئة — انتهاك واضح للقاعدة الذهبية.**
- **💡 الأثر الفعلي:**
  - في [pdfReports.ts:419-421](src/utils/pdfReports.ts#L419):
    ```typescript
    function getMonthlyProfitByTxId(input: MonthlyReportInput): PamLedgerResult['profitByTxId'] | undefined {
      return input.profitByTxId || input.pamLedger?.profitByTxId;
      // ⚠️ ANY/الاثنان غير ممرَّر ⇒ undefined
    }
    ```
  - في [pdfReports.ts:423-427](src/utils/pdfReports.ts#L423):
    ```typescript
    function getRealizedProfit(tx: Tx, profitByTxId?: PamLedgerResult['profitByTxId']): number {
      if (tx.type !== 'sell') return 0;
      const derivedProfit = tx.id ? profitByTxId?.[tx.id]?.derivedProfit : undefined;
      return Number(derivedProfit ?? tx.profit ?? 0);  // ⚠️ يسقط على tx.profit
    }
  ```
  - **النتيجة العملية:** **كل تقرير PDF شهري + كل تقرير عميل يستخدم `tx.profit` المخزَّن** (وليس `derivedProfit` الحقيقي). هذا يتعارض مع:
    - `CLAUDE_PROJECT_INTENT.md §8` (القاعدة الذهبية).
    - `CLAUDE_PROJECT_INTENT.md §13` ("التقارير الشهرية والأرباح يجب أن تعتمد على `computePamLedger`").
    - مع توزيع المستثمرين (الذي يستخدم `derivedProfit`).
  - **مثال موثَّق:** تقرير شهري يحوي بيع `jGd0Hug9GvHZ3pxrSrDR`:
    - PDF يعرض: **+2944.06 DZD** ✗ (من `tx.profit`)
    - الواقع (PAM): **+849 DZD** ✓
    - فرق: **2095.06 DZD** يظهر للمستخدم كأنه ربح حقيقي.

> **🔴 هذه أخطر مشكلة في كل التدقيق.** سيُذكر مرة أخرى في القسم F (نقاط الخطر) و في الملخّص التنفيذي G.

---

## القسم E الفرعي 1 — `useAnalyticsViewModel.ts` (طبقة التحليلات)

### 🆔 E-001 — تذكير `pamLedger` لإعادة الحساب

- **📁 الملف:السطر:** [src/components/analytics/useAnalyticsViewModel.ts:41](src/components/analytics/useAnalyticsViewModel.ts#L41)
- **🏷️ التصنيف:** أداء / تذكير
- **📐 الكود الفعلي:**
  ```typescript
  const pamLedger = useMemo(() => computePamLedger(transactions), [transactions]);
  ```
- **🎯 الهدف:** إعادة حساب `pamLedger` كاملًا عند أي تغيير في `transactions`.
- **✅ الحكم:** **صحيحة** ⚠️ مع ملاحظة أداء.
- **💡 الملاحظة:** إعادة حساب كاملة عند أي تعديل قد تكون مكلفة لمستخدمين بآلاف العمليات (O(N) لكل دفعة + sort + 2 passes). لا يستحق إصلاحًا الآن.

---

### 🆔 E-002 — `realizedProfit` الشهري (يستخدم `derivedProfit`) ✅

- **📁 الملف:السطر:** [src/components/analytics/useAnalyticsViewModel.ts:68-70](src/components/analytics/useAnalyticsViewModel.ts#L68)
- **🏷️ التصنيف:** ربح / تقرير
- **📐 الكود الفعلي:**
  ```typescript
  if (tx.type === 'sell') {
    realizedProfit += pamLedger.profitByTxId[tx.id]?.derivedProfit || 0;
  }
  ```
- **📝 الصيغة:** $\text{realizedProfit}_{\text{شهر}} = \sum_{\text{sell} \in \text{period}} \text{derivedProfit}_{\text{tx}}$ (مع 0 إذا غير موجود — لا fallback لـ `tx.profit`).
- **🎯 الهدف:** ربح شهر التحليلات بدقّة PAM.
- **✅ الحكم:** **صحيحة** ✓ — متطابقة تمامًا مع القاعدة الذهبية. **النموذج المرجعي.**
- **💡 الملاحظة:** لا fallback لـ `tx.profit` ⇒ `useAnalyticsViewModel` و `pdfReports` **يعرضان أرقامًا مختلفة لنفس الشهر**. مستخدم يقارن بين شاشة Analytics وملف PDF يرى تفاوتًا.

---

### 🆔 E-003 — `heatmapData` (الأرباح اليومية) ✅

- **📁 الملف:السطر:** [src/components/analytics/useAnalyticsViewModel.ts:77-99](src/components/analytics/useAnalyticsViewModel.ts#L77)
- **🏷️ التصنيف:** ربح / يومي
- **📐 الكود الفعلي:**
  ```typescript
  if (tx.type === 'sell' && tx.timestamp >= startTimestamp && tx.timestamp <= endTimestamp) {
    const txDate = new Date(tx.timestamp);
    const day = txDate.getDate();
    const profit = pamLedger.profitByTxId[tx.id]?.derivedProfit || 0;
    salesByDay.set(day, currentProfit + profit);
  }
  ```
- **📝 الصيغة:** $\text{profit}_{\text{day d}} = \sum_{\substack{\text{sell} \in \text{day d}}} \text{derivedProfit}$.
- **✅ الحكم:** **صحيحة** ✓ — يستخدم `derivedProfit` بشكل صريح.
- **💡 الملاحظة:** `currentProfit + profit` بدل `addM` — مخاطرة float drift نظرية (مماثلة لـ B-001).

---

### 🆔 E-004 — `simSellResult` (محاكاة بيع)

- **📁 الملف:السطر:** [src/components/analytics/useAnalyticsViewModel.ts:101-109](src/components/analytics/useAnalyticsViewModel.ts#L101)
- **🏷️ التصنيف:** محاكاة / تقدير
- **📐 الكود الفعلي:**
  ```typescript
  const profit = (price - portfolioUsdtAvgBuy) * qty;
  return { profit, isProfitable: profit >= 0 };
  ```
- **📝 الصيغة:** $\text{profitSim} = (\text{price} - \text{PAM}_{\text{حالي}}) \times \text{qty}$.
- **🎯 الهدف:** محاكاة بيع افتراضي بناء على PAM الحالي للمحفظة.
- **✅ الحكم:** **صحيحة** — محاكاة "ماذا لو" مشروعة.
- **💡 الملاحظة:**
  - يستخدم `portfolioUsdtAvgBuy` (PAM الحالي بعد كل العمليات) — **ليس `historicalAvgBuy`** لأن المحاكاة افتراضية للحظة "الآن".
  - مماثل دلاليًا لـ A-014 (`tx.profit` يخزَّن باستخدام نفس PAM)، لكن **هنا الاستخدام المحاكاتي مشروع** (نريد تقدير الربح المتوقع لو بِعنا الآن).
  - **استثناء صحي:** هذه المعادلة لا تحتاج `derivedProfit` لأن العملية لم تحدث.

---

### 🆔 E-005 — `monthlyClientRanking` ✅

- **📁 الملف:السطر:** [src/components/analytics/useAnalyticsViewModel.ts:111-199](src/components/analytics/useAnalyticsViewModel.ts#L111)
- **🏷️ التصنيف:** تقرير / ترتيب
- **📐 الكود الفعلي (الجزء المركزي):**
  ```typescript
  if (tx.type === 'sell') {
    if (tx.currency === 'USDT') row.sellVolumeUsdt += qty;
    row.realizedProfit += pamLedger.profitByTxId[tx.id]?.derivedProfit || 0;
    row.sellCount += 1;
  }
  ...
  // sorting
  .sort((a, b) => {
    if (b.totalVolumeUsdt !== a.totalVolumeUsdt) return b.totalVolumeUsdt - a.totalVolumeUsdt;
    if (b.realizedProfit !== a.realizedProfit) return b.realizedProfit - a.realizedProfit;
    return a.clientName.localeCompare(b.clientName, 'fr');
  });
  ```
- **📝 الصيغة (لكل عميل):**
  - $\text{totalVolumeUsdt} = \text{buyVolumeUsdt} + \text{sellVolumeUsdt}$.
  - $\text{realizedProfit}_{\text{client}} = \sum_{\substack{\text{sell linked to client}}} \text{derivedProfit}$.
- **🎯 الهدف:** ترتيب العملاء شهريًا حسب الحجم ثم الربح ثم الاسم.
- **✅ الحكم:** **صحيحة** ✓.
- **💡 الملاحظة:** نفس منطق `pdfReports.ts:541-556` لكن **مع الفرق الحاسم: هذا يستخدم `derivedProfit`**، أما `pdfReports` يستخدم `getRealizedProfit` الذي يسقط إلى `tx.profit`.

---

### 🆔 E-006 — منطق إزالة التكرار في `txClientMap` (linked client resolution)

- **📁 الملف:السطر:** [src/components/analytics/useAnalyticsViewModel.ts:120-136](src/components/analytics/useAnalyticsViewModel.ts#L120)
- **🏷️ التصنيف:** ربط / حسم
- **📐 الكود الفعلي:**
  ```typescript
  clientTransactionsDzd.forEach((clientTx) => {
    if (!clientTx.linkedTxId || !clientTx.clientId) return;
    const isSecondary = clientTx.linkRole === 'dzd_receiver';
    const existing = txClientMap.get(clientTx.linkedTxId);
    if (!existing) {
      txClientMap.set(clientTx.linkedTxId, { clientId: clientTx.clientId, timestamp: clientTx.timestamp, isSecondary });
      return;
    }
    if (existing.isSecondary && !isSecondary) {
      // primary يحلّ محلّ secondary
      txClientMap.set(clientTx.linkedTxId, { ... });
      return;
    }
    if (existing.isSecondary === isSecondary && clientTx.timestamp > existing.timestamp) {
      // الأحدث يبقى عند نفس الـ role
      txClientMap.set(clientTx.linkedTxId, { ... });
    }
  });
  ```
- **🎯 الهدف:** عند ارتباط عملية USDT بأكثر من صف عميل (primary + secondary)، اختيار primary المناسب لتقرير الترتيب.
- **✅ الحكم:** **صحيحة** ⚠️ مع ملاحظة معقّدة.
- **💡 الملاحظة:**
  - **منطق ثلاثي الأولوية:** primary > secondary > الأحدث عند التساوي.
  - **`linkRole` يجب أن يكون `'dzd_receiver'` للسانوي** — لو خُزّن بقيمة أخرى نتيجة هجرة، الفرز سيُربك.
  - يستحق اختبار T-E-* لتغطية كل الحالات.

---

## القسم E الفرعي 2 — `pdfReports.ts` (طبقة التقارير PDF)

### 🆔 E-007 — `getRealizedProfit` (جذر الانتهاك) ❌

- **📁 الملف:السطر:** [src/utils/pdfReports.ts:419-427](src/utils/pdfReports.ts#L419)
- **🏷️ التصنيف:** ربح / انتهاك القاعدة الذهبية
- **📐 الكود الفعلي:**
  ```typescript
  function getMonthlyProfitByTxId(input: MonthlyReportInput): PamLedgerResult['profitByTxId'] | undefined {
    return input.profitByTxId || input.pamLedger?.profitByTxId;
  }

  function getRealizedProfit(tx: Tx, profitByTxId?: PamLedgerResult['profitByTxId']): number {
    if (tx.type !== 'sell') return 0;
    const derivedProfit = tx.id ? profitByTxId?.[tx.id]?.derivedProfit : undefined;
    return Number(derivedProfit ?? tx.profit ?? 0);  // ❌ خط 426
  }
  ```
- **📝 المنطق:**
  - تسلسل احتياطي: `derivedProfit ?? tx.profit ?? 0`.
  - حالة 1: `derivedProfit` موجود ⇒ يُستخدم ✓.
  - **حالة 2: `derivedProfit` مفقود (عند `profitByTxId === undefined` كما في E-X) ⇒ يسقط على `tx.profit` ❌**.
  - حالة 3: كلاهما مفقود ⇒ 0.
- **❌ الحكم: خاطئة — انتهاك صريح للقاعدة الذهبية.**
- **💡 الإصلاح المقترح (لا يُنفّذ بدون موافقة):**
  ```typescript
  return Number(derivedProfit ?? 0);  // إزالة fallback لـ tx.profit
  ```
  بشرط أن يضمن E-X تمرير `profitByTxId` (وإلا يصبح كل الأرباح 0).

---

### 🆔 E-008 — `globalNetProfit` (مجموع أرباح المحفظة)

- **📁 الملف:السطر:** [src/utils/pdfReports.ts:487](src/utils/pdfReports.ts#L487)
- **🏷️ التصنيف:** ربح / تجميع كلي
- **📐 الكود الفعلي:**
  ```typescript
  const globalNetProfit = Number(input.portfolioStats.usdt.totalProfit || 0)
    + Number(input.portfolioStats.eur.totalProfit || 0);
  ```
- **📝 الصيغة:** $\text{globalNetProfit} = \text{usdt.totalProfit} + \text{eur.totalProfit}$.
- **🎯 الهدف:** عرض الربح الكلي للمحفظة (تراكمي طوال التاريخ).
- **✅ الحكم:** **صحيحة** ✓ — وفق التحليل في A-019.
- **💡 الملاحظة (تأكيد على نقطة الخطر #5):**
  - **كلا `totalProfit` بالـ DZD** (لأن الربح = (سعر - PAM) × كمية، والسعر بالـ DZD/وحدة → الناتج بالـ DZD).
  - الجمع `USDT.totalProfit + EUR.totalProfit` لا يخلط عملات. ✓
  - **تأكيد ضمني فقط** — لا توجد توكيدات صريحة في الكود (مثل assertion على وحدة `totalProfit`). يستحق اختبارًا.

---

### 🆔 E-009 — حسابات التقرير الشهري (`buildMonthlyPdfReport` summary cards)

- **📁 الملف:السطر:** [src/utils/pdfReports.ts:480-515](src/utils/pdfReports.ts#L480)
- **🏷️ التصنيف:** تقرير / تجميع شهري
- **📐 الكود الفعلي:**
  ```typescript
  const startTs = new Date(input.year, input.month, 1).getTime();
  const endTs = new Date(input.year, input.month + 1, 0, 23, 59, 59, 999).getTime();
  const periodTxs = input.transactions.filter((tx) => tx.timestamp >= startTs && tx.timestamp <= endTs);
  const profitByTxId = getMonthlyProfitByTxId(input);  // ⚠️ undefined حاليًا (E-X)
  ...
  for (const tx of periodTxs) {
    if (tx.currency === 'USDT' && tx.type === 'buy') { volUsdtBought += tx.quantity; buyCount += 1; }
    if (tx.currency === 'USDT' && tx.type === 'sell') { volUsdtSold += tx.quantity; }
    ...
    if (tx.type === 'sell') {
      realizedProfit += getRealizedProfit(tx, profitByTxId);  // ⚠️ ينتهك القاعدة
      sellCount += 1;
    }
  }
  ```
- **📝 الصيغ:**
  - $\text{volUsdtBought}_{\text{شهر}} = \sum_{\text{buy USDT}} \text{quantity}$.
  - $\text{realizedProfit}_{\text{شهر}} = \sum_{\text{sell}} \text{getRealizedProfit}(...)$ — **معطوبة بسبب E-X**.
- **❌ الحكم: حسابات الأحجام صحيحة، لكن `realizedProfit` معطوب بسبب E-X و E-007.**
- **💡 الملاحظة:**
  - `endTs` يستخدم `new Date(year, month+1, 0, ...)` — تقنية ذكية لاحتساب آخر يوم في الشهر السابق (= آخر يوم في `month`). صحيح.
  - الـ filter يستخدم `>=` و `<=` بشكل شامل.

---

### 🆔 E-010 — ترتيب العملاء في التقرير الشهري (`pdfReports`)

- **📁 الملف:السطر:** [src/utils/pdfReports.ts:520-556](src/utils/pdfReports.ts#L520)
- **🏷️ التصنيف:** تقرير / ترتيب
- **📐 الكود الفعلي:**
  ```typescript
  if (tx.type === 'sell') {
    if (tx.currency === 'USDT') row.sellVolumeUsdt += tx.quantity;
    row.realizedProfit += getRealizedProfit(tx, profitByTxId);  // ⚠️ معطوبة
  }
  ...
  .sort((a, b) => {
    if (b.totalVolumeUsdt !== a.totalVolumeUsdt) return b.totalVolumeUsdt - a.totalVolumeUsdt;
    if (b.realizedProfit !== a.realizedProfit) return b.realizedProfit - a.realizedProfit;
    return a.clientName.localeCompare(b.clientName, 'fr');
  });
  ```
- **❌ الحكم: ترتيب الأحجام صحيح، لكن ترتيب الربح معطوب.**
- **💡 الملاحظة:** هذه نسخة موازية لـ E-005 (`useAnalyticsViewModel.monthlyClientRanking`) لكن باستخدام `getRealizedProfit` بدل `derivedProfit` المباشر. **تفاوت في النتائج بين شاشة Analytics وملف PDF**.

---

### 🆔 E-011 — صف الربح في جدول العمليات الشهري

- **📁 الملف:السطر:** [src/utils/pdfReports.ts:624-635](src/utils/pdfReports.ts#L624)
- **🏷️ التصنيف:** عرض / ربح لكل عملية
- **📐 الكود الفعلي:**
  ```typescript
  const profit = getRealizedProfit(row, profitByTxId);  // ⚠️ معطوبة
  ...
  <td class="num ${row.type === 'sell' ? (profit >= 0 ? 'good' : 'bad') : ''}">
    ${row.type === 'sell' ? `${profit >= 0 ? '+' : ''}${formatNumber(profit)}` : '-'}
  </td>
  ```
- **❌ الحكم: معطوبة — تعرض `tx.profit` المخزَّن.**
- **💡 الملاحظة:** هذا الجدول هو الذي يعرض رقم 2944.06 لـ `jGd0Hug9GvHZ3pxrSrDR` بدل 849.

---

### 🆔 E-012 — `buildUncostedQuantityWarningsHtml` (تحذيرات PAM في PDF) ✅

- **📁 الملف:السطر:** [src/utils/pdfReports.ts:429-478](src/utils/pdfReports.ts#L429)
- **🏷️ التصنيف:** تحذير / عرض
- **📐 الكود الفعلي:**
  ```typescript
  const uncostedRows = rows.filter((row) => row.flags.uncostedQuantitySold && row.quantityWithoutCostBasis > 0);
  ...
  ${formatNumber(row.derivedProfit)} DZD
  ```
- **🎯 الهدف:** عرض البيعات ذات `uncostedQuantitySold` كقسم خاص.
- **✅ الحكم:** **صحيحة** ✓ — يستخدم `row.derivedProfit` (من PAM ledger) مباشرة.
- **💡 الملاحظة:**
  - **هذا القسم في PDF يستخدم `derivedProfit` بشكل صحيح**، لكنه يحتاج `input.pamLedger.sellProfitRows` ليعمل ([pdfReports.ts:485](src/utils/pdfReports.ts#L485)).
  - في `useReportExports.ts:90-115`، **`pamLedger` غير ممرَّر** ⇒ `periodSellProfitRows` فارغة ⇒ **قسم تحذيرات PAM لا يظهر إطلاقًا في التقرير الشهري الحالي**!
  - **هذا تأثير ثانوي خطير لـ E-X**: ليس فقط الأرقام معطوبة، بل **التحذيرات الحرجة لا تظهر**.

---

### 🆔 E-013 — تقرير العميل (`buildClientPdfReport`)

- **📁 الملف:السطر:** [src/utils/pdfReports.ts:756-875](src/utils/pdfReports.ts#L756) (نقاط الإجمالي)
- **🏷️ التصنيف:** تقرير / عميل
- **📐 الصيغة (من تحليل سابق):**
  - $\text{openingBalance} = \sum_{tx \in \text{قبل الشهر}} \text{montant}$
  - $\text{closingBalance} = \text{openingBalance} + \text{periodNet}$
- **🎯 الهدف:** كشف حساب العميل لشهر معيّن.
- **✅ الحكم:** **صحيحة** — يحسب الأرصدة الدفترية فقط، **لا يحوي حسابات ربح PAM**، فلا يتأثر بـ E-X مباشرة.
- **💡 الملاحظة:** آمن من انتهاك القاعدة الذهبية لأنه لا يستخدم `getRealizedProfit`.

---

### 🆔 E-014 — تقرير المستثمر (`buildInvestorPdfReport`)

- **📁 الملف:السطر:** [src/utils/pdfReports.ts:894-984](src/utils/pdfReports.ts#L894)
- **🏷️ التصنيف:** تقرير / مستثمر
- **📐 الكود الفعلي (من التحليل):**
  ```typescript
  const investorTotalProfit = Number(input.investor.totalProfit || 0);
  const investorAvailableProfit = Number(input.investor.availableProfit || 0);
  ```
- **🎯 الهدف:** عرض ملخص المستثمر.
- **✅ الحكم:** **صحيحة** ✓.
- **💡 الملاحظة:**
  - يعتمد على `investor.totalProfit` و `investor.availableProfit` المحسوبة في `useInvestorEconomics.ts` (التي تستخدم `derivedProfit` بشكل صحيح، D-007).
  - لذا **هذا التقرير سليم** — لأن المصدر (`derivedInvestors[i]`) سليم.
  - **مفارقة محاسبية:** تقرير المستثمر دقيق، لكن التقرير الشهري للمحفظة معطوب — قد يرى المستخدم تفاوتًا بين "ربح الشهر" و"حصة المستثمر" في نفس الفترة.

---

## 📊 إحصائيات أولية للقسم E

| البند | العدد |
|------|------|
| إجمالي المعادلات الموثّقة في القسم E | **15** (E-X + E-001 → E-014) |
| ✅ صحيحة | **9** |
| ❌ خاطئة (انتهاك صريح للقاعدة الذهبية) | **5** (E-X, E-007, E-009 جزئيًا, E-010 جزئيًا, E-011) |
| ⚠️ مشبوهة | **1** (E-006: linked client resolution) |
| 🤔 تحتاج توضيحًا | **0** |

### 🔴 نقاط حرجة في القسم E

1. **E-X (الأخطر)**: `useReportExports.ts` لا يمرّر `profitByTxId` ولا `pamLedger` ⇒ `pdfReports` يسقط على `tx.profit`.
2. **E-007 (`getRealizedProfit`)**: السطر `derivedProfit ?? tx.profit ?? 0` انتهاك صريح، لكن **حتى لو أُصلح، يحتاج E-X الإصلاح أولًا** وإلا تصبح كل الأرباح في PDF صفرًا.
3. **E-012 (`buildUncostedQuantityWarningsHtml`)**: قسم تحذيرات PAM **لا يظهر** في التقارير الحالية لأن `pamLedger` غير ممرَّر ⇒ المستخدم لا يرى تحذيرات `oversell`/`uncosted` في PDF.
4. **تفاوت بين شاشات التطبيق:**
   - شاشة Analytics: تستخدم `derivedProfit` (دقيق) ✓.
   - PDF: يستخدم `tx.profit` (معطوب) ✗.
   - تقرير المستثمر: دقيق لأنه يعتمد على `useInvestorEconomics` (الذي يستخدم `derivedProfit`).
   - **النتيجة: PDF شهر يقول 2944.06 لـ jGd0، Analytics يقول 849، توزيع المستثمرين يستخدم 849.**

### ✅ نقاط متينة في القسم E

- **E-002, E-003, E-005 (`useAnalyticsViewModel`):** تطبيق نموذجي للقاعدة الذهبية. **يستخدم `pamLedger.profitByTxId[tx.id]?.derivedProfit || 0` بدون أي fallback لـ `tx.profit`.**
- **E-008 (`globalNetProfit`):** الجمع `USDT + EUR` كلاهما بالـ DZD، لا خلط عملات.
- **E-013 (تقرير العميل) و E-014 (تقرير المستثمر):** غير متأثرين بانتهاك القاعدة الذهبية (يعتمدان على مصادر سليمة).

### 🛠 الإصلاح المقترح (يحتاج موافقتك الصريحة قبل التنفيذ)

**خطوة 1 (في `useReportExports.ts`):** استيراد `computePamLedger` وحساب `pamLedger`، ثم تمريره لكل من `buildMonthlyPdfReport` و `buildClientPdfReport`:

```typescript
import { computePamLedger } from '../utils/pamLedger';

// داخل الـ hook:
const pamLedger = useMemo(() => computePamLedger(transactions), [transactions]);

// في handleExportUsdtReport:
const report = buildMonthlyPdfReport({ ..., pamLedger });

// في handleExportClientReport (إذا كان buildClientPdfReport يقبل pamLedger):
const report = buildClientPdfReport({ ..., pamLedger });
```

**خطوة 2 (في `pdfReports.ts:426`):** حذف fallback لـ `tx.profit`:

```typescript
return Number(derivedProfit ?? 0);
```

> **الإصلاحان معًا حلٌّ كامل ومحدَّد. كل واحد منفردًا غير كافٍ:**
> - الخطوة 1 وحدها: تحلّ المشكلة لكن تبقي الباب مفتوحًا للسقوط مرة أخرى عند تغيير لاحق.
> - الخطوة 2 وحدها: ستجعل كل الأرباح في PDF تظهر `0`.

---

## ⏸️ نهاية القسم E

**التدقيق الفني (الأقسام A-E) مكتمل. سأكتب الآن القسم F (نقاط الخطر العشر — الإجابة الموثّقة) و G (الإحصائيات والملخّص التنفيذي).**

---

# 🚨 القسم F — نقاط الخطر العشر — الإجابة الموثّقة (المرحلة 4)

| # | نقطة الخطر | الحكم النهائي | الدليل | الموقع المحدَّد |
|---|------------|----------------|--------|------------------|
| **1** | استخدام `tx.profit` بدل `derivedProfit` في تقارير | ❌ **انتهاك مؤكَّد** | E-X + E-007 + E-011 | [pdfReports.ts:426](src/utils/pdfReports.ts#L426) + [useReportExports.ts:90-115](src/hooks/useReportExports.ts#L90) |
| **2** | عدم تحديث PAM تاريخيًا عند تعديل شراء قديم | ✅ **محمي** | A-001 + اختبار pamLedger.test.ts:205-227 | [pamLedger.ts:282](src/utils/pamLedger.ts#L282) |
| **3** | فواصل عشرية بدون decimal.js | ✅ **آمن للـ DZD** عبر `money.ts`، 🟡 **عرضة لانحرافات نصف-قرش في PAM** عبر `round2`/`.toFixed(2)` | منهجية الدقّة + A-017 | [money.ts](src/utils/money.ts), [pamLedger.ts:112-114](src/utils/pamLedger.ts#L112) |
| **4** | القسمة على صفر | ✅ **محمي** في 5 مواضع (A-001, A-003, D-006, D-011 ضمنيًا، C-007) | A-001, A-003, D-006 | متعدّد |
| **5** | خلط العملات في الجمع | ✅ **آمن** — `derivedProfit` و `totalProfit` كلاهما بالـ DZD لكلتا العملتين | A-019, E-008 | [pamLedger.ts:295](src/utils/pamLedger.ts#L295), [pdfReports.ts:487](src/utils/pdfReports.ts#L487) |
| **6** | `managerFee` على الخسارة (H3) | 🔍 **السلوك (أ) الحالي افتُرض في التدقيق — Q1 ينتظر إجابة المالك** | D-007 | [useInvestorEconomics.ts:184-190](src/hooks/useInvestorEconomics.ts#L184) |
| **7** | توزيع الخسائر بين المستثمرين | ✅ **متّسق** — تناسبي مع تحذير `negative_derived_profit` | D-008 | [useInvestorEconomics.ts:196-207](src/hooks/useInvestorEconomics.ts#L196) |
| **8** | تزامن الخزينة مع العمليات | ⚠️ **مُعالج جزئيًا** — `payment_received` و buy/sell معالَج، لكن `expense` للأصل اليدوي **غير معالَج** (Q7) + لا يوجد update handler للأصول اليدوية (C-010) | C-010, B-012 | [useAssetHandlers.ts:107-123](src/hooks/useAssetHandlers.ts#L107) |
| **9** | `Transfert Entrant`/`Sortant` مجموع جبري = 0 | ⚠️ **مضمون رياضيًا، لكن الحذف قد يكسره** عند فشل `findTransferCounterpart` (B-005, B-014) | B-005, B-014 | [useClientHandlers.ts:118-138](src/hooks/useClientHandlers.ts#L118) |
| **10** | حالة `jGd0Hug9GvHZ3pxrSrDR` | ✅ **معالَجة صحيحًا في PAM ledger و توزيع المستثمرين**، ❌ **لكن PDF شهر يعرض 2944.06 بدل 849** بسبب E-X | A-007, D-015 + E-X | [pamLedger.test.ts:189-203](scripts/pamLedger.test.ts#L189) |

---

# 📊 القسم G — الإحصائيات والملخّص التنفيذي (المرحلة 5)

## الإحصائيات الإجمالية

| القسم | معادلات | ✅ صحيحة | ⚠️ مشبوهة | ❌ خاطئة | اختبارات Regression مقترحة |
|-------|----------|----------|-----------|----------|------------------------------|
| **A** — PAM/المحفظة | 20 | 15 | 5 | 0 | 12 |
| **B** — العملاء/الديون | 14 | 9 | 5 | 0 | 15 |
| **C** — الخزينة | 14 | 9 | 5 | 0 | 16 |
| **D** — المستثمرون | 16 | 12 | 4 | 0 | 18 |
| **E** — التقارير | 15 | 9 | 1 | **5** | (سيُضاف للقسم H) |
| **الإجمالي** | **79** | **54** | **20** | **5** | **61+** |

## 🔥 أخطر 5 مشاكل (مرتّبة حسب الأثر المالي)

### 1. ❌ E-X + E-007 — انتهاك القاعدة الذهبية في تقارير PDF (الأكبر مالياً)

**الأثر:** كل تقرير شهري + كل تقرير عميل يعرض أرباحًا من `tx.profit` المخزَّن بدل `derivedProfit` المعاد حسابه. مثال موثَّق: bay `jGd0Hug9GvHZ3pxrSrDR` يظهر بـ **+2944.06 DZD** في PDF بينما الواقع **+849 DZD** (فرق 2095.06 DZD لعملية واحدة، **2.46×**).

**الموقع:** [useReportExports.ts:90-115](src/hooks/useReportExports.ts#L90) + [pdfReports.ts:426](src/utils/pdfReports.ts#L426).

**الإصلاح المقترح:** خطوتان (انظر القسم E الفرعي 2 — الإصلاح المقترح).

### 2. ❌ E-012 — قسم تحذيرات PAM لا يظهر في PDF

**الأثر:** تحذيرات `oversell`، `uncosted_quantity_sold` لا تُعرض في التقارير الشهرية حاليًا. المستخدم يفقد إشارات حرجة على عمليات غير سليمة.

**الموقع:** [pdfReports.ts:485](src/utils/pdfReports.ts#L485) (يحتاج `pamLedger` ممرَّر).

**الإصلاح:** نفس إصلاح المشكلة #1 (تمرير `pamLedger`).

### 3. ⚠️ B-014 + B-005 — حذف عميل قد يخلّف "أيتام" Transfer

**الأثر:** عند حذف عميل بتاريخه، إذا فشل `findTransferCounterpart` (نطاق ±1ms مشدّد) لأي صف `Transfert Sortant`/`Entrant`، يبقى الصف المقابل عند العميل الآخر بدون شريك ⇒ رصيد العميل الآخر يقفز بـ `+amount` غير مبرَّر. المجموع الجبري للنظام (`Σ Transfert = 0`) ينكسر بصمت.

**الإصلاح المقترح:** توسيع نطاق التطابق (مثل ±1000ms + فحص note)، أو إضافة فحص ما-بعد-الحذف يؤكّد سلامة `Σ Transfert`.

### 4. ⚠️ A-014 — `tx.profit` المخزَّن قد ينحرف عند بيع تاريخي

**الأثر:** عند إدخال بيع بتاريخ سابق (وليس "الآن")، `handleSell` يستخدم `portfolioStats.usdt.avgBuy` الحالي بدل `historicalAvgBuy` لحظة البيع. النتيجة: `tx.profit` يُكتب مغلوطًا فورًا. (تأثيره مخفّف بفضل أن `derivedProfit` يعيد حسابه، لكن المشكلة الأم هي مصدر الفجوات في حالة `jGd0Hug9GvHZ3pxrSrDR`.)

**الإصلاح المقترح:** عند `handleSell` لعملية بـ timestamp تاريخي، حساب `historicalAvgBuy` من `computePamLedger(transactions before timestamp)` بدل `portfolioStats.avgBuy` الحالي.

### 5. ⚠️ D-006 — `unallocatedProfit` معلَّق بلا توزيع

**الأثر:** البيعات التي حدثت قبل وجود مستثمر مؤهل تتجمّع في حقل لا يُوزَّع لاحقًا. المستثمر الذي يدخل بعدها يفقد فرصة المشاركة في تلك الأرباح، والمدير لا يحصل عليها صراحة.

**الإصلاح:** **يحتاج إجابة المالك على Q9** (أ تركه، ب إضافته للمدير، ج توزيعه على أول بيعة).

## 🟢 أكثر 3 أجزاء متينة (للحفاظ عليها)

### 1. `src/utils/pamLedger.ts` (computePamLedger)

**لماذا:** القلب المالي للمشروع. يحسب `derivedProfit` بدقّة تاريخية عبر متوسط مرجّح لحظي. كل تحذير له كود وشدّة ورسالة (`oversell`, `uncosted_quantity_sold`, `stored_mismatch`, `manual_total_present`, `legacy_fallback`, `eur_conversion_related`, `quantity_only_adjustment`, `missing_buy_total`). عتبات صارمة (`zeroEpsilon = 0.005`، `tolerance = 1 DZD`).

**الحفاظ:** لا تكسر `computePamLedger`. أي تعديل عليه يجب أن يمر بكامل اختبارات `scripts/pamLedger.test.ts`.

### 2. `src/utils/money.ts` (Integer Cents Helpers)

**لماذا:** يحمي كل الحسابات DZD من float drift عبر `Math.round(value * 100)` ثم العمل على أعداد صحيحة. `distributeProportionally` يضمن `sum = total` بالضبط (largest-remainder method). كافٍ تمامًا — لا يحتاج `decimal.js`.

**الحفاظ:** يجب توحيد كل الحسابات المالية (B-001، C-001، C-005) تحته، ولا يُهمَل لـ `+/-` المباشر.

### 3. `src/components/analytics/useAnalyticsViewModel.ts`

**لماذا:** **النموذج المرجعي** للتقارير: يستخدم `pamLedger.profitByTxId[tx.id]?.derivedProfit || 0` بدون أي fallback لـ `tx.profit`. متّسق مع `useInvestorEconomics`. يعرض الحقيقة الرياضية في 3 شاشات (calculatedStats، heatmapData، monthlyClientRanking).

**الحفاظ:** **يجب أن يصبح `pdfReports.ts` نسخة منه**، لا العكس.

## ✅ الإجابات الموثَّقة على الأسئلة العشرة (تاريخ الإجابة: 2026-05-08 — **محدَّث بعد المراجعة النهائية**)

| # | المعرّف | السؤال | إجابة المالك | الأثر |
|---|---------|--------|----------------|-------|
| **Q1** | H3 / D-007 | manager fee على خسارة | **🔄 الجميع يتحمّل الخسارة حسب نسب المشاركة** (إعادة صياغة للسلوك (أ) الحالي — مماثل عدديًا) | ✅ السلوك الحالي صحيح — لا تعديل |
| **Q2** | A-015 | دقّة USDT/EUR | **🔄 التقريب إلى الوحدة (أعداد صحيحة بدون منازل عشرية)** | 🛠 إصلاح مطلوب — **FIX-9 جديد** |
| **Q3** | A-013 | `Math.round(totalCost)` | **إبقاء التقريب لصحيح** | ✅ السلوك الحالي صحيح — لا تعديل |
| **Q4** | A-011 | كشف EUR→USDT | **بالنافذة الزمنية فقط** | ✅ السلوك الحالي صحيح — لا تعديل |
| **Q5** | B-009/B-010 | `overdueAmount` المعروض | **🔧 الدين المتأخر فقط** | 🛠 إصلاح مطلوب — مفوَّض |
| **Q6** | C-007 | `portfolioValue` المصدر | **إبقاء PAM دفتريا** (مؤكَّد من الكود: `available × avgBuy`) | ✅ السلوك الحالي صحيح — لا تعديل |
| **Q7** | C-010 | `expense` لأصل يدوي | **🔧 توليد Retrait تلقائيًا** | 🛠 إصلاح مطلوب — مفوَّض |
| **Q8** | C-013 | حذف عميل أصل يدوي | **🔧 cascade delete لـ actifTransactions** | 🛠 إصلاح مطلوب — مفوَّض |
| **Q9** | D-006 | `unallocatedProfit` | **(أ) تركه معلَّقًا** | ✅ السلوك الحالي صحيح — لا تعديل |
| **Q10** | D-003 | تحذيرات uncosted على بيعات صفرية | **🔧 نعم، تظهر** | 🛠 إصلاح مطلوب — مفوَّض |

> **🔄 تعديلان بعد المراجعة النهائية:**
> - **Q1:** إعادة صياغة بدل تعديل سلوك. الفهم الصحيح: كل الأطراف تشارك في الخسارة بالتناسب — مماثل لتوزيع الربح.
> - **Q2:** تغيير حقيقي. الكميات (USDT و EUR) تُقرَّب إلى **أعداد صحيحة**. هذا تبسيط للحسابات والعرض. يستلزم إصلاحًا في `getTxQuantity` و `useTransactionHandlers`.

---

## 🛠 خطة الإصلاحات المُفوَّضة (بناء على إجابات الأسئلة + الانتهاكات الواضحة)

> **مفوَّض:** كل إصلاح أدناه قائم على **إجابة صريحة** من المالك على سؤال محدَّد، أو على **انتهاك واضح للقاعدة الذهبية** الموثّقة في `CLAUDE_PROJECT_INTENT.md`. لكل إصلاح: المعرّف، الموقع، التغيير المختصر، اختبار يثبته.

### 🔴 أولوية 1 — انتهاك القاعدة الذهبية (الأخطر مالياً) — ✅ **مُنفَّذ 2026-05-08**

**FIX-1: تمرير `pamLedger` إلى `pdfReports.ts`** ✅ — يحلّ المشكلة #1 و #2

- **الموقع:** [src/hooks/useReportExports.ts:1-3, 51-52, 95-105](src/hooks/useReportExports.ts)
- **التغيير المُنفَّذ:**
  - استيراد `computePamLedger` من `'../utils/pamLedger'` (سطر 3).
  - حساب `pamLedger` عبر `useMemo` (سطر 52): `const pamLedger = useMemo(() => computePamLedger(transactions), [transactions]);`
  - تمريره إلى `buildMonthlyPdfReport` (سطر 104).
- **التأثير:**
  - تقارير PDF تستخدم `derivedProfit` بدل `tx.profit`.
  - قسم "Alertes Comptables PAM" يظهر في التقرير الشهري.
  - حالة `jGd0Hug9GvHZ3pxrSrDR` تعرض **+849 DZD** بدل +2944.06.
- **اختبار:** T-E-005 + T-E-006.

**FIX-2: إزالة fallback لـ `tx.profit`** ✅ — يحلّ E-007

- **الموقع:** [src/utils/pdfReports.ts:426](src/utils/pdfReports.ts#L426)
- **التغيير المُنفَّذ:** `return Number(derivedProfit ?? tx.profit ?? 0);` ⇒ `return Number(derivedProfit ?? 0);`
- **اختبار:** T-E-004 (يتطابق مع السلوك الجديد) + T-E-001/002/003 (مُحدَّثة لعكس السلوك).

> **حالة 2026-05-08:** تم تنفيذ FIX-1 + FIX-2 معًا. اختبارات `scripts/section-E.test.ts` تم تحديثها. كل تقارير PDF تستخدم الآن `derivedProfit` من `computePamLedger`. حالة `jGd0Hug9GvHZ3pxrSrDR` تعرض الآن **+849 DZD** بدل +2944.06 DZD، وقسم "Alertes Comptables PAM" يظهر صحيحًا.

### 🛠 أولوية 2 — إصلاحات بناء على إجابات Q5/Q7/Q8/Q10 — ✅ **مُنفَّذة 2026-05-08**

**FIX-3 (Q10): إظهار تحذيرات uncosted للبيعات بربح صفر** ✅

- **الموقع:** [src/hooks/useInvestorEconomics.ts:144-153](src/hooks/useInvestorEconomics.ts#L144) (`chronologicalDerivedSells`)
- **التغيير المُنفَّذ:** إزالة الشرط الصارم `derivedProfit !== 0`؛ الإبقاء على البيعات الصفرية حين تحمل علامة `uncostedQuantitySold` أو `oversell` أو `legacyFallback`. التوزيع الفعلي يبقى صفرًا — التحذيرات فقط هي ما تظهر.
- **اختبار:** T-D-018 (مُحدَّث ليؤكّد ظهور تحذير `uncosted_quantity_sold`).

**FIX-4 (Q5): فصل `overdueAmount` عن الرصيد الكلي** ✅

- **الموقع:** [src/hooks/useOverdueDebtClients.ts:106-109](src/hooks/useOverdueDebtClients.ts#L106)
- **التغيير المُنفَّذ:** `overdueAmount = Σ(lot.remaining for lot in overdueLots)` (مجموع لوتات الديون المتأخّرة فقط) بدل `|min(currentBalance, 0)|`.
- **اختبار:** T-B-011 (مُحدَّث ليعكس حصر العرض على الديون الفعلية > 7 أيام).
- **ملاحظة UI:** قد يحتاج عرض إضافي لـ"الدين الكلي" بجانب "الدين المتأخر" — قرار واجهة لاحق.

**FIX-5 (Q7): توليد `Retrait` تلقائي لـ `payment_made` على أصل يدوي** ✅

- **الموقع:** [src/hooks/useAssetHandlers.ts:107-131](src/hooks/useAssetHandlers.ts#L107) (`handleCreateAssetTransaction`)
- **التغيير المُنفَّذ:** الفرع موسَّع لقبول `payment_received` (Ajout) و `payment_made` (Retrait) عند طريقة دفع `cash`/`baridi`. الـ note يستخدم "Paiement" للدخول و "Depense" للخروج.
- **النوع الفعلي:** `payment_made` (وفق `ManualAssetTransactionType` في `types.ts:125-130`) — وليس `'expense'`.
- **اختبار:** T-C-013 (مُحدَّث للتحقق من حضور `payment_made` و `'Retrait'`).

**FIX-6 (Q8): cascade delete لـ `actifTransactions` عند حذف عميل أصل يدوي** ✅

- **الموقع:** [src/hooks/useAssetHandlers.ts:238-285](src/hooks/useAssetHandlers.ts#L238) (`handleDeleteAssetClient`)
- **التغيير المُنفَّذ:** قبل حذف العميل، استعلام `actifTransactions` بـ `clientId === clientId`، جمع كل `linkedTreasuryTxId` المرتبطة، ثم حذف الجميع في batches من 400 عملية (مماثل لنمط B-014).
- **اختبار:** T-C-015 (مُحدَّث للتحقق من cascade).

**FIX-9 (Q2): تقريب الكميات USDT/EUR إلى أعداد صحيحة** ✅

- **المواقع المُنفَّذة:**
  - [src/utils/pamLedger.ts:156-160](src/utils/pamLedger.ts#L156) — `getTxQuantity` يستخدم `Math.round` بدل `round2`.
  - [src/hooks/useTransactionHandlers.ts:256-265](src/hooks/useTransactionHandlers.ts#L256) — كل مدخلات `quantity` (buy USDT/EUR/with_eur) تُقرَّب إلى أعداد صحيحة.
  - [src/hooks/useTransactionHandlers.ts:411](src/hooks/useTransactionHandlers.ts#L411) — `quantity` في `handleSell`.
  - [src/hooks/useTransactionHandlers.ts:571](src/hooks/useTransactionHandlers.ts#L571) — `quantity` في `handleGlobalAdjustment` (Manual Add/Subtract).
  - الـ notes في كل العمليات: `${quantity.toFixed(2)}` ⇒ `${quantity}` (إزالة `.00` كاذبة بعد التقريب).
- **لا migration على Firestore:** البيانات القائمة بمنازل عشرية تُقرَّب لحظة القراءة عبر `getTxQuantity`.
- **اختبار:** T-A-005 (مُحدَّث لاختبار `Math.round` على 100.12345678 → 100 و 50.6 → 51).

### 🆕 تحسين إضافي مُكتشف: Q9 (`unallocatedProfit`) — تطبيق (أ) [القرار النهائي 2026-05-09]

- **الموقع:** [src/hooks/useInvestorEconomics.ts:175-189](src/hooks/useInvestorEconomics.ts#L175)
- **القرار النهائي بعد المراجعة:** المالك أكد (أ) — **تركه معلَّقًا** فقط، **لا يُضاف للمدير ولا يُوزَّع على المستثمرين**.
- **التغيير المُنفَّذ:** عند `totalCapAtSell <= 0` (لا مستثمر مؤهل):
  - `unallocatedProfit += derivedProfit` (تتبّع منفصل).
  - **لا** يُضاف إلى `managerShare`.
  - **لا** يُوزَّع على المستثمرين.
- **صيغة `reconciliationDifference` الجديدة:** `derivedProfit - (managerShare + investorShare + unallocatedProfit)` — صفر في الحالة السليمة، ويرصد التسرّب الحقيقي إن وُجد.
- **بالإضافة (D-016):** `entryTs` لتاريخ غير صالح أصبح `Number.MAX_SAFE_INTEGER` ⇒ المستثمر مُستبعَد بدل مؤهَّل لكل البيعات.
- **اختبارات:** T-D-001، T-D-004، T-D-007، T-D-008، T-D-015 — مُحدَّثة لتعكس السلوك النهائي (Q9 = أ).

**FIX-9 (Q2 hybrid 2026-05-09): تقريب الكميات USDT/EUR إلى أعداد صحيحة عند الإدخال فقط**

> **قرار هجين بعد المراجعة:** الواجهة وطبقة الإدخال (handlers) تُجبر الأعداد الصحيحة للعمليات الجديدة، لكن `getTxQuantity` في `pamLedger` يبقى `round2` للحفاظ على دقّة البيانات التاريخية (خصوصًا تحويلات EUR↔USDT بكميات كسرية، مثل 1760.644418872267). هذا يحمي المرجع التاريخي **jGd0 → derivedProfit = 849**.

- **المواقع المُطبَّقة:**
  - [src/utils/pamLedger.ts:156-161](src/utils/pamLedger.ts#L156) — `getTxQuantity`: **`round2(...)`** (هجين — يحفظ الدقة التاريخية).
  - [src/hooks/useTransactionHandlers.ts:256](src/hooks/useTransactionHandlers.ts#L256) — `quantity = Math.round(parseAndEvaluate(buyUsdtAmount))` (إدخال جديد).
  - [src/hooks/useTransactionHandlers.ts:260](src/hooks/useTransactionHandlers.ts#L260) — `quantity = Math.round(usdtFromEurCalc!.usdtQty)`.
  - [src/hooks/useTransactionHandlers.ts:265-266](src/hooks/useTransactionHandlers.ts#L265) — للـ EUR.
  - [src/hooks/useTransactionHandlers.ts:411](src/hooks/useTransactionHandlers.ts#L411) — `quantity = Math.round(parseAndEvaluate(sellAmount))`.
  - [src/hooks/useTransactionHandlers.ts:571](src/hooks/useTransactionHandlers.ts#L571) — `quantity: Math.round(amountNum)` لـ Manual Adjustment.
- **الأثر:**
  - ✅ تبسيط الإدخال والعرض للعمليات الجديدة (لا حاجة لإدخال 100.50).
  - ✅ البيانات التاريخية (EUR↔USDT بكميات كسرية) تبقى دقيقة محاسبيًا.
  - ✅ المرجع jGd0 = 849 محفوظ — `pamLedger.test.ts` و `investorEconomics.pamLedger.test.ts` تعبران بدون كسر.
  - ⚠️ **لا migration مطلوبة على Firestore** — البيانات التاريخية تبقى كما هي.
- **اختبارات:**
  - T-A-005 — يُثبّت `round2` في `getTxQuantity` (100.12345678 → 100.12).
  - `pamLedger.test.ts` (موجود مسبقًا) — يُثبّت jGd0 = 849.
  - `investorEconomics.pamLedger.test.ts` (موجود مسبقًا) — يُثبّت توزيع 849 على المستثمرين.

---

### 🟡 أولوية 3 — إصلاحات هشاشات موثّقة (تحتاج مراجعتك)

**FIX-7 (B-014/B-005 — هشاشة Transfer counterpart):**
- توسيع نطاق `findTransferCounterpart` من `±1ms` إلى `±1000ms` + اختبار one-to-one + إضافة فحص ما-بعد-الحذف.
- **اختبار:** T-B-013.
- **يحتاج موافقة منفصلة قبل التنفيذ** (لم يكن في الأسئلة العشرة).

**FIX-8 (A-014 — `tx.profit` المخزَّن في handleSell):**
- استبدال `sellAssetStats.avgBuy` بحساب `historicalAvgBuy` من `computePamLedger(transactions before timestamp)`.
- **اختبار:** T-A-004.
- **يحتاج موافقة منفصلة قبل التنفيذ** (لم يكن في الأسئلة العشرة).

### 🆕 FIX-10 (مراجعة 2026-05-11) — إظهار المنازل العشرية للكميات USDT/EUR

**الدافع:** بعد تطبيق FIX-9 (Math.round في طبقة الإدخال)، أصبحت كل العمليات الجديدة تُخزَّن كأعداد صحيحة. هذا منع المستخدم من إدخال كميات كسرية حقيقية (مثل 100.50 USDT) وأدى إلى زيادة/نقصان فعلي عند إرسال الكمية للعميل. القرار: السماح بدقّة منزلتين عشريتين في الإدخال **والعرض المشروط** (لا أصفار تابعة).

**التغييرات المُطبَّقة:**

| الملف:السطر | التغيير |
|---|---|
| [src/hooks/useTransactionHandlers.ts:7-8](src/hooks/useTransactionHandlers.ts#L7) | استيراد `roundM` من `../utils/money` و `formatNumber` من `../pages/shared/pageFormat`. |
| [src/hooks/useTransactionHandlers.ts:258, 262, 267](src/hooks/useTransactionHandlers.ts#L258) | `Math.round(...)` → `roundM(...)` في `handleBuy` (شراء USDT بـ DZD، شراء USDT من EUR، شراء EUR). |
| [src/hooks/useTransactionHandlers.ts:412](src/hooks/useTransactionHandlers.ts#L412) | `Math.round(...)` → `roundM(...)` في `handleSell`. |
| [src/hooks/useTransactionHandlers.ts:572](src/hooks/useTransactionHandlers.ts#L572) | `Math.round(amountNum)` → `roundM(amountNum)` في `handleGlobalAdjustment`. |
| useTransactionHandlers.ts (نصوص notes) | كل `${quantity}` في 13 موضعًا → `${formatNumber(quantity, { min: 0, max: 2 })}` لاتساق العرض. |
| [src/components/ui/NumberInput.tsx:74](src/components/ui/NumberInput.tsx#L74) | `minimumFractionDigits: 2` → `0` في معاينة النتيجة. |
| [src/components/transactions/useTransactionsViewModel.tsx:96](src/components/transactions/useTransactionsViewModel.tsx#L96) | `formatAssetAmount`: `min: 2, max: 2` → `min: 0, max: 2`. |
| [src/components/clients/ClientDetailsView.tsx:262, 265](src/components/clients/ClientDetailsView.tsx#L262) | `formatNumber(linkedUsdtTx.quantity, ...)`: `min: 2` → `min: 0` (السعر يبقى 2). |
| [src/utils/pdfReports.ts:81-84](src/utils/pdfReports.ts#L81) | إضافة helper `formatAssetQuantity(value)` يستخدم `min: 0, max: 2`. |
| pdfReports.ts (5 مواضع: 558، 579، 580، 758، 940) | `formatNumber(...quantity)` → `formatAssetQuantity(...quantity)`. الأسعار والمبالغ DZD تبقى `formatNumber` (2 منازل ثابتة). |

**ما لم يتغيّر:**
- `getTxQuantity` في `pamLedger.ts` يبقى `round2` (يحفظ jGd0 = 849).
- كل حسابات DZD (السعر، المجموع، الربح، الرصيد، المنطق المحاسبي) تبقى `min: 2, max: 2`.
- `Math.round(totalCost)` يبقى كما هو (Q3).

**اختبار:**
- ✅ `npm run build` — لا أخطاء.
- ✅ جميع اختبارات الوحدة خضراء (A: 12، B: 15، C: 16، D: 19، E: 12+1، pamLedger: 8، investorEconomics: 7).
- 🔧 **التحقّق اليدوي مطلوب:** `npm run dev` ثم شراء USDT بكمية 100.50 → التأكّد من ظهور `100,50 USDT` في صفحة المعاملات، تفاصيل العميل، و PDF.

---

### 📅 ترتيب التنفيذ النهائي المعتمد (بعد المراجعة 2026-05-11) — ✅ **مُنجَز**

1. ✅ **Regression tests** — 5 ملفات (`section-A/B/C/D/E.test.ts`) + ملفات `pamLedger.test.ts` و `investorEconomics.pamLedger.test.ts` القائمة.
2. ✅ **FIX-1 + FIX-2** (انتهاك القاعدة الذهبية).
3. ✅ **إصلاحات أولوية 2:** FIX-3 (Q10) + FIX-4 (Q5) + FIX-5 (Q7) + FIX-6 (Q8) + FIX-9 (Q2 hybrid) + FIX-10 (Q2 reversal — decimal display).
4. 🟡 **FIX-7 و FIX-8 مؤجَّلان** لمراجعة مستقلة لاحقة (لم يتم تطبيقهما).
5. 🆕 **تحسين Q9** (القرار النهائي = (أ) — مراجعة 2026-05-10): pre-investor profit يبقى **معلَّقًا في `unallocatedProfit` فقط**، لا يُضاف إلى `managerShare` ولا يُوزَّع على المستثمرين. صيغة `reconciliationDifference` تطرح `unallocatedProfit` ضمنيًا.
6. 🆕 **تحسين D-016**: invalid `entryDate` يُترجَم إلى `Number.MAX_SAFE_INTEGER` ⇒ المستثمر مُستبعَد بدل مؤهَّل لكل البيعات.
7. 🆕 **FIX-9 هجين** (مراجعة 2026-05-10): `getTxQuantity` في `pamLedger` يبقى `round2` (يحفظ دقة EUR↔USDT والمرجع jGd0 = 849)، بينما طبقة الإدخال (handlers) تُجبر `Math.round` للعمليات الجديدة.
8. 🆕 **FIX-10** (مراجعة 2026-05-11): إعادة `Math.round` في طبقة الإدخال إلى `roundM` (`round2`)، وتغيير عرض الكميات إلى `min: 0, max: 2` لإظهار `100` للعدد الصحيح و `100,50` للكسري.

> **حالة التدقيق 2026-05-11:** 8 إصلاحات مُنفَّذة (FIX-1، FIX-2، FIX-3، FIX-4، FIX-5، FIX-6، FIX-9 هجين، FIX-10) + 3 تحسينات إضافية (Q9 = أ، D-016، FIX-9 هجين). 2 إصلاح مؤجَّل (FIX-7 لـ Transfer counterpart، FIX-8 لـ historicalAvgBuy في handleSell). **جميع الاختبارات خضراء.**

---

# 🧪 القسم H — اختبارات Regression الموصى بإضافتها (تنفيذ التعديل #5)

> **الغرض:** قائمة قابلة للتنفيذ بأسماء اختبارات ينبغي كتابتها لتغطية كل خطأ/شك مكتشف. ستُستخدم لاحقًا مع `prodigital-tester` skill.
>
> **التزام:** سيُحدَّث هذا القسم ديناميكيًا بإضافة `T-B-*` ، `T-C-*` ، `T-D-*` ، `T-E-*` مع كل قسم. حاليًا يحوي اختبارات القسم A فقط.

## ✅ موجود مسبقًا (قائمة موروثة)

| اسم الاختبار | الموقع | يغطّي |
|----------------|---------|--------|
| `jGd0Hug9GvHZ3pxrSrDR keeps stored snapshot separate from derived PAM profit` | [pamLedger.test.ts:189-203](scripts/pamLedger.test.ts#L189) | A-002, A-007 |
| `editing old purchase recalculates downstream sell profits` | [pamLedger.test.ts:205-227](scripts/pamLedger.test.ts#L205) | A-001 |
| `deleting old purchase triggers oversell + uncosted flags` | [pamLedger.test.ts:229-253](scripts/pamLedger.test.ts#L229) | A-004, A-005 |
| `EUR→USDT conversion is detected and flagged on both rows` | [pamLedger.test.ts:255-272](scripts/pamLedger.test.ts#L255) | A-011 |
| `quantity-only Ajout Manuel updates available without cost basis` | [pamLedger.test.ts:274-287](scripts/pamLedger.test.ts#L274) | A-008 |
| `uncosted_quantity_sold flag fires when sold > purchasedQty` | [pamLedger.test.ts:289-303](scripts/pamLedger.test.ts#L289) | A-005 |
| `investor distribution uses derived PAM profit instead of stored tx.profit` | [investorEconomics.pamLedger.test.ts:79-106](scripts/investorEconomics.pamLedger.test.ts#L79) | (D-* لاحقًا) |

## 🆕 الموصى بإضافتها للقسم A

| المعرّف | اسم الاختبار المقترح (camelCase) | الهدف | يغطّي |
|---------|-----------------------------------|--------|--------|
| **T-A-001** | `pamLedger_legacyFallback_withValidPriceProducesUncostedProfit` | يُثبّت السلوك الحالي حين `purchasedQty=0` و `sellPrice` صالح: `derivedProfit = sellPrice × qty` مع تفعيل `legacyFallback` و `uncostedQuantitySold`. يكشف لو غُيِّر السلوك. | A-006 |
| **T-A-002** | `pamLedger_eurConversion_oneToOneConstraint` | حالة: سحب EUR + شراءان متتاليان لـ USDT خلال 60 ثانية. يجب أن يُربط واحد فقط (الأقرب زمنيًا أو الأقل فرقًا في المبلغ المتوقّع). يكشف خلل `find()` بدون قيد. | A-011 |
| **T-A-003** | `pamLedger_eurConversion_amountMismatchTriggersWarning` | يكشف عدم تحقّق `eurQty × eurPrice ≈ usdtQty × usdtPriceDzd` ضمن tolerance — الربط دلالي (مبلغ) لا زمني فقط. **يفترض إضافة هذا الفحص بعد موافقة المالك.** | A-011 |
| **T-A-004** | `handleSell_storesSnapshotProfit_butLedgerOverridesIt` | يُثبّت أن `tx.profit` المخزَّن قد ينحرف عند بيع تاريخي (`portfolioStats.avgBuy` ≠ `historicalAvgBuy`)، وأن `pamLedger.derivedProfit` يبقى المرجع. | A-014 |
| **T-A-005** | `getTxQuantity_truncatesUsdtTo2Decimals` | يُثبّت/يكشف فقد دقّة USDT: `100.12345678` → `100.12`. اختبار توثيقي للسلوك الحالي. | A-015 |
| **T-A-006** | `pamLedger_round2_floatRepresentationEdgeCase` | يكشف الـ `1.005 → 1.00` في `round2`. توثيقي + تحذيري. | منهجية الدقّة |
| **T-A-007** | `pamLedger_eurConversionTimestampOrdering_withClashingTimestamp` | يضمن أن `timestamp - 1` يحفظ ترتيب EUR قبل USDT حتى عند تطابق timestamp مع عمليات أخرى (`__ledgerIndex` يحسم). | A-012, A-020 |
| **T-A-008** | `pamLedger_oversellWithUncosted_warningSeverityHigh` | يُثبّت أن الجمع بين `oversell` و `uncostedQuantitySold` يرفع الشدّة إلى `high` (مهم لعرض UI). | A-004, A-005 |
| **T-A-009** | `pamLedger_buyWithoutTotal_emitsMissingBuyTotalWarning` | يكشف حالة `buy` بدون `total > 0` — يُحدّث `purchasedQty` بـ 0 تكلفة، فينحرف PAM. | A-008 |
| **T-A-010** | `pamLedger_manualTotalOverrideOnSell_within1DzdToleranceIgnored` | يُثبّت عتبة 1 DZD في `manualTotalPresent` — تجاوزات أصغر تُعتبر تقريبًا، أكبر تُحفَّظ كـ override. | A-003 |
| **T-A-011** | `usdtFromEurCalc_algebraicEquivalence_holdsWithinToleranceAfterRounding` | يُثبّت `eurQty × eurPrice = usdtQty × usdtPriceDzd` بعد التقريب (يكشف فروقات بسبب `.toFixed(2)`). | A-012 |
| **T-A-012** | `pamLedger_normalizeZero_minusZeroTreatedAsPlusZero` | يُثبّت أن `Object.is(safe, -0)` يُحوَّل إلى `+0` (مهم لعرض PDF). | A-016 |

> **اختبارات T-A-002، T-A-003، T-A-009 قد تكشف اختلالات قائمة. لا أوصي بكتابتها كاختبارات "ثبات" قبل موافقة المالك على السلوك المرغوب.**

## 🆕 الموصى بإضافتها للقسم B (العملاء والديون DZD)

| المعرّف | اسم الاختبار المقترح (camelCase) | الهدف | يغطّي |
|---------|-----------------------------------|--------|--------|
| **T-B-001** | `clientBalance_sumOfMontant_excludesAffectsBalanceFalse` | يُثبّت أن `clientBalances` يتجاهل `affectsBalance === false` ويُجمع الباقي بـ `+`. | B-001 |
| **T-B-002** | `clientBalance_floatDrift_thousandsOfDecimalEntries` | اختبار stress: 1000 عملية بـ `0.1 DZD` → الرصيد يبقى ضمن `±0.005` (يكشف الحاجة لـ `addM`). | B-001 |
| **T-B-003** | `transferCounterpart_findsByTimestampWithin1ms` | حالة سعيدة: زوج `Transfert Sortant`/`Entrant` بنفس timestamp يُكتشف. | B-005 |
| **T-B-004** | `transferCounterpart_failsWhenTimestampDiffExceeds1ms` | يكشف أن فرق ≥ 2ms يُفشل التطابق (هشاشة موثّقة). | B-005 |
| **T-B-005** | `transferCounterpart_doesNotMatchTwiceTheSameCounterpart` | يضمن one-to-one إذا أُضيف القيد لاحقًا (حاليًا لا قيد). | B-005 |
| **T-B-006** | `clientDelete_blockedWhenAbsBalanceExceeds0_01` | عتبة 0.01 DZD تمنع الحذف. | B-006 |
| **T-B-007** | `clientDelete_allowsDeletionWhenBalanceIsZeroPlusEpsilon` | الحذف يمر عند رصيد `≤ 0.01`. | B-006 |
| **T-B-008** | `overdueDebt_fifo_oldestDebtClosedFirstByPositivePayment` | الدين الأقدم يُغلق أولًا. | B-007 |
| **T-B-009** | `overdueDebt_availableCredit_offsetsIncomingDebt` | تسبيق سابق يقابل دينًا قادمًا. | B-007 |
| **T-B-010** | `overdueDebt_daysFloor_atDayBoundary` | دين عمره 7 أيام و 23 ساعة لا يُعتبر متأخرًا (`days = 7 ≯ 7`). | B-008 |
| **T-B-011** | `overdueAmount_displaysFullCurrentDebt_notJustOverdueLots` | يُثبّت السلوك الحالي (الرصيد السالب الكلي) للقرار الواعي. | B-009 |
| **T-B-012** | `paymentMethod_normalizationHandlesEncodingVariants` | يكشف فشل المقارنة عند encoding مختلف (`Crédit` UTF-8 vs Latin1). | B-013 |
| **T-B-013** | `clientDelete_orphansTransferEntrantWhenCounterpartMatchFails` | يكشف سيناريو الأيتام (يفشل عمدًا حاليًا). | B-014 |
| **T-B-014** | `solde_initial_notCreatedWhenZero` | لا صف `Solde Initial` لـ `initBal === 0`. | B-004 |
| **T-B-015** | `ajustement_solde_skippedWhenDeltaBelow0_01` | فرق < 0.01 لا يُنشئ صف `Ajustement Solde`. | B-003 |

> **اختبارات T-B-004، T-B-005، T-B-013 توثّق هشاشات موثّقة في B-005/B-014. لا أوصي بإصلاحها قبل موافقة المالك.**

## 🆕 الموصى بإضافتها للقسم C (الخزينة والأصول اليدوية)

| المعرّف | اسم الاختبار المقترح (camelCase) | الهدف | يغطّي |
|---------|-----------------------------------|--------|--------|
| **T-C-001** | `treasuryStats_ajoutAndRetrait_balanceCorrectly` | يضمن `Ajout` يزيد و `Retrait` ينقص بمقدار `amount` على الـ source الصحيح. | C-001 |
| **T-C-002** | `treasuryStats_skipsNonPositiveAmount` | يضمن أن `amount <= 0 \|\| !isFinite` يُتجاهل بدون أثر. | C-001 |
| **T-C-003** | `treasuryStats_unknownTypeIsSilentlyIgnored` | يكشف أن نوعًا غير معروف يُتجاهل بدون تحذير (سلوك حالي). | C-001 |
| **T-C-004** | `treasuryStats_transferZeroSumInvariant` | يضمن أن كل صف `Transfer` يحفظ مجموع `caisse + baridi` ثابتًا. | C-002 |
| **T-C-005** | `treasuryStats_transferRejectsSameSourceAndDestination` | تحويل من Caisse إلى Caisse → لا تأثير. | C-002 |
| **T-C-006** | `treasuryStats_legacyTransferAssetParser_recognizesFromTo` | regex `from X to Y` يُعرَّف على نص `tx.asset` القديم. | C-003 |
| **T-C-007** | `resolveWallet_caisseBaridiAmbiguity` | نص `"caisse-baridi"` يُحَلّ كـ `Caisse` (سلوك حالي — هشاشة). | C-004 |
| **T-C-008** | `manualCardsTotal_handlesNanValueAsZero` | `Number(card.value) \|\| 0` لا ينشر NaN. | C-005 |
| **T-C-009** | `positionNette_signMatchesAccountingDefinition` | `positionNette > 0` يعني نَدِين أكثر مما يَدِينون لنا. | C-006 |
| **T-C-010** | `capitalTotal_formulaMatchesAssetMinusLiabilityModel` | `capitalTotal = caisse + baridi + portfolio + manualCards + dettesAbs - avances`. | C-007 |
| **T-C-011** | `assetClientBalances_doesNotApplyAffectsBalanceFilter` | يُثبّت السلوك الحالي (لا فلتر) — للقرار الواعي. | C-008 |
| **T-C-012** | `manualAssetPayment_createsLinkedAjoutTreasuryTx` | `payment_received` + `cash` ⇒ صف `Ajout` خزينة بربط ثنائي. | C-010 |
| **T-C-013** | `manualAssetExpense_doesNotCreateRetraitTreasuryTx` | يُثبّت السلوك الحالي (لا تزامن للمصاريف) — للقرار الواعي. | C-010 |
| **T-C-014** | `assetClient_adjustmentDeltaThreshold_below0_01Skipped` | فرق < 0.01 لا يُنشئ صف `adjustment`. | C-012 |
| **T-C-015** | `assetClient_deleteAllowsZeroBalance_butLeavesOrphanTransactions` | يكشف ضعف orphan transactions في `actifTransactions`. | C-013 |
| **T-C-016** | `manualAsset_deleteBlockedWhenTxCountAboveZero` | حماية الحذف المتشدّدة. | C-014 |

> **اختبارات T-C-007، T-C-013، T-C-015 توثّق هشاشات/قرارات تستحق مراجعة المالك قبل البتّ في إصلاحها.**

## 🆕 الموصى بإضافتها للقسم D (المستثمرون والتوزيع)

| المعرّف | اسم الاختبار المقترح (camelCase) | الهدف | يغطّي |
|---------|-----------------------------------|--------|--------|
| **T-D-001** | `capitalAtTs_returnsZeroWhenAllMovementsAfterTs` | مستثمر مع حركات لاحقة → 0 (وليس initialCapital). | D-002 |
| **T-D-002** | `capitalAtTs_returnsInitialCapitalWhenNoMovements` | مستثمر بلا حركات → initialCapital. | D-002 |
| **T-D-003** | `capitalAtTs_reinvestProfitAddsToCapital` | `reinvest_profit` يُضاف كموجب. | D-001, D-002 |
| **T-D-004** | `eligibleInvestors_excludesEntryAfterSellTs` | مستثمر دخل بعد البيع لا يأخذ حصة. | D-005 |
| **T-D-005** | `distributeProportionally_negativeTotalSumsExactlyToTotal` | توزيع -1000 بأوزان متفاوتة → sum = -1000 بالضبط. | D-007 |
| **T-D-006** | `managerFee_onLossOfMinusThousandAt20Percent_managerBears200` | يُثبّت السلوك (أ) — Q1 الحالي. | D-007 |
| **T-D-007** | `unallocatedProfit_accumulatesPreInvestorSells` | بيعات قبل وجود مستثمرين → unallocatedProfit. | D-006 |
| **T-D-008** | `unallocatedProfit_doesNotRedistributeAfterInvestorJoins` | يُثبّت السلوك الحالي (لا إعادة توزيع). | D-006 |
| **T-D-009** | `availableProfit_subtractsBothWithdrawnAndReinvested` | `availableProfit = totalProfit - withdrawn - reinvested`. | D-012 |
| **T-D-010** | `availableProfitNegative_warningTriggersAtMinus0_01` | عتبة `-0.01`. | D-013 |
| **T-D-011** | `withdrawalsExceedDerivedProfit_warningTriggersAt0_01Above` | عتبة `+0.01`. | D-014 |
| **T-D-012** | `negativeDerivedProfit_warningPerEligibleInvestor` | كل مستثمر مؤهل يحصل على تحذير. | D-008 |
| **T-D-013** | `uncostedQuantitySold_severityHighWhenOversell` | شدّة عالية عند الجمع. | D-009 |
| **T-D-014** | `reconciliationDifference_alwaysZeroAfterDistribution` | sum = managerShare + investorShare للبيعات الموزَّعة. | D-015 |
| **T-D-015** | `toMs_invalidEntryDateFallsBackToZero` | يُثبّت السلوك الحالي + يكشف خطر الأهلية الكاملة. | D-016 |
| **T-D-016** | `eligibleInvestors_zeroCapitalIsExcluded` | مستثمر بـ cap=0 لا يأخذ حصة. | D-005 |
| **T-D-017** | `eligibleInvestors_negativeCapitalClampedToZero` | `Math.max(0, capitalAtTs)`. | D-005 |
| **T-D-018** | `chronologicalSells_excludesZeroDerivedProfit` | يُثبّت السلوك الحالي + Q10. | D-003 |

> **اختبارات T-D-006، T-D-008، T-D-015، T-D-018 توثّق سلوكيات تنتظر إجابات Q1، Q9، Q10 قبل القرار النهائي.**

## 🆕 الموصى بإضافتها للقسم E (التقارير والتحليلات) — أعلى أولوية

| المعرّف | اسم الاختبار المقترح (camelCase) | الهدف | يغطّي |
|---------|-----------------------------------|--------|--------|
| **T-E-001** | `useReportExports_doesNotPassProfitByTxIdToBuildMonthly` | يُثبّت السلوك الحالي (الانتهاك) — للقرار الواعي قبل الإصلاح. | E-X |
| **T-E-002** | `useReportExports_doesNotPassPamLedgerToBuildMonthly` | نفس E-X لكن لـ `pamLedger`. | E-X |
| **T-E-003** | `getRealizedProfit_fallsBackToTxProfitWhenProfitByTxIdIsUndefined` | يُثبّت السقوط على `tx.profit` (الانتهاك). | E-007 |
| **T-E-004** | `getRealizedProfit_usesDerivedProfitWhenProfitByTxIdIsProvided` | السلوك المرغوب بعد الإصلاح. | E-007 |
| **T-E-005** | `monthlyPdfReport_jGd0Hug9_showsDerivedNotStored` | اختبار end-to-end للحالة الحرجة الموثّقة. | E-X + E-007 |
| **T-E-006** | `monthlyPdfReport_uncostedWarningsSection_appearsWhenPamLedgerProvided` | يكشف غياب القسم حاليًا (E-012). | E-012 |
| **T-E-007** | `useAnalyticsViewModel_realizedProfit_excludesTxProfit` | يُثبّت أن `useAnalyticsViewModel` لا يستخدم `tx.profit` — حماية ضد الانحدار. | E-002 |
| **T-E-008** | `useAnalyticsViewModel_heatmap_aggregatesByDayUsingDerivedProfit` | تجميع يومي صحيح. | E-003 |
| **T-E-009** | `monthlyClientRanking_pdfVsAnalytics_consistencyAfterFix` | تطابق بين الشاشتين بعد إصلاح E-X (يفشل حاليًا). | E-005, E-010 |
| **T-E-010** | `globalNetProfit_addsUsdtAndEurTotalsAsDzd` | يُثبّت أن الجمع بالـ DZD صحيح (نقطة الخطر #5). | E-008 |
| **T-E-011** | `simSellResult_usesCurrentPamForSimulation` | محاكاة البيع تستخدم PAM الحالي (مشروعة). | E-004 |
| **T-E-012** | `linkedClientResolution_primaryWinsOverSecondary` | منطق `txClientMap` ثلاثي الأولوية. | E-006 |
| **T-E-013** | `clientPdfReport_doesNotUseGetRealizedProfit` | يُثبّت أن تقرير العميل آمن من E-007. | E-013 |
| **T-E-014** | `investorPdfReport_usesDerivedTotalProfit` | يُثبّت أن تقرير المستثمر سليم. | E-014 |

> **اختبار T-E-001 إلى T-E-006 يجب كتابتها قبل أي إصلاح لـ E-X لتأكيد الفهم، ثم تتحول إلى regression tests بعد الإصلاح.**

---

## 📋 ملخّص اختبارات Regression الكلي

| القسم | اختبارات موجودة | اختبارات مقترحة جديدة | إجمالي |
|-------|------------------|--------------------------|---------|
| A | 7 | 12 (T-A-001 → T-A-012) | 19 |
| B | 0 | 15 (T-B-001 → T-B-015) | 15 |
| C | 0 | 16 (T-C-001 → T-C-016) | 16 |
| D | 1 (`investorEconomics.pamLedger.test.ts:79`) | 18 (T-D-001 → T-D-018) | 19 |
| E | 0 | 14 (T-E-001 → T-E-014) | 14 |
| **الإجمالي** | **8** | **75** | **83** |

> سيُستخدم هذا القسم مع `prodigital-tester` skill عند بدء كتابة الاختبارات.

---

## ✅ نهاية التدقيق

**التاريخ:** 2026-05-08.
**الحالة:** التدقيق الفني (الأقسام A-E) + الإجابات الموثَّقة على نقاط الخطر العشر (F) + الإحصائيات (G) + اختبارات Regression (H) **مكتمل**.

**الملفات المُنتَجة:**
- `MATH_AUDIT_REPORT.md` (هذا الملف — جذر المشروع).
- `C:\Users\User\.claude\plans\curried-weaving-anchor.md` (خطة التدقيق الأصلية).

**لم يُعدَّل أي ملف كود في هذا التدقيق** — تطبيقًا للقيد الصارم في طلب المالك.

**الخطوة التالية (تنتظر قرار المالك):**
1. الإجابة على Q1 → Q10 لتثبيت الأحكام النهائية.
2. تفويض البدء في الإصلاحات حسب أولوية "أخطر 5 مشاكل".
3. كتابة اختبارات Regression المقترحة عبر `prodigital-tester` skill.

## ⏸️ نهاية القسم A

> **الالتزام الصريح بطلب المالك:** "ابدأ بالقسم A (PAM)، ثم انتظر موافقتي قبل الانتقال للقسم التالي."

**القسم B (العملاء والديون بالدينار) جاهز للبدء فور موافقتك.**

### تنفيذ التعديلات الخمسة (تأكيد)

| التعديل | الحالة |
|---------|---------|
| **#1** قراءة `utils/money.ts` كأول خطوة وتحديد آلية الدقّة | ✅ مُطبَّق — قسم "منهجية الدقّة العددية" |
| **#2** بند E-X في الهيكل لفحص `useReportExports.ts` تمرير `profitByTxId` | ✅ مُطبَّق — جدول الهيكل |
| **#3** نقاط الخطر 7 و 8 من ✅ إلى 🔍 | ✅ مُطبَّق — جدول نقاط الخطر العشر |
| **#4** Q1 بمثال رقمي (-1000 DZD، 20%) لـ H3 | ✅ مُطبَّق — قسم الأسئلة المفتوحة |
| **#5** قسم اختبارات Regression في النهاية | ✅ مُطبَّق — القسم H أعلاه |
