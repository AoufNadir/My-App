import { PageHeader } from '../ui/PageHeader';
import { FinancialMetricCard } from '../ui/FinancialMetricCard';
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
      <PageHeader title={assetName} subtitle={assetDescription || t('services.clients') as string} onBack={onBack} className="-mx-4 sm:mx-0 sm:rounded-lg"/>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FinancialMetricCard label={t('services.toReceive') as string} value={amountToReceive} semantic={amountToReceive > 0 ? 'profit' : 'plain'} tone="profit"/>
        <FinancialMetricCard label={t('services.clientAdvances') as string} value={clientAdvances} semantic={clientAdvances > 0 ? 'loss' : 'plain'} tone="debt"/>
        <FinancialMetricCard label={t('services.capitalImpact') as string} value={netCapitalImpact} semantic="auto" tone={netCapitalImpact >= 0 ? 'profit' : 'debt'} hint={`${clientsCount} client${clientsCount > 1 ? 's' : ''}`}/>
      </div>
    </>);
}
