import { Fragment, type ReactNode } from 'react';
import { AlertCard } from '../cards';
import { Button } from '../ui/Button';
import { WalletIcon } from '../icons/WalletIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { inventoryReminderKey, type InventoryReminder } from '../../utils/inventoryReminder';
import { investorTermDaysKey } from '../../utils/investorTerms';

/** Replaces `{name}` placeholders of a translated sentence with rendered values. */
function fillTemplate(template: string, values: Record<string, ReactNode>) {
    return template.split(/(\{[a-zA-Z]+\})/g).map((part, index) => {
        const key = part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : '';
        return <Fragment key={index}>{key in values ? values[key] : part}</Fragment>;
    });
}
const Figure = ({ children }: { children: ReactNode }) => <bdi dir="ltr" className="tabular-nums">{children}</bdi>;

type InventoryReminderAlertProps = {
    reminder: InventoryReminder;
    onOpen: () => void;
    /** « Remind me tomorrow »: hides the card for the rest of today. */
    onSnooze: () => void;
};

/**
 * The daily reminder to count the cash on the home page. Only about when the last count was saved:
 * it shows no balance. The button opens the inventory on the treasury page.
 */
export function InventoryReminderAlert({ reminder, onOpen, onSnooze }: InventoryReminderAlertProps) {
    const { t } = useLanguage();
    const key = inventoryReminderKey(reminder);
    const days = reminder.daysSince;
    const detail = key === 'inventoryReminder.days' && days !== null
        ? fillTemplate(t(key) as string, { days: fillTemplate(t(investorTermDaysKey(days)) as string, { count: <Figure>{days}</Figure> }) })
        : t(key) as string;
    return (<AlertCard tone={days !== null && days >= 3 ? 'warning' : 'info'} icon={<WalletIcon className="h-5 w-5"/>} title={t('inventoryReminder.title') as string} detail={detail} footer={<>
        <Button type="button" size="sm" onClick={onOpen} className="font-bold">{t('inventoryReminder.open')}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onSnooze}>{t('inventoryReminder.snooze')}</Button>
      </>}/>);
}
