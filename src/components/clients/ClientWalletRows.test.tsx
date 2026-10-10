import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import type { ClientDzd, ClientTransactionDzd } from '../../types';
import { ClientDetailsView } from './ClientDetailsView';

// V4-2: the client file shows the wallet addresses the client gave us (TRC20, BEP20), each whole
// and with its own copy button. A client without any shows the file as before.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: false }),
};

// Invented addresses: random characters, not the address of anybody.
const TRC20 = 'TSAyduyxxu5hxvF9Wjy7qqEgTR7ETpm5hx';
const BEP20 = '0xe24cf6562ce66dad398c21b61a78f731554db18c';

const baseClient: ClientDzd = { id: 'c1', fullName: 'Client Source', phone: '0550000000', redotpayId: '1704037642', binanceEmail: 'client@example.com', notes: 'Client note' };
const tx: ClientTransactionDzd = {
    id: 't1', clientId: 'c1', timestamp: new Date('2026-08-27T10:00:00Z').getTime(), date: '27/08/2026', time: '10:00', montant: -500, type: 'Paiement Effectué',
};

function render(client: ClientDzd, lang: 'fr' | 'ar', copiedValue: string | null = null) {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>
        <ClientDetailsView selectedClientId={client.id} selectedClient={client} selectedClientBalance={-500} groupedHistory={{ '27/08/2026': [tx] }}
            clientTransactionsDzd={[tx]} clientsDzd={[client]} setSelectedClientId={() => {}} getClientFullName={(c) => c.fullName} openClientSummary={() => {}}
            openClientModal={() => {}} copiedValue={copiedValue} handleCopy={() => {}} transactions={[]} profitByTxId={{}} handleEditClientTx={() => {}}
            handleDeleteClientTxClick={() => {}} openClientTxModal={() => {}} openClientToClientTransferModal={() => {}}/>
      </LanguageProvider>);
}
/** The part of the page that is the client file, where the contact rows are. */
const clientFile = (html: string) => {
    const start = html.search(/<div role="tabpanel" aria-label="(Dossier client|ملف العميل)"/);
    assert.ok(start >= 0, 'the client file is on the page');
    return html.slice(start);
};
/** The text of the line that shows an address: the `<p>` that holds it. */
const addressLine = (html: string, address: string) => {
    const match = html.match(new RegExp(`<p [^>]*>${address}</p>`));
    assert.ok(match, `the address ${address} is shown whole`);
    return match[0];
};

const LABELS = {
    fr: { copy: 'Copier', address: 'Adresse' },
    ar: { copy: 'نسخ', address: 'عنوان محفظة' },
} as const;

for (const lang of ['fr', 'ar'] as const) {
    const { copy, address } = LABELS[lang];

    // Both networks: each address whole (broken over lines, never cut), under its label, with its copy button.
    {
        const file = clientFile(render({ ...baseClient, wallets: { TRC20, BEP20 } }, lang));
        for (const [network, value] of [['TRC20', TRC20], ['BEP20', BEP20]] as const) {
            assert.ok(file.includes(`>${address} ${network}</p>`), `${lang}: the label of ${network}`);
            const line = addressLine(file, value);
            assert.match(line, /break-all/, `${lang}: ${network} is broken over lines`);
            assert.doesNotMatch(line, /truncate/, `${lang}: ${network} is not cut with an ellipsis`);
            assert.match(line, /dir="ltr"/);
            assert.ok(file.includes(`aria-label="${copy} ${address} ${network}"`), `${lang}: the copy button of ${network}`);
        }
        // Order of the file: phone, RedotPay, Binance, then the wallets in the order of the list.
        const order = [baseClient.phone!, baseClient.redotpayId!, baseClient.binanceEmail!, TRC20, BEP20].map((text) => file.indexOf(`>${text}</p>`));
        assert.ok(order.every((index) => index >= 0), `${lang}: every contact row is shown`);
        assert.deepEqual([...order].sort((a, b) => a - b), order, `${lang}: wallets come after the other contacts, TRC20 before BEP20`);
        // The other contact rows keep their look (one line, cut with an ellipsis when too long).
        assert.match(file, new RegExp(`<p [^>]*truncate[^>]*>${baseClient.binanceEmail}</p>`));
    }

    // One network only: just its row.
    {
        const file = clientFile(render({ ...baseClient, wallets: { BEP20 } }, lang));
        assert.ok(file.includes(`>${address} BEP20</p>`));
        assert.ok(file.includes(BEP20));
        assert.ok(!file.includes(`${address} TRC20`), `${lang}: no row for the network without an address`);
    }

    // Addresses alone are contact information: the rows show even when the client has no phone or email.
    {
        const file = clientFile(render({ id: 'c2', fullName: 'Client Seul', wallets: { TRC20 } }, lang));
        assert.ok(file.includes(`>${address} TRC20</p>`));
        assert.ok(file.includes(TRC20));
    }

    // The row that was just copied shows the check; the other does not.
    {
        const file = clientFile(render({ ...baseClient, wallets: { TRC20, BEP20 } }, lang, TRC20));
        const buttonOf = (network: string) => file.match(new RegExp(`<button[^>]*aria-label="${copy} ${address} ${network}"[^>]*>`))![0];
        assert.match(buttonOf('TRC20'), /bg-financial-profit-bg/, `${lang}: the copied address is marked`);
        assert.doesNotMatch(buttonOf('BEP20'), /bg-financial-profit-bg/);
    }

    // No address: no row, whatever the stored value is, and the file is the one of a client without the field.
    {
        const plain = clientFile(render(baseClient, lang));
        for (const wallets of [null, {}, undefined, { TRC20: '', BEP20: '   ' }, [TRC20], TRC20] as unknown[]) {
            const file = clientFile(render({ ...baseClient, wallets } as ClientDzd, lang));
            assert.equal(file, plain, `${lang}: ${JSON.stringify(wallets)} changes nothing in the file`);
        }
        assert.ok(!plain.includes(`${address} TRC20`) && !plain.includes(`${address} BEP20`));
        assert.doesNotMatch(plain, /break-all/);
    }
}

console.log('ClientWalletRows tests passed');
