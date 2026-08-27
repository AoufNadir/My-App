import React from 'react';
export interface TagChipsProps {
    tags?: string[] | null;
    size?: 'xs' | 'sm';
    className?: string;
    onTagClick?: (tag: string) => void;
}
const SIZE: Record<NonNullable<TagChipsProps['size']>, string> = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
};
export const TagChips: React.FC<TagChipsProps> = ({ tags, size = 'xs', className = '', onTagClick }) => {
    if (!tags || tags.length === 0)
        return null;
    const baseTone = 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200';
    return (<div className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {tags.map((tag) => (<button key={tag} type="button" onClick={onTagClick ? (e) => { e.stopPropagation(); onTagClick(tag); } : undefined} tabIndex={onTagClick ? 0 : -1} className={`rounded-full font-medium transition-colors ${SIZE[size]} ${baseTone} ${onTagClick ? 'cursor-pointer' : 'cursor-default'}`}>
          #{tag}
        </button>))}
    </div>);
};
