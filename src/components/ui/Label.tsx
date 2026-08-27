import React from 'react';
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className = '', ...props }, ref) => (<label ref={ref} className={`block text-sm font-semibold text-neutral-700 leading-snug mb-1.5 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}/>));
Label.displayName = 'Label';
export { Label };
