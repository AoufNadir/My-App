import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ClientTransactionDzd, Tx } from '../../types';
import { buildClientActivityReport, isSmallAmount, listReportPeriods, monthPeriod, parseDayKey, rangePeriod, yearPeriod, type ClientActivityReport, type ReportLang, type ReportPeriod } from '../../utils/clientActivityReport';
import { ClientActivityPhoneSheet } from './ClientActivityPhoneSheet';
import { PHONE_WORDS, inSentence } from './clientActivityPhoneText';
import { REPORT_WORDS, formatDate, formatDayMonth, formatDzdCents, formatEurPrice, formatPrice, formatQuantity } from './clientActivityReportText';

// The phone-size client report (V8-2) shows the A4 report's numbers, never what is ours, in
// text no smaller than 12.5px, with the account's state said before the calculation. V8-3: the
// price is the period's own (no other month), every operation is a sentence without + or − signs.

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
function sale(clientId: string, timestamp: number, currency: 'USDT' | 'EUR', quantity: number, sell: number, method: 'Crédit' | 'Espèces' | 'BaridiMob') {
    const tx = { id: `tx${transactions.length + 1}`, type: 'sell', currency, quantity, sell, total: quantity * sell, date: '', time: '', timestamp, ...secret } as Tx;
    transactions.push(tx);
    rows.push(row(clientId, timestamp, -quantity * sell, currency === 'USDT' ? 'Vente USDT' : 'Vente EUR', { linkedTxId: tx.id, linkRole: 'primary', paymentMethod: method, affectsBalance: method === 'Crédit' }));
}

// c1: every kind of row (USDT and EUR, credit and cash, payments, a transfer, a service, EUR legs).
rows.push(row('c1', at(7, 1, 9), -20000, 'Solde Initial', { paymentMethod: 'Crédit' }));
sale('c1', at(7, 3), 'USDT', 1000, 250, 'Crédit');
sale('c1', at(7, 12), 'EUR', 300, 262.5, 'Espèces');
rows.push(row('c1', at(7, 20), 150000, 'Règlement Reçu', { paymentMethod: 'Espèces', linkedTxId: 'treasury-1' }));
sale('c1', at(8, 2), 'USDT', 800, 249.5, 'Crédit');
sale('c1', at(8, 15), 'USDT', 600, 248.75, 'Crédit');
const eurSale = { id: 'tx-eur', type: 'sell', currency: 'USDT', quantity: 500, sell: 0, total: 0, settlementCurrency: 'EUR', sellPriceEur: 0.94, saleValueEur: 470, eurToDzdRateAtSale: 267.13, date: '', time: '', timestamp: at(8, 24), ...secret } as Tx;
transactions.push(eurSale);
rows.push(row('c1', at(8, 24), -470 * 267.13, 'Vente USDT', { linkedTxId: 'tx-eur', linkRole: 'primary', paymentMethod: 'Espèces', affectsBalance: false }));
const eurBuy = { id: 'tx-eur-buy', type: 'buy', currency: 'USDT', quantity: 300, price: 0, total: 0, purchaseFundingCurrency: 'EUR', purchaseAmountEur: 280, date: '', time: '', timestamp: at(8, 25) } as Tx;
transactions.push(eurBuy);
rows.push(row('c1', at(8, 25), 280 * 267.13, 'Règlement Reçu', { linkedTxId: 'tx-eur-buy', linkRole: 'primary', paymentMethod: 'EUR', affectsBalance: false }));
rows.push(row('c2', at(8, 26), 15000, 'Transfert Sortant', { paymentMethod: 'Crédit', notes: 'Transfert vers SECRETNAME' }));
rows.push(row('c1', at(8, 26, 13), -15000, 'Transfert Entrant', { paymentMethod: 'Crédit', notes: 'Transfert de SECRETNAME' }));
rows.push(row('c1', at(8, 28), -12500, 'Vente service numérique', { paymentMethod: 'Crédit', affectsBalance: true, origin: 'digital_service_sale', notes: 'Netflix - Achat 9 363 DZD - Marge 3 137 DZD' }));
rows.push(row('c1', at(8, 29), -8765.43, 'Vente service numérique', { paymentMethod: 'USDT', affectsBalance: false, origin: 'digital_service_sale' }));
sale('c1', at(9, 2), 'USDT', 1200, 250.25, 'Crédit');
sale('c2', at(8, 3), 'EUR', 999, 271.11, 'Crédit');

// k: the case that started the rebuild: USDT paid in cash, 3 DZD left from last month written off.
rows.push(row('k', at(8, 7, 9), 3, 'Remise solde', { paymentMethod: 'Crédit' }));
sale('k', at(7, 20), 'USDT', 2900, 249, 'Crédit');
rows.push(row('k', at(7, 21), 2900 * 249 - 3, 'Règlement Reçu', { paymentMethod: 'Espèces' }));
sale('k', at(8, 7), 'USDT', 2000, 247, 'Espèces');
sale('k', at(8, 15), 'USDT', 1774, 248, 'Espèces');
sale('k', at(8, 27), 'USDT', 2000, 250.5, 'Espèces');
// o: owes money. c: in credit. s: settled with nothing but cash. z: bought on credit, then paid it all.
sale('o', at(8, 3), 'USDT', 1200, 249, 'Crédit');
rows.push(row('o', at(8, 22), 150000, 'Règlement Reçu', { paymentMethod: 'BaridiMob' }));
rows.push(row('c', at(8, 1, 9), 500000, 'Règlement Reçu', { paymentMethod: 'BaridiMob' }));
sale('c', at(8, 9), 'USDT', 600, 249, 'Crédit');
sale('s', at(8, 4), 'USDT', 400, 250, 'Espèces');
sale('s', at(8, 18), 'USDT', 600, 251, 'Espèces');
sale('z', at(8, 3), 'USDT', 100, 250, 'Crédit');
rows.push(row('z', at(8, 10), 25000, 'Règlement Reçu', { paymentMethod: 'Espèces' }));

const FORBIDDEN: Array<[RegExp, string]> = [
    [/243[.,]17/, 'our buy price'],
    [/6[\s  ]?891/, 'our profit'],
    [/risky/i, 'smart-pricing segment'],
    [/0[.,]8642|86[.,]42/, 'smart-pricing score'],
    [/NOTE-SECRET|note interne/, 'notes'],
    [/TAG-SECRET/, 'tags'],
    [/SECRETNAME/, 'another client\'s name'],
    [/267[.,]13/, 'our EUR cost'],
    [/125[\s  ]?551/, 'the DZD value of a sale settled in EUR'],
    [/74[\s  ]?796/, 'the DZD value of a purchase paid in EUR'],
    [/Marge|3[\s  ]137|9[\s  ]363/, 'a service\'s cost and margin'],
    [/8[\s  ]?765/, 'the DZD value of a service paid in USDT'],
    [/271[.,]11|999/, 'another client\'s operations'],
];
const html = (period: ReportPeriod, lang: ReportLang, showBalance: boolean, variant: 'phone' | 'screen', clientId = 'c1', clientName = 'Client Test') => {
    const report = buildClientActivityReport({ clientId, clientRows: rows, transactions, period, now: NOW });
    return { report, markup: renderToStaticMarkup(<ClientActivityPhoneSheet report={report} lang={lang} clientName={clientName} showBalance={showBalance} variant={variant}/>) };
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"');
const render = (period: ReportPeriod, lang: ReportLang, showBalance = true, variant: 'phone' | 'screen' = 'phone', clientId = 'c1', clientName = 'Client Test') => text(html(period, lang, showBalance, variant, clientId, clientName).markup);
/** The page as one string, with the invisible direction marks of the numbers taken out. */
const plain = (page: string) => page.replace(/[\u2066\u2069]/g, '');

const firstAt = at(7, 1, 9);
const range = (start: string, end: string) => rangePeriod(parseDayKey(start, false)!, parseDayKey(end, true)!);
const RANGES = [range('2026-09-10', '2026-09-24'), range('2026-08-15', '2026-10-02'), range('2026-09-20', '2026-10-10'), range('2025-06-01', '2026-10-03')];
const periods = [...listReportPeriods('week', firstAt, NOW), ...listReportPeriods('month', firstAt, NOW), ...listReportPeriods('year', firstAt, NOW), ...RANGES];

// 1. Whatever the period, language, variant or switch, nothing of ours is shown, and no text is under 12.5px.
let rendered = 0;
for (const period of periods)
    for (const lang of ['ar', 'fr'] as const)
        for (const showBalance of [true, false])
            for (const variant of ['phone', 'screen'] as const) {
                const { markup } = html(period, lang, showBalance, variant);
                const page = text(markup);
                for (const [pattern, what] of FORBIDDEN)
                    assert.doesNotMatch(page, pattern, `${period.key} ${lang} (${variant}, balance ${showBalance}): ${what} must never be shown`);
                for (const size of markup.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g))
                    assert.ok(Number(size[1]) >= 12.5, `${period.key} ${lang}: text-[${size[1]}px] is smaller than 12.5px`);
                assert.doesNotMatch(markup, /text-xs|text-\[(?:9|10|11)(?:\.\d)?px\]|text-\[12px\]/, `${period.key} ${lang}: no small text class`);
                assert.doesNotMatch(markup, /<small(?![^>]*text-\[)/, `${period.key} ${lang}: every <small> carries its own size`);
                rendered += 1;
            }
assert.ok(rendered >= 100, `every period, language, variant and switch rendered (${rendered})`);

// 2. Every number of the A4 report is still on the new pages (the weekly change % and the three-period chips are what it drops).
const expectedNumbers = (report: ClientActivityReport, lang: ReportLang, showBalance: boolean): Array<[string, string]> => {
    const money = (cents: number) => formatDzdCents(cents, report.showCents);
    const list: Array<[string, string]> = [];
    if (report.totals.spentCents > 0)
        list.push([money(report.totals.spentCents), 'the amount spent']);
    for (const card of report.currencyCards) {
        if (card.quantity > 0)
            list.push([formatQuantity(card.quantity), `${card.currency} quantity`]);
        if (card.dzdQuantity > 0)
            list.push([formatPrice(card.dzdCents / 100 / card.dzdQuantity), `${card.currency} average price`]);
        if (card.priceRange) {
            list.push([formatPrice(card.priceRange.min), `${card.currency} lowest price`]);
            list.push([formatPrice(card.priceRange.max), `${card.currency} highest price`]);
        }
    }
    list.push([PHONE_WORDS[lang].purchaseCount(report.totals.purchaseCount), 'the number of purchases']);
    if (showBalance) {
        list.push([money(report.balance.closingCents), 'the closing balance']);
        for (const [key, cents] of Object.entries(report.balance.lines))
            if (cents !== 0)
                list.push([money(cents), `balance line ${key}`]);
        if (report.balance.openingCents !== 0)
            list.push([money(report.balance.openingCents), 'the opening balance']);
    }
    for (const part of report.comparison)
        if (part.totals.spentCents > 0)
            list.push([money(part.totals.spentCents), `${part.period.key} spending`]);
    for (const operation of report.operations) {
        const { entry } = operation;
        if (entry.dzdCents !== null)
            list.push([money(entry.dzdCents), `${entry.id} amount`]);
        list.push([formatDayMonth(entry.timestamp), `${entry.id} date`]);
        if (entry.quantity && entry.currency)
            list.push([formatQuantity(entry.quantity), `${entry.id} quantity`]);
        if (showBalance && entry.affectsBalance && report.operations.some((item) => Math.abs(item.balanceAfterCents) >= 1))
            list.push([formatDzdCents(operation.balanceAfterCents, report.showCents), `${entry.id} balance after`]);
    }
    if (report.sinceJanuary)
        list.push([formatQuantity(report.sinceJanuary.quantities.USDT), 'since January']);
    if (report.biggestPurchase?.quantity)
        list.push([formatQuantity(report.biggestPurchase.quantity), 'the biggest purchase']);
    return list;
};
for (const period of [monthPeriod(2026, 7), monthPeriod(2026, 8), monthPeriod(2026, 9), yearPeriod(2026), ...RANGES])
    for (const lang of ['ar', 'fr'] as const)
        for (const showBalance of [true, false]) {
            const { report, markup } = html(period, lang, showBalance, 'phone');
            const page = text(markup);
            for (const [expected, what] of expectedNumbers(report, lang, showBalance))
                assert.ok(page.includes(expected), `${period.key} ${lang} (balance ${showBalance}): « ${expected} » (${what}) is on the phone report`);
        }

// 3. The EUR legs show what the client actually paid or received, in euros.
const september = render(monthPeriod(2026, 8), 'fr');
assert.match(september, /470,00\s+€/);
assert.match(september, /280,00\s+€/);
assert.match(september, /service numérique/);
assert.doesNotMatch(september, /Netflix/, '…by its kind, never by its notes');

// 4. The account's state is said before the calculation: owing, in credit, settled.
const STATES: Array<[string, RegExp, RegExp, RegExp]> = [
    ['o', /الباقي عليك/, /Reste à payer/, /Vous pouvez régler/],
    ['c', /الباقي لك/, /Reste en votre faveur/, /Solde en votre faveur/],
    ['s', /حسابك مسوّى/, /Votre compte est réglé/, /Rien à payer/],
];
for (const [clientId, ar, fr, frSub] of STATES) {
    const arPage = html(monthPeriod(2026, 8), 'ar', true, 'phone', clientId, 'X').markup;
    const frPage = html(monthPeriod(2026, 8), 'fr', true, 'phone', clientId, 'X').markup;
    assert.match(text(arPage), ar, `${clientId}: the Arabic status`);
    assert.match(text(frPage), fr, `${clientId}: the French status`);
    assert.match(text(frPage), frSub, `${clientId}: the French status line`);
    // The status comes before the details (the second page).
    assert.ok(arPage.indexOf(text(arPage).match(ar)![0]) < arPage.indexOf('data-pdf-newpage'), `${clientId}: the status is on the summary page`);
}
assert.match(render(monthPeriod(2026, 8), 'fr', true, 'phone', 'o'), /Votre compte, pas à pas/);
// A client who owes sees his debt in the calculation's last line, on the client page balance.
{
    const { report, markup } = html(monthPeriod(2026, 8), 'fr', true, 'phone', 'o', 'X');
    assert.ok(text(markup).includes(`${formatDzdCents(report.balance.closingCents, report.showCents)} DZD`), 'the calculation ends on the closing balance');
    assert.ok(report.balance.closingCents < 0);
}

// 5. Balance switched off: no balance, no debt, no status, no calculation, no balance after (payments stay).
for (const lang of ['ar', 'fr'] as const)
    for (const period of [monthPeriod(2026, 8), monthPeriod(2026, 9), yearPeriod(2026), ...RANGES]) {
        const page = render(period, lang, false);
        const words = lang === 'ar'
            ? [/حسابك خطوة بخطوة/, /الباقي عليك/, /الباقي لك/, /حسابك مسوّى/, /بعدها/, /على حسابك/, /لم تدفعها بعد/, /عليك/]
            : [/Votre compte, pas à pas/, /Reste à payer/, /Reste en votre faveur/, /Votre compte est réglé/, /Ensuite/, /Inscrit sur votre compte/, /pas encore payé/, /à payer/];
        for (const word of words)
            assert.doesNotMatch(page, word, `${period.key} ${lang}: the balance is hidden (${word})`);
        const report = buildClientActivityReport({ clientId: 'c1', clientRows: rows, transactions, period, now: NOW });
        assert.ok(!page.includes(`${formatDzdCents(report.balance.closingCents, report.showCents)} DZD`), `${period.key} ${lang}: the closing balance is not shown`);
    }
assert.match(render(monthPeriod(2026, 7), 'fr', false), /Total payé/, 'Without the balance, what the client paid is said');

// 6. V8-3: the price is the period's own. Nothing is compared with another month (no arrow, no « more than », no spend chip),
//    and the lowest and highest prices stay.
for (const lang of ['ar', 'fr'] as const)
    for (const period of [monthPeriod(2026, 8), monthPeriod(2026, 9), yearPeriod(2026), ...RANGES]) {
        const page = plain(render(period, lang));
        assert.doesNotMatch(page, /[▲▼]/, `${period.key} ${lang}: no arrow`);
        assert.doesNotMatch(page, /أكثر من|أقل من|مثل (?:أوت|جويلية|سبتمبر)|نفس سعر|الفترة السابقة|qu’en|de plus|de moins|Autant|Même prix|période précédente/, `${period.key} ${lang}: no comparison with another period`);
    }
assert.match(render(monthPeriod(2026, 8), 'fr'), /Plus bas/, 'The lowest price stays');
assert.match(render(monthPeriod(2026, 8), 'fr'), /Plus haut/, 'The highest price stays');
{
    const { report, markup } = html(monthPeriod(2026, 8), 'ar', true, 'phone');
    const usdt = report.currencyCards.find((card) => card.currency === 'USDT')!;
    assert.ok(text(markup).includes(formatPrice(usdt.dzdCents / 100 / usdt.dzdQuantity)), 'The month\'s own average price is the one shown');
}

// 7. A small amount stays on the report, lighter and explained, never as a green gain.
{
    const k = html(monthPeriod(2026, 8), 'ar', true, 'phone', 'k', 'X');
    const page = plain(text(k.markup));
    assert.ok(isSmallAmount(300, k.report.totals.spentCents), 'the 3 DZD are small');
    assert.ok(!page.includes('3 − 3 = 0'), 'No sum of two threes any more');
    assert.ok(page.includes(plain(PHONE_WORDS.ar.remittedNote(inSentence('3 DZD'), 'month'))), 'The 3 DZD owed and written off are one quiet line of the calculation, said in a sentence');
    assert.ok(page.includes('أسقطنا عنك مبلغاً صغيراً'), 'The write-off operation says what it is');
    assert.ok(!page.includes('+3'), 'No green plus before 3');
    assert.ok(k.markup.includes('text-neutral-500'), 'It is drawn lighter');
    const fr = plain(text(html(monthPeriod(2026, 8), 'fr', true, 'phone', 'k', 'X').markup));
    assert.ok(fr.includes(plain(PHONE_WORDS.fr.remittedNote(inSentence('3 DZD'), 'month'))));
    assert.ok(fr.includes('Nous vous avons fait remise d’un petit montant'));
    // The equation stays exact: purchases − payments − the quiet line = the closing balance.
    assert.equal(k.report.balance.closingCents, 0);
    assert.equal(k.report.balance.openingCents + k.report.balance.lines.writeOff, 0);
}

// 8. Page 1 is the summary, the details start page 2, once.
for (const lang of ['ar', 'fr'] as const) {
    const { markup } = html(monthPeriod(2026, 8), lang, true, 'phone');
    assert.equal(markup.split('data-pdf-newpage').length - 1, 1, 'One page break marker');
    const marker = markup.indexOf('data-pdf-newpage');
    const w = REPORT_WORDS[lang];
    assert.ok(markup.indexOf(PHONE_WORDS[lang].calcTitle) < marker, `${lang}: the calculation is on page 1`);
    assert.ok(markup.indexOf(PHONE_WORDS[lang].operationsTitle) > marker, `${lang}: the operations are on page 2`);
    assert.ok(markup.indexOf(PHONE_WORDS[lang].partsTitle('week')) > marker, `${lang}: the weeks are on page 2`);
    assert.ok(markup.indexOf(w.footer) > marker);
}

// 9. The preview carries the reference and the date the PDF's pages carry at their foot; the PDF sheet does not repeat them.
{
    const reference = html(monthPeriod(2026, 8), 'fr', true, 'screen').report.reference;
    assert.ok(render(monthPeriod(2026, 8), 'fr', true, 'screen').includes(`N° ${reference}`));
    assert.ok(!render(monthPeriod(2026, 8), 'fr', true, 'phone').includes(reference), 'The pages write it themselves under each page');
    assert.ok(render(monthPeriod(2026, 8), 'fr', true, 'screen').includes(formatDate(NOW)));
}

// 10. Only the currencies the client bought, and a quiet month still reads.
for (const lang of ['ar', 'fr'] as const) {
    for (const period of [monthPeriod(2026, 8), yearPeriod(2026), ...RANGES])
        assert.doesNotMatch(render(period, lang, true, 'phone', 'k', 'Nour'), /EUR|€|euro|اليورو|يورو/i, `${period.key} ${lang}: no euro for a USDT-only client`);
    const quiet = render(monthPeriod(2026, 0), lang, true, 'phone', 'k', 'Nour');
    assert.ok(quiet.includes(REPORT_WORDS[lang].leadNone), `${lang}: a month without purchases says so`);
}

// 11. V8-3: every operation is a sentence from the client's side, with no + or − sign, and says where the account stands after it.
{
    const { report, markup } = html(monthPeriod(2026, 8), 'ar', true, 'phone');
    const page = plain(text(markup));
    const operations = page.slice(page.indexOf(PHONE_WORDS.ar.operationsTitle));
    assert.doesNotMatch(operations, /[+−]/, 'No plus or minus sign in the operations');
    for (const sentence of [
        'اشتريتَ 800 USDT', 'اشتريتَ 600 USDT', 'اشتريتَ 500 USDT', 'بعتَ لنا 300 USDT',
        'استلمتَ مبلغًا من عميل آخر', 'اشتريتَ خدمة رقمية',
        'سُجّلت على حسابك، لم تدفعها بعد', 'دفعتَ ثمنها باليورو', 'استلمتَ ثمنها باليورو', 'دفعتَ ثمنها بـ USDT',
    ])
        assert.ok(operations.includes(sentence), `ar: « ${sentence} » is on the operations`);
    assert.ok(operations.includes(`بسعر ${formatPrice(249.5)} DZD للواحد`), 'ar: the price of a purchase is said in words');
    assert.ok(operations.includes(`بسعر ${formatEurPrice(470 / 500)} € للواحد`), 'ar: …in euros when it was paid in euros');
    // After every operation that moved the account (and only those), where the account stands.
    const moved = report.operations.filter((row) => row.entry.affectsBalance).length;
    assert.equal((operations.match(/بعدها (?:عليك|لك|حسابك مسوّى)/g) || []).length, moved, 'One sentence after each operation that moved the account');
    assert.ok(operations.includes(`بعدها عليك ${formatDzdCents(report.operations[0].balanceAfterCents, report.showCents)} DZD`), 'ar: « after it you owe … »');
    assert.ok(operations.includes(PHONE_WORDS.ar.operation.hint), 'ar: the line that explains the sentences');
    // A client in credit, and one whose account is settled again.
    const credit = plain(render(monthPeriod(2026, 8), 'ar', true, 'phone', 'c'));
    assert.ok(credit.includes(`بعدها لك ${formatDzdCents(50000000, false)} DZD`) && credit.includes('دفعتَ عبر BaridiMob'), 'ar: a payment in advance leaves him in credit');
    const settled = plain(render(monthPeriod(2026, 8), 'ar', true, 'phone', 'z'));
    assert.ok(settled.includes(`بعدها عليك ${formatDzdCents(2500000, false)} DZD`) && settled.includes('بعدها حسابك مسوّى') && settled.includes('دفعتَ نقداً'), 'ar: the payment that settles the account says so');

    const fr = plain(render(monthPeriod(2026, 8), 'fr', true, 'phone'));
    const frOperations = fr.slice(fr.indexOf(PHONE_WORDS.fr.operationsTitle));
    assert.doesNotMatch(frOperations, /[+−]/, 'fr: no plus or minus sign in the operations');
    for (const sentence of ['Vous avez acheté 800 USDT', 'Vous nous avez vendu 300 USDT', 'Vous avez reçu d’un autre client', 'Vous avez acheté un service numérique', 'Inscrit sur votre compte, pas encore payé', 'Payé en euros', 'Vous avez reçu le montant en euros', 'Ensuite vous devez'])
        assert.ok(frOperations.includes(sentence), `fr: « ${sentence} » is on the operations`);
    assert.ok(plain(render(monthPeriod(2026, 8), 'fr', true, 'phone', 'z')).includes('Ensuite votre compte est réglé'), 'fr: settled');
    assert.ok(plain(render(monthPeriod(2026, 8), 'fr', true, 'phone', 'c')).includes('Ensuite en votre faveur'), 'fr: in credit');
    // A client who always pays on the spot: no « after » at all, and no line that explains it.
    const spot = plain(render(monthPeriod(2026, 8), 'ar', true, 'phone', 's'));
    assert.doesNotMatch(spot, /بعدها/, 'ar: nothing to say after operations that never touched the account');
    assert.ok(spot.includes('دفعتَ ثمنها نقداً'));
}

console.log('client activity phone sheet tests passed');
