import assert from 'node:assert/strict';
import { copyImageToClipboard } from './clipboardImage';

class Item { constructor(public items: Record<string, unknown>) {} }
(async () => {
    const written: unknown[] = [];
    const blob = new Blob(['x'], { type: 'image/png' });
    assert.equal(await copyImageToClipboard(blob, { clipboard: { write: async (items) => { written.push(...items); } }, ClipboardItem: Item as never }), true);
    assert.ok(written[0] instanceof Item && (written[0] as Item).items['image/png'] === blob, 'the picture itself is copied');
    assert.equal(await copyImageToClipboard(blob, { clipboard: { write: async () => { throw new Error('denied'); } }, ClipboardItem: Item as never }), false, 'refused: the share sheet takes over');
    assert.equal(await copyImageToClipboard(blob, {}), false, 'no clipboard: the share sheet takes over');
    console.log('clipboardImage.test: the picture goes to the clipboard, or the share sheet takes over');
})();
