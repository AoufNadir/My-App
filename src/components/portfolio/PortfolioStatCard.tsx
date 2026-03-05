import React from 'react';
import { PencilIcon } from '../icons/PencilIcon';

type PortfolioStatCardProps = {
  title: string;
  value: string;
  currency?: string;
  colorClass: string;
  subtleText: string;
  onEdit?: () => void;
  children?: React.ReactNode;
  className?: string;
  isDark: boolean;
};

export function PortfolioStatCard({
  title,
  value,
  currency,
  colorClass,
  subtleText,
  onEdit,
  children,
  className,
  isDark
}: PortfolioStatCardProps) {
  const [isTouched, setIsTouched] = React.useState(false);

  return (
    <div
      className={`group relative p-5 rounded-2xl shadow-sm border transition-all ${isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'} ${onEdit ? 'cursor-pointer' : ''} ${className || ''}`}
      onClick={() => {
        if (onEdit) setIsTouched(true);
      }}
      onMouseLeave={() => setIsTouched(false)}
    >
      <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
        <span>{title}</span>
        {onEdit && (
          <div className={`absolute top-3 right-3 transition-opacity duration-200 ${isTouched ? 'opacity-100 pointer-events-auto' : 'opacity-100 pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto'}`}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className={`p-2 rounded-full ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 ring-1 ring-slate-500/50' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 ring-1 ring-slate-200'} shadow-lg`}
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-1 text-3xl font-bold">
        <span className={colorClass}>{value}</span>
        {currency && <span className={`ml-2 text-lg font-normal ${subtleText}`}>{currency}</span>}
      </div>
      {children}
    </div>
  );
}
