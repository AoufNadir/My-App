# Financial Logic Documentation

## Overview
This document describes the financial and accounting logic used in the application.
It serves as a reference for auditing, testing, and maintaining the system.

## Accounting Conventions

### Client Balance Sign Convention
- `montant > 0` → Credit (advance from client, client has funds with us)
- `montant < 0` → Debit (client owes us, debt)
- Balance > 0 → Client has advance/credit with us
- Balance < 0 → Client has outstanding debt

### Transaction Types

#### Portfolio Transactions (`usdt_txs`)
| Type | Effect on Available | Effect on Cost Basis | Effect on Profit |
|------|--------------------|--------------------|-----------------|
| `buy` | +quantity | +total | None |
| `sell` | -quantity | -removedQty×avgBuy | +(sell-avgBuy)×qty |
| `Ajout Manuel` | +quantity | +total (if total>0) | None |
| `Retrait Manuel` | -quantity | -removedQty×avgBuy | None |

#### Client Transactions (`dzd_client_txs`)
| Type | montant Sign | Description |
|------|-------------|-------------|
| `Règlement Reçu` | + | Payment received from client |
| `Paiement Effectué` | - | Payment made to client |
| `Vente USDT` | - | USDT sold to client (client owes) |
| `Vente EUR` | - | EUR sold to client |
| `Achat EUR` | + | EUR bought from client |
| `Solde Initial` | ± | Initial balance |
| `Transfert Entrant` | - | Transfer received (reduces debt) |
| `Transfert Sortant` | + | Transfer sent (credit) |
| `Ajustement Solde` | ± | Manual balance adjustment |

#### Treasury Transactions (`treasury_txs`)
| Type | Effect |
|------|--------|
| `Ajout` | +amount to source wallet |
| `Retrait` | -amount from source wallet |
| `Transfer` | -amount from source, +amount to destination |
| `Adjustment (+)` | +amount to source wallet |
| `Adjustment (-)` | -amount from source wallet |

### PAM (Prix d'Achat Moyen / Weighted Average Cost)
The system uses a running weighted average cost method:
- On purchase: `costBasis += total`, `purchasedQty += quantity`
- On sale: `avgBuy = costBasis / purchasedQty`, then reduce both proportionally
- When stock reaches zero: both reset to 0
- New purchases after zero start a fresh PAM

### Investor Profit Distribution
1. For each USDT sell transaction (chronologically):
   a. Calculate distributable profit: `sellProfit × (1 - managerFeeRatio)`
   b. Find eligible investors (entry date ≤ sell timestamp)
   c. Calculate each investor's capital at that moment
   d. Distribute proportionally by capital share
2. Manager fee is deducted before distribution
3. Available profit = totalEarned - withdrawnProfit - reinvestedProfit

### Currency Conversion (EUR → USDT)
```
usdtQty = eurQty / eurUsdtRate
usdtPriceDzd = eurDzdPrice × eurUsdtRate
totalCostDzd = usdtQty × usdtPriceDzd = eurQty × eurDzdPrice
```
Where `eurUsdtRate` = number of EUR per 1 USDT.

## Key Files

| File | Purpose |
|------|---------|
| `hooks/useAppData.ts` | Portfolio stats (PAM), treasury stats, client balances |
| `hooks/useTransactionHandlers.ts` | Buy/sell/adjustment operations |
| `hooks/useClientHandlers.ts` | Client CRUD and transaction operations |
| `hooks/useInvestorHandlers.ts` | Investor CRUD and transaction operations |
| `hooks/useOverdueDebtClients.ts` | FIFO debt aging calculation |
| `transactionService.ts` | Cascade delete/update of linked transactions |
| `utils/pdfReports.ts` | PDF report generation |
| `components/analytics/useAnalyticsViewModel.ts` | Monthly analytics |
| `MainApp.tsx` | Investor profit distribution (primary logic) |
| `types.ts` | All data type definitions |

## Known Limitations
1. `tx.profit` stored at sell time may diverge from dynamically computed profit after historical edits
2. EUR sell profit is not tracked in portfolioStats
3. No largest-remainder distribution for investor profits (floating-point rounding)
