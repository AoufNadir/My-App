import assert from 'node:assert/strict';
import type { ClientDzd } from '../types';
import { changedClientIdentity, clientNameKey, clientPhoneKey, findClientDuplicates, isClientActive, selectableClients } from './clientRegistry';

const active: ClientDzd = { id: 'a', fullName: 'Yacine Naceer', phone: '0550 12 34 56', redotpayId: 'RP-1', binanceEmail: 'yacine@mail.com' };
const archived: ClientDzd = { id: 'b', fullName: 'yacine  naceer', archived: true, isActive: false };
const legacy: ClientDzd = { id: 'c', fullName: '', nom: 'Benali', prenom: 'Karim' };
const other: ClientDzd = { id: 'd', fullName: 'Amine Saidi', phone: '0661000000' };
const clients = [active, archived, legacy, other];

// Deleted (archived) clients are never offered in pickers or search.
{
    assert.equal(isClientActive(active), true);
    assert.equal(isClientActive(archived), false);
    assert.equal(isClientActive({ isActive: false }), false);
    assert.equal(isClientActive(undefined), false);
    assert.deepEqual(selectableClients(clients).map((c) => c.id), ['a', 'c', 'd']);
}

// Editing an old operation keeps its archived client selectable.
{
    assert.deepEqual(selectableClients(clients, ['b']).map((c) => c.id), ['a', 'b', 'c', 'd']);
    assert.deepEqual(selectableClients(clients, ['none', null, '']).map((c) => c.id), ['a', 'c', 'd']);
}

// Names match regardless of case, accents, extra spaces and word order.
{
    assert.equal(clientNameKey('  Yacine   NACEER '), clientNameKey('naceer yacine'));
    assert.equal(clientNameKey('Hélène'), clientNameKey('helene'));
    assert.notEqual(clientNameKey('Yacine Naceer'), clientNameKey('Yacine Nacer'));
}

// Algerian phone formats collapse to one key.
{
    assert.equal(clientPhoneKey('0550 12 34 56'), '0550123456');
    assert.equal(clientPhoneKey('+213 550-12-34-56'), '0550123456');
    assert.equal(clientPhoneKey('00213550123456'), '0550123456');
    assert.equal(clientPhoneKey('12'), '');
}

// A new client with the same name finds both the active and the deleted one, active first.
{
    const matches = findClientDuplicates({ fullName: 'NACEER Yacine' }, clients);
    assert.deepEqual(matches.map((m) => [m.client.id, m.archived]), [['a', false], ['b', true]]);
    assert.deepEqual(matches[0].fields, ['name']);
}

// Phone, RedotPay ID and Binance email are each enough to warn.
{
    assert.deepEqual(findClientDuplicates({ fullName: 'X', phone: '+213550123456' }, clients).map((m) => m.fields), [['phone']]);
    assert.deepEqual(findClientDuplicates({ fullName: 'X', redotpayId: ' rp-1 ' }, clients).map((m) => m.fields), [['redotpayId']]);
    assert.deepEqual(findClientDuplicates({ fullName: 'X', binanceEmail: 'YACINE@mail.com' }, clients).map((m) => m.fields), [['binanceEmail']]);
}

// Legacy clients stored only as nom/prenom are checked too.
{
    assert.deepEqual(findClientDuplicates({ fullName: 'Karim Benali' }, clients).map((m) => m.client.id), ['c']);
}

// Editing a client does not flag the client itself; renaming onto another client does.
{
    assert.deepEqual(findClientDuplicates({ fullName: 'Amine Saidi', phone: '0661000000' }, clients, 'd'), []);
    assert.deepEqual(findClientDuplicates({ fullName: 'Amine Saidi' }, clients, 'a').map((m) => m.client.id), ['d']);
}

// On edit only changed fields are checked: a client that already shares its name with a
// deleted one can still be edited, but moving it onto another client's phone still warns.
{
    const restored: ClientDzd = { id: 'e', fullName: 'Yacine Naceer', phone: '0770111222' };
    const pool = [...clients, restored];
    const reformattedPhone = changedClientIdentity(restored, { fullName: 'yacine naceer', phone: '+213 770 11 12 22' });
    assert.deepEqual(reformattedPhone, { fullName: undefined, phone: undefined, redotpayId: undefined, binanceEmail: undefined });
    assert.deepEqual(findClientDuplicates(reformattedPhone, pool, 'e'), []);

    const movedPhone = changedClientIdentity(restored, { fullName: 'Yacine Naceer', phone: '0661 00 00 00' });
    assert.deepEqual(findClientDuplicates(movedPhone, pool, 'e').map((m) => [m.client.id, m.fields]), [['d', ['phone']]]);

    const renamed = changedClientIdentity(other, { fullName: 'Naceer Yacine', phone: other.phone });
    assert.deepEqual(findClientDuplicates(renamed, pool, 'd').map((m) => m.client.id), ['a', 'e', 'b']);
}

// Empty fields never match each other.
{
    assert.deepEqual(findClientDuplicates({ fullName: 'Nouveau Client', phone: '', redotpayId: '', binanceEmail: '' }, clients), []);
}

console.log('clientRegistry tests passed');
