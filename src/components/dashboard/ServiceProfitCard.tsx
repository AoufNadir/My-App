import { CurrencyAmount } from '../financial/CurrencyAmount';
import { ListRow, SectionCard } from '../cards';
import { serviceProfitTotal, type ServiceProfitParts } from '../../utils/serviceProfitOverview';
import { useLanguage } from '../../contexts/LanguageContext';

export type ServiceProfitCardProps = {
    /** « Ce mois », « Aujourd'hui »…: the period the amounts are for, shown above the total */
    periodTitle: string;
    /** Amounts of that period */
    parts: ServiceProfitParts;
    /** A line is shown only for the business that has ever earned or lost something */
    inUse: { manual: boolean; digital: boolean };
    /** Opens the Services page */
    onOpen?: () => void;
};

/**
 * Profit of the other businesses (design, printing, digital services…), in a card of their own,
 * so it is never read together with the profit of selling USDT and EUR.
 */
export function ServiceProfitCard({ periodTitle, parts, inUse, onOpen }: ServiceProfitCardProps) {
    const { t } = useLanguage();
    const total = serviceProfitTotal(parts);
    // The title stays short so the link fits beside it on a small phone; the period sits above the amount.
    return (<SectionCard title={t('dashboard.otherProfitsTitle') as string} actionLabel={onOpen ? t('dashboard.otherProfitsOpen') as string : undefined} onAction={onOpen} flush>
      <div className="px-4 pb-3">
        <p className="text-[13px] font-semibold text-neutral-500">{periodTitle}</p>
        <div className="mt-1">
          <CurrencyAmount value={total} currency="DZD" semantic="auto" size="xl" decimals={0}/>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{t('dashboard.otherProfitsHint') as string}</p>
      </div>
      {inUse.manual && (<ListRow title={t('dashboard.otherProfitsServices') as string} trailing={<CurrencyAmount value={parts.manual} currency="DZD" semantic="auto" size="md" decimals={0}/>}/>)}
      {inUse.digital && (<ListRow title={t('digitalServices.short') as string} trailing={<CurrencyAmount value={parts.digital} currency="DZD" semantic="auto" size="md" decimals={0}/>}/>)}
    </SectionCard>);
}
