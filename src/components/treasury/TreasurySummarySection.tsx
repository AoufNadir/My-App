import { ListRow, SectionCard, StatTile } from '../cards';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { WalletIcon } from '../icons/WalletIcon';
import { LandmarkIcon } from '../icons/LandmarkIcon';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { LayoutGridIcon } from '../icons/LayoutGridIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { useLanguage } from '../../contexts/LanguageContext';
type TreasurySummarySectionProps = {
    caisseBalance: number;
    baridiBalance: number;
    dettesAbs: number;
    totalAvances: number;
    servicesCapitalImpact?: number;
    openTreasuryBalanceEditModal: (asset: 'Caisse' | 'BaridiMob') => void;
    openDeliveryExpenseModal?: () => void;
    deliveryExpenseLabel?: string;
    onOpenServices?: () => void;
};
/**
 * The two cash balances as tiles (a tap corrects them), then what clients and service clients
 * owe or hold, each shown when it is not zero. The investors' share is in the card above.
 */
export function TreasurySummarySection({ caisseBalance, baridiBalance, dettesAbs, totalAvances, servicesCapitalImpact = 0, openTreasuryBalanceEditModal, openDeliveryExpenseModal, deliveryExpenseLabel, onOpenServices }: TreasurySummarySectionProps) {
    const { t } = useLanguage();
    const shouldShowAmount = (value: number) => Math.abs(Number(value) || 0) > 0.005;
    const showReceivables = shouldShowAmount(dettesAbs);
    const showAdvances = shouldShowAmount(totalAvances);
    const showServices = shouldShowAmount(servicesCapitalImpact);
    return (<>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label={t('common.caisseBalance') as string} value={caisseBalance} icon={<WalletIcon className="h-3.5 w-3.5"/>} tone="dzd" onEdit={() => openTreasuryBalanceEditModal('Caisse')} editLabel={t('common.edit') as string}/>
        <StatTile label={t('common.baridiBalance') as string} value={baridiBalance} icon={<LandmarkIcon className="h-3.5 w-3.5"/>} tone="dzd" onEdit={() => openTreasuryBalanceEditModal('BaridiMob')} editLabel={t('common.edit') as string}/>
      </div>

      {(showReceivables || showAdvances || showServices) && (<SectionCard title={t('treasury.clientPositions')} flush>
          {showReceivables && (<ListRow icon={<ArrowDownLeftIcon className="h-5 w-5"/>} tone="profit" title={t('finance.toReceive') as string} subtitle={t('finance.receivablesHint') as string} wrapSubtitle trailing={<CurrencyAmount value={dettesAbs} currency="DZD" semantic="profit" size="md" decimals={0}/>}/>)}
          {showAdvances && (<ListRow icon={<ArrowUpRightIcon className="h-5 w-5"/>} tone="loss" title={t('finance.clientAdvance') as string} subtitle={t('finance.advancesHint') as string} wrapSubtitle trailing={<CurrencyAmount value={totalAvances} currency="DZD" semantic="loss" size="md" decimals={0}/>}/>)}
          {showServices && (<ListRow icon={<LayoutGridIcon className="h-5 w-5"/>} tone="primary" title={t('nav.services') as string} subtitle={t('finance.servicesNetPosition') as string} wrapSubtitle trailing={<CurrencyAmount value={servicesCapitalImpact} currency="DZD" semantic="auto" size="md" decimals={0}/>} onClick={onOpenServices}/>)}
        </SectionCard>)}

      {openDeliveryExpenseModal && (<ListRow standalone icon={<PlusIcon className="h-5 w-5"/>} tone="primary" title={deliveryExpenseLabel || t('delivery.addExpense') as string} onClick={openDeliveryExpenseModal}/>)}
    </>);
}
