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
  label: string;
  currency: 'USDT' | 'EUR';
  direction: 'buy' | 'sell';
  onClick: () => void;
};

function PortfolioActionButton({ label, currency, direction, onClick }: PortfolioActionProps) {
  const isBuy = direction === 'buy';
  const Icon = isBuy ? ArrowDownLeftIcon : ArrowUpRightIcon;
  return (
    <Button
      onClick={onClick}
      className={[
        'flex min-h-[88px] w-full flex-col items-start justify-between gap-2 rounded-xl px-3 py-3 text-white shadow-sm transition-transform active:scale-[0.97]',
        isBuy ? 'bg-success hover:opacity-95' : 'bg-danger hover:opacity-95',
      ].join(' ')}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface/15 ring-1 ring-surface/20">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-start">
        <p className="text-xs font-semibold text-surface/80">{isBuy ? 'Acheter' : 'Vendre'}</p>
        <p className="text-sm font-bold leading-tight">{label}</p>
        <p className="text-[11px] font-medium text-surface/70 mt-0.5">{currency}</p>
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
    <Button
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-start transition-colors bg-neutral-50 hover:bg-neutral-100"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-neutral-900">{title}</p>
          <p className="text-sm text-neutral-500 truncate">{subtitle}</p>
        </div>
      </div>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-neutral-400" />
    </Button>
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
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="bg-surface max-w-md">
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
              label={t('transactions.buyUsdt')}
              currency="USDT"
              direction="buy"
              onClick={() => { onClose(); openForm('buy_usdt'); }}
            />
            <PortfolioActionButton
              label={t('transactions.sellUsdt')}
              currency="USDT"
              direction="sell"
              onClick={() => { onClose(); openForm('sell_usdt'); }}
            />
            <PortfolioActionButton
              label={t('transactions.buyEur')}
              currency="EUR"
              direction="buy"
              onClick={() => { onClose(); openForm('buy_eur'); }}
            />
            <PortfolioActionButton
              label={t('transactions.sellEur')}
              currency="EUR"
              direction="sell"
              onClick={() => { onClose(); openForm('sell_eur'); }}
            />
          </div>
        </section>

        <section>
          <SectionHeading icon={<LandmarkIcon className="w-4 h-4" />} className="mb-3">
            {t('transactions.financialActions')}
          </SectionHeading>

          <div className="space-y-2">
            <FinancialActionRow
              title={t('transactions.internalTransfer')}
              subtitle={t('transactions.caisseAndBaridi')}
              icon={<RefreshCwIcon className="h-5 w-5" />}
              onClick={() => { onClose(); openWalletTransferModal(); }}
            />
            <FinancialActionRow
              title={t('transactions.clientTransfer')}
              subtitle={t('transactions.transferDebtCredit')}
              icon={<UsersIcon className="h-5 w-5" />}
              onClick={() => { onClose(); openTransferModal(); }}
            />
            <FinancialActionRow
              title={t('transactions.treasuryAdjustment')}
              subtitle={t('transactions.manualEntryExit')}
              icon={<WalletIcon className="h-5 w-5" />}
              onClick={() => { onClose(); openAdjustmentModal('add'); }}
            />
            <FinancialActionRow
              title={t('delivery.addExpense')}
              subtitle={t('delivery.subtitle')}
              icon={<ArrowUpRightIcon className="h-5 w-5" />}
              onClick={() => { onClose(); openDeliveryExpenseModal(); }}
            />
            {openPersonalWithdrawalModal && (
              <FinancialActionRow
                title="Mon prélèvement"
                subtitle="Dépense personnelle (ton profit seulement)"
                icon={<BanknotesIcon className="h-5 w-5" />}
                onClick={() => { onClose(); openPersonalWithdrawalModal(); }}
              />
            )}
          </div>
        </section>
      </ModalContent>
    </Modal>
  );
}
