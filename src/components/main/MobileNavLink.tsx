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
        }} className={`flex min-h-button-lg w-full items-center gap-4 rounded-button px-4 py-3 text-start text-base font-semibold transition-colors ${activeView === targetView ? `${colorClass} text-white` : 'text-neutral-700 hover:bg-neutral-100'}`}>
            {icon}
            {children}
        </button>);
}
