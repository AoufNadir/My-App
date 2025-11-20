
export type Tx = {
  id?: string; // Firestore ID
  timestamp: number;
  type: 'buy' | 'sell' | 'Ajout Manuel' | 'Retrait Manuel';
  currency: 'USDT' | 'EUR';
  quantity: number; // Renamed from 'usd'
  price?: number; // for buy rows (DZD per USDT)
  sell?: number;  // for sell rows (DZD per USDT)
  total?: number; // for buy rows (cost)
  profit?: number; // for sell rows
  date: string;
  time: string;
  notes?: string; // Optional notes for the transaction
  paymentMethod?: 'Espèces' | 'BaridiMob' | 'Crédit'; // NEW
};

// NEW types for DZD Client Management
export type ClientDzd = {
  id: string;
  fullName: string;
  phone?: string;
  redotpayId?: string;
  binanceEmail?: string;
  // For backward compatibility
  nom?: string;
  prenom?: string; // Optional first name
};

export type ClientTransactionDzd = {
  id: string;
  clientId: string;
  timestamp: number;
  date: string;
  time: string;
  type: 'Dépôt' | 'Retrait' | 'Vente USDT' | 'Autre' | 'Solde Initial' | 'Règlement Reçu' | 'Paiement Effectué' | 'Transfert Entrant' | 'Transfert Sortant';
  montant: number; // Can be positive (Dépôt) or negative (Retrait)
  notes?: string;
  linkedTxId?: string; // Renamed from linkedUsdtTxId to be generic
  paymentMethod?: 'Espèces' | 'BaridiMob' | 'Crédit'; // NEW
};

// NEW type for Treasury System
export type TreasuryTx = {
  id?: string;
  timestamp: number;
  date: string;
  time: string;
  type: 'Ajout' | 'Retrait';
  source: 'Caisse' | 'BaridiMob';
  amount: number;
  notes?: string;
};