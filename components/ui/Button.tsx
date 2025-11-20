
import React from 'react';

// FIX: Add generic to React.isValidElement to correctly type children.props
// and make children optional in props to fix usage in Button component.
const Slot = ({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => {
  if (React.isValidElement<React.HTMLAttributes<HTMLElement>>(children)) {
    return React.cloneElement(children, {
      ...props,
      ...children.props,
      className: [props.className, children.props.className].filter(Boolean).join(' '),
    });
  }
  return null;
};


type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
