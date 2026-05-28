import { useEffect, useRef } from 'react';
/**
 * Wires the browser/Android system back button to in-app navigation.
 *
 * Pass an ordered list of handlers, highest priority first. On back press,
 * the first handler that returns `true` wins — the browser's default pop
 * is then re-armed by pushing a fresh history entry so subsequent backs
 * also stay inside the app until the root view is reached.
 *
 * The hook also pushes a synthetic history entry on mount so the very first
 * system back has something to consume.
 */
export function useBackHandler(handlers: ReadonlyArray<() => boolean>) {
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        // Seed the stack so the first system back can be intercepted.
        window.history.pushState({ __appback: true }, '');
        const onPop = () => {
            let handled = false;
            for (const h of handlersRef.current) {
                try {
                    if (h()) {
                        handled = true;
                        break;
                    }
                }
                catch {
                    // Swallow handler errors — never break the back-button chain.
                }
            }
            if (handled) {
                // Re-seed so the next back press is also intercepted.
                window.history.pushState({ __appback: true }, '');
            }
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
}
