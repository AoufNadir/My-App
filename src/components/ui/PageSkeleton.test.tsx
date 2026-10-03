import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { translations } from '../../translations';
import { PageSkeleton, getPageSkeletonKind } from './PageSkeleton';

// While the data loads, each page shows grey cards in its own shape (a list, a detail page,
// a page of figures, the home page) instead of the same six bars everywhere, and screen
// readers hear « Chargement… » in the reader's language.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
};

assert.equal(getPageSkeletonKind('dashboard'), 'dashboard');
for (const view of ['transactions', 'dzd', 'services'])
    assert.equal(getPageSkeletonKind(view), 'list', view);
for (const view of ['tresorerie', 'statistiques', 'analytics', 'expenses', 'investors'])
    assert.equal(getPageSkeletonKind(view), 'stats', view);
for (const view of ['dzd', 'services', 'investors'])
    assert.equal(getPageSkeletonKind(view, true), 'detail', `${view} with a client, service or investor open`);

const rows = (html: string) => (html.match(/min-h-14 items-center gap-3 border-t/g) || []).length;
for (const lang of ['fr', 'ar'] as const) {
    storage.set('app_lang', lang);
    const shapes = Object.fromEntries((['dashboard', 'list', 'detail', 'stats'] as const)
        .map((kind) => [kind, renderToStaticMarkup(<LanguageProvider><PageSkeleton kind={kind}/></LanguageProvider>)]));
    for (const [kind, html] of Object.entries(shapes)) {
        assert.ok(html.includes('role="status"') && html.includes('aria-busy="true"'), `${lang} ${kind}: announced as loading`);
        assert.ok(html.includes(`<span class="sr-only">${translations[lang].dashboard.loadingAria}</span>`), `${lang} ${kind}: « loading » in the reader's language`);
        assert.ok(html.includes(`data-skeleton="${kind}"`), `${lang} ${kind}`);
    }
    assert.equal(rows(shapes.list), 6, 'a list page: six rows');
    assert.equal(rows(shapes.detail), 5, 'a detail page: five rows under the balance');
    assert.ok(shapes.detail.includes('grid-cols-4'), 'a detail page: its four quick actions');
    assert.equal(rows(shapes.stats), 4, 'a page of figures: four rows under the tiles');
    assert.equal(rows(shapes.dashboard), 3, 'home: three rows under the tiles');
}

console.log('PageSkeleton.test: each page loads with grey cards in its own shape, announced in the reader\'s language');
