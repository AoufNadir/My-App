import { createContext, useContext, type ReactNode } from 'react';
import type { TradeCurrencyCode } from '../currency/tradeCurrencies';

// V13-2 / V14-2: which currencies are shown (settings > Devises). Read by every window that offers a currency as a
// choice, so hiding one takes it out everywhere at once. Default: all shown, as the app always was.
type Shown = { showUsdt: boolean; showEur: boolean; showRmb: boolean };
const CurrencyVisibilityContext = createContext<Shown>({ showUsdt: true, showEur: true, showRmb: true });

export function CurrencyVisibilityProvider({ showUsdt = true, showEur, showRmb = true, children }: { showUsdt?: boolean; showEur: boolean; showRmb?: boolean; children?: ReactNode }) {
    return <CurrencyVisibilityContext.Provider value={{ showUsdt, showEur, showRmb }}>{children}</CurrencyVisibilityContext.Provider>;
}

export const useShowEur = (): boolean => useContext(CurrencyVisibilityContext).showEur;
/** V13-3: whether RMB is shown (settings > « Je travaille avec le RMB »). */
export const useShowRmb = (): boolean => useContext(CurrencyVisibilityContext).showRmb;
/** V14-2: whether USDT is shown. */
export const useShowUsdt = (): boolean => useContext(CurrencyVisibilityContext).showUsdt;
/** V14-2: any currency of the list. */
export function useCurrencyShown(): (code: TradeCurrencyCode) => boolean {
    const shown = useContext(CurrencyVisibilityContext);
    return (code) => (code === 'USDT' ? shown.showUsdt : code === 'EUR' ? shown.showEur : shown.showRmb);
}

/** Drops the EUR choice when EUR is hidden, unless it is the value already chosen (an operation saved in EUR). */
export function withoutHiddenEur<T extends { id: string }>(options: T[], showEur: boolean, current?: string): T[] {
    return showEur || current === 'EUR' ? options : options.filter((option) => option.id !== 'EUR');
}
/** V14-2: the same for any currency of the list. */
export function withoutHiddenCurrencies<T extends { id: string }>(options: T[], isShown: (code: TradeCurrencyCode) => boolean, current?: string): T[] {
    return options.filter((option) => option.id === current || !['USDT', 'EUR', 'RMB'].includes(option.id) || isShown(option.id as TradeCurrencyCode));
}
