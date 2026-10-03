import { StatTile } from '../cards';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { useLanguage } from '../../contexts/LanguageContext';
type ManualAssetHeaderStatsProps = {
    assetName: string;
    assetDescription?: string;
    amountToReceive: number;
    clientAdvances: number;
    netCapitalImpact: number;
    clientsCount: number;
    onBack: () => void;
};
export function ManualAssetHeaderStats({ assetName, assetDescription, amountToReceive, clientAdvances, netCapitalImpact, clientsCount, onBack }: ManualAssetHeaderStatsProps) {
    const { t } = useLanguage();
    return (<>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onBack} aria-label={t('common.back')} className="-ms-2 flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-surface-muted hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ChevronLeftIcon aria-hidden="true" className="h-6 w-6 rtl:-scale-x-100"/>
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-neutral-900">{assetName}</h2>
      </div>

      <section aria-label={t('services.toReceive') as string} className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-financial-dzd">
            <BriefcaseIcon className="h-5 w-5"/>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-neutral-500">{t('services.toReceive')}</p>
            <CurrencyAmount value={amountToReceive} currency="DZD" semantic={amountToReceive > 0 ? 'profit' : 'plain'} size="hero" decimals={2} className="mt-0.5 block"/>
            <p className="mt-0.5 truncate text-xs text-neutral-500">{assetDescription || t('services.clients')}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label={t('services.clientAdvances') as string} value={clientAdvances} decimals={2} semantic={clientAdvances > 0 ? 'loss' : 'plain'}/>
        <StatTile label={t('services.capitalImpact') as string} value={netCapitalImpact} decimals={2} semantic="auto" hint={`${clientsCount} ${t(clientsCount > 1 ? 'services.clientMany' : 'services.clientOne')}`}/>
      </div>
    </>);
}
