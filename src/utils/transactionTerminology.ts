type PortfolioRawType = 'buy' | 'sell' | 'Ajout Manuel' | 'Retrait Manuel' | string;
type TreasuryRawType = 'Ajout' | 'Retrait' | 'Adjustment (+)' | 'Adjustment (-)' | 'Transfer' | string;
function canonicalize(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        // Handle mojibake fragments from legacy encoded strings.
        .replace(/\u00e3[\u00a8\u00a9\u00aa]/g, 'e')
        .replace(/\u00e3\u00a7/g, 'c')
        .replace(/\u00e3[\u00a0\u00a2]/g, 'a')
        .replace(/\u00e3[\u00b9\u00bb]/g, 'u')
        .replace(/\u00e3\u00b4/g, 'o')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9+()\- ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
type TranslateFn = (key: string) => string;
// Without `t` (PDF exports) the legacy long French labels are kept; with `t`
// (on-screen ledger) labels are short so they fit on one mobile line and
// follow the active language.
export function getPortfolioOperationLabel(type: PortfolioRawType, currency?: string, t?: TranslateFn): string {
    const normalized = canonicalize(String(type || ''));
    const safeCurrency = (currency || '').trim() || 'USDT';
    if (normalized === 'buy')
        return t ? `${t('ledger.buy')} ${safeCurrency}` : `Achat ${safeCurrency} (Portefeuille)`;
    if (normalized === 'sell')
        return t ? `${t('ledger.sell')} ${safeCurrency}` : `Vente ${safeCurrency} au Client`;
    if (normalized === 'ajout manuel')
        return t ? t('ledger.adjustPlus') : 'Ajustement + Portefeuille';
    if (normalized === 'retrait manuel')
        return t ? t('ledger.adjustMinus') : 'Ajustement - Portefeuille';
    return String(type || (t ? t('ledger.portfolioOp') : 'Opération Portefeuille'));
}
export function getClientOperationLabel(type: string, t?: TranslateFn): string {
    const normalized = canonicalize(String(type || ''));
    if (normalized.includes('reglement') && normalized.includes('recu'))
        return t ? t('ledger.receipt') : 'Encaissement Client';
    if (normalized.includes('paiement') && normalized.includes('effect'))
        return t ? t('ledger.payout') : 'Décaissement Client';
    if (normalized === 'vente usdt')
        return t ? `${t('ledger.sell')} USDT` : 'Vente USDT au Client';
    if (normalized === 'vente eur')
        return t ? `${t('ledger.sell')} EUR` : 'Vente EUR au Client';
    if (normalized === 'achat eur')
        return t ? `${t('ledger.buy')} EUR` : 'Achat EUR (Portefeuille)';
    if (normalized === 'solde initial')
        return t ? t('ledger.initialBalance') : 'Solde Initial Client';
    if (normalized === 'transfert entrant')
        return t ? t('ledger.transferIn') : 'Transfert Reçu (Clients)';
    if (normalized === 'transfert sortant')
        return t ? t('ledger.transferOut') : 'Transfert Envoyé (Clients)';
    if (normalized === 'ajustement solde')
        return t ? t('ledger.balanceFix') : 'Correction Solde Client';
    return String(type || (t ? t('ledger.clientOp') : 'Opération Client'));
}
export function getTreasuryOperationLabel(type: TreasuryRawType, t?: TranslateFn): string {
    const normalized = canonicalize(String(type || ''));
    if (normalized === 'ajout')
        return t ? t('ledger.treasuryIn') : 'Entrée Trésorerie';
    if (normalized === 'retrait')
        return t ? t('ledger.treasuryOut') : 'Sortie Trésorerie';
    if (normalized === 'adjustment (+)' || normalized === 'adjustment +')
        return t ? `${t('ledger.adjustPlus')}` : 'Ajustement + Trésorerie';
    if (normalized === 'adjustment (-)' || normalized === 'adjustment -')
        return t ? `${t('ledger.adjustMinus')}` : 'Ajustement - Trésorerie';
    if (normalized === 'transfer')
        return t ? t('ledger.internalTransfer') : 'Virement Interne (Caisse <-> Baridi)';
    return String(type || (t ? t('ledger.treasuryOp') : 'Opération Trésorerie'));
}
