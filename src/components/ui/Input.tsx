import React from 'react';
export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
    helperText?: string;
};
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, label, error, helperText, id, dir, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (<div className="flex w-full flex-col gap-1.5">
        {label && (<label htmlFor={inputId} className="text-sm font-semibold leading-snug text-neutral-700">
            {label}
          </label>)}
        <input id={inputId} type={type} 
    // dir="ltr" مطلوب على حقول المبالغ المالية حتى في الصفحات العربية
    dir={dir} ref={ref} className={[
            'flex w-full min-h-input rounded-button border px-3 py-2 text-sm leading-tight',
            'bg-surface text-neutral-900 placeholder:text-neutral-400',
            'transition-colors',
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
Input.displayName = 'Input';
export { Input };
