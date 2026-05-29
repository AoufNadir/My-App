export type FinancialTone = 'receive' | 'advance' | 'settled' | 'warning' | 'transfer' | 'neutral';
export type BalanceReading = {
    labelKey: string;
    shortKey: string;
    tone: FinancialTone;
    amount: number;
    semantic: 'profit' | 'loss' | 'plain';
};
export function getClientBalanceReading(balance: number): BalanceReading {
    const normalized = Math.abs(balance) < 0.005 ? 0 : balance;
    if (normalized < 0) {
        return {
            labelKey: 'finance.toReceive',
            shortKey: 'finance.debt',
            tone: 'receive',
            amount: Math.abs(normalized),
            semantic: 'profit',
        };
    }
    if (normalized > 0) {
        return {
            labelKey: 'finance.clientAdvance',
            shortKey: 'finance.advance',
            tone: 'advance',
            amount: normalized,
            semantic: 'loss',
        };
    }
    return {
        labelKey: 'finance.settled',
        shortKey: 'finance.settledShort',
        tone: 'settled',
        amount: 0,
        semantic: 'plain',
    };
}
export function getToneClass(tone: FinancialTone) {
    if (tone === 'receive') {
        return 'bg-financial-loss-bg text-financial-loss border-financial-loss/30';
    }
    if (tone === 'advance') {
        return 'bg-financial-profit-bg text-financial-profit border-financial-profit/30';
    }
    if (tone === 'warning') {
        return 'bg-danger-bg text-danger border-danger/30';
    }
    if (tone === 'transfer') {
        return 'bg-info-bg text-info border-info/30';
    }
    if (tone === 'settled') {
        return 'bg-surface-muted text-neutral-600 border-border';
    }
    return 'bg-surface text-neutral-600 border-border';
}
export function normalizeLedgerLabel(value: string) {
    return value
        .replace(/RÃ¨glement ReÃ§u/g, 'Règlement Reçu')
        .replace(/Paiement EffectuÃ©/g, 'Paiement Effectué')
        .replace(/Tresorerie/g, 'Trésorerie')
        .replace(/Operations/g, 'Opérations')
        .replace(/Quantite/g, 'Quantité')
        .replace(/Resume/g, 'Résumé');
}
export function getFirstValidationMessage(errors: Record<string, string> | undefined, fallback: string) {
    if (!errors)
        return fallback;
    const first = Object.values(errors).find(Boolean);
    return first || fallback;
}
