import React from 'react';
export type FabPosition = 'br' | 'bc' | 'inline';
export interface FabProps {
    icon: React.ReactNode;
    onClick: () => void;
    label?: string;
    position?: FabPosition;
    /** Additional classes for the floating wrapper. */
    wrapperClassName?: string;
    /** Additional classes for the button itself. */
    className?: string;
    ariaLabel?: string;
    disabled?: boolean;
}
const POSITION_WRAPPER: Record<FabPosition, string> = {
    br: 'fixed end-4 bottom-24 z-40 sm:bottom-8',
    bc: 'fixed left-1/2 -translate-x-1/2 bottom-24 z-40 sm:bottom-8',
    inline: '',
};
/**
 * Primary floating action button. Defaults to bottom-right above the
 * mobile bottom bar; switch to `position="bc"` for centered FAB inside a
 * tab bar's notch.
 */
export const Fab: React.FC<FabProps> = ({ icon, onClick, label, position = 'br', wrapperClassName = '', className = '', ariaLabel, disabled = false, }) => {
    const safeAreaClass = position === 'br' || position === 'bc' ? 'pb-[env(safe-area-inset-bottom)]' : '';
    return (<div className={`${POSITION_WRAPPER[position]} ${safeAreaClass} ${wrapperClassName}`}>
      <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel || label || 'Action'} className={`h-14 w-14 rounded-full bg-primary text-white shadow-card-hover flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none ${className}`}>
        {icon}
      </button>
      {label && <span className="sr-only">{label}</span>}
    </div>);
};
