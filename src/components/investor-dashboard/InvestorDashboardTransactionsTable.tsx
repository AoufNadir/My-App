import { Card, CardContent, CardHeader } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { MobileTable, type MobileTableColumn } from '../ui/MobileTable';
import { Badge } from '../ui/Badge';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { InvestorTransaction } from '../../types';
type InvestorDashboardTransactionsTableProps = {
    orderedTransactions: InvestorTransaction[];
};
function getInvestorDashboardTxMeta(type: InvestorTransaction['type']) {
    if (type === 'profit_distribution')
        return { label: 'Distribution Profit', badgeVariant: 'success' as const, positive: true };
    if (type === 'deposit_capital')
        return { label: 'Dépôt Capital', badgeVariant: 'primary' as const, positive: true };
    if (type === 'withdraw_profit')
        return { label: 'Retrait Profit', badgeVariant: 'warning' as const, positive: false };
    return { label: 'Retrait Capital', badgeVariant: 'neutral' as const, positive: false };
}
export function InvestorDashboardTransactionsTable({ orderedTransactions }: InvestorDashboardTransactionsTableProps) {
    const columns: MobileTableColumn<InvestorTransaction>[] = [
        {
            key: 'date',
            label: 'Date',
            render: (tx) => (<div>
              <div className="font-medium text-neutral-900">{tx.date}</div>
              <div className="text-xs text-neutral-500">{tx.time}</div>
            </div>),
        },
        {
            key: 'type',
            label: 'Type',
            render: (tx) => {
                const meta = getInvestorDashboardTxMeta(tx.type);
                return <Badge variant={meta.badgeVariant}>{meta.label}</Badge>;
            },
        },
        {
            key: 'amount',
            label: 'Montant',
            align: 'end',
            render: (tx) => {
                const meta = getInvestorDashboardTxMeta(tx.type);
                const signedAmount = (meta.positive ? 1 : -1) * Math.abs(tx.amount);
                return <CurrencyAmount value={signedAmount} currency="DZD" semantic="auto" size="lg" showSign decimals={0}/>;
            },
        },
    ];
    return (<Card className="border border-border bg-surface shadow-sm">
      <CardHeader className="flex items-center justify-between border-b border-border p-4">
        <SectionHeading icon={<FileSpreadsheetIcon className="w-4 h-4"/>}>
          Historique des Transactions
        </SectionHeading>
      </CardHeader>
      <CardContent className="p-0">
        <MobileTable columns={columns} data={orderedTransactions} keyExtractor={(tx) => tx.id} emptyTitle="Aucune transaction" emptySubtitle="L'historique des transactions s'affichera ici."/>
      </CardContent>
    </Card>);
}
