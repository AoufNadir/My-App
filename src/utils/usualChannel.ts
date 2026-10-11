/**
 * V5-4: the way a client usually pays, kept on the client (`usualChannel`: 'cash' or 'baridi').
 * It only helps: the sale and payment windows start on it when a client is picked, and the strip
 * warns when the channel chosen is the other one. It never blocks a save and changes no number.
 */
export type UsualChannel = 'cash' | 'baridi';

export const USUAL_CHANNELS: readonly UsualChannel[] = ['cash', 'baridi'];

/** The usual channel saved on a client; anything else (missing, null, a stray value) is « none ». */
export function usualChannelOf(client: { usualChannel?: unknown } | null | undefined): UsualChannel | null {
    const value = client?.usualChannel;
    return value === 'cash' || value === 'baridi' ? value : null;
}

/** What the client edit window gives back: '' (none) or a channel, as the value saved on the client. */
export function usualChannelToSave(input: string | null | undefined): UsualChannel | null {
    return input === 'cash' || input === 'baridi' ? input : null;
}

/**
 * The usual channel, when the channel chosen for this operation is the other one. Credit is not a
 * channel: a client who usually pays by BaridiMob can still buy on credit without a warning.
 */
export function usualChannelDiffers(usual: UsualChannel | null, chosen: string | null | undefined): UsualChannel | null {
    if (!usual)
        return null;
    if (chosen !== 'cash' && chosen !== 'baridi')
        return null;
    return chosen === usual ? null : usual;
}

/**
 * What the payment status of a new sale becomes when its client is picked (or cleared): the client's
 * usual channel, unless the status was already chosen by hand or the sale is being edited. When the
 * client is cleared, a status that only came from the previous client goes back to cash.
 * `status: null` means « leave it as it is ».
 */
export function saleStatusAfterClientPick(input: {
    usual: UsualChannel | null;
    /** The user pressed a payment status himself in this window. */
    touched: boolean;
    editing: boolean;
    /** The status now shown was set by a client pick, not by the user. */
    fromClient: boolean;
}): { status: UsualChannel | null; fromClient: boolean } {
    if (input.editing || input.touched)
        return { status: null, fromClient: input.fromClient };
    if (input.usual)
        return { status: input.usual, fromClient: true };
    if (input.fromClient)
        return { status: 'cash', fromClient: false };
    return { status: null, fromClient: false };
}
