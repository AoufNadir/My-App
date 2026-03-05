import { Button } from '../ui/Button';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { PlusIcon } from '../icons/PlusIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { ManualAssetTransaction } from '../../types';
import { formatDzd } from '../../pages/shared/pageFormat';

type ManualClientTransactionsPanelProps = {
  isDark: boolean;
  subtleText: string;
  orderedTransactions: ManualAssetTransaction[];
  onOpenCreateModal: () => void;
  onOpenEditModal: (tx: ManualAssetTransaction) => void;
  onDeleteTransaction: (txId: string) => void;
};

function getTransactionTitle(tx: ManualAssetTransaction): string {
  if (tx.type === 'service') {
    return `Service: ${tx.serviceType || 'Autre'}`;
  }
  if (tx.type === 'payment_received') {
    return 'Reglement Recu';
  }
  if (tx.type === 'adjustment') {
    return 'Ajustement Solde';
  }
  return 'Operation';
}

export function ManualClientTransactionsPanel({
  isDark,
  subtleText,
  orderedTransactions,
  onOpenCreateModal,
  onOpenEditModal,
  onDeleteTransaction
}: ManualClientTransactionsPanelProps) {
  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
        <UnifiedTitle
          as="h3"
          isDark={isDark}
          variant="section"
          icon={<FileSpreadsheetIcon className="w-4 h-4" />}
        >
          Historique
        </UnifiedTitle>
        <Button onClick={onOpenCreateModal} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Operation
        </Button>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {orderedTransactions.length > 0 ? (
          orderedTransactions.map((tx) => (
            <div key={tx.id}>
              <SwipeableListItem
                onEdit={() => onOpenEditModal(tx)}
                onDelete={() => onDeleteTransaction(tx.id)}
              >
                <div className="p-4 flex items-center justify-between transition-colors" style={{ WebkitTapHighlightColor: 'transparent' }}>
                  <div>
                    <div className="font-bold text-sm">{getTransactionTitle(tx)}</div>
                    <div className={`text-xs ${subtleText}`}>
                      {tx.date} a {tx.time} - {tx.notes || 'Pas de notes'}
                    </div>
                  </div>
                  <div className={`font-bold ${tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {tx.amount > 0 ? '+' : ''}{formatDzd(tx.amount, { min: 2, max: 2 })}
                  </div>
                </div>
              </SwipeableListItem>
            </div>
          ))
        ) : (
          <div className="p-8 text-center opacity-50">Aucune operation.</div>
        )}
      </div>
    </div>
  );
}
