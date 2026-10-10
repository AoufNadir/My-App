import type { ClientDzd } from '../types';

/**
 * Wallet addresses a client gave us, to send him USDT: one per network, kept in the client document as
 * { TRC20: 'T…', BEP20: '0x…' }. A network without an address is not stored, and a client with none has
 * `wallets: null`. To offer another network, add it to CLIENT_WALLET_NETWORKS: the window, the client file,
 * the search and the saving all follow the list.
 */
export const CLIENT_WALLET_NETWORKS = ['TRC20', 'BEP20'] as const;
export type ClientWalletNetwork = typeof CLIENT_WALLET_NETWORKS[number];
export type ClientWallets = Partial<Record<ClientWalletNetwork, string>>;
/** What the client window edits: one text per network, empty when there is no address. */
export type ClientWalletInput = Record<ClientWalletNetwork, string>;
export type ClientWalletEntry = { network: ClientWalletNetwork; address: string };

// An address has no space. Messaging apps add some invisible direction marks when text is copied from
// a chat in Arabic, and an address that carries one is refused by the exchange it is pasted in.
// The ranges are written as code points so that the marks are readable in this file. Spaces, no-break
// spaces and the byte order mark are already whitespace for the `\s` below.
const INVISIBLE_MARK_RANGES: ReadonlyArray<readonly [number, number]> = [
    [0x200B, 0x200F], // zero-width space and joiners, left-to-right and right-to-left marks
    [0x202A, 0x202E], // embedding and override marks
    [0x2060, 0x2064], // word joiner and invisible operators
    [0x2066, 0x2069], // isolate marks
];
const isInvisibleMark = (char: string) => {
    const code = char.codePointAt(0) ?? 0;
    return INVISIBLE_MARK_RANGES.some(([first, last]) => code >= first && code <= last);
};

export function cleanWalletAddress(value: unknown): string {
    if (typeof value !== 'string')
        return '';
    return Array.from(value).filter((char) => !/\s/.test(char) && !isInvisibleMark(char)).join('');
}

export function emptyClientWalletInput(): ClientWalletInput {
    return Object.fromEntries(CLIENT_WALLET_NETWORKS.map((network) => [network, ''])) as ClientWalletInput;
}

/** The addresses stored on a client, in the order of CLIENT_WALLET_NETWORKS. Anything else in the field is ignored. */
export function readClientWallets(client: Pick<ClientDzd, 'wallets'> | null | undefined): ClientWalletEntry[] {
    const stored = client?.wallets;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored))
        return [];
    return CLIENT_WALLET_NETWORKS.flatMap((network) => {
        const address = cleanWalletAddress(stored[network]);
        return address ? [{ network, address }] : [];
    });
}

/** The texts the client window starts from. */
export function clientWalletInputFrom(client: Pick<ClientDzd, 'wallets'> | null | undefined): ClientWalletInput {
    const input = emptyClientWalletInput();
    for (const { network, address } of readClientWallets(client))
        input[network] = address;
    return input;
}

/** What is saved for the texts typed in the window: the addresses cleaned, without the empty ones, or null when none is left. */
export function normalizeClientWallets(input: Partial<Record<ClientWalletNetwork, unknown>> | null | undefined): ClientWallets | null {
    const wallets: ClientWallets = {};
    for (const network of CLIENT_WALLET_NETWORKS) {
        const address = cleanWalletAddress(input?.[network]);
        if (address)
            wallets[network] = address;
    }
    return Object.keys(wallets).length > 0 ? wallets : null;
}

/** An address is long and mixed: a letter or two would match nearly every client that has one, so the search starts at this many characters. */
export const WALLET_SEARCH_MIN_LENGTH = 6;

/** Whether what was typed in the search is part of one of the client's addresses, so pasting an address finds its client. */
export function clientWalletMatchesQuery(client: Pick<ClientDzd, 'wallets'> | null | undefined, query: string): boolean {
    const wanted = cleanWalletAddress(query).toLowerCase();
    return wanted.length >= WALLET_SEARCH_MIN_LENGTH
        && readClientWallets(client).some((entry) => entry.address.toLowerCase().includes(wanted));
}
