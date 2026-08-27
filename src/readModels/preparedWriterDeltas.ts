import type { ReadModelName } from './dashboardReadModels';
import {
    buildReadModelDelta,
    type ReadModelDelta,
    type ReadModelDeltaBuildInput,
} from './readModelDeltas';
import {
    WRITER_COVERAGE_MATRIX,
    findWriterCoverageById,
    type WriterCoverageRow,
} from './writerCoverageMatrix';

export type PreparedWriterDelta = {
    writerId: string;
    coverage: WriterCoverageRow;
    delta: ReadModelDelta;
};

export type PreparedWriterDeltaResult =
    | { ok: true; prepared: PreparedWriterDelta }
    | { ok: false; reason: string; writerId: string };

function uniqueNames(names: readonly ReadModelName[]): ReadModelName[] {
    return Array.from(new Set(names));
}

function sameNameSet(a: readonly ReadModelName[], b: readonly ReadModelName[]): boolean {
    const left = uniqueNames(a).sort();
    const right = uniqueNames(b).sort();
    return JSON.stringify(left) === JSON.stringify(right);
}

export function writerIdsReadyForPreparedDeltas(): string[] {
    return WRITER_COVERAGE_MATRIX
        .filter((row) => row.id !== 'main.global-reset')
        .map((row) => row.id);
}

export function prepareWriterReadModelDelta(
    writerId: string,
    input: ReadModelDeltaBuildInput,
): PreparedWriterDeltaResult {
    const coverage = findWriterCoverageById(writerId);
    if (!coverage) {
        return { ok: false, writerId, reason: 'Unknown writer coverage id.' };
    }
    if (writerId === 'main.global-reset') {
        return { ok: false, writerId, reason: 'Global reset is not a supported financial read-model delta.' };
    }
    if (!sameNameSet(input.affectedSummaries, coverage.domainSummaries)) {
        return {
            ok: false,
            writerId,
            reason: `Affected summaries must match writer coverage: ${coverage.domainSummaries.join(', ')}`,
        };
    }
    return {
        ok: true,
        prepared: {
            writerId,
            coverage,
            delta: buildReadModelDelta(input),
        },
    };
}

export function mustPrepareWriterReadModelDelta(
    writerId: string,
    input: ReadModelDeltaBuildInput,
): ReadModelDelta {
    const result = prepareWriterReadModelDelta(writerId, input);
    if (result.ok === false) {
        throw new Error(`READ_MODEL_DELTA_PREPARATION_FAILED:${writerId}:${result.reason}`);
    }
    return result.prepared.delta;
}
