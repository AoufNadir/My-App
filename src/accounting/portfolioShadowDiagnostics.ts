import {
    comparePortfolioShadow,
    type LegacyPortfolioShadowFacts,
    type PortfolioShadowIntent,
    type PortfolioShadowResult,
} from './portfolioShadow';

const MAX_DIAGNOSTICS = 300;
const diagnostics: PortfolioShadowResult[] = [];

/**
 * Non-blocking Portfolio Shadow observer. This is process-local diagnostics
 * only: no Firebase import, no database document, no projection, no V2 write.
 * A mismatch or failed draft is deliberately unable to stop the Legacy batch.
 */
export function recordPortfolioShadow(
    intent: PortfolioShadowIntent,
    legacyFacts: LegacyPortfolioShadowFacts = {},
): PortfolioShadowResult | null {
    try {
        const result = comparePortfolioShadow(intent, legacyFacts);
        diagnostics.push(result);
        if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
        if (!result.matches) {
            // Field-level instrumentation (test/preview requirement): print each
            // mismatching field with legacy-expected vs V2-actual and the difference.
            console.warn('[portfolioV2 shadow mismatch]', {
                kind: intent.kind,
                operationId: intent.operationId,
                mismatches: result.mismatches,
                fields: result.mismatches.map((line) => {
                    const match = line.match(/^(.*?): Legacy (-?[\d.]+) != V2 (-?[\d.]+)\.?$/);
                    if (!match) return { field: line, legacyExpected: null, readModelActual: null, difference: null };
                    const legacyExpected = Number(match[2]);
                    const readModelActual = Number(match[3]);
                    return {
                        field: match[1].trim(),
                        legacyExpected,
                        readModelActual,
                        difference: Math.round((readModelActual - legacyExpected) * 100) / 100,
                    };
                }),
                context: {
                    transactionId: intent.operationId.split(':').pop(),
                    quantityDeltas: legacyFacts.quantityDeltas ?? null,
                    costBasisDeltasDzd: legacyFacts.costBasisDeltasDzd ?? null,
                    cashDeltasDzd: legacyFacts.cashDeltasDzd ?? null,
                    realizedTradingProfitDzd: legacyFacts.realizedTradingProfitDzd ?? null,
                },
            });
        }
        return result;
    }
    catch (error) {
        console.warn('[portfolioV2 shadow failure]', {
            kind: intent.kind,
            operationId: intent.operationId,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

export function getPortfolioShadowDiagnostics(): readonly PortfolioShadowResult[] {
    return diagnostics;
}

export function clearPortfolioShadowDiagnostics(): void {
    diagnostics.length = 0;
}
