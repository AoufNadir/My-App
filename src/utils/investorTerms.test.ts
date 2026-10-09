process.env.TZ = 'Africa/Algiers';
import assert from 'node:assert/strict';

import type { InvestorTransaction } from '../types';
import {
    TERM_DECISION_TYPES,
    investorTermAnchor,
    investorTermDay,
    isInvestorTermSnoozed,
    openInvestorTerm,
    openInvestorTerms,
    readTermSnoozes,
    snoozeInvestorTerm,
    writeTermSnoozes,
    type InvestorTermInvestor,
} from './investorTerms';

// The quarterly reminder (V3-4), in Algeria's time zone: terms every three months from the entry
// day, open seven days before, settled only by a reinvestment, a profit payout or a capital
// withdrawal from the opening day on, never for the manager or an archived investor.

const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const dayKey = (ts: number) => {
    const date = new Date(ts);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};
let seq = 0;
const tx = (investorId: string, type: InvestorTransaction['type'], timestamp: number, amount = 10_000): InvestorTransaction => {
    seq += 1;
    return { id: `t${seq}`, investorId, type, amount, timestamp, date: dayKey(timestamp), time: '12:00' };
};
const investor = (fields: Partial<InvestorTermInvestor> & Pick<InvestorTermInvestor, 'id' | 'entryDate'>): InvestorTermInvestor => ({
    name: `Investisseur ${fields.id}`, capitalInvested: 300_000, availableProfit: 84_999.6, displayAvailableProfit: 85_000, isActive: true,
    ...fields,
});
const terms = (entryDate: string, count: number) => {
    const anchor = investorTermAnchor({ entryDate }, []);
    assert.ok(anchor, `${entryDate}: has an anchor`);
    return Array.from({ length: count }, (_, index) => dayKey(investorTermDay(anchor, index + 1)));
};

// ---- Term days ----
assert.deepEqual(terms('2026-07-15T10:00:00.000Z', 4), ['15/10/2026', '15/01/2027', '15/04/2027', '15/07/2027'], 'the plan example: entered 15/07, terms 15/10, 15/01, 15/04');
assert.deepEqual(terms('2025-08-31', 5), ['30/11/2025', '28/02/2026', '31/05/2026', '31/08/2026', '30/11/2026'], 'a 31st stays a 31st where the month has one, counted from the entry day');
assert.deepEqual(terms('2023-11-29', 2), ['29/02/2024', '29/05/2024'], 'a leap year keeps the 29th of February');
assert.deepEqual(terms('2026-07-15T23:30:00.000Z', 1), ['16/10/2026'], 'late at night in UTC is the next day in Algeria, as the investor page shows it');
assert.deepEqual(terms('2026-07-15', 1), ['15/10/2026'], 'a date written alone is that local day');
const deposits = [tx('x', 'deposit_capital', at(2026, 5, 2)), tx('x', 'deposit_capital', at(2026, 3, 20)), tx('x', 'withdraw_profit', at(2026, 1, 5))];
assert.deepEqual(investorTermAnchor({ entryDate: '' }, deposits), { year: 2026, month: 2, day: 20 }, 'without an entry date, the day of the first capital deposit');
assert.deepEqual(investorTermAnchor({ entryDate: 'pas une date' }, deposits), { year: 2026, month: 2, day: 20 }, 'an unreadable entry date falls back the same way');
assert.equal(investorTermAnchor({ entryDate: '' }, [tx('x', 'withdraw_profit', at(2026, 1, 5))]), null, 'neither an entry date nor a deposit: no term');

// ---- When the reminder opens and closes ----
const karim = investor({ id: 'k', name: 'Karim', entryDate: '2026-07-15T10:00:00.000Z' });
assert.equal(openInvestorTerm(karim, [], at(2026, 10, 7, 23, 59)), null, 'nothing until seven days before');
const opening = openInvestorTerm(karim, [], at(2026, 10, 8, 0, 0));
assert.ok(opening, 'the reminder opens at midnight seven days before');
assert.equal(opening.daysLeft, 7);
const example = openInvestorTerm(karim, [], at(2026, 10, 10, 18));
assert.ok(example);
assert.equal(example.investorName, 'Karim');
assert.equal(example.termKey, '2026-10-15');
assert.equal(dayKey(example.termTs), '15/10/2026');
assert.equal(dayKey(example.noticeTs), '08/10/2026');
assert.equal(example.cycle, 1);
assert.equal(example.daysLeft, 5, 'the plan example: « le 15/10/2026, dans 5 jours »');
assert.equal(example.state, 'upcoming');
assert.equal(example.availableProfit, 85_000, 'the whole-dinar profit of the investor list');
assert.equal(example.canReinvest, true);
assert.equal(openInvestorTerm(karim, [], at(2026, 10, 15, 9))?.state, 'due', 'on the day');
const late = openInvestorTerm(karim, [], at(2026, 11, 2, 9));
assert.equal(late?.state, 'overdue', 'it stays after the day');
assert.equal(late?.daysLeft, -18);
assert.equal(late?.termKey, '2026-10-15');
const next = openInvestorTerm(karim, [], at(2027, 1, 10, 9));
assert.equal(next?.termKey, '2027-01-15', 'when the next reminder opens, it takes the place of the old one');
assert.equal(next?.cycle, 2);
assert.equal(next?.daysLeft, 5);

// ---- What settles a term ----
for (const type of TERM_DECISION_TYPES) {
    assert.equal(openInvestorTerm(karim, [tx('k', type, at(2026, 10, 9))], at(2026, 10, 10)), null, `${type} from the opening day on settles the term`);
}
assert.deepEqual([...TERM_DECISION_TYPES].sort(), ['reinvest_profit', 'withdraw_capital', 'withdraw_profit'], 'exactly the three decisions of the plan');
assert.equal(openInvestorTerm(karim, [tx('k', 'withdraw_capital', at(2026, 10, 8, 0, 0))], at(2026, 10, 10)), null, 'right at the opening counts');
assert.ok(openInvestorTerm(karim, [tx('k', 'withdraw_profit', at(2026, 10, 7, 23, 59))], at(2026, 10, 10)), 'the day before the opening does not count');
assert.ok(openInvestorTerm(karim, [tx('k', 'deposit_capital', at(2026, 10, 9)), tx('k', 'profit_distribution', at(2026, 10, 9))], at(2026, 10, 10)), 'a deposit or a profit share decides nothing');
assert.ok(openInvestorTerm(karim, [tx('other', 'reinvest_profit', at(2026, 10, 9))], at(2026, 10, 10)), 'another investor\'s decision does not settle this one');
assert.equal(openInvestorTerm(karim, [tx('k', 'reinvest_profit', at(2026, 10, 20))], at(2026, 11, 2)), null, 'a late decision closes an overdue term');
assert.equal(openInvestorTerm(karim, [tx('k', 'reinvest_profit', at(2026, 10, 9))], at(2027, 1, 10))?.termKey, '2027-01-15', 'a decision settles one term, not the next');

// ---- Who has terms ----
assert.equal(openInvestorTerm({ ...karim, isManager: true }, [], at(2026, 10, 10)), null, 'never the manager');
assert.equal(openInvestorTerm({ ...karim, isActive: false, archived: true }, [], at(2026, 10, 10)), null, 'never an archived investor');
assert.equal(openInvestorTerm({ ...karim, isActive: false }, [], at(2026, 10, 10)), null, 'nor an inactive one');
assert.equal(openInvestorTerm({ ...karim, capitalInvested: 0, availableProfit: 0, displayAvailableProfit: 0 }, [], at(2026, 10, 10)), null, 'nothing to decide on: no capital and no profit left');
assert.ok(openInvestorTerm({ ...karim, capitalInvested: 0, availableProfit: 5_000, displayAvailableProfit: 5_000 }, [], at(2026, 10, 10)), 'profit left without capital still has to be decided');
assert.equal(openInvestorTerm({ ...karim, entryDate: '2026-10-20' }, [], at(2026, 10, 10)), null, 'an entry in the future has no term yet');
const owing = openInvestorTerm({ ...karim, availableProfit: -3_200.4, displayAvailableProfit: -3_200 }, [], at(2026, 10, 10));
assert.equal(owing?.availableProfit, -3_200, 'a balance to settle keeps its sign');
assert.equal(owing?.canReinvest, false, 'nothing to reinvest');
assert.equal(openInvestorTerm({ ...karim, availableProfit: 0.01, displayAvailableProfit: 0 }, [], at(2026, 10, 10))?.canReinvest, false, 'one cent is not enough, as on the investor page');
assert.equal(openInvestorTerm({ ...karim, displayAvailableProfit: undefined }, [], at(2026, 10, 10))?.availableProfit, 84_999.6, 'without the list figure, the stored one');

// ---- The list, most urgent first ----
const sami = investor({ id: 's', name: 'Sami', entryDate: '2026-04-08' });
const nadia = investor({ id: 'n', name: 'Nadia', entryDate: '2026-04-16' });
const amine = investor({ id: 'a', name: 'Amine', entryDate: '2026-04-16' });
const farid = investor({ id: 'f', name: 'Farid', entryDate: '2026-05-30' });
const manager = investor({ id: 'm', name: 'Gérant', entryDate: '2026-04-08', isManager: true });
const history = [tx('n', 'reinvest_profit', at(2026, 7, 12)), tx('f', 'withdraw_profit', at(2026, 10, 1))];
const before = JSON.stringify({ investors: [sami, nadia, amine, farid, manager], history });
const open = openInvestorTerms([farid, manager, nadia, sami, amine, karim], history, at(2026, 10, 10, 9));
assert.deepEqual(open.map((term) => `${term.investorName} ${term.daysLeft}`), ['Sami -2', 'Karim 5', 'Amine 6', 'Nadia 6'], 'overdue first, then the nearest, then by name; settled and manager terms left out');
assert.equal(JSON.stringify({ investors: [sami, nadia, amine, farid, manager], history }), before, 'nothing is changed in the investors or their history');
assert.deepEqual(openInvestorTerms([], [], at(2026, 10, 10)), [], 'no investor, no term');

// ---- « Remind me in 3 days » ----
const store = new Map<string, string>();
const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } };
assert.deepEqual(readTermSnoozes(storage), {}, 'nothing kept yet');
const snoozed = snoozeInvestorTerm({}, example, at(2026, 10, 10, 18));
assert.deepEqual(snoozed, { k: { term: '2026-10-15', until: at(2026, 10, 13, 0, 0) } }, 'until the start of the third day after');
assert.equal(isInvestorTermSnoozed(example, snoozed, at(2026, 10, 12, 23, 59)), true, 'hidden for three days');
assert.equal(isInvestorTermSnoozed(example, snoozed, at(2026, 10, 13, 0, 0)), false, 'back on the third day');
assert.equal(isInvestorTermSnoozed({ investorId: 'k', termKey: '2027-01-15' }, snoozed, at(2026, 10, 11)), false, 'a snooze covers one term only');
assert.equal(isInvestorTermSnoozed({ investorId: 's', termKey: '2026-10-15' }, snoozed, at(2026, 10, 11)), false, 'and one investor only');
writeTermSnoozes(snoozed, storage);
assert.deepEqual(readTermSnoozes(storage), snoozed, 'kept on the device');
const later = snoozeInvestorTerm(readTermSnoozes(storage), { investorId: 's', termKey: '2026-10-12' }, at(2026, 10, 20));
assert.deepEqual(Object.keys(later), ['s'], 'past snoozes are dropped when a new one is kept');
store.set('app_investor_term_snooze', '{pas du json');
assert.deepEqual(readTermSnoozes(storage), {}, 'an unreadable value is ignored');
store.set('app_investor_term_snooze', JSON.stringify({ k: { term: 5, until: 'x' }, s: { term: '2026-10-12', until: 1 } }));
assert.deepEqual(readTermSnoozes(storage), { s: { term: '2026-10-12', until: 1 } }, 'malformed entries are ignored');
const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
assert.deepEqual(readTermSnoozes(broken), {}, 'blocked storage reads as nothing kept');
assert.doesNotThrow(() => writeTermSnoozes(snoozed, broken), 'and writing to it is skipped');
assert.deepEqual(readTermSnoozes(null), {}, 'no storage at all');

console.log('investor terms tests passed');
