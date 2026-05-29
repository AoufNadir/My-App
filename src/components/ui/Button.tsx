import React from 'react';
// Slot: lets Button render as any element (e.g. <a>) while keeping button styling.
const Slot = ({ children, ...props }: {
    children?: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) => {
    if (React.isValidElement<React.HTMLAttributes<HTMLElement>>(children)) {
        return React.cloneElement(children, {
            ...props,
            ...children.props,
            className: [props.className, children.props.className].filter(Boolean).join(' '),
        });
    }
    return null;
};
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    asChild?: boolean;
};
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-white shadow-card hover:bg-primary-dark active:bg-primary-dark',
    secondary: 'bg-secondary text-white shadow-card hover:bg-secondary-dark active:bg-secondary-dark',
    danger: 'bg-action-sell text-white shadow-card hover:bg-action-sell-hover active:bg-action-sell-hover',
    ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200',
    outline: 'bg-surface border border-border text-neutral-700 hover:bg-surface-muted active:bg-neutral-100',
};
const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'min-h-touch px-3 py-2 text-xs gap-1.5',
    md: 'min-h-touch px-4 py-2.5 text-sm gap-2',
    lg: 'min-h-touch-lg px-6 py-3 text-base gap-2',
};
const BASE = 'inline-flex items-center justify-center rounded-md font-semibold ' +
    'transition-colors cursor-pointer select-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg ' +
    'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';
const hasCustomVisualClasses = (className?: string) => {
    if (!className)
        return false;
    return /(?:^|\s)(?:bg-|hover:bg-|active:bg-|disabled:bg-|border-|text-)/.test(className);
};
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size = 'md', loading = false, asChild = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const variantClass = variant
        ? VARIANT_CLASSES[variant]
        : hasCustomVisualClasses(className)
            ? ''
            : VARIANT_CLASSES.primary;
    const classes = [
        BASE,
        variantClass,
        SIZE_CLASSES[size],
        className
    ]
        .filter(Boolean)
        .join(' ');
    return (<Comp ref={ref} className={classes} disabled={disabled || loading} {...props}>
        {loading && (<svg className="animate-spin shrink-0 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>)}
        {children}
      </Comp>);
});
Button.displayName = 'Button';
export { Button };
