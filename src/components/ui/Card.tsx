import React from 'react';
export type CardVariant = 'default' | 'hoverable' | 'flat';
export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
    variant?: CardVariant;
};
const VARIANT_CLASSES: Record<CardVariant, string> = {
    default: 'bg-surface border border-border shadow-card',
    hoverable: 'bg-surface border border-border shadow-card hover:shadow-card-hover hover:border-border-strong transition-all cursor-pointer active:scale-[0.99]',
    flat: 'bg-surface-muted border border-neutral-100',
};
// لا padding ثابت — المسافات يتحكم بها المستخدِم عبر className أو عبر children
const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant = 'default', ...props }, ref) => (<div ref={ref} className={[
        'rounded-card',
        VARIANT_CLASSES[variant],
        className
    ]
        .filter(Boolean)
        .join(' ')} {...props}/>));
Card.displayName = 'Card';
// مكونات داخلية اختيارية — بدون padding افتراضي، المسافة تأتي من className
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (<div ref={ref} className={['flex flex-col', className].filter(Boolean).join(' ')} {...props}/>));
CardHeader.displayName = 'CardHeader';
const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (<h3 ref={ref} className={['text-base font-semibold leading-snug text-neutral-900', className]
        .filter(Boolean)
        .join(' ')} {...props}/>));
CardTitle.displayName = 'CardTitle';
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (<div ref={ref} className={className} {...props}/>));
CardContent.displayName = 'CardContent';
export { Card, CardHeader, CardTitle, CardContent };
