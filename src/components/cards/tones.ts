/** Couleur de la pastille d'icône, partagée par toutes les cartes. */
export type CardTone = 'dzd' | 'usdt' | 'eur' | 'profit' | 'loss' | 'debt' | 'asset' | 'primary' | 'neutral';
export const CARD_TONE_CLASS: Record<CardTone, string> = {
    dzd: 'bg-secondary/10 text-financial-dzd',
    usdt: 'bg-financial-profit-bg text-financial-usd',
    eur: 'bg-financial-asset-bg text-financial-eur',
    profit: 'bg-financial-profit-bg text-financial-profit',
    loss: 'bg-financial-loss-bg text-financial-loss',
    debt: 'bg-financial-debt-bg text-financial-debt',
    asset: 'bg-financial-asset-bg text-financial-asset',
    primary: 'bg-primary/10 text-primary dark:text-primary-light',
    neutral: 'bg-surface-muted text-neutral-600',
};
