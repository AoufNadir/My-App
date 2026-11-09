import { createContext, useContext, type ReactNode } from 'react';

// V13-2: whether EUR is shown (settings > « Je travaille avec l’EUR »). Read by every window that offers EUR as a
// choice, so hiding it takes it out everywhere at once. Default: shown, as the app always was.
const CurrencyVisibilityContext = createContext<{ showEur: boolean }>({ showEur: true });

export function CurrencyVisibilityProvider({ showEur, children }: { showEur: boolean; children?: ReactNode }) {
    return <CurrencyVisibilityContext.Provider value={{ showEur }}>{children}</CurrencyVisibilityContext.Provider>;
}

export const useShowEur = (): boolean => useContext(CurrencyVisibilityContext).showEur;

/** Drops the EUR choice when EUR is hidden, unless it is the value already chosen (an operation saved in EUR). */
export function withoutHiddenEur<T extends { id: string }>(options: T[], showEur: boolean, current?: string): T[] {
    return showEur || current === 'EUR' ? options : options.filter((option) => option.id !== 'EUR');
}
