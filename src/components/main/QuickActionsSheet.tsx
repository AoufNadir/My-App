import type { ReactNode } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { QUICK_ACTIONS, type QuickActionId } from '../../config/quickActions';
import { useLanguage } from '../../contexts/LanguageContext';

type FormMode = 'buy_usdt' | 'sell_usdt' | 'buy_eur' | 'sell_eur';

type QuickActionsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  openForm: (mode: FormMode) => void;
  onOpenClientSettlement: () => void;
  openAdjustmentModal: (type: 'add' | 'subtract') => void;
  openPersonalWithdrawalModal?: () => void;
};

type ActionRowProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconClass: string;
  onClick: () => void;
};

function ActionRow({ title, subtitle, icon, iconClass, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-button-md w-full grid-cols-[44px_minmax(0,1fr)] items-center gap-3 px-5 py-3 text-start text-neutral-900 transition-colors hover:bg-neutral-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${iconClass}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-snug">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-neutral-500">{subtitle}</span>
      </span>
    </button>
  );
}

export function QuickActionsSheet({
  isOpen,
  onClose,
  openForm,
  onOpenClientSettlement,
  openAdjustmentModal,
  openPersonalWithdrawalModal,
}: QuickActionsSheetProps) {
  const { t } = useLanguage();
  const run = (action: () => void) => {
    onClose();
    window.setTimeout(action, 0);
  };

  const actionIcon = (id: QuickActionId) => {
    if (id.startsWith('sell_')) return <ArrowUpRightIcon className="h-5 w-5" />;
    if (id.startsWith('buy_')) return <ArrowDownLeftIcon className="h-5 w-5" />;
    if (id === 'client_settlement') return <UsersIcon className="h-5 w-5" />;
    if (id === 'treasury_adjustment') return <WalletIcon className="h-5 w-5" />;
    return <BanknotesIcon className="h-5 w-5" />;
  };
  const actionTone = (id: QuickActionId) => {
    if (id.startsWith('sell_')) return 'bg-action-sell/15 text-action-sell';
    if (id.startsWith('buy_')) return 'bg-action-buy/15 text-action-buy';
    if (id === 'client_settlement') return 'bg-secondary/10 text-secondary';
    if (id === 'treasury_adjustment') return 'bg-primary/10 text-primary';
    return 'bg-danger/10 text-danger';
  };
  const runAction = (id: QuickActionId) => {
    if (id === 'sell_usdt' || id === 'buy_usdt' || id === 'sell_eur' || id === 'buy_eur') {
      run(() => openForm(id));
      return;
    }
    if (id === 'client_settlement') {
      run(onOpenClientSettlement);
      return;
    }
    if (id === 'treasury_adjustment') {
      run(() => openAdjustmentModal('add'));
      return;
    }
    if (openPersonalWithdrawalModal) run(openPersonalWithdrawalModal);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('quickActions.title') as string}>
      <div className="py-1">
        {QUICK_ACTIONS.filter((action) => action.id !== 'expense' || Boolean(openPersonalWithdrawalModal)).map((action) => (
          <div key={action.id}>
            <ActionRow
              title={t(action.labelKey) as string}
              subtitle={t(action.descriptionKey) as string}
              icon={actionIcon(action.id)}
              iconClass={actionTone(action.id)}
              onClick={() => runAction(action.id)}
            />
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
