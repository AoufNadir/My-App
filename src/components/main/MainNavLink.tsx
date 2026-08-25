import React, { useRef, type ReactNode, forwardRef } from 'react';
type MainNavLinkProps = {
    activeView: string;
    targetView: string;
    colorClass: string;
    onSelect: (view: string) => void;
    className?: string;
    fillWidth?: boolean;
    children: ReactNode;
};
export const MainNavLink = forwardRef<HTMLButtonElement, MainNavLinkProps>(({
    activeView,
    targetView,
    colorClass,
    onSelect,
    className = '',
    fillWidth = true,
    children
}, ref) => {
    const ignoreNextClickRef = useRef(false);
    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        ignoreNextClickRef.current = event.pointerType !== 'mouse';
    };
    const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === 'mouse')
            return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.blur();
        onSelect(targetView);
    };
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (ignoreNextClickRef.current) {
            ignoreNextClickRef.current = false;
            return;
        }
        event.currentTarget.blur();
        onSelect(targetView);
    };
    return (<button ref={ref} type="button" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onClick={handleClick} className={`${fillWidth ? 'flex-1 py-2.5 px-4' : 'flex-none'} inline-flex items-center justify-center text-center font-semibold tracking-wider uppercase rounded-lg transition-colors text-sm ${activeView === targetView ? `${colorClass} text-white shadow-md` : 'text-neutral-600 hover:bg-neutral-100'} ${className}`}>
            {children}
        </button>);
});
MainNavLink.displayName = 'MainNavLink';
