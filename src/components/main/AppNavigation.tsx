import React, { memo, useCallback, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { MainNavLink } from './MainNavLink';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { ArrowRightLeftIcon } from '../icons/ArrowRightLeftIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ArrowUpIcon } from '../icons/ArrowUpIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { UserIcon } from '../icons/UserIcon';
import { LandmarkIcon } from '../icons/LandmarkIcon';
import { MenuIcon } from '../icons/MenuIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { HomeIcon } from '../icons/HomeIcon';
import { LayoutGridIcon } from '../icons/LayoutGridIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { SunIcon } from '../icons/SunIcon';
import { MoonIcon } from '../icons/MoonIcon';
import { LogOutIcon } from '../icons/LogOutIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
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
    logout: string;
    newOperation: string;
};
type NavSharedProps = {
    view: string;
    onSelect: (view: string) => void;
    labels: NavLabels;
};
type BottomNavProps = NavSharedProps & {
    /** Opens the new-operation menu. Left out while the data loads, which disables (+). */
    onNewOperation?: () => void;
    onOpenSettings?: () => void;
    onSignOut?: () => void;
    overdueCount?: number;
};
function AppDesktopNavComponent({ view, onSelect, labels }: NavSharedProps) {
    const sectionLabelClass = 'px-3 pb-1 pt-2 text-[13px] font-bold text-neutral-500';
    const triggerClass = `inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold uppercase tracking-wider transition-colors ${(SECONDARY_VIEWS as readonly string[]).includes(view)
        ? 'bg-primary text-white shadow-card'
        : 'text-neutral-600 hover:bg-neutral-100'}`;
    return (<div className="hidden items-center gap-1 rounded-xl border border-border p-1 sm:flex">
      <MainNavLink activeView={view} onSelect={onSelect} targetView="dashboard" colorClass="bg-neutral-700 dark:bg-neutral-200" fillWidth={false} className="px-3 py-2">{labels.dashboard}</MainNavLink>
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
const SECONDARY_VIEWS = ['statistiques', 'analytics', 'tresorerie', 'services', 'investors', 'expenses'] as const;
const MORE_SHEET_GROUPS = [
    { key: 'money', items: [
        { view: 'statistiques', label: 'portfolio', icon: WalletIcon, tone: 'bg-financial-asset-bg text-financial-asset' },
        { view: 'tresorerie', label: 'treasury', icon: LandmarkIcon, tone: 'bg-financial-profit-bg text-financial-profit' },
        { view: 'services', label: 'services', icon: BriefcaseIcon, tone: 'bg-secondary/10 text-secondary dark:bg-secondary-light/10 dark:text-secondary-light' },
    ] },
    { key: 'followUp', items: [
        { view: 'investors', label: 'investors', icon: UserIcon, tone: 'bg-secondary/10 text-secondary dark:bg-secondary-light/10 dark:text-secondary-light' },
        { view: 'analytics', label: 'analytics', icon: ArrowUpIcon, tone: 'bg-financial-debt-bg text-financial-debt' },
        { view: 'expenses', label: 'expenses', icon: BanknotesIcon, tone: 'bg-financial-loss-bg text-financial-loss' },
    ] },
] as const;
/**
 * Phone navigation: four destinations around a central (+) that opens the new-operation menu.
 * "Plus" gathers the other pages with the theme, language, settings and logout that used to
 * live in the ☰ menu at the top.
 */
function AppBottomNavComponent({ view, onSelect, labels, onNewOperation, onOpenSettings, onSignOut, overdueCount = 0 }: BottomNavProps) {
    const { lang, setLang, t } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const [moreOpen, setMoreOpen] = useState(false);
    // Stable, so the sheet keeps its focus while the theme or language changes under it.
    const closeMore = useCallback(() => setMoreOpen(false), []);
    const isMoreActive = (SECONDARY_VIEWS as readonly string[]).includes(view);
    const nextLang = lang === 'fr' ? 'ar' : 'fr';
    const tabClass = (active: boolean) => `flex h-[60px] min-w-0 flex-col items-center justify-center gap-1 text-xs leading-4 transition-colors ${active
        ? 'font-bold text-financial-asset'
        : 'font-semibold text-neutral-500 hover:text-neutral-800'}`;
    const tabIconClass = (active: boolean) => `relative flex h-[30px] w-14 items-center justify-center rounded-full transition-colors ${active ? 'bg-financial-asset-bg' : ''}`;
    const sheetToggleClass = 'flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-button border border-border bg-surface-muted px-3 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-200 active:scale-[0.98]';
    const sheetRowClass = 'flex min-h-[52px] w-full items-center gap-3 rounded-button px-1 text-start text-[15px] font-semibold transition-colors hover:bg-neutral-50';
    const openFromSheet = (action: () => void) => {
        setMoreOpen(false);
        action();
    };
    return (<>
      <nav aria-label={t('nav.mainNavigation')} className="fixed bottom-0 start-0 z-[45] w-[100dvw] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="grid h-[72px] grid-cols-5 items-center px-1">
          <button type="button" onClick={() => onSelect('dashboard')} aria-current={view === 'dashboard' ? 'page' : undefined} className={tabClass(view === 'dashboard')}>
            <span className={tabIconClass(view === 'dashboard')}><HomeIcon className="h-[22px] w-[22px]"/></span>
            <span className="max-w-full truncate">{labels.dashboard}</span>
          </button>
          <button type="button" onClick={() => onSelect('transactions')} aria-current={view === 'transactions' ? 'page' : undefined} className={tabClass(view === 'transactions')}>
            <span className={tabIconClass(view === 'transactions')}><ArrowRightLeftIcon className="h-[22px] w-[22px]"/></span>
            <span className="max-w-full truncate">{labels.transactions}</span>
          </button>
          <div className="flex justify-center">
            <button type="button" onClick={onNewOperation} disabled={!onNewOperation} aria-label={labels.newOperation} title={labels.newOperation} className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-fab-bg text-white shadow-card-hover transition-transform hover:bg-fab-bg-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
              <PlusIcon className="h-6 w-6"/>
            </button>
          </div>
          <button type="button" onClick={() => onSelect('dzd')} aria-current={view === 'dzd' ? 'page' : undefined} className={tabClass(view === 'dzd')}>
            <span className={tabIconClass(view === 'dzd')}>
              <UsersIcon className="h-[22px] w-[22px]"/>
              {overdueCount > 0 && (<span className="absolute -top-[5px] end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-xs font-bold leading-none text-white">
                  {overdueCount > 9 ? '9+' : overdueCount}
                </span>)}
            </span>
            <span className="max-w-full truncate">{labels.clients}</span>
          </button>
          <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen} className={tabClass(isMoreActive)}>
            <span className={tabIconClass(isMoreActive)}><LayoutGridIcon className="h-[22px] w-[22px]"/></span>
            <span className="max-w-full truncate">{labels.more}</span>
          </button>
        </div>
      </nav>

      <BottomSheet isOpen={moreOpen} onClose={closeMore} title={labels.more}>
        <div className="flex flex-col gap-3 px-5 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={toggleTheme} className={sheetToggleClass}>
              {theme === 'light' ? <MoonIcon className="h-5 w-5 shrink-0"/> : <SunIcon className="h-5 w-5 shrink-0 text-warning"/>}
              <span className="truncate">{theme === 'light' ? t('common.themeDark') : t('common.themeLight')}</span>
            </button>
            <button type="button" onClick={() => setLang(nextLang)} lang={nextLang} className={`${sheetToggleClass} ${nextLang === 'ar' ? 'font-arabic text-[15px] font-bold' : 'font-latin'}`}>
              <GlobeIcon className="h-5 w-5 shrink-0"/>
              <span className="truncate">{nextLang === 'ar' ? 'العربية' : 'Français'}</span>
            </button>
          </div>

          {MORE_SHEET_GROUPS.map((group) => (<React.Fragment key={group.key}>
              <p className="mt-1 text-[13px] font-bold text-neutral-500">{labels[group.key]}</p>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map(({ view: target, label, icon: Icon, tone }) => (<button key={target} type="button" onClick={() => openFromSheet(() => onSelect(target))} aria-current={view === target ? 'page' : undefined} className={`flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-2 rounded-card border bg-surface px-1.5 py-2.5 text-center text-[13px] font-semibold leading-tight text-neutral-900 transition-colors hover:bg-neutral-50 active:scale-[0.98] ${view === target ? 'border-financial-asset' : 'border-border'}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-[22px] w-[22px]"/></span>
                    <span className="max-w-full">{labels[label]}</span>
                  </button>))}
              </div>
            </React.Fragment>))}

          {(onOpenSettings || onSignOut) && (<div className="mt-1 flex flex-col border-t border-neutral-100 pt-1">
              {onOpenSettings && (<button type="button" onClick={() => openFromSheet(onOpenSettings)} className={`${sheetRowClass} text-neutral-700`}>
                  <SettingsIcon className="h-[22px] w-[22px] shrink-0"/>
                  <span>{labels.settings}</span>
                </button>)}
              {onSignOut && (<button type="button" onClick={() => openFromSheet(onSignOut)} className={`${sheetRowClass} text-danger dark:text-danger-light`}>
                  <LogOutIcon className="h-[22px] w-[22px] shrink-0 rtl:-scale-x-100"/>
                  <span>{labels.logout}</span>
                </button>)}
            </div>)}
        </div>
      </BottomSheet>
    </>);
}
const areNavSharedPropsEqual = (prev: NavSharedProps, next: NavSharedProps) => (prev.view === next.view
    && true
    && prev.labels === next.labels);
// onSelect is left out on purpose: it is rebuilt on every render and only reads `view`,
// which is compared already.
const areBottomNavPropsEqual = (prev: BottomNavProps, next: BottomNavProps) => (areNavSharedPropsEqual(prev, next)
    && prev.onNewOperation === next.onNewOperation
    && prev.onOpenSettings === next.onOpenSettings
    && prev.onSignOut === next.onSignOut
    && prev.overdueCount === next.overdueCount);
export const AppDesktopNav = memo(AppDesktopNavComponent, areNavSharedPropsEqual);
export const AppBottomNav = memo(AppBottomNavComponent, areBottomNavPropsEqual);
