import type { ReactNode } from 'react';
export type SectionHeadingProps = {
    icon?: ReactNode;
    children: ReactNode;
    className?: string;
};
/**
 * عنوان قسم داخلي موحّد — يحل محل UnifiedTitle في جميع الصفحات.
 * يُستخدم داخل CardHeader أو أي container.
 */
function SectionHeading({ icon, children, className = '' }: SectionHeadingProps) {
    return (<h2 className={[
            'flex items-center gap-2 text-sm font-semibold text-neutral-700',
            className
        ]
            .filter(Boolean)
            .join(' ')}>
      {icon && <span className="text-secondary shrink-0">{icon}</span>}
      {children}
    </h2>);
}
SectionHeading.displayName = 'SectionHeading';
export { SectionHeading };
