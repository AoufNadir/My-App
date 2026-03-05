import React, { ReactNode } from 'react';
import { translations } from '../translations';

function translateFr(key: string): string {
    const keys = key.split('.');
    let value: any = translations.fr;

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key;
        }
    }

    return value as string;
}

export const useLanguage = () => ({ t: translateFr });

interface LanguageProviderProps {
    children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
    if (typeof document !== 'undefined') {
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'fr';
    }

    return <>{children}</>;
};
