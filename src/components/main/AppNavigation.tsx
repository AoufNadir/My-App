import React, { memo, useState } from 'react';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { Fab } from '../ui/Fab';
import { ThemeToggle } from '../ui/ThemeToggle';
import { MainNavLink } from './MainNavLink';
import { MobileNavLink } from './MobileNavLink';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ArrowUpIcon } from '../icons/ArrowUpIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { UserIcon } from '../icons/UserIcon';
import { LandmarkIcon } from '../icons/LandmarkIcon';
import { MenuIcon } from '../icons/MenuIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { XIcon } from '../icons/XIcon';
import { LayoutDashboardIcon } from '../icons/LayoutDashboardIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
type NavLabels = {
    dashboard: string;
    transactions: string;
    portfolio: string;
    analytics: string;
    reports: string;
    clients: string;
    treasury: string;
    services: string;
    investors: string;
    more: string;
    settings: string;
    money: string;
    followUp: string;
    documents: string;
    expenses: string;
};
type NavSharedProps = {
    view: string;
    onSelect: (view: string) => void;
    labels: NavLabels;
};
type MobileMenuNavProps = NavSharedProps & {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings?: () => void;
};
type BottomNavProps = NavSharedProps & {
    /** Optional contextual quick action rendered as a small floating button above the bar. */
    onFabPress?: () => void;
    fabHidden?: boolean;
    onOpenSettings?: () => void;
};
function AppDesktopNavComponent({ view, onSelect, labels }: NavSharedProps) {
    const sectionLabelClass = 'px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400';
    const triggerClass = `inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold uppercase tracking-wider transition-colors ${(SECONDARY_VIEWS as readonly string[]).includes(view)
        ? 'bg-primary text-white shadow-card'
        : 'text-neutral-600 hover:bg-neutral-100'}`;
    return (<div className="hidden items-center gap-1 rounded-xl border border-border p-1 sm:flex">
      <ThemeToggle />
      <MainNavLink activeView={view} onSelect={onSelect} targetView="dashboard" colorClass="bg-neutral-700" fillWidth={false} className="px-3 py-2">{labels.dashboard}</MainNavLink>
      <MainNavLink activeView={view} onSelect={onSelect} targetView="transactions" colorClass="bg-primary" fillWidth={false} className="px-3 py-2">{labels.transactions}</MainNavLink>
      <MainNavLink activeView={view} onSelect={onSelect} targetView="dzd" colorClass="bg-secondary" fillWidth={false} className="px-3 py-2">{labels.clients}</MainNavLink>
      <Dropdown trigger={(<button type="button" className={triggerClass} aria-label={labels.more}>
            <MenuIcon className="h-4 w-4"/>
            <span>{labels.more}</span>
          </button>)} contentClassName="w-64 p-2">
        <div className={sectionLabelClass}>{labels.money}</div>
        <DropdownItem onClick={() => onSelect('statistiques')} isActive={view === 'statistiques'} icon={<WalletIcon className="h-4 w-4 text-financial-asset"/>}>{labels.portfolio}</DropdownItem>
        <DropdownItem onClick={() => onSelect('tresorerie')} isActive={view === 'tresorerie'} icon={<LandmarkIcon className="h-4 w-4 text-success"/>}>{labels.treasury}</DropdownItem>
        <DropdownItem onClick={() => onSelect('services')} isActive={view === 'services'} icon={<BriefcaseIcon className="h-4 w-4 text-secondary"/>}>{labels.services}</DropdownItem>
        <div className={sectionLabelClass}>{labels.followUp}</div>
        <DropdownItem onClick={() => onSelect('investors')} isActive={view === 'investors'} icon={<UserIcon className="h-4 w-4 text-secondary"/>}>{labels.investors}</DropdownItem>
        <DropdownItem onClick={() => onSelect('analytics')} isActive={view === 'analytics'} icon={<ArrowUpIcon className="h-4 w-4 text-warning"/>}>{labels.analytics}</DropdownItem>
        <DropdownItem onClick={() => onSelect('expenses')} isActive={view === 'expenses'} icon={<BanknotesIcon className="h-4 w-4 text-danger"/>}>{labels.expenses}</DropdownItem>
      </Dropdown>
    </div>);
}
function AppMobileMenuNavComponent({ view, onSelect, labels, isOpen, onClose, onOpenSettings }: MobileMenuNavProps) {
    if (!isOpen)
        return null;
    return (<div className="anim-fade-slide-down fixed inset-0 z-50 bg-surface/95 p-4 backdrop-blur-xl sm:hidden">
          <div className="flex justify-end mb-8">
            <Button onClick={onClose} variant="ghost" className="rounded-full p-2">
              <XIcon className="w-6 h-6"/>
            </Button>
          </div>
          <div className="space-y-2">
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} targetView="dashboard" icon={<LayoutDashboardIcon className="w-6 h-6"/>} colorClass="text-neutral-400">{labels.dashboard}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} targetView="transactions" icon={<BriefcaseIcon className="w-6 h-6"/>} colorClass="text-primary">{labels.transactions}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} targetView="statistiques" icon={<WalletIcon className="w-6 h-6"/>} colorClass="text-financial-asset">{labels.portfolio}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} targetView="analytics" icon={<ArrowUpIcon className="w-6 h-6"/>} colorClass="text-warning">{labels.analytics}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} targetView="expenses" icon={<BanknotesIcon className="w-6 h-6"/>} colorClass="text-danger">{labels.expenses}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} targetView="dzd" icon={<UsersIcon className="w-6 h-6"/>} colorClass="text-secondary">{labels.clients}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} targetView="tresorerie" icon={<LandmarkIcon className="w-6 h-6"/>} colorClass="text-success">{labels.treasury}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} targetView="services" icon={<BriefcaseIcon className="w-6 h-6"/>} colorClass="text-secondary">{labels.services}</MobileNavLink>
            <MobileNavLink activeView={view} onSelect={onSelect} onClose={onClose} targetView="investors" icon={<UserIcon className="w-6 h-6"/>} colorClass="text-secondary">{labels.investors}</MobileNavLink>
            {onOpenSettings && (<button type="button" onClick={() => { onOpenSettings(); onClose(); }} className="flex w-full items-center gap-4 rounded-lg p-4 text-left text-lg font-semibold text-neutral-700 transition-colors hover:bg-neutral-100">
                <SettingsIcon className="w-6 h-6"/>
                {labels.settings}
              </button>)}
            <div className="flex items-center justify-between rounded-lg p-4">
              <span className="text-lg font-semibold text-neutral-700">Thème</span>
              <ThemeToggle />
            </div>
          </div>
    </div>);
}
const SECONDARY_VIEWS = ['statistiques', 'analytics', 'tresorerie', 'services', 'investors', 'expenses'] as const;
function AppBottomNavComponent({ view, onSelect, labels, onFabPress, fabHidden, onOpenSettings }: BottomNavProps) {
    const [moreOpen, setMoreOpen] = useState(false);
    const isSecondaryActive = (SECONDARY_VIEWS as readonly string[]).includes(view);
    const sectionLabelClass = 'px-5 pb-1 pt-3 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400';
    const tabBtn = (active: boolean) => `flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold leading-none transition-colors ${active
        ? 'bg-neutral-100 text-neutral-900'
        : 'text-neutral-500 hover:text-neutral-800'}`;
    const moreSheetItem = (target: string, icon: React.ReactNode, label: string, color: string) => (<button key={target} type="button" onClick={() => { setMoreOpen(false); onSelect(target); }} className={`flex items-center gap-3 w-full px-5 py-3 text-left text-sm font-medium ${view === target
            ? 'bg-neutral-100 text-neutral-900'
            : 'text-neutral-700 hover:bg-neutral-50'}`}>
      <span className={color}>{icon}</span>
      <span>{label}</span>
    </button>);
    const moreSheetAction = (icon: React.ReactNode, label: string, color: string, onClick?: () => void) => (<button type="button" onClick={() => { setMoreOpen(false); onClick?.(); }} className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50">
      <span className={color}>{icon}</span>
      <span>{label}</span>
    </button>);
    return (<>
      {onFabPress && !fabHidden && (<Fab position="inline" icon={<PlusIcon className="h-5 w-5"/>} onClick={onFabPress} wrapperClassName="sm:hidden fixed end-4 z-[46] bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" className="h-11 w-11 !bg-neutral-800 dark:!bg-neutral-200 dark:!text-neutral-900 shadow-card-hover hover:!bg-neutral-700 dark:hover:!bg-neutral-100" ariaLabel="Action rapide"/>)}

      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-[45] border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="grid grid-cols-4 gap-1 px-3 py-1.5">
          <button type="button" onClick={() => onSelect('dashboard')} className={tabBtn(view === 'dashboard')} aria-label={labels.dashboard}>
            <LayoutDashboardIcon className="h-[18px] w-[18px]"/>
            <span className="max-w-full truncate">{labels.dashboard}</span>
          </button>
          <button type="button" onClick={() => onSelect('transactions')} className={tabBtn(view === 'transactions')} aria-label={labels.transactions}>
            <BriefcaseIcon className="h-[18px] w-[18px]"/>
            <span className="max-w-full truncate">{labels.transactions}</span>
          </button>

          <button type="button" onClick={() => onSelect('dzd')} className={tabBtn(view === 'dzd')} aria-label={labels.clients}>
            <UsersIcon className="h-[18px] w-[18px]"/>
            <span className="max-w-full truncate">{labels.clients}</span>
          </button>
          <button type="button" onClick={() => setMoreOpen(true)} className={tabBtn(isSecondaryActive)} aria-label={labels.more}>
            <MenuIcon className="h-[18px] w-[18px]"/>
            <span className="max-w-full truncate">{labels.more}</span>
          </button>
        </div>
      </nav>

      <BottomSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} title={labels.more}>
        <div className="py-2">
          <div className={sectionLabelClass}>{labels.money}</div>
          {moreSheetItem('statistiques', <WalletIcon className="h-5 w-5"/>, labels.portfolio, 'text-financial-asset')}
          {moreSheetItem('tresorerie', <LandmarkIcon className="h-5 w-5"/>, labels.treasury, 'text-success')}
          {moreSheetItem('services', <BriefcaseIcon className="h-5 w-5"/>, labels.services, 'text-secondary')}
          <div className={sectionLabelClass}>{labels.followUp}</div>
          {moreSheetItem('investors', <UserIcon className="h-5 w-5"/>, labels.investors, 'text-secondary')}
          {moreSheetItem('analytics', <ArrowUpIcon className="h-5 w-5"/>, labels.analytics, 'text-warning')}
          {moreSheetItem('expenses', <BanknotesIcon className="h-5 w-5"/>, labels.expenses, 'text-danger')}
          {onOpenSettings && moreSheetAction(<SettingsIcon className="h-5 w-5"/>, labels.settings, 'text-neutral-500', onOpenSettings)}
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700">Thème</span>
            <ThemeToggle />
          </div>
        </div>
      </BottomSheet>
    </>);
}
const areNavSharedPropsEqual = (prev: NavSharedProps, next: NavSharedProps) => (prev.view === next.view
    && true
    && prev.labels === next.labels);
const areBottomNavPropsEqual = (prev: BottomNavProps, next: BottomNavProps) => (areNavSharedPropsEqual(prev, next)
    && prev.onFabPress === next.onFabPress
    && prev.fabHidden === next.fabHidden
    && prev.onOpenSettings === next.onOpenSettings);
const areMobileMenuNavPropsEqual = (prev: MobileMenuNavProps, next: MobileMenuNavProps) => (areNavSharedPropsEqual(prev, next)
    && prev.isOpen === next.isOpen
    && prev.onOpenSettings === next.onOpenSettings);
export const AppDesktopNav = memo(AppDesktopNavComponent, areNavSharedPropsEqual);
export const AppMobileMenuNav = memo(AppMobileMenuNavComponent, areMobileMenuNavPropsEqual);
export const AppBottomNav = memo(AppBottomNavComponent, areBottomNavPropsEqual);
