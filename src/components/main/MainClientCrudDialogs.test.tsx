import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MainClientCrudDialogs, areMainClientCrudDialogsPropsEqual } from './MainClientCrudDialogs';
import type { ClientDuplicateMatch } from '../../utils/clientRegistry';

const noop = () => {};
const baseProps = {
    t: (key: string) => key,
    txToDelete: null, setTxToDelete: noop, handleDeleteConfirm: noop,
    clientTxToDelete: null, setClientTxToDelete: noop, handleDeleteClientTxConfirm: noop,
    isClientModalOpen: true, setIsClientModalOpen: noop, editingClient: null,
    clientFullName: 'Yacine Naceer', setClientFullName: noop, clientPhone: '', setClientPhone: noop,
    clientRedotpayId: '', setClientRedotpayId: noop, clientBinanceEmail: '', setClientBinanceEmail: noop,
    clientWallets: { TRC20: '', BEP20: '' }, setClientWallets: noop,
    clientNotes: '', setClientNotes: noop, clientCreditLimit: '', setClientCreditLimit: noop,
    clientGroup: '', setClientGroup: noop, clientIsFournisseur: false, setClientIsFournisseur: noop,
    initialBalance: '0', setInitialBalance: noop,
    handleSaveClient: noop, clientDuplicateMatches: null, confirmSaveClientDespiteDuplicates: noop,
    cancelClientDuplicateWarning: noop, restoreArchivedClient: noop, closeClientModal: noop,
    clientToDelete: null, clientDeleteMode: null, setClientToDelete: noop, handleDeleteClient: noop,
    isSaving: false,
};
// The disabled attribute, not the `disabled:` Tailwind classes every button carries.
const DISABLED_ATTR = /\sdisabled=""/;
const buttonTag = (html: string, label: string) => {
    const tag = html.match(new RegExp(`<button[^>]*>${label}</button>`));
    assert.ok(tag, `button "${label}" not rendered`);
    return tag[0];
};

// Two quick taps on Save created two identical clients: the Save button must lock while saving.
{
    const idle = renderToStaticMarkup(<MainClientCrudDialogs {...baseProps}/>);
    assert.doesNotMatch(buttonTag(idle, 'common.save'), DISABLED_ATTR);
    const saving = renderToStaticMarkup(<MainClientCrudDialogs {...baseProps} isSaving/>);
    assert.match(buttonTag(saving, 'common.save'), DISABLED_ATTR);
}

// The open dialog is memoized: a change of the saving state alone must re-render it.
{
    assert.equal(areMainClientCrudDialogsPropsEqual(baseProps, { ...baseProps }), true);
    assert.equal(areMainClientCrudDialogsPropsEqual(baseProps, { ...baseProps, isSaving: true }), false);
    assert.equal(areMainClientCrudDialogsPropsEqual({ ...baseProps, isSaving: true }, baseProps), false);
}

// The duplicate warning's save and restore buttons lock too.
{
    const matches: ClientDuplicateMatch[] = [{ client: { id: 'b', fullName: 'yacine naceer', archived: true, isActive: false }, fields: ['name'], archived: true }];
    const saving = renderToStaticMarkup(<MainClientCrudDialogs {...baseProps} clientDuplicateMatches={matches} isSaving/>);
    assert.match(buttonTag(saving, 'clients.duplicateSaveAnyway'), DISABLED_ATTR);
    assert.match(buttonTag(saving, 'clients.duplicateRestore'), DISABLED_ATTR);
    const idle = renderToStaticMarkup(<MainClientCrudDialogs {...baseProps} clientDuplicateMatches={matches}/>);
    assert.doesNotMatch(buttonTag(idle, 'clients.duplicateSaveAnyway'), DISABLED_ATTR);
}

// V4-2: the client window has one field per network for the wallet addresses of the client.
{
    // Invented addresses: random characters, not the address of anybody.
    const TRC20 = 'TSAyduyxxu5hxvF9Wjy7qqEgTR7ETpm5hx';
    const BEP20 = '0xe24cf6562ce66dad398c21b61a78f731554db18c';
    const inputOf = (html: string, label: string) => {
        const at = html.indexOf(`>${label}</label>`);
        assert.ok(at >= 0, `label "${label}" not rendered`);
        const tag = html.slice(at).match(/<input[^>]*>/);
        assert.ok(tag, `field "${label}" not rendered`);
        return tag[0];
    };
    const empty = renderToStaticMarkup(<MainClientCrudDialogs {...baseProps}/>);
    const trcField = inputOf(empty, 'clients.walletAddressLabel TRC20');
    const bepField = inputOf(empty, 'clients.walletAddressLabel BEP20');
    assert.match(trcField, /placeholder="T…"/);
    assert.match(bepField, /placeholder="0x…"/);
    for (const field of [trcField, bepField]) {
        assert.match(field, /dir="ltr"/, 'an address reads left to right in Arabic too');
        assert.match(field, /autoCapitalize="none"/, 'the keyboard does not capitalise the first letter');
        assert.match(field, /autoCorrect="off"/, 'the keyboard does not correct the address');
        assert.match(field, /spellCheck="false"/);
        assert.match(field, /value=""/);
    }
    // Both fields come after the Binance email and before the group.
    assert.ok(empty.indexOf('Binance Email') < empty.indexOf('clients.walletAddressLabel TRC20'));
    assert.ok(empty.indexOf('clients.walletAddressLabel TRC20') < empty.indexOf('clients.walletAddressLabel BEP20'));
    assert.ok(empty.indexOf('clients.walletAddressLabel BEP20') < empty.indexOf('clients.groupLabel'));

    const filled = renderToStaticMarkup(<MainClientCrudDialogs {...baseProps} clientWallets={{ TRC20, BEP20: '' }}/>);
    assert.match(inputOf(filled, 'clients.walletAddressLabel TRC20'), new RegExp(`value="${TRC20}"`));
    assert.match(inputOf(filled, 'clients.walletAddressLabel BEP20'), /value=""/);

    // A window opened without the wallet props (an older caller) still renders, with empty fields.
    const { clientWallets: _texts, setClientWallets: _setter, ...withoutWallets } = baseProps;
    const old = renderToStaticMarkup(<MainClientCrudDialogs {...withoutWallets}/>);
    assert.match(inputOf(old, 'clients.walletAddressLabel TRC20'), /value=""/);

    // The open window is memoized: typing an address must re-render it, and closed it stays as it is.
    const typed = { ...baseProps, clientWallets: { TRC20, BEP20: '' } };
    assert.equal(areMainClientCrudDialogsPropsEqual(baseProps, typed), false);
    assert.equal(areMainClientCrudDialogsPropsEqual(typed, { ...typed }), true);
    assert.equal(areMainClientCrudDialogsPropsEqual({ ...baseProps, isClientModalOpen: false }, { ...typed, isClientModalOpen: false }), true);
}

console.log('MainClientCrudDialogs tests passed');

// V5-4: « usual payment method » (none, cash or BaridiMob) in the client window; it travels with the rest of the form.
{
    const group = (html: string) => {
        const start = html.indexOf('aria-label="clients.usualChannel"');
        assert.ok(start >= 0, 'the usual payment method control is not rendered');
        return html.slice(start, html.indexOf('</div>', start));
    };
    const states = (html: string) => [...group(html).matchAll(/aria-pressed="(true|false)"[^>]*>([^<]*)</g)].map((match) => `${match[2]}:${match[1]}`);
    const withSetter = { ...baseProps, setClientUsualChannel: noop };
    assert.ok(!renderToStaticMarkup(<MainClientCrudDialogs {...baseProps}/>).includes('clients.usualChannel'), 'no control without its setter');
    assert.deepEqual(states(renderToStaticMarkup(<MainClientCrudDialogs {...withSetter}/>)), ['clients.usualChannelNone:true', 'transactions.cash:false', 'transactions.baridi:false']);
    assert.deepEqual(states(renderToStaticMarkup(<MainClientCrudDialogs {...withSetter} clientUsualChannel="baridi"/>)), ['clients.usualChannelNone:false', 'transactions.cash:false', 'transactions.baridi:true']);
    assert.deepEqual(states(renderToStaticMarkup(<MainClientCrudDialogs {...withSetter} clientUsualChannel="cash"/>)), ['clients.usualChannelNone:false', 'transactions.cash:true', 'transactions.baridi:false']);
    // A stray value reads as none.
    assert.equal(states(renderToStaticMarkup(<MainClientCrudDialogs {...withSetter} clientUsualChannel="credit"/>))[0], 'clients.usualChannelNone:true');
    // The open window re-renders when the choice changes.
    assert.equal(areMainClientCrudDialogsPropsEqual(withSetter, { ...withSetter }), true);
    assert.equal(areMainClientCrudDialogsPropsEqual(withSetter, { ...withSetter, clientUsualChannel: 'cash' }), false);
}
