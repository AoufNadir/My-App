import type React from 'react';
import { Tx, ClientTransactionDzd, TreasuryTx } from '../../types';

export type TransactionFilterMode = 'all' | 'buy' | 'sell' | 'adjustments' | 'clients' | 'treasury';
export type TransactionSourceType = 'usdt_tx' | 'client_tx' | 'treasury_tx';
export type DisplayRawTx = Tx | ClientTransactionDzd | TreasuryTx;

export interface DisplayTx {
  id: string;
  originalId: string;
  timestamp: number;
  date: string;
  time: string;
  typeLabel: string;
  amountLabel: string;
  amountColor: string;
  icon: React.ReactNode;
  details: string;
  category: 'crypto' | 'client' | 'treasury';
  rawTx: DisplayRawTx;
  sourceType: TransactionSourceType;
}

export interface SavedTransactionFilter {
  id: string;
  name: string;
  filterMode: TransactionFilterMode;
  startTimestamp: number | null;
  endTimestamp: number | null;
  createdAt: number;
}
