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
        return 'bg-red-50 text-red-700 border-red-100';
    }
    if (tone === 'advance') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
    if (tone === 'warning') {
        return 'bg-red-50 text-red-700 border-red-100';
    }
    if (tone === 'transfer') {
        return 'bg-sky-50 text-sky-700 border-sky-100';
    }
    if (tone === 'settled') {
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
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
