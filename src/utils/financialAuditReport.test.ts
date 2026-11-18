import assert from 'node:assert/strict';
import { buildFinancialAudit, periodStarts, type BackupFile } from './financialAuditReport';

// The read-only audit on a fake backup (format of Réglages → Sauvegarde, version 3). Fake figures only.
const NOW = new Date('2026-11-18T15:00:00').getTime();
const at = (d: number, h = 12) => ({ __timestamp: new Date(2026, 10, d, h).toISOString() });
const doc = (id: string, data: Record<string, unknown>) => ({ id, data });
const backup: BackupFile = {
    version: 3, exportedAt: '2026-11-18T14:00:00Z', user: { managerFeePercentage: '30' },
    collections: {
        investors: [
            doc('owner', { name: 'Owner', isManager: true, initialCapital: 3_420_000, entryDate: '2020-01-01' }),
            doc('inv', { name: 'Investor', initialCapital: 1_230_000, entryDate: '2020-01-01' }),
        ],
        usdt_txs: [
            doc('b1', { type: 'buy', currency: 'USDT', quantity: 20_000, price: 250, total: 5_000_000, timestamp: at(1), date: '01/11/2026', time: '12:00' }),
            doc('s1', { type: 'sell', currency: 'USDT', quantity: 10_000, sell: 260, total: 2_600_000, timestamp: at(3), date: '03/11/2026', time: '12:00' }), // +100 000
            doc('s2', { type: 'sell', currency: 'USDT', quantity: 1_000, sell: 211, total: 211_000, timestamp: at(12), date: '12/11/2026', time: '12:00' }), // −39 000
            doc('s3', { type: 'sell', currency: 'USDT', quantity: 1_000, sell: 270, total: 270_000, timestamp: at(18, 9), date: '18/11/2026', time: '09:00' }), // +20 000 today
        ],
        treasury_txs: [
            doc('e1', { origin: 'delivery_expense', type: 'Retrait', amount: 350, amountDzd: 350, source: 'Caisse', timestamp: at(13), notes: 'InDrive' }),
            doc('p1', { origin: 'personal_expense', type: 'Retrait', amount: 39_000, source: 'Caisse', timestamp: at(14), notes: 'compensation perte' }),
        ],
        investor_transactions: [
            doc('ip1', { investorId: 'owner', type: 'withdraw_profit', origin: 'personal_expense', amount: 39_000, linkedTreasuryTxId: 'p1', timestamp: at(14) }),
        ],
        dzd_client_txs: [],
    },
};
const { text } = buildFinancialAudit(backup, { now: NOW, declaredOwnerCapital: 3_420_000, declaredOthersCapital: 1_230_000 });
assert.deepEqual(periodStarts(NOW).week, new Date(2026, 10, 16).getTime(), 'the app week starts on Monday 16 November');
assert.match(text, /Part du gérant dans les 70 % : déclarée 73\.55 %/);
// month: +120 000 −39 000 −350 = 80 650 net; today: +20 000
assert.match(text, /\| Mois \(dès 2026-11-01\) \| 120 000 \| -39 000 \| 350 \| 0 \| 80 650 \|/);
assert.match(text, /\| Aujourd’hui \(dès 2026-11-18\) \| 20 000 \| 0 \| 0 \| 0 \| 20 000 \|/);
assert.match(text, /Vente à perte 2026-11-12/);
assert.match(text, /Frais du projet 2026-11-13 · 350 DZD · « InDrive »/);
assert.match(text, /Perte -39 000 le 2026-11-12 .* dépense personnelle 39 000 le 2026-11-14/, 'the loss paid twice is pointed out');
assert.match(text, /Contrôle: somme des bénéfices des investisseurs 80 650 = net à partager 80 650 \(écart 0\)/);
// today: rule = 20 000 × (0.3 + 0.7 × 0.7355) = 16 296.77, the app the same: gap 0
assert.match(text, /\| Aujourd’hui[^\n]*\| 16 297 \| 16 297 \| 0 \|/);
console.log('financial audit report tests passed');

{
    const { text: t7 } = buildFinancialAudit(backup as never, { now: NOW, declaredOwnerCapital: 3_420_000, declaredOthersCapital: 1_230_000 });
    assert.ok(t7.includes('## 7. Mouvements de capital'), 'section 7 present');
    assert.ok(/Total: initial 3 420 000 \+ apports 0 \+ réinvesti 0 − retraits 0 = 3 420 000/.test(t7), 'owner capital total');
    console.log('financial audit section 7 passed');
}

{
    // Section 8: each check finds what it must, and the clean parts say OK.
    const bad: BackupFile = JSON.parse(JSON.stringify(backup));
    bad.collections.treasury_txs.push(
        doc('t0', { type: 'Ajout', amount: 10_000, source: 'Caisse', timestamp: at(1, 8) }),
        doc('t1', { type: 'Retrait', amount: 20_000, source: 'Caisse', timestamp: at(2) }),
        doc('t2', { type: 'Retrait', amount: 0, source: 'Caisse', timestamp: at(2) }),
        doc('t3', { type: 'Retrait', amount: 500, source: 'Mystère', timestamp: at(2) }),
        doc('t4', { origin: 'personal_expense', type: 'Retrait', amount: 1_200, source: 'BaridiMob', advanceState: 'pending', timestamp: at(15) }),
        doc('t5', { type: 'Ajout', amount: 5_000, source: 'BaridiMob', linkedTxId: 'gone', timestamp: at(1, 7) }),
    );
    bad.collections.dzd_clients = [doc('c1', { name: 'Client' })];
    bad.collections.dzd_client_txs = [doc('ct1', { clientId: 'c1', montant: -3_000, timestamp: at(4) }), doc('ct2', { clientId: 'nobody', montant: 100, timestamp: at(4) })];
    const { text: t8 } = buildFinancialAudit(bad, { now: NOW });
    assert.match(t8, /Soldes recalculés: BaridiMob 3 800 · Caisse -49 350/);
    assert.match(t8, /❌ Trésorerie: aucun compte en dessous de zéro \(1\)\n- Caisse passe à -10 000 le 2026-11-02/);
    assert.match(t8, /❌ Trésorerie: aucun mouvement ignoré par le calcul \(2\)/);
    assert.match(t8, /compte « Mystère » non reconnu/);
    assert.match(t8, /✅ Stock: aucune devise en dessous de zéro/);
    assert.match(t8, /❌ Clients: chaque ligne appartient à un client existant \(1\)/);
    assert.match(t8, /Clients: dettes -3 000 · avances 100 · net -2 900\./);
    assert.match(t8, /❌ Liens: .* \(1\)\n- trésorerie t5 · linkedTxId → opération gone absent/);
    assert.match(t8, /✅ Partage: chaque mois/);
    assert.match(t8, /❌ Avances personnelles réglées \(1\)\n- 2026-11-15 12:00 · 1 200 DZD/);
    assert.match(text, /✅ Avances personnelles réglées\nAucune avance en attente\./);
    console.log('financial audit section 8 passed');
}
