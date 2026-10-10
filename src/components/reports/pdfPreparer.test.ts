import assert from 'node:assert/strict';

import { createPdfPreparer, sheetFingerprint } from './pdfPreparer';

// V4-4: the PDF of a report window is made ahead of the tap. The rules that keep it honest: one
// capture at a time, a PDF made for an older version of the report is never handed out, and two
// callers asking for the same version share one capture.

const pdf = (label: string) => new Blob([label], { type: 'application/pdf' });
const text = async (blob: Blob | null) => (blob ? blob.text() : null);
function deferred() {
    let resolve!: (blob: Blob) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Blob>((ok, fail) => {
        resolve = ok;
        reject = fail;
    });
    return { promise, resolve, reject };
}

async function main() {
    // 1. Made once, handed out again without another capture.
    {
        const preparer = createPdfPreparer();
        let captures = 0;
        const render = async () => {
            captures += 1;
            return pdf('v1');
        };
        assert.equal(preparer.ready(), null, 'nothing made yet');
        assert.equal(await text(await preparer.make(render)), 'v1');
        assert.equal(await text(preparer.ready()), 'v1', 'ready after it is made');
        assert.equal(await text(await preparer.make(render)), 'v1');
        assert.equal(captures, 1, 'one capture for two requests');
    }

    // 2. A tap while the background capture runs waits for it (no second capture).
    {
        const preparer = createPdfPreparer();
        const slow = deferred();
        let captures = 0;
        const render = () => {
            captures += 1;
            return slow.promise;
        };
        const ahead = preparer.make(render);
        const tapped = preparer.make(render);
        slow.resolve(pdf('ahead'));
        assert.equal(await text(await ahead), 'ahead');
        assert.equal(await text(await tapped), 'ahead');
        assert.equal(captures, 1, 'the tap shares the capture made ahead');
    }

    // 3. The report changed while it was being made: that PDF is thrown away, the next one waits
    //    for the first capture to let go of the sheet, then is made for the new version.
    {
        const preparer = createPdfPreparer();
        const first = deferred();
        const order: string[] = [];
        const old = preparer.make(() => {
            order.push('old starts');
            return first.promise;
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        preparer.invalidate();
        const fresh = preparer.make(async () => {
            order.push('new starts');
            return pdf('new');
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.deepEqual(order, ['old starts'], 'one capture at a time');
        first.resolve(pdf('old'));
        assert.equal(await old, null, 'the old PDF is not handed out');
        assert.equal(await text(await fresh), 'new');
        assert.deepEqual(order, ['old starts', 'new starts']);
        assert.equal(await text(preparer.ready()), 'new', 'only the new one is kept');
    }

    // 4. Changed again before the waiting capture even starts: it does not start at all.
    {
        const preparer = createPdfPreparer();
        const first = deferred();
        let started = 0;
        const old = preparer.make(() => first.promise);
        await new Promise((resolve) => setTimeout(resolve, 0));
        preparer.invalidate();
        const skipped = preparer.make(async () => {
            started += 1;
            return pdf('skipped');
        });
        preparer.invalidate();
        first.resolve(pdf('old'));
        await old;
        assert.equal(await skipped, null);
        assert.equal(started, 0, 'a capture for a version nobody wants is never started');
        assert.equal(preparer.ready(), null);
    }

    // 5. invalidate() forgets a PDF that was ready.
    {
        const preparer = createPdfPreparer();
        await preparer.make(async () => pdf('v1'));
        preparer.invalidate();
        assert.equal(preparer.ready(), null);
        assert.equal(await text(await preparer.make(async () => pdf('v2'))), 'v2');
    }

    // 6. A failed capture is reported to the caller and the next request tries again.
    {
        const preparer = createPdfPreparer();
        await assert.rejects(preparer.make(async () => {
            throw new Error('canvas refused');
        }), /canvas refused/);
        assert.equal(preparer.ready(), null);
        assert.equal(await text(await preparer.make(async () => pdf('retry'))), 'retry');
    }

    // The fingerprint of a sheet: same content, same print; any word or number changed, another one.
    assert.equal(sheetFingerprint('a.pdf', 'Title', 'Solde 1 000 DZD'), sheetFingerprint('a.pdf', 'Title', 'Solde 1 000 DZD'));
    assert.notEqual(sheetFingerprint('a.pdf', 'Title', 'Solde 1 000 DZD'), sheetFingerprint('a.pdf', 'Title', 'Solde 1 001 DZD'));
    assert.notEqual(sheetFingerprint('a.pdf', 'Title', 'x'), sheetFingerprint('b.pdf', 'Title', 'x'));
    assert.notEqual(sheetFingerprint('ab', 'c'), sheetFingerprint('a', 'bc'), 'the parts are kept apart');
    assert.equal(sheetFingerprint(null, undefined), sheetFingerprint('', ''));

    console.log('pdf preparer tests passed');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
