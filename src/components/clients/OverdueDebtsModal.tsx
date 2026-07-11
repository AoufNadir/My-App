import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { OverdueDebtClient } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
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
        <div className="mb-3 text-sm text-neutral-500">
          {t('treasury.total')}: <CurrencyAmount value={-totalOverdue} currency="DZD" semantic="loss" decimals={2} className="font-bold"/>
        </div>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pe-1">
          {overdueDebtors.length > 0 ? overdueDebtors.map((debtor, index) => (<button key={debtor.clientId} type="button" onClick={() => openClientFromModal(debtor.clientId)} className="w-full min-h-touch text-start p-3 rounded-xl border border-border bg-surface-muted hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate">
                    #{index + 1} {debtor.fullName}
                  </p>
                  <p className="text-sm mt-0.5 text-neutral-500">
                    {debtor.daysOverdue} {t('clients.daysLate')} - {t('clients.sinceWord')} {debtor.oldestUnpaidDate}
                  </p>
                  <p className="text-xs mt-0.5 text-neutral-500">
                    {debtor.lastPaymentTimestamp
                ? `${t('clients.lastPayment')} : ${new Date(debtor.lastPaymentTimestamp).toLocaleDateString('fr-FR')}`
                : t('emptyStates.debts.noRegulation')}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <CurrencyAmount value={-debtor.overdueAmount} currency="DZD" semantic="loss" decimals={2} size="lg"/>
                  <span className="text-xs text-neutral-500">{t('finance.debt')}</span>
                </div>
              </div>
            </button>)) : <EmptyState title={t('emptyStates.debts.overdue')} />}
        </div>
      </ModalContent>
    </Modal>);
}
