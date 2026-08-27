import type { ElementType, ReactNode } from 'react';
type TitleVariant = 'page' | 'section' | 'compact';
type UnifiedTitleProps = {
    as?: ElementType;
    icon?: ReactNode;
    children: ReactNode;
    variant?: TitleVariant;
    className?: string;
};
const variantClassMap: Record<TitleVariant, string> = {
    page: 'text-lg sm:text-2xl',
    section: 'text-[15px] sm:text-base',
    compact: 'text-sm sm:text-[15px]'
};
export function UnifiedTitle({ as: Tag = 'h2', icon, children, variant = 'section', className = '' }: UnifiedTitleProps) {
    return (<Tag className={[
            'flex items-center gap-2 font-extrabold tracking-wide',
            variantClassMap[variant],
            'text-primary',
            className
        ].join(' ').trim()}>
      {icon ? <span className="inline-flex shrink-0">{icon}</span> : null}
      {children}
    </Tag>);
}
