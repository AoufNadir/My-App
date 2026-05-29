# ACCOUNTING AUDIT REPORT
**Date:** 2026-05-29  
**Project:** My-App — Fintech PWA (USDT/EUR/DZD)  
**Scope:** Complete audit of all financial calculation chains

---

## 1. FILES AUDITED

| File | Role |
|---|---|
| `src/utils/capitalSnapshot.ts` | Core Capital Total / Capital réel formula |
| `src/hooks/useInvestorEconomics.ts` | Investor profit distribution engine |
| `src/hooks/useAppData.ts` | Portfolio stats, treasury stats, client balances |
| `src/utils/pamLedger.ts` | PAM cost basis + derived profit per sell |
| `src/utils/money.ts` | Integer-cent arithmetic (safe, no float drift) |
| `src/hooks/useInvestorHandlers.ts` | All investor transaction write operations |
| `src/components/main/MainInvestorDialogs.tsx` | UI for investor transactions |
| `src/MainApp.tsx` | Wires all calculations to UI |
| `src/pages/DashboardPage.tsx` | Displays capital snapshot |

---

## 2. CURRENT FORMULAS (as implemented)

### 2.1 Capital Total
**File:** `src/utils/capitalSnapshot.ts:30`
```
Capital Total = (Caisse + BaridiMob)
              + (USDT.available × USDT.avgBuy + EUR.available × EUR.avgBuy)  ← portfolioValue
              + SUM(treasury_cards.value)
              + (|totalDettes| - totalAvances)   ← netClientPosition
              + (amountToReceive_services - clientAdvances_services)  ← servicesImpact
```

### 2.2 Capital réel (netOwnedCapital)
**File:** `src/utils/capitalSnapshot.ts:36`
```
Capital réel = Capital Total - investorLiability
```

### 2.3 Engagements investisseurs (investorLiability)
**File:** `src/utils/capitalSnapshot.ts:12-21`
```
investorLiability = SUM over non-manager investors:
    max(0, capitalInvested) + max(0, availableProfit)
```
Note: Manager is excluded. Both capital AND undistributed profit count as liability.

### 2.4 Solde Caisse / BaridiMob
**File:** `src/hooks/useAppData.ts:297-354`
```
FOR each treasury_tx:
  IF type == 'Transfer': source -= amount; destination += amount
  IF type == 'Ajout' or 'Adjustment (+)': source += amount
  IF type == 'Retrait' or 'Adjustment (-)': source -= amount
```

### 2.5 Portfolio Value (Stock crypto)
**File:** `src/hooks/useAppData.ts:213-296`
```
portfolioValue = USDT.available × USDT.avgBuy + EUR.available × EUR.avgBuy
avgBuy = costBasis / purchasedQty  (weighted average, FIFO-ish)
```

### 2.6 Derived Profit (PAM Ledger)
**File:** `src/utils/pamLedger.ts:255-257`
```
derivedProfit = (effectiveSellPrice - avgBuy) × quantity
```

### 2.7 globalNetProfit (Dashboard)
**File:** `src/MainApp.tsx:431`
```
globalNetProfit = portfolioStats.usdt.totalProfit + portfolioStats.eur.totalProfit
```
Note: Uses SIMPLE calculation from `useAppData.ts`, NOT the PAM ledger.

### 2.8 Investor capitalInvested
**File:** `src/hooks/useInvestorEconomics.ts:90-113`
```
capitalInvested = SUM over movementTxs (deposit_capital + reinvest_profit - withdraw_capital)
  (if no movement transactions, fallback to investor.initialCapital)
```

### 2.9 Investor availableProfit
**File:** `src/hooks/useInvestorEconomics.ts:249-251`
```
availableProfit = derivedProfitShare - (withdrawnProfit + reinvestedProfit)
```

### 2.10 sharePercentage (Part du fonds)
**File:** `src/hooks/useInvestorEconomics.ts:246-247`
```
sharePercentage = capitalInvested / totalCurrentCapital
  where totalCurrentCapital = SUM of active investors' capitalInvested (investors pool only)
```

### 2.11 Services Capital Impact
**File:** `src/MainApp.tsx:511-530`
```
amountToReceive = SUM of asset-client balances < -0.005 (absolute value)
clientAdvances   = SUM of asset-client balances > 0.005
netCapitalImpact = amountToReceive - clientAdvances
```

### 2.12 Delivery Expenses Impact on Profit
**File:** `src/hooks/useInvestorEconomics.ts:219-238`
```
FOR each delivery_expense treasury_tx:
  investorBurden = amount × (1 - managerFeeRatio)
  managerBurden  = amount - investorBurden
  Distributed proportionally by capital at time of expense
```

### 2.13 unallocatedProfit
**File:** `src/hooks/useInvestorEconomics.ts:170-174`
```
IF totalCapAtSell <= 0:   (no investor capital existed at time of sell)
    unallocatedProfit += derivedProfit
    (not attributed to manager, not distributed to investors)
```

---

## 3. AUDIT TABLE

| # | Financial Figure | Computed In | Current Formula | Status | Problem | Correct Formula | Severity |
|---|---|---|---|---|---|---|---|
| 1 | Capital Total | capitalSnapshot.ts | Cash + Portfolio + Cards + NetClients + Services | ✅ CORRECT | None | Same | — |
| 2 | Capital réel | capitalSnapshot.ts | Capital Total - investorLiability | ✅ CORRECT | None | Same | — |
| 3 | investorLiability | capitalSnapshot.ts | Σ(capitalInvested + availableProfit) non-managers | ✅ CORRECT | None | Same | — |
| 4 | Caisse / BaridiMob | useAppData.ts | Event-sourced sum of treasury_txs | ✅ CORRECT | None | Same | — |
| 5 | portfolioValue (Stock) | useAppData.ts | available × avgBuy | ✅ CORRECT | None | Same | — |
| 6 | **withdraw_capital** | useInvestorHandlers.ts | Only writes investor_tx, NO treasury Retrait | ❌ BUG | Capital réel increases incorrectly (investorLiability↓ but Capital Total unchanged) | Must create treasury `Retrait` just like `withdraw_profit` | **HIGH** |
| 7 | **globalNetProfit** | MainApp.tsx | portfolioStats.totalProfit (simple calc) | ⚠️ RISK | Diverges from PAM ledger derivedProfit in edge cases (EUR conversions, legacy, oversell) | Should use pamLedger.totals.derivedProfit for consistency | **MEDIUM** |
| 8 | **reinvest_profit** | useInvestorHandlers.ts | Records tx + ALSO directly updates investors.capitalInvested in Firestore | ⚠️ RISK | Redundant Firestore write. If buildInvestorsBase logic changes, double-count risk | Remove direct Firestore update; rely only on transaction history | **MEDIUM** |
| 9 | **sharePercentage** | useInvestorEconomics.ts | capitalInvested / Σ(investors pool) | ⚠️ UNDOC | Denominator is investors-pool only, not Capital Total. Undocumented assumption. | Document: "share of investor pool, not share of total project" | **MEDIUM** |
| 10 | **Services double-count** | MainApp.tsx + actifTransactions | netCapitalImpact from asset balances | ⚠️ RISK | If user ALSO records service payment in treasury_txs manually, it appears in both Capital Total (caisse) and servicesImpact | Document: do not double-log service payments in treasury_txs | **MEDIUM** |
| 11 | **Initial investor capital** | useInvestorHandlers.ts | Creates investor_tx but NO treasury Ajout | ⚠️ RISK | Historical: old deposit_capital records before 2026-05-29 fix also lack treasury tx → Capital Total understated for deposits made before fix | Migration needed for historical records | **MEDIUM** |
| 12 | unallocatedProfit | useInvestorEconomics.ts | Pre-investor profit suspended, never attributed | ✅ INTENTIONAL | Not attributed to manager; manager's dashboard may understate profit from early sells | Document clearly; consider UI annotation | **LOW** |
| 13 | Delivery expenses | useInvestorEconomics.ts | Proportional deduction from investor/manager profit | ✅ CORRECT | None | Same | — |
| 14 | clientBalances / totalDettes | useAppData.ts | Sum of dzd_client_txs.montant | ✅ CORRECT | None | Same | — |
| 15 | availableProfit | useInvestorEconomics.ts | derivedProfitShare - (withdrawn + reinvested) | ✅ CORRECT | None | Same | — |

---

## 4. DETAILED ANALYSIS OF ISSUES

### ISSUE #6 — withdraw_capital missing treasury transaction (HIGH)

**Current behavior:**
```
User clicks "Retrait Capital" for investor (amount = 20,000 DZD)
→ investor_transactions: { type: 'withdraw_capital', amount: 20000 } ✅
→ treasury_txs: NOTHING ❌
```

**Financial effect (incorrect):**
```
Before:
  Capital Total = 3,298,048  Caisse = 499,500
  investorLiability = 394,108  capitalInvested = 130,526
  Capital réel = 2,903,940

After withdraw_capital 20,000:
  Capital Total = 3,298,048  ← unchanged (WRONG, money left the project)
  investorLiability = 374,108  ← correctly decreased
  Capital réel = 2,923,940  ← INCREASED (WRONG)
```

**Correct behavior:**
```
After withdraw_capital 20,000 via Caisse:
  Caisse = 479,500  (decreased)
  Capital Total = 3,278,048  (decreased by 20,000)
  investorLiability = 374,108  (decreased by 20,000)
  Capital réel = 2,903,940  (UNCHANGED — correct)
```

**Fix required:**
- Add payment source selector (Caisse/BaridiMob) to withdraw_capital UI
- Create treasury `Retrait` transaction when `withdraw_capital` is executed
- Mirror the logic already implemented for `withdraw_profit`

---

### ISSUE #7 — Dual profit calculation systems (MEDIUM)

**System A:** `useAppData.ts portfolioStats.totalProfit`
- Simple loop: `(sellPrice - avgBuy) × removedQty`
- Used by: `globalNetProfit` displayed on Dashboard

**System B:** `pamLedger.ts derivedProfit` 
- Sophisticated: handles EUR conversions, oversell, legacy fallback, manual totals
- Used by: investor profit distribution in `useInvestorEconomics`

**Divergence risk:** If a sell has an EUR conversion or manual total override, System A and System B yield different profits. The manager sees one number on Dashboard, but investors are distributed a different amount.

**Recommendation:** Use `pamLedger.totals.derivedProfit` for `globalNetProfit` on Dashboard. The PAM ledger is already computed (`pamLedger` in MainApp), so this is a one-line change.

---

### ISSUE #8 — reinvest_profit redundant Firestore update (MEDIUM)

**Current code (`useInvestorHandlers.ts:593-595`):**
```typescript
batch.update(userDocRef.collection('investors').doc(investorId), {
    capitalInvested: investor.capitalInvested + amount,
    initialCapital: investor.capitalInvested + amount  // ← this field is the original deposit
});
```

**Problem:**
1. `initialCapital` is overwritten with the running total — this destroys the historical initial capital record.
2. `capitalInvested` on the investor document is ignored by `buildInvestorsBase` when `movementTxs.length > 0`, making this update redundant.
3. No double-count currently, but fragile.

**Fix required:**
- Remove the `batch.update` for `investors` document in `handleReinvestProfit`.
- The `reinvest_profit` transaction is sufficient for `buildInvestorsBase` to compute capital correctly.

---

### ISSUE #9 — sharePercentage undocumented denominator (MEDIUM)

**Current formula:**
```
sharePercentage = investor.capitalInvested / Σ(all active investors' capitalInvested)
```
This is "investor's share of the investors' pool" — NOT "investor's share of total project capital."

**Example:**
- Investor A capital = 130,526
- Total investors pool = 394,108
- Capital Total = 3,318,048
- sharePercentage = 130,526 / 394,108 = **33.12%** (of investors pool)
- BUT: 130,526 / 3,318,048 = **3.93%** (of total project capital)

Both numbers have legitimate uses:
- For profit distribution → use investors pool denominator ✅ (already correct)
- For "what % of the whole project do I own" → use Capital Total denominator

**Fix required:** Add a code comment and UI tooltip explaining that `sharePercentage` = share of investors' pool. Optionally add a second field `shareOfCapitalTotal`.

---

### ISSUE #11 — Historical deposit_capital records missing treasury tx (MEDIUM)

All `deposit_capital` investor transactions recorded **before 2026-05-29** lack a corresponding `treasury_txs` record. This means:
- Historical Capital Total is understated by the sum of all pre-fix investor deposits
- This affects any user who had existing investor capital before the fix

**Impact:** 
```
IF users had total investor deposits = X DZD before the fix:
  Current Capital Total is understated by X DZD
  Current Capital réel is correct (both sides understate equally)
  investorLiability is correct (computed from investor_transactions directly)
```

**Migration recommendation:**
For each historical `deposit_capital` investor_tx without a `linkedTreasuryTxId`:
- Create a corresponding `treasury_txs` document with `origin: 'investor_capital_deposit'`
- Set `paymentSource` based on best available info (default to 'Caisse' if unknown)
- Link them via `linkedTreasuryTxId`

**This migration requires an owner decision** on which wallet (Caisse/BaridiMob) each historical deposit went into.

---

## 5. IMMUTABLE RULES CONFIRMED ✅

These formulas are correct and should NOT be changed:

- `Capital réel = Capital Total - investorLiability` ✅
- `investorLiability` excludes the manager ✅
- Delivery expenses deducted from investor profit proportionally ✅
- `availableProfit = derivedProfitShare - (withdrawn + reinvested)` ✅
- `clientBalance = Σ(dzd_client_txs.montant)` ✅  
- Treasury event-sourcing (no denormalized balance field) ✅
- Integer-cent arithmetic in `money.ts` (no float drift) ✅
- `distributeProportionally` uses largest-remainder for exact sum ✅

---

## 6. DECISIONS REQUIRED FROM PROJECT OWNER

1. **Historical migration**: For pre-2026-05-29 `deposit_capital` records, which wallet (Caisse/BaridiMob) should be assumed? Or should we flag them with `paymentSource: 'unknown'` and handle them separately?

2. **globalNetProfit**: Should the Dashboard "Profit total" number match the PAM ledger (System B) or keep the simple calculation (System A)? Recommendation: use System B for consistency with investor distributions.

3. **sharePercentage meaning**: Should "Part du fonds" show % of investors pool (current) or % of total project capital? Or both?

4. **Services cash flow**: When a service payment is received via `actifTransactions`, should it automatically create a treasury `Ajout` entry? Or is manual recording the intended workflow?

5. **Manager unallocatedProfit**: Pre-investor profits are suspended in `unallocatedProfit`. Should these eventually be attributed to the manager or remain suspended forever?
