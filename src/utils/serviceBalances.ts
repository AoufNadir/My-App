export type ServiceBalanceKind = 'to_receive' | 'client_advance' | 'settled';
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
export function getServiceBalanceLabel(kind: ServiceBalanceKind): string {
    if (kind === 'to_receive')
        return 'À recevoir';
    if (kind === 'client_advance')
        return 'Avance client';
    return 'Solde';
}
