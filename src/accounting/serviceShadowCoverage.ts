import type { ServiceShadowKind } from './serviceShadow';

export type ServiceShadowV2Policy = 'shadow_observed' | 'lifecycle_prepared' | 'archive_entity';
export const SERVICES_V2_READINESS = 'shadow' as const;

export type ServiceShadowWriter = {
    id: string;
    file: string;
    legacyWrite: string;
    shadowKinds: ServiceShadowKind[];
    v2Policy: ServiceShadowV2Policy;
};

/** Digital service financial writers. Manual asset services stay in assetsV2. */
export const SERVICE_SHADOW_WRITERS: readonly ServiceShadowWriter[] = [
    { id: 'services.digital-service-save', file: 'src/hooks/useDigitalServiceHandlers.ts', legacyWrite: 'digital_service_txs + linked treasury/portfolio/client rows', shadowKinds: ['digital_service_sale'], v2Policy: 'shadow_observed' },
    { id: 'services.digital-service-edit', file: 'src/hooks/useDigitalServiceHandlers.ts', legacyWrite: 'replace main and linked legacy rows', shadowKinds: ['digital_service_sale'], v2Policy: 'shadow_observed' },
    { id: 'services.digital-service-delete', file: 'src/hooks/useDigitalServiceHandlers.ts', legacyWrite: 'delete main and linked rows', shadowKinds: [], v2Policy: 'lifecycle_prepared' },
    { id: 'services.entity-delete', file: 'src/hooks/useAssetHandlers.ts', legacyWrite: 'manual asset/service entity delete', shadowKinds: [], v2Policy: 'archive_entity' },
];
