import { SectionCard, CARD_TONE_CLASS } from '../cards';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { PlusIcon } from '../icons/PlusIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { Trash2Icon } from '../icons/Trash2Icon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { TreasuryCard } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
type TreasuryCollectionsSectionProps = {
    treasuryCards: TreasuryCard[];
    openTreasuryCardModal: (card?: TreasuryCard) => void;
    setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
};
/** Balances kept outside the Caisse and BaridiMob (safe, account, card): a tap edits one, the bin deletes it. */
export function TreasuryCollectionsSection({ treasuryCards, openTreasuryCardModal, setTreasuryCardToDelete }: TreasuryCollectionsSectionProps) {
    const { t } = useLanguage();
    const visibleCards = treasuryCards.filter((card) => Math.abs(Number(card.value) || 0) > 0.005);
    const addButton = (<Button onClick={() => openTreasuryCardModal()} variant="ghost" size="sm" className="gap-1 px-2 font-bold text-primary dark:text-primary-light">
      <PlusIcon className="h-4 w-4"/>
      {t('transactions.add')}
    </Button>);
    return (<SectionCard title={t('finance.treasuryCards')} actions={visibleCards.length > 0 ? addButton : undefined} flush>
      {visibleCards.length > 0 ? visibleCards.map((card) => (<div key={card.id} className="flex items-center border-t border-border first:border-t-0">
          <button type="button" onClick={() => openTreasuryCardModal(card)} aria-label={`${t('common.edit')} : ${card.name}`} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-3 ps-4 pe-1 text-start transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
            <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS.asset}`}>
              <CreditCardIcon className="h-5 w-5"/>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-neutral-900">{card.name}</span>
                <PencilIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-neutral-400"/>
              </span>
              {card.notes?.trim() && <span className="mt-0.5 block whitespace-pre-line break-words text-xs text-neutral-500">{card.notes}</span>}
            </span>
            <CurrencyAmount value={Number(card.value) || 0} currency="DZD" semantic="plain" size="md" className="shrink-0"/>
          </button>
          <button type="button" onClick={() => setTreasuryCardToDelete(card)} aria-label={`${t('common.delete')} : ${card.name}`} className="me-1 flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Trash2Icon className="h-4 w-4"/>
          </button>
        </div>)) : (<EmptyState icon={<CreditCardIcon className="h-5 w-5"/>} title={t('treasury.cardsEmptyTitle') as string} subtitle={t('treasury.cardsEmptyHint') as string} action={(<Button onClick={() => openTreasuryCardModal()} size="md" className="gap-1.5 font-bold">
            <PlusIcon className="h-4 w-4"/>
            {t('transactions.add')}
          </Button>)} className="min-h-0 py-6"/>)}
    </SectionCard>);
}
