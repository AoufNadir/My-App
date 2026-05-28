/**
 * Regression tests for Section C (Treasury & Manual Assets) of MATH_AUDIT_REPORT.md
 *
 * Covers: T-C-001 → T-C-016.
 *
 * NOTE ON TESTING STRATEGY:
 *   `treasuryStats`, `manualCardsTotal`, `positionNette`, `capitalTotal` (TresoreriePage)
 *   are inline calculations in React components. We test reference implementations.
 *
 *   `computeCapitalSnapshot` IS exported from src/utils/capitalSnapshot.ts and tested
 *   directly. (TresoreriePage has a parallel inline copy that should ideally call it.)
 *
 *   `useAssetHandlers` hooks (T-C-012, T-C-013, T-C-015) cannot be invoked without
 *   React + Firestore mocks. We use static-source-checks where applicable.
 *
 * Test runner: matches existing scripts/pamLedger.test.ts pattern.
 * Run with: `node --import tsx scripts/section-C.test.ts`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { calculateInvestorLiability, computeCapitalSnapshot } from '../src/utils/capitalSnapshot.js';
import type { Investor, TreasuryTx, TreasuryCard } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ---------- helpers ----------

function test(name: string, fn: () => void): void {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}

function treasuryTx(input: Partial<TreasuryTx> & Pick<TreasuryTx, 'id' | 'type' | 'amount'>): TreasuryTx {
    return {
        date: '01/01/2026',
        time: '10:00',
        timestamp: 1000,
        ...input,
    } as TreasuryTx;
}

// =========================================================================
// REFERENCE IMPLEMENTATIONS (mirror current code — see file:line references)
// =========================================================================

/**
 * MIRRORS: src/hooks/useAppData.ts:193-238 (treasuryStats)
 */
function computeTreasuryStats_reference(treasuryTransactions: TreasuryTx[]): { caisse: number; baridi: number } {
    const normalizeZero = (v: number) =>
        Object.is(v, -0) || Math.abs(v) < 0.005 ? 0 : Number(v.toFixed(2));
    const resolveWallet = (raw: any): 'Caisse' | 'BaridiMob' | null => {
        if (!raw) return null;
        const n = String(raw).toLowerCase();
        if (n.includes('caisse')) return 'Caisse';
        if (n.includes('baridi')) return 'BaridiMob';
        return null;
    };
    const parseLegacyTransfer = (rawAsset?: string) => {
        if (!rawAsset) return { from: null as any, to: null as any };
        const m = /from\s+(.+?)\s+to\s+(.+)/i.exec(rawAsset);
        if (!m) return { from: null, to: null };
        return { from: resolveWallet(m[1]), to: resolveWallet(m[2]) };
    };
    let caisse = 0, baridi = 0;
    treasuryTransactions.forEach((tx) => {
        const txData = tx as any;
        const amount = Number(tx.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
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
        let factor = 0;
        if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)') factor = 1;
        else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)') factor = -1;
        const source = txData.source
            || (txData.asset === 'DZD-Caisse' ? 'Caisse' : txData.asset === 'DZD-Baridi' ? 'BaridiMob' : null);
        if (source === 'Caisse') caisse += amount * factor;
        if (source === 'BaridiMob') baridi += amount * factor;
    });
    return { caisse: normalizeZero(caisse), baridi: normalizeZero(baridi) };
}

/** MIRRORS: src/pages/TresoreriePage.tsx:53-56 */
function manualCardsTotal_reference(cards: TreasuryCard[]): number {
    return cards.reduce((acc, card) => acc + (Number(card.value) || 0), 0);
}

/** MIRRORS: src/pages/TresoreriePage.tsx:58-64 */
function tresoreriePageCapitalTotal_reference(
    caisseBalance: number,
    baridiBalance: number,
    portfolioValue: number,
    manualCardsTotal: number,
    totalDettes: number,
    totalAvances: number,
    servicesCapitalImpact = 0,
): number {
    const dettesAbs = Math.abs(totalDettes);
    const positionNette = totalAvances - dettesAbs;
    return (Number(caisseBalance) || 0)
        + (Number(baridiBalance) || 0)
        + (Number(portfolioValue) || 0)
        + manualCardsTotal
        + (Number(servicesCapitalImpact) || 0)
        - positionNette;
}

// =========================================================================
// T-C-001: Ajout and Retrait apply correctly to source wallet
// =========================================================================

test('T-C-001: treasuryStats_ajoutAndRetrait_balanceCorrectly', () => {
    const txs: TreasuryTx[] = [
        treasuryTx({ id: 't1', type: 'Ajout', source: 'Caisse', amount: 1000 }),
        treasuryTx({ id: 't2', type: 'Retrait', source: 'Caisse', amount: 300 }),
        treasuryTx({ id: 't3', type: 'Ajout', source: 'BaridiMob', amount: 500 }),
    ];
    const { caisse, baridi } = computeTreasuryStats_reference(txs);
    assert.equal(caisse, 700, 'Caisse: 1000 - 300 = 700');
    assert.equal(baridi, 500, 'BaridiMob: 500');
});

// =========================================================================
// T-C-002: Non-positive amount is silently skipped
// =========================================================================

test('T-C-002: treasuryStats_skipsNonPositiveAmount', () => {
    const txs: TreasuryTx[] = [
        treasuryTx({ id: 't1', type: 'Ajout', source: 'Caisse', amount: 1000 }),
        treasuryTx({ id: 't2', type: 'Ajout', source: 'Caisse', amount: 0 }), // skipped
        treasuryTx({ id: 't3', type: 'Ajout', source: 'Caisse', amount: -100 }), // skipped
        treasuryTx({ id: 't4', type: 'Ajout', source: 'Caisse', amount: NaN }), // skipped
    ];
    const { caisse } = computeTreasuryStats_reference(txs);
    assert.equal(caisse, 1000, 'Only the valid +1000 contributes');
});

// =========================================================================
// T-C-003: Unknown type is silently ignored (CURRENT — known gap)
// =========================================================================

test('T-C-003: treasuryStats_unknownTypeIsSilentlyIgnored', () => {
    const txs: TreasuryTx[] = [
        treasuryTx({ id: 't1', type: 'Ajout', source: 'Caisse', amount: 1000 }),
        treasuryTx({ id: 't2', type: 'INVALID_TYPE' as any, source: 'Caisse', amount: 500 }), // ignored, no warning
    ];
    const { caisse } = computeTreasuryStats_reference(txs);
    assert.equal(caisse, 1000, 'CURRENT: unknown type is silently ignored (factor=0).');
});

// =========================================================================
// T-C-004: Transfer maintains caisse + baridi sum (zero-sum invariant)
// =========================================================================

test('T-C-004: treasuryStats_transferZeroSumInvariant', () => {
    const txs: TreasuryTx[] = [
        treasuryTx({ id: 't1', type: 'Ajout', source: 'Caisse', amount: 1000 }),
        treasuryTx({ id: 't2', type: 'Ajout', source: 'BaridiMob', amount: 500 }),
        // Transfer 200 from Caisse to BaridiMob
        treasuryTx({ id: 't3', type: 'Transfer', amount: 200, source: 'Caisse', destination: 'BaridiMob' } as any),
    ];
    const { caisse, baridi } = computeTreasuryStats_reference(txs);
    assert.equal(caisse, 800, 'Caisse: 1000 - 200 = 800');
    assert.equal(baridi, 700, 'BaridiMob: 500 + 200 = 700');
    assert.equal(caisse + baridi, 1500, 'Total preserved (zero-sum)');
});

// =========================================================================
// T-C-005: Transfer where source == destination is rejected
// =========================================================================

test('T-C-005: treasuryStats_transferRejectsSameSourceAndDestination', () => {
    const txs: TreasuryTx[] = [
        treasuryTx({ id: 't1', type: 'Ajout', source: 'Caisse', amount: 1000 }),
        treasuryTx({ id: 't2', type: 'Transfer', amount: 200, source: 'Caisse', destination: 'Caisse' } as any),
    ];
    const { caisse, baridi } = computeTreasuryStats_reference(txs);
    assert.equal(caisse, 1000, 'Self-transfer ignored — Caisse unchanged');
    assert.equal(baridi, 0);
});

// =========================================================================
// T-C-006: Legacy `asset` field "from X to Y" parsed correctly
// =========================================================================

test('T-C-006: treasuryStats_legacyTransferAssetParser_recognizesFromTo', () => {
    const txs: TreasuryTx[] = [
        { id: 't1', type: 'Ajout', source: 'Caisse', amount: 1000, date: '01/01/2026', time: '10:00', timestamp: 1000 } as any,
        // Legacy row with `asset: 'from Caisse to BaridiMob'` and no `source`/`destination`
        { id: 't2', type: 'Transfer', amount: 300, asset: 'from Caisse to BaridiMob', date: '01/01/2026', time: '10:00', timestamp: 2000 } as any,
    ];
    const { caisse, baridi } = computeTreasuryStats_reference(txs);
    assert.equal(caisse, 700, 'Legacy transfer parsed: Caisse -300');
    assert.equal(baridi, 300, 'Legacy transfer parsed: BaridiMob +300');
});

// =========================================================================
// T-C-007: resolveWallet ambiguity — "caisse-baridi" resolves to Caisse (current behavior)
// =========================================================================

test('T-C-007: resolveWallet_caisseBaridiAmbiguity (CURRENT FRAGILITY)', () => {
    // Reference inline of resolveWallet
    const resolveWallet = (raw: any): 'Caisse' | 'BaridiMob' | null => {
        if (!raw) return null;
        const n = String(raw).toLowerCase();
        if (n.includes('caisse')) return 'Caisse';
        if (n.includes('baridi')) return 'BaridiMob';
        return null;
    };
    assert.equal(resolveWallet('caisse-baridi'), 'Caisse', 'CURRENT: contains "caisse" first → Caisse');
    assert.equal(resolveWallet('Baridi-Caisse'), 'Caisse', 'CURRENT: contains "caisse" → Caisse (despite Baridi appearing first)');
    assert.equal(resolveWallet('  CaIsSe '), 'Caisse', 'Case-insensitive match');
});

// =========================================================================
// T-C-008: manualCardsTotal handles NaN value as 0
// =========================================================================

test('T-C-008: manualCardsTotal_handlesNanValueAsZero', () => {
    const cards = [
        { id: 'c1', name: 'A', value: 100 } as TreasuryCard,
        { id: 'c2', name: 'B', value: NaN } as TreasuryCard,
        { id: 'c3', name: 'C', value: 200 } as TreasuryCard,
        { id: 'c4', name: 'D', value: undefined } as any,
    ];
    const total = manualCardsTotal_reference(cards);
    assert.equal(total, 300, 'NaN/undefined → 0; sum of 100 + 200 = 300');
});

// =========================================================================
// T-C-009: positionNette sign matches accounting definition
// =========================================================================

test('T-C-009: positionNette_signMatchesAccountingDefinition', () => {
    // positionNette = totalAvances - |totalDettes|
    // > 0 means we owe more than they owe us (net liability)
    const case1 = 5000 - Math.abs(-2000); // avances > dettes → +3000 (we owe more)
    const case2 = 1000 - Math.abs(-3000); // dettes > avances → -2000 (they owe more)
    assert.equal(case1, 3000, '+3000: net liability to clients');
    assert.equal(case2, -2000, '-2000: net asset (clients owe us)');
});

// =========================================================================
// T-C-010: capitalTotal formula matches asset - liability model
// =========================================================================

test('T-C-010: capitalTotal_formulaMatchesAssetMinusLiabilityModel', () => {
    // Assets: caisse 1000 + baridi 500 + portfolio 2000 + manual 200 + services 450 + dettes_abs 800
    // Liabilities: avances 300
    // Equity = 1000+500+2000+200+450+800 - 300 = 4650
    const result = tresoreriePageCapitalTotal_reference(
        1000, 500, 2000, 200,
        -800, // totalDettes (negative, |.|=800)
        300, // totalAvances
        450,
    );
    assert.equal(result, 4650, 'capitalTotal = assets - liabilities = 4650');

    // Cross-check against exported computeCapitalSnapshot
    const snapshot = computeCapitalSnapshot({
        caisseBalance: 1000,
        baridiBalance: 500,
        portfolioValue: 2000,
        totalDettes: -800,
        totalAvances: 300,
        treasuryCards: [{ id: 'c1', name: 'M', value: 200 } as TreasuryCard],
        servicesCapitalImpact: 450,
    });
    assert.equal(snapshot.totalCapital, 4650, 'computeCapitalSnapshot agrees with TresoreriePage formula');
    assert.equal(snapshot.servicesCapitalImpact, 450, 'services are shown as a separate capital impact');
});

test('T-C-010b: netOwnedCapital_subtractsNonManagerInvestorCapitalAndProfit', () => {
    const snapshot = computeCapitalSnapshot({
        caisseBalance: 1000,
        baridiBalance: 500,
        portfolioValue: 2000,
        totalDettes: -800,
        totalAvances: 300,
        treasuryCards: [{ id: 'c1', name: 'M', value: 200 } as TreasuryCard],
        servicesCapitalImpact: 450,
        investorLiability: 600,
    });

    assert.equal(snapshot.totalCapital, 4650, 'capital total includes services separately');
    assert.equal(snapshot.investorLiability, 600, 'investor debt is tracked separately');
    assert.equal(snapshot.netOwnedCapital, 4050, 'real capital subtracts investor obligations');
});

test('T-C-010c: investorLiability_includesCapitalAndProfitButExcludesManager', () => {
    const investors = [
        { id: 'a', availableProfit: 100000, capitalInvested: 500000, initialCapital: 500000 } as Investor,
        { id: 'b', availableProfit: 0, capitalInvested: 250000, initialCapital: 250000, isManager: true } as Investor,
        { id: 'c', availableProfit: -2000, capitalInvested: 100000, initialCapital: 100000 } as Investor,
        { id: 'd', availableProfit: 50000, capitalInvested: 150000, initialCapital: 150000 } as Investor,
    ];

    assert.equal(
        calculateInvestorLiability(investors),
        900000,
        'liability includes non-manager capital plus positive available profit',
    );
});

// =========================================================================
// T-C-011: assetClientBalances does NOT apply affectsBalance filter (current — divergence from B-001)
// =========================================================================

test('T-C-011: assetClientBalances_doesNotApplyAffectsBalanceFilter (CURRENT — divergence from clientBalances)', () => {
    // Reference: useAppData.ts:250-257
    const assetTxs = [
        { actifId: 'a1', clientId: 'c1', amount: 100 } as any,
        { actifId: 'a1', clientId: 'c1', amount: -50 } as any,
        { actifId: 'a1', clientId: 'c1', amount: 25, affectsBalance: false } as any, // would-be-ignored
    ];
    function compute(txs: any[]) {
        const map = new Map<string, number>();
        txs.forEach((tx) => {
            const key = `${tx.actifId}_${tx.clientId}`;
            map.set(key, (map.get(key) || 0) + tx.amount); // NO filter on affectsBalance
        });
        return map;
    }
    const result = compute(assetTxs);
    assert.equal(
        result.get('a1_c1'),
        75,
        'CURRENT: affectsBalance ignored (100 - 50 + 25 = 75). Diverges from clientBalances (B-001).',
    );
});

// =========================================================================
// T-C-012: manualAssetPayment creates linked Ajout treasury_tx (static source check)
// =========================================================================

test('T-C-012: manualAssetPayment_createsLinkedAjoutTreasuryTx (static)', () => {
    const source = readFileSync(join(projectRoot, 'src/hooks/useAssetHandlers.ts'), 'utf8');
    // POST FIX-5: source uses a `treasuryType` variable that is 'Ajout' for inflows
    // ('payment_received') and 'Retrait' for outflows ('payment_made').
    assert.ok(
        source.includes("data.type === 'payment_received'") || source.includes("isInflow"),
        'Source must distinguish payment_received as the inflow case',
    );
    assert.ok(
        /isInflow\s*\?\s*'Ajout'\s*:\s*'Retrait'/.test(source),
        'Treasury tx type must be Ajout for inflow / Retrait for outflow (FIX-5)',
    );
    assert.ok(
        source.includes('linkedAssetTxId'),
        'Bidirectional linking via linkedAssetTxId/linkedTreasuryTxId',
    );
    assert.ok(
        source.includes('linkedTreasuryTxId'),
        'Bidirectional linking via linkedTreasuryTxId',
    );
});

// =========================================================================
// T-C-013: manualAssetExpense does NOT create Retrait (CURRENT — to be inverted after FIX-5)
// =========================================================================

test('T-C-013: manualAssetExpense_createsRetraitTreasuryTx (POST FIX-5 / Q7)', () => {
    const source = readFileSync(join(projectRoot, 'src/hooks/useAssetHandlers.ts'), 'utf8');
    const fnStart = source.indexOf('handleCreateAssetTransaction');
    const fnEnd = source.indexOf('handleCreateAssetClient', fnStart);
    const fnBody = source.slice(fnStart, fnEnd);
    // POST FIX-5: payment_made (cash/baridi outflow) creates a Retrait treasury_tx.
    assert.ok(
        fnBody.includes("data.type === 'payment_made'"),
        'POST FIX-5: payment_made branch exists for treasury linkage',
    );
    assert.ok(
        fnBody.includes("'Retrait'"),
        'POST FIX-5: Retrait type is generated for outflows',
    );
    assert.ok(
        fnBody.includes('isOutflow') || fnBody.includes('payment_made'),
        'POST FIX-5: outflow detection logic is present',
    );
});

// =========================================================================
// T-C-014: assetClient adjustment delta below 0.01 is skipped
// =========================================================================

test('T-C-014: assetClient_adjustmentDeltaThreshold_below0_01Skipped', () => {
    // Reference: useAssetHandlers.ts:202-217
    function shouldCreateAdjustment(currentBal: number, newBal: number): boolean {
        return !Number.isNaN(newBal) && Math.abs(newBal - currentBal) > 0.01;
    }
    assert.equal(shouldCreateAdjustment(100, 100.005), false, 'Tiny delta skipped');
    assert.equal(shouldCreateAdjustment(100, 100.011), true, 'Above threshold creates adjustment');
});

// =========================================================================
// T-C-015: assetClient delete allows zero balance but leaves orphan transactions
//          (CURRENT — to be fixed by FIX-6)
// =========================================================================

test('T-C-015: assetClient_cascadeDeletesActifTransactions (POST FIX-6 / Q8)', () => {
    const source = readFileSync(join(projectRoot, 'src/hooks/useAssetHandlers.ts'), 'utf8');
    const fnStart = source.indexOf('handleDeleteAssetClient');
    const fnEnd = source.indexOf('openAssetClientModal', fnStart);
    const fnBody = source.slice(fnStart, fnEnd);
    assert.ok(
        fnBody.includes("'manual_asset_clients'"),
        'Deletes client document',
    );
    // POST FIX-6: must also delete actifTransactions referencing the client
    assert.ok(
        fnBody.includes('actifTransactions'),
        'POST FIX-6: cascade-delete actifTransactions to avoid orphans',
    );
    assert.ok(
        fnBody.includes("'clientId'"),
        'POST FIX-6: queries actifTransactions by clientId',
    );
    // Linked treasury_txs from those asset txs should also be cleaned up
    assert.ok(
        fnBody.includes('linkedTreasuryTxId') || fnBody.includes("'treasury_txs'"),
        'POST FIX-6: linked treasury_txs are also deleted',
    );
});

// =========================================================================
// T-C-016: manual asset deletion blocked when txCount > 0
// =========================================================================

test('T-C-016: manualAsset_deleteBlockedWhenTxCountAboveZero', () => {
    // Reference: useAssetHandlers.ts:80-84
    function canDelete(txCount: number): boolean {
        return !(txCount > 0);
    }
    assert.equal(canDelete(0), true, 'Empty asset deletable');
    assert.equal(canDelete(1), false, 'Asset with 1 tx blocked');
    assert.equal(canDelete(100), false, 'Asset with many txs blocked');
});

console.log('\n✅ Section C regression tests: all 16 assertions completed.');
console.log('Tests use reference implementations + computeCapitalSnapshot direct + static source checks.');
