import { Button } from '../ui/Button';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { describeServiceBalance, getServiceBalanceLabel } from '../../utils/serviceBalances';
import { getNameInitials } from '../../utils/nameUtils';
import { useLanguage } from '../../contexts/LanguageContext';
type ManualClientHeaderStatsProps = {
    clientName: string;
    clientPhone?: string;
    balance: number;
    onBack: () => void;
    onNewOperation?: () => void;
};
export function ManualClientHeaderStats({ clientName, clientPhone, balance, onBack, onNewOperation }: ManualClientHeaderStatsProps) {
    const { t } = useLanguage();
    const balanceView = describeServiceBalance(balance);
    const balanceColor = balanceView.kind === 'to_receive'
        ? 'text-financial-profit'
        : balanceView.kind === 'client_advance'
            ? 'text-financial-loss'
            : 'text-neutral-900';
    const statusPillClass = balanceView.kind === 'to_receive'
        ? 'bg-financial-profit-bg text-financial-profit'
        : balanceView.kind === 'client_advance'
            ? 'bg-financial-debt-bg text-financial-debt'
            : 'bg-surface-muted text-neutral-600';
    const balanceHint = balanceView.kind === 'to_receive'
        ? t('finance.receivablesHint')
        : balanceView.kind === 'client_advance'
            ? t('finance.advancesHint')
            : t('finance.settled');
    return (<>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onBack} aria-label={t('common.back')} className="-ms-2 flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-surface-muted hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ChevronLeftIcon aria-hidden="true" className="h-6 w-6 rtl:-scale-x-100"/>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold leading-tight text-neutral-900">{clientName}</h2>
          <p dir={clientPhone ? 'ltr' : undefined} className="truncate text-xs text-neutral-500 rtl:text-right">{clientPhone || t('services.clientDetails')}</p>
        </div>
      </div>

      <section aria-label={t('common.balance') as string} className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-base font-bold text-neutral-600">
            {getNameInitials(clientName || '?')}
          </span>
          <div className="min-w-0 flex-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${statusPillClass}`}>{getServiceBalanceLabel(balanceView.kind, t)}</span>
            <CurrencyAmount value={balanceView.amount} currency="DZD" semantic="plain" size="hero" decimals={2} className={`mt-0.5 block ${balanceColor}`}/>
            <p className="mt-0.5 text-xs text-neutral-500">{balanceHint}</p>
          </div>
        </div>
        {onNewOperation && (<Button onClick={onNewOperation} variant="primary" size="md" className="mt-4 w-full font-bold">
            <PlusIcon className="h-4 w-4"/>
            <span>{t('transactions.newOperation')}</span>
          </Button>)}
      </section>
    </>);
}
