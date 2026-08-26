import type { DashboardReadModelSet, ReadModelsMode } from './dashboardReadModels';
import { getReadModelsMode } from './dashboardReadModels';
import {
    READ_MODEL_APPLIED_OPS_PATH,
    applyReadModelDelta,
    type ReadModelDelta,
    type ReadModelAppliedOpsPath,
} from './readModelDeltas';

export type SummaryWriteMode = 'off' | 'summary_write_shadow' | 'read';
export type DashboardReadSource = 'legacy_full_history' | 'dashboard_summary' | 'controlled_legacy_fallback' | 'unavailable';
export type LegacyMutationStatus = 'mutable_legacy' | 'immutable_legacy';

export const IMMUTABLE_LEGACY = 'IMMUTABLE_LEGACY';
export const LEGACY_BACKFILL_REQUIRED_FOR_READ_MODE = false;

export type PreparedReadModelDeltaApplication = {
    status: 'disabled' | 'prepared';
    summaryWriteMode: SummaryWriteMode;
    operationId: string;
    payloadHash: string;
    affectedSummaries: ReadModelDelta['affectedSummaries'];
    idempotencyPath: ReadModelAppliedOpsPath;
    idempotencyDocId: string;
    failureBlocksLegacy: boolean;
    nextSnapshot?: DashboardReadModelSet;
};

export type LegacyMutationPolicy = {
    status: LegacyMutationStatus;
    canMutate: boolean;
    reason?: typeof IMMUTABLE_LEGACY;
    legacyBackfillRequired: false;
};

function configuredSummaryWriteMode(): string | undefined {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    if (env?.VITE_READ_MODELS_SUMMARY_WRITE_MODE)
        return env.VITE_READ_MODELS_SUMMARY_WRITE_MODE;
    if (env?.VITE_READ_MODELS_MODE === 'shadow')
        return 'summary_write_shadow';
    if (env?.VITE_READ_MODELS_MODE === 'read')
        return 'read';
    return undefined;
}

export function getSummaryWriteMode(value = configuredSummaryWriteMode()): SummaryWriteMode {
    if (value === 'summary_write_shadow' || value === 'read')
        return value;
    return 'off';
}

export function isSummaryWriteEnabled(mode = getSummaryWriteMode()): boolean {
    return mode === 'summary_write_shadow' || mode === 'read';
}

export function isSummaryWriteFailureBlocking(mode = getSummaryWriteMode()): boolean {
    return mode === 'read';
}

export function shouldUseDashboardSummaryForView(input: {
    readModelsMode?: ReadModelsMode | string;
    view: string;
}): boolean {
    return getReadModelsMode(input.readModelsMode) === 'read' && input.view === 'dashboard';
}

export function shouldSubscribeFullLegacyHistory(input: {
    readModelsMode?: ReadModelsMode | string;
    view: string;
}): boolean {
    return !shouldUseDashboardSummaryForView(input);
}

export function resolveDashboardReadSource(input: {
    readModelsMode?: ReadModelsMode | string;
    hasDashboardSummary: boolean;
    fallbackAlreadyUsed?: boolean;
}): DashboardReadSource {
    const mode = getReadModelsMode(input.readModelsMode);
    if (mode !== 'read')
        return 'legacy_full_history';
    if (input.hasDashboardSummary)
        return 'dashboard_summary';
    if (!input.fallbackAlreadyUsed)
        return 'controlled_legacy_fallback';
    return 'unavailable';
}

export function resolveLegacyMutationPolicy(input: {
    readModelsMode?: ReadModelsMode | string;
    coveredByReadModels?: boolean;
}): LegacyMutationPolicy {
    if (getReadModelsMode(input.readModelsMode) === 'read' && !input.coveredByReadModels) {
        return {
            status: 'immutable_legacy',
            canMutate: false,
            reason: IMMUTABLE_LEGACY,
            legacyBackfillRequired: LEGACY_BACKFILL_REQUIRED_FOR_READ_MODE,
        };
    }
    return {
        status: 'mutable_legacy',
        canMutate: true,
        legacyBackfillRequired: LEGACY_BACKFILL_REQUIRED_FOR_READ_MODE,
    };
}

export function isImmutableLegacyMutationError(error?: string): boolean {
    return error === IMMUTABLE_LEGACY;
}

export function prepareReadModelDeltaApplication(input: {
    snapshot: DashboardReadModelSet;
    delta: ReadModelDelta;
    summaryWriteMode?: SummaryWriteMode | string;
}): PreparedReadModelDeltaApplication {
    const summaryWriteMode = getSummaryWriteMode(input.summaryWriteMode);
    const base = {
        summaryWriteMode,
        operationId: input.delta.operationId,
        payloadHash: input.delta.payloadHash,
        affectedSummaries: input.delta.affectedSummaries,
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        idempotencyDocId: input.delta.operationId,
        failureBlocksLegacy: isSummaryWriteFailureBlocking(summaryWriteMode),
    };
    if (!isSummaryWriteEnabled(summaryWriteMode)) {
        return {
            ...base,
            status: 'disabled',
        };
    }
    return {
        ...base,
        status: 'prepared',
        nextSnapshot: applyReadModelDelta(input.snapshot, input.delta),
    };
}
