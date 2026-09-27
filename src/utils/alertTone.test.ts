import assert from 'node:assert/strict';
import { alertToastDurationMs, detectAlertTone, stripAlertEmoji } from './alertTone';

// Tone comes from the leading emoji every alert carries.
assert.equal(detectAlertTone('✅ Client archivé.'), 'success');
assert.equal(detectAlertTone('❌ Erreur lors de la suppression du client.'), 'error');
assert.equal(detectAlertTone('⚠️ Nom requis.'), 'warning');
assert.equal(detectAlertTone('ℹ️ Aucune donnée.'), 'info');
// A closed month refuses the change: it must stay on screen like a warning.
assert.equal(detectAlertTone('🔒 Opération du 01/09/2026 : ce mois est clôturé.'), 'warning');
// Messages without an emoji still fall back to keywords.
assert.equal(detectAlertTone('Solde insuffisant'), 'error');
assert.equal(detectAlertTone('Client ajouté'), 'success');

// The toast draws its own icon, so the emoji is removed from the text.
assert.equal(stripAlertEmoji('✅ Client archivé.'), 'Client archivé.');
assert.equal(stripAlertEmoji('⚠️ Nom requis.'), 'Nom requis.');
assert.equal(stripAlertEmoji('🔒 Opération du 01/09/2026'), 'Opération du 01/09/2026');
assert.equal(stripAlertEmoji('✅ تمت أرشفة العميل.'), 'تمت أرشفة العميل.');
assert.equal(stripAlertEmoji('Solde insuffisant'), 'Solde insuffisant');
assert.equal(stripAlertEmoji('100 USDT vendus'), '100 USDT vendus');

// Errors and warnings wait for the user; confirmations leave by themselves.
assert.equal(alertToastDurationMs('❌ Erreur.', 'error', false), null);
assert.equal(alertToastDurationMs('⚠️ Nom requis.', 'warning', false), null);
assert.equal(alertToastDurationMs('✅ Client archivé.', 'success', false), 4_000);
// An undo gets more time to be pressed.
assert.equal(alertToastDurationMs('✅ Client archivé.', 'success', true), 6_000);
// A long message gets time to be read, up to 10 seconds.
assert.equal(alertToastDurationMs(`✅ ${'a'.repeat(100)}`, 'success', false), 7_500);
assert.equal(alertToastDurationMs(`ℹ️ ${'a'.repeat(500)}`, 'info', false), 10_000);

console.log('alertTone tests passed');
