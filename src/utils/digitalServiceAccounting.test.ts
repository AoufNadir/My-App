import assert from 'node:assert/strict';
import {
    computeDigitalServicePreview,
    computeProjectExpensePreview,
} from './digitalServiceAccounting';

const rates = { usdtPma: 240, eurPma: 285 };

const usdtToCashSale = computeDigitalServicePreview({
    purchaseWallet: 'USDT',
    purchaseAmount: 10,
    saleWallet: 'Caisse',
    saleAmount: 3000,
    rates,
});

assert.equal(usdtToCashSale.purchaseAmountDzd, 2400);
assert.equal(usdtToCashSale.saleAmountDzd, 3000);
assert.equal(usdtToCashSale.profitDzd, 600);
assert.equal(usdtToCashSale.purchaseCurrency, 'USDT');
assert.equal(usdtToCashSale.saleCurrency, 'DZD');

const cashToEurSale = computeDigitalServicePreview({
    purchaseWallet: 'BaridiMob',
    purchaseAmount: 5000,
    saleWallet: 'EUR',
    saleAmount: 20,
    rates,
});

assert.equal(cashToEurSale.purchaseAmountDzd, 5000);
assert.equal(cashToEurSale.saleAmountDzd, 5700);
assert.equal(cashToEurSale.profitDzd, 700);
assert.equal(cashToEurSale.saleRateToDzd, 285);

const eurProjectExpense = computeProjectExpensePreview({
    wallet: 'EUR',
    amount: 12,
    rates,
});

assert.equal(eurProjectExpense.currency, 'EUR');
assert.equal(eurProjectExpense.rateToDzd, 285);
assert.equal(eurProjectExpense.amountDzd, 3420);

console.log('digitalServiceAccounting unit tests passed');
