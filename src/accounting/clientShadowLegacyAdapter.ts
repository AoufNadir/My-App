import type { ClientTransactionDzd } from '../types';
import {
    buildClientPositionSnapshot,
    type ClientPositionSnapshot,
    type ClientShadowEffects,
    type LegacyClientTransactionRow,
} from './clientShadow';

/** Pure Legacy adapter. It is only a Shadow input, never a V2 source of truth. */
export function clientPositionFromLegacyRows(
    rows: readonly ClientTransactionDzd[],
    clientId: string,
    effectiveAt?: number,
): ClientPositionSnapshot {
    return buildClientPositionSnapshot(rows as readonly LegacyClientTransactionRow[], clientId, effectiveAt);
}

export function emptyLegacyClientEffects(): ClientShadowEffects {
    return {
        clientDeltas: {},
        cashDeltasDzd: { Caisse: 0, BaridiMob: 0 },
        receivableDzd: 0,
        clientAdvanceDzd: 0,
        clientPayableDzd: 0,
        supplierPayableDzd: 0,
    };
}
