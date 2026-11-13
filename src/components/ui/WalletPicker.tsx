import React from 'react';
import { useCurrencyShown } from '../../contexts/CurrencyVisibilityContext';

// V13-5: the wallet a payment comes from (or goes to), one row per wallet, under one another: any number of
// currencies fits, no empty half-row. Each row shows what the wallet holds. Nothing is chosen for the owner (rule 11);
// a hidden currency is not offered, unless it is the one already saved on the operation being edited.

export type PickerWallet = 'Caisse' | 'BaridiMob' | 'USDT' | 'EUR' | 'RMB' | 'Credit';
export type WalletBalances = Partial<Record<PickerWallet, number>>;
const UNIT: Record<PickerWallet, string> = { Caisse: 'DZD', BaridiMob: 'DZD', USDT: 'USDT', EUR: 'EUR', RMB: 'RMB', Credit: '' };

export function WalletPicker({ value, onChange, wallets, labels, balances, ariaLabel, chooseLabel }: {
    value: PickerWallet | null;
    onChange: (wallet: PickerWallet) => void;
    wallets: PickerWallet[];
    labels: Partial<Record<PickerWallet, string>>;
    balances?: WalletBalances;
    ariaLabel: string;
    /** Said under the list while nothing is chosen */
    chooseLabel?: string;
}) {
    const isShown = useCurrencyShown();
    // V14-2: any hidden currency of the list leaves, unless it is the one already chosen.
    const shown = wallets.filter((wallet) => !(wallet === 'USDT' || wallet === 'EUR' || wallet === 'RMB') || isShown(wallet) || value === wallet);
    const n = (amount: number, unit: string) => `${amount.toLocaleString('fr-FR', { minimumFractionDigits: unit === 'DZD' ? 0 : 2, maximumFractionDigits: 2 })} ${unit}`;
    return (<div>
      <div role="radiogroup" aria-label={ariaLabel} className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {shown.map((wallet) => {
            const on = value === wallet;
            const balance = balances?.[wallet];
            return (<button key={wallet} type="button" role="radio" aria-checked={on} onClick={() => onChange(wallet)} className={`flex min-h-12 w-full items-center gap-3 px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${on ? 'bg-primary/5' : 'hover:bg-surface-muted'}`}>
                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-primary' : 'border-border-strong'}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-primary"/>}</span>
                <span className={`min-w-0 flex-1 text-sm font-semibold ${on ? 'text-primary' : 'text-neutral-900'}`}>{labels[wallet] ?? wallet}</span>
                {balance !== undefined && UNIT[wallet] && <bdi dir="ltr" className="shrink-0 text-xs tabular-nums text-neutral-500">{n(balance, UNIT[wallet])}</bdi>}
              </button>);
        })}
      </div>
      {!value && chooseLabel && <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">{chooseLabel}</p>}
    </div>);
}

/** What each wallet holds: the cash box and BaridiMob from the treasury, USDT, EUR and RMB from the stock. */
export function walletBalancesOf(treasuryStats: { caisse?: number; baridi?: number }, portfolioStats: { usdt: { available?: number }; eur: { available?: number }; rmb?: { available?: number } }): WalletBalances {
    return {
        Caisse: Number(treasuryStats.caisse || 0),
        BaridiMob: Number(treasuryStats.baridi || 0),
        USDT: Number(portfolioStats.usdt.available || 0),
        EUR: Number(portfolioStats.eur.available || 0),
        RMB: Number(portfolioStats.rmb?.available || 0),
    };
}
export const FINANCIAL_WALLETS: PickerWallet[] = ['Caisse', 'BaridiMob', 'USDT', 'EUR', 'RMB'];
