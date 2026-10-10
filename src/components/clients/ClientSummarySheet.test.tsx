import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ClientTransactionDzd, Tx } from '../../types';
import { toCents } from '../../utils/money';
import { buildClientSummary, CLIENT_SUMMARY_OPERATION_COUNT, summaryAmountOf, summaryContextOf } from '../../utils/clientSummary';
import { classifyClientRow } from '../../utils/clientActivityReport';
import { ClientSummarySheet, clientSummaryMessage, summaryAmountText, summaryBalanceText } from './ClientSummarySheet';
import { summaryRowText } from './clientSummaryText';
import { formatDzdCents } from './clientActivityReportText';

// V4-4: the client summary picture and its WhatsApp message. Like the client report they go to
// the client: our buy price, profit, notes and another client's name never show; the balance is
// the client page balance; the last operations come newest first.

const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime();
const NOW = at(9, 10, 9);
let seq = 0;
const row = (clientId: string, timestamp: number, montant: number, type: ClientTransactionDzd['type'], extra: Partial<ClientTransactionDzd> = {}): ClientTransactionDzd => {
    seq += 1;
    return { id: `r${seq}`, clientId, timestamp, date: '', time: '', montant, type, notes: 'NOTE-SECRET', ...extra };
};
const secret = { price: 243.17, profit: 6891.55, notes: 'NOTE-SECRET' } as Partial<Tx>;
const transactions: Tx[] = [];
const rows: ClientTransactionDzd[] = [];
function sale(clientId: string, timestamp: number, quantity: number, sell: number, credit: boolean) {
    const tx = { id: `tx${transactions.length + 1}`, type: 'sell', currency: 'USDT', quantity, sell, total: quantity * sell, date: '', time: '', timestamp, ...secret } as Tx;
    transactions.push(tx);
    rows.push(row(clientId, timestamp, -quantity * sell, 'Vente USDT', { linkedTxId: tx.id, linkRole: 'primary', paymentMethod: credit ? 'Crédit' : 'Espèces', affectsBalance: credit }));
}
rows.push(row('c1', at(8, 1, 9), -20000, 'Solde Initial', { paymentMethod: 'Crédit' }));
sale('c1', at(8, 3), 1000, 250, true);
rows.push(row('c1', at(8, 10), 150000, 'Règlement Reçu', { paymentMethod: 'Espèces' }));
sale('c1', at(8, 20), 300, 251.5, false);
sale('c1', at(9, 1), 800, 249.5, true);
rows.push(row('c2', at(9, 2), 15000, 'Transfert Sortant', { paymentMethod: 'Crédit', notes: 'Transfert vers SECRETNAME' }));
rows.push(row('c1', at(9, 2, 13), -15000, 'Transfert Entrant', { paymentMethod: 'Crédit', notes: 'Transfert de SECRETNAME' }));
sale('c1', at(9, 5), 400, 252, true);
sale('c2', at(9, 6), 999, 271.11, true);

const summary = buildClientSummary({ clientId: 'c1', clientRows: rows, transactions, now: NOW });
const pageBalanceCents = rows.filter((item) => item.clientId === 'c1' && item.affectsBalance !== false).reduce((sum, item) => sum + toCents(item.montant), 0);
assert.equal(summary.balanceCents, pageBalanceCents, 'the summary ends on the client page balance');
assert.equal(summary.operationCount, 7, 'every row of the client, and only theirs');
assert.equal(summary.lastOperations.length, CLIENT_SUMMARY_OPERATION_COUNT, 'five operations');
assert.deepEqual(summary.lastOperations.map((entry) => entry.timestamp), [...summary.lastOperations.map((entry) => entry.timestamp)].sort((a, b) => b - a), 'newest first');
assert.equal(summary.lastOperations[0].timestamp, at(9, 5), 'the latest operation leads');

const text = (html: string) => html.replace(/<[^>]+>/g, ' ');
const FORBIDDEN: Array<[RegExp, string]> = [
    [/243[.,]17/, 'our buy price'],
    [/6[\s  ]?891/, 'our profit'],
    [/NOTE-SECRET/, 'notes'],
    [/SECRETNAME/, 'another client\'s name'],
    [/271[.,]11|999/, 'another client\'s operations'],
];
for (const lang of ['ar', 'fr'] as const) {
    const picture = text(renderToStaticMarkup(<ClientSummarySheet summary={summary} lang={lang} clientName="Client Test"/>));
    const message = clientSummaryMessage(summary, lang, 'Client Test');
    for (const [pattern, what] of FORBIDDEN) {
        assert.doesNotMatch(picture, pattern, `${lang} picture: ${what} is never shown`);
        assert.doesNotMatch(message, pattern, `${lang} message: ${what} is never sent`);
    }
    const balance = `${formatDzdCents(pageBalanceCents, true)} DZD`;
    assert.ok(picture.includes(balance), `${lang} picture shows the balance with two decimals (${balance})`);
    assert.ok(message.includes(balance), `${lang} message gives the balance`);
    assert.match(message, lang === 'ar' ? /الباقي عليك/ : /Reste à payer/, `${lang}: the side of the balance is said`);
    assert.equal(message.split('\n').filter((line) => line.startsWith('• ')).length, CLIENT_SUMMARY_OPERATION_COUNT, `${lang}: five operations in the message`);
    assert.doesNotMatch(message, /[⁦⁩]/, `${lang}: no invisible isolate characters in a WhatsApp message`);
}

// The picture is phone-wide (420px), not the A4 sheet: its text stays readable in a chat without zooming.
const wide = renderToStaticMarkup(<ClientSummarySheet summary={summary} lang="fr" clientName="Client Test"/>);
assert.match(wide, /w-\[420px\]/, 'the picture is phone-wide');
assert.doesNotMatch(wide, /w-\[794px\]/, 'and not the A4 sheet');

// A client without any operation still gets a picture and a message.
const empty = buildClientSummary({ clientId: 'none', clientRows: rows, transactions, now: NOW });
assert.equal(empty.balanceCents, 0);
assert.equal(empty.lastOperations.length, 0);
assert.match(text(renderToStaticMarkup(<ClientSummarySheet summary={empty} lang="fr" clientName="Nouveau"/>)), /Aucune opération/);

// V6-1: every kind of row is written from the client's side, in plain words, in both languages.
{
    const sellTx = (id: string, extra: Partial<Tx> = {}) => ({ id, type: 'sell', currency: 'USDT', quantity: 207.52, sell: 252.51, total: 52400, date: '', time: '', timestamp: at(9, 1), ...secret, ...extra }) as Tx;
    const buyTx = (id: string, extra: Partial<Tx> = {}) => ({ id, type: 'buy', currency: 'USDT', quantity: 300, price: 250, total: 75000, date: '', time: '', timestamp: at(9, 1), ...secret, ...extra }) as Tx;
    const mk = (type: ClientTransactionDzd['type'], montant: number, extra: Partial<ClientTransactionDzd> = {}) => row('k', at(9, 1), montant, type, extra);
    const read = (clientRow: ClientTransactionDzd, linked: Tx | undefined, lang: 'ar' | 'fr') => {
        const entry = classifyClientRow(clientRow, linked);
        return summaryRowText(entry, summaryContextOf(clientRow, linked), lang);
    };
    const line = (clientRow: ClientTransactionDzd, linked: Tx | undefined, lang: 'ar' | 'fr') => {
        const out = read(clientRow, linked, lang);
        return [out.title, ...out.details].join(' | ').replace(/[⁦⁩]/g, '').replace(/\u00A0/g, ' ');
    };

    // Bought on credit: the quantity, the price per unit, and « on your account ».
    const onCredit = mk('Vente USDT', -52400, { paymentMethod: 'Crédit', linkedTxId: 's1' });
    assert.equal(line(onCredit, sellTx('s1'), 'fr'), 'Achat de 207,52 USDT | à 252,51 DZD / USDT | porté sur votre compte');
    assert.equal(line(onCredit, sellTx('s1'), 'ar'), 'اشتريتَ 207,52 USDT | بسعر 252,51 DZD لكل USDT | سُجّلت على حسابك');
    // Bought and paid on the spot: how it was paid is said, and the amount carries no sign.
    const paidCash = mk('Vente USDT', -52400, { paymentMethod: 'Espèces', affectsBalance: false, linkedTxId: 's1' });
    assert.match(line(paidCash, sellTx('s1'), 'fr'), /payé en espèces$/);
    assert.match(line(paidCash, sellTx('s1'), 'ar'), /دفعتَ نقداً$/);
    assert.equal(summaryAmountOf(classifyClientRow(paidCash, sellTx('s1'))).sign, '', 'settled on the spot: no sign');
    assert.equal(summaryAmountOf(classifyClientRow(onCredit, sellTx('s1'))).sign, '−', 'on credit: against the client');
    // Paid by BaridiMob into another client's account (never named).
    const viaOther = mk('Vente USDT', -52400, { paymentMethod: 'BaridiMob', affectsBalance: false, linkedTxId: 's2' });
    assert.match(line(viaOther, sellTx('s2', { linkedClientDzdId: 'other' } as Partial<Tx>), 'fr'), /payé par BaridiMob sur le compte d’un autre client$/);
    assert.match(line(viaOther, sellTx('s2', { linkedClientDzdId: 'other' } as Partial<Tx>), 'ar'), /دفعتَ عبر BaridiMob إلى حساب عميل آخر$/);
    // Sold to us, paid on the spot or through another client.
    const soldCash = mk('Règlement Reçu', 75000, { paymentMethod: 'Espèces', affectsBalance: false, linkedTxId: 'b1' });
    assert.equal(line(soldCash, buyTx('b1'), 'fr'), 'Vente de 300 USDT à ProDigital | à 250,00 DZD / USDT | montant reçu en espèces');
    assert.equal(line(soldCash, buyTx('b1'), 'ar'), 'بعتَ لنا 300 USDT | بسعر 250,00 DZD لكل USDT | استلمتَ المبلغ نقداً');
    const soldVia = mk('Règlement Reçu', 75000, { paymentMethod: 'Espèces', affectsBalance: false, linkedTxId: 'b2' });
    assert.match(line(soldVia, buyTx('b2', { linkedClientDzdId: 'other' } as Partial<Tx>), 'fr'), /montant reçu via le compte d’un autre client$/);
    // What the client pays us and takes from us.
    assert.equal(line(mk('Règlement Reçu', 5000, { paymentMethod: 'Espèces' }), undefined, 'fr'), 'Versement en espèces');
    assert.equal(line(mk('Règlement Reçu', 7000, { paymentMethod: 'BaridiMob' }), undefined, 'ar'), 'دفعتَ لنا عبر BaridiMob');
    assert.equal(line(mk('Paiement Effectué', -3000, { paymentMethod: 'Espèces' }), undefined, 'fr'), 'Retrait en espèces');
    assert.equal(line(mk('Paiement Effectué', -3000, { paymentMethod: 'BaridiMob' }), undefined, 'ar'), 'استلمتَ منا عبر BaridiMob');
    // The other client's side of a sale paid to them, and of a purchase they paid for us.
    const received = mk('Paiement Effectué', -52400, { paymentMethod: 'BaridiMob', linkRole: 'dzd_receiver', linkedTxId: 's2' });
    assert.equal(line(received, sellTx('s2', { linkedClientDzdId: 'k' } as Partial<Tx>), 'fr'), 'Paiement d’un autre client reçu par BaridiMob | déduit de votre solde');
    assert.equal(line(received, sellTx('s2', { linkedClientDzdId: 'k' } as Partial<Tx>), 'ar'), 'استلمتَ دفعة عميل آخر عبر BaridiMob | خُصمت من رصيدك');
    const advanced = mk('Ajustement Solde', 75000, { paymentMethod: 'Crédit', linkRole: 'dzd_receiver', linkedTxId: 'b2' });
    assert.equal(line(advanced, buyTx('b2', { linkedClientDzdId: 'k' } as Partial<Tx>), 'fr'), 'Règlement en espèces à un autre client pour notre compte | crédité sur votre solde');
    // Transfers between client accounts: the direction, no name, no channel that the row does not say.
    const transferIn = mk('Transfert Sortant', 12000, { paymentMethod: 'Crédit', notes: 'Transfert vers SECRETNAME BaridiMob' });
    const transferOut = mk('Transfert Entrant', -9000, { paymentMethod: 'Crédit', notes: 'Transfert de SECRETNAME' });
    assert.equal(line(transferIn, undefined, 'fr'), 'Transfert reçu d’un autre compte client');
    assert.equal(line(transferOut, undefined, 'fr'), 'Transfert vers un autre compte client');
    assert.equal(line(transferIn, undefined, 'ar'), 'تحويل من حساب عميل آخر إلى حسابك');
    assert.equal(line(transferOut, undefined, 'ar'), 'تحويل من حسابك إلى حساب عميل آخر');
    assert.doesNotMatch(line(transferIn, undefined, 'fr') + line(transferIn, undefined, 'ar'), /SECRETNAME|BaridiMob/, 'a ledger transfer never claims a channel or a name');
    // Opening balance, forgiven debt, plain adjustment.
    assert.equal(line(mk('Solde Initial', -20000), undefined, 'fr'), 'Solde d’ouverture');
    assert.equal(line(mk('Remise solde', 4000), undefined, 'fr'), 'Remise sur votre dette');
    assert.equal(line(mk('Ajustement Solde', 100), undefined, 'ar'), 'تعديل: إضافة إلى رصيدك');
    // A purchase settled in euros: the euros are the amount, the DZD valuation of them never shows.
    const eurTx = sellTx('s3', { settlementCurrency: 'EUR', saleValueEur: 250 } as Partial<Tx>);
    const eurRow = mk('Vente USDT', -52400, { paymentMethod: 'Espèces', affectsBalance: false, linkedTxId: 's3' });
    const eurEntry = classifyClientRow(eurRow, eurTx);
    assert.equal(summaryAmountText(eurEntry), '250,00 €');
    assert.match(line(eurRow, eurTx, 'fr'), /payé en euros$/);
    assert.doesNotMatch(line(eurRow, eurTx, 'fr'), /DZD/, 'no DZD value of our own EUR cost');
}

// V6-1: the picture is one language, its numbers always have two decimals and end on one line.
{
    const kr: ClientTransactionDzd[] = [];
    const ktx: Tx[] = [];
    const stamp = (n: number) => at(9, n);
    kr.push(row('k', stamp(1), -20000, 'Solde Initial', { paymentMethod: 'Crédit' }));
    ktx.push({ id: 'ks1', type: 'sell', currency: 'USDT', quantity: 207.52, sell: 252.51, total: 52400, date: '', time: '', timestamp: stamp(2), ...secret } as Tx);
    kr.push(row('k', stamp(2), -52400, 'Vente USDT', { paymentMethod: 'Crédit', linkedTxId: 'ks1', linkRole: 'primary' }));
    kr.push(row('k', stamp(3), 12000, 'Transfert Sortant', { paymentMethod: 'Crédit' }));
    kr.push(row('k', stamp(4), 125000.5, 'Règlement Reçu', { paymentMethod: 'Espèces' }));
    kr.push(row('k', stamp(5), -91000, 'Paiement Effectué', { paymentMethod: 'BaridiMob' }));
    kr.push(row('k', stamp(6), -253000, 'Transfert Entrant', { paymentMethod: 'Crédit' }));
    const sum = buildClientSummary({ clientId: 'k', clientRows: kr, transactions: ktx, now: NOW });
    const finalBalance = kr.reduce((total, item) => total + toCents(item.montant), 0);
    assert.equal(sum.balanceCents, finalBalance, 'still the client page balance');
    assert.equal(sum.lastRows[0].balanceAfterCents, finalBalance, 'the newest row ends on the balance');
    for (let i = 0; i < sum.lastRows.length - 1; i += 1)
        assert.equal(sum.lastRows[i].balanceAfterCents - sum.lastRows[i + 1].balanceAfterCents, sum.lastRows[i].entry.balanceCents, `the balance after row ${i} follows from the row before`);
    for (const item of sum.lastRows) {
        assert.match(summaryAmountText(item.entry), /^[+−]?\d{1,3}(?:[\s ]\d{3})*,\d{2}$/, 'a DZD amount: always two decimals');
        assert.match(summaryBalanceText(item.balanceAfterCents).text, /^[+−]?\d{1,3}(?:[\s ]\d{3})*,\d{2}$/, 'a balance: always two decimals');
    }
    assert.equal(summaryAmountText(sum.lastRows[2].entry), '+125\u00A0000,50', 'cents are kept');
    for (const lang of ['ar', 'fr'] as const) {
        const html = renderToStaticMarkup(<ClientSummarySheet summary={sum} lang={lang} clientName="Client Test"/>);
        const body = text(html);
        assert.equal((html.match(/min-w-\[112px\]/g) || []).length, sum.lastRows.length * 2, `${lang}: amount and balance of every row share one number block`);
        assert.ok((html.match(/dir="ltr"/g) || []).length >= sum.lastRows.length * 2, `${lang}: numbers read left to right`);
        if (lang === 'fr')
            assert.doesNotMatch(body, /[؀-ۿ]/, 'a French picture has no Arabic');
        else
            assert.doesNotMatch(body.replace(/ProDigital|DZD|USDT|EUR|BaridiMob|R-[A-Z0-9-]+|Client Test/g, ''), /[A-Za-z]{2,}/, 'an Arabic picture has no stray French or English');
        assert.match(body, lang === 'fr' ? /Montant que ProDigital vous doit|Montant que vous devez à ProDigital/ : /هذا المبلغ (عليك|لك)/, `${lang}: the balance says what it means`);
        assert.match(body, lang === 'fr' ? /en votre faveur/ : /لصالحك/, `${lang}: the signs are explained`);
        assert.match(body, lang === 'fr' ? /Solde/ : /الرصيد/, `${lang}: the balance after each row is labelled`);
    }
}

console.log('client summary picture tests passed');
