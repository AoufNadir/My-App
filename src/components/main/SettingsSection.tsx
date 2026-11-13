import { useId, type ReactNode } from 'react';
import { FormCardBareContext } from '../ui/FormCard';

// V14-1: the settings window as a short list of rows, like a banking app: each row says what it holds and what is
// set; a tap opens it (one at a time), the rest stays folded.
export function SettingsSection({ title, summary, icon, open, onToggle, children }: {
    title: ReactNode;
    summary?: ReactNode;
    icon: ReactNode;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    const panelId = useId();
    return (<section className="overflow-hidden rounded-card border border-border bg-surface">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-neutral-900">{title}</span>
          {summary && <span className="block truncate text-xs text-neutral-500">{summary}</span>}
        </span>
        <span aria-hidden="true" className={`text-neutral-400 transition-transform ${open ? 'rotate-90' : ''} rtl:-scale-x-100`}>›</span>
      </button>
      {open && (<div id={panelId} className="border-t border-border px-4 py-3">
          <FormCardBareContext.Provider value={true}>{children}</FormCardBareContext.Provider>
        </div>)}
    </section>);
}
