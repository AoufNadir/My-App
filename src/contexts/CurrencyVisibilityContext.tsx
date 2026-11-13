import { createContext, useContext, type ReactNode } from 'react';
import type { TradeCurrencyCode } from '../currency/tradeCurrencies';

// V13-2 / V14-4: which currencies are hidden (settings > Devises), for every currency of the list. Read by every
// window that offers a currency as a choice, so hiding one takes it out everywhere at once. Default: all shown.
const CurrencyVisibilityContext = createContext<ReadonlyArray<string>>([]);

export function CurrencyVisibilityProvider({ hidden = [], children }: { hidden?: ReadonlyArray<string>; children?: ReactNode }) {
    return <CurrencyVisibilityContext.Provider value={hidden}>{children}</CurrencyVisibilityContext.Provider>;
}

/** Any currency of the list. */
export function useCurrencyShown(): (code: TradeCurrencyCode) => boolean {
    const hidden = useContext(CurrencyVisibilityContext);
    return (code) => !hidden.includes(code);
}
export const useShowEur = (): boolean => !useContext(CurrencyVisibilityContext).includes('EUR');
export const useShowRmb = (): boolean => !useContext(CurrencyVisibilityContext).includes('RMB');
export const useShowUsdt = (): boolean => !useContext(CurrencyVisibilityContext).includes('USDT');

/** Drops the EUR choice when EUR is hidden, unless it is the value already chosen (an operation saved in EUR). */
export function withoutHiddenEur<T extends { id: string }>(options: T[], showEur: boolean, current?: string): T[] {
    return showEur || current === 'EUR' ? options : options.filter((option) => option.id !== 'EUR');
}
/** The same for any currency of the list. */
export function withoutHiddenCurrencies<T extends { id: string }>(options: T[], isShown: (code: TradeCurrencyCode) => boolean, current?: string): T[] {
    return options.filter((option) => option.id === current || isShown(option.id as TradeCurrencyCode));
}
