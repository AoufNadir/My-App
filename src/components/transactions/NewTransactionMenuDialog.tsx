import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';

type NewTransactionMenuDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  cardBase: string;
  isDark: boolean;
  t: (key: string) => string;
  openForm: (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur') => void;
  openWalletTransferModal: () => void;
  openTransferModal: () => void;
  openAdjustmentModal: (type: 'add' | 'subtract') => void;
};

export function NewTransactionMenuDialog({
  isOpen,
  onClose,
  cardBase,
  isDark,
  t,
  openForm,
  openWalletTransferModal,
  openTransferModal,
  openAdjustmentModal
}: NewTransactionMenuDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} className={`${cardBase} max-w-sm`}>
      <DialogHeader onClose={onClose} isDark={isDark}>
        <DialogTitle>{t('transactions.newTransaction')}</DialogTitle>
      </DialogHeader>
      <DialogContent className="grid grid-cols-1 gap-3 p-6 pt-0">
        <div className="grid grid-cols-2 gap-3 mb-2">
          <Button onClick={() => { onClose(); openForm('buy_usdt'); }} className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-sm flex flex-col items-center gap-1 h-24 justify-center">
            <ArrowDownLeftIcon className="w-6 h-6" />
            <span>{t('transactions.buyUsdt')}</span>
          </Button>
          <Button onClick={() => { onClose(); openForm('sell_usdt'); }} className="bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-sm flex flex-col items-center gap-1 h-24 justify-center">
            <ArrowUpRightIcon className="w-6 h-6" />
            <span>{t('transactions.sellUsdt')}</span>
          </Button>
        </div>
        <Button onClick={() => { onClose(); openForm('buy_eur'); }} className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-sm mb-4">
          {t('transactions.buyEur')}
        </Button>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 pb-2">
          <p className="text-center text-xs font-bold uppercase tracking-wider opacity-50 mb-3">{t('transactions.financialActions')}</p>

          <div className="grid grid-cols-1 gap-3">
            <Button
              onClick={() => { onClose(); openWalletTransferModal(); }}
              className={`w-full py-3 rounded-xl font-bold shadow-sm flex items-center justify-between px-4 transition-all ${isDark ? 'bg-indigo-900/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}><RefreshCwIcon className="w-5 h-5" /></div>
                <div className="text-left">
                  <div className="text-sm font-bold">{t('transactions.internalTransfer')}</div>
                  <div className="text-[10px] opacity-70">{t('transactions.caisseAndBaridi')}</div>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 opacity-50" />
            </Button>

            <Button
              onClick={() => { onClose(); openTransferModal(); }}
              className={`w-full py-3 rounded-xl font-bold shadow-sm flex items-center justify-between px-4 transition-all ${isDark ? 'bg-sky-900/30 text-sky-300 border border-sky-500/30 hover:bg-sky-900/50' : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-sky-500/20' : 'bg-sky-100'}`}><UsersIcon className="w-5 h-5" /></div>
                <div className="text-left">
                  <div className="text-sm font-bold">{t('transactions.clientTransfer')}</div>
                  <div className="text-[10px] opacity-70">{t('transactions.transferDebtCredit')}</div>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 opacity-50" />
            </Button>
          </div>

          <Button
            onClick={() => { onClose(); openAdjustmentModal('add'); }}
            className={`w-full py-3 rounded-xl font-bold shadow-sm flex items-center justify-between px-4 transition-all mt-3 ${isDark ? 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-600' : 'bg-white'}`}><BriefcaseIcon className="w-5 h-5" /></div>
              <div className="text-left">
                <div className="text-sm font-bold">{t('transactions.treasuryAdjustment')}</div>
                <div className="text-[10px] opacity-70">{t('transactions.manualEntryExit')}</div>
              </div>
            </div>
            <ChevronRightIcon className="w-4 h-4 opacity-50" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
