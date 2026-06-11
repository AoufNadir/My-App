import { memo, type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input } from './Input';
import { SearchIcon } from '../icons/SearchIcon';
import { XIcon } from '../icons/XIcon';
export type SearchableSelectOption = {
    value: string;
    label: string;
};
type SearchableSelectProps = {
    value: string;
    onChange: (value: string) => void;
    options: SearchableSelectOption[];
    fieldClassName: string;
    searchInputClassName?: string;
    selectClassName?: string;
    searchPlaceholder?: string;
    emptyOptionLabel?: string;
    emptyValue?: string;
    noResultsLabel?: string;
    id?: string;
    disabled?: boolean;
    clearable?: boolean;
    clearLabel?: string;
    minSearchLength?: number;
};
const normalizeText = (value: string) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
function SearchableSelectComponent({ value, onChange, options, fieldClassName, searchInputClassName, selectClassName, searchPlaceholder = 'Rechercher...', emptyOptionLabel, emptyValue = '', noResultsLabel = 'Aucun résultat', id, disabled = false, clearable = false, clearLabel = 'Effacer', minSearchLength = 1 }: SearchableSelectProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const generatedId = useId();
    const inputId = id || `searchable-select-${generatedId}`;
    const listboxId = `${inputId}-listbox`;
    const selectedOption = useMemo(() => options.find((option) => option.value === value) || null, [options, value]);
    const [query, setQuery] = useState(selectedOption?.label || '');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const normalizedQuery = normalizeText(query);
    const isSearchReady = normalizedQuery.length >= minSearchLength;
    const filteredOptions = useMemo(() => {
        if (!isSearchReady)
            return [];
        return options.filter((option) => normalizeText(option.label).includes(normalizedQuery));
    }, [isSearchReady, normalizedQuery, options]);
    const shouldShowDropdown = !disabled && isOpen && isSearchReady;
    const inputClassName = searchInputClassName || fieldClassName;
    const clearButtonVisible = clearable && !disabled && (value !== emptyValue || query.length > 0);
    useEffect(() => {
        if (!isOpen) {
            setQuery(selectedOption?.label || '');
        }
    }, [selectedOption, isOpen]);
    useEffect(() => {
        if (!shouldShowDropdown || filteredOptions.length === 0) {
            setHighlightedIndex(0);
            return;
        }
        setHighlightedIndex((currentIndex) => Math.min(currentIndex, filteredOptions.length - 1));
    }, [filteredOptions.length, shouldShowDropdown]);
    useEffect(() => {
        if (!shouldShowDropdown)
            return;
        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setQuery(selectedOption?.label || '');
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [selectedOption, shouldShowDropdown]);
    useEffect(() => {
        if (!shouldShowDropdown)
            return;
        const highlightedElement = document.getElementById(`${listboxId}-option-${highlightedIndex}`);
        highlightedElement?.scrollIntoView({ block: 'nearest' });
    }, [highlightedIndex, listboxId, shouldShowDropdown]);
    const handleSelect = (nextValue: string) => {
        const nextOption = options.find((option) => option.value === nextValue) || null;
        onChange(nextValue);
        setQuery(nextOption?.label || '');
        setIsOpen(false);
        setHighlightedIndex(0);
        requestAnimationFrame(() => inputRef.current?.blur());
    };
    const handleClear = () => {
        onChange(emptyValue);
        setQuery('');
        setIsOpen(false);
        setHighlightedIndex(0);
        requestAnimationFrame(() => inputRef.current?.focus());
    };
    const handleInputChange = (nextValue: string) => {
        setQuery(nextValue);
        setHighlightedIndex(0);
        if (clearable && nextValue.trim() === '' && value !== emptyValue) {
            onChange(emptyValue);
        }
        setIsOpen(normalizeText(nextValue).length >= minSearchLength);
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
            setQuery(selectedOption?.label || '');
            inputRef.current?.blur();
            return;
        }
        if (!isSearchReady)
            return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((currentIndex) => filteredOptions.length === 0 ? 0 : Math.min(currentIndex + 1, filteredOptions.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((currentIndex) => filteredOptions.length === 0 ? 0 : Math.max(currentIndex - 1, 0));
            return;
        }
        if (event.key === 'Enter' && shouldShowDropdown && filteredOptions[highlightedIndex]) {
            event.preventDefault();
            handleSelect(filteredOptions[highlightedIndex].value);
        }
    };
    const dropdownClassName = 'border-border bg-surface text-neutral-900 shadow-card-hover';
    const optionBaseClassName = 'hover:bg-neutral-50';
    const optionActiveClassName = 'bg-primary/10 text-primary';
    const iconClassName = 'text-neutral-500';
    const helperClassName = 'text-neutral-500';
    return (<div className="w-full">
      <div className="relative" ref={wrapperRef}>
        <SearchIcon className={`pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClassName}`}/>
        <Input ref={inputRef} id={inputId} value={query} onChange={(event) => handleInputChange(event.target.value)} onKeyDown={handleKeyDown} onBlur={() => {
            requestAnimationFrame(() => {
                if (wrapperRef.current?.contains(document.activeElement))
                    return;
                setIsOpen(false);
                setQuery(selectedOption?.label || '');
            });
        }} onFocus={() => {
            if (selectedOption && query === selectedOption.label) {
                requestAnimationFrame(() => inputRef.current?.select());
            }
        }} placeholder={searchPlaceholder} className={`${inputClassName} ps-10 ${clearButtonVisible ? 'pe-11' : 'pe-4'}`} role="combobox" aria-expanded={shouldShowDropdown} aria-controls={listboxId} aria-autocomplete="list" aria-haspopup="listbox" aria-activedescendant={shouldShowDropdown && filteredOptions[highlightedIndex]
            ? `${listboxId}-option-${highlightedIndex}`
            : undefined} autoComplete="off" disabled={disabled}/>

        {clearButtonVisible && (<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={handleClear} className="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100" aria-label={clearLabel} title={clearLabel}>
            <XIcon className="h-4 w-4"/>
          </button>)}

        {shouldShowDropdown && (<div id={listboxId} role="listbox" className={`absolute start-0 end-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border py-1 ${dropdownClassName}`}>
            {filteredOptions.length > 0 ? (filteredOptions.map((option, index) => {
                const isActive = index === highlightedIndex;
                return (<button key={option.value} id={`${listboxId}-option-${index}`} type="button" role="option" aria-selected={option.value === value} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setHighlightedIndex(index)} onClick={() => handleSelect(option.value)} className={`w-full px-3 py-2 text-start text-sm transition-colors ${isActive ? optionActiveClassName : optionBaseClassName}`}>
                    {option.label}
                  </button>);
            })) : (<div className={`px-3 py-2 text-sm ${helperClassName}`}>{noResultsLabel}</div>)}
          </div>)}
      </div>
    </div>);
}
export const SearchableSelect = memo(SearchableSelectComponent);
