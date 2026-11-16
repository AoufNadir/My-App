import { createContext, useContext } from 'react';

// V15-4: for the settings, what each dinar account holds and whether any movement ever used it (read only).
export type AccountUsage = { ready: boolean; byId: Record<string, { balance: number; used: boolean }> };
export const AccountUsageContext = createContext<AccountUsage>({ ready: false, byId: {} });
export const useAccountUsage = () => useContext(AccountUsageContext);
