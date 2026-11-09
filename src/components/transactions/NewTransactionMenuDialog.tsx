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
  /** V13-2: EUR hidden in the settings */
  showEur?: boolean;
  /** V13-3: RMB tiles (hidden in the settings like EUR) */
  showRmb?: boolean;
  openRmb?: (kind: 'buy' | 'sell') => void;
  /** V13-5: what each currency holds, shown on its row */
  balances?: Partial<Record<'USDT' | 'EUR' | 'RMB', number>>;
};

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
  showEur = true,
  showRmb = true,
  openRmb,
  balances,
}: NewTransactionMenuDialogProps) {
  const runAfterClose = (action: () => void) => {
    onClose();
    window.setTimeout(action, 0);
  };

  const rows: Array<{ code: 'USDT' | 'EUR' | 'RMB'; symbol: string; buy: () => void; sell: () => void }> = [
    { code: 'USDT', symbol: '$', buy: () => openForm('buy_usdt'), sell: () => openForm('sell_usdt') },
    ...(showEur ? [{ code: 'EUR' as const, symbol: '€', buy: () => openForm('buy_eur'), sell: () => openForm('sell_eur') }] : []),
    ...(showRmb && openRmb ? [{ code: 'RMB' as const, symbol: '¥', buy: () => openRmb('buy'), sell: () => openRmb('sell') }] : []),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{t('transactions.newTransaction')}</ModalTitle>
      </ModalHeader>
      <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
        <SectionCard title={t('nav.portfolio')} flush>
          {/* V13-5: one row per currency (any number fits), its balance, and two small buttons. */}
          {rows.map((row) => (
            <div key={row.code} className="flex items-center gap-3 px-4 py-2.5">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-financial-asset-bg text-sm font-extrabold text-financial-asset">{row.symbol}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-neutral-900">{row.code}</p>
                {balances && <p className="text-xs tabular-nums text-neutral-500"><bdi dir="ltr">{(balances[row.code] ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {row.code}</bdi></p>}
              </div>
              <button type="button" onClick={() => runAfterClose(row.buy)} className="min-h-10 rounded-button bg-action-buy px-3.5 text-sm font-bold text-white hover:bg-action-buy-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t('transactions.buyVerb')}</button>
              <button type="button" onClick={() => runAfterClose(row.sell)} className="min-h-10 rounded-button bg-action-sell px-3.5 text-sm font-bold text-white hover:bg-action-sell-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t('transactions.sellVerb')}</button>
            </div>
          ))}
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
