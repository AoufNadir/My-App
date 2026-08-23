import type { AccountingOperationDraft } from './types';

export type LifecycleShadowDiagnostic = {
    checkedAt: number;
    action: 'cancel' | 'edit' | 'archive_entity';
    operationId?: string;
    reversalOf?: string;
    matches: boolean;
    errors: string[];
    drafts?: AccountingOperationDraft[];
};

const diagnostics: LifecycleShadowDiagnostic[] = [];
const MAX_DIAGNOSTICS = 300;

export function recordLifecycleShadowDiagnostic(entry: Omit<LifecycleShadowDiagnostic, 'checkedAt'>): LifecycleShadowDiagnostic {
    const diagnostic: LifecycleShadowDiagnostic = { ...entry, checkedAt: Date.now() };
    diagnostics.unshift(diagnostic);
    diagnostics.splice(MAX_DIAGNOSTICS);
    if (!diagnostic.matches) {
        console.warn('[LifecycleV2 Shadow] mismatch', diagnostic);
    }
    return diagnostic;
}

export function getLifecycleShadowDiagnostics(): readonly LifecycleShadowDiagnostic[] {
    return diagnostics;
}

export function clearLifecycleShadowDiagnostics(): void {
    diagnostics.splice(0, diagnostics.length);
}
