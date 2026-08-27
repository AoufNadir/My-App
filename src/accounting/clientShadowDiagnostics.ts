import {
    compareClientShadow,
    type ClientShadowIntent,
    type ClientShadowResult,
    type LegacyClientShadowFacts,
} from './clientShadow';

const MAX_DIAGNOSTICS = 300;
const diagnostics: ClientShadowResult[] = [];

/**
 * Process-local, non-blocking Shadow observer. It does not import Firebase or
 * write a projection. Any failure is diagnostic only and cannot stop Legacy.
 */
export function recordClientShadow(intent: ClientShadowIntent, legacyFacts: LegacyClientShadowFacts = {}): ClientShadowResult | null {
    try {
        const result = compareClientShadow(intent, legacyFacts);
        diagnostics.push(result);
        if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
        if (!result.matches) {
            console.warn('[clientsV2 shadow mismatch]', { kind: intent.kind, operationId: intent.operationId, mismatches: result.mismatches });
        }
        return result;
    }
    catch (error) {
        console.warn('[clientsV2 shadow failure]', {
            kind: intent.kind,
            operationId: intent.operationId,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

export function getClientShadowDiagnostics(): readonly ClientShadowResult[] {
    return diagnostics;
}

export function clearClientShadowDiagnostics(): void {
    diagnostics.length = 0;
}
