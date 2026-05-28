import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translations } from '../translations';
export type Lang = 'fr' | 'ar';
const SUPPORTED: Lang[] = ['fr', 'ar'];
const STORAGE_KEY = 'app_lang';
function isLang(value: string | null | undefined): value is Lang {
    return value === 'fr' || value === 'ar';
}
function readStoredLang(): Lang {
    if (typeof window === 'undefined')
        return 'fr';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : 'fr';
}
function lookup(dict: any, key: string): any {
    const parts = key.split('.');
    let value: any = dict;
    for (const k of parts) {
        if (value && typeof value === 'object' && k in value)
            value = value[k];
        else
            return undefined;
    }
    return value;
}
interface LanguageContextValue {
    lang: Lang;
    setLang: (lang: Lang) => void;
    toggleLang: () => void;
    dir: 'ltr' | 'rtl';
    t: (key: string) => any;
    supported: ReadonlyArray<Lang>;
}
const LanguageContext = createContext<LanguageContextValue | null>(null);
export const useLanguage = (): LanguageContextValue => {
    const ctx = useContext(LanguageContext);
    if (ctx)
        return ctx;
    // Fallback for any consumer that mounts before the provider (e.g. in
    // unit tests). Returns a non-reactive French snapshot.
    return {
        lang: 'fr',
        setLang: () => { },
        toggleLang: () => { },
        dir: 'ltr',
        t: (key: string) => lookup(translations.fr, key) ?? key,
        supported: SUPPORTED,
    };
};
interface LanguageProviderProps {
    children: ReactNode;
}
export const LanguageProvider = ({ children }: LanguageProviderProps) => {
    const [lang, setLangState] = useState<Lang>(() => readStoredLang());
    const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';
    useEffect(() => {
        if (typeof document === 'undefined')
            return;
        document.documentElement.dir = dir;
        document.documentElement.lang = lang;
    }, [lang, dir]);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        window.localStorage.setItem(STORAGE_KEY, lang);
    }, [lang]);
    const setLang = useCallback((next: Lang) => {
        if (isLang(next))
            setLangState(next);
    }, []);
    const toggleLang = useCallback(() => {
        setLangState(prev => (prev === 'fr' ? 'ar' : 'fr'));
    }, []);
    const t = useCallback((key: string): any => {
        const dict = (translations as Record<string, any>)[lang];
        const value = lookup(dict, key);
        if (value !== undefined)
            return value;
        // Fallback to French to avoid showing raw keys when an AR
        // translation is missing.
        if (lang !== 'fr') {
            const fr = lookup(translations.fr, key);
            if (fr !== undefined)
                return fr;
        }
        return key;
    }, [lang]);
    const value = useMemo<LanguageContextValue>(() => ({
        lang, setLang, toggleLang, dir, t, supported: SUPPORTED,
    }), [lang, setLang, toggleLang, dir, t]);
    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
