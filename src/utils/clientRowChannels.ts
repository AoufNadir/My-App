import type { ClientTransactionDzd, TreasuryTx } from '../types';

/**
 * How a cash or BaridiMob settlement was paid, for the rows that were recorded from the treasury
 * adjustment window with a client picked (V7-1).
 *
 * The client page saves the channel on the client row (`paymentMethod`). The adjustment window only
 * saved it on the treasury row it links to (`source`) and as « (BaridiMob) » at the end of the note,
 * so the client reports could not say how the client paid and fell back to a vague wording. Rows
 * saved from now on carry `paymentMethod` like the client page's; this reads it back for the older
 * ones, without writing anything.
 */

const SETTLEMENT_TYPES = new Set<ClientTransactionDzd['type']>(['Règlement Reçu', 'Paiement Effectué']);
const NOTE_CHANNEL = /\((Caisse|BaridiMob)\)\s*$/;

type ChannelWallet = 'Caisse' | 'BaridiMob';
type ClientPaymentChannel = NonNullable<ClientTransactionDzd['paymentMethod']>;

const channelOfWallet = (wallet: ChannelWallet): ClientPaymentChannel => (wallet === 'Caisse' ? 'Espèces' : 'BaridiMob');

/** The channel an adjustment row was paid through, or undefined when it cannot be told. */
export function adjustmentChannelOf(row: ClientTransactionDzd, treasuryById: ReadonlyMap<string, Pick<TreasuryTx, 'source'>>): ClientPaymentChannel | undefined {
    if (row.paymentMethod || row.origin !== 'adjustment' || !SETTLEMENT_TYPES.has(row.type))
        return undefined;
    const linked = row.linkedTxId ? treasuryById.get(row.linkedTxId) : undefined;
    if (linked?.source === 'Caisse' || linked?.source === 'BaridiMob')
        return channelOfWallet(linked.source);
    const fromNote = NOTE_CHANNEL.exec(String(row.notes ?? ''));
    return fromNote ? channelOfWallet(fromNote[1] as ChannelWallet) : undefined;
}

/**
 * The client rows as the client reports read them: an adjustment row without a channel gets the one
 * of its treasury row. Nothing else changes (amounts, signs, dates, links), and the same array comes
 * back when no row needed it.
 */
export function withAdjustmentChannels(rows: ReadonlyArray<ClientTransactionDzd>, treasuryRows: ReadonlyArray<Pick<TreasuryTx, 'id' | 'source'>>): ClientTransactionDzd[] {
    const treasuryById = new Map(treasuryRows.map((row) => [row.id, row] as const));
    let changed = false;
    const result = rows.map((row) => {
        const channel = adjustmentChannelOf(row, treasuryById);
        if (!channel)
            return row;
        changed = true;
        return { ...row, paymentMethod: channel };
    });
    return changed ? result : (rows as ClientTransactionDzd[]);
}
