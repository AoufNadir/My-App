import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BellIcon } from '../icons/BellIcon';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { useLanguage } from '../../contexts/LanguageContext';
import { useHeaderActionSlots } from '../main/headerActionsSlot';
import { ActionCenter, type ActionItem } from './ActionCenter';
import { badgeTone, isUnread, markAllRead, notificationLevel, type NotificationLevel, readStoredReadMap, storeReadMap, unreadCount, type NotificationEntry, type ReadMap } from '../../utils/notificationCenter';

// The bell of the Home page (V11-4): a badge with the number of unread items, and a sheet with all of them.

export type NotificationItem = {
    entry: NotificationEntry;
    /** A short line (a state that needs a decision)… */
    row?: Omit<ActionItem, 'id'>;
    /** …or a card with its own buttons (an investor's term, the cash count, a recap). */
    card?: ReactNode;
};

export function NotificationBell({ count, tone, onClick }: { count: number; tone: 'none' | 'urgent' | 'info'; onClick: () => void }) {
    const { t } = useLanguage();
    const label = t('dashboard.notificationsPanel') as string;
    return (<button type="button" onClick={onClick} title={label} aria-label={count > 0 ? `${label} (${count})` : label} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95">
      <BellIcon className="h-[22px] w-[22px]"/>
      {tone !== 'none' && (<span aria-hidden="true" className={`absolute end-1 top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white ${tone === 'urgent' ? 'bg-financial-loss' : 'bg-primary'}`}>
          <bdi dir="ltr" className="tabular-nums">{count > 9 ? '9+' : count}</bdi>
        </span>)}
    </button>);
}

const LEVEL_WORDS: Record<NotificationLevel, { ar: string; fr: string }> = {
    now: { ar: 'مهم الآن', fr: 'Important maintenant' },
    follow: { ar: 'للمتابعة', fr: 'À suivre' },
    reminder: { ar: 'تذكيرات', fr: 'Rappels' },
};

/** V19: the items in three levels; the reminders are folded unless nothing else is there. */
export function NotificationPanel({ items, read, onMarkAllRead }: { items: ReadonlyArray<NotificationItem>; read: ReadMap; onMarkAllRead: () => void }) {
    const { t, lang } = useLanguage();
    const unread = unreadCount(items.map((item) => item.entry), read);
    if (items.length === 0)
        return <p className="px-4 py-8 text-center text-sm text-neutral-500">{t('dashboard.notificationsEmpty') as string}</p>;
    const byLevel = (level: NotificationLevel) => items.filter((item) => notificationLevel(item.entry) === level);
    const section = (level: NotificationLevel) => {
        const list = byLevel(level);
        if (list.length === 0)
            return null;
        const rows: ActionItem[] = list.filter((item) => item.row).map((item) => ({ ...item.row!, id: item.entry.id, read: !isUnread(item.entry, read) }));
        const cards = list.filter((item) => item.card);
        const unreadHere = unreadCount(list.map((item) => item.entry), read);
        const words = LEVEL_WORDS[level][lang === 'fr' ? 'fr' : 'ar'];
        const title = (<span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${level === 'now' ? 'text-financial-loss' : 'text-neutral-500'}`}>
          {level === 'now' && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-financial-loss"/>}
          {words}
          <bdi dir="ltr" className="tabular-nums font-semibold text-neutral-400">{list.length}{unreadHere > 0 && unreadHere !== list.length ? ` · ${unreadHere}` : ''}</bdi>
        </span>);
        const body = (<div className="flex flex-col gap-3">
          {rows.length > 0 && <ActionCenter title={words} items={rows} hideTitle/>}
          {cards.map((item) => (<div key={item.entry.id} className={isUnread(item.entry, read) ? '' : 'opacity-60'}>{item.card}</div>))}
        </div>);
        const onlyReminders = byLevel('now').length === 0 && byLevel('follow').length === 0;
        if (level === 'reminder' && !onlyReminders)
            return (<details data-testid="bell-level-reminder" className="group rounded-card border border-border bg-surface px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between py-1">{title}<span aria-hidden="true" className="text-neutral-400 transition-transform group-open:rotate-180">⌄</span></summary>
              <div className="pt-3">{body}</div>
            </details>);
        return (<section data-testid={`bell-level-${level}`} className="flex flex-col gap-2">{title}{body}</section>);
    };
    return (<div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto px-4 pb-4 pt-3">
      {unread > 0 && (<div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={onMarkAllRead}>{t('dashboard.notificationsMarkRead') as string}</Button>
        </div>)}
      {section('now')}
      {section('follow')}
      {section('reminder')}
    </div>);
}

/** The bell in the phone header and its sheet. In the phone and the desktop header; without a header slot (tests) the bell is not drawn. */
export function NotificationCenter({ items, initialOpen = false }: { items: ReadonlyArray<NotificationItem>; initialOpen?: boolean }) {
    const { t } = useLanguage();
    const slots = useHeaderActionSlots();
    const [open, setOpen] = useState(initialOpen);
    const [read, setRead] = useState<ReadMap>(readStoredReadMap);
    const entries = items.map((item) => item.entry);
    const markRead = () => {
        const next = markAllRead(entries);
        setRead(next);
        storeReadMap(next);
    };
    return (<>
      {slots.map((slot) => createPortal(<NotificationBell count={unreadCount(entries, read)} tone={badgeTone(entries, read)} onClick={() => setOpen(true)}/>, slot, slot.id))}
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title={t('dashboard.notificationsPanel') as string}>
        <NotificationPanel items={items} read={read} onMarkAllRead={markRead}/>
      </BottomSheet>
    </>);
}
