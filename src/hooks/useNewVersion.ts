import { useEffect, useState } from 'react';

// V24-1 (owner): an app left open on the phone kept the old version after a deploy. When the app comes back to the
// screen (and every 10 minutes), the site's page is read again: if its main script is not the one running, a new
// version was published and a bar offers to reload. Nothing is reloaded without the owner's tap.
const ENTRY = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

export function currentEntry(doc: Pick<Document, 'querySelectorAll'> = document): string | null {
    for (const s of Array.from(doc.querySelectorAll('script[src]')) as HTMLScriptElement[]) {
        const m = ENTRY.exec(s.getAttribute('src') || '');
        if (m) return m[0];
    }
    return null;
}

export function entryOf(html: string): string | null {
    return ENTRY.exec(html)?.[0] ?? null;
}

export function useNewVersion(): boolean {
    const [available, setAvailable] = useState(false);
    useEffect(() => {
        const running = currentEntry();
        if (!running) return undefined; // dev server: nothing to compare
        let stopped = false;
        const check = async () => {
            if (stopped || document.visibilityState !== 'visible') return;
            try {
                const html = await (await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' })).text();
                const latest = entryOf(html);
                if (latest && latest !== running) setAvailable(true);
            } catch { /* offline: try again later */ }
        };
        const onVisible = () => { void check(); };
        document.addEventListener('visibilitychange', onVisible);
        const timer = setInterval(check, 10 * 60 * 1000);
        return () => { stopped = true; document.removeEventListener('visibilitychange', onVisible); clearInterval(timer); };
    }, []);
    return available;
}
