import { Button } from '../ui/Button';
import { SectionHeading } from '../ui/SectionHeading';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { PlusIcon } from '../icons/PlusIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { ManualAssetTransaction } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
type ManualClientTransactionsPanelProps = {
    subtleText: string;
    orderedTransactions: ManualAssetTransaction[];
    onOpenCreateModal: () => void;
    onOpenEditModal: (tx: ManualAssetTransaction) => void;
    onDeleteTransaction: (txId: string) => void;
};
function getTransactionTitle(tx: ManualAssetTransaction, t: (key: string) => any): string {
    if (tx.type === 'service') {
        return `${t('services.service')}: ${tx.serviceType || t('services.other')}`;
    }
    if (tx.type === 'payment_received') {
        return t('transactions.paymentReceived') as string;
    }
    if (tx.type === 'adjustment') {
        return t('services.balanceAdjustment') as string;
    }
    return t('services.operation') as string;
}
function getTransactionAmountView(tx: ManualAssetTransaction, t: (key: string) => any): {
    label: string;
    amount: number;
    semantic: 'profit' | 'loss' | 'plain';
} {
    if (tx.type === 'service' || tx.type === 'invoice') {
        return { label: t('finance.toReceive') as string, amount: Math.abs(Number(tx.amount || 0)), semantic: 'profit' };
    }
    if (tx.type === 'payment_received') {
        return { label: t('services.collected') as string, amount: Math.abs(Number(tx.amount || 0)), semantic: 'profit' };
    }
    const amount = Number(tx.amount || 0);
    return {
        label: amount >= 0 ? 'Ajustement +' : 'Ajustement -',
        amount: Math.abs(amount),
        semantic: amount >= 0 ? 'profit' : 'loss'
    };
}
export function ManualClientTransactionsPanel({ subtleText, orderedTransactions, onOpenCreateModal, onOpenEditModal, onDeleteTransaction }: ManualClientTransactionsPanelProps) {
    const { t } = useLanguage();
    return (<div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border p-3">
        <SectionHeading icon={<FileSpreadsheetIcon className="w-4 h-4"/>}>
          {t('transactions.history')}
        </SectionHeading>
        <Button onClick={onOpenCreateModal} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-dark">
          <PlusIcon className="w-4 h-4"/> {t('transactions.newOperation')}
        </Button>
      </div>

      <div className="divide-y divide-neutral-100">
        {orderedTransactions.length > 0 ? (orderedTransactions.map((tx) => {
            const amountView = getTransactionAmountView(tx, t);
            return (<div key={tx.id}>
              <SwipeableListItem onEdit={tx.type === 'adjustment' ? undefined : () => onOpenEditModal(tx)} onDelete={() => onDeleteTransaction(tx.id)}>
                <div className="flex min-h-touch items-center justify-between gap-3 bg-surface p-4 transition-colors hover:bg-neutral-50">
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{getTransactionTitle(tx, t)}</div>
                    <div className={`truncate text-xs ${subtleText} mt-0.5`}>
                      {tx.date} · {tx.time}{tx.notes ? ` · ${tx.notes}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <CurrencyAmount value={amountView.amount} currency="DZD" semantic={amountView.semantic} size="lg" decimals={0}/>
                    <div className={`text-xs ${subtleText}`}>
                      {amountView.label}
                    </div>
                  </div>
                </div>
              </SwipeableListItem>
            </div>);
        })) : (<EmptyState icon={<FileSpreadsheetIcon className="w-6 h-6"/>} title={t('transactions.noTransactions') as string} subtitle={t('services.firstClientOperation') as string} action={<Button onClick={onOpenCreateModal} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-dark">
                <PlusIcon className="w-4 h-4"/> {t('transactions.newOperation')}
              </Button>}/>)}
      </div>
    </div>);
}
