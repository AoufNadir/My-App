import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../../contexts/LanguageContext';
import { translations } from '../../translations';
import { NotificationBell, NotificationPanel, type NotificationItem } from './NotificationCenter';

// The bell: a badge with the unread count (red when money is at risk), and a sheet where read items turn quiet.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
};
(globalThis as unknown as { localStorage: unknown }).localStorage = (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;
const render = (node: ReactElement) => renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
const fr = translations.fr.dashboard as unknown as Record<string, string>;
const noop = () => {};

const none = render(<NotificationBell count={0} tone="none" onClick={noop}/>);
assert.ok(!none.includes('aria-hidden="true" class="absolute'), 'no badge without unread items');
const urgent = render(<NotificationBell count={3} tone="urgent" onClick={noop}/>);
assert.ok(urgent.includes('bg-financial-loss') && urgent.includes('>3<'), 'red badge with the count');
assert.ok(urgent.includes(`${fr.notificationsPanel} (3)`), 'the count is read aloud');
assert.ok(render(<NotificationBell count={12} tone="info" onClick={noop}/>).includes('9+'), '9+ above nine');

const items: NotificationItem[] = [
    { entry: { id: 'overdue-debts', signature: '4', urgent: true }, row: { tone: 'loss', icon: null, title: '4 clients en retard' } },
    { entry: { id: 'weekly-recap', signature: 'w1' }, card: <p>Récap</p> },
];
const unread = render(<NotificationPanel items={items} read={{}} onMarkAllRead={noop}/>);
assert.ok(unread.includes('4 clients en retard') && unread.includes('Récap'), 'both items in the sheet');
assert.ok(unread.includes(fr.notificationsMarkRead), 'mark all read offered');
assert.ok(!unread.includes('opacity-60'), 'unread items are not dimmed');
const allRead = render(<NotificationPanel items={items} read={{ 'overdue-debts': '4', 'weekly-recap': 'w1' }} onMarkAllRead={noop}/>);
assert.ok(allRead.includes('opacity-60') && !allRead.includes(fr.notificationsMarkRead), 'read items are quiet and nothing is left to mark');
const changed = render(<NotificationPanel items={items} read={{ 'overdue-debts': '3', 'weekly-recap': 'w1' }} onMarkAllRead={noop}/>);
assert.ok(changed.includes(fr.notificationsMarkRead), 'a changed state comes back unread');
assert.ok(render(<NotificationPanel items={[]} read={{}} onMarkAllRead={noop}/>).includes(fr.notificationsEmpty), 'empty message');
console.log('NotificationCenter tests passed');
