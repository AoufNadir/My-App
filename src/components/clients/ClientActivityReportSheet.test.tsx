import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ClientTransactionDzd, Tx } from '../../types';
import { toCents } from '../../utils/money';
import { buildClientActivityReport, listReportPeriods, monthPeriod, yearPeriod, type ReportLang, type ReportPeriod } from '../../utils/clientActivityReport';
import { ClientActivityReportSheet } from './ClientActivityReportSheet';
import { formatDzdCents } from './clientActivityReportText';

// The report goes to the client. Whatever the period, the language, the variant or the balance
// switch, it never shows what is ours: our buy price and profit, the smart-pricing segment and
// score, notes and tags, another client's name, our EUR cost hidden in a DZD amount, a service's
// margin. It shows only the currencies the client bought, and ends on the client page balance.

const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime();
const NOW = at(9, 3, 18);
let seq = 0;
const row = (clientId: string, timestamp: number, montant: number, type: ClientTransactionDzd['type'], extra: Partial<ClientTransactionDzd> = {}): ClientTransactionDzd => {
    seq += 1;
    return { id: `r${seq}`, clientId, timestamp, date: '', time: '', montant, type, notes: 'NOTE-SECRET', ...extra };
};
// Ours: the price we bought at, the profit, smart pricing, notes and tags.
const secret = { price: 243.17, profit: 6891.55, spSegment: 'risky', spScore: 0.8642, notes: 'NOTE-SECRET', tags: ['TAG-SECRET'] } as Partial<Tx>;
const transactions: Tx[] = [];
const rows: ClientTransactionDzd[] = [];
function sale(clientId: string, timestamp: number, currency: 'USDT' | 'EUR', quantity: number, sell: number, credit: boolean) {
    const tx = { id: `tx${transactions.length + 1}`, type: 'sell', currency, quantity, sell, total: quantity * sell, date: '', time: '', timestamp, ...secret } as Tx;
    transactions.push(tx);
    rows.push(row(clientId, timestamp, -quantity * sell, currency === 'USDT' ? 'Vente USDT' : 'Vente EUR', { linkedTxId: tx.id, linkRole: 'primary', paymentMethod: credit ? 'Crédit' : 'Espèces', affectsBalance: credit }));
}

// c1 buys USDT and EUR, on credit and cash, pays, gets a transfer from c2, buys a service.
rows.push(row('c1', at(7, 1, 9), -20000, 'Solde Initial', { paymentMethod: 'Crédit' }));
sale('c1', at(7, 3), 'USDT', 1000, 250, true);
sale('c1', at(7, 12), 'EUR', 300, 262.5, false);
rows.push(row('c1', at(7, 20), 150000, 'Règlement Reçu', { paymentMethod: 'Espèces', linkedTxId: 'treasury-1' }));
sale('c1', at(8, 2), 'USDT', 800, 249.5, true);
// USDT paid in EUR: its DZD amount is 470 € at our EUR cost (267.13), 125 551,10 DZD.
const eurSale = { id: 'tx-eur', type: 'sell', currency: 'USDT', quantity: 500, sell: 0, total: 0, settlementCurrency: 'EUR', sellPriceEur: 0.94, saleValueEur: 470, eurToDzdRateAtSale: 267.13, date: '', time: '', timestamp: at(8, 24), ...secret } as Tx;
transactions.push(eurSale);
rows.push(row('c1', at(8, 24), -470 * 267.13, 'Vente USDT', { linkedTxId: 'tx-eur', linkRole: 'primary', paymentMethod: 'Espèces', affectsBalance: false }));
// The client sells us USDT paid in EUR: the DZD amount (280 € at our cost, 74 796,40) is ours too.
const eurBuy = { id: 'tx-eur-buy', type: 'buy', currency: 'USDT', quantity: 300, price: 0, total: 0, purchaseFundingCurrency: 'EUR', purchaseAmountEur: 280, date: '', time: '', timestamp: at(8, 25) } as Tx;
transactions.push(eurBuy);
rows.push(row('c1', at(8, 25), 280 * 267.13, 'Règlement Reçu', { linkedTxId: 'tx-eur-buy', linkRole: 'primary', paymentMethod: 'EUR', affectsBalance: false }));
rows.push(row('c2', at(8, 26), 15000, 'Transfert Sortant', { paymentMethod: 'Crédit', notes: 'Transfert vers SECRETNAME' }));
rows.push(row('c1', at(8, 26, 13), -15000, 'Transfert Entrant', { paymentMethod: 'Crédit', notes: 'Transfert de SECRETNAME' }));
rows.push(row('c1', at(8, 28), -12500, 'Vente service numérique', { paymentMethod: 'Crédit', affectsBalance: true, origin: 'digital_service_sale', notes: 'Netflix - Achat 9 363 DZD - Marge 3 137 DZD' }));
// A service paid in USDT: its DZD amount is our valuation of the USDT.
rows.push(row('c1', at(8, 29), -8765.43, 'Vente service numérique', { paymentMethod: 'USDT', affectsBalance: false, origin: 'digital_service_sale' }));
sale('c1', at(9, 2), 'USDT', 1200, 250.25, true);
// Another client's rows never reach the report.
sale('c2', at(8, 3), 'EUR', 999, 271.11, true);

const FORBIDDEN: Array<[RegExp, string]> = [
    [/243[.,]17/, 'our buy price'],
    [/6[\s\u00A0\u202F]?891/, 'our profit'],
    [/risky/i, 'smart-pricing segment'],
    [/0[.,]8642|86[.,]42/, 'smart-pricing score'],
    [/NOTE-SECRET|note interne/, 'notes'],
    [/TAG-SECRET/, 'tags'],
    [/SECRETNAME/, 'another client\'s name'],
    [/267[.,]13/, 'our EUR cost'],
    [/125[\s\u00A0\u202F]?551/, 'the DZD value of a sale settled in EUR'],
    [/74[\s\u00A0\u202F]?796/, 'the DZD value of a purchase paid in EUR'],
    [/Marge|3[\s\u00A0\u202F]137|9[\s\u00A0\u202F]363/, 'a service\'s cost and margin'],
    [/8[\s\u00A0\u202F]?765/, 'the DZD value of a service paid in USDT'],
    [/271[.,]11|999/, 'another client\'s operations'],
];
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"');
const render = (period: ReportPeriod, lang: ReportLang, showBalance: boolean, variant: 'print' | 'screen', clientId = 'c1', clientName = 'Client Test') => {
    const report = buildClientActivityReport({ clientId, clientRows: rows, transactions, period, now: NOW });
    return text(renderToStaticMarkup(<ClientActivityReportSheet report={report} lang={lang} clientName={clientName} showBalance={showBalance} variant={variant}/>));
};

const firstAt = at(7, 1, 9);
const periods = [...listReportPeriods('week', firstAt, NOW), ...listReportPeriods('month', firstAt, NOW), ...listReportPeriods('year', firstAt, NOW)];
let rendered = 0;
for (const period of periods)
    for (const lang of ['ar', 'fr'] as const)
        for (const showBalance of [true, false])
            for (const variant of ['print', 'screen'] as const) {
                const page = render(period, lang, showBalance, variant);
                for (const [pattern, what] of FORBIDDEN)
                    assert.doesNotMatch(page, pattern, `${period.key} ${lang} ${showBalance ? 'with' : 'without'} balance (${variant}): ${what} must never be shown`);
                rendered += 1;
            }
assert.ok(rendered >= 80, `every period, language, variant and balance setting rendered (${rendered})`);

// The EUR legs show what the client actually paid or received, in euros.
const september = render(monthPeriod(2026, 8), 'fr', true, 'print');
assert.match(september, /470,00\s€/, 'The USDT paid in EUR shows the 470 € the client paid');
assert.match(september, /280,00\s€/, 'The USDT sold to us for EUR shows the 280 € the client received');
assert.match(september, /Netflix|Service numérique/, 'The service is listed');
assert.doesNotMatch(september, /Netflix/, '…by its kind, never by its notes');

// It ends on the client page balance.
const pageBalanceCents = rows.filter((item) => item.clientId === 'c1' && item.affectsBalance !== false).reduce((sum, item) => sum + toCents(item.montant), 0);
for (const lang of ['ar', 'fr'] as const) {
    const october = render(monthPeriod(2026, 9), lang, true, 'print');
    const { showCents } = buildClientActivityReport({ clientId: 'c1', clientRows: rows, transactions, period: monthPeriod(2026, 9), now: NOW });
    const closing = formatDzdCents(pageBalanceCents, showCents);
    assert.ok(october.includes(`${closing} DZD`), `${lang}: the calculation ends on the client page balance (${closing})`);
    assert.match(october, lang === 'ar' ? /الباقي عليك/ : /Reste à payer/);
}

// Balance switched off: no balance, no debt, no balance column, no « on account ».
for (const lang of ['ar', 'fr'] as const)
    for (const period of [monthPeriod(2026, 8), monthPeriod(2026, 9), yearPeriod(2026)]) {
        const page = render(period, lang, false, 'print');
        const words = lang === 'ar' ? [/حساب رصيدك/, /الباقي عليك/, /الرصيد بعدها/, /على الحساب/, /عليك/] : [/Le calcul de votre solde/, /Reste à payer/, /Solde après/, /sur compte/, /à payer/];
        for (const word of words)
            assert.doesNotMatch(page, word, `${period.key} ${lang}: the balance is hidden (${word})`);
        const report = buildClientActivityReport({ clientId: 'c1', clientRows: rows, transactions, period, now: NOW });
        assert.ok(!page.includes(`${formatDzdCents(report.balance.closingCents, report.showCents)} DZD`), `${period.key} ${lang}: the closing balance is not shown`);
    }

// Only the currencies the client bought: a USDT-only client never sees euros.
rows.push(row('c3', at(8, 10), -500 * 250, 'Vente USDT', { linkedTxId: 'tx-c3', linkRole: 'primary', paymentMethod: 'Espèces', affectsBalance: false }));
transactions.push({ id: 'tx-c3', type: 'sell', currency: 'USDT', quantity: 500, sell: 250, total: 125000, date: '', time: '', timestamp: at(8, 10), ...secret } as Tx);
for (const lang of ['ar', 'fr'] as const)
    for (const period of [monthPeriod(2026, 8), yearPeriod(2026), ...listReportPeriods('week', at(8, 10), NOW)]) {
        const page = render(period, lang, true, 'print', 'c3', 'Nour');
        assert.doesNotMatch(page, /EUR|€|euro|اليورو|يورو/i, `${period.key} ${lang}: no euro anywhere for a USDT-only client`);
    }
assert.match(render(monthPeriod(2026, 8), 'ar', true, 'print', 'c3', 'Nour'), /500 USDT/);

console.log('client activity report sheet tests passed');
