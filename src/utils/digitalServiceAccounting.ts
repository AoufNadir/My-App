import { isTradeCurrency, type TradeCurrencyCode } from '../currency/tradeCurrencies';
export type CashWallet = 'Caisse' | 'BaridiMob';
/** V13-5: RMB (Alipay) is a wallet like USDT and EUR. */
export type AssetWallet = TradeCurrencyCode;
export type FinancialWallet = CashWallet | AssetWallet;
export type DigitalServiceSaleWallet = FinancialWallet | 'Credit';
export type WalletCurrency = 'DZD' | AssetWallet;

export type WalletRates = {
    usdtPma: number;
    eurPma: number;
    /** V13-5: RMB average price (0 = none in stock) */
    rmbPma?: number;
    /** V14-4: the average price of every extra currency (RMB and the next ones), by code */
    pmaByCurrency?: Partial<Record<string, number>>;
};

export type DigitalServicePreviewInput = {
    purchaseWallet: FinancialWallet;
    purchaseAmount: number;
    saleWallet: DigitalServiceSaleWallet;
    saleAmount: number;
    rates: WalletRates;
};

export type DigitalServicePreview = {
    purchaseCurrency: WalletCurrency;
    saleCurrency: WalletCurrency;
    purchaseRateToDzd: number;
    saleRateToDzd: number;
    purchaseAmountDzd: number;
    saleAmountDzd: number;
    profitDzd: number;
};

export type ProjectExpensePreviewInput = {
    wallet: FinancialWallet;
    amount: number;
    rates: WalletRates;
};

export type ProjectExpensePreview = {
    currency: WalletCurrency;
    rateToDzd: number;
    amountDzd: number;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function getWalletCurrency(wallet: DigitalServiceSaleWallet): WalletCurrency {
    if (isTradeCurrency(wallet)) return wallet;
    return 'DZD';
}

export function getWalletRateToDzd(wallet: DigitalServiceSaleWallet, rates: WalletRates): number {
    if (wallet === 'USDT') return Number(rates.usdtPma || 0);
    if (wallet === 'EUR') return Number(rates.eurPma || 0);
    if (isTradeCurrency(wallet)) return Number(rates.pmaByCurrency?.[wallet] ?? (wallet === 'RMB' ? rates.rmbPma : 0) ?? 0);
    return 1;
}

export function computeWalletAmountDzd(wallet: DigitalServiceSaleWallet, amount: number, rates: WalletRates): {
    currency: WalletCurrency;
    rateToDzd: number;
    amountDzd: number;
} {
    const safeAmount = Number(amount || 0);
    const rateToDzd = getWalletRateToDzd(wallet, rates);
    return {
        currency: getWalletCurrency(wallet),
        rateToDzd,
        amountDzd: round2(safeAmount * rateToDzd),
    };
}

export function computeDigitalServicePreview(input: DigitalServicePreviewInput): DigitalServicePreview {
    const purchase = computeWalletAmountDzd(input.purchaseWallet, input.purchaseAmount, input.rates);
    const sale = computeWalletAmountDzd(input.saleWallet, input.saleAmount, input.rates);
    return {
        purchaseCurrency: purchase.currency,
        saleCurrency: sale.currency,
        purchaseRateToDzd: purchase.rateToDzd,
        saleRateToDzd: sale.rateToDzd,
        purchaseAmountDzd: purchase.amountDzd,
        saleAmountDzd: sale.amountDzd,
        profitDzd: round2(sale.amountDzd - purchase.amountDzd),
    };
}

export function computeProjectExpensePreview(input: ProjectExpensePreviewInput): ProjectExpensePreview {
    const expense = computeWalletAmountDzd(input.wallet, input.amount, input.rates);
    return {
        currency: expense.currency,
        rateToDzd: expense.rateToDzd,
        amountDzd: expense.amountDzd,
    };
}

export function isAssetWallet(wallet: DigitalServiceSaleWallet): wallet is AssetWallet {
    return isTradeCurrency(wallet);
}

/** USDT or EUR: the wallets the read-model and shadow diagnostics know (RMB is left out of them, they are off in the app). */
export function isLegacyAssetWallet(wallet: DigitalServiceSaleWallet): wallet is 'USDT' | 'EUR' {
    return wallet === 'USDT' || wallet === 'EUR';
}

/** V13-5: what an asset wallet holds now, from the portfolio stats (RMB under `rmb`). */
export function assetWalletStats(stats: { usdt: { available?: number; avgBuy?: number }; eur: { available?: number; avgBuy?: number }; rmb?: { available?: number; avgBuy?: number } }, wallet: AssetWallet): { available: number; avgBuy: number } {
    // V14-4: each currency of the list under its lower-case code (usdt, eur, rmb, and the next ones).
    const row = (stats as Record<string, { available?: number; avgBuy?: number } | undefined>)[wallet.toLowerCase()];
    return { available: Number(row?.available || 0), avgBuy: Number(row?.avgBuy || 0) };
}

export function isCashWallet(wallet: DigitalServiceSaleWallet): wallet is CashWallet {
    return wallet === 'Caisse' || wallet === 'BaridiMob';
}
