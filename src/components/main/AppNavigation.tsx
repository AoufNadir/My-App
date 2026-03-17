import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { MainNavLink } from './MainNavLink';
import { MobileNavLink } from './MobileNavLink';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ArrowUpIcon } from '../icons/ArrowUpIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { UserIcon } from '../icons/UserIcon';
import { LandmarkIcon } from '../icons/LandmarkIcon';
import { XIcon } from '../icons/XIcon';

type NavLabels = {
  transactions: string;
  portfolio: string;
  analytics: string;
  clients: string;
  treasury: string;
  investors: string;
};

type NavSharedProps = {
  view: string;
  isDark: boolean;
  onSelect: (view: string) => void;
  labels: NavLabels;
};

type MobileMenuNavProps = NavSharedProps & {
  isOpen: boolean;
  onClose: () => void;
};

function AppDesktopNavComponent({ view, isDark, onSelect, labels }: NavSharedProps) {
  return (
    <div className="hidden sm:flex items-center gap-2 p-1 rounded-full border" style={{ borderColor: isDark ? '#334155' : '#CBD5E1' }}>
      <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="transactions" colorClass="bg-indigo-600">{labels.transactions}</MainNavLink>
      <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="statistiques" colorClass="bg-teal-600">{labels.portfolio}</MainNavLink>
      <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="analytics" colorClass="bg-amber-600">{labels.analytics}</MainNavLink>
      <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="dzd" colorClass="bg-sky-600">{labels.clients}</MainNavLink>
      <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="tresorerie" colorClass="bg-emerald-600">{labels.treasury}</MainNavLink>
      <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="investors" colorClass="bg-purple-600">{labels.investors}</MainNavLink>
    </div>
  );
}

function AppMobileMenuNavComponent({ view, isDark, onSelect, labels, isOpen, onClose }: MobileMenuNavProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed inset-0 z-50 p-4 ${isDark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur-xl sm:hidden`}
        >
          <div className="flex justify-end mb-8">
            <Button onClick={onClose} className={`p-2 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-gray-900'}`}>
              <XIcon className="w-6 h-6" />
            </Button>
          </div>
          <div className="space-y-2">
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} isDark={isDark} targetView="transactions" icon={<BriefcaseIcon className="w-6 h-6" />} colorClass="text-indigo-500">{labels.transactions}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} isDark={isDark} targetView="statistiques" icon={<WalletIcon className="w-6 h-6" />} colorClass="text-teal-500">{labels.portfolio}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} isDark={isDark} targetView="analytics" icon={<ArrowUpIcon className="w-6 h-6" />} colorClass="text-amber-500">{labels.analytics}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} isDark={isDark} targetView="dzd" icon={<UsersIcon className="w-6 h-6" />} colorClass="text-sky-500">{labels.clients}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} isDark={isDark} targetView="tresorerie" icon={<LandmarkIcon className="w-6 h-6" />} colorClass="text-emerald-500">{labels.treasury}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} isDark={isDark} targetView="investors" icon={<UserIcon className="w-6 h-6" />} colorClass="text-purple-500">{labels.investors}</MobileNavLink>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AppBottomNavComponent({ view, isDark, onSelect, labels }: NavSharedProps) {
  const mobileNavItemClassName = 'h-10 w-10 shrink-0 rounded-2xl p-0 touch-manipulation select-none [webkit-tap-highlight-color:transparent]';
  const mobileIconClassName = 'h-[17px] w-[17px]';

  return (
    <div className="pointer-events-none sm:hidden fixed left-1/2 bottom-4 z-[45] w-[calc(100vw-2rem)] max-w-[22rem] -translate-x-1/2 transform-gpu [will-change:transform]">
      <div className="pointer-events-auto isolate mx-auto flex w-full items-center justify-between rounded-[1.6rem] border px-3 py-1.5 shadow-[0_14px_30px_rgba(15,23,42,0.22)]" style={{ borderColor: isDark ? '#334155' : '#CBD5E1', background: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(241, 245, 249, 0.98)' }}>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="transactions" colorClass="bg-indigo-600" className={mobileNavItemClassName} fillWidth={false}><BriefcaseIcon className={mobileIconClassName} /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="statistiques" colorClass="bg-teal-600" className={mobileNavItemClassName} fillWidth={false}><WalletIcon className={mobileIconClassName} /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="analytics" colorClass="bg-amber-600" className={mobileNavItemClassName} fillWidth={false}><ArrowUpIcon className={mobileIconClassName} /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="dzd" colorClass="bg-sky-600" className={mobileNavItemClassName} fillWidth={false}><UsersIcon className={mobileIconClassName} /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="tresorerie" colorClass="bg-emerald-600" className={mobileNavItemClassName} fillWidth={false}><LandmarkIcon className={mobileIconClassName} /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="investors" colorClass="bg-purple-600" className={mobileNavItemClassName} fillWidth={false}><UserIcon className={mobileIconClassName} /></MainNavLink>
      </div>
    </div>
  );
}

const areNavSharedPropsEqual = (prev: NavSharedProps, next: NavSharedProps) => (
  prev.view === next.view
  && prev.isDark === next.isDark
  && prev.labels === next.labels
);

const areMobileMenuNavPropsEqual = (prev: MobileMenuNavProps, next: MobileMenuNavProps) => (
  areNavSharedPropsEqual(prev, next)
  && prev.isOpen === next.isOpen
);

export const AppDesktopNav = memo(AppDesktopNavComponent, areNavSharedPropsEqual);
export const AppMobileMenuNav = memo(AppMobileMenuNavComponent, areMobileMenuNavPropsEqual);
export const AppBottomNav = memo(AppBottomNavComponent, areNavSharedPropsEqual);
