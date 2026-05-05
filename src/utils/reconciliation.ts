/**
 * Reconciliation utilities – runtime consistency checks that can be
 * executed against live data to detect divergence between related
 * financial quantities.
 *
 * These are designed to be called from a developer console or a future
 * admin page. They return structured results without side-effects.
 */

import {
    computePortfolioStats,
    computeClientBalances,
    computeInvestorProfits,
    type TxRecord,
    type ClientTxRecord,
    type InvestorRecord,
    type InvestorTxRecord,
    type SellTxRecord,
    type DerivedInvestorResult,
} from './financialCalculations';

// ─── Types ───────────────────────────────────────────────────────────

export interface ReconciliationIssue {
    category: 'portfolio' | 'client' | 'investor' | 'treasury';
    severity: 'error' | 'warning' | 'info';
    description: string;
    details?: Record<string, unknown>;
}

export interface ReconciliationResult {
    timestamp: number;
    issues: ReconciliationIssue[];
    summary: {
        total: number;
        errors: number;
        warnings: number;
    };
}

// ─── Portfolio checks ────────────────────────────────────────────────

function checkPortfolio(transactions: TxRecord[]): ReconciliationIssue[] {
    const issues: ReconciliationIssue[] = [];
    const stats = computePortfolioStats(transactions);

    // 1. Negative available quantity
    if (stats.usdt.available < 0) {
        issues.push({
            category: 'portfolio',
            severity: 'error',
            description: `USDT available quantity is negative (${stats.usdt.available})`,
            details: { available: stats.usdt.available },
        });
    }
    if (stats.eur.available < 0) {
        issues.push({
            category: 'portfolio',
            severity: 'error',
            description: `EUR available quantity is negative (${stats.eur.available})`,
            details: { available: stats.eur.available },
        });
    }

    // 2. Cost basis without quantity or vice-versa
    if (stats.usdt.costBasis > 0 && stats.usdt.purchasedQty === 0) {
        issues.push({
            category: 'portfolio',
            severity: 'warning',
            description: 'USDT has positive cost basis but zero purchased quantity',
            details: { costBasis: stats.usdt.costBasis, purchasedQty: stats.usdt.purchasedQty },
        });
    }
    if (stats.eur.costBasis > 0 && stats.eur.purchasedQty === 0) {
        issues.push({
            category: 'portfolio',
            severity: 'warning',
            description: 'EUR has positive cost basis but zero purchased quantity',
            details: { costBasis: stats.eur.costBasis, purchasedQty: stats.eur.purchasedQty },
        });
    }

    // 3. Check stored profit vs recalculated
    const sellTxsWithProfit = transactions.filter(
        tx => tx.type === 'sell' && tx.profit !== undefined
    );
    let storedProfitSum = 0;
    for (const tx of sellTxsWithProfit) {
        storedProfitSum += Number(tx.profit || 0);
    }

    const recalculated = stats.usdt.totalProfit + stats.eur.totalProfit;
    const divergence = Math.abs(storedProfitSum - recalculated);
    if (divergence > 0.1) {
        issues.push({
            category: 'portfolio',
            severity: 'warning',
            description: `Stored profit sum (${storedProfitSum.toFixed(2)}) diverges from recalculated (${recalculated.toFixed(2)}) by ${divergence.toFixed(2)}`,
            details: { storedProfitSum, recalculated, divergence },
        });
    }

    return issues;
}

// ─── Client checks ───────────────────────────────────────────────────

function checkClientBalances(
    clientIds: string[],
    clientTransactions: ClientTxRecord[]
): ReconciliationIssue[] {
    const issues: ReconciliationIssue[] = [];
    const balances = computeClientBalances(clientIds, clientTransactions);

    // Check for orphan transactions (client not in master list)
    const orphanClientIds = new Set<string>();
    for (const tx of clientTransactions) {
        if (!clientIds.includes(tx.clientId)) {
            orphanClientIds.add(tx.clientId);
        }
    }
    if (orphanClientIds.size > 0) {
        issues.push({
            category: 'client',
            severity: 'warning',
            description: `${orphanClientIds.size} transaction(s) reference non-existent client(s)`,
            details: { orphanClientIds: [...orphanClientIds] },
        });
    }

    return issues;
}

// ─── Investor checks ────────────────────────────────────────────────

function checkInvestorProfits(
    investors: InvestorRecord[],
    investorTransactions: InvestorTxRecord[],
    sellTransactions: SellTxRecord[],
    managerFeePercentage: number
): ReconciliationIssue[] {
    const issues: ReconciliationIssue[] = [];
    const results = computeInvestorProfits(
        investors, investorTransactions, sellTransactions, managerFeePercentage
    );

    // 1. Negative available profit
    for (const inv of results) {
        if (inv.availableProfit < -0.01) {
            issues.push({
                category: 'investor',
                severity: 'error',
                description: `Investor ${inv.id} has negative available profit (${inv.availableProfit.toFixed(2)})`,
                details: { investorId: inv.id, availableProfit: inv.availableProfit },
            });
        }
    }

    // 2. Total distributed exceeds global profit
    const totalDistributed = results.reduce((sum, r) => sum + r.totalProfit, 0);
    const totalSellProfit = sellTransactions.reduce((sum, tx) => sum + tx.profit, 0);
    const maxDistributable = totalSellProfit * (1 - managerFeePercentage / 100);

    if (totalDistributed > maxDistributable + 0.01) {
        issues.push({
            category: 'investor',
            severity: 'error',
            description: `Total distributed profit (${totalDistributed.toFixed(2)}) exceeds max distributable (${maxDistributable.toFixed(2)})`,
            details: { totalDistributed, maxDistributable, totalSellProfit },
        });
    }

    // 3. Share percentages sum > 1
    const totalShares = results.reduce((sum, r) => sum + r.sharePercentage, 0);
    if (totalShares > 1.001) {
        issues.push({
            category: 'investor',
            severity: 'error',
            description: `Total investor share percentages sum to ${(totalShares * 100).toFixed(2)}% (> 100%)`,
            details: { totalShares },
        });
    }

    return issues;
}

// ─── Treasury checks ────────────────────────────────────────────────

interface TreasuryTxRecord {
    type: string;
    source?: string;
    destination?: string;
    amount: number;
    linkedTxId?: string;
    origin?: string;
}

function checkTreasury(treasuryTransactions: TreasuryTxRecord[]): ReconciliationIssue[] {
    const issues: ReconciliationIssue[] = [];

    let caisse = 0;
    let baridi = 0;
    for (const tx of treasuryTransactions) {
        const amount = Number(tx.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        if (tx.type === 'Transfer') {
            if (tx.source === 'Caisse') caisse -= amount;
            if (tx.source === 'BaridiMob') baridi -= amount;
            if (tx.destination === 'Caisse') caisse += amount;
            if (tx.destination === 'BaridiMob') baridi += amount;
            continue;
        }

        let factor = 0;
        if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)') factor = 1;
        else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)') factor = -1;

        if (tx.source === 'Caisse') caisse += amount * factor;
        if (tx.source === 'BaridiMob') baridi += amount * factor;
    }

    if (caisse < -0.01) {
        issues.push({
            category: 'treasury',
            severity: 'error',
            description: `Caisse balance is negative (${caisse.toFixed(2)} DZD)`,
            details: { caisse },
        });
    }
    if (baridi < -0.01) {
        issues.push({
            category: 'treasury',
            severity: 'error',
            description: `BaridiMob balance is negative (${baridi.toFixed(2)} DZD)`,
            details: { baridi },
        });
    }

    // Check for orphan linked transactions (without origin)
    const withoutOrigin = treasuryTransactions.filter(tx => tx.linkedTxId && !tx.origin);
    if (withoutOrigin.length > 0) {
        issues.push({
            category: 'treasury',
            severity: 'info',
            description: `${withoutOrigin.length} linked treasury transaction(s) lack an 'origin' field`,
            details: { count: withoutOrigin.length },
        });
    }

    return issues;
}

// ─── Main entry point ────────────────────────────────────────────────

export interface ReconciliationInput {
    transactions: TxRecord[];
    clientIds: string[];
    clientTransactions: ClientTxRecord[];
    investors: InvestorRecord[];
    investorTransactions: InvestorTxRecord[];
    sellTransactions: SellTxRecord[];
    managerFeePercentage: number;
    treasuryTransactions: TreasuryTxRecord[];
}

export function runReconciliation(input: ReconciliationInput): ReconciliationResult {
    const issues: ReconciliationIssue[] = [
        ...checkPortfolio(input.transactions),
        ...checkClientBalances(input.clientIds, input.clientTransactions),
        ...checkInvestorProfits(
            input.investors,
            input.investorTransactions,
            input.sellTransactions,
            input.managerFeePercentage
        ),
        ...checkTreasury(input.treasuryTransactions),
    ];

    return {
        timestamp: Date.now(),
        issues,
        summary: {
            total: issues.length,
            errors: issues.filter(i => i.severity === 'error').length,
            warnings: issues.filter(i => i.severity === 'warning').length,
        },
    };
}
