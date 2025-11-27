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

// ===== Manual Assets System =====

export interface ManualAsset {
  id: string;
  name: string; // "Conception", "Printing", etc.
  description?: string;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
}

export interface ManualAssetClient {
  id: string;
  assetId: string; // Foreign key to manual_assets
  fullName: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type ManualAssetTransactionType =
  | 'service'
  | 'payment_received'
  | 'payment_made'
  | 'adjustment'
  | 'invoice';

export interface ManualAssetTransaction {
  id: string;
  assetId: string; // Foreign key to manual_assets
  clientId: string; // Foreign key to manual_asset_clients
  type: ManualAssetTransactionType;
  serviceType?: string; // "Design", "Impression", "Branding", etc. (when type = 'service')
  amount: number; // Positive for income, negative for expense
  date: string; // DD/MM/YYYY
  time: string; // HH:MM
  timestamp: number;
  notes?: string;
  paymentMethod?: 'cash' | 'baridi' | 'credit';
  runningBalance?: number; // Balance after this transaction (for client within asset)
}