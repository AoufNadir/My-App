import React from 'react';
import { CurrencyAmount, type CurrencyCode, type AmountSemantic } from '../financial/CurrencyAmount';
export type PreviewRow = {
    label: string;
    value: number;
    currency?: CurrencyCode | null;
    semantic?: AmountSemantic;
    /** Bold style for emphasis */
    emphasize?: boolean;
};
type Props = {
    title?: string;
    rows: PreviewRow[];
    /** When present, rendered as a highlighted bottom band (green for >=0, red for <0) */
    profitRow?: PreviewRow;
    /** Inline error/warning shown above the rows (e.g. "Solde insuffisant") */
    error?: string;
    className?: string;
};
export function TransactionPreviewCard({ title, rows, profitRow, error, className = '' }: Props) {
    const shellClass = `rounded-2xl border border-border bg-surface-muted p-3 space-y-2 ${className}`;
    return (<div className={shellClass}>
            {title && (<p className="text-xs font-bold uppercase text-neutral-500">{title}</p>)}
            {error && (<p className="rounded-lg bg-danger-bg px-2 py-1 text-xs font-medium text-danger">{error}</p>)}
            <div className="space-y-1.5">
                {rows.map((row, idx) => (<div key={idx} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-neutral-500">{row.label}</span>
                        <CurrencyAmount value={row.value} currency={row.currency ?? undefined} semantic={row.semantic ?? 'plain'} size={row.emphasize ? 'lg' : 'md'}/>
                    </div>))}
            </div>
            {profitRow && (<div className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${profitRow.value >= 0 ? 'bg-financial-profit-bg text-financial-profit' : 'bg-financial-loss-bg text-financial-loss'}`}>
                    <div className="flex items-center justify-between gap-3">
                        <span>{profitRow.label}</span>
                        <CurrencyAmount value={profitRow.value} currency={profitRow.currency ?? undefined} semantic={profitRow.semantic ?? 'auto'} size="lg" showSign/>
                    </div>
                </div>)}
        </div>);
}
