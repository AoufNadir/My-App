import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { SectionHeading } from '../ui/SectionHeading';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { LandmarkIcon } from '../icons/LandmarkIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';

type NewTransactionMenuDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
  openForm: (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur' | 'sell_eur') => void;
  openWalletTransferModal: () => void;
  openTransferModal: () => void;
  openAdjustmentModal: (type: 'add' | 'subtract') => void;
  openDeliveryExpenseModal: () => void;
  openPersonalWithdrawalModal?: () => void;
};

type PortfolioActionProps = {
  currency: 'USDT' | 'EUR';
  direction: 'buy' | 'sell';
  onClick: () => void;
};

function PortfolioActionButton({ currency, direction, onClick }: PortfolioActionProps) {
  const isBuy = direction === 'buy';
  const Icon = isBuy ? ArrowDownLeftIcon : ArrowUpRightIcon;
  return (
    <Button
      onClick={onClick}
      size="md"
      className={[
        'flex min-h-[96px] w-full flex-col items-start justify-between gap-3 rounded-card px-4 py-4 text-white shadow-sm transition-transform active:scale-[0.97]',
        isBuy ? 'bg-action-buy hover:bg-action-buy-hover' : 'bg-action-sell hover:bg-action-sell-hover',
      ].join(' ')}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-start leading-tight">
        <p className="text-sm font-semibold text-white">{isBuy ? 'Acheter' : 'Vendre'}</p>
        <p className="mt-1 text-lg font-bold tracking-normal">{currency}</p>
      </div>
    </Button>
  );
}

type FinancialActionRowProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  onClick: () => void;
};

function FinancialActionRow({ title, subtitle, icon, onClick }: FinancialActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid min-h-[76px] w-full grid-cols-[44px_minmax(0,1fr)_24px] items-center gap-3 rounded-button border border-border bg-surface-muted px-4 py-3 text-start text-neutral-900 transition-colors hover:bg-neutral-100 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-snug text-neutral-900">{title}</p>
        <p className="mt-0.5 truncate text-sm leading-snug text-neutral-500">{subtitle}</p>
      </div>
      <ChevronRightIcon className="h-5 w-5 justify-self-end text-neutral-400" />
    </button>
  );
}

export function NewTransactionMenuDialog({
  isOpen,
  onClose,
  t,
  openForm,
  openWalletTransferModal,
  openTransferModal,
  openAdjustmentModal,
  openDeliveryExpenseModal,
  openPersonalWithdrawalModal,
}: NewTransactionMenuDialogProps) {
  const runAfterClose = (action: () => void) => {
    onClose();
    window.setTimeout(action, 0);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface">
      <ModalHeader onClose={onClose} className="p-4">
        <ModalTitle className="text-lg">{t('transactions.newTransaction')}</ModalTitle>
      </ModalHeader>
      <ModalContent className="space-y-5 p-4 pt-0">
        <section>
          <SectionHeading icon={<BriefcaseIcon className="w-4 h-4" />} className="mb-3">
            Portefeuille
          </SectionHeading>

          <div className="grid grid-cols-2 gap-3">
            <PortfolioActionButton
              currency="USDT"
              direction="buy"
              onClick={() => runAfterClose(() => openForm('buy_usdt'))}
            />
            <PortfolioActionButton
              currency="USDT"
              direction="sell"
              onClick={() => runAfterClose(() => openForm('sell_usdt'))}
            />
            <PortfolioActionButton
              currency="EUR"
              direction="buy"
              onClick={() => runAfterClose(() => openForm('buy_eur'))}
            />
            <PortfolioActionButton
              currency="EUR"
              direction="sell"
              onClick={() => runAfterClose(() => openForm('sell_eur'))}
            />
          </div>
        </section>

        <section>
          <SectionHeading icon={<LandmarkIcon className="w-4 h-4" />} className="mb-3">
            {t('transactions.financialActions')}
          </SectionHeading>

          <div className="space-y-2">
            {openPersonalWithdrawalModal && (
              <FinancialActionRow
                title="Mon prélèvement"
                subtitle="Dépense personnelle"
                icon={<BanknotesIcon className="h-5 w-5" />}
                onClick={() => runAfterClose(openPersonalWithdrawalModal)}
              />
            )}
            <FinancialActionRow
              title="Virement interne"
              subtitle={t('transactions.caisseAndBaridi')}
              icon={<RefreshCwIcon className="h-5 w-5" />}
              onClick={() => runAfterClose(openWalletTransferModal)}
            />
            <FinancialActionRow
              title={t('transactions.clientTransfer')}
              subtitle={t('transactions.transferDebtCredit')}
              icon={<UsersIcon className="h-5 w-5" />}
              onClick={() => runAfterClose(openTransferModal)}
            />
            <FinancialActionRow
              title={t('transactions.treasuryAdjustment')}
              subtitle={t('transactions.manualEntryExit')}
              icon={<WalletIcon className="h-5 w-5" />}
              onClick={() => runAfterClose(() => openAdjustmentModal('add'))}
            />
            <FinancialActionRow
              title={t('delivery.addExpense')}
              subtitle={t('delivery.subtitle')}
              icon={<ArrowUpRightIcon className="h-5 w-5" />}
              onClick={() => runAfterClose(openDeliveryExpenseModal)}
            />
          </div>
        </section>
      </ModalContent>
    </Modal>
  );
}
