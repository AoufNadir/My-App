import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../contexts/LanguageContext';
import { NotificationSettings } from '../components/main/NotificationSettings';
import { NOTIFICATION_KINDS, NOTIFICATION_PREFS_KEY, isNotificationEnabled, readNotificationPrefs, setAppBadgeCount, writeNotificationPref } from './notificationPrefs';

// The phone's notification choices (V9-4): all on until switched off, kept on the phone, a damaged value reads as « all on ».

const store = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } }; };

const fresh = store();
assert.deepEqual(readNotificationPrefs(fresh), { overdue: true, profit: true, terms: true, inventory: true });
const after = writeNotificationPref('profit', false, fresh);
assert.equal(after.profit, false);
assert.equal(isNotificationEnabled('profit', fresh), false);
assert.equal(isNotificationEnabled('overdue', fresh), true, 'the others stay on');
const damaged = store();
damaged.setItem(NOTIFICATION_PREFS_KEY, '{not json');
assert.ok(NOTIFICATION_KINDS.every((kind) => readNotificationPrefs(damaged)[kind]), 'a damaged value reads as all on');
assert.doesNotThrow(() => setAppBadgeCount(3), 'no badge support is not an error');
assert.equal(isNotificationEnabled('terms', null), true, 'no storage at all: on');

(globalThis as { window?: unknown }).window = { localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
(globalThis as { localStorage?: unknown }).localStorage = (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;
const render = (permission: 'default' | 'granted' | 'denied' | 'unsupported') => renderToStaticMarkup(<LanguageProvider><NotificationSettings initialPermission={permission}/></LanguageProvider>);
assert.ok(render('default').includes('Activer les notifications'), 'to ask: one button');
const granted = render('granted');
assert.equal((granted.match(/role="switch"/g) || []).length, 4, 'granted: one switch per kind');
assert.ok(!granted.includes('Activer les notifications'));
assert.ok(render('denied').includes('bloquées'), 'blocked: says how to unblock');
assert.ok(render('unsupported').includes('écran d’accueil'), 'unsupported: iPhone hint');
console.log('notification preferences tests passed');
