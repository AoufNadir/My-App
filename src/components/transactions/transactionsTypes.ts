import type React from 'react';
import { Tx, ClientTransactionDzd, TreasuryTx } from '../../types';
export type TransactionFilterMode = 'all' | 'buy_usdt_dzd' | 'buy_usdt_eur' | 'buy_eur_dzd' | 'sell_usdt_dzd' | 'sell_usdt_eur' | 'sell_eur_dzd' | 'stock' | 'stock_in' | 'stock_out' | 'client_receipts' | 'client_receipts_cash' | 'client_receipts_baridi' | 'client_receipts_credit' | 'client_payouts' | 'client_payouts_cash' | 'client_payouts_baridi' | 'client_payouts_credit' | 'client_adjustments' | 'treasury_in_cash' | 'treasury_in_baridi' | 'treasury_out_cash' | 'treasury_out_baridi' | 'treasury_transfers' | 'client_transfers'
// Legacy / broad saved filters kept readable for older localStorage entries.
 | 'buy' | 'sell' | 'adjustments' | 'client_payments' | 'treasury_in' | 'treasury_out' | 'clients' | 'treasury';
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
    contextLabel?: string;
    category: 'crypto' | 'client' | 'treasury';
    rawTx: DisplayRawTx;
    actionRawTx?: DisplayRawTx;
    sourceType: TransactionSourceType;
    rightMiddleLabel?: string;
    rightBottomLabel?: string;
    rightBottomClassName?: string;
}
export interface SavedTransactionFilter {
    id: string;
    name: string;
    filterMode: TransactionFilterMode;
    startTimestamp: number | null;
    endTimestamp: number | null;
    createdAt: number;
}
