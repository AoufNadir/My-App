import { Button } from '../ui/Button';
import { MenuIcon } from '../icons/MenuIcon';
import { LogOutIcon } from '../icons/LogOutIcon';
import { SunIcon } from '../icons/SunIcon';
import { MoonIcon } from '../icons/MoonIcon';
import { MagnifyingGlassIcon } from '../icons/MagnifyingGlassIcon';
import { AppDesktopNav } from './AppNavigation';

type MainHeaderBarProps = Record<string, any>;

export function MainHeaderBar({
    isDark,
    view,
    setView,
    t,
    setIsMobileMenuOpen,
    handleOpenGlobalSearch,
    setTheme,
    onSignOut
}: MainHeaderBarProps) {
    return (
        <header className="sticky top-0 z-40 py-4 backdrop-blur-md bg-opacity-50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="sm:hidden">
                        <Button onClick={() => setIsMobileMenuOpen(true)} className={`p-2 rounded-full ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>
                            <MenuIcon className="w-6 h-6" />
                        </Button>
                    </div>
                    <h1 className="text-white text-2xl sm:text-3xl font-extrabold tracking-tight">
                        Pro Digital
                    </h1>
                </div>

                <AppDesktopNav
                    view={view}
                    isDark={isDark}
                    onSelect={setView}
                    labels={{
                        transactions: t('nav.transactions') as string,
                        portfolio: t('nav.portfolio') as string,
                        analytics: t('nav.analytics') as string,
                        clients: t('nav.clients') as string,
                        treasury: t('nav.treasury') as string,
                        investors: 'Investisseurs'
                    }}
                />

                <div className="flex items-center gap-1 sm:gap-2">
                    <Button
                        onClick={handleOpenGlobalSearch}
                        className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}
                        title={`${t('common.globalSearch')} (Ctrl+K)`}
                    >
                        <MagnifyingGlassIcon className="w-5 h-5" />
                    </Button>

                    <Button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>
                        {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                    </Button>

                    <Button onClick={onSignOut} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>
                        <LogOutIcon className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </header>
    );
}
