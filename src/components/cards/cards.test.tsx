import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AlertCard, AlertStack, HeroCard, ListRow, SectionCard, StatTile } from './index';
import { SegmentedControl } from '../ui/SegmentedControl';
import { formatNumber } from '../../pages/shared/pageFormat';

const noop = () => undefined;
const buttons = (html: string) => html.split('<button').length - 1;

// An alert with an action is one button (the whole card); a dismissible alert adds a labelled close button.
{
    const html = renderToStaticMarkup(<AlertCard tone="danger" title="3 clients en retard" detail="Dette" onAction={noop} actionLabel="Voir clients"/>);
    assert.equal(buttons(html), 1);
    assert.ok(html.includes('bg-financial-loss-bg') && html.includes('text-neutral-900'), 'danger background, readable title');
    const info = renderToStaticMarkup(<AlertCard tone="info" title="Récap" onDismiss={noop} dismissLabel="Fermer"/>);
    assert.equal(buttons(info), 1);
    assert.ok(info.includes('aria-label="Fermer"'));
    const withFooter = renderToStaticMarkup(<AlertCard tone="info" title="Notifications" footer={<button type="button">Activer</button>}/>);
    assert.ok(withFooter.includes('Activer') && withFooter.includes('ps-11'), 'footer aligned under the text');
    const plain = renderToStaticMarkup(<AlertCard tone="warning" title="Stock bas"/>);
    assert.equal(buttons(plain), 0, 'no action, no button');
}

// The stack shows two alerts and folds the rest behind one button.
{
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ id, element: <AlertCard tone="warning" title={`alerte ${id}`}/> }));
    const html = renderToStaticMarkup(<AlertStack items={items} moreLabel={(count) => `+${count}`} lessLabel="moins"/>);
    assert.ok(html.includes('alerte a') && html.includes('alerte b') && !html.includes('alerte c'));
    assert.ok(html.includes('aria-expanded="false"') && html.includes('+2'));
    const short = renderToStaticMarkup(<AlertStack items={items.slice(0, 2)} moreLabel={(count) => `+${count}`} lessLabel="moins"/>);
    assert.ok(short.includes('alerte b') && !short.includes('aria-expanded'), 'two alerts: nothing folded');
    assert.equal(renderToStaticMarkup(<AlertStack items={[]} moreLabel={String} lessLabel=""/>), '', 'no alert, nothing drawn');
}

// Hero: one large amount, one secondary line; tiles and rows keep amounts whole and left-to-right.
{
    const html = renderToStaticMarkup(<HeroCard label="Profit brut des ventes · Ce mois" value={184_523.2} top={<span>période</span>} secondary={{ label: 'Mon profit réel', value: -1_200, hint: 'Après…' }}/>);
    assert.ok(html.includes('text-3xl') && html.includes(formatNumber(184_523.2, { min: 0 })), 'hero amount');
    assert.ok(html.includes('text-financial-loss'), 'a negative secondary amount is red');
    assert.ok(html.indexOf('période') < html.indexOf('Profit brut'), 'the period switch sits above the label');
    const tile = renderToStaticMarkup(<StatTile label="Caisse" value={1_250_431} tone="dzd" icon={<svg/>}/>);
    assert.ok(tile.includes('dir="ltr"') && tile.includes(formatNumber(1_250_431, { min: 0 })) && tile.includes('text-financial-dzd'));
    const row = renderToStaticMarkup(<ListRow title="Plan du mois" subtitle="Assistant" onClick={noop} standalone/>);
    assert.equal(buttons(row), 1);
    assert.ok(row.includes('rtl:-scale-x-100'), 'the arrow turns in Arabic');
    assert.equal(buttons(renderToStaticMarkup(<ListRow title="Lecture seule"/>)), 0);
    const section = renderToStaticMarkup(<SectionCard title="Dernières opérations" actionLabel="Voir tout" onAction={noop} flush><p>liste</p></SectionCard>);
    assert.ok(section.includes('Voir tout') && section.includes('<p>liste</p>') && section.includes('aria-labelledby'));
    assert.equal(buttons(renderToStaticMarkup(<SectionCard title="Sans action" actionLabel="Voir tout"><p/></SectionCard>)), 0, 'a label without a handler draws no button');
}

// The period switch marks exactly one option and stays on one line.
{
    const html = renderToStaticMarkup(<SegmentedControl options={[{ id: 'day', label: 'Jour' }, { id: 'week', label: 'Semaine' }, { id: 'month', label: 'Mois' }]} value="week" onChange={noop} ariaLabel="Période"/>);
    assert.equal(html.split('aria-pressed="true"').length - 1, 1);
    assert.match(html, /aria-pressed="true"[^>]*>Semaine</);
    assert.ok(html.includes('grid-flow-col') && html.includes('aria-label="Période"'));
}

console.log('cards tests passed');
