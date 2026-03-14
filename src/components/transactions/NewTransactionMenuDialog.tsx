import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { LandmarkIcon } from '../icons/LandmarkIcon';

type NewTransactionMenuDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  cardBase: string;
  isDark: boolean;
  t: (key: string) => string;
  openForm: (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur' | 'sell_eur') => void;
  openWalletTransferModal: () => void;
  openTransferModal: () => void;
  openAdjustmentModal: (type: 'add' | 'subtract') => void;
};

type ActionCardProps = {
  title: string;
  subtitle: string;
  badge: string;
  icon: ReactNode;
  onClick: () => void;
  isDark: boolean;
  accent: 'indigo' | 'sky' | 'slate';
};

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  meta: string;
  icon?: ReactNode;
  isDark: boolean;
};

const accentStyles: Record<ActionCardProps['accent'], {
  darkShell: string;
  lightShell: string;
  darkIcon: string;
  lightIcon: string;
  darkBadge: string;
  lightBadge: string;
  darkEdge: string;
  lightEdge: string;
}> = {
  indigo: {
    darkShell: 'border-white/10 bg-slate-950/50 hover:border-indigo-400/35 hover:bg-slate-950/75 text-slate-50',
    lightShell: 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50 text-slate-900',
    darkIcon: 'bg-indigo-500/12 text-indigo-200 ring-1 ring-indigo-400/20',
    lightIcon: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100',
    darkBadge: 'bg-indigo-500/10 text-indigo-200 ring-1 ring-indigo-400/15',
    lightBadge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100',
    darkEdge: 'from-indigo-400/75',
    lightEdge: 'from-indigo-500/70'
  },
  sky: {
    darkShell: 'border-white/10 bg-slate-950/50 hover:border-sky-400/35 hover:bg-slate-950/75 text-slate-50',
    lightShell: 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50 text-slate-900',
    darkIcon: 'bg-sky-500/12 text-sky-200 ring-1 ring-sky-400/20',
    lightIcon: 'bg-sky-50 text-sky-600 ring-1 ring-sky-100',
    darkBadge: 'bg-sky-500/10 text-sky-200 ring-1 ring-sky-400/15',
    lightBadge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
    darkEdge: 'from-sky-400/75',
    lightEdge: 'from-sky-500/70'
  },
  slate: {
    darkShell: 'border-white/10 bg-slate-950/50 hover:border-slate-400/30 hover:bg-slate-950/75 text-slate-50',
    lightShell: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-900',
    darkIcon: 'bg-white/8 text-slate-200 ring-1 ring-white/10',
    lightIcon: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    darkBadge: 'bg-white/8 text-slate-200 ring-1 ring-white/10',
    lightBadge: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    darkEdge: 'from-slate-300/45',
    lightEdge: 'from-slate-400/55'
  }
};

function SectionHeader({ eyebrow, title, subtitle, meta, icon, isDark }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4 sm:gap-3">
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] sm:text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{eyebrow}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:mt-2">
          <h3 className={`text-sm font-semibold sm:text-base ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] sm:px-2.5 sm:py-1 sm:text-[10px] ${isDark ? 'bg-white/5 text-slate-300 ring-1 ring-white/10' : 'bg-white text-slate-500 shadow-sm'}`}>
            {meta}
          </span>
        </div>
        <p className={`mt-1.5 text-[11px] leading-5 sm:mt-2 sm:text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
      </div>
      {icon ? (
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl ${isDark ? 'bg-white/5 text-slate-300 ring-1 ring-white/10' : 'bg-white text-slate-500 shadow-sm'}`}>
          {icon}
        </div>
      ) : null}
    </div>
  );
}

function FinancialActionCard({ title, subtitle, badge, icon, onClick, isDark, accent }: ActionCardProps) {
  const styles = accentStyles[accent];
  const shellClass = isDark ? styles.darkShell : styles.lightShell;
  const iconClass = isDark ? styles.darkIcon : styles.lightIcon;
  const badgeClass = isDark ? styles.darkBadge : styles.lightBadge;
  const edgeClass = isDark ? styles.darkEdge : styles.lightEdge;

  return (
    <Button
      onClick={onClick}
      className={`group relative w-full justify-start overflow-hidden rounded-xl border px-3 py-3 text-left shadow-[0_18px_38px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 sm:rounded-2xl sm:px-4 sm:py-4 ${shellClass}`}
    >
      <div className={`absolute inset-y-0 left-0 w-px bg-gradient-to-b ${edgeClass} to-transparent`} />
      <div className={`absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_38%)]' : 'bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.10),transparent_42%)]'}`} />
      <div className="relative z-10 flex w-full min-w-0 items-center gap-2.5 sm:gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl ${iconClass}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5 sm:gap-2">
            <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</span>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] sm:px-2 sm:text-[10px] ${badgeClass}`}>
              {badge}
            </span>
          </div>
          <p className={`text-[11px] leading-5 sm:text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors sm:h-9 sm:w-9 ${isDark ? 'bg-white/5 text-slate-300 group-hover:bg-white/10' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
          <ChevronRightIcon className="h-4 w-4" />
        </div>
      </div>
    </Button>
  );
}

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
      <DialogHeader onClose={onClose} isDark={isDark} className="p-5 sm:p-6">
        <DialogTitle className="text-base sm:text-lg">{t('transactions.newTransaction')}</DialogTitle>
      </DialogHeader>
      <DialogContent className="grid grid-cols-1 gap-4 p-5 pt-0 sm:gap-5 sm:p-6 sm:pt-0">
        <div className={`rounded-[26px] border p-3.5 sm:rounded-[28px] sm:p-4 ${isDark ? 'border-slate-800 bg-slate-900/55' : 'border-slate-200 bg-slate-50/90'}`}>
          <SectionHeader
            eyebrow="Portefeuille"
            title="Operations portefeuille"
            subtitle="Choisissez une operation portefeuille."
            meta="4 actions"
            isDark={isDark}
          />

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Button onClick={() => { onClose(); openForm('buy_usdt'); }} className="relative min-h-[92px] justify-start overflow-hidden rounded-[18px] border border-emerald-400/25 bg-gradient-to-br from-emerald-500 to-emerald-600 px-2.5 py-2 text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(16,185,129,0.28)] sm:min-h-[178px] sm:rounded-2xl sm:px-4 sm:py-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_40%)]" />
              <div className="relative flex h-full w-full flex-col items-start justify-between gap-2 sm:gap-6">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20 sm:h-11 sm:w-11 sm:rounded-2xl">
                  <ArrowDownLeftIcon className="h-3.5 w-3.5 sm:h-6 sm:w-6" />
                </div>
                <div className="text-left">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70 sm:text-xs sm:tracking-[0.2em]">Achat</span>
                  <span className="mt-0.5 block text-[11px] font-bold leading-4 sm:mt-1 sm:text-base sm:leading-5">{t('transactions.buyUsdt')}</span>
                </div>
              </div>
            </Button>
            <Button onClick={() => { onClose(); openForm('sell_usdt'); }} className="relative min-h-[92px] justify-start overflow-hidden rounded-[18px] border border-rose-400/25 bg-gradient-to-br from-rose-500 to-red-600 px-2.5 py-2 text-white shadow-[0_12px_28px_rgba(244,63,94,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(244,63,94,0.28)] sm:min-h-[178px] sm:rounded-2xl sm:px-4 sm:py-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_40%)]" />
              <div className="relative flex h-full w-full flex-col items-start justify-between gap-2 sm:gap-6">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20 sm:h-11 sm:w-11 sm:rounded-2xl">
                  <ArrowUpRightIcon className="h-3.5 w-3.5 sm:h-6 sm:w-6" />
                </div>
                <div className="text-left">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70 sm:text-xs sm:tracking-[0.2em]">Vente</span>
                  <span className="mt-0.5 block text-[11px] font-bold leading-4 sm:mt-1 sm:text-base sm:leading-5">{t('transactions.sellUsdt')}</span>
                </div>
              </div>
            </Button>
            <Button onClick={() => { onClose(); openForm('buy_eur'); }} className="relative min-h-[92px] justify-start overflow-hidden rounded-[18px] border border-sky-400/25 bg-gradient-to-br from-sky-500 to-blue-600 px-2.5 py-2 text-white shadow-[0_12px_28px_rgba(14,165,233,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(14,165,233,0.28)] sm:min-h-[178px] sm:rounded-2xl sm:px-4 sm:py-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_40%)]" />
              <div className="relative flex h-full w-full flex-col items-start justify-between gap-2 sm:gap-6">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20 sm:h-11 sm:w-11 sm:rounded-2xl">
                  <ArrowDownLeftIcon className="h-3.5 w-3.5 sm:h-6 sm:w-6" />
                </div>
                <div className="text-left">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70 sm:text-xs sm:tracking-[0.2em]">Achat</span>
                  <span className="mt-0.5 block text-[11px] font-bold leading-4 sm:mt-1 sm:text-base sm:leading-5">{t('transactions.buyEur')}</span>
                </div>
              </div>
            </Button>
            <Button onClick={() => { onClose(); openForm('sell_eur'); }} className="relative min-h-[92px] justify-start overflow-hidden rounded-[18px] border border-amber-300/25 bg-gradient-to-br from-amber-500 to-orange-600 px-2.5 py-2 text-white shadow-[0_12px_28px_rgba(245,158,11,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(245,158,11,0.26)] sm:min-h-[178px] sm:rounded-2xl sm:px-4 sm:py-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_40%)]" />
              <div className="relative flex h-full w-full flex-col items-start justify-between gap-2 sm:gap-6">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20 sm:h-11 sm:w-11 sm:rounded-2xl">
                  <ArrowUpRightIcon className="h-3.5 w-3.5 sm:h-6 sm:w-6" />
                </div>
                <div className="text-left">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70 sm:text-xs sm:tracking-[0.2em]">Vente</span>
                  <span className="mt-0.5 block text-[11px] font-bold leading-4 sm:mt-1 sm:text-base sm:leading-5">{t('transactions.sellEur')}</span>
                </div>
              </div>
            </Button>
          </div>
        </div>

        <div className={`relative overflow-hidden rounded-[26px] border p-4 sm:rounded-[28px] sm:p-5 ${isDark ? 'border-slate-800 bg-gradient-to-b from-slate-900/80 via-slate-900/65 to-slate-950/75' : 'border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100/70'}`}>
          <div className={`absolute -right-8 top-0 h-28 w-28 rounded-full blur-3xl ${isDark ? 'bg-sky-500/10' : 'bg-sky-200/60'}`} />
          <div className="relative">
            <SectionHeader
              eyebrow={t('transactions.financialActions')}
              title="Desk financier"
              subtitle="Outils de caisse, transferts et ajustements manuels."
              meta="3 outils"
              icon={<LandmarkIcon className="h-5 w-5" />}
              isDark={isDark}
            />

            <div className="grid grid-cols-1 gap-3">
              <FinancialActionCard
                title={t('transactions.internalTransfer')}
                subtitle={t('transactions.caisseAndBaridi')}
                badge="Interne"
                icon={<RefreshCwIcon className="h-5 w-5" />}
                onClick={() => { onClose(); openWalletTransferModal(); }}
                isDark={isDark}
                accent="indigo"
              />
              <FinancialActionCard
                title={t('transactions.clientTransfer')}
                subtitle={t('transactions.transferDebtCredit')}
                badge="Clients"
                icon={<UsersIcon className="h-5 w-5" />}
                onClick={() => { onClose(); openTransferModal(); }}
                isDark={isDark}
                accent="sky"
              />
              <FinancialActionCard
                title={t('transactions.treasuryAdjustment')}
                subtitle={t('transactions.manualEntryExit')}
                badge="Manuel"
                icon={<BriefcaseIcon className="h-5 w-5" />}
                onClick={() => { onClose(); openAdjustmentModal('add'); }}
                isDark={isDark}
                accent="slate"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
