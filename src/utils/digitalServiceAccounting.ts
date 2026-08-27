export type CashWallet = 'Caisse' | 'BaridiMob';
export type AssetWallet = 'USDT' | 'EUR';
export type FinancialWallet = CashWallet | AssetWallet;
export type DigitalServiceSaleWallet = FinancialWallet | 'Credit';
export type WalletCurrency = 'DZD' | AssetWallet;

export type WalletRates = {
    usdtPma: number;
    eurPma: number;
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
    if (wallet === 'USDT' || wallet === 'EUR') return wallet;
    return 'DZD';
}

export function getWalletRateToDzd(wallet: DigitalServiceSaleWallet, rates: WalletRates): number {
    if (wallet === 'USDT') return Number(rates.usdtPma || 0);
    if (wallet === 'EUR') return Number(rates.eurPma || 0);
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
    return wallet === 'USDT' || wallet === 'EUR';
}

export function isCashWallet(wallet: DigitalServiceSaleWallet): wallet is CashWallet {
    return wallet === 'Caisse' || wallet === 'BaridiMob';
}
