import { useState } from 'react';
import { FINANCIAL_TERMS, type FinancialTermId } from '../../config/financialTerms';
import { useLanguage } from '../../contexts/LanguageContext';
import { InfoIcon } from '../icons/InfoIcon';

export function FinancialTermLabel({ term, className = '' }: { term: FinancialTermId; className?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const config = FINANCIAL_TERMS[term];
  const label = t(config.labelKey) as string;
  const description = t(config.descriptionKey) as string;

  return (
    <span className={`relative inline-flex min-w-0 items-center gap-1 ${className}`} onMouseLeave={() => setOpen(false)}>
      <span className="whitespace-normal leading-snug">{label}</span>
      <button
        type="button"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`${label}: ${description}`}
        aria-expanded={open}
        title={description}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span role="tooltip" className="absolute start-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface px-3 py-2 text-start text-xs font-medium leading-relaxed text-neutral-600 shadow-card-hover">
          {description}
        </span>
      )}
    </span>
  );
}
