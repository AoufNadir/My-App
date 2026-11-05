import { useLanguage } from '../../contexts/LanguageContext';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { Button } from '../ui/Button';

// The one way to open a report window (V9-6): the same icon and the same words on every page, as a
// button with its label on a wide screen, as an icon in the header on a phone, or as a small icon
// at the corner of a card. It only opens the window: nothing is written anywhere.

export type ReportButtonVariant = 'inline' | 'header' | 'section';

const ICON_BUTTON = 'flex shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export function ReportButton({ onClick, variant = 'inline', label }: { onClick: () => void; variant?: ReportButtonVariant; label?: string }) {
    const { t } = useLanguage();
    const text = label ?? t('reports.pdfEntry') as string;
    if (variant === 'inline')
        return (<Button type="button" variant="outline" size="md" onClick={onClick} className="font-semibold" title={text}>
          <FileSpreadsheetIcon aria-hidden="true" className="h-4 w-4"/>
          <span>{text}</span>
        </Button>);
    return (<button type="button" onClick={onClick} title={text} aria-label={text} className={`${ICON_BUTTON} ${variant === 'header' ? 'h-11 w-11' : 'h-touch w-touch'}`}>
        <FileSpreadsheetIcon aria-hidden="true" className={variant === 'header' ? 'h-[22px] w-[22px]' : 'h-5 w-5'}/>
      </button>);
}
