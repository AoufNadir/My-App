import { Card, CardContent, CardHeader } from '../ui/Card';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { InvestorTransaction } from '../../types';
import { formatDzd } from '../../pages/shared/pageFormat';

type InvestorDashboardTransactionsTableProps = {
  orderedTransactions: InvestorTransaction[];
  isDark: boolean;
};

function getInvestorDashboardTxMeta(type: InvestorTransaction['type']) {
  if (type === 'profit_distribution') return { label: 'Distribution Profit', badge: 'bg-emerald-500/10 text-emerald-500', positive: true };
  if (type === 'deposit_capital') return { label: 'Depot Capital', badge: 'bg-blue-500/10 text-blue-500', positive: true };
  if (type === 'withdraw_profit') return { label: 'Retrait Profit', badge: 'bg-amber-500/10 text-amber-500', positive: false };
  return { label: 'Retrait Capital', badge: 'bg-gray-500/10 text-gray-500', positive: false };
}

export function InvestorDashboardTransactionsTable({
  orderedTransactions,
  isDark
}: InvestorDashboardTransactionsTableProps) {
  return (
    <Card className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border shadow-sm`}>
      <CardHeader className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <UnifiedTitle
          as="h3"
          isDark={isDark}
          variant="section"
          icon={<FileSpreadsheetIcon className="w-4 h-4" />}
        >
          Historique des Transactions
        </UnifiedTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className={`${isDark ? 'bg-slate-900/50 text-gray-400' : 'bg-slate-50 text-gray-500'} font-medium`}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {orderedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center opacity-50">Aucune transaction trouvee.</td>
                </tr>
              ) : (
                orderedTransactions.map((tx) => {
                  const meta = getInvestorDashboardTxMeta(tx.type);
                  return (
                    <tr key={tx.id} className={`${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{tx.date}</div>
                        <div className="text-xs opacity-50">{tx.time}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${meta.positive ? 'text-emerald-500' : 'text-red-500'}`}>
                        {meta.positive ? '+' : '-'}{formatDzd(tx.amount, { min: 0, max: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
