import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewTransactionMenuDialog } from '../components/transactions/NewTransactionMenuDialog';

// The « Nouvelle opération » menu shows a buy and a sell tile for each traded currency of the settings.
const noop = () => {};
const render = (currencies?: string[]) => renderToStaticMarkup(<NewTransactionMenuDialog isOpen onClose={noop} t={(k) => k} openForm={noop} openWalletTransferModal={noop} openTransferModal={noop} openAdjustmentModal={noop} openDeliveryExpenseModal={noop} currencies={currencies} openOtherCurrency={currencies ? noop : undefined}/>);
const tiles = (html: string, code: string) => html.split(`>${code}</p>`).length - 1;

const legacy = render();
assert.equal(tiles(legacy, 'USDT'), 2);
assert.equal(tiles(legacy, 'EUR'), 2);
assert.ok(!legacy.includes('transactions.convertCurrencies'), 'no conversion button for the app as it was');

const other = render(['GBP', 'CNY']);
assert.equal(tiles(other, 'USDT'), 0, 'USDT not chosen, not shown');
assert.equal(tiles(other, 'GBP'), 2);
assert.equal(tiles(other, 'CNY'), 2);
assert.ok(other.includes('transactions.convertCurrencies'));

const mixed = render(['USDT', 'GBP', 'CNY', 'CHF']);
for (const code of ['USDT', 'GBP', 'CNY', 'CHF']) assert.equal(tiles(mixed, code), 2, code);
console.log('newOperationMenu: ok');
