import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppToast } from './AppToast';

const noop = () => {};

// A confirmation is announced politely, without its emoji and without a close button.
{
    const html = renderToStaticMarkup(<AppToast message="✅ Client archivé." tone="success" closeLabel="Fermer" onClose={noop}/>);
    assert.match(html, /role="status"/);
    assert.match(html, />Client archivé\.</);
    assert.doesNotMatch(html, /✅/);
    assert.doesNotMatch(html, /aria-label="Fermer"/);
}

// An error interrupts and stays until the user closes it.
{
    const html = renderToStaticMarkup(<AppToast message="❌ Erreur lors de la suppression du client." tone="error" closeLabel="Fermer" onClose={noop}/>);
    assert.match(html, /role="alert"/);
    assert.match(html, /aria-label="Fermer"/);
}

// The undo button only appears when the message offers one.
{
    const withUndo = renderToStaticMarkup(<AppToast message="✅ Client archivé." tone="success" closeLabel="Fermer" onClose={noop} actionLabel="Annuler" onAction={noop}/>);
    assert.match(withUndo, /<button[^>]*>.*Annuler<\/button>/);
    const withoutHandler = renderToStaticMarkup(<AppToast message="✅ Client archivé." tone="success" closeLabel="Fermer" onClose={noop} actionLabel="Annuler"/>);
    assert.doesNotMatch(withoutHandler, /Annuler/);
}

console.log('AppToast tests passed');
