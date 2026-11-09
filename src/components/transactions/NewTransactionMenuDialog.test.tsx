import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewTransactionMenuDialog } from './NewTransactionMenuDialog';

// V13-2: « Nouvelle opération » shows the EUR tiles unless EUR is hidden in the settings; USDT always.
const noop = () => {};
const render = (showEur?: boolean) => renderToStaticMarkup(<NewTransactionMenuDialog isOpen onClose={noop} t={(k) => k} openForm={noop} openWalletTransferModal={noop} openTransferModal={noop} openAdjustmentModal={noop} openDeliveryExpenseModal={noop} showEur={showEur}/>);
const tiles = (html: string, code: string) => 2 * (html.split(`>${code}</p>`).length - 1);
assert.equal(tiles(render(), 'USDT'), 2);
assert.equal(tiles(render(), 'EUR'), 2, 'EUR shown by default, as before');
assert.equal(tiles(render(false), 'EUR'), 0, 'EUR hidden');
assert.equal(tiles(render(false), 'USDT'), 2, 'USDT always');
console.log('NewTransactionMenuDialog.test: EUR tiles follow the settings');
