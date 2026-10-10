/**
 * Keeps the PDF of a report window made ahead of the tap (V4-4). The phone's share sheet only
 * opens within a few seconds of a tap, and making a PDF takes longer than that on a slow phone: so
 * the window makes it as soon as the report is on screen, and the tap only shares it.
 *
 * Rules: one capture at a time (they all lay out the same sheet), a PDF made for an older version
 * of the report is thrown away, and two callers asking for the same version get the same capture.
 * Plain functions only, so the rules are tested without a browser.
 */
export type PdfPreparer = {
    /** The PDF of the report as it is now, if it is made */
    ready: () => Blob | null;
    /** The report changed: what is made or being made is out of date */
    invalidate: () => void;
    /** The PDF of the report as it is now: the made one, the one being made, or a new one. null: the report changed meanwhile */
    make: (render: () => Promise<Blob>) => Promise<Blob | null>;
};

export function createPdfPreparer(): PdfPreparer {
    let version = 0;
    let readyPdf: Blob | null = null;
    let making: { version: number; promise: Promise<Blob | null> } | null = null;
    let running: Promise<unknown> = Promise.resolve();
    return {
        ready: () => readyPdf,
        invalidate: () => {
            version += 1;
            readyPdf = null;
        },
        make: (render) => {
            if (readyPdf)
                return Promise.resolve(readyPdf);
            if (making && making.version === version)
                return making.promise;
            const mine = version;
            const before = running;
            const promise = (async () => {
                // The capture before this one (of an older version) lets go of the sheet first.
                await before;
                if (mine !== version)
                    return null;
                const pdf = await render();
                if (mine !== version)
                    return null;
                readyPdf = pdf;
                return pdf;
            })();
            making = { version: mine, promise };
            running = promise.catch(() => undefined);
            const done = () => {
                if (making?.promise === promise)
                    making = null;
            };
            promise.then(done, done);
            return promise;
        },
    };
}

/** A short fingerprint of what the sheet shows: when it changes, the PDF made before is out of date. */
export function sheetFingerprint(...parts: ReadonlyArray<string | null | undefined>): string {
    let hash = 0x811c9dc5;
    let length = 0;
    for (const part of parts) {
        const text = part ?? '';
        length += text.length;
        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        hash ^= 0xff;
        hash = Math.imul(hash, 0x01000193);
    }
    return `${length}:${(hash >>> 0).toString(36)}`;
}
