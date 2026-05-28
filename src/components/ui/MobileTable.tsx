import React from 'react';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { SkeletonList } from './SkeletonList';
export type MobileTableColumn<T = Record<string, unknown>> = {
    key: string;
    label: string;
    /** كيف تُعرض الخلية — افتراضياً: row[key] */
    render?: (row: T) => React.ReactNode;
    /** محاذاة النص في الجدول (desktop) */
    align?: 'start' | 'end' | 'center';
    /** إخفاء العمود في بطاقة الموبايل */
    hideOnMobile?: boolean;
    /** عرض ثابت في الجدول مثل "w-32" */
    width?: string;
};
export type MobileTableProps<T = Record<string, unknown>> = {
    columns: MobileTableColumn<T>[];
    data: T[];
    keyExtractor: (row: T, index: number) => string;
    loading?: boolean;
    error?: boolean;
    errorTitle?: string;
    errorMessage?: string;
    onRetry?: () => void;
    emptyTitle?: string;
    emptySubtitle?: string;
    onRowClick?: (row: T) => void;
    className?: string;
};
function MobileTableInner<T = Record<string, unknown>>({ columns, data, keyExtractor, loading = false, error = false, errorTitle, errorMessage, onRetry, emptyTitle = 'لا توجد بيانات', emptySubtitle, onRowClick, className = '', }: MobileTableProps<T>) {
    if (loading) {
        return <SkeletonList rows={4}/>;
    }
    if (error) {
        return <ErrorState title={errorTitle} message={errorMessage} onRetry={onRetry}/>;
    }
    if (data.length === 0) {
        return <EmptyState title={emptyTitle} subtitle={emptySubtitle}/>;
    }
    const getCell = (col: MobileTableColumn<T>, row: T): React.ReactNode => {
        if (col.render)
            return col.render(row);
        const val = (row as Record<string, unknown>)[col.key];
        return val !== undefined && val !== null ? String(val) : '—';
    };
    const alignClass: Record<string, string> = {
        start: 'text-start',
        end: 'text-end',
        center: 'text-center',
    };
    return (<div className={className}>
      {/* ── DESKTOP: جدول حقيقي — مخفي على الموبايل ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {columns.map((col) => (<th key={col.key} className={[
                'px-4 py-3 text-xs font-semibold uppercase text-neutral-500',
                alignClass[col.align ?? 'start'],
                col.width ?? ''
            ]
                .filter(Boolean)
                .join(' ')}>
                  {col.label}
                </th>))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((row, i) => (<tr key={keyExtractor(row, i)} onClick={() => onRowClick?.(row)} className={[
                'bg-surface transition-colors',
                onRowClick ? 'cursor-pointer hover:bg-neutral-50' : ''
            ]
                .filter(Boolean)
                .join(' ')}>
                {columns.map((col) => (<td key={col.key} className={[
                    'px-4 py-3 text-neutral-800',
                    alignClass[col.align ?? 'start']
                ].join(' ')}>
                    {getCell(col, row)}
                  </td>))}
              </tr>))}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE: بطاقات — مخفي على الديسكتوب ── */}
      <div className="flex flex-col gap-3 sm:hidden">
        {data.map((row, i) => {
            const visibleCols = columns.filter((c) => !c.hideOnMobile);
            const [primary, ...rest] = visibleCols;
            return (<div key={keyExtractor(row, i)} onClick={() => onRowClick?.(row)} className={[
                    'bg-surface rounded-lg border border-neutral-200 px-4 py-3',
                    onRowClick ? 'cursor-pointer active:bg-neutral-50' : ''
                ]
                    .filter(Boolean)
                    .join(' ')}>
              {/* الصف الأول — العمود الرئيسي */}
              {primary && (<div className="mb-2 text-sm font-semibold text-neutral-900">
                  {getCell(primary, row)}
                </div>)}

              {/* بقية الأعمدة — label + value */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {rest.map((col) => (<div key={col.key} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium uppercase text-neutral-400">
                      {col.label}
                    </span>
                    <span className={[
                        'text-xs text-neutral-700',
                        col.align === 'end' ? 'text-end' : ''
                    ]
                        .filter(Boolean)
                        .join(' ')}>
                      {getCell(col, row)}
                    </span>
                  </div>))}
              </div>
            </div>);
        })}
      </div>
    </div>);
}
const MobileTable = MobileTableInner;
export { MobileTable };
