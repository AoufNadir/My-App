import { Fragment } from 'react';
import { Button } from '../ui/Button';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { ListRow } from '../cards/ListRow';
import { SectionCard } from '../cards/SectionCard';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { UsersIcon } from '../icons/UsersIcon';
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
  openDigitalServiceModal?: () => void;
  openPersonalWithdrawalModal?: () => void;
  /** Multi-currency: the currencies traded (from the settings). USDT and EUR open their own window, the others openOtherCurrency. */
  currencies?: string[];
  openOtherCurrency?: (kind: 'buy' | 'sell', currency: string) => void;
  /** A business set up with wallets: every currency (USDT and EUR too) opens the wallets window */
  walletsModel?: boolean;
};

type PortfolioActionProps = {
  currency: string;
  direction: 'buy' | 'sell';
  verb: string;
  onClick: () => void;
};

function PortfolioActionButton({ currency, direction, verb, onClick }: PortfolioActionProps) {
  const isBuy = direction === 'buy';
  const Icon = isBuy ? ArrowDownLeftIcon : ArrowUpRightIcon;
  return (
    <Button
      onClick={onClick}
      size="md"
      className={[
        'flex min-h-[88px] w-full flex-col items-start justify-between gap-2.5 rounded-card px-4 py-3.5 text-white shadow-card transition-transform active:scale-[0.97]',
        isBuy ? 'bg-action-buy hover:bg-action-buy-hover' : 'bg-action-sell hover:bg-action-sell-hover',
      ].join(' ')}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-start leading-tight">
        <p className="text-sm font-semibold text-white">{verb}</p>
        <p className="mt-1 text-lg font-bold tracking-normal">{currency}</p>
      </div>
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
  openDigitalServiceModal,
  openPersonalWithdrawalModal,
  currencies = ['USDT', 'EUR'],
  openOtherCurrency,
  walletsModel = false,
}: NewTransactionMenuDialogProps) {
  const open = (direction: 'buy' | 'sell', currency: string) => {
    if (!walletsModel && (currency === 'USDT' || currency === 'EUR'))
      return () => openForm(`${direction}_${currency.toLowerCase()}` as 'buy_usdt');
    return () => openOtherCurrency?.(direction, currency);
  };
  const shown = currencies.filter((code) => ((code === 'USDT' || code === 'EUR') && !walletsModel) || openOtherCurrency);
  const runAfterClose = (action: () => void) => {
    onClose();
    window.setTimeout(action, 0);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{t('transactions.newTransaction')}</ModalTitle>
      </ModalHeader>
      <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
        <SectionCard title={t('nav.portfolio')}>
          {shown.length === 0 && <p className="text-sm text-neutral-600">{t('transactions.addWalletFirst')}</p>}
          <div className="grid grid-cols-2 gap-2.5">
            {shown.map((code) => (
              <Fragment key={code}>
                <PortfolioActionButton currency={code} direction="buy" verb={t('transactions.buyVerb')} onClick={() => runAfterClose(open('buy', code))} />
                <PortfolioActionButton currency={code} direction="sell" verb={t('transactions.sellVerb')} onClick={() => runAfterClose(open('sell', code))} />
              </Fragment>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={t('transactions.financialActions')} flush>
          {openPersonalWithdrawalModal && (
            <ListRow
              tone="primary"
              title={t('transactions.myWithdrawal')}
              subtitle={t('personalExpenses.personalExpense') as string}
              icon={<BanknotesIcon className="h-5 w-5" />}
              onClick={() => runAfterClose(openPersonalWithdrawalModal)}
            />
          )}
          <ListRow
            tone="primary"
            title={t('transactions.internalTransferShort')}
            subtitle={t('transactions.caisseAndBaridi')}
            icon={<RefreshCwIcon className="h-5 w-5" />}
            onClick={() => runAfterClose(openWalletTransferModal)}
          />
          <ListRow
            tone="primary"
            title={t('transactions.clientTransfer')}
            subtitle={t('transactions.transferDebtCredit')}
            icon={<UsersIcon className="h-5 w-5" />}
            onClick={() => runAfterClose(openTransferModal)}
          />
          <ListRow
            tone="primary"
            title={t('transactions.treasuryAdjustment')}
            subtitle={t('transactions.manualEntryExit')}
            icon={<WalletIcon className="h-5 w-5" />}
            onClick={() => runAfterClose(() => openAdjustmentModal('add'))}
          />
          {openDigitalServiceModal && (
            <ListRow
              tone="primary"
              title={t('digitalServices.menuTitle')}
              subtitle={t('digitalServices.menuSubtitle')}
              icon={<BriefcaseIcon className="h-5 w-5" />}
              onClick={() => runAfterClose(openDigitalServiceModal)}
            />
          )}
          <ListRow
            tone="primary"
            title={t('delivery.addExpense')}
            subtitle={t('delivery.subtitle')}
            icon={<ArrowUpRightIcon className="h-5 w-5" />}
            onClick={() => runAfterClose(openDeliveryExpenseModal)}
          />
        </SectionCard>
      </ModalContent>
    </Modal>
  );
}
