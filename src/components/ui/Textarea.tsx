import React from 'react';
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    error?: string;
    helperText?: string;
};
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, label, error, helperText, id, dir, ...props }, ref) => {
    const areaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (<div className="flex w-full flex-col gap-1.5">
        {label && (<label htmlFor={areaId} className="text-sm font-semibold leading-snug text-neutral-700">
            {label}
          </label>)}
        <textarea id={areaId} dir={dir} ref={ref} className={[
            'flex w-full min-h-[96px] rounded-button border px-3 py-2.5 text-sm leading-snug',
            'bg-surface text-neutral-900 placeholder:text-neutral-400',
            'resize-y transition-colors',
            error
                ? 'border-danger focus-visible:ring-danger'
                : 'border-border hover:border-border-strong focus-visible:ring-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
            className
        ]
            .filter(Boolean)
            .join(' ')} {...props}/>
        {error && (<p className="text-xs text-danger">{error}</p>)}
        {!error && helperText && (<p className="text-xs text-neutral-500">{helperText}</p>)}
      </div>);
});
Textarea.displayName = 'Textarea';
export { Textarea };
