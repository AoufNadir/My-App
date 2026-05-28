import { PageHeader } from '../ui/PageHeader';
import { FinancialMetricCard } from '../ui/FinancialMetricCard';
import { UserIcon } from '../icons/UserIcon';
import { describeServiceBalance, getServiceBalanceLabel } from '../../utils/serviceBalances';
type ManualClientHeaderStatsProps = {
    clientName: string;
    clientPhone?: string;
    balance: number;
    onBack: () => void;
    subtleText: string;
};
export function ManualClientHeaderStats({ clientName, clientPhone, balance, onBack, subtleText }: ManualClientHeaderStatsProps) {
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
        ? "Le client vous doit ce montant"
        : balanceView.kind === 'client_advance'
            ? "Avance client / montant a rendre"
            : 'Compte solde';
    return (<>
      <PageHeader title={clientName} subtitle={clientPhone || 'Details du client'} onBack={onBack} className="-mx-4 sm:mx-0 sm:rounded-lg"/>

      <FinancialMetricCard label={getServiceBalanceLabel(balanceView.kind)} value={balanceView.amount} semantic={balanceSemantic} tone={balanceTone} icon={<UserIcon className="h-4 w-4"/>} hint={balanceHint}/>
    </>);
}
