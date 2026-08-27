import React from 'react';
const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (<div ref={ref} role="alert" className={`relative w-full rounded-lg border border-border bg-surface p-4 text-neutral-900 shadow-card [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4 [&>svg]:text-current [&>svg+div]:translate-y-[-3px] [&>svg~*]:ps-7 ${className}`} {...props}/>));
Alert.displayName = 'Alert';
const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (<div ref={ref} className={`text-sm font-semibold [&_p]:leading-relaxed ${className}`} {...props}/>));
AlertDescription.displayName = 'AlertDescription';
export { Alert, AlertDescription };
