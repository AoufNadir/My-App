import React, { useEffect, useRef } from 'react';
export type FilterChip = {
    id: string;
    label: string;
    /** Number shown in the chip, already written out */
    count?: string;
    icon?: React.ReactNode;
    /** Count in red while the chip is off, for things to act on (late payers) */
    urgent?: boolean;
};
export type FilterChipsProps = {
    chips: ReadonlyArray<FilterChip>;
    /** Chips switched on; a list page usually has one */
    activeIds: ReadonlyArray<string>;
    onToggle: (id: string) => void;
    /** Name of the row for screen readers */
    label: string;
    className?: string;
};
/** One row of filters, one tap each. Scrolls sideways on a phone, wraps on a wide screen. */
function FilterChips({ chips, activeIds, onToggle, label, className = '' }: FilterChipsProps) {
    const rowRef = useRef<HTMLDivElement>(null);
    const activeKey = activeIds.join('|');
    // A filter picked elsewhere (a saved filter, the search) can sit past the edge of the row: bring it in.
    useEffect(() => {
        const row = rowRef.current;
        const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (!row || !chip || row.scrollWidth <= row.clientWidth)
            return;
        const rowBox = row.getBoundingClientRect();
        const chipBox = chip.getBoundingClientRect();
        if (chipBox.left < rowBox.left)
            row.scrollBy({ left: chipBox.left - rowBox.left - 16 });
        else if (chipBox.right > rowBox.right)
            row.scrollBy({ left: chipBox.right - rowBox.right + 16 });
    }, [activeKey]);
    return (<div ref={rowRef} role="group" aria-label={label} className={['-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden', className].filter(Boolean).join(' ')}>
      {chips.map((chip) => {
            const active = activeIds.includes(chip.id);
            return (<button key={chip.id} type="button" aria-pressed={active} onClick={() => onToggle(chip.id)} className={[
                    'relative inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors',
                    "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                    active
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-surface text-neutral-700 hover:border-border-strong hover:text-neutral-900'
                ].join(' ')}>
            {chip.icon && <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center">{chip.icon}</span>}
            <span>{chip.label}</span>
            {chip.count !== undefined && (<span dir="ltr" className={[
                        'min-w-5 rounded-full px-1.5 text-center text-xs font-bold tabular-nums leading-5',
                        active ? 'bg-white/20 text-white' : chip.urgent ? 'bg-financial-loss-bg text-financial-loss' : 'bg-surface-muted text-neutral-600'
                    ].join(' ')}>
                {chip.count}
              </span>)}
          </button>);
        })}
    </div>);
}
FilterChips.displayName = 'FilterChips';
export { FilterChips };
