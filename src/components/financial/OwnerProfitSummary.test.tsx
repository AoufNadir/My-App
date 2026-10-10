import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { translations } from '../../translations';
import type { ManagerProfitBreakdown } from '../../hooks/useInvestorEconomics';
import { formatNumber } from '../../pages/shared/pageFormat';
import { distinctScreenNumbers, screenText } from '../../testing/screenNumbers';
import { OwnerProfitBreakdownCard } from './OwnerProfitSummary';

// V4-3: on the manager's page, « Détail de mon profit de propriétaire » starts with where the profit
// comes from: the USDT and EUR sales, the other businesses, then the total. The figures are the ones
// of V4-2 (no number is computed again, none is stored): the two boxes « profit services » and
// « mon profit personnel total » moved up into that block, and the sales subtotal, which is the sum
// of the two shares shown below it, is the only figure that was not on the page.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
};
type Lang = 'fr' | 'ar';
const LANGS: Lang[] = ['fr', 'ar'];
const render = (breakdown: ManagerProfitBreakdown, lang: Lang) => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider><OwnerProfitBreakdownCard breakdown={breakdown}/></LanguageProvider>);
};
const label = (lang: Lang, key: string) => key.split('.').reduce<any>((node, part) => node[part], translations[lang]) as string;
// One `|` between elements, however many tags sit between two texts.
const textOf = (html: string) => screenText(html).replace(/\s*\|(?:\s*\|)*\s*/g, '|');

// Made-up figures, as in investorScreens.test.tsx.
function breakdown(fields: Partial<ManagerProfitBreakdown> = {}): ManagerProfitBreakdown {
    return {
        managerFeePercentage: 30, projectNetProfit: 241_870, openingCapital: 1_000_000, historicalOwnerCapital: 3_377_400, actualOwnerCapital: 3_384_123.5,
        tradingOwnerProfit: 172_520, serviceProfit: 13_900, ideaShareProfit: 72_561, personalCapitalProfit: 99_959, ownerTotalProfit: 186_420,
        externalInvestorsProfit: 55_450, totalDeliveryExpenses: 4_500, totalDebtWriteOffs: 1_200, profitWithdrawals: 0, personalExpenses: 38_000,
        currentPersonalExpenses: 26_000, totalPersonalExpenses: 64_000, withdrawnProfit: 64_000, reinvestedProfit: 0, availableProfit: 122_420,
        profitDeficit: 0, displayAvailableProfit: 122_420, retainedProfit: 122_420, capitalAdditions: 200_000, capitalWithdrawals: 5_000,
        personalExpensesChargedToProfit: 64_000, personalExpensesChargedToCapital: 0, personalExpensesFundedByCapital: 0,
        balanceSheetOwnerCapital: 3_384_123.5, ownerCapitalReconciliationDifference: 6_723.5,
        ...fields,
    };
}
const CASES: Record<string, ManagerProfitBreakdown> = {
    // Every figure is whole.
    whole: breakdown(),
    // The owner has no other business yet.
    noOtherBusiness: breakdown({ serviceProfit: 0, ownerTotalProfit: 172_520 }),
    // Cents, but the whole dinars still add up (624 987 + 157 050 = 782 037): written whole, as the page is.
    centsAddUp: breakdown({ tradingOwnerProfit: 624_986.7, ideaShareProfit: 258_292.4, personalCapitalProfit: 366_694.3, serviceProfit: 157_050, ownerTotalProfit: 782_036.7 }),
    // Cents, and the whole dinars would miss the total by one (172 520 + 13 900 is not 186 421): all three show cents.
    centsOff: breakdown({ tradingOwnerProfit: 172_520.4, ideaShareProfit: 72_561.2, personalCapitalProfit: 99_959.2, serviceProfit: 13_900.4, ownerTotalProfit: 186_420.8 }),
    // Half a dinar each: 101 + 101 is not 201.
    halfDinars: breakdown({ tradingOwnerProfit: 100.5, ideaShareProfit: 40.5, personalCapitalProfit: 60, serviceProfit: 100.5, ownerTotalProfit: 201 }),
    // Only the other businesses have cents, and the whole dinars add up.
    otherBusinessCents: breakdown({ serviceProfit: 3_000.25, ownerTotalProfit: 175_520.25 }),
    // A loss of half a dinar rounds away from zero, like the screen does.
    negativeHalf: breakdown({ tradingOwnerProfit: -100.5, ideaShareProfit: -30.5, personalCapitalProfit: -70, serviceProfit: 0, ownerTotalProfit: -100.5 }),
    // -101 + 2 = -99: only true if half a dinar goes away from zero for a loss too.
    negativeHalfWithOther: breakdown({ tradingOwnerProfit: -100.5, ideaShareProfit: -30.5, personalCapitalProfit: -70, serviceProfit: 1.5, ownerTotalProfit: -99 }),
    // A losing period of sales, partly made up by the other businesses.
    loss: breakdown({ tradingOwnerProfit: -8_300, ideaShareProfit: -2_490, personalCapitalProfit: -5_810, serviceProfit: 2_000, ownerTotalProfit: -6_300 }),
    // No difference to reconcile and no debt written off: the lines under the boxes are shorter.
    tidy: breakdown({ ownerCapitalReconciliationDifference: 0, totalDebtWriteOffs: 0 }),
};

// How each case is written: in whole dinars when they add up, with cents when they would not.
const MODE: Record<string, 'whole' | 'cents'> = {
    whole: 'whole', noOtherBusiness: 'whole', centsAddUp: 'whole', centsOff: 'cents', halfDinars: 'cents', otherBusinessCents: 'whole',
    negativeHalf: 'whole', negativeHalfWithOther: 'whole', loss: 'whole', tidy: 'whole',
};
assert.deepEqual(Object.keys(MODE).sort(), Object.keys(CASES).sort(), 'every case has its expected way of writing');

// The boxes of the card in V4-2, in their order, with how each one writes its figure.
type OldBox = { key: string; value: (b: ManagerProfitBreakdown) => number; kind: 'amount' | 'percent' };
const OLD_BOXES: OldBox[] = [
    { key: 'investors.ideaShare', value: (b) => b.ideaShareProfit, kind: 'amount' },
    { key: 'investors.managerCommissionRate', value: (b) => b.managerFeePercentage, kind: 'percent' },
    { key: 'investors.personalCapitalShare', value: (b) => b.personalCapitalProfit, kind: 'amount' },
    { key: 'investors.serviceProfit', value: (b) => b.serviceProfit, kind: 'amount' },
    { key: 'investors.personalTotalProfit', value: (b) => b.ownerTotalProfit, kind: 'amount' },
    { key: 'investors.profitsReinvestedInCapital', value: (b) => b.retainedProfit, kind: 'amount' },
    { key: 'investors.externalInvestorsShare', value: (b) => b.externalInvestorsProfit, kind: 'amount' },
    { key: 'investors.openingCapital', value: (b) => b.openingCapital, kind: 'amount' },
    { key: 'investors.historicalPersonalExpenses', value: (b) => b.personalExpenses, kind: 'amount' },
    { key: 'investors.currentPersonalExpenses', value: (b) => b.currentPersonalExpenses, kind: 'amount' },
    { key: 'investors.totalPersonalExpenses', value: (b) => b.totalPersonalExpenses, kind: 'amount' },
    { key: 'investors.personalExpensesChargedToCapital', value: (b) => b.personalExpensesChargedToCapital, kind: 'amount' },
    { key: 'investors.capitalFromBalanceSheet', value: (b) => b.actualOwnerCapital, kind: 'amount' },
    { key: 'investors.capitalFromHistory', value: (b) => b.historicalOwnerCapital, kind: 'amount' },
];
// The two boxes that moved up into the block of sources.
const MOVED = new Set(['investors.serviceProfit', 'investors.personalTotalProfit']);
const whole = (value: number) => formatNumber(value, { min: 0, max: 0 });
const cents = (value: number) => formatNumber(value, { min: 2, max: 2 });
const oldPair = (lang: Lang, box: OldBox, b: ManagerProfitBreakdown) => box.kind === 'percent'
    ? `${label(lang, box.key)}|${Number(box.value(b)).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}|%`
    : `${label(lang, box.key)}|${whole(box.value(b))}|DZD`;

/** The figure written after a label (and after the line that explains it, if any), as cents. */
function shownCents(text: string, lang: Lang, key: string, after?: string): { shown: string; cents: number } {
    const start = text.indexOf(`${label(lang, key)}|`);
    assert.ok(start >= 0, `${lang}: "${key}" is on the card`);
    let from = start + label(lang, key).length + 1;
    if (after) {
        const hint = text.indexOf(`${label(lang, after)}|`, from);
        assert.ok(hint >= 0, `${lang}: "${after}" follows "${key}"`);
        from = hint + label(lang, after).length + 1;
    }
    const shown = text.slice(from).split('|')[0];
    const digits = shown.replace(/[^\d,-]/g, '').replace(',', '.');
    return { shown, cents: Math.round(Number(digits) * 100) };
}

for (const [name, b] of Object.entries(CASES)) {
    for (const lang of LANGS) {
        const where = `${name}.${lang}`;
        const html = render(b, lang);
        const text = textOf(html);

        // 1. Nothing the card showed is lost: every box is where it was, with its figure written the same way.
        for (const box of OLD_BOXES)
            if (!MOVED.has(box.key))
                assert.ok(text.includes(oldPair(lang, box, b)), `${where}: "${box.key}" still shows ${oldPair(lang, box, b)}`);
        // The boxes keep their order.
        const kept = OLD_BOXES.filter((box) => !MOVED.has(box.key)).map((box) => text.indexOf(oldPair(lang, box, b)));
        assert.deepEqual(kept, [...kept].sort((a, c) => a - c), `${where}: the boxes keep their order`);
        // The old « profit services » box is gone (its figure is in the block of sources), and nothing is said twice.
        assert.ok(!text.includes(`${label(lang, 'investors.serviceProfit')}|`), `${where}: no second « profit services » line`);
        assert.equal(text.split(label(lang, 'investors.personalTotalProfit')).length - 1, 1, `${where}: the total is written once`);
        // The lines under the boxes are those of V4-2.
        assert.ok(text.includes(`${label(lang, 'investors.projectNetProfit')}:|${whole(b.projectNetProfit)}|DZD`), `${where}: net profit of the project`);
        assert.ok(text.includes(`${label(lang, 'investors.deliveryExpenses')}:|${whole(b.totalDeliveryExpenses)}|DZD`), `${where}: delivery expenses`);
        assert.equal(text.includes(label(lang, 'investors.debtWriteOffs')), (b.totalDebtWriteOffs ?? 0) > 0, `${where}: debt write-offs only when there are some`);
        assert.equal(text.includes(label(lang, 'investors.ownerCapitalReconciliationDifference')), Math.abs(b.ownerCapitalReconciliationDifference) >= 0.005, `${where}: the difference to reconcile only when there is one`);

        // 2. The block of sources: sales, other businesses (with what they cover), then the total, before the boxes.
        const sales = shownCents(text, lang, 'investors.profitFromSales');
        const others = shownCents(text, lang, 'investors.profitFromOtherBusinesses', 'investors.profitFromOtherBusinessesHint');
        const total = shownCents(text, lang, 'investors.personalTotalProfit');
        const order = ['investors.profitFromSales', 'investors.profitFromOtherBusinesses', 'investors.profitFromOtherBusinessesHint', 'investors.personalTotalProfit', 'investors.ideaShare']
            .map((key) => text.indexOf(label(lang, key)));
        assert.ok(order.every((index) => index >= 0) && order.every((index, i) => i === 0 || index > order[i - 1]), `${where}: sales, other businesses, total, then the boxes`);
        assert.ok(text.indexOf(label(lang, 'investors.ownerProfitBreakdown')) < order[0], `${where}: the block sits under the title of the card`);
        // What is above the total adds up to it, to the cent, as written on the screen.
        assert.equal(sales.cents + others.cents, total.cents, `${where}: ${sales.shown} + ${others.shown} = ${total.shown}`);
        // Whole dinars as everywhere on the page, unless the whole dinars shown would not add up to the total:
        // then all three show their cents. Rounded by the formatter of the screen, not by the component.
        const shownWhole = (value: number) => Number(whole(value).replace(/[^\d-]/g, ''));
        const wholeAddsUp = shownWhole(b.tradingOwnerProfit) + shownWhole(b.serviceProfit) === shownWhole(b.ownerTotalProfit);
        const writer = wholeAddsUp ? whole : cents;
        assert.equal(wholeAddsUp ? 'whole' : 'cents', MODE[name], `${where}: the case is meant to be written ${MODE[name]}`);
        assert.deepEqual([sales.shown, others.shown, total.shown], [b.tradingOwnerProfit, b.serviceProfit, b.ownerTotalProfit].map(writer), `${where}: the three figures are written ${wholeAddsUp ? 'in whole dinars' : 'with cents'}`);
        // And they are the stored figures, not others (rounded as they are written).
        const stored = (value: number) => (wholeAddsUp ? shownWhole(value) * 100 : Math.round(value * 100));
        assert.equal(sales.cents, stored(b.tradingOwnerProfit), `${where}: sales figure`);
        assert.equal(others.cents, stored(b.serviceProfit), `${where}: other businesses figure`);
        assert.equal(total.cents, stored(b.ownerTotalProfit), `${where}: total figure`);

        // 3. The only figure that was not on the card is the sales subtotal (when it is not the total itself).
        const before = new Set(OLD_BOXES.map((box) => (box.kind === 'percent' ? Number(box.value(b)).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : whole(box.value(b)))));
        const shownNow = distinctScreenNumbers(html).map((token) => token.replace(/^\+/, ''));
        const footers = [whole(b.projectNetProfit), whole(b.totalDeliveryExpenses), whole(b.totalDebtWriteOffs ?? 0), whole(b.ownerCapitalReconciliationDifference)];
        const unknown = shownNow.filter((token) => !before.has(token) && !footers.includes(token));
        const expectedNew = [...new Set([sales.shown, others.shown, total.shown].filter((shown) => !before.has(shown)))].sort();
        assert.deepEqual(unknown, expectedNew, `${where}: only the sales subtotal is new${wholeAddsUp ? '' : ' (and the three lines written with cents)'}`);
    }
}

// The labels of the block, in both languages, written once each and not empty.
for (const lang of LANGS)
    for (const key of ['investors.profitFromSales', 'investors.profitFromOtherBusinesses', 'investors.profitFromOtherBusinessesHint'])
        assert.ok(label(lang, key) && label(lang, key).trim() === label(lang, key), `${lang}: ${key}`);
assert.notEqual(label('fr', 'investors.profitFromSales'), label('ar', 'investors.profitFromSales'));

// The first lines read as the owner reads them.
{
    const ar = textOf(render(CASES.whole, 'ar'));
    assert.ok(ar.includes(`${label('ar', 'investors.profitFromSales')}|${whole(172_520)}|DZD`), 'ar: « من بيع الدولار واليورو » 172 520');
    assert.ok(ar.includes(`${label('ar', 'investors.profitFromOtherBusinesses')}|${label('ar', 'investors.profitFromOtherBusinessesHint')}|${whole(13_900)}|DZD`), 'ar: « من الأعمال الأخرى » 13 900');
    const fr = textOf(render(CASES.whole, 'fr'));
    assert.ok(fr.includes(`Ventes USDT et EUR|${whole(172_520)}|DZD`), 'fr: ventes');
    assert.ok(fr.includes(`Autres activités|Services, factures et services numériques|${whole(13_900)}|DZD`), 'fr: autres activités');
}

// The negative sales figure is red and the total follows its own sign.
{
    const html = render(CASES.loss, 'fr');
    const sales = html.indexOf(label('fr', 'investors.profitFromSales'));
    const others = html.indexOf(label('fr', 'investors.profitFromOtherBusinesses'));
    const total = html.indexOf(label('fr', 'investors.personalTotalProfit'));
    assert.ok(html.slice(sales, others).includes('text-financial-loss'), 'a loss on the sales is red');
    assert.ok(html.slice(others, total).includes('text-financial-profit'), 'a profit on the other businesses is green');
    assert.ok(html.slice(total).split('</div></div>')[0].includes('text-financial-loss'), 'a negative total is red');
}

console.log('OwnerProfitSummary.test: the manager card shows sales, other businesses and total first, adding up to the cent, and keeps every other figure of V4-2');
