import React, { useState, useRef, useEffect } from 'react';
type DropdownProps = {
    trigger: React.ReactNode;
    children?: React.ReactNode;
    contentClassName?: string;
    align?: 'start' | 'end';
};
export function Dropdown({ trigger, children, contentClassName, align = 'end' }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const handleToggle = () => setIsOpen(!isOpen);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    const cardBase = 'bg-surface border-border';
    const alignClass = align === 'start' ? 'start-0' : 'end-0';
    const animClass = align === 'start' ? 'anim-dropdown-in anim-dropdown-in-start' : 'anim-dropdown-in';
    return (<div className="relative" ref={dropdownRef}>
      <div onClick={handleToggle} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (<div className={`${animClass} absolute top-full ${alignClass} mt-2 w-56 rounded-md shadow-lg z-20 ${cardBase} border p-1 ${contentClassName || ''}`} onClick={() => setIsOpen(false)}>
          {children}
        </div>)}
    </div>);
}
type DropdownItemProps = {
    key?: React.Key;
    children?: React.ReactNode;
    onClick: () => void;
    isActive?: boolean;
    icon?: React.ReactNode;
};
export function DropdownItem({ children, onClick, isActive, icon }: DropdownItemProps) {
    const activeClass = isActive ? 'bg-primary text-white' : 'text-neutral-700 hover:bg-neutral-100';
    return (<button onClick={onClick} className={`w-full min-h-touch text-start px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${activeClass}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>);
}
