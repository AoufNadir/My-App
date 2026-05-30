import React from 'react';
export type IconButtonVariant = 'edit' | 'delete' | 'view' | 'close' | 'add' | 'primary' | 'danger' | 'ghost';
export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    label: string; // aria-label — obligatoire pour l'accessibilité
};
const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
    edit: 'text-primary   hover:bg-primary/10  active:bg-primary/20',
    delete: 'text-danger    hover:bg-danger-bg   active:bg-danger-bg',
    view: 'text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200',
    close: 'text-neutral-400 hover:bg-neutral-100 active:bg-neutral-200',
    add: 'text-primary   bg-primary/10 hover:bg-primary/20 active:bg-primary/30',
    primary: 'text-primary hover:bg-primary/10 active:bg-primary/20',
    danger: 'text-danger hover:bg-danger-bg active:bg-danger-bg',
    ghost: 'text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200',
};
const SIZE_CLASSES: Record<IconButtonSize, string> = {
    sm: 'h-button-sm w-button-sm [&>svg]:h-4 [&>svg]:w-4',
    md: 'h-icon-button w-icon-button [&>svg]:h-5 [&>svg]:w-5',
    lg: 'h-button-lg w-button-lg [&>svg]:h-6 [&>svg]:w-6',
};
const BASE = 'inline-flex shrink-0 items-center justify-center rounded-full ' +
    'transition-colors cursor-pointer ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg ' +
    'disabled:opacity-40 disabled:pointer-events-none';
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({ className, variant = 'ghost', size = 'md', label, ...props }, ref) => (<button ref={ref} type="button" aria-label={label} className={[BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className]
        .filter(Boolean)
        .join(' ')} {...props}/>));
IconButton.displayName = 'IconButton';
export { IconButton };
