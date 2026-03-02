import React, { type ReactNode } from 'react';

type MobileNavLinkProps = {
    activeView: string;
    targetView: string;
    colorClass: string;
    isDark: boolean;
    icon: ReactNode;
    onSelect: (view: string) => void;
    onClose: () => void;
    children: ReactNode;
};

export function MobileNavLink({
    activeView,
    targetView,
    colorClass,
    isDark,
    icon,
    onSelect,
    onClose,
    children,
}: MobileNavLinkProps) {
    return (
        <button
            onClick={() => {
                onSelect(targetView);
                onClose();
            }}
            className={`flex items-center gap-4 w-full text-left p-4 rounded-lg text-lg font-semibold transition-colors ${activeView === targetView ? `${colorClass} text-white` : `${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-black/5'}`}`}
        >
            {icon}
            {children}
        </button>
    );
}

