import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyClientRow } from '../utils/clientActivityReport';
import { computeDigitalServicePreview } from '../utils/digitalServiceAccounting';

// V15-6: a digital service bought on credit from a supplier (a client of the list).
const rates = { usdtPma: 250, eurPma: 280 };
const preview = computeDigitalServicePreview({ purchaseWallet: 'Credit', purchaseAmount: 3000, saleWallet: 'Credit', saleAmount: 3500, rates });
assert.equal(preview.purchaseAmountDzd, 3000, 'the price owed is the purchase price in dinars');
assert.equal(preview.profitDzd, 500, 'the profit is the same as a purchase paid now');

const supplierRow = classifyClientRow({ id: 'r', clientId: 's', timestamp: 1, montant: 3000, type: 'Achat service numérique', affectsBalance: true } as never);
assert.equal(supplierRow.balanceCents, 300000, 'the supplier is owed the price (positive: theirs with us)');
assert.equal(supplierRow.kind, 'service');

const src = readFileSync(new URL('./useDigitalServiceHandlers.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.match(src, /if \(!digitalServiceSupplierId\) return '⚠️ Fournisseur requis\.'/, 'rule 11: no credit purchase without its supplier');
assert.match(src, /if \(digitalServicePurchaseWallet === 'Credit'\) return '';/, 'no wallet balance check when nothing leaves a wallet');
const creditBranch = src.slice(src.indexOf("if (digitalServicePurchaseWallet === 'Credit') {\n                // V15-6"), src.indexOf('else if (isCashWallet(digitalServicePurchaseWallet))'));
assert.match(creditBranch, /dzd_client_txs/, 'the debt goes on the supplier account');
assert.doesNotMatch(creditBranch, /treasury_txs|usdt_txs/, 'no cash or currency leaves on a credit purchase');
assert.match(src, /setPurchaseWalletChosen\(Boolean\(wallet\)\)/, 'clearing the wallet means not chosen');
console.log('digital service credit purchase tests passed');
