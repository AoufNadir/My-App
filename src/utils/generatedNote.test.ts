import assert from 'node:assert/strict';
import { readableNote } from './generatedNote';

const plain = (s: string) => s.replace(/[⁦⁩]/g, '');
assert.equal(plain(readableNote('Vente de 250 USDT @ 261.00', 'ar')), 'بيع 250 USDT بسعر 261,00');
assert.equal(plain(readableNote('Vente de 1 250,5 USDT @ 262.5', 'ar')), 'بيع 1 250,5 USDT بسعر 262,50');
assert.equal(plain(readableNote('Achat de 100 USDT', 'ar')), 'شراء 100 USDT');
assert.equal(plain(readableNote('Achat de 500 RMB payé en 70 USDT', 'ar')), 'شراء 500 RMB دُفع بـ 70 USDT');
assert.equal(plain(readableNote('Vente 40 GBP', 'ar')), 'بيع 40 GBP');
assert.equal(readableNote('Vente de 250 USDT @ 261.00', 'fr'), 'Vente de 250 USDT @ 261.00', 'French stays as saved');
assert.equal(readableNote('café avec le client', 'ar'), 'café avec le client', 'a note the owner wrote is not touched');
assert.equal(readableNote(undefined, 'ar'), '');
assert.match(readableNote('Vente de 250 USDT @ 261.00', 'ar'), /⁦250 USDT⁩/, 'quantity and currency kept together');
console.log('generated note tests passed');
