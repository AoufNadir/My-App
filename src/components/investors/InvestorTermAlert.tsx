import { Fragment, type ReactNode } from 'react';
import { AlertCard } from '../cards';
import { Button } from '../ui/Button';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { CalendarIcon } from '../icons/CalendarIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDayLabel } from '../../utils/dateInput';
import { investorTermDaysKey, investorTermWhenKey, type InvestorTerm, type InvestorTermTiming } from '../../utils/investorTerms';

/** Replaces `{name}` placeholders of a translated sentence with rendered values. */
function fillTemplate(template: string, values: Record<string, ReactNode>) {
    return template.split(/(\{[a-zA-Z]+\})/g).map((part, index) => {
        const key = part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : '';
        return <Fragment key={index}>{key in values ? values[key] : part}</Fragment>;
    });
}
const Figure = ({ children }: { children: ReactNode }) => <bdi dir="ltr" className="tabular-nums">{children}</bdi>;

function TermWhen({ term }: { term: InvestorTermTiming }) {
    const { t } = useLanguage();
    const count = Math.abs(term.daysLeft);
    return (<>{fillTemplate(t(investorTermWhenKey(term)) as string, {
        date: <Figure>{formatDayLabel(new Date(term.termTs))}</Figure>,
        days: fillTemplate(t(investorTermDaysKey(count)) as string, { count: <Figure>{count}</Figure> }),
    })}</>);
}

type InvestorTermAlertProps = {
    term: InvestorTerm;
    /** On the home page the card names the investor; on the investor's own page it does not. */
    showName?: boolean;
    onReinvest: () => void;
    onWithdraw: () => void;
    /** « Remind me in 3 days »: offered with the home reminders only. */
    onSnooze?: () => void;
};
/**
 * The quarterly term of one investor: when it falls, the profit available as the investor list
 * shows it, and the two existing windows (reinvest, withdraw the profit). Opens seven days before
 * and turns to a warning on the day.
 */
export function InvestorTermAlert({ term, showName = true, onReinvest, onWithdraw, onSnooze }: InvestorTermAlertProps) {
    const { t } = useLanguage();
    const owes = term.availableProfit < 0;
    return (<AlertCard tone={term.state === 'upcoming' ? 'info' : 'warning'} icon={<CalendarIcon className="h-5 w-5"/>} title={showName
            ? fillTemplate(t('investorTerms.titleWithName') as string, { name: <bdi>{term.investorName}</bdi> })
            : t('investorTerms.title') as string} detail={<>
        <span className="block"><TermWhen term={term}/></span>
        <span className="block">
          {owes ? t('investors.balanceToRegularize') : t('investors.availableProfit')}{' '}
          <CurrencyAmount value={Math.abs(term.availableProfit)} currency="DZD" semantic={owes ? 'loss' : 'plain'} size="sm" decimals={0} className="font-bold"/>
        </span>
      </>} footer={<>
        <Button type="button" size="sm" onClick={onReinvest} disabled={!term.canReinvest} className="font-bold">{t('investorTerms.reinvest')}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onWithdraw}>{t('investorTerms.withdraw')}</Button>
        {onSnooze && (<Button type="button" size="sm" variant="ghost" onClick={onSnooze}>{t('investorTerms.snooze')}</Button>)}
      </>}/>);
}

/** Small pill next to the investor's name in the list. */
export function InvestorTermBadge({ term }: { term: InvestorTerm }) {
    const { t } = useLanguage();
    const tone = term.state === 'upcoming' ? 'bg-financial-asset-bg text-financial-asset' : 'bg-financial-debt-bg text-financial-debt';
    const label = term.state === 'upcoming'
        ? fillTemplate(t('investorTerms.badgeIn') as string, { days: fillTemplate(t(investorTermDaysKey(term.daysLeft)) as string, { count: <Figure>{term.daysLeft}</Figure> }) })
        : t(term.state === 'due' ? 'investorTerms.badgeToday' : 'investorTerms.badgeOverdue') as string;
    return (<span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${tone}`}>
      <CalendarIcon aria-hidden="true" className="h-3 w-3"/>
      {label}
    </span>);
}
