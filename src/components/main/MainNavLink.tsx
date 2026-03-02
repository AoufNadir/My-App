import React, { type ReactNode } from 'react';

type MainNavLinkProps = {
    activeView: string;
    targetView: string;
    colorClass: string;
    isDark: boolean;
    onSelect: (view: string) => void;
    children: ReactNode;
};

export function MainNavLink({
    activeView,
    targetView,
    colorClass,
    isDark,
    onSelect,
    children,
}: MainNavLinkProps) {
    return (
        <button
            onClick={() => onSelect(targetView)}
            className={`flex-1 text-center font-semibold tracking-wider uppercase py-2.5 px-4 rounded-lg transition-colors text-sm ${activeView === targetView ? `${colorClass} text-white shadow-md` : `${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-black/5'}`}`}
        >
            {children}
        </button>
    );
}

