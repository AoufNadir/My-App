import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { SectionHeading } from '../ui/SectionHeading';
import { FinancialMetricCard } from '../ui/FinancialMetricCard';
import { PlusIcon } from '../icons/PlusIcon';
import { Trash2Icon } from '../icons/Trash2Icon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { TreasuryCard } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
type TreasuryCollectionsSectionProps = {
    treasuryCards: TreasuryCard[];
    openTreasuryCardModal: (card?: TreasuryCard) => void;
    setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
};
export function TreasuryCollectionsSection({ treasuryCards, openTreasuryCardModal, setTreasuryCardToDelete }: TreasuryCollectionsSectionProps) {
    const { t } = useLanguage();
    const visibleCards = treasuryCards.filter((card) => Math.abs(Number(card.value) || 0) > 0.005);
    return (<Card>
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
        <SectionHeading icon={<CreditCardIcon className="w-4 h-4"/>}>
          {t('finance.treasuryCards')}
        </SectionHeading>
        <Button onClick={() => openTreasuryCardModal()} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold">
          <PlusIcon className="w-4 h-4"/> {t('transactions.add')}
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {visibleCards.length > 0 ? (<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleCards.map((card) => (<FinancialMetricCard key={card.id} label={card.name} value={Number(card.value) || 0} tone="stock" icon={<CreditCardIcon className="h-4 w-4"/>} onEdit={() => openTreasuryCardModal(card)} meta={(<div className="space-y-3">
                    {card.notes?.trim() && (<div className="rounded-lg border border-border bg-surface-muted p-3">
                        <p className="text-xs font-medium text-neutral-500">
                          {t('common.notes')}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-neutral-700">
                          {card.notes}
                        </p>
                      </div>)}
                    <button type="button" onClick={() => setTreasuryCardToDelete(card)} className="inline-flex min-h-touch items-center gap-2 rounded-lg bg-danger-bg px-3 text-xs font-bold text-danger transition-colors hover:bg-danger/10">
                      <Trash2Icon className="h-4 w-4"/>
                      {t('common.delete')}
                    </button>
                  </div>)}/>))}
          </div>) : (<div className="rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-neutral-400">
            {t('transactions.noTransactions')}
          </div>)}
      </CardContent>
    </Card>);
}
