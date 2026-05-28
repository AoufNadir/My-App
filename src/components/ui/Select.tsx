import React from 'react';
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    error?: string;
    helperText?: string;
};
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, label, error, helperText, id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (<div className="flex w-full flex-col gap-1.5">
        {label && (<label htmlFor={selectId} className="text-sm font-medium text-neutral-700">
            {label}
          </label>)}
        <select id={selectId} ref={ref} className={[
            'flex w-full min-h-[44px] rounded-md border px-3 py-2 text-sm',
            'bg-surface text-neutral-900',
            'transition-colors',
            error
                ? 'border-danger focus-visible:ring-danger'
                : 'border-border hover:border-border-strong focus-visible:ring-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
            className
        ]
            .filter(Boolean)
            .join(' ')} {...props}>
          {children}
        </select>
        {error && (<p className="text-xs text-danger">{error}</p>)}
        {!error && helperText && (<p className="text-xs text-neutral-500">{helperText}</p>)}
      </div>);
});
Select.displayName = 'Select';
export { Select };
