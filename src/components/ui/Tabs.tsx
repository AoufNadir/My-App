import React from 'react';
export type Tab = {
    id: string;
    label: string;
    icon?: React.ReactNode;
    /** عدد أو نص صغير يظهر بجانب التبويب — مثل عدد العمليات */
    badge?: number | string;
    disabled?: boolean;
};
export type TabsVariant = 'underline' | 'pills';
export type TabsProps = {
    tabs: Tab[];
    activeTab: string;
    onChange: (id: string) => void;
    variant?: TabsVariant;
    className?: string;
};
const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, variant = 'underline', className = '', }) => {
    if (variant === 'pills') {
        return (<div role="tablist" className={['grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap', className].filter(Boolean).join(' ')}>
        {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                return (<button key={tab.id} role="tab" type="button" aria-selected={isActive} disabled={tab.disabled} onClick={() => onChange(tab.id)} className={[
                        'inline-flex min-h-button-md w-full min-w-0 items-center justify-center gap-1.5 rounded-button px-3 py-2 text-center text-[12px] font-semibold leading-tight transition-colors sm:w-auto sm:px-4 sm:text-sm',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        'disabled:opacity-40 disabled:pointer-events-none',
                        isActive
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    ]
                        .filter(Boolean)
                        .join(' ')}>
              {tab.icon}
              <span className="max-w-full truncate">{tab.label}</span>
              {tab.badge !== undefined && (<span className={[
                            'inline-flex items-center justify-center rounded-full px-1.5 py-0.5',
                            'text-[10px] font-bold leading-none min-w-[18px]',
                            isActive ? 'bg-primary-dark text-white' : 'bg-neutral-300 text-neutral-700'
                        ].join(' ')}>
                  {tab.badge}
                </span>)}
            </button>);
            })}
      </div>);
    }
    // variant === 'underline' (الافتراضي)
    return (<div role="tablist" className={[
            'flex max-w-full overflow-x-auto border-b border-neutral-200 scrollbar-none',
            className
        ]
            .filter(Boolean)
            .join(' ')}>
      {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (<button key={tab.id} role="tab" type="button" aria-selected={isActive} disabled={tab.disabled} onClick={() => onChange(tab.id)} className={[
                    'inline-flex min-h-button-md shrink-0 items-center gap-1.5 px-4',
                    'whitespace-nowrap text-sm font-medium transition-colors',
                    'border-b-2 -mb-px',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                    'disabled:opacity-40 disabled:pointer-events-none',
                    isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                ]
                    .filter(Boolean)
                    .join(' ')}>
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (<span className={[
                        'inline-flex items-center justify-center rounded-full px-1.5 py-0.5',
                        'text-[10px] font-bold leading-none min-w-[18px]',
                        isActive ? 'bg-primary/10 text-primary' : 'bg-neutral-100 text-neutral-500'
                    ].join(' ')}>
                {tab.badge}
              </span>)}
          </button>);
        })}
    </div>);
};
Tabs.displayName = 'Tabs';
export { Tabs };
