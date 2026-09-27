import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AppBottomNav } from './AppNavigation';
import { MainHeaderBar } from './MainHeaderBar';
import { HEADER_ACTIONS_SLOT_ID } from './headerActionsSlot';

const noop = () => {};
const labels = {
    dashboard: 'Accueil', transactions: 'Opérations', portfolio: 'Portefeuille', analytics: 'Analyse', reports: 'Rapports',
    clients: 'Clients', treasury: 'Trésorerie', services: 'Services', investors: 'Investisseurs', more: 'Plus',
    settings: 'Paramètres', money: 'Argent', followUp: 'Suivi', documents: 'Documents', expenses: 'Mes dépenses',
    logout: 'Déconnexion', newOperation: 'Nouvelle opération',
};
const render = (node: React.ReactNode) => renderToStaticMarkup(<ThemeProvider>{node}</ThemeProvider>);
const buttonsOf = (html: string) => html.split('<button').slice(1).map((chunk) => chunk.slice(0, chunk.indexOf('</button>')));
const textOf = (chunk: string) => chunk.slice(chunk.indexOf('>') + 1).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// The bar holds Accueil, Opérations, (+), Clients and Plus, and marks the open page.
{
    const html = render(<AppBottomNav view="transactions" onSelect={noop} labels={labels} onNewOperation={noop}/>);
    const buttons = buttonsOf(html);
    assert.deepEqual(buttons.map(textOf), ['Accueil', 'Opérations', '', 'Clients', 'Plus']);
    assert.match(buttons[2], /aria-label="Nouvelle opération"/);
    assert.doesNotMatch(buttons[2], /disabled=""/);
    assert.deepEqual(buttons.map((button) => /aria-current="page"/.test(button)), [false, true, false, false, false]);
    // Pages, settings and logout stay in the closed Plus sheet: nothing else is drawn.
    assert.doesNotMatch(html, /Paramètres|Déconnexion|Trésorerie/);
}

// (+) waits for the data before it opens the menu.
{
    const [, , plus] = buttonsOf(render(<AppBottomNav view="dashboard" onSelect={noop} labels={labels}/>));
    assert.match(plus, /disabled=""/);
}

// A page reached from Plus lights Plus up.
{
    const buttons = buttonsOf(render(<AppBottomNav view="tresorerie" onSelect={noop} labels={labels} onNewOperation={noop}/>));
    assert.ok(buttons.every((button) => !/aria-current/.test(button)));
    assert.match(buttons[4], /font-bold text-financial-asset/);
    assert.doesNotMatch(buttons[0], /font-bold text-financial-asset/);
}

// Clients with overdue debts show on the Clients tab, capped at 9+.
{
    const clientsTab = (overdueCount: number) => buttonsOf(render(<AppBottomNav view="dashboard" onSelect={noop} labels={labels} overdueCount={overdueCount}/>))[3];
    assert.equal(textOf(clientsTab(3)), '3 Clients');
    assert.equal(textOf(clientsTab(12)), '9+ Clients');
    assert.equal(textOf(clientsTab(0)), 'Clients');
}

// On phones the header names the page, with the page's own buttons and search beside it.
{
    const header = (view: string) => {
        const html = render(<MainHeaderBar view={view} setView={noop} globalSearchTitle="Recherche Globale" handleOpenGlobalSearch={noop} onOpenSettings={noop} onSignOut={noop} labels={labels}/>);
        return html.slice(0, html.indexOf('sm:flex'));
    };
    const phone = header('dzd');
    assert.match(phone, /<h1[^>]*>Clients<\/h1>/);
    assert.match(phone, new RegExp(`<div id="${HEADER_ACTIONS_SLOT_ID}"`));
    // Only search is left there: ☰, theme and language moved to Plus.
    assert.deepEqual(buttonsOf(phone).map((button) => button.match(/aria-label="([^"]*)"/)?.[1]), ['Recherche Globale']);
    assert.match(header('statistiques'), /<h1[^>]*>Portefeuille<\/h1>/);
    assert.match(header('unknown'), /<h1[^>]*>Pro Digital<\/h1>/);
}

console.log('AppNavigation tests passed');
