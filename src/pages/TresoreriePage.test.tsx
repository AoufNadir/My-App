import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TresoreriePage, treasuryPdfRows } from './TresoreriePage';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';
import { buildTreasuryPdf } from '../utils/pdfReports';
import type { TreasuryTx } from '../types';

// A client pays 100 000 into the Caisse, then a project expense is paid with 100 USDT. The
// expense row carries no Caisse/BaridiMob source, so the balances rightly ignore it: no
// treasury view may show it as cash leaving the Caisse.
const nowTs = Date.now();
const date = new Date(nowTs).toLocaleDateString('fr-FR');
const cashIn = { id: 'cash-in', timestamp: nowTs - 120000, date, time: '09:00', type: 'Ajout', source: 'Caisse', amount: 100000, notes: 'Règlement client', origin: 'client_tx' } as TreasuryTx;
const usdtExpense = { id: 'usdt-expense', timestamp: nowTs - 60000, date, time: '10:00', type: 'Retrait', amount: 25000, notes: 'Frais du projet', origin: 'delivery_expense', expenseWallet: 'USDT', expenseCurrency: 'USDT', originalAmount: 100, amountDzd: 25000 } as TreasuryTx;
const legacyCash = { id: 'legacy', timestamp: nowTs - 30000, date, time: '11:00', type: 'Retrait', asset: 'DZD-Caisse', amount: 5000, notes: 'Ancien retrait' } as TreasuryTx & { asset: string };
const treasuryTransactions = [cashIn, usdtExpense, legacyCash];

// The PDF lists and totals cash movements only (legacy rows with only an asset field included).
{
    const rows = treasuryPdfRows(treasuryTransactions);
    assert.deepEqual(rows.map((row) => row.notes), ['Ancien retrait', 'Règlement client']);
    const text = buildTreasuryPdf(rows, { caisse: 95000, baridi: 0 }, 'test').html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.match(text, /Total sorties\s*−?\s*5 000/);
    assert.match(text, /Flux net \(période\)\s*\+\s*95 000/);
}

// "Mouvements récents" and the 7-day flow leave the USDT expense out.
{
    const html = renderToStaticMarkup(<TresoreriePage
        caisseBalance={95000}
        baridiBalance={0}
        capitalSnapshot={computeCapitalSnapshot({ caisseBalance: 95000, baridiBalance: 0, totalDettes: 0, totalAvances: 0 })}
        treasuryCards={[]}
        openTreasuryModal={() => {}}
        openTreasuryCardModal={() => {}}
        setTreasuryCardToDelete={() => {}}
        openTreasuryBalanceEditModal={() => {}}
        treasuryTransactions={treasuryTransactions}
    />);
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.match(text, /Règlement client/);
    assert.doesNotMatch(text, /Frais du projet/);
    assert.doesNotMatch(text, /25 000/);
}

// Inventory (V5-2): the card shows on the page when the page can save it, and is absent otherwise.
{
    const props = {
        caisseBalance: 95000,
        baridiBalance: 0,
        capitalSnapshot: computeCapitalSnapshot({ caisseBalance: 95000, baridiBalance: 0, totalDettes: 0, totalAvances: 0 }),
        treasuryCards: [],
        openTreasuryModal: () => {},
        openTreasuryCardModal: () => {},
        setTreasuryCardToDelete: () => {},
        openTreasuryBalanceEditModal: () => {},
        treasuryTransactions,
    };
    const without = renderToStaticMarkup(<TresoreriePage {...props}/>).replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(without, /Faire l’inventaire/);
    const withInventory = renderToStaticMarkup(<TresoreriePage {...props} userDocRef={{ collection: () => ({}) }} onCorrectInventory={() => {}} portfolioStats={{ usdt: { available: 10, locked: 5 }, eur: { available: 0, locked: 0 } }} transactions={[]}/>).replace(/<[^>]+>/g, ' ');
    assert.match(withInventory, /Faire l’inventaire/);
}

console.log('TresoreriePage tests passed');
