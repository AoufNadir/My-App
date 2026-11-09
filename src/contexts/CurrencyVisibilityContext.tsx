import { createContext, useContext, type ReactNode } from 'react';

// V13-2: whether EUR is shown (settings > « Je travaille avec l’EUR »). Read by every window that offers EUR as a
// choice, so hiding it takes it out everywhere at once. Default: shown, as the app always was.
const CurrencyVisibilityContext = createContext<{ showEur: boolean; showRmb: boolean }>({ showEur: true, showRmb: true });

export function CurrencyVisibilityProvider({ showEur, showRmb = true, children }: { showEur: boolean; showRmb?: boolean; children?: ReactNode }) {
    return <CurrencyVisibilityContext.Provider value={{ showEur, showRmb }}>{children}</CurrencyVisibilityContext.Provider>;
}

export const useShowEur = (): boolean => useContext(CurrencyVisibilityContext).showEur;
/** V13-3: whether RMB is shown (settings > « Je travaille avec le RMB »). */
export const useShowRmb = (): boolean => useContext(CurrencyVisibilityContext).showRmb;

/** Drops the EUR choice when EUR is hidden, unless it is the value already chosen (an operation saved in EUR). */
export function withoutHiddenEur<T extends { id: string }>(options: T[], showEur: boolean, current?: string): T[] {
    return showEur || current === 'EUR' ? options : options.filter((option) => option.id !== 'EUR');
}
