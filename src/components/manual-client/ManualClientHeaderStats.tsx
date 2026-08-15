import { PageHeader } from '../ui/PageHeader';
import { FinancialMetricCard } from '../ui/FinancialMetricCard';
import { UserIcon } from '../icons/UserIcon';
import { describeServiceBalance, getServiceBalanceLabel } from '../../utils/serviceBalances';
import { useLanguage } from '../../contexts/LanguageContext';
type ManualClientHeaderStatsProps = {
    clientName: string;
    clientPhone?: string;
    balance: number;
    onBack: () => void;
};
export function ManualClientHeaderStats({ clientName, clientPhone, balance, onBack }: ManualClientHeaderStatsProps) {
    const { t } = useLanguage();
    const balanceView = describeServiceBalance(balance);
    const balanceSemantic = balanceView.kind === 'to_receive'
        ? 'profit'
        : balanceView.kind === 'client_advance'
            ? 'loss'
            : 'plain';
    const balanceTone = balanceView.kind === 'to_receive'
        ? 'profit'
        : balanceView.kind === 'client_advance'
            ? 'debt'
            : 'neutral';
    const balanceHint = balanceView.kind === 'to_receive'
        ? t('finance.receivablesHint')
        : balanceView.kind === 'client_advance'
            ? t('finance.advancesHint')
            : t('finance.settled');
    return (<>
      <PageHeader title={clientName} subtitle={clientPhone || 'Détails du client'} onBack={onBack} className="-mx-4 sm:mx-0 sm:rounded-lg"/>

      <FinancialMetricCard label={getServiceBalanceLabel(balanceView.kind, t)} value={balanceView.amount} semantic={balanceSemantic} tone={balanceTone} icon={<UserIcon className="h-4 w-4"/>} hint={balanceHint}/>
    </>);
}
