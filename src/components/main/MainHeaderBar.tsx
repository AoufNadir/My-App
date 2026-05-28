import { memo } from 'react';
import { Button } from '../ui/Button';
import { MenuIcon } from '../icons/MenuIcon';
import { LogOutIcon } from '../icons/LogOutIcon';
import { MagnifyingGlassIcon } from '../icons/MagnifyingGlassIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { AppDesktopNav } from './AppNavigation';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { useLanguage, type Lang } from '../../contexts/LanguageContext';
type MainHeaderBarProps = Record<string, any>;
function MainHeaderBarComponent({ view, setView, globalSearchTitle, setIsMobileMenuOpen, handleOpenGlobalSearch, onSignOut, labels }: MainHeaderBarProps) {
    const { lang, setLang } = useLanguage();
    const languageLabels: Record<Lang, string> = { fr: 'FR', ar: 'AR' };
    const languageNames: Record<Lang, string> = { fr: 'Français', ar: 'العربية' };
    return (<header className="sticky top-0 z-40 py-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="sm:hidden">
                        <Button onClick={() => setIsMobileMenuOpen(true)} variant="ghost" className="rounded-full p-2">
                            <MenuIcon className="w-6 h-6"/>
                        </Button>
                    </div>
                    <h1 className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
                        Pro Digital
                    </h1>
                </div>

                <AppDesktopNav view={view} onSelect={setView} labels={labels}/>

                <div className="flex items-center gap-1 sm:gap-2">
                    <Button onClick={handleOpenGlobalSearch} variant="ghost" className="rounded-full p-2" title={`${globalSearchTitle} (Ctrl+K)`}>
                        <MagnifyingGlassIcon className="w-5 h-5"/>
                    </Button>

                    <Dropdown contentClassName="w-36" trigger={(<button type="button" className="inline-flex h-touch items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold text-neutral-600 transition-colors hover:bg-neutral-100" aria-label="Changer la langue">
                                <GlobeIcon className="h-5 w-5"/>
                                <span>{languageLabels[lang]}</span>
                            </button>)}>
                        {(['fr', 'ar'] as Lang[]).map((item) => (<DropdownItem key={item} onClick={() => setLang(item)} isActive={lang === item} icon={<span className={`flex h-6 w-8 items-center justify-center rounded-md text-[11px] font-black ${lang === item ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-700'}`}>{languageLabels[item]}</span>}>
                                {languageNames[item]}
                            </DropdownItem>))}
                    </Dropdown>

                    <Button onClick={onSignOut} variant="ghost" className="rounded-full p-2">
                        <LogOutIcon className="w-5 h-5"/>
                    </Button>
                </div>
            </div>
        </header>);
}
const areMainHeaderBarPropsEqual = (prev: MainHeaderBarProps, next: MainHeaderBarProps) => (true && prev.view === next.view
    && prev.globalSearchTitle === next.globalSearchTitle
    && prev.labels === next.labels);
export const MainHeaderBar = memo(MainHeaderBarComponent, areMainHeaderBarPropsEqual);
