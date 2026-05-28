import React, { useRef, useState, type KeyboardEvent } from 'react';
export interface TagInputProps {
    value: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    className?: string;
    maxTags?: number;
    /** Suggested existing tags shown below the input. */
    suggestions?: string[];
}
const RESERVED = new Set([',', ' ']);
function normalize(tag: string): string {
    return tag.trim().replace(/^#+/, '').toLowerCase().slice(0, 24);
}
export function TagInput({ value, onChange, placeholder = 'Ajouter un tag…', className = '', maxTags = 8, suggestions }: TagInputProps) {
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const addTag = (raw: string) => {
        const tag = normalize(raw);
        if (!tag)
            return;
        if (value.includes(tag)) {
            setDraft('');
            return;
        }
        if (value.length >= maxTags)
            return;
        onChange([...value, tag]);
        setDraft('');
    };
    const removeTag = (tag: string) => {
        onChange(value.filter(t => t !== tag));
    };
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(draft);
            return;
        }
        if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            removeTag(value[value.length - 1]);
        }
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        if (next.length > 0 && RESERVED.has(next.slice(-1))) {
            addTag(next.slice(0, -1));
            return;
        }
        setDraft(next);
    };
    const handleBlur = () => {
        if (draft.trim())
            addTag(draft);
    };
    const chipBase = 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200';
    const inputBase = 'bg-transparent text-neutral-900 placeholder:text-neutral-400';
    const wrapperBase = 'border-border bg-surface focus-within:border-primary';
    const availableSuggestions = (suggestions || []).filter(s => !value.includes(normalize(s)) && normalize(s));
    return (<div className={className}>
            <div onClick={() => inputRef.current?.focus()} className={`flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-md border transition-colors min-h-10 cursor-text ${wrapperBase}`}>
                {value.map(tag => (<span key={tag} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${chipBase}`}>
                        #{tag}
                        <button type="button" aria-label={`Retirer ${tag}`} onClick={(e) => { e.stopPropagation(); removeTag(tag); }} className="hover:text-danger">
                            ×
                        </button>
                    </span>))}
                <input ref={inputRef} type="text" inputMode="text" autoComplete="off" enterKeyHint="enter" value={draft} onChange={handleChange} onKeyDown={handleKeyDown} onBlur={handleBlur} placeholder={value.length === 0 ? placeholder : ''} className={`flex-1 min-w-[6rem] outline-none text-sm py-0.5 ${inputBase}`} maxLength={24} disabled={value.length >= maxTags}/>
            </div>
            {availableSuggestions.length > 0 && (<div className="mt-2 flex flex-wrap gap-1.5">
                    {availableSuggestions.slice(0, 8).map(s => {
                const tag = normalize(s);
                return (<button key={tag} type="button" onClick={() => addTag(tag)} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-neutral-600 transition-colors hover:bg-neutral-100">
                                + #{tag}
                            </button>);
            })}
                </div>)}
        </div>);
}
