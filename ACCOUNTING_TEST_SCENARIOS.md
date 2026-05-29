# ACCOUNTING TEST SCENARIOS
**Date:** 2026-05-29  
**Purpose:** Manual verification scenarios for all financial operations

---

## BASELINE STATE (for all tests)
```
Caisse          = 499,500 DZD
BaridiMob       = 50,000  DZD
Portfolio       = 250,000 DZD  (e.g. 100 USDT × 2,500 DZD/USDT)
Treasury Cards  = 0
totalDettes     = 50,000  DZD  (clients owe you)
totalAvances    = 10,000  DZD  (you owe clients)
netClientPos    = +40,000 DZD
Services Impact = 0

Capital Total        = 499,500 + 50,000 + 250,000 + 40,000 = 839,500
investorLiability    = 130,526 (Investor A capitalInvested) + 5,000 (Investor A availableProfit)
                     = 135,526
Capital réel         = 839,500 - 135,526 = 703,974
```

---

## SCENARIO 1 — Investor capital deposit (Nouvel apport)

**Action:** Add 20,000 DZD to Investor A via Caisse

**Expected after:**
```
Caisse          = 519,500  (+20,000) ✓
Capital Total   = 859,500  (+20,000) ✓
investorLiability = 155,526 (+20,000) ✓
Capital réel    = 703,974  (UNCHANGED) ✓
```

**Failure indicator:** If Capital réel = 683,974, the treasury Ajout was not created.

**Firestore writes expected:**
- `investor_transactions`: { type: 'deposit_capital', amount: 20000, paymentSource: 'Caisse', linkedTreasuryTxId: X }
- `treasury_txs`: { type: 'Ajout', source: 'Caisse', amount: 20000, origin: 'investor_capital_deposit', linkedInvestorTxId: Y }

---

## SCENARIO 2 — Investor capital withdrawal (Retrait capital)

**Action:** Withdraw 10,000 DZD from Investor A via Caisse

**Expected after:**
```
Caisse          = 489,500  (-10,000) ✓
Capital Total   = 829,500  (-10,000) ✓
investorLiability = 125,526 (-10,000) ✓
Capital réel    = 703,974  (UNCHANGED) ✓
```

**Failure indicator:** If Capital réel = 713,974, the treasury Retrait was not created.

**Firestore writes expected:**
- `investor_transactions`: { type: 'withdraw_capital', amount: 10000, paymentSource: 'Caisse', linkedTreasuryTxId: X }
- `treasury_txs`: { type: 'Retrait', source: 'Caisse', amount: 10000, origin: 'investor_capital_withdrawal', linkedInvestorTxId: Y }

---

## SCENARIO 3 — Investor profit withdrawal (Retrait profit)

**Action:** Withdraw 5,000 DZD profit to Investor A via Caisse

**Expected after:**
```
Caisse          = 494,500  (-5,000) ✓
Capital Total   = 834,500  (-5,000) ✓
investorLiability = 130,526 (-5,000) ✓  (availableProfit: 5000 → 0)
Capital réel    = 703,974  (UNCHANGED) ✓
```

**Failure indicator:** If Capital réel changes, something is wrong.

---

## SCENARIO 4 — Profit reinvestment (Réinvestissement)

**Action:** Investor A reinvests 3,000 DZD profit into capital

**Expected after:**
```
Caisse          = 499,500  (UNCHANGED — no cash movement) ✓
Capital Total   = 839,500  (UNCHANGED) ✓
Investor A capitalInvested = 133,526 (+3,000) ✓
Investor A availableProfit = 2,000 (-3,000) ✓
investorLiability = 135,526 (UNCHANGED: +3000 capital, -3000 profit) ✓
Capital réel    = 703,974  (UNCHANGED) ✓
```

**Failure indicator:** If Capital réel changes, the reinvestment incorrectly affected cash.

**Firestore writes expected:**
- `investor_transactions`: { type: 'reinvest_profit', amount: 3000 }
- `investors` document: NOT updated directly (derived from transactions)

---

## SCENARIO 5 — Delivery expense

**Action:** Add delivery expense of 1,000 DZD from Caisse

**Expected after:**
```
Caisse          = 498,500  (-1,000) ✓
Capital Total   = 838,500  (-1,000) ✓
globalNetProfit = decreases (delivery expense reduces net profit) ✓
Investor A availableProfit = decreases by proportional share ✓
Capital réel    = 702,974  (-1,000) ✓
  (Capital réel decreases because profit decreases, which decreases investorLiability)
```

**Note:** Delivery expenses reduce the distributable profit pool, which reduces investorLiability and thus Capital réel. This is CORRECT — operating costs reduce net equity.

---

## SCENARIO 6 — Personal manager withdrawal (Dépense/Prélèvement personnel)

**Action:** Manager withdraws 2,000 DZD personally from Caisse (as expense, not advance)

**Expected after:**
```
Caisse          = 497,500  (-2,000) ✓
Capital Total   = 837,500  (-2,000) ✓
Manager availableProfit: decreases by 2,000 ✓
investorLiability: UNCHANGED (manager excluded from liability) ✓
Capital réel    = 701,974  (-2,000) ✓
  (decreases because manager's profit decreases, which is part of Capital réel)
```

**Key rule:** Does NOT affect investor availableProfit. Only the manager's share is reduced.

---

## SCENARIO 7 — Portfolio buy (Achat USDT/EUR)

**Action:** Buy 50 USDT at 2,500 DZD each → total = 125,000 DZD from Caisse

**Expected after:**
```
Caisse          = 374,500  (-125,000) ✓
Portfolio USDT  = 375,000  (+125,000: 150 USDT × 2,500 avgBuy) ✓
Capital Total   = 839,500  (UNCHANGED: cash → portfolio, no net change) ✓
Capital réel    = 703,974  (UNCHANGED) ✓
```

**Key rule:** Portfolio buy = asset conversion. Capital Total unchanged.

---

## SCENARIO 8 — Portfolio sell (Vente USDT/EUR)

**Action:** Sell 50 USDT at 2,700 DZD each → total = 135,000 DZD to Caisse
(avgBuy = 2,500 → profit = (2,700 - 2,500) × 50 = 10,000 DZD)

**Expected after:**
```
Caisse          = 634,500  (+135,000) ✓
Portfolio USDT  = 125,000  (-125,000: 50 USDT × 2,500 cost basis removed) ✓
Capital Total   = 849,500  (+10,000 realized profit) ✓
globalNetProfit = +10,000 ✓
investorLiability = increases by investor's share of 10,000 ✓
Capital réel    = increases by manager's share of 10,000 ✓
```

---

## SCENARIO 9 — Client debt transaction

**Action:** Client A owes 5,000 DZD (new sale on credit)

**Expected after:**
```
totalDettes     = 55,000  (+5,000) ✓
netClientPos    = +45,000 (+5,000) ✓
Capital Total   = 844,500  (+5,000) ✓
  (receivable = asset = increases Capital Total)
Capital réel    = 708,974  (+5,000) ✓
```

---

## SCENARIO 10 — Client debt payment received

**Action:** Client A pays 5,000 DZD of their debt → goes to Caisse

**Expected after:**
```
Caisse          = 504,500  (+5,000) ✓
totalDettes     = 45,000  (-5,000) ✓  (receivable decreases)
netClientPos    = +35,000 (-5,000) ✓
Capital Total   = 839,500  (UNCHANGED: receivable → cash, no net change) ✓
Capital réel    = 703,974  (UNCHANGED) ✓
```

**Key rule:** Debt collection = asset conversion (receivable → cash). No net change to Capital Total.

---

## SCENARIO 11 — Delete investor capital deposit

**Action:** Delete a 20,000 DZD deposit_capital transaction

**Expected after (reversal of Scenario 1):**
```
Caisse          = 499,500  (-20,000) ✓
Capital Total   = 839,500  (-20,000) ✓
investorLiability = 135,526 (-20,000) ✓
Capital réel    = 703,974  (UNCHANGED) ✓
```

**Firestore deletes expected:**
- Delete `investor_transactions` document
- Delete linked `treasury_txs` document (via linkedTreasuryTxId)

**Verified in code:** `handleDeleteInvestor` already cascades to delete linked treasury_txs via `linkedTreasuryTxId`. ✅
Individual tx delete should do the same.

---

## SCENARIO 12 — sharePercentage (Part du fonds) verification

**Setup:**
```
Investor A capitalInvested = 130,526
Investor B capitalInvested = 100,000
Total investors pool = 230,526
Capital Total = 839,500
```

**Expected sharePercentage:**
```
Investor A: 130,526 / 230,526 = 56.62%  (share of investors pool)
Investor B: 100,000 / 230,526 = 43.38%  (share of investors pool)
Sum = 100% ✓
```

**NOT:**
```
130,526 / 839,500 = 15.55% (would be share of total project — different metric)
```

**The displayed "Part du fonds" represents: investor's share of the collective investor pool, not of the entire project.**

---

## SCENARIO 13 — globalNetProfit vs investor distribution consistency

**Action:** Sell 10 USDT at 3,000 DZD (avgBuy = 2,500) → profit = 5,000 DZD

**Expected:**
```
globalNetProfit (Dashboard)    = 5,000 DZD (PAM ledger derivedProfit)
investorEconomics.derivedProfit = 5,000 DZD (same source)
→ CONSISTENT ✓
```

**If using old formula (portfolioStats.totalProfit):**
```
In EUR conversion edge cases: could differ by hundreds/thousands DZD
→ INCONSISTENT ✗ (fixed by Issue #7 fix)
```

---

## DECISIONS PENDING FROM PROJECT OWNER

### D1 — Historical deposit_capital without treasury tx
Pre-2026-05-29 `deposit_capital` investor transactions have no linked `treasury_txs` record.

**Options:**
1. **Accept as-is** — Capital Total was understated before. Going forward it's correct. No migration.
2. **Migrate** — For each old deposit_capital without `linkedTreasuryTxId`, create a treasury `Ajout`. Need to decide which wallet (Caisse by default).
3. **Flag only** — Add a UI indicator showing "historical deposit, wallet unknown."

**Impact of not migrating:** Capital Total is understated by the historical sum of investor deposits. Capital réel is CORRECT (both sides understate equally). investorLiability is CORRECT.

### D2 — Services cash flow
When a service payment is received in `actifTransactions`, the cash is tracked in `assetClientBalances` but NOT automatically added to `treasury_txs`.

**Question:** Should the app automatically create a `treasury_txs Ajout` when a service payment_received is logged?

**Risk if not:** User must manually also log it in treasury. If they forget, Caisse is understated.

### D3 — Manager unallocatedProfit
Profits from sells made before any investor joined are in `unallocatedProfit`. They don't appear in the manager's available profit in the current system.

**Question:** Should `unallocatedProfit` be attributed to the manager?
