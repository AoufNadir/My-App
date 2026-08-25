import { compareServiceShadow, type LegacyServiceShadowFacts, type ServiceShadowIntent, type ServiceShadowResult } from './serviceShadow';

const MAX_DIAGNOSTICS = 300;
const diagnostics: ServiceShadowResult[] = [];

/** Local, non-blocking observer. It does not import Firebase and cannot alter Legacy. */
export function recordServiceShadow(intent: ServiceShadowIntent, legacyFacts: LegacyServiceShadowFacts = {}): ServiceShadowResult | null {
    try {
        const result = compareServiceShadow(intent, legacyFacts);
        diagnostics.push(result);
        if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
        if (!result.matches) {
            // Field-level instrumentation: field name + legacy-expected vs V2-actual + difference.
            console.warn('[servicesV2 shadow mismatch]', {
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
                    clientId: intent.clientId ?? null,
                    legacyFacts,
                },
            });
        }
        return result;
    }
    catch (error) {
        console.warn('[servicesV2 shadow failure]', { operationId: intent.operationId, error: error instanceof Error ? error.message : String(error) });
        return null;
    }
}

export function getServiceShadowDiagnostics(): readonly ServiceShadowResult[] {
    return diagnostics;
}

export function clearServiceShadowDiagnostics(): void {
    diagnostics.length = 0;
}
