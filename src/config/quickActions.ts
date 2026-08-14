export type QuickActionId =
  | 'sell_usdt'
  | 'buy_usdt'
  | 'sell_eur'
  | 'buy_eur'
  | 'client_settlement'
  | 'treasury_adjustment'
  | 'expense';

export type QuickActionConfig = {
  id: QuickActionId;
  labelKey: string;
  descriptionKey: string;
  tone: 'sell' | 'buy' | 'client' | 'treasury' | 'expense';
};

export const QUICK_ACTIONS: QuickActionConfig[] = [
  { id: 'sell_usdt', labelKey: 'quickActions.sellUsdt', descriptionKey: 'quickActions.sellUsdtDescription', tone: 'sell' },
  { id: 'buy_usdt', labelKey: 'quickActions.buyUsdt', descriptionKey: 'quickActions.buyUsdtDescription', tone: 'buy' },
  { id: 'sell_eur', labelKey: 'quickActions.sellEur', descriptionKey: 'quickActions.sellEurDescription', tone: 'sell' },
  { id: 'buy_eur', labelKey: 'quickActions.buyEur', descriptionKey: 'quickActions.buyEurDescription', tone: 'buy' },
  { id: 'client_settlement', labelKey: 'quickActions.clientSettlement', descriptionKey: 'quickActions.clientSettlementDescription', tone: 'client' },
  { id: 'treasury_adjustment', labelKey: 'quickActions.treasuryAdjustment', descriptionKey: 'quickActions.treasuryAdjustmentDescription', tone: 'treasury' },
  { id: 'expense', labelKey: 'quickActions.expense', descriptionKey: 'quickActions.expenseDescription', tone: 'expense' },
];
