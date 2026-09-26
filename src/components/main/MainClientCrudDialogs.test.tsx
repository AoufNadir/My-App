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
    assert.match(buttonTag(saving, 'Enregistrer quand même'), DISABLED_ATTR);
    assert.match(buttonTag(saving, 'Restaurer ce client'), DISABLED_ATTR);
    const idle = renderToStaticMarkup(<MainClientCrudDialogs {...baseProps} clientDuplicateMatches={matches}/>);
    assert.doesNotMatch(buttonTag(idle, 'Enregistrer quand même'), DISABLED_ATTR);
}

console.log('MainClientCrudDialogs tests passed');
