import {
    compareInvestorShadow,
    type InvestorShadowIntent,
    type InvestorShadowResult,
    type LegacyInvestorShadowFacts,
} from './investorShadow';

const MAX_DIAGNOSTICS = 300;
const diagnostics: InvestorShadowResult[] = [];

/** Process-local and non-blocking. Shadow never writes Firebase or blocks Legacy. */
export function recordInvestorShadow(intent: InvestorShadowIntent, legacyFacts: LegacyInvestorShadowFacts = {}): InvestorShadowResult | null {
    try {
        const result = compareInvestorShadow(intent, legacyFacts);
        diagnostics.push(result);
        if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
        if (!result.matches) console.warn('[investorsV2 shadow mismatch]', { kind: intent.kind, operationId: intent.operationId, mismatches: result.mismatches });
        return result;
    }
    catch (error) {
        console.warn('[investorsV2 shadow failure]', { kind: intent.kind, operationId: intent.operationId, error: error instanceof Error ? error.message : String(error) });
        return null;
    }
}

export function getInvestorShadowDiagnostics(): readonly InvestorShadowResult[] {
    return diagnostics;
}

export function clearInvestorShadowDiagnostics(): void {
    diagnostics.length = 0;
}
