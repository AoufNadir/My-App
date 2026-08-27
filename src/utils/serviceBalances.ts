export type ServiceBalanceKind = 'to_receive' | 'client_advance' | 'settled';
type TranslateFn = (key: string) => string;
const EPSILON = 0.005;
export function describeServiceBalance(balance: number): {
    amount: number;
    kind: ServiceBalanceKind;
} {
    const safe = Number.isFinite(balance) ? balance : 0;
    if (safe < -EPSILON) {
        return { amount: Math.abs(safe), kind: 'to_receive' };
    }
    if (safe > EPSILON) {
        return { amount: safe, kind: 'client_advance' };
    }
    return { amount: 0, kind: 'settled' };
}
export function getServiceBalanceLabel(kind: ServiceBalanceKind, t?: TranslateFn): string {
    if (t) {
        if (kind === 'to_receive')
            return t('finance.toReceive');
        if (kind === 'client_advance')
            return t('finance.clientAdvance');
        return t('finance.settled');
    }
    if (kind === 'to_receive')
        return 'À encaisser du client';
    if (kind === 'client_advance')
        return 'Solde en faveur du client';
    return 'Solde réglé';
}
