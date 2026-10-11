/**
 * V5-4: through which channel an operation will be recorded, worked out for the strip next to the
 * Confirm button. Display only: nothing here is saved. It reads the same conditions the save
 * handlers read (useTransactionHandlers: `shouldLinkSettlementToDzdClient`, `shouldLinkCashToDzdClient`),
 * so the strip says what will really be recorded, including a client chosen to take the amount.
 */
export type ChannelStatus = 'cash' | 'baridi' | 'credit';
export type ChannelKind = 'cash' | 'baridi' | 'credit' | 'client';
export type ChannelWallet = 'Caisse' | 'BaridiMob';

export type ChannelSummary = {
    kind: ChannelKind;
    /** The wallet that moves; null when no money moves (credit, or an amount taken by another client). */
    wallet: ChannelWallet | null;
    /** Money enters the books' wallet (a sale, a payment received) or leaves it (a purchase, a payment made). */
    flow: 'in' | 'out';
    amount: number;
    /** The client whose account takes the amount instead of a wallet; null when a wallet moves. */
    accountClientId: string | null;
};

const hasId = (id: string | null | undefined): id is string => Boolean(id) && id !== 'none';
const walletOf = (status: 'cash' | 'baridi'): ChannelWallet => (status === 'baridi' ? 'BaridiMob' : 'Caisse');

/**
 * A sale or a purchase paid in dinars. A sale hands the settlement to another client for cash and
 * for BaridiMob; a purchase only for cash (the purchase window offers no other client for BaridiMob).
 * Null while there is no amount to talk about.
 */
export function tradeChannel(input: {
    operation: 'sell' | 'buy';
    status: ChannelStatus;
    primaryClientId?: string | null;
    otherClientId?: string | null;
    amount: number;
}): ChannelSummary | null {
    if (!Number.isFinite(input.amount) || input.amount <= 0)
        return null;
    const flow = input.operation === 'sell' ? 'in' : 'out';
    if (input.status === 'credit')
        return { kind: 'credit', wallet: null, flow, amount: input.amount, accountClientId: hasId(input.primaryClientId) ? input.primaryClientId : null };
    const takenByOther = hasId(input.otherClientId) && (input.operation === 'sell' || input.status === 'cash');
    if (takenByOther)
        return { kind: 'client', wallet: null, flow, amount: input.amount, accountClientId: input.otherClientId as string };
    return { kind: input.status, wallet: walletOf(input.status), flow, amount: input.amount, accountClientId: null };
}

/**
 * A payment received from a client or made to a client, from the client page. With « received by »
 * set, the debt moves to that client and no wallet moves.
 */
export function settlementChannel(input: {
    received: boolean;
    status: 'cash' | 'baridi';
    receiverClientId?: string | null;
    amount: number;
}): ChannelSummary | null {
    if (!Number.isFinite(input.amount) || input.amount <= 0)
        return null;
    const flow = input.received ? 'in' : 'out';
    if (hasId(input.receiverClientId))
        return { kind: 'client', wallet: null, flow, amount: input.amount, accountClientId: input.receiverClientId };
    return { kind: input.status, wallet: walletOf(input.status), flow, amount: input.amount, accountClientId: null };
}

/** The colour of a channel in every window that names one: cash green, BaridiMob blue, credit orange. */
export const CHANNEL_TONE: Record<ChannelKind, 'profit' | 'primary' | 'debt' | 'neutral'> = {
    cash: 'profit',
    baridi: 'primary',
    credit: 'debt',
    client: 'neutral',
};

/** The key of the sentence that says what happens, in the channelStrip translations. */
export function channelSentenceKey(summary: Pick<ChannelSummary, 'kind' | 'wallet' | 'flow'>, operation: 'sell' | 'buy' | 'settlement'): string {
    if (summary.kind === 'credit')
        return operation === 'buy' ? 'channelStrip.creditBuy' : 'channelStrip.creditSell';
    if (summary.kind === 'client')
        return summary.flow === 'in' ? 'channelStrip.clientIn' : 'channelStrip.clientOut';
    const wallet = summary.wallet === 'BaridiMob' ? 'Baridi' : 'Caisse';
    return `channelStrip.${summary.flow}${wallet}`;
}
