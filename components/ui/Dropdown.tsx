
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type DropdownProps = {
  trigger: React.ReactNode;
  children?: React.ReactNode;
  contentClassName?: string;
  isDark?: boolean;
  align?: 'start' | 'end';
};

export function Dropdown({ trigger, children, contentClassName, isDark, align = 'end' }: DropdownProps) {
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

  const cardBase = isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-[#E5E7EB]';
  const alignClass = align === 'start' ? 'left-0 origin-top-left' : 'right-0 origin-top-right';

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={handleToggle} className="cursor-pointer">
        {trigger}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1 }}
            className={`absolute top-full ${alignClass} mt-2 w-56 rounded-md shadow-lg z-20 ${cardBase} border p-1 ${contentClassName}`}
            onClick={() => setIsOpen(false)} // Close when an item is clicked
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type DropdownItemProps = {
  children?: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  icon?: React.ReactNode;
};

export function DropdownItem({ children, onClick, isActive, icon }: DropdownItemProps) {
  const activeClass = isActive ? 'bg-sky-500 text-white' : 'hover:bg-white/5';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${activeClass}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}