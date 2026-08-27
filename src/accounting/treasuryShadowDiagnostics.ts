import {
    compareTreasuryShadow,
    type LegacyTreasuryShadowRow,
    type TreasuryShadowIntent,
    type TreasuryShadowResult,
} from './treasuryShadow';

const MAX_DIAGNOSTICS = 200;
const diagnostics: TreasuryShadowResult[] = [];

/**
 * Non-blocking Shadow observer. It intentionally catches every builder or
 * comparison failure so an existing Legacy operation can continue unchanged.
 * Diagnostics are process-local only: this module never writes Firebase.
 */
export function recordTreasuryShadow(
    intent: TreasuryShadowIntent,
    legacyRows: readonly LegacyTreasuryShadowRow[],
): TreasuryShadowResult | null {
    try {
        const result = compareTreasuryShadow(intent, legacyRows);
        diagnostics.push(result);
        if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
        if (!result.matches) {
            console.warn('[treasuryV2 shadow mismatch]', {
                kind: intent.kind,
                operationId: intent.operationId,
                mismatches: result.mismatches,
            });
        }
        return result;
    }
    catch (error) {
        console.warn('[treasuryV2 shadow failure]', {
            kind: intent.kind,
            operationId: intent.operationId,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/**
 * Records the cash effect that a Legacy financial-transaction delete removes.
 * It must never be used for deleting a Client, Investor, Asset, or any other
 * entity: V2 archives those entities and preserves their financial history.
 * It is an observer only; callers continue with their existing delete whether
 * this comparison matches, mismatches, or cannot be built.
 */
export function recordTreasuryLegacyDeletionShadow(args: {
    operationId: string;
    actorUid: string;
    effectiveAt: number;
    row: LegacyTreasuryShadowRow;
}): TreasuryShadowResult | null {
    const { operationId, actorUid, effectiveAt, row } = args;
    if (row.type === 'Transfer') {
        if (!row.source || !row.destination) return null;
        return recordTreasuryShadow({
            operationId,
            actorUid,
            effectiveAt,
            kind: 'treasury_transfer',
            from: row.destination,
            to: row.source,
            amountDzd: row.amount,
        }, [{ type: 'Transfer', source: row.destination, destination: row.source, amount: row.amount }]);
    }
    if (!row.source) return null;
    const wasInflow = row.type === 'Ajout' || row.type === 'Adjustment (+)';
    return recordTreasuryShadow({
        operationId,
        actorUid,
        effectiveAt,
        kind: wasInflow ? 'treasury_adjustment_out' : 'treasury_adjustment_in',
        wallet: row.source,
        amountDzd: row.amount,
    }, [{ type: wasInflow ? 'Retrait' : 'Ajout', source: row.source, amount: row.amount }]);
}

export function getTreasuryShadowDiagnostics(): readonly TreasuryShadowResult[] {
    return diagnostics;
}

export function clearTreasuryShadowDiagnostics(): void {
    diagnostics.length = 0;
}
