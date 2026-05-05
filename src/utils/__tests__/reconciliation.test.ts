import { describe, it, expect } from 'vitest';
import { runReconciliation, type ReconciliationInput } from '../reconciliation';

function makeInput(overrides: Partial<ReconciliationInput> = {}): ReconciliationInput {
    return {
        transactions: [],
        clientIds: [],
        clientTransactions: [],
        investors: [],
        investorTransactions: [],
        sellTransactions: [],
        managerFeePercentage: 20,
        treasuryTransactions: [],
        ...overrides,
    };
}

describe('runReconciliation', () => {
    it('returns clean result when no data', () => {
        const result = runReconciliation(makeInput());
        expect(result.summary.total).toBe(0);
        expect(result.summary.errors).toBe(0);
    });

    it('detects negative USDT available', () => {
        const result = runReconciliation(makeInput({
            transactions: [
                { type: 'sell', currency: 'USDT', quantity: 50, sell: 200 },
            ],
        }));
        const issue = result.issues.find(i => i.description.includes('USDT available quantity is negative'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('error');
    });

    it('detects orphan client transactions', () => {
        const result = runReconciliation(makeInput({
            clientIds: ['c1'],
            clientTransactions: [
                { clientId: 'c1', montant: 100 },
                { clientId: 'c99', montant: -50 }, // orphan
            ],
        }));
        const issue = result.issues.find(i => i.description.includes('non-existent'));
        expect(issue).toBeDefined();
    });

    it('detects negative investor available profit', () => {
        const baseDate = '2024-01-01T00:00:00Z';
        const laterDate = '2024-06-01T00:00:00Z';

        const result = runReconciliation(makeInput({
            investors: [
                { id: 'inv1', entryDate: baseDate, capitalInvested: 100000, initialCapital: 100000, isActive: true },
            ],
            investorTransactions: [
                { investorId: 'inv1', type: 'deposit_capital', amount: 100000, timestamp: new Date(baseDate).getTime() },
                { investorId: 'inv1', type: 'withdraw_profit', amount: 5000, timestamp: new Date('2024-08-01').getTime() },
            ],
            sellTransactions: [
                { profit: 1000, timestamp: new Date(laterDate).getTime() },
            ],
        }));

        // With 20% fee, distributable = 800, withdrawn = 5000 → available = -4200
        const issue = result.issues.find(i => i.description.includes('negative available profit'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('error');
    });

    it('detects negative treasury balance', () => {
        const result = runReconciliation(makeInput({
            treasuryTransactions: [
                { type: 'Retrait', source: 'Caisse', amount: 50000 },
            ],
        }));
        const issue = result.issues.find(i => i.description.includes('Caisse balance is negative'));
        expect(issue).toBeDefined();
    });

    it('passes clean data without issues', () => {
        const result = runReconciliation(makeInput({
            transactions: [
                { type: 'buy', currency: 'USDT', quantity: 100, total: 20000 },
                { type: 'sell', currency: 'USDT', quantity: 50, sell: 210, profit: 500 },
            ],
            clientIds: ['c1'],
            clientTransactions: [{ clientId: 'c1', montant: -10000 }],
            treasuryTransactions: [
                { type: 'Ajout', source: 'Caisse', amount: 100000 },
                { type: 'Retrait', source: 'Caisse', amount: 20000 },
            ],
        }));
        expect(result.summary.errors).toBe(0);
    });
});
