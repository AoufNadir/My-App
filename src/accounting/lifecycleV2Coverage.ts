export const LIFECYCLE_V2_READINESS = 'ready' as const;

export type LifecycleV2CoverageItem = {
    id: string;
    scope: 'financial_operation' | 'cross_domain' | 'entity' | 'legacy';
    currentPolicy: string;
    v2Policy: 'immutable_operation' | 'full_reversal' | 'reversal_then_replacement' | 'archive_entity' | 'legacy_until_global_cutover';
    readiness: typeof LIFECYCLE_V2_READINESS;
};

export const LIFECYCLE_V2_COVERAGE: readonly LifecycleV2CoverageItem[] = [
    {
        id: 'lifecycle.v2-create',
        scope: 'financial_operation',
        currentPolicy: 'Core Ledger operation is prepared but no production writer calls it yet.',
        v2Policy: 'immutable_operation',
        readiness: LIFECYCLE_V2_READINESS,
    },
    {
        id: 'lifecycle.v2-cancel',
        scope: 'financial_operation',
        currentPolicy: 'Legacy may delete linked rows before Global Cutover.',
        v2Policy: 'full_reversal',
        readiness: LIFECYCLE_V2_READINESS,
    },
    {
        id: 'lifecycle.v2-edit',
        scope: 'financial_operation',
        currentPolicy: 'Legacy may update a row and recreate linked rows before Global Cutover.',
        v2Policy: 'reversal_then_replacement',
        readiness: LIFECYCLE_V2_READINESS,
    },
    {
        id: 'lifecycle.v2-cross-domain',
        scope: 'cross_domain',
        currentPolicy: 'Shadow drafts already model cross-domain effects as one future ledger operation.',
        v2Policy: 'full_reversal',
        readiness: LIFECYCLE_V2_READINESS,
    },
    {
        id: 'lifecycle.entity-delete',
        scope: 'entity',
        currentPolicy: 'Some Legacy entity deletes may remove records before Global Cutover.',
        v2Policy: 'archive_entity',
        readiness: LIFECYCLE_V2_READINESS,
    },
    {
        id: 'lifecycle.legacy-pre-cutover',
        scope: 'legacy',
        currentPolicy: 'Legacy remains active until one future Global Cutover.',
        v2Policy: 'legacy_until_global_cutover',
        readiness: LIFECYCLE_V2_READINESS,
    },
];
