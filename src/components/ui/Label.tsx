import React from 'react';
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (<label ref={ref} className={`text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}/>));
Label.displayName = 'Label';
export { Label };
