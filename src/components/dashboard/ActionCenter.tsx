import type { ReactNode } from 'react';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { CARD_TONE_CLASS, type CardTone } from '../cards/tones';

// « À traiter » (V11-2): what needs the owner's attention, in one quiet card of short lines instead of a stack of alert boxes.
// It does not exist when there is nothing to do.

export type ActionItem = {
    id: string;
    tone: CardTone;
    icon: ReactNode;
    title: ReactNode;
    detail?: ReactNode;
    onOpen?: () => void;
};

export function ActionCenter({ title, items }: { title: string; items: ReadonlyArray<ActionItem> }) {
    if (items.length === 0)
        return null;
    return (<section aria-label={title} className="overflow-hidden rounded-card border border-border bg-surface">
      <h2 className="flex items-center justify-between gap-2 px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
        <span>{title}</span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 tabular-nums text-neutral-600">{items.length}</span>
      </h2>
      <ul>
        {items.map((item) => {
            const content = (<>
              <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[item.tone]}`}>{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-900">{item.title}</span>
                {item.detail && <span className="mt-0.5 block text-xs text-neutral-500">{item.detail}</span>}
              </span>
              {item.onOpen && <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>}
            </>);
            const rowClass = 'flex min-h-12 w-full items-center gap-3 border-t border-border px-4 py-2.5 text-start';
            return (<li key={item.id}>
              {item.onOpen
                    ? <button type="button" onClick={item.onOpen} className={`${rowClass} transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary`}>{content}</button>
                    : <div className={rowClass}>{content}</div>}
            </li>);
        })}
      </ul>
    </section>);
}
