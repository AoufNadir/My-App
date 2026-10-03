import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { OverdueDebtClient } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getNameInitials } from '../../utils/nameUtils';
type OverdueDebtsModalProps = {
    isOpen: boolean;
    onClose: () => void;
    overdueDebtors: OverdueDebtClient[];
    onOpenClient: (clientId: string) => void;
};
export function OverdueDebtsModal({ isOpen, onClose, overdueDebtors, onOpenClient }: OverdueDebtsModalProps) {
    const { t } = useLanguage();
    const totalOverdue = overdueDebtors.reduce((sum, debtor) => sum + debtor.overdueAmount, 0);
    const openClientFromModal = (clientId: string) => {
        onClose();
        onOpenClient(clientId);
    };
    return (<Modal isOpen={isOpen} onClose={onClose} className="bg-surface max-w-2xl">
      <ModalHeader onClose={onClose}>
        <ModalTitle>{t('clients.overdueDebtsTitle')}</ModalTitle>
      </ModalHeader>
      <ModalContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-card bg-financial-loss-bg px-4 py-3">
          <span className="text-sm font-semibold text-neutral-700">{t('treasury.total')}</span>
          <CurrencyAmount value={-totalOverdue} currency="DZD" semantic="loss" decimals={2} size="lg" className="font-bold"/>
        </div>

        {overdueDebtors.length > 0 ? (<div className="max-h-[55vh] divide-y divide-border overflow-y-auto rounded-card border border-border">
            {overdueDebtors.map((debtor, index) => (<button key={debtor.clientId} type="button" onClick={() => openClientFromModal(debtor.clientId)} className="flex min-h-touch w-full items-center gap-3 px-3 py-3 text-start transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-financial-loss-bg text-sm font-bold text-financial-loss">
                  {getNameInitials(debtor.fullName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-neutral-900">
                    <span dir="ltr" className="text-neutral-500">#{index + 1}</span> {debtor.fullName}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-neutral-500">
                    {debtor.daysOverdue} {t('clients.daysLate')} - {t('clients.sinceWord')} {debtor.oldestUnpaidDate}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {debtor.lastPaymentTimestamp
                ? `${t('clients.lastPayment')} : ${new Date(debtor.lastPaymentTimestamp).toLocaleDateString('fr-FR')}`
                : t('emptyStates.debts.noRegulation')}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <CurrencyAmount value={-debtor.overdueAmount} currency="DZD" semantic="loss" decimals={2} size="lg"/>
                  <span className="block text-xs text-neutral-500">{t('finance.debt')}</span>
                </span>
              </button>))}
          </div>) : <EmptyState title={t('emptyStates.debts.overdue')} />}
      </ModalContent>
    </Modal>);
}
