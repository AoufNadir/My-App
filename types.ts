export interface Tx {
  id: string;
  type: 'buy' | 'sell' | 'Ajout Manuel' | 'Retrait Manuel';
  quantity: number;
  price?: number;
  sell?: number;
  total?: number;
  profit?: number;
  date: string;
  time: string;
  timestamp: number;
  notes?: string;
  currency: 'USDT' | 'EUR';
  paymentMethod?: 'Espèces' | 'BaridiMob' | 'Crédit';
}

export interface ClientDzd {
  id: string;
  fullName: string;
  phone?: string;
  redotpayId?: string;
  binanceEmail?: string;
  nom?: string; // Legacy support
  prenom?: string; // Legacy support
}

export interface ClientTransactionDzd {
  id: string;
  clientId: string;
  timestamp: number;
  date: string;
  time: string;
  montant: number; // Positive = Credit (Advance), Negative = Debt
  type: 'Règlement Reçu' | 'Paiement Effectué' | 'Vente USDT' | 'Achat EUR' | 'Solde Initial' | 'Transfert Entrant' | 'Transfert Sortant';
  notes?: string;
  linkedTxId?: string; // ID of the USDT/EUR transaction if applicable
  paymentMethod?: 'Espèces' | 'BaridiMob' | 'Crédit';
}

export interface TreasuryTx {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  type: 'Ajout' | 'Retrait';
  source: 'Caisse' | 'BaridiMob';
  amount: number;
  notes?: string;
  linkedTxId?: string;
}

export interface TreasuryCard {
  id: string;
  name: string;
  value: number;
}