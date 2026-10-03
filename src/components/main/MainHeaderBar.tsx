import { memo } from 'react';
import { LogOutIcon } from '../icons/LogOutIcon';
import { MagnifyingGlassIcon } from '../icons/MagnifyingGlassIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { SunIcon } from '../icons/SunIcon';
import { MoonIcon } from '../icons/MoonIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import { AppDesktopNav } from './AppNavigation';
import { HEADER_ACTIONS_SLOT_ID } from './headerActionsSlot';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { useLanguage, type Lang } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
type MainHeaderBarProps = Record<string, any>;
// On phones the header names the page; the bottom bar's "Plus" holds what the ☰ menu held.
const PAGE_TITLE_LABELS: Record<string, string> = {
    dashboard: 'dashboard',
    transactions: 'transactions',
    dzd: 'clients',
    statistiques: 'portfolio',
    analytics: 'analytics',
    expenses: 'expenses',
    tresorerie: 'treasury',
    services: 'services',
    investors: 'investors',
};
function MainHeaderBarComponent({ view, setView, globalSearchTitle, handleOpenGlobalSearch, onOpenSettings, onSignOut, labels }: MainHeaderBarProps) {
    const { lang, setLang, t } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const languageLabels: Record<Lang, string> = { fr: 'FR', ar: 'AR' };
    const languageNames: Record<Lang, string> = { fr: 'Français', ar: 'العربية' };
    const themeLabel = theme === 'light' ? t('common.themeDark') : t('common.themeLight');
    const pageTitle = labels[PAGE_TITLE_LABELS[view]] || 'Pro Digital';
    const themeIcon = theme === 'light'
        ? <MoonIcon className="h-5 w-5 transition-transform duration-300 hover:rotate-12"/>
        : <SunIcon className="h-5 w-5 text-warning transition-transform duration-500 hover:rotate-90"/>;
    const languageDropdown = (buttonClassName: string) => (
        <Dropdown contentClassName="w-36" trigger={(<button type="button" className={buttonClassName} aria-label={t('auth.language')} title={t('auth.language')}>
            {languageLabels[lang]}
        </button>)}>
            {(['fr', 'ar'] as Lang[]).map((item) => (<DropdownItem key={item} onClick={() => setLang(item)} isActive={lang === item} icon={<span className={`flex h-6 w-8 items-center justify-center rounded-md text-xs font-black ${lang === item ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-700'}`}>{languageLabels[item]}</span>}>
                {languageNames[item]}
            </DropdownItem>))}
        </Dropdown>
    );
    return (<header className="sticky top-0 z-40 py-2.5 backdrop-blur-md sm:py-3">
            <div className="flex items-center justify-between gap-2 sm:hidden">
                <h1 className="min-w-0 truncate whitespace-nowrap text-[22px] font-extrabold leading-7 tracking-tight text-neutral-900">
                    {pageTitle}
                </h1>

                <div className="-me-2 flex shrink-0 items-center gap-0.5">
                    <div id={HEADER_ACTIONS_SLOT_ID} className="flex items-center gap-0.5"/>
                    <button onClick={handleOpenGlobalSearch} type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95" title={globalSearchTitle} aria-label={globalSearchTitle}>
                        <MagnifyingGlassIcon className="h-[22px] w-[22px]"/>
                    </button>
                </div>
            </div>

            <div className="hidden items-center justify-between sm:flex">
                <div className="flex min-w-0 items-center gap-2">
                    <h1 className="shrink-0 whitespace-nowrap text-2xl font-extrabold tracking-tight text-neutral-900">
                        Pro Digital
                    </h1>
                </div>

                <AppDesktopNav view={view} onSelect={setView} labels={labels}/>

                <div className="flex items-center gap-1.5">
                    <button onClick={handleOpenGlobalSearch} type="button" className="flex h-icon-button w-icon-button shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-600 transition-all duration-200 hover:bg-neutral-100 active:scale-95" title={`${globalSearchTitle} (Ctrl+K)`} aria-label={globalSearchTitle}>
                        <MagnifyingGlassIcon className="h-[22px] w-[22px]"/>
                    </button>

                    {onOpenSettings && (<button onClick={onOpenSettings} type="button" className="flex h-icon-button w-icon-button shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-600 transition-all duration-200 hover:bg-neutral-100 active:scale-95" title={labels.settings} aria-label={labels.settings}>
                        <SettingsIcon className="h-[22px] w-[22px]"/>
                    </button>)}

                    <button onClick={toggleTheme} type="button" className="flex h-icon-button w-icon-button shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-600 transition-all duration-200 hover:bg-neutral-100 active:scale-95" title={themeLabel as string} aria-label={themeLabel as string}>
                        {themeIcon}
                    </button>

                    {languageDropdown('flex h-icon-button w-icon-button shrink-0 cursor-pointer items-center justify-center rounded-full text-xs font-black uppercase text-neutral-600 transition-all duration-200 hover:bg-neutral-100 active:scale-95')}

                    <button onClick={onSignOut} type="button" className="flex h-icon-button w-icon-button shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-600 transition-all duration-200 hover:bg-neutral-100 active:scale-95" title={labels.logout} aria-label={labels.logout}>
                        <LogOutIcon className="h-[22px] w-[22px]"/>
                    </button>
                </div>
            </div>
        </header>);
}
const areMainHeaderBarPropsEqual = (prev: MainHeaderBarProps, next: MainHeaderBarProps) => (true 
    && prev.view === next.view
    && prev.globalSearchTitle === next.globalSearchTitle
    && prev.labels === next.labels
    && prev.onOpenSettings === next.onOpenSettings);
export const MainHeaderBar = memo(MainHeaderBarComponent, areMainHeaderBarPropsEqual);
