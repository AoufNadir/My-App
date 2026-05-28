import { useTheme } from '../../providers/ThemeProvider';
import { SunIcon } from '../icons/SunIcon';
import { MoonIcon } from '../icons/MoonIcon';

export function ThemeToggle({ className = '' }: { className?: string }) {
    const { resolvedTheme, toggleTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
            className={[
                'inline-flex h-9 w-9 items-center justify-center rounded-full',
                'text-neutral-500 transition-colors',
                'hover:bg-neutral-100 hover:text-neutral-700',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                className,
            ].filter(Boolean).join(' ')}
        >
            {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        </button>
    );
}
