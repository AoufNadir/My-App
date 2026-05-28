function canonicalize(raw) {
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
export function getPortfolioOperationLabel(type, currency) {
    const normalized = canonicalize(String(type || ''));
    const safeCurrency = (currency || '').trim() || 'USDT';
    if (normalized === 'buy')
        return `Achat ${safeCurrency} (Portefeuille)`;
    if (normalized === 'sell')
        return `Vente ${safeCurrency} au Client`;
    if (normalized === 'ajout manuel')
        return 'Ajustement + Portefeuille';
    if (normalized === 'retrait manuel')
        return 'Ajustement - Portefeuille';
    return String(type || 'Operation Portefeuille');
}
export function getClientOperationLabel(type) {
    const normalized = canonicalize(String(type || ''));
    if (normalized.includes('reglement') && normalized.includes('recu'))
        return 'Encaissement Client';
    if (normalized.includes('paiement') && normalized.includes('effect'))
        return 'Decaissement Client';
    if (normalized === 'vente usdt')
        return 'Vente USDT au Client';
    if (normalized === 'vente eur')
        return 'Vente EUR au Client';
    if (normalized === 'achat eur')
        return 'Achat EUR (Portefeuille)';
    if (normalized === 'solde initial')
        return 'Solde Initial Client';
    if (normalized === 'transfert entrant')
        return 'Transfert Recu (Clients)';
    if (normalized === 'transfert sortant')
        return 'Transfert Envoye (Clients)';
    if (normalized === 'ajustement solde')
        return 'Correction Solde Client';
    return String(type || 'Operation Client');
}
export function getTreasuryOperationLabel(type) {
    const normalized = canonicalize(String(type || ''));
    if (normalized === 'ajout')
        return 'Entree Tresorerie';
    if (normalized === 'retrait')
        return 'Sortie Tresorerie';
    if (normalized === 'adjustment (+)' || normalized === 'adjustment +')
        return 'Ajustement + Tresorerie';
    if (normalized === 'adjustment (-)' || normalized === 'adjustment -')
        return 'Ajustement - Tresorerie';
    if (normalized === 'transfer')
        return 'Virement Interne (Caisse <-> Baridi)';
    return String(type || 'Operation Tresorerie');
}
