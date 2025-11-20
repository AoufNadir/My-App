
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type DropdownProps = {
  trigger: React.ReactNode;
  children?: React.ReactNode;
  contentClassName?: string;
  isDark?: boolean;
};

export function Dropdown({ trigger, children, contentClassName, isDark }: DropdownProps) {
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
            className={`absolute top-full right-0 mt-2 w-56 origin-top-right rounded-md shadow-lg z-20 ${cardBase} border p-1 ${contentClassName}`}
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
};

export function DropdownItem({ children, onClick, isActive }: DropdownItemProps) {
    const activeClass = isActive ? 'bg-sky-500 text-white' : 'hover:bg-white/5';
    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${activeClass}`}
        >
            {children}
        </button>
    );
}