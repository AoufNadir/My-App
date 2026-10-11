import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { translations } from '../../translations';
import { settlementChannel, tradeChannel } from '../../utils/channelSummary';
import { ChannelStrip } from './ChannelStrip';

type Lang = 'fr' | 'ar';
const lookup = (lang: Lang) => (key: string): unknown => key.split('.').reduce<any>((node, part) => node?.[part], translations[lang]);
const textOf = (html: string) => html.replace(/<[^>]*>/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, '');

for (const lang of ['fr', 'ar'] as const) {
    const t = lookup(lang);
    const render = (props: Partial<Parameters<typeof ChannelStrip>[0]> & Pick<Parameters<typeof ChannelStrip>[0], 'summary' | 'operation'>) =>
        renderToStaticMarkup(<ChannelStrip amountLabel="150 000 DZD" t={t} {...props}/>);

    // No amount, no strip.
    assert.equal(render({ summary: null, operation: 'sell' }), '', `${lang}: nothing without an amount`);

    // One colour per channel: cash green, BaridiMob blue, credit orange, another client neutral.
    const cases: Array<[string, Parameters<typeof render>[0], string, string]> = [
        ['cash sale', { summary: tradeChannel({ operation: 'sell', status: 'cash', amount: 150_000 }), operation: 'sell' }, 'cash', 'bg-financial-profit-bg'],
        ['baridi sale', { summary: tradeChannel({ operation: 'sell', status: 'baridi', amount: 150_000 }), operation: 'sell' }, 'baridi', 'bg-financial-asset-bg'],
        ['credit sale', { summary: tradeChannel({ operation: 'sell', status: 'credit', primaryClientId: 'c1', amount: 150_000 }), operation: 'sell', clientName: 'Karim' }, 'credit', 'bg-financial-debt-bg'],
        ['cash purchase', { summary: tradeChannel({ operation: 'buy', status: 'cash', amount: 150_000 }), operation: 'buy' }, 'cash', 'bg-financial-profit-bg'],
        ['payment to another client', { summary: tradeChannel({ operation: 'sell', status: 'cash', otherClientId: 'c2', amount: 150_000 }), operation: 'sell', clientName: 'Samir' }, 'client', 'bg-surface-muted'],
        ['payment received', { summary: settlementChannel({ received: true, status: 'baridi', amount: 150_000 }), operation: 'settlement' }, 'baridi', 'bg-financial-asset-bg'],
    ];
    for (const [name, props, kind, colour] of cases) {
        const html = render(props);
        assert.ok(html.includes(`data-channel="${kind}"`), `${lang} ${name}: channel ${kind}`);
        assert.ok(html.includes(colour), `${lang} ${name}: colour ${colour}`);
        assert.ok(textOf(html).startsWith(String((t('channelStrip.title')))), `${lang} ${name}: titled`);
        assert.ok(!/\{(amount|client)\}/.test(html), `${lang} ${name}: no placeholder left`);
        assert.ok(html.includes('150 000 DZD'), `${lang} ${name}: the amount`);
    }

    // The sentences name the wallet or the client.
    assert.ok(textOf(render({ summary: tradeChannel({ operation: 'sell', status: 'baridi', amount: 1 }), operation: 'sell' })).includes('BaridiMob'));
    assert.ok(textOf(render({ summary: tradeChannel({ operation: 'sell', status: 'credit', primaryClientId: 'c1', amount: 1 }), operation: 'sell', clientName: 'Karim' })).includes('Karim'));
    assert.ok(textOf(render({ summary: tradeChannel({ operation: 'buy', status: 'cash', otherClientId: 'c2', amount: 1 }), operation: 'buy', clientName: 'Samir' })).includes('Samir'));
    // A client without a name still reads well.
    assert.ok(textOf(render({ summary: tradeChannel({ operation: 'sell', status: 'credit', amount: 1 }), operation: 'sell' })).includes(String(t('channelStrip.theClient'))));

    // The usual-channel warning shows only when asked, under the strip.
    const plain = render({ summary: tradeChannel({ operation: 'sell', status: 'cash', amount: 1 }), operation: 'sell' });
    assert.ok(!plain.includes('role="note"'), `${lang}: no warning by default`);
    const warned = render({ summary: tradeChannel({ operation: 'sell', status: 'cash', amount: 1 }), operation: 'sell', usualDiffers: 'baridi' });
    assert.ok(warned.includes('role="note"') && textOf(warned).includes(String(t('channelStrip.usualBaridi'))), `${lang}: warning for a client who usually pays by BaridiMob`);
    const warnedCash = render({ summary: tradeChannel({ operation: 'sell', status: 'baridi', amount: 1 }), operation: 'sell', usualDiffers: 'cash' });
    assert.ok(textOf(warnedCash).includes(String(t('channelStrip.usualCash'))), `${lang}: warning for a client who usually pays in cash`);
}

// Both languages carry every key the strip can ask for, and keep the same placeholders.
const KEYS = ['title', 'theClient', 'inCaisse', 'inBaridi', 'outCaisse', 'outBaridi', 'creditSell', 'creditBuy', 'clientIn', 'clientOut', 'usualCash', 'usualBaridi'];
for (const key of KEYS) {
    const fr = String(lookup('fr')(`channelStrip.${key}`));
    const ar = String(lookup('ar')(`channelStrip.${key}`));
    assert.ok(fr && ar && fr !== 'undefined' && ar !== 'undefined', `channelStrip.${key} in both languages`);
    const placeholders = (text: string) => (text.match(/\{[a-z]+\}/g) ?? []).sort().join(',');
    assert.equal(placeholders(fr), placeholders(ar), `channelStrip.${key}: same placeholders in both languages`);
}

console.log('ChannelStrip tests passed');
