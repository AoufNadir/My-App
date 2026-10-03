import type { ReactNode } from 'react';
import { SectionCard, type CardTone } from '../cards';
import { EmptyState } from '../ui/EmptyState';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { MinusIcon } from '../icons/MinusIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { InvestorTxRow } from '../investor-details/InvestorTxRow';
import { InvestorTransaction } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
type InvestorDashboardTransactionsTableProps = {
    orderedTransactions: InvestorTransaction[];
    isManager?: boolean;
};
function getInvestorDashboardTxMeta(tx: InvestorTransaction, t: (key: string) => any, isManager: boolean): { label: string; tone: CardTone; positive: boolean } {
    if (tx.type === 'profit_distribution')
        return { label: t('investors.txProfitDistribution'), tone: 'profit', positive: true };
    if (tx.type === 'deposit_capital')
        return { label: t('investorDialog.depositCapitalTitle'), tone: 'asset', positive: true };
    if (tx.type === 'withdraw_profit')
        return { label: isManager ? t('investors.txPersonalExpense') : t('investorDialog.withdrawProfitTitle'), tone: 'debt', positive: false };
    if (tx.type === 'reinvest_profit')
        return { label: isManager ? t('investors.profitsReinvestedInCapital') : t('investors.txReinvestProfit'), tone: 'dzd', positive: true };
    if (isManager && tx.type === 'withdraw_capital' && tx.origin === 'personal_expense')
        return { label: t('investors.txPersonalExpenseCapital'), tone: 'debt', positive: false };
    return { label: t('investorDialog.withdrawCapitalTitle'), tone: 'neutral', positive: false };
}
const TONE_ICON: Record<string, ReactNode> = {
    profit: <PlusIcon className="h-4 w-4"/>,
    asset: <PlusIcon className="h-4 w-4"/>,
    debt: <WalletIcon className="h-4 w-4"/>,
    dzd: <RefreshCwIcon className="h-4 w-4"/>,
    neutral: <MinusIcon className="h-4 w-4"/>,
};
export function InvestorDashboardTransactionsTable({ orderedTransactions, isManager = false }: InvestorDashboardTransactionsTableProps) {
    const { t } = useLanguage();
    return (<SectionCard flush title={t('investors.history')}>
      {orderedTransactions.length === 0
            ? <EmptyState icon={<FileSpreadsheetIcon className="h-5 w-5"/>} title={t('investors.noTransactions') as string} subtitle={t('emptyStates.transactions.subtitle') as string}/>
            : (<div>
              {orderedTransactions.map((tx) => {
                    const meta = getInvestorDashboardTxMeta(tx, t, isManager);
                    const signedAmount = (meta.positive ? 1 : -1) * Math.abs(tx.amount);
                    return (<div key={tx.id} className="border-t border-border">
                      <InvestorTxRow icon={TONE_ICON[meta.tone]} tone={meta.tone} label={meta.label} date={tx.date} time={tx.time} amount={signedAmount}/>
                    </div>);
                })}
            </div>)}
    </SectionCard>);
}
