import React from 'react';
export type PageHeaderProps = {
    title: string;
    subtitle?: string;
    /** رجوع — إذا لم يُمرَّر لا يظهر زر الرجوع */
    onBack?: () => void;
    /** عناصر الجهة المقابلة (أزرار، أيقونات…) */
    actions?: React.ReactNode;
    className?: string;
};
const BackIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
    {/* السهم يعمل في كلا الاتجاهين عبر dir على الصفحة */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
  </svg>);
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, onBack, actions, className = '', }) => (<header className={[
        'sticky top-0 z-10 flex min-h-[56px] items-center gap-3',
        'bg-surface border-b border-border px-4',
        className
    ]
        .filter(Boolean)
        .join(' ')}>
    {/* زر الرجوع */}
    {onBack && (<button type="button" onClick={onBack} aria-label="رجوع" className={[
            'shrink-0 inline-flex h-touch w-touch items-center justify-center',
            'rounded-full text-neutral-500',
            'hover:bg-neutral-100 active:bg-neutral-200',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        ].join(' ')}>
        <BackIcon />
      </button>)}

    {/* العنوان والعنوان الفرعي */}
    <div className="flex min-w-0 flex-1 flex-col">
      <h1 className="truncate text-base font-semibold text-neutral-900 leading-tight">
        {title}
      </h1>
      {subtitle && (<p className="truncate text-xs text-neutral-500 leading-tight mt-0.5">
          {subtitle}
        </p>)}
    </div>

    {/* actions — جهة اليسار في RTL، اليمين في LTR */}
    {actions && (<div className="shrink-0 flex items-center gap-1">{actions}</div>)}
  </header>);
PageHeader.displayName = 'PageHeader';
export { PageHeader };
