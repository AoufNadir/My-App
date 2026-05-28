import React, { type ReactNode } from 'react';
type MobileNavLinkProps = {
    activeView: string;
    targetView: string;
    colorClass: string;
    icon: ReactNode;
    onSelect: (view: string) => void;
    onClose: () => void;
    children: ReactNode;
};
export function MobileNavLink({ activeView, targetView, colorClass, icon, onSelect, onClose, children }: MobileNavLinkProps) {
    return (<button onClick={() => {
            onSelect(targetView);
            onClose();
        }} className={`flex items-center gap-4 w-full text-left p-4 rounded-lg text-lg font-semibold transition-colors ${activeView === targetView ? `${colorClass} text-white` : 'text-neutral-700 hover:bg-neutral-100'}`}>
            {icon}
            {children}
        </button>);
}
