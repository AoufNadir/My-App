import assert from 'node:assert/strict';
import { matchDeposits, parseAmounts, pendingDeposits, type AgentDeposit } from './agentDeposits';

const d = (id: string, amount: number, label = id): AgentDeposit => ({ id, amount, timestamp: 0, label });
// 1. Ten deposits, the friend's list with two small gaps (fake names, the owner's pattern): 8 exact, 2 near.
const deposits = [d('a', 289850), d('b', 200000), d('c', 263000), d('e', 171000), d('f', 111150), d('g', 130000), d('h', 66250), d('i', 78750), d('j', 57000), d('k', 50000)];
const list = parseAmounts('289 500,00 DA\n200 000,00 DA\n263 000,00\n171000\n111 150,00\n130 000,00\n66 250,00\n78 650,00\n57 000,00\n50 000,00');
assert.deepEqual(list, [289500, 200000, 263000, 171000, 111150, 130000, 66250, 78650, 57000, 50000]);
const r = matchDeposits(deposits, list);
assert.equal(r.countedTotal, 1416550);
assert.equal(r.dueTotal, 1417000);
assert.equal(r.lines.filter((l) => l.kind === 'exact').length, 8);
const near = r.lines.filter((l) => l.kind === 'near').map((l) => [l.deposit!.id, l.difference]);
assert.deepEqual(near, [['a', -350], ['i', -100]]);
assert.deepEqual(r.missing, []);

// 2. Two equal dues, both paid in full: no difference, whoever is whose.
const same = matchDeposits([d('x', 50000), d('y', 50000)], [50000, 50000]);
assert.ok(same.lines.every((l) => l.kind === 'exact'));

// 3. Two equal dues, one bundle short: the app does not choose.
const amb = matchDeposits([d('aymen', 5000), d('said', 5000)], [5000, 4950]);
const gap = amb.lines.find((l) => l.difference !== 0)!;
assert.equal(gap.kind, 'ambiguous');
assert.deepEqual(gap.candidates!.map((x) => x.id).sort(), ['aymen', 'said']);
assert.equal(gap.difference, -50);

// 4. 5 000 and 5 500 due, 5 500 and 4 950 counted: 5 500 is Said exactly, 4 950 is Aymen short 50.
const two = matchDeposits([d('aymen', 5000), d('said', 5500)], [5500, 4950]);
assert.deepEqual(two.lines.map((l) => [l.kind, l.deposit?.id, l.difference]), [['exact', 'said', 0], ['near', 'aymen', -50]]);

// 5. A bundle with no due near it, and a due nobody brought.
const odd = matchDeposits([d('p', 10000), d('q', 80000)], [10000, 3000]);
assert.equal(odd.lines[1].kind, 'extra');
assert.deepEqual(odd.missing.map((x) => x.id), ['q']);

// 6. Pending: the intermediary's negative lines, not collected, since the start date.
const rows = [{ id: 'r1', montant: -50000, timestamp: 10 }, { id: 'r2', montant: 54000, timestamp: 11 }, { id: 'r3', montant: -130000, timestamp: 12 }, { id: 'r4', montant: -1, timestamp: 1 }, { id: 'r5', montant: -7, timestamp: 13, affectsBalance: false }];
const pending = pendingDeposits(rows, new Set(['r3']), 5, (row) => ({ label: row.id }));
assert.deepEqual(pending.map((x) => [x.id, x.amount]), [['r1', 50000]]);
console.log('agentDeposits: ok');
// V27-2: only the newest deposits up to what the intermediary owes now (older ones were collected before).
import { outstandingOnly } from './agentDeposits';
const hist = [{ id: 'old1', amount: 300000, timestamp: 1, label: '' }, { id: 'old2', amount: 90000, timestamp: 2, label: '' }, { id: 'n1', amount: 50000, timestamp: 3, label: '' }, { id: 'n2', amount: 130000, timestamp: 4, label: '' }];
assert.deepEqual(outstandingOnly(hist, 180000).map((x) => x.id), ['n1', 'n2']);
assert.deepEqual(outstandingOnly(hist, 0), []);
assert.deepEqual(outstandingOnly(hist, 200000).map((x) => x.id), ['old2', 'n1', 'n2']);
console.log('agentDeposits V27-2: ok');
