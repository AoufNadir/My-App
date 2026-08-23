import { compareServiceShadow, type LegacyServiceShadowFacts, type ServiceShadowIntent, type ServiceShadowResult } from './serviceShadow';

const MAX_DIAGNOSTICS = 300;
const diagnostics: ServiceShadowResult[] = [];

/** Local, non-blocking observer. It does not import Firebase and cannot alter Legacy. */
export function recordServiceShadow(intent: ServiceShadowIntent, legacyFacts: LegacyServiceShadowFacts = {}): ServiceShadowResult | null {
    try {
        const result = compareServiceShadow(intent, legacyFacts);
        diagnostics.push(result);
        if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
        if (!result.matches) console.warn('[servicesV2 shadow mismatch]', { operationId: intent.operationId, mismatches: result.mismatches });
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
