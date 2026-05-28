import React from 'react';
export interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    className?: string;
}
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, action, className = '', }) => (<div role="status" className={`flex min-h-[160px] flex-col items-center justify-center px-4 py-8 text-center ${className}`}>
    {icon && (<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
        {icon}
      </div>)}
    <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-300">
      {title}
    </h3>
    {subtitle && (<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
        {subtitle}
      </p>)}
    {action && <div className="mt-4">{action}</div>}
  </div>);
