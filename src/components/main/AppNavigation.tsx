import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { MainNavLink } from './MainNavLink';
import { MobileNavLink } from './MobileNavLink';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ArrowUpIcon } from '../icons/ArrowUpIcon';
import { UsersIcon } from '../icons/UsersIcon';
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

export function AppDesktopNav({ view, isDark, onSelect, labels }: NavSharedProps) {
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

export function AppMobileMenuNav({ view, isDark, onSelect, labels, isOpen, onClose }: MobileMenuNavProps) {
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
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} isDark={isDark} targetView="investors" icon={<UsersIcon className="w-6 h-6" />} colorClass="text-purple-500">{labels.investors}</MobileNavLink>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppBottomNav({ view, isDark, onSelect, labels }: NavSharedProps) {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 p-2 backdrop-blur-md bg-opacity-50">
      <div className="max-w-4xl mx-auto flex items-center justify-around gap-2 p-1 rounded-full border" style={{ borderColor: isDark ? '#334155' : '#CBD5E1', background: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(241, 245, 249, 0.8)' }}>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="transactions" colorClass="bg-indigo-600"><BriefcaseIcon className="w-5 h-5 mx-auto" /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="statistiques" colorClass="bg-teal-600"><WalletIcon className="w-5 h-5 mx-auto" /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="analytics" colorClass="bg-amber-600"><ArrowUpIcon className="w-5 h-5 mx-auto" /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="dzd" colorClass="bg-sky-600"><UsersIcon className="w-5 h-5 mx-auto" /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="tresorerie" colorClass="bg-emerald-600"><LandmarkIcon className="w-5 h-5 mx-auto" /></MainNavLink>
        <MainNavLink activeView={view} isDark={isDark} onSelect={onSelect} targetView="investors" colorClass="bg-purple-600"><UsersIcon className="w-5 h-5 mx-auto" /></MainNavLink>
      </div>
    </div>
  );
}
