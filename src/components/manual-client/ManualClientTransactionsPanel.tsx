import { SectionCard, CARD_TONE_CLASS, type CardTone } from '../cards';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { PlusIcon } from '../icons/PlusIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import type { ReactNode } from 'react';
import { ManualAssetTransaction } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
type ManualClientTransactionsPanelProps = {
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
function getTransactionIcon(tx: ManualAssetTransaction): { icon: ReactNode; tone: CardTone } {
    if (tx.type === 'service' || tx.type === 'invoice')
        return { icon: <BriefcaseIcon className="h-4 w-4"/>, tone: 'dzd' };
    if (tx.type === 'payment_received')
        return { icon: <ArrowDownLeftIcon className="h-4 w-4"/>, tone: 'profit' };
    return { icon: <PencilIcon className="h-4 w-4"/>, tone: 'neutral' };
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
        label: amount >= 0 ? t('ledger.adjustPlus') as string : t('ledger.adjustMinus') as string,
        amount: Math.abs(amount),
        semantic: amount >= 0 ? 'profit' : 'loss'
    };
}
export function ManualClientTransactionsPanel({ orderedTransactions, onOpenCreateModal, onOpenEditModal, onDeleteTransaction }: ManualClientTransactionsPanelProps) {
    const { t } = useLanguage();
    return (<SectionCard flush title={t('transactions.history')}>
      {orderedTransactions.length > 0 ? (<div>
          {orderedTransactions.map((tx) => {
            const amountView = getTransactionAmountView(tx, t);
            const iconView = getTransactionIcon(tx);
            return (<div key={tx.id} className="border-t border-border">
              <SwipeableListItem onEdit={tx.type === 'adjustment' ? undefined : () => onOpenEditModal(tx)} onDelete={() => onDeleteTransaction(tx.id)}>
                <div className="flex min-h-touch items-center gap-3 bg-surface px-4 py-3">
                  <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[iconView.tone]}`}>{iconView.icon}</span>
                  <div className="min-w-0 flex-1">
                    {/* Title and amount on the first line; date, notes and amount label use the full width below. */}
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words pt-0.5 text-sm font-semibold text-neutral-900">{getTransactionTitle(tx, t)}</p>
                      <span className="shrink-0">
                        <CurrencyAmount value={amountView.amount} currency="DZD" semantic={amountView.semantic} size="md" decimals={0} className="font-semibold"/>
                      </span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-500">
                      <span className="min-w-0 break-words"><span dir="ltr">{tx.date}</span> · <span dir="ltr">{tx.time}</span>{tx.notes ? <> · <bdi>{tx.notes}</bdi></> : null}</span>
                      <span>{amountView.label}</span>
                    </p>
                  </div>
                </div>
              </SwipeableListItem>
            </div>);
        })}
        </div>) : (<EmptyState icon={<FileSpreadsheetIcon className="h-5 w-5"/>} title={t('transactions.noTransactions') as string} subtitle={t('services.firstClientOperation') as string} action={<Button onClick={onOpenCreateModal} variant="primary" size="md" className="font-bold">
              <PlusIcon className="h-4 w-4"/>
              <span>{t('transactions.newOperation')}</span>
            </Button>}/>)}
    </SectionCard>);
}
