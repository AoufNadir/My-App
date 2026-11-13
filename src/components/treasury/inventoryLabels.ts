import type { MoneyCurrency } from '../../pages/shared/pageFormat';
import type { InventoryAccount } from '../../utils/inventoryCheck';

// V14-4: the name and unit of each wallet counted in the inventory: the two cash wallets, the historical ones with
// their own words, and any other currency of the list by its code (« Portefeuille GBP »).
const KNOWN: Partial<Record<InventoryAccount, string>> = {
    caisse: 'inventory.accountCaisse',
    baridi: 'inventory.accountBaridi',
    usdt: 'inventory.accountUsdt',
    eur: 'inventory.accountEur',
    rmb: 'inventory.accountRmb',
};
export function inventoryAccountLabel(t: (key: string) => unknown, account: InventoryAccount): string {
    const key = KNOWN[account];
    return key ? String(t(key)) : String(t('inventory.accountCurrency')).replace('{c}', account.toUpperCase());
}
export const inventoryAccountCurrency = (account: InventoryAccount): MoneyCurrency => (account === 'caisse' || account === 'baridi' ? 'DZD' : account.toUpperCase() as MoneyCurrency);
