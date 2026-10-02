import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { BottomSheet } from './BottomSheet';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from './Dialog';
import { closeTopOverlay, openOverlayCount, registerOverlay, unregisterOverlay } from './overlayStack';

// V2-4 gave every window one frame: a named dialog, the same header with a close button, the
// same actions row, one confirmation window, and one stack so that Escape and the phone's back
// button close the window on top only.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: false }),
};
function render(node: React.ReactElement, lang: 'fr' | 'ar' = 'fr') {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
}
const noop = () => undefined;
const buttonsIn = (html: string) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((match) => match[1].replace(/<[^>]+>/g, '').trim());
function labelledTitle(html: string) {
    const labelledBy = /role="dialog"[^>]*aria-labelledby="([^"]+)"/.exec(html)?.[1];
    assert.ok(labelledBy, 'the window points to its title');
    const title = new RegExp(`<h2[^>]*id="${labelledBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>(.*?)</h2>`).exec(html)?.[1];
    return title?.replace(/<[^>]+>/g, '');
}

// ---- 1. Confirmation window ----
{
    assert.equal(render(<ConfirmDialog isOpen={false} onClose={noop} onConfirm={noop} title="Supprimer ?"/>), '', 'closed: nothing on the page');

    const html = render(<ConfirmDialog isOpen onClose={noop} onConfirm={noop} title="Supprimer le client ?" description="Client Alpha et son historique." note="Action irréversible"/>);
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.equal(labelledTitle(html), 'Supprimer le client ?', 'named by its title');
    assert.ok(html.includes('Client Alpha et son historique.'), 'description shown');
    assert.ok(html.includes('Action irréversible'), 'warning note shown');
    assert.deepEqual(buttonsIn(html), ['Annuler', 'Confirmer'], 'Cancel first, the action last');

    const custom = render(<ConfirmDialog isOpen onClose={noop} onConfirm={noop} title="Solder ?" confirmLabel="Solder" cancelLabel="Retour" variant="primary"/>);
    assert.deepEqual(buttonsIn(custom), ['Retour', 'Solder'], 'custom labels');

    const blocked = render(<ConfirmDialog isOpen onClose={noop} onConfirm={noop} title="Suppression impossible" hideConfirm/>);
    assert.deepEqual(buttonsIn(blocked), ['Fermer'], 'blocked action: only Close');

    const arabic = render(<ConfirmDialog isOpen onClose={noop} onConfirm={noop} title="حذف العميل؟"/>, 'ar');
    assert.deepEqual(buttonsIn(arabic), ['إلغاء', 'تأكيد'], 'Arabic labels');
    assert.deepEqual(buttonsIn(render(<ConfirmDialog isOpen onClose={noop} onConfirm={noop} title="غير ممكن" hideConfirm/>, 'ar')), ['إغلاق']);

    const busy = render(<ConfirmDialog isOpen onClose={noop} onConfirm={noop} title="Supprimer ?" loading/>);
    assert.match(busy, /<button[^>]*disabled=""[^>]*>Annuler<\/button>/, 'Cancel waits while the action runs');
}

// ---- 2. Header, title and actions row of every window ----
{
    const html = render(<Dialog isOpen onClose={noop} layout="centered">
        <DialogHeader onClose={noop}><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
        <div>Champs</div>
        <DialogFooter><button type="button">Annuler</button><button type="button">Enregistrer</button></DialogFooter>
      </Dialog>);
    assert.equal(labelledTitle(html), 'Nouveau client', 'DialogTitle names the window');
    assert.match(html, /<button[^>]*aria-label="Fermer"/, 'close button named');
    assert.match(html, /sticky top-0[^"]*border-b/, 'header stays visible');
    assert.match(html, /sticky bottom-0[^"]*border-t/, 'actions stay visible');
    assert.match(render(<Dialog isOpen onClose={noop} layout="sheet"><DialogHeader onClose={noop}><DialogTitle>عميل جديد</DialogTitle></DialogHeader></Dialog>, 'ar'), /aria-label="إغلاق"/);
    assert.equal(render(<Dialog isOpen={false} onClose={noop}><DialogTitle>X</DialogTitle></Dialog>), '', 'closed window: nothing');

    const sheet = render(<BottomSheet isOpen onClose={noop} title="Filtres"><div>Contenu</div></BottomSheet>);
    assert.equal(labelledTitle(sheet), 'Filtres', 'bottom sheet named by its title');
    assert.match(sheet, /aria-label="Fermer"/);
}

// ---- 3. One stack: Escape and back close the window on top only ----
{
    let keydown: ((event: unknown) => void) | null = null;
    const body = { style: { overflow: 'auto' } };
    (globalThis as { document?: unknown }).document = {
        body,
        activeElement: null,
        addEventListener: (type: string, listener: (event: unknown) => void) => { if (type === 'keydown') keydown = listener; },
        removeEventListener: (type: string, listener: (event: unknown) => void) => { if (type === 'keydown' && keydown === listener) keydown = null; },
    };
    const closed: string[] = [];
    const open = (name: string) => {
        const id: number = registerOverlay(() => { closed.push(name); unregisterOverlay(id); }, () => null);
        return id;
    };

    assert.equal(closeTopOverlay(), false, 'nothing open: back goes to the page');
    const first = open('client');
    assert.equal(body.style.overflow, 'hidden', 'page behind is locked');
    assert.ok(keydown, 'Escape is listened to');
    open('confirm');
    assert.equal(openOverlayCount(), 2);

    assert.equal(closeTopOverlay(), true);
    assert.deepEqual(closed, ['confirm'], 'back closes the confirmation only');
    assert.equal(body.style.overflow, 'hidden', 'still locked under the first window');

    const escape = (extra: Record<string, unknown> = {}) => keydown!({ key: 'Escape', defaultPrevented: false, target: null, ...extra });
    escape({ defaultPrevented: true });
    escape({ target: { getAttribute: (name: string) => (name === 'aria-expanded' ? 'true' : null) } });
    assert.deepEqual(closed, ['confirm'], 'an open list inside the window takes Escape first');

    open('search');
    escape();
    assert.deepEqual(closed, ['confirm', 'search'], 'Escape closes the window on top');
    escape();
    assert.deepEqual(closed, ['confirm', 'search', 'client']);
    assert.equal(openOverlayCount(), 0);
    assert.equal(body.style.overflow, 'auto', 'page scrolls again after the last window');
    assert.equal(keydown, null, 'Escape listener removed');
    unregisterOverlay(first);
    assert.equal(openOverlayCount(), 0, 'closing twice is harmless');
}

console.log('dialogFrame.test: confirmation window, window frame and window stack OK');
