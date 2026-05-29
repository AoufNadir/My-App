import { memo } from 'react';
import { Button } from '../ui/Button';
import { MenuIcon } from '../icons/MenuIcon';
import { LogOutIcon } from '../icons/LogOutIcon';
import { MagnifyingGlassIcon } from '../icons/MagnifyingGlassIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { SunIcon } from '../icons/SunIcon';
import { MoonIcon } from '../icons/MoonIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import { AppDesktopNav } from './AppNavigation';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { useLanguage, type Lang } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
type MainHeaderBarProps = Record<string, any>;
function MainHeaderBarComponent({ view, setView, globalSearchTitle, setIsMobileMenuOpen, handleOpenGlobalSearch, onOpenSettings, onSignOut, labels }: MainHeaderBarProps) {
    const { lang, setLang, t } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const languageLabels: Record<Lang, string> = { fr: 'FR', ar: 'AR' };
    const languageNames: Record<Lang, string> = { fr: 'Français', ar: 'العربية' };
    return (<header className="sticky top-0 z-40 py-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="sm:hidden">
                        <Button onClick={() => setIsMobileMenuOpen(true)} variant="ghost" className="h-touch w-touch rounded-full p-0">
                            <MenuIcon className="w-6 h-6"/>
                        </Button>
                    </div>
                    <h1 className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl whitespace-nowrap shrink-0">
                        Pro Digital
                    </h1>
                </div>

                <AppDesktopNav view={view} onSelect={setView} labels={labels}/>

                <div className="flex items-center gap-0.5 sm:gap-1.5">
                    <button onClick={handleOpenGlobalSearch} type="button" className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all duration-200 cursor-pointer shrink-0" title={`${globalSearchTitle} (Ctrl+K)`}>
                        <MagnifyingGlassIcon className="w-[21px] h-[21px] sm:w-[22px] sm:h-[22px]"/>
                    </button>

                    {onOpenSettings && (<button onClick={onOpenSettings} type="button" className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all duration-200 cursor-pointer shrink-0" title={labels.settings} aria-label={labels.settings}>
                        <SettingsIcon className="w-[21px] h-[21px] sm:w-[22px] sm:h-[22px]"/>
                    </button>)}

                    <button onClick={toggleTheme} type="button" className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all duration-200 cursor-pointer shrink-0" title={theme === 'light' ? t('common.themeDark') : t('common.themeLight')}>
                        {theme === 'light' ? (<MoonIcon className="w-[21px] h-[21px] sm:w-[22px] sm:h-[22px] transition-transform duration-300 hover:rotate-12"/>) : (<SunIcon className="w-[21px] h-[21px] sm:w-[22px] sm:h-[22px] text-warning transition-transform duration-500 hover:rotate-90"/>)}
                    </button>

                    <Dropdown contentClassName="w-36" trigger={(<button type="button" className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs font-black text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all duration-200 cursor-pointer shrink-0 uppercase" aria-label="Changer la langue">
                                {languageLabels[lang]}
                            </button>)}>
                        {(['fr', 'ar'] as Lang[]).map((item) => (<DropdownItem key={item} onClick={() => setLang(item)} isActive={lang === item} icon={<span className={`flex h-6 w-8 items-center justify-center rounded-md text-[11px] font-black ${lang === item ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-700'}`}>{languageLabels[item]}</span>}>
                                {languageNames[item]}
                            </DropdownItem>))}
                    </Dropdown>

                    <button onClick={onSignOut} type="button" className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all duration-200 cursor-pointer shrink-0" title={labels.logout || 'Déconnexion'}>
                        <LogOutIcon className="w-[21px] h-[21px] sm:w-[22px] sm:h-[22px]"/>
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
