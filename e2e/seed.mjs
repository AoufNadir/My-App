// V24-3: fake data for the browser tests (local emulator, project demo-prodigital). No real name or figure.
const P = 'demo-prodigital';
const enc = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
};
const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'demo@example.com', password: 'demo1234', returnSecureToken: true }) });
const { localId: uid } = await r.json();
const put = async (path, data) => {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents/${path}`, { method: 'PATCH', headers: { 'content-type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ fields: enc(data).mapValue.fields }) });
  if (!res.ok) throw new Error(path + ' ' + await res.text());
};
const DAY = 86400000, now = Date.now();
const stamp = (ts) => { const d = new Date(ts); return { timestamp: ts, date: d.toLocaleDateString('fr-FR'), time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }; };
await put(`users/${uid}`, { managerFeePercentage: '30', setupDone: true });
await put(`users/${uid}/investors/owner`, { name: 'Gérant démo', isManager: true, initialCapital: 3000000, entryDate: '2026-01-01', createdAt: now - 200 * DAY });
await put(`users/${uid}/treasury_txs/cap`, { type: 'Ajout', amount: 3000000, source: 'Caisse', origin: 'investor_deposit', notes: 'capital', ...stamp(now - 60 * DAY) });
await put(`users/${uid}/usdt_txs/b0`, { type: 'buy', currency: 'USDT', quantity: 10000, price: 250, total: 2500000, purchaseFundingCurrency: 'DZD', ...stamp(now - 50 * DAY) });
await put(`users/${uid}/treasury_txs/b0t`, { type: 'Retrait', amount: 2500000, source: 'Caisse', linkedTxId: 'b0', ...stamp(now - 50 * DAY) });
for (let i = 0; i < 10; i++) {
  const ts = now - (30 - i * 2) * DAY;
  await put(`users/${uid}/usdt_txs/s${i}`, { type: 'sell', currency: 'USDT', quantity: 100, sell: 260 + (i % 3), total: (260 + (i % 3)) * 100, ...stamp(ts) });
  await put(`users/${uid}/treasury_txs/s${i}t`, { type: 'Ajout', amount: (260 + (i % 3)) * 100, source: 'Caisse', linkedTxId: `s${i}`, ...stamp(ts) });
}
for (let i = 0; i < 8; i++) {
  const ts = now - (40 - i * 4) * DAY;
  await put(`users/${uid}/treasury_txs/pe${i}`, { type: 'Retrait', amount: 400, source: 'Caisse', origin: 'personal_expense', notes: 'café', expenseWallet: 'Caisse', profitAmountDzd: 400, linkedInvestorTxId: `ipe${i}`, ...stamp(ts) });
  await put(`users/${uid}/investor_transactions/ipe${i}`, { investorId: 'owner', type: 'withdraw_profit', origin: 'personal_expense', amount: 400, paymentSource: 'Caisse', linkedTreasuryTxId: `pe${i}`, ...stamp(ts) });
}
const big = now - 11 * DAY;
await put(`users/${uid}/treasury_txs/pebig`, { type: 'Retrait', amount: 39500, source: 'Caisse', origin: 'personal_expense', notes: 'perte', expenseWallet: 'Caisse', profitAmountDzd: 39500, linkedInvestorTxId: 'ipebig', ...stamp(big) });
await put(`users/${uid}/investor_transactions/ipebig`, { investorId: 'owner', type: 'withdraw_profit', origin: 'personal_expense', amount: 39500, paymentSource: 'Caisse', linkedTreasuryTxId: 'pebig', ...stamp(big) });
await put(`users/${uid}/dzd_clients/c1`, { fullName: 'Client démo', nom: 'Client démo', createdAt: now - 90 * DAY });
// RICH: clients and sales over two months (fake)
for (const [id, name] of [['ca', 'Client A'], ['cb', 'Client B'], ['cc', 'Client C']]) await put(`users/${uid}/dzd_clients/${id}`, { fullName: name, nom: name, createdAt: now - 120 * DAY });
await put(`users/${uid}/usdt_txs/b1`, { type: 'buy', currency: 'USDT', quantity: 20000, price: 250, total: 5000000, purchaseFundingCurrency: 'DZD', ...stamp(now - 55 * DAY) });
await put(`users/${uid}/treasury_txs/capb`, { type: 'Ajout', amount: 5000000, source: 'Caisse', origin: 'investor_deposit', ...stamp(now - 56 * DAY) });
await put(`users/${uid}/treasury_txs/b1t`, { type: 'Retrait', amount: 5000000, source: 'Caisse', linkedTxId: 'b1', ...stamp(now - 55 * DAY) });
const d = new Date(now); const prevMonth = (day) => new Date(d.getFullYear(), d.getMonth() - 1, day, 11).getTime(); const thisMonth = (day) => new Date(d.getFullYear(), d.getMonth(), day, 11).getTime();
const rows = [ ['ra1', 'ca', prevMonth(2), 1200, 258, 'cash'], ['ra2', 'ca', prevMonth(9), 1300, 258, 'cash'], ['rb1', 'cb', prevMonth(5), 600, 258, 'cash'],
  ['na1', 'ca', thisMonth(3), 1000, 257.2, 'credit'], ['nb1', 'cb', thisMonth(4), 700, 258, 'cash'], ['nb2', 'cb', thisMonth(10), 600, 258, 'baridi'], ['nc1', 'cc', thisMonth(6), 900, 258, 'cash'] ];
for (const [id, client, ts, q, p, pay] of rows) {
  await put(`users/${uid}/usdt_txs/${id}`, { type: 'sell', currency: 'USDT', quantity: q, sell: p, total: q * p, linkedClientId: client, clientPaymentStatus: pay, ...stamp(ts) });
  if (pay === 'credit') await put(`users/${uid}/dzd_client_txs/${id}c`, { clientId: client, type: 'Vente USDT', montant: -q * p, linkedTxId: id, ...stamp(ts) });
  else await put(`users/${uid}/treasury_txs/${id}t`, { type: 'Ajout', amount: q * p, source: pay === 'baridi' ? 'BaridiMob' : 'Caisse', linkedTxId: id, ...stamp(ts) });
}
await put(`users/${uid}/pricing_plans/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, { monthlyGoal: 60000, minimumGoal: 48000 });
// V21-1: the demo account works only with an activation (rules canWrite).
await put(`access/${uid}`, { until: now + 365 * DAY, name: 'Démo' });
console.log('seeded', uid);
