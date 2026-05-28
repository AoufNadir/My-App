import React, { useEffect, useRef, useState } from 'react';
export interface DatePickerProps {
    value: string;
    onChange: (iso: string) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    min?: string;
    max?: string;
    id?: string;
    ariaLabel?: string;
}
function isoToDisplay(iso: string): string {
    if (!iso)
        return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m)
        return '';
    return `${m[3]}/${m[2]}/${m[1]}`;
}
function displayToIso(display: string): string | null {
    const trimmed = display.trim();
    if (!trimmed)
        return '';
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (!m)
        return null;
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    if (mm < 1 || mm > 12)
        return null;
    if (dd < 1 || dd > 31)
        return null;
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd)
        return null;
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
function maskInput(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    let out = dd;
    if (digits.length >= 3)
        out += '/' + mm;
    if (digits.length >= 5)
        out += '/' + yyyy;
    return out;
}
export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker({ value, onChange, className, placeholder, disabled, min, max, id, ariaLabel }, ref) {
    const [display, setDisplay] = useState<string>(() => isoToDisplay(value));
    const [isInvalid, setIsInvalid] = useState(false);
    const hiddenRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        setDisplay(isoToDisplay(value));
        setIsInvalid(false);
    }, [value]);
    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const masked = maskInput(e.target.value);
        setDisplay(masked);
        if (masked === '') {
            setIsInvalid(false);
            onChange('');
            return;
        }
        const iso = displayToIso(masked);
        if (iso !== null) {
            setIsInvalid(false);
            if (iso !== value)
                onChange(iso);
        }
        else {
            setIsInvalid(false);
        }
    };
    const handleBlur = () => {
        if (display === '') {
            setIsInvalid(false);
            onChange('');
            return;
        }
        const iso = displayToIso(display);
        if (iso === null) {
            setIsInvalid(true);
            setDisplay(isoToDisplay(value));
            setTimeout(() => setIsInvalid(false), 400);
        }
    };
    const openNativePicker = () => {
        const el = hiddenRef.current;
        if (!el || disabled)
            return;
        const anyEl = el as unknown as {
            showPicker?: () => void;
        };
        if (typeof anyEl.showPicker === 'function') {
            try {
                anyEl.showPicker();
                return;
            }
            catch { }
        }
        el.focus();
        el.click();
    };
    const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const iso = e.target.value;
        if (!iso) {
            onChange('');
            return;
        }
        onChange(iso);
    };
    const baseClass = 'bg-surface border-border text-neutral-900 placeholder:text-neutral-400';
    const invalidClass = isInvalid
        ? 'ring-2 ring-danger border-danger'
        : 'focus-visible:ring-2 focus-visible:ring-primary';
    return (<div className={`relative flex items-center ${className ?? ''}`}>
      <input ref={ref} id={id} type="text" inputMode="numeric" value={display} onChange={handleTextChange} onBlur={handleBlur} placeholder={placeholder ?? 'DD/MM/YYYY'} disabled={disabled} aria-label={ariaLabel} className={`flex min-h-touch w-full rounded-md border px-3 py-2 pe-12 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${baseClass} ${invalidClass}`}/>
      <button type="button" onClick={openNativePicker} disabled={disabled} aria-label="Open date picker" tabIndex={-1} className="absolute end-1 inline-flex h-touch w-touch items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
      <input ref={hiddenRef} type="date" value={value || ''} onChange={handleNativeChange} min={min} max={max} tabIndex={-1} aria-hidden="true" className="absolute end-1 h-1 w-1 opacity-0 pointer-events-none"/>
    </div>);
});
