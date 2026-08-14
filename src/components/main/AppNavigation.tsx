import React, { memo, useState } from 'react';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { Fab } from '../ui/Fab';
import { MainNavLink } from './MainNavLink';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ArrowUpIcon } from '../icons/ArrowUpIcon';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { UserIcon } from '../icons/UserIcon';
import { LandmarkIcon } from '../icons/LandmarkIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { MenuIcon } from '../icons/MenuIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { XIcon } from '../icons/XIcon';
import { LayoutDashboardIcon } from '../icons/LayoutDashboardIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { MagnifyingGlassIcon } from '../icons/MagnifyingGlassIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { SunIcon } from '../icons/SunIcon';
import { MoonIcon } from '../icons/MoonIcon';
import { LogOutIcon } from '../icons/LogOutIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MORE_NAVIGATION_SECTIONS, SECONDARY_VIEWS, type AppViewTarget } from '../../config/navigation';
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
    orders: string;
    insights: string;
    more: string;
    settings: string;
    expenses: string;
};
type NavSharedProps = {
    view: string;
    onSelect: (view: string) => void;
    labels: NavLabels;
};
type MobileMenuNavProps = {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings?: () => void;
    handleOpenGlobalSearch?: () => void;
    onSignOut?: () => void;
    labels: NavLabels;
};
type BottomNavProps = NavSharedProps & {
    /** Optional contextual quick action rendered as a small floating button above the bar. */
    onFabPress?: () => void;
    fabHidden?: boolean;
    onOpenSettings?: () => void;
    overdueCount?: number;
};
const navigationItemMeta = (target: AppViewTarget) => {
    switch (target) {
        case 'statistiques': return { icon: <WalletIcon className="h-4 w-4"/>, color: 'text-financial-asset' };
        case 'tresorerie': return { icon: <LandmarkIcon className="h-4 w-4"/>, color: 'text-success' };
        case 'expenses': return { icon: <BanknotesIcon className="h-4 w-4"/>, color: 'text-danger' };
        case 'orders': return { icon: <CreditCardIcon className="h-4 w-4"/>, color: 'text-primary' };
        case 'services': return { icon: <BriefcaseIcon className="h-4 w-4"/>, color: 'text-secondary' };
        case 'investors': return { icon: <UserIcon className="h-4 w-4"/>, color: 'text-secondary' };
        case 'analytics': return { icon: <ArrowUpIcon className="h-4 w-4"/>, color: 'text-warning' };
        case 'insights': return { icon: <TrendingUpIcon className="h-4 w-4"/>, color: 'text-secondary' };
    }
};
function AppDesktopNavComponent({ view, onSelect, labels, onOpenSettings }: NavSharedProps & { onOpenSettings?: () => void }) {
    const { t } = useLanguage();
    const sectionLabelClass = 'px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400';
    const triggerClass = `inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold uppercase tracking-wider transition-colors ${(SECONDARY_VIEWS as readonly string[]).includes(view)
        ? 'bg-primary text-white shadow-card'
        : 'text-neutral-600 hover:bg-neutral-100'}`;
    return (<div className="hidden items-center gap-1 rounded-xl border border-border p-1 sm:flex">
      <MainNavLink activeView={view} onSelect={onSelect} targetView="dashboard" colorClass="bg-neutral-700" fillWidth={false} className="px-3 py-2">{labels.dashboard}</MainNavLink>
      <MainNavLink activeView={view} onSelect={onSelect} targetView="transactions" colorClass="bg-primary" fillWidth={false} className="px-3 py-2">{labels.transactions}</MainNavLink>
      <MainNavLink activeView={view} onSelect={onSelect} targetView="dzd" colorClass="bg-secondary" fillWidth={false} className="px-3 py-2">{labels.clients}</MainNavLink>
      <Dropdown trigger={(<button type="button" className={triggerClass} aria-label={labels.more}>
            <MenuIcon className="h-4 w-4"/>
            <span>{labels.more}</span>
          </button>)} contentClassName="w-64 p-2">
        {MORE_NAVIGATION_SECTIONS.map((section) => (<React.Fragment key={section.id}>
          <div className={sectionLabelClass}>{t(section.labelKey)}</div>
          {section.items.map((item) => {
              const meta = navigationItemMeta(item.target);
              return (<DropdownItem key={item.target} onClick={() => onSelect(item.target)} isActive={view === item.target} icon={<span className={meta.color}>{meta.icon}</span>}>
                {t(item.labelKey)}
              </DropdownItem>);
          })}
          {section.id === 'settings' && onOpenSettings && (<DropdownItem onClick={onOpenSettings} icon={<SettingsIcon className="h-4 w-4 text-neutral-500"/>}>{labels.settings}</DropdownItem>)}
        </React.Fragment>))}
      </Dropdown>
    </div>);
}
function AppMobileMenuNavComponent({ isOpen, onClose, onOpenSettings, handleOpenGlobalSearch, onSignOut, labels }: MobileMenuNavProps) {
    const { lang, setLang, t } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    if (!isOpen)
        return null;
    const nextLang = lang === 'fr' ? 'ar' : 'fr';
    const nextLangName = lang === 'fr' ? 'العربية' : 'Français';
    const actionClass = 'flex min-h-button-md w-full items-center gap-4 rounded-button px-3 py-2.5 text-start text-base font-semibold text-neutral-700 transition-colors hover:bg-neutral-100';
    return (<div className="anim-fade-slide-down fixed inset-0 z-50 max-w-full overflow-y-auto bg-surface/95 p-4 pb-16 backdrop-blur-xl sm:hidden">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="truncate whitespace-nowrap text-lg font-extrabold text-neutral-900">Pro Digital</h2>
            <Button onClick={onClose} variant="icon" size="icon" className="rounded-full" aria-label={t('common.close') as string}>
              <XIcon className="w-6 h-6"/>
            </Button>
          </div>
          <div className="space-y-1">
            {handleOpenGlobalSearch && (<button type="button" onClick={() => { handleOpenGlobalSearch(); onClose(); }} className={actionClass}>
                <MagnifyingGlassIcon className="w-6 h-6"/>
                <span>{t('common.search') || 'Recherche'}</span>
              </button>)}

            <button type="button" onClick={() => { toggleTheme(); onClose(); }} className={actionClass}>
                {theme === 'light' ? <MoonIcon className="w-6 h-6"/> : <SunIcon className="w-6 h-6 text-warning"/>}
                <span>{theme === 'light' ? t('common.themeDark') || 'Mode sombre' : t('common.themeLight') || 'Mode clair'}</span>
            </button>

            <button type="button" onClick={() => { setLang(nextLang); onClose(); }} className={actionClass}>
                <GlobeIcon className="w-6 h-6"/>
                <span>{nextLangName}</span>
            </button>

            {onOpenSettings && (<button type="button" onClick={() => { onOpenSettings(); onClose(); }} className={actionClass}>
                <SettingsIcon className="w-6 h-6"/>
                {labels.settings}
              </button>)}

            {onSignOut && (<button type="button" onClick={() => { onSignOut(); onClose(); }} className={`${actionClass} text-danger hover:bg-danger-bg`}>
                <LogOutIcon className="w-6 h-6"/>
                <span>{t('common.logout') || 'Déconnexion'}</span>
              </button>)}
          </div>
    </div>);
}
function AppBottomNavComponent({ view, onSelect, labels, onFabPress, fabHidden, onOpenSettings, overdueCount = 0 }: BottomNavProps) {
    const { t } = useLanguage();
    const [moreOpen, setMoreOpen] = useState(false);
    const isSecondaryActive = (SECONDARY_VIEWS as readonly string[]).includes(view);
    const sectionLabelClass = 'px-5 pb-1 pt-3 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400';
    const tabBtn = (active: boolean) => `flex min-h-button-sm min-w-0 flex-col items-center justify-center gap-0.5 rounded-button px-1 py-1.5 text-[11px] font-semibold leading-none transition-colors ${active
        ? 'bg-neutral-100 text-neutral-900'
        : 'text-neutral-500 hover:text-neutral-800'}`;
    const moreSheetItem = (target: string, icon: React.ReactNode, label: string, color: string) => (<button key={target} type="button" onClick={() => { setMoreOpen(false); onSelect(target); }} className={`flex min-h-button-md w-full items-center gap-3 px-5 py-3 text-start text-sm font-medium ${view === target
            ? 'bg-neutral-100 text-neutral-900'
            : 'text-neutral-700 hover:bg-neutral-50'}`}>
      <span className={color}>{icon}</span>
      <span>{label}</span>
    </button>);
    const moreSheetAction = (icon: React.ReactNode, label: string, color: string, onClick?: () => void) => (<button type="button" onClick={() => { setMoreOpen(false); onClick?.(); }} className="flex min-h-button-md w-full items-center gap-3 px-5 py-3 text-start text-sm font-medium text-neutral-700 hover:bg-neutral-50">
      <span className={color}>{icon}</span>
      <span>{label}</span>
    </button>);
    return (<>
      {onFabPress && !fabHidden && (<Fab position="inline" icon={<PlusIcon className="h-5 w-5"/>} onClick={onFabPress} wrapperClassName="sm:hidden fixed end-[calc(100vw-100dvw+1rem)] z-[46] bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" className="h-11 w-11 !bg-fab-bg hover:!bg-fab-bg-hover text-white shadow-card-hover" ariaLabel={t('quickActions.title') as string}/>)}

      <nav aria-label="Navigation principale" className="fixed bottom-0 start-0 z-[45] w-[100dvw] border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] sm:hidden">
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
            <span className="relative inline-flex">
              <UsersIcon className="h-[18px] w-[18px]"/>
              {overdueCount > 0 && (<span className="absolute -end-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
                  {overdueCount > 9 ? '9+' : overdueCount}
                </span>)}
            </span>
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
          {MORE_NAVIGATION_SECTIONS.map((section) => (<React.Fragment key={section.id}>
            <div className={sectionLabelClass}>{t(section.labelKey)}</div>
            {section.items.map((item) => {
                const meta = navigationItemMeta(item.target);
                return moreSheetItem(item.target, meta.icon, t(item.labelKey), meta.color);
            })}
            {section.id === 'settings' && onOpenSettings && moreSheetAction(<SettingsIcon className="h-5 w-5"/>, labels.settings, 'text-neutral-500', onOpenSettings)}
          </React.Fragment>))}
        </div>
      </BottomSheet>
    </>);
}
const areNavSharedPropsEqual = (prev: NavSharedProps, next: NavSharedProps) => (prev.view === next.view
    && prev.onSelect === next.onSelect
    && prev.labels === next.labels);
const areDesktopNavPropsEqual = (prev: NavSharedProps & { onOpenSettings?: () => void }, next: NavSharedProps & { onOpenSettings?: () => void }) => (
    areNavSharedPropsEqual(prev, next) && prev.onOpenSettings === next.onOpenSettings);
const areBottomNavPropsEqual = (prev: BottomNavProps, next: BottomNavProps) => (areNavSharedPropsEqual(prev, next)
    && prev.onFabPress === next.onFabPress
    && prev.fabHidden === next.fabHidden
    && prev.onOpenSettings === next.onOpenSettings
    && prev.overdueCount === next.overdueCount);
const areMobileMenuNavPropsEqual = (prev: MobileMenuNavProps, next: MobileMenuNavProps) => (
    prev.isOpen === next.isOpen
    && prev.onOpenSettings === next.onOpenSettings
    && prev.handleOpenGlobalSearch === next.handleOpenGlobalSearch
    && prev.onSignOut === next.onSignOut
    && prev.labels === next.labels);
export const AppDesktopNav = memo(AppDesktopNavComponent, areDesktopNavPropsEqual);
export const AppMobileMenuNav = memo(AppMobileMenuNavComponent, areMobileMenuNavPropsEqual);
export const AppBottomNav = memo(AppBottomNavComponent, areBottomNavPropsEqual);
