import React from 'react';
import { MagnifyingGlassIcon } from '../icons/MagnifyingGlassIcon';
import { XIcon } from '../icons/XIcon';
export type SearchFieldProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    /** Name of the button that empties the field */
    clearLabel: string;
    className?: string;
};
/** Search box of a list page: magnifier at the start, a clear button once something is typed. */
function SearchField({ value, onChange, placeholder, clearLabel, className = '' }: SearchFieldProps) {
    return (<div className={['relative min-w-0 flex-1', className].filter(Boolean).join(' ')}>
      <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400"/>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="flex min-h-touch w-full rounded-button border border-border bg-surface pe-10 ps-10 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 [&::-webkit-search-cancel-button]:hidden"/>
      {value && (<button type="button" onClick={() => onChange('')} aria-label={clearLabel} className="absolute end-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-surface-muted hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <XIcon aria-hidden="true" className="h-4 w-4"/>
        </button>)}
    </div>);
}
SearchField.displayName = 'SearchField';
export { SearchField };
