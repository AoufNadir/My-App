import React from 'react';
export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'profit' | 'loss' | 'debt' | 'neutral';
export type BadgeSize = 'sm' | 'md';
export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
    variant?: BadgeVariant;
    size?: BadgeSize;
};
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
    default: 'bg-neutral-100   text-neutral-700  border-neutral-200',
    primary: 'bg-primary/10    text-primary      border-primary/20',
    secondary: 'bg-secondary/10  text-secondary    border-secondary/20',
    success: 'bg-success-bg    text-success      border-success/20',
    danger: 'bg-danger-bg     text-danger       border-danger/20',
    warning: 'bg-warning-bg    text-warning      border-warning/20',
    profit: 'bg-success-bg    text-financial-profit border-success/20',
    loss: 'bg-danger-bg     text-financial-loss   border-danger/20',
    debt: 'bg-warning-bg    text-financial-debt   border-warning/20',
    neutral: 'bg-neutral-100   text-neutral-500  border-neutral-200',
};
const SIZE_CLASSES: Record<BadgeSize, string> = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2   py-1   text-xs font-medium',
};
const BASE = 'inline-flex items-center gap-1 rounded-full border font-medium leading-none';
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = 'default', size = 'md', ...props }, ref) => (<span ref={ref} className={[BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className]
        .filter(Boolean)
        .join(' ')} {...props}/>));
Badge.displayName = 'Badge';
export { Badge };
