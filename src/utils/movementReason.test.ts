import assert from 'node:assert/strict';
import type { TreasuryTx, Tx } from '../types';
import {
    adjustmentReasonBlock,
    adjustmentReasonsFor,
    buildMovementReasonData,
    buildMovementReview,
    isAdjustmentReasonAllowed,
    isMeaningfulReasonNote,
    isRedirectReason,
    isUnlinkedCryptoMovement,
    isUnlinkedTreasuryMovement,
    movementReasonDocId,
    parseMovementReason,
    reasonMapOf,
} from './movementReason';

// V7-2: what the adjustment window asks, and how movements recorded without a reason are found.

// 1. The reasons offered per wallet and direction.
{
    assert.deepEqual(adjustmentReasonsFor('DZD-Caisse', 'add'), ['client', 'wallet_transfer', 'other']);
    assert.deepEqual(adjustmentReasonsFor('DZD-Baridi', 'subtract'), ['client', 'personal_withdrawal', 'project_expense', 'wallet_transfer', 'other']);
    assert.deepEqual(adjustmentReasonsFor('USDT', 'add'), ['buy', 'other']);
    assert.deepEqual(adjustmentReasonsFor('EUR', 'subtract'), ['sell', 'personal_withdrawal', 'project_expense', 'other']);
    for (const asset of ['DZD-Caisse', 'DZD-Baridi', 'USDT', 'EUR'] as const) {
        for (const direction of ['add', 'subtract'] as const) {
            const reasons = adjustmentReasonsFor(asset, direction);
            assert.ok(reasons.includes('other'), `${asset} ${direction}: a correction or other reason is always possible`);
            assert.ok(reasons.length >= 2, `${asset} ${direction}: there is a real choice`);
        }
    }
    // A client reason only exists for the cash wallets, where the client row carries the effect.
    assert.ok(!adjustmentReasonsFor('USDT', 'add').includes('client') && !adjustmentReasonsFor('EUR', 'subtract').includes('client'));
    assert.ok(isRedirectReason('personal_withdrawal') && isRedirectReason('wallet_transfer') && isRedirectReason('buy') && isRedirectReason('sell') && isRedirectReason('project_expense'));
    assert.ok(!isRedirectReason('client') && !isRedirectReason('other') && !isRedirectReason(''));
}

// 1b. A reason is only accepted for the wallet and direction it was offered for.
{
    assert.equal(isAdjustmentReasonAllowed('DZD-Baridi', 'subtract', 'client'), true);
    assert.equal(isAdjustmentReasonAllowed('USDT', 'add', 'client'), false, 'a client reason has no meaning for USDT');
    assert.equal(isAdjustmentReasonAllowed('DZD-Caisse', 'add', 'personal_withdrawal'), false, 'money cannot enter as a withdrawal');
    assert.equal(isAdjustmentReasonAllowed('EUR', 'subtract', 'other'), true);
    assert.equal(isAdjustmentReasonAllowed('DZD-Caisse', 'add', ''), false);
    assert.equal(isAdjustmentReasonAllowed('Bitcoin', 'add', 'other'), false, 'an unknown wallet');
}

// 2. A written reason must say something.
{
    for (const empty of ['', '  ', 'ab', 'Ajustement Trésorerie', ' ajustement trésorerie ', 'Ajustement Manuel', undefined, null])
        assert.equal(isMeaningfulReasonNote(empty as string), false, `${JSON.stringify(empty)} is not a reason`);
    for (const ok of ['erreur de saisie', 'Don', 'تصحيح خطأ في التسجيل'])
        assert.equal(isMeaningfulReasonNote(ok), true, `${ok} is a reason`);
}

// 3. When Save is allowed.
{
    const base = { clientId: '', note: '' };
    assert.equal(adjustmentReasonBlock({ ...base, reason: '' }), 'reason');
    assert.equal(adjustmentReasonBlock({ ...base, reason: 'buy' }), 'reason', 'a reason with its own window cannot be saved here');
    assert.equal(adjustmentReasonBlock({ ...base, reason: 'client' }), 'client');
    assert.equal(adjustmentReasonBlock({ ...base, reason: 'client', clientId: 'c1' }), null);
    assert.equal(adjustmentReasonBlock({ ...base, reason: 'other' }), 'note');
    assert.equal(adjustmentReasonBlock({ ...base, reason: 'other', note: 'Ajustement Trésorerie' }), 'note', 'the default note is not a reason');
    assert.equal(adjustmentReasonBlock({ ...base, reason: 'other', note: 'erreur de saisie' }), null);
}

// 4. The reason document: built, read back, malformed ones dropped.
{
    const data = buildMovementReasonData('treasury', 't1', '  erreur de saisie  ', 1_000, 'adjustment');
    assert.deepEqual(data, { movementKind: 'treasury', movementId: 't1', note: 'erreur de saisie', timestamp: 1_000, source: 'adjustment' });
    assert.equal(buildMovementReasonData('treasury', 't1', 'ab', 1_000, 'review'), null);
    assert.equal(buildMovementReasonData('treasury', '', 'erreur de saisie', 1_000, 'review'), null);
    assert.equal(buildMovementReasonData('crypto', 'c1', 'erreur de saisie', Number.NaN, 'review'), null);
    assert.deepEqual(parseMovementReason('treasury_t1', data), { id: 'treasury_t1', ...data });
    assert.equal(parseMovementReason('x', null), null);
    assert.equal(parseMovementReason('x', { ...data, movementKind: 'other' }), null);
    assert.equal(parseMovementReason('x', { ...data, note: '  ' }), null);
    assert.equal(parseMovementReason('x', { ...data, timestamp: 'now' }), null);
    assert.equal(parseMovementReason('x', { ...data, source: 'something' })?.source, 'adjustment');
    assert.equal(movementReasonDocId('crypto', 'c9'), 'crypto_c9');
}

// 5. Which movements nothing explains.
const stamp = (n: number) => ({ timestamp: n * 1_000, date: `0${n}/10/2026`, time: '10:00' });
const treasury = (id: string, extra: Partial<TreasuryTx>): TreasuryTx => ({ id, type: 'Retrait', source: 'BaridiMob', amount: 5_000, notes: 'Ajustement Trésorerie', ...stamp(Number(id.replace(/\D/g, '')) || 1), ...extra }) as TreasuryTx;
const crypto = (id: string, extra: Partial<Tx>): Tx => ({ id, type: 'Retrait Manuel', currency: 'USDT', quantity: 10, notes: 'Ajustement Manuel', ...stamp(Number(id.replace(/\D/g, '')) || 1), ...extra }) as Tx;
{
    const clientLinked = new Set(['t-client']);
    assert.equal(isUnlinkedTreasuryMovement(treasury('t1', {}), clientLinked), true, 'a plain exit with nothing behind it');
    assert.equal(isUnlinkedTreasuryMovement(treasury('t2', { type: 'Ajout', source: 'Caisse' }), clientLinked), true, 'a plain entry too');
    assert.equal(isUnlinkedTreasuryMovement(treasury('t-client', {}), clientLinked), false, 'a client row points at it: the effect is visible');
    assert.equal(isUnlinkedTreasuryMovement(treasury('t3', { origin: 'client_tx' }), clientLinked), false);
    assert.equal(isUnlinkedTreasuryMovement(treasury('t4', { origin: 'balance_edit' }), clientLinked), false, 'a balance correction says what it is');
    assert.equal(isUnlinkedTreasuryMovement(treasury('t5', { origin: 'personal_expense' }), clientLinked), false);
    assert.equal(isUnlinkedTreasuryMovement(treasury('t6', { linkedTxId: 'sale-1' }), clientLinked), false, 'the cash side of a sale');
    assert.equal(isUnlinkedTreasuryMovement(treasury('t7', { linkedInvestorTxId: 'inv-1' }), clientLinked), false);
    assert.equal(isUnlinkedTreasuryMovement(treasury('t8', { type: 'Transfer', destination: 'Caisse' }), clientLinked), false, 'a transfer between wallets');
    assert.equal(isUnlinkedTreasuryMovement(treasury('t9', { notes: 'Virement Caisse vers BaridiMob' }), clientLinked), false);
    assert.equal(isUnlinkedTreasuryMovement(treasury('t10', { source: undefined }), clientLinked), false, 'no wallet: not a cash movement');
    assert.equal(isUnlinkedCryptoMovement(crypto('c1', {})), true);
    assert.equal(isUnlinkedCryptoMovement(crypto('c2', { type: 'Ajout Manuel' })), true);
    assert.equal(isUnlinkedCryptoMovement(crypto('c3', { linkedTxId: 'buy-1' })), false, 'the EUR leg of a purchase');
    assert.equal(isUnlinkedCryptoMovement(crypto('c4', { origin: 'delivery_expense' })), false);
    assert.equal(isUnlinkedCryptoMovement(crypto('c5', { origin: 'balance_edit' } as unknown as Partial<Tx>)), false);
    assert.equal(isUnlinkedCryptoMovement(crypto('c6', { type: 'buy' })), false, 'a purchase is not a manual movement');
}

// 6. The review list: unexplained first, explained in words kept apart, orphan reasons ignored, newest first.
{
    const rows = {
        treasury: [
            treasury('t1', {}),
            treasury('t2', { type: 'Ajout', source: 'Caisse', amount: 12_000 }),
            treasury('t3', {}),
            treasury('t-client', {}),
            treasury('t4', { origin: 'balance_edit' }),
        ],
        crypto: [crypto('c1', {}), crypto('c2', { type: 'Ajout Manuel', currency: 'EUR', quantity: 4.5 }), crypto('c3', { linkedTxId: 'x' })],
        clientRows: [{ linkedTxId: 't-client' }, { linkedTxId: undefined }],
    };
    const none = buildMovementReview({ ...rows, reasons: [] });
    assert.deepEqual(none.unexplained.map((row) => row.key), ['treasury_t3', 'crypto_c2', 'treasury_t2', 'crypto_c1', 'treasury_t1'], 'newest first, a tie broken by key');
    assert.equal(none.explained.length, 0);
    const first = none.unexplained.find((row) => row.key === 'treasury_t2')!;
    assert.deepEqual({ wallet: first.wallet, direction: first.direction, amount: first.amount, currency: first.currency, canLinkClient: first.canLinkClient }, { wallet: 'Caisse', direction: 'in', amount: 12_000, currency: 'DZD', canLinkClient: true });
    const eur = none.unexplained.find((row) => row.key === 'crypto_c2')!;
    assert.deepEqual({ wallet: eur.wallet, direction: eur.direction, amount: eur.amount, currency: eur.currency, canLinkClient: eur.canLinkClient }, { wallet: 'EUR', direction: 'in', amount: 4.5, currency: 'EUR', canLinkClient: false });

    const reasons = [
        parseMovementReason('treasury_t1', buildMovementReasonData('treasury', 't1', 'erreur de saisie', 5_000, 'review'))!,
        parseMovementReason('crypto_c1', buildMovementReasonData('crypto', 'c1', 'don reçu', 5_000, 'adjustment'))!,
        parseMovementReason('treasury_gone', buildMovementReasonData('treasury', 'gone', 'orpheline', 5_000, 'review'))!,
        parseMovementReason('treasury_t-client', buildMovementReasonData('treasury', 't-client', 'ancienne raison', 5_000, 'review'))!,
    ];
    const withReasons = buildMovementReview({ ...rows, reasons });
    assert.deepEqual(withReasons.explained.map((row) => [row.key, row.reasonNote]), [['crypto_c1', 'don reçu'], ['treasury_t1', 'erreur de saisie']]);
    assert.deepEqual(withReasons.unexplained.map((row) => row.key).sort(), ['crypto_c2', 'treasury_t2', 'treasury_t3']);
    const all = [...withReasons.unexplained, ...withReasons.explained].map((row) => row.key).sort();
    assert.deepEqual(all, [...none.unexplained.map((row) => row.key)].sort(), 'every movement is in exactly one list');
    assert.ok(!all.includes('treasury_gone') && !all.includes('treasury_t-client'), 'a reason with no movement, or for a movement linked to a client, is ignored');
    assert.equal(reasonMapOf(reasons).get('treasury_t1')?.note, 'erreur de saisie');
}

// 7. Nothing is changed by looking: the input is left as it was.
{
    const t = [treasury('t1', {})];
    const snapshot = JSON.stringify(t);
    buildMovementReview({ treasury: t, crypto: [], clientRows: [], reasons: [] });
    assert.equal(JSON.stringify(t), snapshot);
}

console.log('movementReason tests passed');
