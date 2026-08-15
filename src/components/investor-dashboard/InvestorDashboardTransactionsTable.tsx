import { Card, CardContent, CardHeader } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { MobileTable, type MobileTableColumn } from '../ui/MobileTable';
import { Badge } from '../ui/Badge';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { InvestorTransaction } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
type InvestorDashboardTransactionsTableProps = {
    orderedTransactions: InvestorTransaction[];
};
function getInvestorDashboardTxMeta(type: InvestorTransaction['type'], t: (key: string) => any) {
    if (type === 'profit_distribution')
        return { label: t('investors.txProfitDistribution'), badgeVariant: 'success' as const, positive: true };
    if (type === 'deposit_capital')
        return { label: t('investorDialog.depositCapitalTitle'), badgeVariant: 'primary' as const, positive: true };
    if (type === 'withdraw_profit')
        return { label: t('investorDialog.withdrawProfitTitle'), badgeVariant: 'warning' as const, positive: false };
    return { label: t('investorDialog.withdrawCapitalTitle'), badgeVariant: 'neutral' as const, positive: false };
}
export function InvestorDashboardTransactionsTable({ orderedTransactions }: InvestorDashboardTransactionsTableProps) {
    const { t } = useLanguage();
    const columns: MobileTableColumn<InvestorTransaction>[] = [
        {
            key: 'date',
            label: t('common.dateWord') as string,
            render: (tx) => (<div>
              <div className="font-medium text-neutral-900">{tx.date}</div>
              <div className="text-xs text-neutral-500">{tx.time}</div>
            </div>),
        },
        {
            key: 'type',
            label: t('transactions.type') as string,
            render: (tx) => {
                const meta = getInvestorDashboardTxMeta(tx.type, t);
                return <Badge variant={meta.badgeVariant}>{meta.label}</Badge>;
            },
        },
        {
            key: 'amount',
            label: t('transactions.amount') as string,
            align: 'end',
            render: (tx) => {
                const meta = getInvestorDashboardTxMeta(tx.type, t);
                const signedAmount = (meta.positive ? 1 : -1) * Math.abs(tx.amount);
                return <CurrencyAmount value={signedAmount} currency="DZD" semantic="auto" size="lg" showSign decimals={0}/>;
            },
        },
    ];
    return (<Card className="border border-border bg-surface shadow-sm">
      <CardHeader className="flex items-center justify-between border-b border-border p-4">
        <SectionHeading icon={<FileSpreadsheetIcon className="w-4 h-4"/>}>
          {t('investors.history')}
        </SectionHeading>
      </CardHeader>
      <CardContent className="p-0">
        <MobileTable columns={columns} data={orderedTransactions} keyExtractor={(tx) => tx.id} emptyTitle={t('investors.noTransactions') as string} emptySubtitle={t('emptyStates.transactions.subtitle') as string}/>
      </CardContent>
    </Card>);
}
