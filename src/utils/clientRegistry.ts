import type { ClientDzd } from '../types';

/**
 * A deleted client is archived (never hard-deleted when it has history) so its
 * past operations keep their name. Archived clients must disappear from every
 * picker/search, but stay resolvable by id for history and reports.
 */
export function isClientActive(client: Pick<ClientDzd, 'isActive' | 'archived'> | null | undefined): boolean {
    return !!client && client.archived !== true && client.isActive !== false;
}

/**
 * Clients offered in a picker: active ones only, plus any id that is already
 * selected (editing an old operation linked to an archived client must not
 * silently drop that link).
 */
export function selectableClients<T extends ClientDzd>(clients: ReadonlyArray<T>, keepIds: ReadonlyArray<string | null | undefined> = []): T[] {
    const keep = new Set(keepIds.filter((id): id is string => !!id && id !== 'none'));
    return clients.filter((client) => isClientActive(client) || keep.has(client.id));
}

function removeDiacritics(value: string): string {
    return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Case/accent/spacing-insensitive name key; token order is ignored ("Naceer Yacine" = "yacine  naceer"). */
export function clientNameKey(value: string | null | undefined): string {
    const tokens = removeDiacritics(String(value || ''))
        .toLowerCase()
        .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
    return tokens.sort().join(' ');
}

/** Digits-only Algerian phone key: +213 / 00213 prefixes become a leading 0. */
export function clientPhoneKey(value: string | null | undefined): string {
    let digits = String(value || '').replace(/\D+/g, '');
    if (digits.startsWith('00213'))
        digits = `0${digits.slice(5)}`;
    else if (digits.startsWith('213') && digits.length >= 12)
        digits = `0${digits.slice(3)}`;
    return digits.length >= 6 ? digits : '';
}

function textKey(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
}

function clientNames(client: ClientDzd): string[] {
    const legacy = client.prenom ? `${client.nom || ''} ${client.prenom}` : client.nom;
    return [client.fullName, legacy].map(clientNameKey).filter(Boolean);
}

export type ClientDuplicateField = 'name' | 'phone' | 'redotpayId' | 'binanceEmail';

export type ClientDuplicateMatch = {
    client: ClientDzd;
    fields: ClientDuplicateField[];
    archived: boolean;
};

export type ClientIdentityInput = {
    fullName?: string;
    phone?: string;
    redotpayId?: string;
    binanceEmail?: string;
};

/**
 * Existing clients (active or archived) that share a name, phone, RedotPay ID
 * or Binance email with the candidate. Active matches are listed first.
 */
export function findClientDuplicates(candidate: ClientIdentityInput, clients: ReadonlyArray<ClientDzd>, excludeClientId?: string | null): ClientDuplicateMatch[] {
    const nameKey = clientNameKey(candidate.fullName);
    const phoneKey = clientPhoneKey(candidate.phone);
    const redotpayKey = textKey(candidate.redotpayId);
    const binanceKey = textKey(candidate.binanceEmail);
    const matches: ClientDuplicateMatch[] = [];
    for (const client of clients) {
        if (excludeClientId && client.id === excludeClientId)
            continue;
        const fields: ClientDuplicateField[] = [];
        if (nameKey && clientNames(client).includes(nameKey))
            fields.push('name');
        if (phoneKey && clientPhoneKey(client.phone) === phoneKey)
            fields.push('phone');
        if (redotpayKey && textKey(client.redotpayId) === redotpayKey)
            fields.push('redotpayId');
        if (binanceKey && textKey(client.binanceEmail) === binanceKey)
            fields.push('binanceEmail');
        if (fields.length > 0)
            matches.push({ client, fields, archived: !isClientActive(client) });
    }
    return matches.sort((a, b) => Number(a.archived) - Number(b.archived));
}
