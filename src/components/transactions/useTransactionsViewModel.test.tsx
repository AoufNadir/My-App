import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, DigitalServiceTransaction } from '../../types';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { formatDzd, formatNumber } from '../../pages/shared/pageFormat';
import { getClientOperationLabel, getClientTransferDetails, getManualClientNote, getPortfolioOperationLabel, getTreasuryOperationLabel } from '../../utils/transactionTerminology';
import { translations } from '../../translations';
import { reorderClientName } from '../../utils/nameUtils';
import type { DisplayRawTx, DisplayTx, TransactionFilterMode } from './transactionsTypes';
import { buildClientTransferIndex, findClientTransferCounterpart } from './clientTransferIndex';
import { useTransactionsViewModel } from './useTransactionsViewModel';
import { TransactionsPage } from '../../pages/TransactionsPage';

// The operations list now builds each row's labels, amounts, names and icon only when the row is
// read, and keeps the last full list for the next opening of the page. This test checks that the
// rows, their order, their text and the filter counters are exactly those of the previous code.

// ---- Reference: the list builder before that change (V1-7, commit 021654b), copied verbatim ----
const ALL_FILTER_MODES: TransactionFilterMode[] = [
    'all',
    'buy_usdt_dzd',
    'buy_usdt_eur',
    'buy_eur_dzd',
    'sell_usdt_dzd',
    'sell_usdt_eur',
    'sell_eur_dzd',
    'stock',
    'stock_in',
    'stock_out',
    'client_receipts',
    'client_receipts_cash',
    'client_receipts_baridi',
    'client_receipts_credit',
    'client_payouts',
    'client_payouts_cash',
    'client_payouts_baridi',
    'client_payouts_credit',
    'client_adjustments',
    'client_transfers',
    'treasury_in_cash',
    'treasury_in_baridi',
    'treasury_out_cash',
    'treasury_out_baridi',
    'treasury_transfers',
    'buy',
    'sell',
    'adjustments',
    'client_payments',
    'treasury_in',
    'treasury_out',
    'clients',
    'treasury'
];
function isCryptoBuy(rawTx: DisplayRawTx): rawTx is Tx {
    return (rawTx as Tx).type === 'buy';
}
function isCryptoSell(rawTx: DisplayRawTx): rawTx is Tx {
    return (rawTx as Tx).type === 'sell';
}
function isCryptoManual(rawTx: DisplayRawTx): rawTx is Tx {
    const type = (rawTx as Tx).type;
    return type === 'Ajout Manuel' || type === 'Retrait Manuel';
}
function isClientTransfer(rawTx: DisplayRawTx) {
    const type = (rawTx as ClientTransactionDzd).type;
    return type === 'Transfert Entrant' || type === 'Transfert Sortant';
}
function isClientTxLinkedToPortfolio(tx: ClientTransactionDzd, portfolioTxIds: Set<string>) {
    return Boolean(tx.linkedTxId && portfolioTxIds.has(tx.linkedTxId));
}
function isClientTxLinkedToClient(tx: ClientTransactionDzd, clientTxIds: Set<string>) {
    return Boolean(tx.linkedTxId && clientTxIds.has(tx.linkedTxId));
}
function isInternalTreasuryEffect(tx: TreasuryTx) {
    const normalizedNotes = normalizeText(tx.notes);
    const isLinkedPortfolioTreasuryEffect = Boolean(tx.linkedTxId)
        && (
            tx.origin === 'usdt_tx'
            || tx.origin === 'client_tx'
            || normalizedNotes.startsWith('achat ')
            || normalizedNotes.startsWith('vente ')
        );
    return isLinkedPortfolioTreasuryEffect
        || Boolean(tx.linkedAssetTxId && tx.origin === 'manual_asset')
        || Boolean(tx.linkedDigitalServiceTxId && tx.origin === 'digital_service_sale')
        || tx.origin === 'personal_expense_return';
}
function getTreasuryEffectDirection(tx: TreasuryTx) {
    return tx.type === 'Ajout' || tx.type === 'Adjustment (+)' ? 'in' : 'out';
}
function getTreasuryEffectWallet(tx: TreasuryTx) {
    const data = tx as TreasuryTx & { asset?: string };
    return data.source || data.destination || data.asset || '';
}
function isTreasuryTransfer(rawTx: DisplayRawTx) {
    const tx = rawTx as TreasuryTx;
    return tx.type === 'Transfer' || Boolean(tx.notes?.includes('Virement'));
}
function isTreasuryEntry(rawTx: DisplayRawTx): rawTx is TreasuryTx {
    const tx = rawTx as TreasuryTx;
    return !isTreasuryTransfer(tx) && (tx.type === 'Ajout' || tx.type === 'Adjustment (+)');
}
function isTreasuryExit(rawTx: DisplayRawTx): rawTx is TreasuryTx {
    const tx = rawTx as TreasuryTx;
    return !isTreasuryTransfer(tx) && (tx.type === 'Retrait' || tx.type === 'Adjustment (-)');
}
function normalizeText(value?: string) {
    return (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function compactText(value?: string) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}
function normalizePaymentMethod(value?: string): 'cash' | 'baridi' | 'credit' | null {
    const normalized = normalizeText(value);
    const compact = compactText(value);
    if (!normalized)
        return null;
    if (normalized.includes('baridi'))
        return 'baridi';
    if (normalized.includes('espe') || normalized.includes('cash') || normalized.includes('caisse'))
        return 'cash';
    if (normalized.includes('credit') || compact.includes('crdit'))
        return 'credit';
    return null;
}
function getTreasuryWallet(rawTx: TreasuryTx): 'cash' | 'baridi' | null {
    const tx = rawTx as TreasuryTx & {
        asset?: string;
    };
    const normalized = normalizeText([tx.source, tx.asset].filter(Boolean).join(' '));
    if (normalized.includes('baridi'))
        return 'baridi';
    if (normalized.includes('caisse') || normalized.includes('cash'))
        return 'cash';
    return null;
}
function isClientReceipt(rawTx: ClientTransactionDzd) {
    const normalizedType = normalizeText(rawTx.type);
    if (isClientAdjustment(rawTx) || isClientTransfer(rawTx))
        return false;
    return normalizedType.includes('reglement') || rawTx.type === 'Règlement Reçu' || Number(rawTx.montant || 0) > 0;
}
function isClientPayout(rawTx: ClientTransactionDzd) {
    const normalizedType = normalizeText(rawTx.type);
    if (isClientAdjustment(rawTx) || isClientTransfer(rawTx))
        return false;
    return normalizedType.includes('paiement') || rawTx.type === 'Paiement Effectué' || Number(rawTx.montant || 0) < 0;
}
function isClientAdjustment(rawTx: ClientTransactionDzd) {
    const normalizedType = normalizeText(rawTx.type);
    return !isClientTransfer(rawTx)
        && (normalizedType.includes('solde') || normalizedType.includes('ajustement'));
}

function matchesTransactionFilter(mode: TransactionFilterMode, tx: DisplayTx) {
    const rawTx = tx.rawTx;
    switch (mode) {
        case 'all':
            return true;
        case 'buy':
            return tx.sourceType === 'usdt_tx' && isCryptoBuy(rawTx);
        case 'sell':
            return tx.sourceType === 'usdt_tx' && isCryptoSell(rawTx);
        case 'adjustments':
            return tx.sourceType === 'usdt_tx' && isCryptoManual(rawTx);
        case 'stock':
            return tx.sourceType === 'usdt_tx' && isCryptoManual(rawTx);
        case 'buy_usdt_dzd':
            return tx.sourceType === 'usdt_tx'
                && isCryptoBuy(rawTx)
                && rawTx.currency === 'USDT'
                && rawTx.purchaseFundingCurrency !== 'EUR';
        case 'buy_usdt_eur':
            return tx.sourceType === 'usdt_tx'
                && isCryptoBuy(rawTx)
                && rawTx.currency === 'USDT'
                && rawTx.purchaseFundingCurrency === 'EUR';
        case 'buy_eur_dzd':
            return tx.sourceType === 'usdt_tx'
                && isCryptoBuy(rawTx)
                && rawTx.currency === 'EUR'
                && !rawTx.linkedTxId;
        case 'sell_usdt_dzd':
            return tx.sourceType === 'usdt_tx'
                && isCryptoSell(rawTx)
                && rawTx.currency === 'USDT'
                && rawTx.settlementCurrency !== 'EUR';
        case 'sell_usdt_eur':
            return tx.sourceType === 'usdt_tx'
                && isCryptoSell(rawTx)
                && rawTx.currency === 'USDT'
                && rawTx.settlementCurrency === 'EUR';
        case 'sell_eur_dzd':
            return tx.sourceType === 'usdt_tx'
                && isCryptoSell(rawTx)
                && rawTx.currency === 'EUR';
        case 'stock_in':
            return tx.sourceType === 'usdt_tx'
                && (rawTx as Tx).type === 'Ajout Manuel';
        case 'stock_out':
            return tx.sourceType === 'usdt_tx'
                && (rawTx as Tx).type === 'Retrait Manuel';
        case 'client_payments':
            return tx.sourceType === 'client_tx' && !isClientTransfer(rawTx);
        case 'client_receipts':
            return tx.sourceType === 'client_tx'
                && isClientReceipt(rawTx as ClientTransactionDzd);
        case 'client_receipts_cash':
            return tx.sourceType === 'client_tx'
                && isClientReceipt(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'cash';
        case 'client_receipts_baridi':
            return tx.sourceType === 'client_tx'
                && isClientReceipt(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'baridi';
        case 'client_receipts_credit':
            return tx.sourceType === 'client_tx'
                && isClientReceipt(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'credit';
        case 'client_payouts':
            return tx.sourceType === 'client_tx'
                && isClientPayout(rawTx as ClientTransactionDzd);
        case 'client_payouts_cash':
            return tx.sourceType === 'client_tx'
                && isClientPayout(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'cash';
        case 'client_payouts_baridi':
            return tx.sourceType === 'client_tx'
                && isClientPayout(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'baridi';
        case 'client_payouts_credit':
            return tx.sourceType === 'client_tx'
                && isClientPayout(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'credit';
        case 'client_adjustments':
            return tx.sourceType === 'client_tx' && isClientAdjustment(rawTx as ClientTransactionDzd);
        case 'client_transfers':
            return tx.sourceType === 'client_tx' && isClientTransfer(rawTx);
        case 'treasury_in':
            return tx.sourceType === 'treasury_tx' && isTreasuryEntry(rawTx);
        case 'treasury_in_cash':
            return tx.sourceType === 'treasury_tx'
                && isTreasuryEntry(rawTx)
                && getTreasuryWallet(rawTx as TreasuryTx) === 'cash';
        case 'treasury_in_baridi':
            return tx.sourceType === 'treasury_tx'
                && isTreasuryEntry(rawTx)
                && getTreasuryWallet(rawTx as TreasuryTx) === 'baridi';
        case 'treasury_out':
            return tx.sourceType === 'treasury_tx' && isTreasuryExit(rawTx);
        case 'treasury_out_cash':
            return tx.sourceType === 'treasury_tx'
                && isTreasuryExit(rawTx)
                && getTreasuryWallet(rawTx as TreasuryTx) === 'cash';
        case 'treasury_out_baridi':
            return tx.sourceType === 'treasury_tx'
                && isTreasuryExit(rawTx)
                && getTreasuryWallet(rawTx as TreasuryTx) === 'baridi';
        case 'treasury_transfers':
            return tx.sourceType === 'treasury_tx' && isTreasuryTransfer(rawTx);
        case 'clients':
            return tx.category === 'client';
        case 'treasury':
            return tx.category === 'treasury';
        default:
            return false;
    }
}
function getMatchingTransactionFilterModes(tx: DisplayTx): TransactionFilterMode[] {
    const modes = new Set<TransactionFilterMode>(['all']);
    const rawTx = tx.rawTx;

    if (tx.sourceType === 'usdt_tx') {
        if (isCryptoBuy(rawTx)) {
            modes.add('buy');
            if (rawTx.currency === 'USDT') {
                modes.add(rawTx.purchaseFundingCurrency === 'EUR' ? 'buy_usdt_eur' : 'buy_usdt_dzd');
            }
            else if (rawTx.currency === 'EUR' && !rawTx.linkedTxId) {
                modes.add('buy_eur_dzd');
            }
        }
        if (isCryptoSell(rawTx)) {
            modes.add('sell');
            if (rawTx.currency === 'USDT') {
                modes.add(rawTx.settlementCurrency === 'EUR' ? 'sell_usdt_eur' : 'sell_usdt_dzd');
            }
            else if (rawTx.currency === 'EUR') {
                modes.add('sell_eur_dzd');
            }
        }
        if (isCryptoManual(rawTx)) {
            modes.add('adjustments');
            modes.add('stock');
            if ((rawTx as Tx).type === 'Ajout Manuel')
                modes.add('stock_in');
            if ((rawTx as Tx).type === 'Retrait Manuel')
                modes.add('stock_out');
        }
        return Array.from(modes);
    }

    if (tx.sourceType === 'client_tx') {
        const clientTx = rawTx as ClientTransactionDzd;
        modes.add('clients');
        if (!isClientTransfer(clientTx))
            modes.add('client_payments');
        if (isClientReceipt(clientTx)) {
            modes.add('client_receipts');
            const method = normalizePaymentMethod(clientTx.paymentMethod);
            if (method === 'cash')
                modes.add('client_receipts_cash');
            if (method === 'baridi')
                modes.add('client_receipts_baridi');
            if (method === 'credit')
                modes.add('client_receipts_credit');
        }
        if (isClientPayout(clientTx)) {
            modes.add('client_payouts');
            const method = normalizePaymentMethod(clientTx.paymentMethod);
            if (method === 'cash')
                modes.add('client_payouts_cash');
            if (method === 'baridi')
                modes.add('client_payouts_baridi');
            if (method === 'credit')
                modes.add('client_payouts_credit');
        }
        if (isClientAdjustment(clientTx))
            modes.add('client_adjustments');
        if (isClientTransfer(clientTx))
            modes.add('client_transfers');
        return Array.from(modes);
    }

    if (tx.sourceType === 'treasury_tx') {
        const treasuryTx = rawTx as TreasuryTx;
        modes.add('treasury');
        if (isTreasuryEntry(treasuryTx)) {
            modes.add('treasury_in');
            const wallet = getTreasuryWallet(treasuryTx);
            if (wallet === 'cash')
                modes.add('treasury_in_cash');
            if (wallet === 'baridi')
                modes.add('treasury_in_baridi');
        }
        if (isTreasuryExit(treasuryTx)) {
            modes.add('treasury_out');
            const wallet = getTreasuryWallet(treasuryTx);
            if (wallet === 'cash')
                modes.add('treasury_out_cash');
            if (wallet === 'baridi')
                modes.add('treasury_out_baridi');
        }
        if (isTreasuryTransfer(treasuryTx))
            modes.add('treasury_transfers');
    }

    return Array.from(modes);
}

type ReferenceParams = {
    t: (key: string) => string;
    filterMode: TransactionFilterMode;
    dateRange: { start: Date | null; end: Date | null };
    transactions: Tx[];
    digitalServiceTransactions?: DigitalServiceTransaction[];
    clientTransactionsDzd: ClientTransactionDzd[];
    clientsDzd: ClientDzd[];
    treasuryTransactions: TreasuryTx[];
    getClientFullName: (client: ClientDzd) => string;
    resultLimit?: number;
};
function referenceViewModel({ t, filterMode, dateRange, transactions, digitalServiceTransactions = [], clientTransactionsDzd, clientsDzd, treasuryTransactions, getClientFullName, resultLimit }: ReferenceParams) {
    // Plain function: each "memo" simply runs.
    const useMemo = <T,>(compute: () => T, _deps: unknown[]): T => compute();
    const formatDzdAmount = (value: number) => formatDzd(value, { min: 2, max: 2 });
    const formatAssetAmount = (value: number) => formatNumber(value, { min: 0, max: 2 });
    const formatEurPerUsdtRate = (value: number) => formatNumber(value, { min: 2, max: 4 });
    const clientsById = useMemo(() => {
        const map = new Map<string, ClientDzd>();
        for (const client of clientsDzd) {
            map.set(client.id, client);
        }
        return map;
    }, [clientsDzd]);
    const linkedClientTxsByTransactionId = useMemo(() => {
        const map = new Map<string, ClientTransactionDzd[]>();
        for (const clientTx of clientTransactionsDzd) {
            if (!clientTx.linkedTxId)
                continue;
            const existing = map.get(clientTx.linkedTxId);
            if (existing) {
                existing.push(clientTx);
            }
            else {
                map.set(clientTx.linkedTxId, [clientTx]);
            }
        }
        return map;
    }, [clientTransactionsDzd]);
    const compactSourceLimit = resultLimit ? Math.max(resultLimit * 8, 40) : null;
    const transactionRows = useMemo(
        () => compactSourceLimit ? transactions.slice(-compactSourceLimit) : transactions,
        [compactSourceLimit, transactions]
    );
    const clientTransactionRows = useMemo(
        () => compactSourceLimit ? clientTransactionsDzd.slice(-compactSourceLimit) : clientTransactionsDzd,
        [clientTransactionsDzd, compactSourceLimit]
    );
    const treasuryTransactionRows = useMemo(
        () => compactSourceLimit ? treasuryTransactions.slice(-compactSourceLimit) : treasuryTransactions,
        [compactSourceLimit, treasuryTransactions]
    );
    const digitalServiceRows = useMemo(
        () => compactSourceLimit ? digitalServiceTransactions.slice(-compactSourceLimit) : digitalServiceTransactions,
        [compactSourceLimit, digitalServiceTransactions]
    );
    const unifiedTransactions = useMemo(() => {
        const all: DisplayTx[] = [];
        const portfolioTxIds = new Set(transactions.map((tx) => tx.id).filter(Boolean));
        const clientTxIds = new Set(clientTransactionsDzd.map((tx) => tx.id).filter(Boolean));
        const treasuryEffectsByLinkedTxId = new Map<string, TreasuryTx>();
        for (const treasuryTx of treasuryTransactions || []) {
            if (!treasuryTx.linkedTxId || !isInternalTreasuryEffect(treasuryTx))
                continue;
            if (!treasuryEffectsByLinkedTxId.has(treasuryTx.linkedTxId)) {
                treasuryEffectsByLinkedTxId.set(treasuryTx.linkedTxId, treasuryTx);
            }
        }
        const clientTransferIndex = buildClientTransferIndex(clientTransactionsDzd);
        const hiddenClientTransferIds = new Set<string>();
        for (const tx of clientTransactionRows) {
            if (tx.type !== 'Transfert Entrant')
                continue;
            const counterpart = findClientTransferCounterpart(tx, clientTransferIndex);
            if (counterpart?.type === 'Transfert Sortant')
                hiddenClientTransferIds.add(tx.id);
        }
        transactionRows.forEach((tx) => {
            if (tx.linkedTxId || tx.linkedDigitalServiceTxId) return;
            const isBuy = tx.type === 'buy' || tx.type === 'Ajout Manuel';
            const isUsdtSaleSettledInEur = tx.type === 'sell' && tx.currency === 'USDT' && tx.settlementCurrency === 'EUR';
            const saleValueEur = Number(tx.saleValueEur || 0);
            const purchaseAmountEur = Number(tx.purchaseAmountEur || 0);
            const isUsdtPurchaseFundedByEur = tx.type === 'buy'
                && tx.currency === 'USDT'
                && tx.purchaseFundingCurrency === 'EUR'
                && purchaseAmountEur > 0;
            const eurPerUsdtRate = Number(tx.eurPerUsdtAtPurchase || 0) > 0
                ? Number(tx.eurPerUsdtAtPurchase)
                : (tx.quantity > 0 ? purchaseAmountEur / tx.quantity : 0);
            const linkedTreasuryEffect = tx.id ? treasuryEffectsByLinkedTxId.get(tx.id) : undefined;
            const showLinkedTreasuryOut = tx.type === 'buy'
                && linkedTreasuryEffect
                && getTreasuryEffectDirection(linkedTreasuryEffect) === 'out';
            const typeLabel = isUsdtSaleSettledInEur
                ? t('ledger.sellUsdtEur')
                : getPortfolioOperationLabel(tx.type, tx.currency, t);
            const txClientCandidates = tx.id ? (linkedClientTxsByTransactionId.get(tx.id) || []) : [];
            const txClient = (tx.linkedClientId ? txClientCandidates.find((clientTx) => clientTx.clientId === tx.linkedClientId) : undefined)
                || txClientCandidates.find((clientTx) => clientTx.linkRole === 'primary')
                || txClientCandidates.find((clientTx) => clientTx.linkRole !== 'dzd_receiver')
                || txClientCandidates[0];
            const txDzdReceiver = (tx.linkedClientDzdId ? txClientCandidates.find((clientTx) => clientTx.clientId === tx.linkedClientDzdId) : undefined)
                || txClientCandidates.find((clientTx) => clientTx.linkRole === 'dzd_receiver');
            const client = txClient ? clientsById.get(txClient.clientId) : undefined;
            const receiverClient = txDzdReceiver
                ? clientsById.get(txDzdReceiver.clientId)
                : (tx.linkedClientDzdId ? clientsById.get(tx.linkedClientDzdId) : undefined);
            let details = client ? getClientFullName(client) : (tx.notes || '');
            if (receiverClient && (!client || receiverClient.id !== client.id)) {
                const settlementAt = String(t('transactions.settlementAt')).replace('{client}', getClientFullName(receiverClient));
                details = [details, settlementAt].filter(Boolean).join(' - ');
            }
            if (isUsdtSaleSettledInEur) {
                const eurRate = Number(tx.eurToDzdRateAtSale || 0);
                const saleValueDzd = Number(tx.total || 0);
                details = [
                    details,
                    `${formatAssetAmount(tx.quantity)} USDT`,
                    eurRate > 0 ? `EUR/DZD ${formatDzdAmount(eurRate)}` : null,
                    saleValueDzd > 0 ? `${formatDzdAmount(saleValueDzd)}` : null
                ].filter(Boolean).join(' - ');
            }
            if (tx.price && (tx.type === 'Ajout Manuel' || tx.type === 'Retrait Manuel')) {
                details = `${details} - Prix: ${formatDzdAmount(tx.price)}`;
            }
            if (showLinkedTreasuryOut) {
                details = [details, getTreasuryEffectWallet(linkedTreasuryEffect)].filter(Boolean).join(' - ');
            }
            all.push({
                id: `crypto_${tx.id}`,
                originalId: tx.id || '',
                timestamp: tx.timestamp,
                date: tx.date,
                time: tx.time,
                typeLabel,
                amountLabel: isUsdtSaleSettledInEur
                    ? (saleValueEur > 0 ? `${formatAssetAmount(saleValueEur)} EUR` : `${formatAssetAmount(tx.quantity)} USDT`)
                    : isUsdtPurchaseFundedByEur
                        ? `${formatAssetAmount(purchaseAmountEur)} EUR`
                        : `${formatAssetAmount(tx.quantity)} ${tx.currency}`,
                amountColor: isBuy ? 'text-financial-profit' : 'text-financial-loss',
                icon: (<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-neutral-100 text-neutral-600">
            {isBuy ? <ArrowDownLeftIcon className="w-5 h-5"/> : <ArrowUpRightIcon className="w-5 h-5"/>}
          </div>),
                details,
                category: 'crypto',
                rawTx: tx,
                sourceType: 'usdt_tx',
                rightMiddleLabel: isUsdtPurchaseFundedByEur
                    ? `@ ${formatEurPerUsdtRate(eurPerUsdtRate)} EUR/USDT`
                    : undefined,
                rightBottomLabel: isUsdtPurchaseFundedByEur
                    ? `→ ${formatAssetAmount(tx.quantity)} USDT`
                    : showLinkedTreasuryOut
                        ? `← ${formatDzdAmount(linkedTreasuryEffect.amount)}`
                        : undefined,
                rightBottomClassName: showLinkedTreasuryOut ? 'text-financial-loss' : undefined
            });
        });
        clientTransactionRows.forEach((tx) => {
            if (isClientTxLinkedToPortfolio(tx, portfolioTxIds)
                || isClientTxLinkedToClient(tx, clientTxIds)
                || tx.linkedDigitalServiceTxId
                || tx.origin === 'adjustment'
                || hiddenClientTransferIds.has(tx.id))
                return;
            const client = clientsById.get(tx.clientId);
            const clientName = client ? getClientFullName(client) : 'Client Inconnu';
            const isPositive = tx.montant > 0;
            const isTransfer = tx.type === 'Transfert Entrant' || tx.type === 'Transfert Sortant';
            const transferCounterpart = isTransfer ? findClientTransferCounterpart(tx, clientTransferIndex) : null;
            const counterpartClient = transferCounterpart ? clientsById.get(transferCounterpart.clientId) : undefined;
            const counterpartName = counterpartClient ? getClientFullName(counterpartClient) : '';
            const clientDetails = isTransfer
                ? getClientTransferDetails(tx, counterpartName, t)
                : [clientName, getManualClientNote(tx.notes)].filter(Boolean).join(' - ');
            const icon = isTransfer
                ? <UsersIcon className="w-5 h-5"/>
                : isPositive
                    ? <ArrowDownLeftIcon className="w-5 h-5"/>
                    : <ArrowUpRightIcon className="w-5 h-5"/>;
            all.push({
                id: `client_${tx.id}`,
                originalId: tx.id,
                timestamp: tx.timestamp,
                date: tx.date,
                time: tx.time,
                typeLabel: getClientOperationLabel(tx.type, t),
                amountLabel: formatDzdAmount(Math.abs(tx.montant)),
                amountColor: isTransfer ? 'text-primary' : (isPositive ? 'text-financial-profit' : 'text-financial-loss'),
                icon: (<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-neutral-100 text-neutral-600">
            {icon}
          </div>),
                details: clientDetails,
                category: 'client',
                rawTx: tx,
                sourceType: 'client_tx'
            });
        });
        treasuryTransactionRows.forEach((tx) => {
            if (isInternalTreasuryEffect(tx))
                return;
            const txData = tx as any;
            const isEntry = tx.type === 'Ajout' || tx.type === 'Adjustment (+)';
            const isTransfer = tx.type === 'Transfer' || tx.notes?.includes('Virement');
            const legacyTransferMatch = typeof txData.asset === 'string'
                ? /from\s+(.+?)\s+to\s+(.+)/i.exec(txData.asset)
                : null;
            const transferFrom = txData.source || legacyTransferMatch?.[1] || 'N/A';
            const transferTo = txData.destination || legacyTransferMatch?.[2] || 'N/A';
            const sourceLabel = isTransfer
                ? `${transferFrom} -> ${transferTo}`
                : (txData.source || txData.asset || txData.expenseWallet || 'N/A');
            const displayAmount = Number(txData.amountDzd ?? tx.amount ?? 0);
            const typeLabel = isTransfer
                ? t('ledger.internalTransfer')
                : getTreasuryOperationLabel(tx.type, t);
            all.push({
                id: `treasury_${tx.id}`,
                originalId: tx.id || '',
                timestamp: tx.timestamp,
                date: tx.date,
                time: tx.time,
                typeLabel,
                amountLabel: formatDzdAmount(displayAmount),
                amountColor: isTransfer ? 'text-primary' : (isEntry ? 'text-financial-profit' : 'text-financial-loss'),
                icon: (<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-neutral-100 text-neutral-600">
            <WalletIcon className="w-5 h-5"/>
          </div>),
                details: [sourceLabel, tx.notes].filter(Boolean).join(' - '),
                category: 'treasury',
                rawTx: tx,
                sourceType: 'treasury_tx'
            });
        });
        digitalServiceRows.forEach((tx) => {
            const client = clientsById.get(tx.clientId);
            const clientLabel = client ? getClientFullName(client) : 'Client Inconnu';
            const profit = Number(tx.profitDzd || 0);
            const details = [
                clientLabel,
                tx.notes || '',
                `${tx.purchaseWallet} → ${tx.saleWallet === 'Credit' ? t('transactions.credit') : tx.saleWallet}`,
            ].filter(Boolean).join(' - ');
            all.push({
                id: `digital_service_${tx.id}`,
                originalId: tx.id,
                timestamp: tx.timestamp,
                date: tx.date,
                time: tx.time,
                typeLabel: t('digitalServices.menuTitle'),
                amountLabel: formatDzdAmount(Math.abs(profit)),
                amountColor: profit >= 0 ? 'text-financial-profit' : 'text-financial-loss',
                icon: (<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <BriefcaseIcon className="w-5 h-5"/>
          </div>),
                details: [tx.serviceName, details].filter(Boolean).join(' - '),
                category: 'digital_service',
                rawTx: tx,
                sourceType: 'digital_service_tx',
                rightMiddleLabel: profit >= 0 ? t('digitalServices.margin') : t('digitalServices.loss'),
                rightBottomLabel: `${formatDzdAmount(Number(tx.saleAmountDzd || 0))} - ${formatDzdAmount(Number(tx.purchaseAmountDzd || 0))}`,
                rightBottomClassName: profit >= 0 ? 'text-financial-profit' : 'text-financial-loss',
            });
        });
        const ordered = all.sort((a, b) => b.timestamp - a.timestamp);
        return resultLimit ? ordered.slice(0, resultLimit) : ordered;
    }, [
        transactionRows,
        clientTransactionsDzd,
        clientTransactionRows,
        treasuryTransactionRows,
        digitalServiceRows,
        linkedClientTxsByTransactionId,
        clientsById,
        getClientFullName,
        resultLimit,
        t
    ]);
    const filteredTransactions = useMemo(() => {
        return unifiedTransactions.filter((tx) => {
            if (!matchesTransactionFilter(filterMode, tx))
                return false;
            if (dateRange.start && dateRange.end) {
                if (tx.timestamp < dateRange.start.getTime() || tx.timestamp > dateRange.end.getTime())
                    return false;
            }
            return true;
        });
    }, [unifiedTransactions, filterMode, dateRange]);
    const txFilterCounts: Record<TransactionFilterMode, number> = useMemo(() => {
        const initial = Object.fromEntries(ALL_FILTER_MODES.map((mode) => [mode, 0])) as Record<TransactionFilterMode, number>;
        if (resultLimit) {
            initial.all = unifiedTransactions.length;
            return initial;
        }
        for (const tx of unifiedTransactions) {
            if (dateRange.start && dateRange.end) {
                if (tx.timestamp < dateRange.start.getTime() || tx.timestamp > dateRange.end.getTime())
                    continue;
            }
            for (const mode of getMatchingTransactionFilterModes(tx)) {
                initial[mode] += 1;
            }
        }
        return initial;
    }, [unifiedTransactions, dateRange, resultLimit]);
    const groupedTransactions = useMemo(() => {
        return filteredTransactions.reduce((acc, tx) => {
            if (!acc[tx.date]) {
                acc[tx.date] = [];
            }
            acc[tx.date].push(tx);
            return acc;
        }, {} as Record<string, DisplayTx[]>);
    }, [filteredTransactions]);
    return { txFilterCounts, groupedTransactions };
}
// ---- End of the reference ----

// ---- Seeded data with every kind of row the list handles ----
function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

const PAYMENT_METHODS = ['Espèces', 'BaridiMob', 'Crédit', 'Cash', 'caisse', 'credit', 'Cr�dit', 'USDT', '', undefined];
const CLIENT_TYPES = ['Règlement Reçu', 'Paiement Effectué', 'Solde Initial', 'Ajustement Solde', 'Remise solde'] as const;

function makeData(seed: number, size: number) {
    const random = mulberry32(seed);
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    let counter = 0;
    const newId = (prefix: string) => `${prefix}${(counter++).toString(36)}`;
    const pad = (n: number) => String(n).padStart(2, '0');
    let clock = new Date(2026, 3, 1, 8, 0).getTime();
    const nextStamp = () => {
        // About one operation in ten shares the time of the previous one.
        if (random() > 0.1)
            clock += Math.floor(random() * 5 * 3_600_000);
        const date = new Date(clock);
        return { timestamp: clock, date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
    };
    const clientsDzd: ClientDzd[] = Array.from({ length: 24 }, (_, index) => (index % 3 === 0
        ? { id: `c${index}`, nom: `Nom${index}`, prenom: `Prénom ${index}` }
        : { id: `c${index}`, fullName: `${pick(['Benali', 'Haddad', 'Saadi', 'Cherif'])} ${pick(['Yacine', 'Nadia', 'Karim', 'Amina'])} ${index}` }) as unknown as ClientDzd);
    const clientIds = [...clientsDzd.map((client) => client.id), 'deleted-client'];
    const transactions: Tx[] = [];
    const clientTransactionsDzd: ClientTransactionDzd[] = [];
    const treasuryTransactions: TreasuryTx[] = [];
    const digitalServiceTransactions: DigitalServiceTransaction[] = [];
    const tags = () => (random() < 0.15 ? [pick(['urgent', 'fidele', 'livraison'])] : undefined);
    for (let index = 0; index < size; index += 1) {
        const kind = random();
        const stamp = nextStamp();
        if (kind < 0.35) {
            const type = pick(['buy', 'buy', 'sell', 'sell', 'Ajout Manuel', 'Retrait Manuel'] as const);
            const currency = pick(['USDT', 'USDT', 'EUR'] as const);
            const quantity = pick([0, 50, 1234.5, 1000, 0.25]);
            const tx: Record<string, unknown> = { id: newId('t'), ...stamp, type, currency, quantity, total: quantity * 248.5, notes: pick(['', 'note libre', undefined]), tags: tags() };
            if (type === 'buy')
                tx.price = pick([245.5, 0]);
            if (type === 'sell')
                tx.sell = 251;
            if (type === 'buy' && currency === 'USDT' && random() < 0.35) {
                tx.purchaseFundingCurrency = 'EUR';
                tx.purchaseAmountEur = pick([0, 920.4, 1000]);
                tx.eurPerUsdtAtPurchase = pick([0, 0.92, undefined]);
            }
            if (type === 'sell' && currency === 'USDT' && random() < 0.35) {
                tx.settlementCurrency = 'EUR';
                tx.saleValueEur = pick([0, 870]);
                tx.eurToDzdRateAtSale = pick([0, 262.5]);
                tx.sellPriceEur = 0.93;
            }
            if ((type === 'Ajout Manuel' || type === 'Retrait Manuel') && random() < 0.5)
                tx.price = 240;
            if (random() < 0.08)
                tx.linkedTxId = pick(transactions)?.id || 'elsewhere';
            if (random() < 0.04)
                tx.linkedDigitalServiceTxId = 'service';
            transactions.push(tx as unknown as Tx);
            if (type !== 'buy' && type !== 'sell')
                continue;
            const linkChoice = random();
            if (linkChoice < 0.6) {
                const clientId = pick(clientIds);
                if (random() < 0.5)
                    tx.linkedClientId = random() < 0.8 ? clientId : pick(clientIds);
                clientTransactionsDzd.push({ id: newId('l'), ...stamp, clientId, montant: (type === 'sell' ? -1 : 1) * Number(tx.total), type: type === 'sell' ? 'Vente USDT' : 'Achat EUR', linkedTxId: tx.id as string, linkRole: pick(['primary', undefined, 'dzd_receiver'] as const), paymentMethod: pick(PAYMENT_METHODS) } as ClientTransactionDzd);
                if (random() < 0.3) {
                    const receiverId = pick(clientIds);
                    if (random() < 0.5)
                        tx.linkedClientDzdId = receiverId;
                    clientTransactionsDzd.push({ id: newId('l'), ...stamp, clientId: receiverId, montant: Number(tx.total), type: 'Règlement Reçu', linkedTxId: tx.id as string, linkRole: 'dzd_receiver' } as ClientTransactionDzd);
                }
            }
            else if (linkChoice < 0.7) {
                tx.linkedClientDzdId = pick(clientIds);
            }
            if (random() < 0.7) {
                const origin = pick(['usdt_tx', 'client_tx', undefined, undefined] as const);
                treasuryTransactions.push({ id: newId('e'), ...stamp, type: type === 'buy' ? pick(['Retrait', 'Ajout', 'Adjustment (-)'] as const) : 'Ajout', source: pick(['Caisse', 'BaridiMob', undefined] as const), asset: pick([undefined, 'DZD-Caisse']), amount: Number(tx.total), linkedTxId: tx.id as string, origin, notes: origin ? 'Effet' : pick(['Achat USDT', 'VENTE usdt', 'Achât EUR', 'Vente', 'autre note', undefined]) } as TreasuryTx);
            }
        }
        else if (kind < 0.62) {
            if (random() < 0.2) {
                // A transfer between two clients: linked, matched by date and amount, or alone.
                const amount = pick([5000, 12_500.5, 300]);
                const from = pick(clientIds);
                const to = pick(clientIds.filter((clientId) => clientId !== from));
                const outgoing = { id: newId('o'), ...stamp, clientId: from, montant: -amount, type: 'Transfert Sortant', notes: pick(['', 'transfert']) } as ClientTransactionDzd;
                const incoming = { id: newId('i'), ...stamp, clientId: to, montant: amount, type: 'Transfert Entrant' } as ClientTransactionDzd;
                const pairing = random();
                if (pairing < 0.4)
                    incoming.linkedTxId = outgoing.id;
                else if (pairing < 0.6)
                    outgoing.linkedTxId = incoming.id;
                if (pairing < 0.9)
                    clientTransactionsDzd.push(outgoing);
                clientTransactionsDzd.push(incoming);
                continue;
            }
            const row: Record<string, unknown> = { id: newId('k'), ...stamp, clientId: pick(clientIds), montant: pick([15_000, -8_000, 0, 250.75, -1_200_000]), type: pick(CLIENT_TYPES), paymentMethod: pick(PAYMENT_METHODS), notes: pick(['', 'Paiement partiel', 'Règlement Reçu - Vente USDT', undefined]), tags: tags() };
            if (random() < 0.06)
                row.origin = 'adjustment';
            if (random() < 0.05)
                row.linkedDigitalServiceTxId = 'service';
            if (random() < 0.05)
                row.linkedTxId = pick(clientTransactionsDzd)?.id;
            clientTransactionsDzd.push(row as unknown as ClientTransactionDzd);
        }
        else if (kind < 0.9) {
            const row: Record<string, unknown> = { id: newId('r'), ...stamp, type: pick(['Ajout', 'Retrait', 'Adjustment (+)', 'Adjustment (-)', 'Transfer'] as const), source: pick(['Caisse', 'BaridiMob', undefined] as const), amount: pick([10_000, 2_500.5, 0]), notes: pick(['', 'Virement interne', 'Dépôt', 'Frais de livraison', undefined]), tags: tags() };
            const variant = random();
            if (variant < 0.1)
                row.asset = 'from Caisse to BaridiMob';
            else if (variant < 0.2)
                row.asset = pick(['DZD-Caisse', 'DZD-Baridi']);
            if (row.type === 'Transfer' && random() < 0.5)
                row.destination = pick(['Caisse', 'BaridiMob']);
            if (random() < 0.15) {
                row.amountDzd = 3_300;
                row.expenseWallet = pick(['USDT', 'EUR', 'Caisse']);
            }
            const origin = random();
            if (origin < 0.06) {
                row.origin = 'manual_asset';
                row.linkedAssetTxId = random() < 0.8 ? 'asset' : undefined;
            }
            else if (origin < 0.12) {
                row.origin = 'digital_service_sale';
                row.linkedDigitalServiceTxId = random() < 0.8 ? 'service' : undefined;
            }
            else if (origin < 0.16) {
                row.origin = 'personal_expense_return';
            }
            else if (origin < 0.2) {
                row.origin = 'balance_edit';
            }
            treasuryTransactions.push(row as unknown as TreasuryTx);
        }
        else {
            digitalServiceTransactions.push({ id: newId('s'), ...stamp, clientId: pick(clientIds), serviceName: pick(['Netflix', 'Canva Pro', '']), purchaseWallet: pick(['Caisse', 'BaridiMob', 'USDT']), saleWallet: pick(['Credit', 'Caisse', 'BaridiMob']), profitDzd: pick([500, -200, 0, 1_250.5]), saleAmountDzd: pick([3_000, 0]), purchaseAmountDzd: 2_500, notes: pick(['', 'client fidèle', undefined]), tags: tags() } as unknown as DigitalServiceTransaction);
        }
    }
    // Firestore does not promise any order: shuffle part of each list so the sort matters.
    for (const list of [transactions, clientTransactionsDzd, treasuryTransactions, digitalServiceTransactions] as unknown[][]) {
        for (let index = list.length - 1; index > 0; index -= 3) {
            const other = Math.floor(random() * (index + 1));
            [list[index], list[other]] = [list[other], list[index]];
        }
    }
    return { transactions, clientTransactionsDzd, treasuryTransactions, digitalServiceTransactions, clientsDzd };
}

// ---- Helpers ----
function lookup(dictionary: unknown, key: string): unknown {
    let value: any = dictionary;
    for (const part of key.split('.')) {
        if (value && typeof value === 'object' && part in value)
            value = value[part];
        else
            return undefined;
    }
    return value;
}
// Like LanguageProvider: one stable function per language, Arabic falling back to French.
const translate = {
    fr: (key: string) => (lookup(translations.fr, key) ?? key) as string,
    ar: (key: string) => (lookup((translations as Record<string, unknown>).ar, key) ?? lookup(translations.fr, key) ?? key) as string,
};
let clientNameCalls = 0;
// Like MainApp's getClientDisplayName.
function getClientFullName(client: ClientDzd) {
    clientNameCalls += 1;
    const raw = client.fullName || (client.prenom ? `${client.nom} ${client.prenom}` : client.nom) || '';
    return reorderClientName(raw);
}
const noop = () => { };
type Inputs = ReturnType<typeof makeData>;
type Options = { t: (key: string) => string; filterMode: TransactionFilterMode; dateRange: { start: Date | null; end: Date | null }; resultLimit?: number };

function runViewModel(data: Inputs, options: Options) {
    let result: ReturnType<typeof useTransactionsViewModel> | undefined;
    function Harness() {
        result = useTransactionsViewModel({
            ...data,
            ...options,
            setFilterMode: noop,
            setDateRange: noop,
            getClientFullName,
            openForm: noop,
            openAdjustmentModal: noop,
            setTxToDelete: noop,
            providedProfitByTxId: {},
        });
        return null;
    }
    renderToStaticMarkup(<Harness/>);
    return result!;
}

function rowView(row: DisplayTx) {
    return {
        id: row.id,
        originalId: row.originalId,
        timestamp: row.timestamp,
        date: row.date,
        time: row.time,
        typeLabel: row.typeLabel,
        amountLabel: row.amountLabel,
        amountColor: row.amountColor,
        icon: renderToStaticMarkup(<>{row.icon}</>),
        details: row.details,
        contextLabel: row.contextLabel,
        category: row.category,
        sourceType: row.sourceType,
        actionRawTx: row.actionRawTx,
        rightMiddleLabel: row.rightMiddleLabel,
        rightBottomLabel: row.rightBottomLabel,
        rightBottomClassName: row.rightBottomClassName,
    };
}

function rowsOf(groups: Record<string, DisplayTx[]>) {
    return Object.values(groups).flat();
}

// V2-5 added the Services family (digital_services), which the reference predates: the other
// counters are compared with the reference, and this one with the service rows it lists.
function withoutServices(counts: Record<TransactionFilterMode, number>) {
    const { digital_services: _services, ...others } = counts;
    return others;
}
const serviceRowsOf = (groups: Record<string, DisplayTx[]>) => rowsOf(groups).filter((row) => row.category === 'digital_service');

function assertSameGroups(actual: Record<string, DisplayTx[]>, expected: Record<string, DisplayTx[]>, label: string, compareText: boolean) {
    assert.deepEqual(Object.keys(actual), Object.keys(expected), `${label}: days`);
    for (const [date, expectedRows] of Object.entries(expected)) {
        const actualRows = actual[date];
        assert.equal(actualRows.length, expectedRows.length, `${label}: number of operations on ${date}`);
        expectedRows.forEach((expectedRow, index) => {
            assert.equal(actualRows[index].rawTx, expectedRow.rawTx, `${label}: operation ${index} on ${date}`);
            if (compareText)
                assert.deepEqual(rowView(actualRows[index]), rowView(expectedRow), `${label}: row ${expectedRow.id}`);
            else
                assert.equal(actualRows[index].id, expectedRow.id, `${label}: row ${expectedRow.id}`);
        });
    }
}

const FILTER_MODES: TransactionFilterMode[] = ALL_FILTER_MODES;
const data = makeData(20260927, 1800);
const allRawRows = [...data.transactions, ...data.clientTransactionsDzd, ...data.treasuryTransactions, ...data.digitalServiceTransactions];
const timestamps = allRawRows.map((row) => row.timestamp).sort((a, b) => a - b);
const DATE_RANGES = [
    { start: null, end: null },
    { start: new Date(timestamps[Math.floor(timestamps.length * 0.3)]), end: new Date(timestamps[Math.floor(timestamps.length * 0.6)]) },
    { start: new Date(timestamps[0] - 10 * 86_400_000), end: new Date(timestamps[0] - 86_400_000) },
];

// 1. Same rows, same order, same text and same counters as before, for every filter, period and language.
{
    let comparedRows = 0;
    for (const lang of ['fr', 'ar'] as const) {
        const t = translate[lang];
        for (const dateRange of DATE_RANGES) {
            for (const filterMode of FILTER_MODES) {
                const label = `${lang} ${filterMode} ${dateRange.start ? 'period' : 'all dates'}`;
                const expected = referenceViewModel({ ...data, t, filterMode, dateRange, getClientFullName });
                const actual = runViewModel(data, { t, filterMode, dateRange });
                assert.deepEqual(withoutServices(actual.txFilterCounts), expected.txFilterCounts, `${label}: counters`);
                // Every row appears under "all": its text is compared there, the other filters compare which rows they keep.
                assertSameGroups(actual.groupedTransactions, expected.groupedTransactions, label, filterMode === 'all');
                if (filterMode === 'all') {
                    comparedRows += rowsOf(expected.groupedTransactions).length;
                    assert.equal(actual.txFilterCounts.digital_services, serviceRowsOf(expected.groupedTransactions).length, `${label}: services counter`);
                }
            }
            // The Services chip keeps the service rows of "all", in the same order.
            const everything = referenceViewModel({ ...data, t, filterMode: 'all', dateRange, getClientFullName }).groupedTransactions;
            const services = runViewModel(data, { t, filterMode: 'digital_services', dateRange });
            assert.deepEqual(rowsOf(services.groupedTransactions).map((row) => row.rawTx), serviceRowsOf(everything).map((row) => row.rawTx), `${lang} services ${dateRange.start ? 'period' : 'all dates'}`);
        }
    }
    assert.ok(comparedRows > 2000, `enough rows compared (${comparedRows})`);
    const kinds = new Set(rowsOf(referenceViewModel({ ...data, t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[0], getClientFullName }).groupedTransactions).map((row) => row.sourceType));
    assert.deepEqual([...kinds].sort(), ['client_tx', 'digital_service_tx', 'treasury_tx', 'usdt_tx'], 'every kind of row is covered');
}

// 2. The dashboard's recent operations (limited list) are unchanged too.
for (const resultLimit of [5, 60]) {
    const expected = referenceViewModel({ ...data, t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[0], getClientFullName, resultLimit });
    const actual = runViewModel(data, { t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[0], resultLimit });
    assert.deepEqual(withoutServices(actual.txFilterCounts), expected.txFilterCounts, `limit ${resultLimit}: counters`);
    assertSameGroups(actual.groupedTransactions, expected.groupedTransactions, `limit ${resultLimit}`, true);
}

// 3. Opening the page names no client and formats no row: that waits until a row is shown.
{
    const fresh = { ...data, transactions: data.transactions.slice() };
    clientNameCalls = 0;
    const result = runViewModel(fresh, { t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[0] });
    assert.equal(clientNameCalls, 0, 'no client name built while opening');
    const firstClientRow = rowsOf(result.groupedTransactions).find((row) => row.sourceType === 'client_tx' && (row.rawTx as ClientTransactionDzd).clientId !== 'deleted-client' && (row.rawTx as ClientTransactionDzd).type !== 'Transfert Entrant' && (row.rawTx as ClientTransactionDzd).type !== 'Transfert Sortant')!;
    const details = firstClientRow.details;
    assert.equal(clientNameCalls, 1, 'reading a row builds that row only');
    assert.equal(firstClientRow.details, details);
    assert.equal(firstClientRow.typeLabel.length > 0, true);
    assert.equal(clientNameCalls, 1, 'a row is built once');
}

// 4. Reopening with the same data reuses the list and its counters; new data or another language rebuilds it.
{
    const fresh = { ...data, clientTransactionsDzd: data.clientTransactionsDzd.slice() };
    const first = runViewModel(fresh, { t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[0] });
    const again = runViewModel(fresh, { t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[0] });
    const firstRows = rowsOf(first.groupedTransactions);
    const againRows = rowsOf(again.groupedTransactions);
    assert.ok(firstRows.every((row, index) => row === againRows[index]), 'same rows reused');
    assert.equal(again.txFilterCounts, first.txFilterCounts, 'same counters reused');

    const withPeriod = runViewModel(fresh, { t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[1] });
    assert.notEqual(withPeriod.txFilterCounts, first.txFilterCounts, 'a period recounts');
    assert.deepEqual(withoutServices(withPeriod.txFilterCounts), referenceViewModel({ ...fresh, t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[1], getClientFullName }).txFilterCounts);

    const newData = { ...fresh, treasuryTransactions: fresh.treasuryTransactions.slice() };
    const rebuilt = runViewModel(newData, { t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[0] });
    assert.notEqual(rowsOf(rebuilt.groupedTransactions)[0], firstRows[0], 'new data rebuilds the list');
    assertSameGroups(rebuilt.groupedTransactions, referenceViewModel({ ...newData, t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[0], getClientFullName }).groupedTransactions, 'rebuilt', true);

    const arabic = runViewModel(newData, { t: translate.ar, filterMode: 'all', dateRange: DATE_RANGES[0] });
    assertSameGroups(arabic.groupedTransactions, referenceViewModel({ ...newData, t: translate.ar, filterMode: 'all', dateRange: DATE_RANGES[0], getClientFullName }).groupedTransactions, 'language switch', true);
}

// 5. The page itself: the counts of the old top card are all on the page (V2-5 moved them to the
//    family chips and the list title), and 60 rows are shown.
{
    const fresh = { ...data, digitalServiceTransactions: data.digitalServiceTransactions.slice() };
    const html = renderToStaticMarkup(<TransactionsPage openAdjustmentModal={noop} openForm={noop} filterMode="all" setFilterMode={noop}
        transactions={fresh.transactions} digitalServiceTransactions={fresh.digitalServiceTransactions} profitByTxId={{}}
        getRelativeDateLabel={(date) => date} clientTransactionsDzd={fresh.clientTransactionsDzd} clientsDzd={fresh.clientsDzd}
        getClientFullName={getClientFullName} setTxToDelete={noop} openDateFilterModal={noop} dateRange={DATE_RANGES[0]} setDateRange={noop}
        onOpenNewOperation={noop} treasuryTransactions={fresh.treasuryTransactions}/>);
    const groupedTransactions = referenceViewModel({ ...fresh, t: translate.fr, filterMode: 'all', dateRange: DATE_RANGES[0], getClientFullName }).groupedTransactions;
    // The counts as TransactionsPage computed them before (copied verbatim).
    const allTxs: DisplayTx[] = Object.values(groupedTransactions).flat() as DisplayTx[];
    const stats = {
      total:    allTxs.length,
      crypto:   allTxs.filter((tx) => tx.category === 'crypto').length,
      client:   allTxs.filter((tx) => tx.category === 'client').length,
      treasury: allTxs.filter((tx) => tx.category === 'treasury').length,
      digital:  allTxs.filter((tx) => tx.category === 'digital_service').length,
    };
    const chipCounts = [...html.matchAll(/aria-pressed="(?:true|false)"[^>]*><span>([^<]*)<\/span><span dir="ltr"[^>]*>([^<]*)<\/span><\/button>/g)]
        .map((match) => [match[1], Number(match[2].replace(/\s/g, ''))] as const);
    const chip = Object.fromEntries(chipCounts);
    assert.deepEqual(chipCounts.map(([label]) => label), ['Tout', 'Achats', 'Ventes', 'Stock', 'Clients', 'Trésorerie', 'Services'], 'family chips');
    const count = (value: number) => formatNumber(value, { min: 0, max: 0 });
    assert.ok(html.includes(`· <bdi>${count(stats.total)}</bdi></span></h2>`), 'total count, next to the title');
    assert.equal(chip.Tout, stats.total, 'Tout');
    assert.equal(chip.Achats + chip.Ventes + chip.Stock, stats.crypto, 'wallet = purchases + sales + stock');
    assert.deepEqual([chip.Clients, chip['Trésorerie'], chip.Services], [stats.client, stats.treasury, stats.digital], 'clients, treasury, services');
    assert.ok(stats.total > 1_000 && html.includes(`>${count(stats.total)}</span></button>`), 'counts written like the old card, with the thousands apart');
    assert.equal(html.split('content-visibility').length - 1, 60, 'rows shown');
    for (const row of allTxs.slice(0, 60))
        assert.ok(html.includes(row.amountLabel.replace(/&/g, '&amp;')), `row ${row.id} shown`);
}

console.log('useTransactionsViewModel tests passed');
