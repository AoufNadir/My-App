import assert from 'node:assert/strict';
import { MainContentArea } from './MainContentArea';

// The main area only redraws a page when a value it compares changes. Every value added to the Home and the
// portfolio pages since V11-2 must be compared, or the page keeps showing what it had before the data arrived
// (the portfolio card of the clients' funds stayed hidden that way).
const compare = (MainContentArea as unknown as { compare: (prev: Record<string, unknown>, next: Record<string, unknown>) => boolean }).compare;
const base = { t: () => '', isFinancialDataReady: true, dailyOverview: {} };
const same = (view: string, key: string, props: Record<string, unknown>) => ({ ...base, view, [key]: props });

const home = (extra: Record<string, unknown>) => same('dashboard', 'dashboardPageProps', extra);
assert.equal(compare(home({ unexplainedMovementCount: 0 }), home({ unexplainedMovementCount: 0 })), true, 'nothing changed: no redraw');
assert.equal(compare(home({ unexplainedMovementCount: 0 }), home({ unexplainedMovementCount: 77 })), false, 'movements without a reason arrive: redraw');
assert.equal(compare(home({ pendingDeliveries: { clients: 0, USDT: 0, EUR: 0 } }), home({ pendingDeliveries: { clients: 0, USDT: 0, EUR: 0 } })), true, 'same numbers in a new object: no redraw');
assert.equal(compare(home({ pendingDeliveries: { clients: 0, USDT: 0, EUR: 0 } }), home({ pendingDeliveries: { clients: 1, USDT: 3_906.25, EUR: 0 } })), false, 'USDT owed to a client: redraw');
assert.equal(compare(home({ suggestedGoal: 0 }), home({ suggestedGoal: 150_000 })), false, 'suggested goal');
assert.equal(compare({ ...home({}), dailyOverview: { previousProfit: { month: 1 } } }, { ...home({}), dailyOverview: { previousProfit: { month: 2 } } }), false, 'the comparison with the previous period');

const portfolio = (extra: Record<string, unknown>) => same('statistiques', 'portfolioPageProps', extra);
assert.equal(compare(portfolio({ pendingDeliveries: { clients: 0, USDT: 0, EUR: 0 } }), portfolio({ pendingDeliveries: { clients: 1, USDT: 200, EUR: 0 } })), false, 'portfolio: the card of the clients funds appears');
console.log('main content redraw tests passed');
