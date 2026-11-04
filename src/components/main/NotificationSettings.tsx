import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { NOTIFICATION_KINDS, readNotificationPrefs, writeNotificationPref, type NotificationKind } from '../../utils/notificationPrefs';
import { Button } from '../ui/Button';
import { FormCard } from '../ui/FormCard';

// The phone's notifications (V9-4): allow them, and choose which ones. Phone-only: nothing is written to the database.

const KIND_KEYS: Record<NotificationKind, string> = {
    overdue: 'settings.notifOverdue',
    profit: 'settings.notifProfit',
    terms: 'settings.notifTerms',
    inventory: 'settings.notifInventory',
};

export function NotificationSettings({ initialPermission }: { initialPermission?: NotificationPermission | 'unsupported' }) {
    const { t } = useLanguage();
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => initialPermission ?? (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
    const [prefs, setPrefs] = useState(() => readNotificationPrefs());
    const allow = async () => {
        try {
            setPermission(await Notification.requestPermission());
        }
        catch {
            setPermission('denied');
        }
    };
    const description = permission === 'unsupported' ? t('settings.notifUnsupported') : permission === 'denied' ? t('settings.notifDenied') : t('settings.notifDescription');
    return (<FormCard title={t('settings.notifTitle')} description={description}>
        {permission === 'default' && <Button type="button" variant="primary" size="md" className="w-full font-semibold" onClick={allow}>{t('settings.notifAllow')}</Button>}
        {permission === 'granted' && (<ul className="flex flex-col">
            {NOTIFICATION_KINDS.map((kind) => (<li key={kind} className="flex items-center justify-between gap-3 border-b border-dashed border-border py-2 last:border-b-0">
                <span className="min-w-0 text-sm leading-snug text-neutral-800">{t(KIND_KEYS[kind])}</span>
                <button type="button" role="switch" aria-checked={prefs[kind]} aria-label={t(KIND_KEYS[kind]) as string} onClick={() => setPrefs(writeNotificationPref(kind, !prefs[kind]))} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${prefs[kind] ? 'bg-primary' : 'bg-neutral-300'}`}>
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${prefs[kind] ? 'start-[22px]' : 'start-0.5'}`}/>
                </button>
              </li>))}
          </ul>)}
      </FormCard>);
}
