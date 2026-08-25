import { useState, useMemo, type MutableRefObject } from 'react';
import { db, fieldValueDelete, type FirestoreDocumentReference } from '../firebase';
import { Tx, PortfolioStats, ClientDzd, TreasuryTx, ClientTransactionDzd, Investor, InvestorTransaction } from '../types';
import { now, parseAndEvaluate } from '../utils';
import { roundM } from '../utils/money';
import { formatNumber } from '../pages/shared/pageFormat';
import { applyTransactionDelete } from '../transactionService';
import { recordTreasuryShadow } from '../accounting/treasuryShadowDiagnostics';
import { recordPortfolioShadow } from '../accounting/portfolioShadowDiagnostics';
import { inventoryFromLegacyPortfolioStats } from '../accounting/portfolioShadowLegacyAdapter';
import { recordClientShadow } from '../accounting/clientShadowDiagnostics';
import { clientPositionFromLegacyRows } from '../accounting/clientShadowLegacyAdapter';
import type { SmartSaleSnapshot } from '../services/smartPricingEngine';
import {
    computeProjectExpensePreview,
    isAssetWallet,
    isCashWallet,
    type FinancialWallet,
} from '../utils/digitalServiceAccounting';
import { allocateProfitDeltaAtTimestamp, type ManagerFeeHistoryEntry } from './useInvestorEconomics';
import { mustPrepareWriterReadModelDelta } from '../readModels/preparedWriterDeltas';
import { commitLegacyWithReadModelDeltas } from '../readModels/productionSummaryWriter';
import { combineClientPositionDeltas, derivePortfolioSellReadModelEconomics, invertReadModelDelta, combineReadModelDeltas, transitionClientBalanceDelta, type ClientPositionDelta, type ReadModelDelta } from '../readModels/readModelDeltas';
import { readUsdtTxLegacy, readTreasuryTxLegacy, readClientTxLegacy, readPersonalExpenseLegacy, type LegacyReadResult } from '../readModels/legacyReadDelta';
import { serviceBalanceDelta } from './useAssetHandlers';
interface HandlerProps {
    userDocRef: FirestoreDocumentReference;
    portfolioStats: PortfolioStats;
    transactions: Tx[];
    clientsDzd: ClientDzd[];
    clientTransactionsDzd: ClientTransactionDzd[];
    investors: Investor[];
    investorTransactions: InvestorTransaction[];
    managerFeePercentage: string | number;
    managerFeeHistory: ManagerFeeHistoryEntry[];
    treasuryTransactions: TreasuryTx[];
    personalExpenses: TreasuryTx[];
    treasuryStats: {
        caisse: number;
        baridi: number;
    };
    /** Manual-asset client balances (actifId_clientId -> balance) used by the delete old-delta builder. */
    assetClientBalances?: Map<string, number>;
    setAlert: (msg: string) => void;
    setSelectedClientId: (id: string | null) => void;
    setView: (view: 'transactions' | 'dzd' | 'tresorerie' | 'statistiques' | 'tresorerie' | 'investors') => void;
    /** Live smart-pricing quote for the open sell form (SmartPricePanel keeps it current). */
    smartQuoteRef?: MutableRefObject<SmartSaleSnapshot | null>;
}
type TransactionFormMode = 'buy_usdt' | 'sell_usdt' | 'buy_eur' | 'sell_eur';
type PortfolioCurrency = 'USDT' | 'EUR';
type SettlementCurrency = 'DZD' | 'EUR';
type DeliveryExpenseMethod = FinancialWallet;
const pricingRiskFingerprint = (snapshot: SmartSaleSnapshot) => JSON.stringify([
    snapshot.currency, snapshot.clientId, snapshot.quantity,
    snapshot.payment.kind, snapshot.payment.dueDate || '', snapshot.actual.unitPrice,
    snapshot.creditRisk.projectedDebt, snapshot.creditRisk.creditLimit,
    snapshot.creditRisk.oldestOverdueDays,
]);
/** Firestore rejects undefined. Safe ONLY for pure-JSON values (never for
 *  payloads carrying fieldValueDelete() sentinels). */
function stripUndefinedDeep<T>(value: T): T {
    if (Array.isArray(value)) return value.map(stripUndefinedDeep) as T;
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            if (v !== undefined) out[k] = stripUndefinedDeep(v);
        }
        return out as T;
    }
    return value;
}
export type PrefillSell = {
    sellQty?: string;
    sellPrice?: string;
    clientId?: string;
    paymentStatus?: 'credit' | 'baridi' | 'cash';
    creditDueDate?: string;
};
export function useTransactionHandlers({ userDocRef, portfolioStats, transactions, clientsDzd, clientTransactionsDzd, investors, investorTransactions, managerFeePercentage, managerFeeHistory, treasuryTransactions, personalExpenses, treasuryStats, assetClientBalances: assetClientBalancesMap, setAlert, setSelectedClientId, setView, smartQuoteRef }: HandlerProps) {
    const assetClientBalances = assetClientBalancesMap ?? new Map<string, number>();
    const [isSaving, setIsSaving] = useState(false);
    const paymentMethodByStatus: Record<'credit' | 'baridi' | 'cash', 'Crédit' | 'BaridiMob' | 'Espèces'> = {
        credit: 'Crédit',
        baridi: 'BaridiMob',
        cash: 'Espèces'
    };
    const affectsClientBalance = (status: 'credit' | 'baridi' | 'cash') => status === 'credit';
    const getClientDisplayNameById = (clientId: string) => {
        const client = clientsDzd.find((item) => item.id === clientId);
        return client?.fullName || client?.nom || 'Client';
    };
    const appendOriginalClientToNote = (baseNote: string, clientId: string) => {
        if (!clientId || clientId === 'none')
            return baseNote;
        return `${baseNote} - Client: ${getClientDisplayNameById(clientId)}`;
    };
    // Modal State
    const [mode, setMode] = useState<TransactionFormMode | null>(null);
    const [editingTx, setEditingTx] = useState<Tx | null>(null);
    const [isTotalManual, setIsTotalManual] = useState(false);
    // Form State
    const [buyUsdtAmount, setBuyUsdtAmount] = useState('');
    const [buyUsdtPrice, setBuyUsdtPrice] = useState('');
    const [buyUsdtTotal, setBuyUsdtTotal] = useState('');
    const [buyEurAmount, setBuyEurAmount] = useState('');
    const [buyEurPrice, setBuyEurPrice] = useState('');
    const [buyEurTotal, setBuyEurTotal] = useState('');
    const [sellAmount, setSellAmount] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [sellTotal, setSellTotal] = useState('');
    const [sellSettlementCurrency, setSellSettlementCurrency] = useState<SettlementCurrency>('DZD');
    const [sellEurToDzdRate, setSellEurToDzdRate] = useState('');
    const [buyUsdtMode, setBuyUsdtMode] = useState<'with_dzd' | 'with_eur' | null>(null);
    const [buyEurForUsdtAmount, setBuyEurForUsdtAmount] = useState('');
    const [eurDzdPrice, setEurDzdPrice] = useState('');
    const [eurUsdtRate, setEurUsdtRate] = useState('');
    const [linkedClientId, setLinkedClientId] = useState('none');
    const [linkedClientDzdId, setLinkedClientDzdId] = useState('none');
    const [clientPaymentStatus, setClientPaymentStatus] = useState<'credit' | 'baridi' | 'cash'>('cash');
    const [creditDueDate, setCreditDueDate] = useState('');
    const [pendingCreditRisk, setPendingCreditRisk] = useState<SmartSaleSnapshot | null>(null);

    const [buyRestriction, setBuyRestriction] = useState<'free' | 'locked_24h'>('free');
    const [realPurchaseTime, setRealPurchaseTime] = useState('');
    const [notes, setNotes] = useState('');
    const [txTags, setTxTags] = useState<string[]>([]);
    const [profitPercent, setProfitPercent] = useState('');
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentTab, setAdjustmentTab] = useState<'add' | 'subtract'>('add');
    const [adjustmentAsset, setAdjustmentAsset] = useState('DZD-Caisse');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentPrice, setAdjustmentPrice] = useState('');
    const [adjustmentNote, setAdjustmentNote] = useState('');
    const [adjustmentClientId, setAdjustmentClientId] = useState('');
    const [editingTreasuryTx, setEditingTreasuryTx] = useState<TreasuryTx | null>(null);
    const [isDeliveryExpenseModalOpen, setIsDeliveryExpenseModalOpen] = useState(false);
    const [deliveryExpenseAmount, setDeliveryExpenseAmount] = useState('');
    const [deliveryExpenseMethod, setDeliveryExpenseMethod] = useState<DeliveryExpenseMethod>('Caisse');
    const [deliveryExpenseDate, setDeliveryExpenseDate] = useState<string>('');
    const [deliveryExpenseNote, setDeliveryExpenseNote] = useState('');
    const projectExpenseRates = useMemo(() => ({
        usdtPma: Number(portfolioStats.usdt.avgBuy || 0),
        eurPma: Number(portfolioStats.eur.avgBuy || 0),
    }), [portfolioStats.usdt.avgBuy, portfolioStats.eur.avgBuy]);
    const deliveryExpensePreview = useMemo(() => {
        const amount = parseAndEvaluate(deliveryExpenseAmount);
        if (!Number.isFinite(amount)) return null;
        return computeProjectExpensePreview({
            wallet: deliveryExpenseMethod,
            amount,
            rates: projectExpenseRates,
        });
    }, [deliveryExpenseAmount, deliveryExpenseMethod, projectExpenseRates]);
    const getPortfolioAssetStats = (currency: PortfolioCurrency) => (currency === 'USDT' ? portfolioStats.usdt : portfolioStats.eur);
    const getPortfolioInventory = (currency: PortfolioCurrency) => inventoryFromLegacyPortfolioStats(portfolioStats, currency);
    const getPortfolioRemovalCost = (currency: PortfolioCurrency, quantity: number) => roundM(getPortfolioAssetStats(currency).avgBuy * quantity);
    const activeClientTodayDelta = (clientId: string, timestamp: number) => {
        if (!clientId || clientId === 'none')
            return 0;
        const day = new Date(timestamp);
        day.setHours(0, 0, 0, 0);
        const dayStart = day.getTime();
        const dayEnd = dayStart + 86_400_000 - 1;
        return clientTransactionsDzd.some((tx) => tx.clientId === clientId && tx.timestamp >= dayStart && tx.timestamp <= dayEnd)
            ? 0
            : 1;
    };
    const clientBalanceTransition = (clientId: string, amountDelta: number, timestamp: number): ClientPositionDelta => {
        if (!clientId || clientId === 'none')
            return { receivablesDelta: 0, advancesDelta: 0 };
        const before = clientPositionFromLegacyRows(clientTransactionsDzd, clientId, timestamp).balanceDzd;
        return transitionClientBalanceDelta(before, before + amountDelta);
    };
    const periodProfitDeltas = (timestamp: number, profitDzd: number, ownerProfitDzd: number, currency?: PortfolioCurrency, quantity = 0) => {
        const nowDate = new Date();
        const dayStart = new Date(nowDate);
        dayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(nowDate);
        const dow = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
        weekStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
        const yearStart = new Date(nowDate.getFullYear(), 0, 1).getTime();
        const isToday = timestamp >= dayStart.getTime();
        const isWeek = timestamp >= weekStart.getTime();
        const isMonth = timestamp >= monthStart;
        const isYear = timestamp >= yearStart;
        return {
            todayProfitDelta: isToday ? profitDzd : 0,
            weekToDateProfitDelta: isWeek ? profitDzd : 0,
            monthToDateProfitDelta: isMonth ? profitDzd : 0,
            yearToDateProfitDelta: isYear ? profitDzd : 0,
            allTimeProfitDelta: profitDzd,
            todaySellCountDelta: isToday ? 1 : 0,
            todayUsdtSoldDelta: isToday && currency === 'USDT' ? quantity : 0,
            todayEurSoldDelta: isToday && currency === 'EUR' ? quantity : 0,
            monthToDateUsdtSoldDelta: isMonth && currency === 'USDT' ? quantity : 0,
            monthToDateEurSoldDelta: isMonth && currency === 'EUR' ? quantity : 0,
            yearToDateUsdtSoldDelta: isYear && currency === 'USDT' ? quantity : 0,
            yearToDateEurSoldDelta: isYear && currency === 'EUR' ? quantity : 0,
            allTimeUsdtSoldDelta: currency === 'USDT' ? quantity : 0,
            allTimeEurSoldDelta: currency === 'EUR' ? quantity : 0,
            ownerProfitTodayDelta: isToday ? ownerProfitDzd : 0,
            ownerProfitWeekDelta: isWeek ? ownerProfitDzd : 0,
            ownerProfitMonthDelta: isMonth ? ownerProfitDzd : 0,
            ownerProfitYearDelta: isYear ? ownerProfitDzd : 0,
            ownerProfitAllTimeDelta: ownerProfitDzd,
        };
    };

    /**
     * Build the read-model delta for a Buy (USDT with DZD/EUR, or EUR) creation.
     * Pure projection of the legacy financial effect — mirrors the create-path
     * writer selection exactly so the SAME function can compute both the OLD
     * delta (from the pre-edit legacy doc) and the NEW delta (from the edited
     * payload). The Edit delta is then:
     *   combineReadModelDeltas(invertReadModelDelta(oldDelta), newDelta)
     */
    const computeBuyReadModelDelta = (input: {
        mainTxId: string;
        operationId: string;
        timestamp: number;
        buyUsdtMode: 'with_dzd' | 'with_eur';
        mode: 'buy_usdt' | 'buy_eur';
        quantity: number;
        totalCost: number;
        eurSpentForConversion: number;
        currency: 'USDT' | 'EUR';
        clientPaymentStatus: 'cash' | 'baridi' | 'credit';
        linkedClientId: string;
        linkedClientDzdId: string;
        shouldLinkCashToDzdClient: boolean;
    }): ReadModelDelta => {
        const { mainTxId, operationId, timestamp, buyUsdtMode, quantity, totalCost, eurSpentForConversion, currency, clientPaymentStatus, linkedClientId, linkedClientDzdId, shouldLinkCashToDzdClient } = input;
        if (buyUsdtMode === 'with_eur') {
            return mustPrepareWriterReadModelDelta('portfolio.exchange', {
                operationId,
                effectiveAt: timestamp,
                payload: { type: 'portfolio_exchange_eur_to_usdt', txId: mainTxId, quantity, eurSpentForConversion, totalCost },
                affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'financial_summary'],
                portfolio: {
                    USDT: { quantityDelta: quantity, costBasisDeltaDzd: totalCost },
                    EUR: { quantityDelta: -eurSpentForConversion, costBasisDeltaDzd: -getPortfolioRemovalCost('EUR', eurSpentForConversion) },
                },
                recentOperation: { operationId, source: 'legacy', type: 'Achat USDT / EUR', effectiveAt: timestamp },
            });
        }
        if (clientPaymentStatus === 'credit' || shouldLinkCashToDzdClient) {
            const clientId = shouldLinkCashToDzdClient ? linkedClientDzdId : linkedClientId;
            const clientsDelta = clientBalanceTransition(clientId, totalCost, timestamp);
            clientsDelta.activeClientsTodayDelta = activeClientTodayDelta(clientId, timestamp);
            return mustPrepareWriterReadModelDelta('portfolio.buy-credit', {
                operationId,
                effectiveAt: timestamp,
                payload: { type: 'portfolio_buy_credit', txId: mainTxId, clientId, quantity, currency, totalCost },
                affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'clients_summary', 'financial_summary'],
                portfolio: { [currency]: { quantityDelta: quantity, costBasisDeltaDzd: totalCost } },
                clients: clientsDelta,
                recentOperation: { operationId, source: 'legacy', type: `Achat ${currency}`, effectiveAt: timestamp },
            });
        }
        const wallet = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
        return mustPrepareWriterReadModelDelta('portfolio.buy-cash', {
            operationId,
            effectiveAt: timestamp,
            payload: { type: 'portfolio_buy_cash', txId: mainTxId, wallet, quantity, currency, totalCost },
            affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'treasury_summary', 'financial_summary'],
            wallets: { [wallet]: -totalCost },
            portfolio: { [currency]: { quantityDelta: quantity, costBasisDeltaDzd: totalCost } },
            recentOperation: { operationId, source: 'legacy', type: `Achat ${currency}`, effectiveAt: timestamp },
        });
    };

    /**
     * Build the read-model delta for a Sell (USDT DZD/EUR, or EUR) creation.
     * Mirrors the create-path writer selection for both OLD and NEW projections.
     */
    const computeSellReadModelDelta = (input: {
        committedSellTxId: string;
        operationId: string;
        timestamp: number;
        sellCurrency: 'USDT' | 'EUR';
        quantity: number;
        sell: number;
        totalRevenue: number;
        profit: number;
        notes: string;
        isUsdtSettledInEur: boolean;
        saleValueEur: number;
        saleValueDzd: number;
        linkedClientId: string;
        clientPaymentStatus: 'cash' | 'baridi' | 'credit';
        creditDueDate?: number;
        shouldLinkSettlementToDzdClient: boolean;
        linkedClientDzdId: string;
        excludeTxIds?: readonly string[];
    }): ReadModelDelta => {
        const { committedSellTxId, operationId, timestamp, sellCurrency, quantity, sell, totalRevenue, profit, notes, isUsdtSettledInEur, saleValueEur, saleValueDzd, linkedClientId, clientPaymentStatus, creditDueDate, shouldLinkSettlementToDzdClient, linkedClientDzdId, excludeTxIds } = input;
        const portfolioDelta = {
            [sellCurrency]: {
                quantityDelta: -quantity,
                costBasisDeltaDzd: -getPortfolioRemovalCost(sellCurrency, quantity),
                realizedProfitDeltaDzd: profit,
                soldQuantityDelta: quantity,
            },
        };
        if (isUsdtSettledInEur) {
            return mustPrepareWriterReadModelDelta('portfolio.exchange', {
                operationId: `${operationId}:usdt-to-eur`,
                effectiveAt: timestamp,
                payload: { type: 'portfolio_exchange_usdt_to_eur', quantity, saleValueEur, saleValueDzd },
                affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'financial_summary'],
                portfolio: {
                    USDT: { quantityDelta: -quantity, costBasisDeltaDzd: -getPortfolioRemovalCost('USDT', quantity) },
                    EUR: { quantityDelta: saleValueEur, costBasisDeltaDzd: totalRevenue },
                },
                recentOperation: { operationId: `${operationId}:usdt-to-eur`, source: 'legacy', type: 'Vente USDT / EUR', effectiveAt: timestamp },
            });
        }
        const readModelSellTx: Tx = {
            id: committedSellTxId,
            timestamp,
            type: 'sell',
            quantity,
            sell,
            total: totalRevenue,
            profit,
            date: '',
            time: '',
            notes: notes.trim(),
            currency: sellCurrency,
            linkedClientId,
            clientPaymentStatus,
            settlementCurrency: 'DZD',
            ...(clientPaymentStatus === 'credit' ? { creditDueDate: String(creditDueDate) } : {}),
            ...(shouldLinkSettlementToDzdClient ? { linkedClientDzdId } : {}),
        };
        const sellEconomics = derivePortfolioSellReadModelEconomics({
            transactions,
            sellTx: readModelSellTx,
            fallbackProfitDzd: profit,
            fallbackCostBasisDzd: getPortfolioRemovalCost(sellCurrency, quantity),
            nowMs: timestamp,
            excludeTxIds,
        });
        portfolioDelta[sellCurrency].costBasisDeltaDzd = -sellEconomics.soldCostDzd;
        portfolioDelta[sellCurrency].realizedProfitDeltaDzd = sellEconomics.realizedProfitDzd;
        const realizedProfit = sellEconomics.realizedProfitDzd;
        const allocation = allocateProfitDeltaAtTimestamp({
            investors,
            investorTransactions,
            treasuryTransactions,
            personalExpenses,
            managerFeePercentage,
            managerFeeHistory,
            projectProfitDzd: realizedProfit,
            timestamp,
        });
        if (clientPaymentStatus === 'credit' || shouldLinkSettlementToDzdClient) {
            const clientId = shouldLinkSettlementToDzdClient ? linkedClientDzdId : linkedClientId;
            const clientsDelta = clientBalanceTransition(clientId, -totalRevenue, timestamp);
            clientsDelta.activeClientsTodayDelta = activeClientTodayDelta(clientId, timestamp);
            return mustPrepareWriterReadModelDelta('portfolio.sell-credit', {
                operationId,
                effectiveAt: timestamp,
                payload: { type: 'portfolio_sell_credit', clientId, quantity, sellCurrency, totalRevenue, storedProfit: profit, realizedProfit, allocation },
                affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'clients_summary', 'investors_summary', 'financial_summary'],
                portfolio: portfolioDelta,
                clients: clientsDelta,
                investors: {
                    externalInvestorProfitsDelta: allocation.externalInvestorProfitsDeltaDzd,
                    investorLiabilityDelta: allocation.investorLiabilityDeltaDzd,
                    managerTradingOwnerProfitDelta: allocation.managerProfitDeltaDzd,
                    managerActualOwnerCapitalDelta: allocation.managerProfitDeltaDzd,
                    globalNetProfitDelta: allocation.projectProfitDzd,
                },
                dashboardDaily: periodProfitDeltas(timestamp, realizedProfit, allocation.managerProfitDeltaDzd, sellCurrency, quantity),
                recentOperation: { operationId, source: 'legacy', type: `Vente ${sellCurrency}`, effectiveAt: timestamp },
            });
        }
        const wallet = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
        return mustPrepareWriterReadModelDelta('portfolio.sell-cash', {
            operationId,
            effectiveAt: timestamp,
            payload: { type: 'portfolio_sell_cash', wallet, quantity, sellCurrency, totalRevenue, storedProfit: profit, realizedProfit, allocation },
            affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'treasury_summary', 'investors_summary', 'financial_summary'],
            wallets: { [wallet]: totalRevenue },
            portfolio: portfolioDelta,
            investors: {
                externalInvestorProfitsDelta: allocation.externalInvestorProfitsDeltaDzd,
                investorLiabilityDelta: allocation.investorLiabilityDeltaDzd,
                managerTradingOwnerProfitDelta: allocation.managerProfitDeltaDzd,
                managerActualOwnerCapitalDelta: allocation.managerProfitDeltaDzd,
                globalNetProfitDelta: allocation.projectProfitDzd,
            },
            dashboardDaily: periodProfitDeltas(timestamp, realizedProfit, allocation.managerProfitDeltaDzd, sellCurrency, quantity),
            recentOperation: { operationId, source: 'legacy', type: `Vente ${sellCurrency}`, effectiveAt: timestamp },
        });
    };

    const usdtFromEurCalc = useMemo(() => {
        const eurQty = parseAndEvaluate(buyEurForUsdtAmount);
        const eurPrice = parseAndEvaluate(eurDzdPrice);
        const rate = parseAndEvaluate(eurUsdtRate);
        if (eurQty <= 0 || eurPrice <= 0 || rate <= 0)
            return null;
        return { usdtQty: eurQty / rate, usdtPriceDzd: eurPrice * rate, totalCostDzd: (eurQty / rate) * (eurPrice * rate) };
    }, [buyEurForUsdtAmount, eurDzdPrice, eurUsdtRate]);
    const formValidation = useMemo(() => {
        const errors: Record<string, string> = {};
        let isValid = true;
        const addError = (field: string, msg: string) => {
            errors[field] = msg;
            isValid = false;
        };
        const linkedEurWithdrawalOnEdit = editingTx
            ? transactions.find((tx) => tx.linkedTxId === editingTx.id &&
                tx.type === 'Retrait Manuel' &&
                tx.currency === 'EUR')
            : null;
        const linkedEurQtyOnEdit = Number(linkedEurWithdrawalOnEdit?.quantity || 0);
        const eurAvailableForBuy = portfolioStats.eur.available + (linkedEurQtyOnEdit > 0 ? linkedEurQtyOnEdit : 0);
        if (mode === 'buy_usdt') {
            if (buyUsdtMode === 'with_dzd') {
                if (parseAndEvaluate(buyUsdtAmount) <= 0)
                    addError('buyUsdtAmount', 'Veuillez entrer la quantité');
                if (parseAndEvaluate(buyUsdtPrice) <= 0)
                    addError('buyUsdtPrice', 'Veuillez entrer le prix');
                if (parseAndEvaluate(buyUsdtTotal) <= 0)
                    addError('buyUsdtTotal', 'Montant total invalide');
                if (!linkedClientId || linkedClientId === '' || linkedClientId === 'none')
                    addError('linkedClientId', 'Veuillez sélectionner un client');
                if (clientPaymentStatus === 'cash' && linkedClientDzdId && linkedClientDzdId !== 'none' && linkedClientDzdId === linkedClientId) {
                    addError('linkedClientDzdId', 'Le client DZD doit etre different du client principal');
                }
            }
            else if (buyUsdtMode === 'with_eur') {
                if (parseAndEvaluate(buyEurForUsdtAmount) <= 0)
                    addError('buyEurForUsdtAmount', 'Quantité requise');
                if (parseAndEvaluate(eurDzdPrice) <= 0)
                    addError('eurDzdPrice', 'Prix requis');
                if (parseAndEvaluate(eurUsdtRate) <= 0)
                    addError('eurUsdtRate', 'Taux requis');
                if (parseAndEvaluate(buyEurForUsdtAmount) > eurAvailableForBuy)
                    addError('buyEurForUsdtAmount', 'Solde insuffisant');
            }
        }
        else if (mode === 'buy_eur') {
            if (parseAndEvaluate(buyEurAmount) <= 0)
                addError('buyEurAmount', 'Quantité requise');
            if (parseAndEvaluate(buyEurPrice) <= 0)
                addError('buyEurPrice', 'Prix requis');
            if (parseAndEvaluate(buyEurTotal) <= 0)
                addError('buyEurTotal', 'Montant total invalide');
            if (!linkedClientId || linkedClientId === '' || linkedClientId === 'none')
                addError('linkedClientId', 'Veuillez sélectionner un client');
            if (clientPaymentStatus === 'credit') {
                if (!creditDueDate)
                    addError('creditDueDate', "Date d'échéance requise");
                else if (Date.parse(`${creditDueDate}T23:59:59`) <= Date.now())
                    addError('creditDueDate', "L'échéance doit être future");
            }
            if (clientPaymentStatus === 'cash' && linkedClientDzdId && linkedClientDzdId !== 'none' && linkedClientDzdId === linkedClientId) {
                addError('linkedClientDzdId', 'Le client DZD doit etre different du client principal');
            }
        }
        else if (mode === 'sell_usdt' || mode === 'sell_eur') {
            const amt = parseAndEvaluate(sellAmount);
            const sellCurrency: PortfolioCurrency = mode === 'sell_eur' ? 'EUR' : 'USDT';
            const isUsdtSettledInEur = sellCurrency === 'USDT' && sellSettlementCurrency === 'EUR';
            const canUseLinkedDzdClient = !isUsdtSettledInEur && (clientPaymentStatus === 'cash' || clientPaymentStatus === 'baridi');
            const readOnlyEurToDzdRate = Number(portfolioStats.eur.avgBuy || 0);
            if (amt <= 0)
                addError('sellAmount', 'Quantité requise');
            if (parseAndEvaluate(sellPrice) <= 0)
                addError('sellPrice', 'Prix requis');
            if (parseAndEvaluate(sellTotal) <= 0)
                addError('sellTotal', 'Montant total invalide');
            if (isUsdtSettledInEur && readOnlyEurToDzdRate <= 0)
                addError('sellEurToDzdRate', 'Taux EUR/DZD requis');
            const avail = getPortfolioAssetStats(sellCurrency).available + (editingTx?.type === 'sell' ? editingTx.quantity : 0);
            if (amt > avail)
                addError('sellAmount', 'Solde insuffisant');
            if (!linkedClientId || linkedClientId === '' || linkedClientId === 'none')
                addError('linkedClientId', 'Veuillez sélectionner un client');
            if (canUseLinkedDzdClient && linkedClientDzdId && linkedClientDzdId !== 'none' && linkedClientDzdId === linkedClientId) {
                addError('linkedClientDzdId', 'Le client DZD doit etre different du client principal');
            }
        }
        return { isValid, errors };
    }, [mode, buyUsdtMode, buyUsdtAmount, buyUsdtPrice, buyUsdtTotal, buyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, buyEurAmount, buyEurPrice, buyEurTotal, sellAmount, sellPrice, sellTotal, sellSettlementCurrency, sellEurToDzdRate, portfolioStats, editingTx, linkedClientId, linkedClientDzdId, clientPaymentStatus, creditDueDate, transactions]);
    const openForm = (newMode: TransactionFormMode, txToEdit: Tx | null = null, prefill?: PrefillSell) => {
        setBuyUsdtAmount('');
        setBuyUsdtPrice('');
        setBuyEurAmount('');
        setBuyEurPrice('');
        setSellAmount(prefill?.sellQty ?? '');
        setSellPrice(prefill?.sellPrice ?? '');
        const prefillQty = parseAndEvaluate(prefill?.sellQty || '');
        const prefillPrice = parseAndEvaluate(prefill?.sellPrice || '');
        setSellTotal(prefillQty > 0 && prefillPrice > 0 ? String(Math.round(prefillQty * prefillPrice)) : '');
        setProfitPercent('');
        setNotes('');
        setBuyUsdtMode(null);
        setBuyRestriction('free');
        setRealPurchaseTime('');
        setBuyEurForUsdtAmount('');
        setEurDzdPrice('');
        setEurUsdtRate('');
        setSellSettlementCurrency('DZD');
        setSellEurToDzdRate('');
        setBuyUsdtTotal('');
        setBuyEurTotal('');
        setClientPaymentStatus(prefill?.paymentStatus ?? 'cash');
        setCreditDueDate(prefill?.creditDueDate ?? '');
        setPendingCreditRisk(null);
        setEditingTx(txToEdit);
        setMode(newMode);
        setIsTotalManual(false);
        setLinkedClientId(prefill?.clientId ?? 'none');
        setLinkedClientDzdId('none');
        if (txToEdit) {
            if (txToEdit.type === 'buy') {
                if (txToEdit.currency === 'USDT') {
                    const linkedEurWithdrawal = transactions.find((tx) => tx.linkedTxId === txToEdit.id &&
                        tx.type === 'Retrait Manuel' &&
                        tx.currency === 'EUR');
                    if (linkedEurWithdrawal) {
                        setBuyUsdtMode('with_eur');
                        const usdtQty = Number(txToEdit.quantity || 0);
                        const eurSpent = Number(linkedEurWithdrawal.quantity || 0);
                        const inferredRate = usdtQty > 0 ? (eurSpent / usdtQty) : 0;
                        const inferredEurPrice = inferredRate > 0
                            ? Number(txToEdit.price || 0) / inferredRate
                            : 0;
                        setBuyEurForUsdtAmount(eurSpent > 0 ? eurSpent.toFixed(2) : '');
                        setEurUsdtRate(inferredRate > 0 ? inferredRate.toFixed(4) : '');
                        setEurDzdPrice(inferredEurPrice > 0 ? inferredEurPrice.toFixed(2) : '');
                        if (txToEdit.lockedUntil && txToEdit.lockedUntil > Date.now()) {
                            setBuyRestriction('locked_24h');
                            const pd = new Date(txToEdit.lockedUntil - 24 * 60 * 60 * 1000);
                            setRealPurchaseTime(`${String(pd.getHours()).padStart(2, '0')}:${String(pd.getMinutes()).padStart(2, '0')}`);
                        }
                    }
                    else {
                        setBuyUsdtMode('with_dzd');
                        setBuyUsdtAmount(Number(txToEdit.quantity || 0).toFixed(2));
                        setBuyUsdtPrice((txToEdit.price ?? 0).toString());
                        const existingTotal = Number(txToEdit.total || 0);
                        const fallbackTotal = Math.round((txToEdit.quantity || 0) * (txToEdit.price || 0));
                        setBuyUsdtTotal((existingTotal > 0 ? Math.round(existingTotal) : fallbackTotal).toString());
                        if (txToEdit.lockedUntil && txToEdit.lockedUntil > Date.now()) {
                            setBuyRestriction('locked_24h');
                            const pd = new Date(txToEdit.lockedUntil - 24 * 60 * 60 * 1000);
                            setRealPurchaseTime(`${String(pd.getHours()).padStart(2, '0')}:${String(pd.getMinutes()).padStart(2, '0')}`);
                        }
                    }
                }
                else {
                    setBuyEurAmount(txToEdit.quantity.toString());
                    setBuyEurPrice((txToEdit.price ?? 0).toString());
                    const existingTotal = Number(txToEdit.total || 0);
                    const fallbackTotal = Math.round((txToEdit.quantity || 0) * (txToEdit.price || 0));
                    setBuyEurTotal((existingTotal > 0 ? Math.round(existingTotal) : fallbackTotal).toString());
                }
            }
            else {
                const sellCurrency: PortfolioCurrency = txToEdit.currency === 'EUR' ? 'EUR' : 'USDT';
                const sellAssetStats = getPortfolioAssetStats(sellCurrency);
                const existingSettlementCurrency: SettlementCurrency = sellCurrency === 'USDT' && txToEdit.settlementCurrency === 'EUR' ? 'EUR' : 'DZD';
                setSellAmount(Number(txToEdit.quantity || 0).toFixed(2));
                setSellSettlementCurrency(existingSettlementCurrency);
                setSellPrice((existingSettlementCurrency === 'EUR' ? (txToEdit.sellPriceEur ?? 0) : (txToEdit.sell ?? 0)).toString());
                setSellEurToDzdRate(existingSettlementCurrency === 'EUR' && txToEdit.eurToDzdRateAtSale
                    ? txToEdit.eurToDzdRateAtSale.toString()
                    : '');
                const existingTotal = Number(existingSettlementCurrency === 'EUR' ? txToEdit.saleValueEur : txToEdit.total || 0);
                const fallbackTotal = (txToEdit.quantity || 0) * (existingSettlementCurrency === 'EUR'
                    ? Number(txToEdit.sellPriceEur || 0)
                    : Number(txToEdit.sell || 0));
                setSellTotal((existingTotal > 0 ? existingTotal : fallbackTotal).toString());
                if (sellAssetStats.avgBuy > 0 && txToEdit.sell) {
                    const margin = txToEdit.sell - sellAssetStats.avgBuy;
                    setProfitPercent(margin.toFixed(2));
                }
            }
            setNotes(txToEdit.notes ?? '');
            setTxTags(Array.isArray(txToEdit.tags) ? txToEdit.tags : []);
            const linkedDzdTxs = clientTransactionsDzd.filter(t => t.linkedTxId === txToEdit.id);
            const primaryLinkedTx = linkedDzdTxs.find(t => t.linkRole !== 'dzd_receiver') || linkedDzdTxs[0];
            const linkedDzdCollectorTx = linkedDzdTxs.find(t => t.linkRole === 'dzd_receiver');
            if (primaryLinkedTx) {
                setLinkedClientId(primaryLinkedTx.clientId);
                if (primaryLinkedTx.paymentMethod === 'Crédit')
                    setClientPaymentStatus('credit');
                else if (primaryLinkedTx.paymentMethod === 'BaridiMob')
                    setClientPaymentStatus('baridi');
                else
                    setClientPaymentStatus('cash');
            }
            else if (txToEdit.linkedClientId) {
                setLinkedClientId(txToEdit.linkedClientId);
                if (txToEdit.clientPaymentStatus)
                    setClientPaymentStatus(txToEdit.clientPaymentStatus);
            }
            setCreditDueDate(txToEdit.creditDueDate || primaryLinkedTx?.creditDueDate || '');
            if (linkedDzdCollectorTx)
                setLinkedClientDzdId(linkedDzdCollectorTx.clientId);
            else if (txToEdit.linkedClientDzdId)
                setLinkedClientDzdId(txToEdit.linkedClientDzdId);
        }
        else {
            if (newMode === 'buy_eur' && portfolioStats.eur.avgBuy > 0)
                setBuyEurPrice(portfolioStats.eur.avgBuy.toFixed(2));
            if (newMode === 'sell_usdt' && portfolioStats.eur.avgBuy > 0)
                setSellEurToDzdRate(portfolioStats.eur.avgBuy.toFixed(2));
        }
    };
    const closeForm = () => { setMode(null); setEditingTx(null); setBuyUsdtMode(null); setBuyRestriction('free'); setRealPurchaseTime(''); setSellTotal(''); setBuyUsdtTotal(''); setBuyEurTotal(''); setSellSettlementCurrency('DZD'); setSellEurToDzdRate(''); setLinkedClientDzdId('none'); setCreditDueDate(''); setPendingCreditRisk(null); setIsTotalManual(false); setTxTags([]); };
    const computeLockedUntil = (baseTs: number): number => {
        const t = realPurchaseTime.trim();
        if (!t) return baseTs + 24 * 60 * 60 * 1000;
        const parts = t.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1] || '0', 10);
        if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59)
            return baseTs + 24 * 60 * 60 * 1000;
        const d = new Date(baseTs);
        d.setHours(h, m, 0, 0);
        return d.getTime() + 24 * 60 * 60 * 1000;
    };
    const handleBuy = async () => {
        if (!formValidation.isValid || isSaving)
            return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            let quantity = 0, price = 0, currency = 'USDT';
            let eurSpentForConversion = 0;
            const mainTxRef = editingTx
                ? userDocRef.collection('usdt_txs').doc(editingTx.id)
                : userDocRef.collection('usdt_txs').doc();
            const mainTxId = mainTxRef.id;
            if (mode === 'buy_usdt') {
                if (buyUsdtMode === 'with_dzd') {
                    // FIX-10 (Q2 reversal): preserve up to 2 decimals so the user can send the
                    // exact amount to the client (e.g. 100.50 USDT, not rounded to 101).
                    quantity = roundM(parseAndEvaluate(buyUsdtAmount));
                    price = parseAndEvaluate(buyUsdtPrice);
                }
                else {
                    eurSpentForConversion = parseAndEvaluate(buyEurForUsdtAmount);
                    quantity = roundM(usdtFromEurCalc!.usdtQty);
                    price = usdtFromEurCalc!.usdtPriceDzd;
                }
            }
            else {
                currency = 'EUR';
                quantity = roundM(parseAndEvaluate(buyEurAmount));
                price = parseAndEvaluate(buyEurPrice);
            }
            let totalCost = quantity * price;
            if (isTotalManual) {
                if (mode === 'buy_usdt' && buyUsdtMode === 'with_dzd')
                    totalCost = parseAndEvaluate(buyUsdtTotal);
                else if (mode === 'buy_eur')
                    totalCost = parseAndEvaluate(buyEurTotal);
            }
            if (mode === 'buy_usdt' && buyUsdtMode === 'with_eur' && usdtFromEurCalc) {
                totalCost = usdtFromEurCalc.totalCostDzd;
            }
            totalCost = Math.round(totalCost);
            const buyMetadata: any = {
                purchaseFundingCurrency: mode === 'buy_usdt' && buyUsdtMode === 'with_eur' ? 'EUR' : 'DZD'
            };
            if (mode === 'buy_usdt' && buyUsdtMode === 'with_eur') {
                buyMetadata.purchaseAmountEur = eurSpentForConversion;
                buyMetadata.eurToDzdRateAtPurchase = parseAndEvaluate(eurDzdPrice);
                buyMetadata.eurPerUsdtAtPurchase = parseAndEvaluate(eurUsdtRate);
            }
            const { date, time, timestamp } = now();
            const shouldLinkCashToDzdClient = clientPaymentStatus === 'cash' && linkedClientDzdId !== 'none';
            const createLinkedEurConversionTx = () => {
                if (mode !== 'buy_usdt' || buyUsdtMode !== 'with_eur' || eurSpentForConversion <= 0)
                    return;
                batch.set(userDocRef.collection('usdt_txs').doc(), {
                    timestamp: timestamp - 1,
                    type: 'Retrait Manuel',
                    currency: 'EUR',
                    quantity: eurSpentForConversion,
                    date,
                    time,
                    notes: `Achat de ${formatNumber(quantity, { min: 0, max: 2 })} USDT`,
                    linkedTxId: mainTxId
                });
            };
            if (editingTx) {
                batch.update(mainTxRef, {
                    quantity, price, total: totalCost, notes: notes.trim(),
                    tags: txTags.length > 0 ? txTags : fieldValueDelete(),
                    sell: fieldValueDelete(), profit: fieldValueDelete(),
                    settlementCurrency: fieldValueDelete(),
                    sellPriceEur: fieldValueDelete(),
                    saleValueEur: fieldValueDelete(),
                    eurToDzdRateAtSale: fieldValueDelete(),
                    purchaseAmountEur: fieldValueDelete(),
                    eurToDzdRateAtPurchase: fieldValueDelete(),
                    eurPerUsdtAtPurchase: fieldValueDelete(),
                    lockedUntil: buyRestriction === 'locked_24h'
                        ? computeLockedUntil(editingTx?.timestamp ?? timestamp)
                        : fieldValueDelete(),
                    currency, clientPaymentStatus: clientPaymentStatus,
                    ...buyMetadata
                });
                const qsClient = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', editingTx.id).get();
                qsClient.forEach(d => batch.delete(d.ref));
                const qsTreasury = await userDocRef.collection('treasury_txs').where('linkedTxId', '==', editingTx.id).get();
                qsTreasury.forEach(d => batch.delete(d.ref));
                const qsLinkedUsdt = await userDocRef.collection('usdt_txs').where('linkedTxId', '==', editingTx.id).get();
                qsLinkedUsdt.forEach(d => batch.delete(d.ref));
                createLinkedEurConversionTx();
                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: totalCost,
                        type: 'Règlement Reçu', notes: `Financement achat de ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`,
                        linkedTxId: editingTx.id,
                        linkRole: 'primary',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: affectsClientBalance(clientPaymentStatus)
                    });
                }
                if (shouldLinkCashToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: totalCost,
                        type: 'Ajustement Solde', notes: appendOriginalClientToNote(`Avance DZD liée à achat de ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`, linkedClientId),
                        linkedTxId: editingTx.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus['credit'],
                        affectsBalance: true
                    });
                }
                if (buyUsdtMode !== 'with_eur' && clientPaymentStatus !== 'credit' && !shouldLinkCashToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Retrait', source, amount: totalCost,
                        notes: `Achat ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`, linkedTxId: editingTx.id
                    });
                }
                setAlert('✅ Transaction mise à jour.');
            }
            else {
                batch.set(mainTxRef, {
                    timestamp, type: 'buy', quantity, price, total: totalCost,
                    date, time, notes: notes.trim(),
                    ...(txTags.length > 0 ? { tags: txTags } : {}),
                    ...(buyRestriction === 'locked_24h' ? { lockedUntil: computeLockedUntil(timestamp) } : {}),
                    currency, clientPaymentStatus: clientPaymentStatus,
                    ...buyMetadata
                });
                createLinkedEurConversionTx();
                if (buyUsdtMode !== 'with_eur' && clientPaymentStatus !== 'credit' && !shouldLinkCashToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Retrait', source, amount: totalCost,
                        notes: `Achat ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`, linkedTxId: mainTxRef.id
                    });
                }
                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: totalCost,
                        type: 'Règlement Reçu', notes: `Financement achat de ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`,
                        linkedTxId: mainTxRef.id,
                        linkRole: 'primary',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: affectsClientBalance(clientPaymentStatus)
                    });
                }
                if (shouldLinkCashToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: totalCost,
                        type: 'Ajustement Solde', notes: appendOriginalClientToNote(`Avance DZD liée à achat de ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`, linkedClientId),
                        linkedTxId: mainTxRef.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus['credit'],
                        affectsBalance: true
                    });
                }
                setAlert('✅ Transaction ajoutée.');
            }
            if (buyUsdtMode !== 'with_eur' && clientPaymentStatus !== 'credit' && !shouldLinkCashToDzdClient) {
                const wallet = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                recordTreasuryShadow({
                    operationId: `shadow:portfolio-buy:${mainTxId}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'portfolio_purchase_cash',
                    wallet,
                    amountDzd: totalCost,
                    currency: currency as PortfolioCurrency,
                }, [{ type: 'Retrait', source: wallet, amount: totalCost }]);
            }
            const portfolioWarnings = editingTx
                ? ['Legacy update replaces existing Portfolio rows; V2 uses an immutable future reversal and is not active yet.']
                : [];
            if (buyUsdtMode === 'with_eur') {
                const eurRate = parseAndEvaluate(eurDzdPrice);
                recordPortfolioShadow({
                    operationId: `shadow:portfolio-exchange-eur-to-usdt:${mainTxId}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'portfolio_exchange_eur_to_usdt',
                    fromCurrency: 'EUR',
                    toCurrency: 'USDT',
                    quantityOut: eurSpentForConversion,
                    quantityIn: quantity,
                    fromInventoryBefore: getPortfolioInventory('EUR'),
                    exchangeValueDzd: usdtFromEurCalc?.totalCostDzd || 0,
                    fromQuotedValueDzd: eurSpentForConversion * eurRate,
                    toQuotedValueDzd: quantity * price,
                }, {
                    quantityDeltas: { USDT: quantity, EUR: -eurSpentForConversion },
                    costBasisDeltasDzd: { USDT: totalCost, EUR: -getPortfolioRemovalCost('EUR', eurSpentForConversion) },
                    warnings: portfolioWarnings,
                });
            }
            else if (clientPaymentStatus === 'credit' || shouldLinkCashToDzdClient) {
                recordPortfolioShadow({
                    operationId: `shadow:portfolio-buy-credit:${mainTxId}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'portfolio_purchase_credit',
                    currency: currency as PortfolioCurrency,
                    quantity,
                    inventoryBefore: getPortfolioInventory(currency as PortfolioCurrency),
                    clientId: shouldLinkCashToDzdClient ? linkedClientDzdId : linkedClientId,
                    valueDzd: totalCost,
                }, {
                    quantityDeltas: { [currency]: quantity },
                    costBasisDeltasDzd: { [currency]: totalCost },
                    clientPayableDzd: totalCost,
                    warnings: portfolioWarnings,
                });
            }
            else {
                const wallet = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                recordPortfolioShadow({
                    operationId: `shadow:portfolio-buy-cash:${mainTxId}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'portfolio_purchase_cash',
                    currency: currency as PortfolioCurrency,
                    quantity,
                    inventoryBefore: getPortfolioInventory(currency as PortfolioCurrency),
                    wallet,
                    valueDzd: totalCost,
                }, {
                    quantityDeltas: { [currency]: quantity },
                    costBasisDeltasDzd: { [currency]: totalCost },
                    cashDeltasDzd: { [wallet]: -totalCost },
                    warnings: portfolioWarnings,
                });
            }
            if (!editingTx && clientPaymentStatus === 'credit' && linkedClientId !== 'none') {
                recordClientShadow({
                    operationId: `shadow:client-credit-purchase:${mainTxId}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'client_credit_purchase',
                    amountDzd: totalCost,
                    counterparty: { kind: 'client', id: linkedClientId },
                }, { clientDeltas: { [linkedClientId]: totalCost }, clientPayableDzd: totalCost });
            }
            else if (!editingTx && shouldLinkCashToDzdClient) {
                recordClientShadow({
                    operationId: `shadow:client-buy-collector-adjustment:${mainTxId}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp + 1,
                    kind: 'client_balance_adjustment',
                    clientId: linkedClientDzdId,
                    amountDzd: totalCost,
                    positionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, linkedClientDzdId, timestamp),
                    reason: 'Avance DZD liée à achat de devise',
                    counterpartAccount: 'equity.client_balance_correction',
                }, { clientDeltas: { [linkedClientDzdId]: totalCost } });
            }
            const editMutationSeq = editingTx ? timestamp : 0;
                        const newBuyOperationId = `legacy:edit:usdt_txs:${mainTxId}:${editMutationSeq}:new`;
                        const newBuyDelta = computeBuyReadModelDelta({
                            mainTxId,
                            operationId: newBuyOperationId,
                            timestamp,
                            buyUsdtMode,
                            mode,
                            quantity,
                            totalCost,
                            eurSpentForConversion,
                            currency: (currency === 'EUR' ? 'EUR' : 'USDT') as 'USDT' | 'EUR',
                            clientPaymentStatus,
                            linkedClientId,
                            linkedClientDzdId,
                            shouldLinkCashToDzdClient,
                        });
                        const readModelDelta = !editingTx
                            ? newBuyDelta
                            : await (async () => {
                                // Read legacy buy tx + linked rows for OLD delta
                                const legacyResult = await readUsdtTxLegacy(mainTxId, userDocRef);
                                if (!legacyResult.main) {
                                    console.error('Legacy buy tx not found for edit:', mainTxId);
                                    return newBuyDelta;
                                }
                                const oldMain = legacyResult.main as any;
                                // Extract linked client metadata from actual linked rows
                                const linkedClientRows = legacyResult.linkedRows.filter(r => r.collection === 'dzd_client_txs');
                                const linkedClientRow = linkedClientRows[0]?.data as any;
                                const oldLinkedClientId = (oldMain.linkedClientId || linkedClientRow?.clientId || 'none') as string;
                                const oldLinkedClientDzdId = (oldMain.linkedClientDzdId || linkedClientRow?.linkedClientDzdId || 'none') as string;
                                const oldClientPaymentStatus = (oldMain.clientPaymentStatus || linkedClientRow?.paymentMethod || 'cash') as 'cash' | 'baridi' | 'credit';
                                const oldShouldLinkCashToDzdClient = (oldClientPaymentStatus === 'cash' || oldClientPaymentStatus === 'baridi') && oldLinkedClientDzdId !== 'none';
                                const oldCurrency = (oldMain.currency === 'EUR' ? 'EUR' : 'USDT') as 'USDT' | 'EUR';
                                const oldPurchaseFundingCurrency = oldMain.purchaseFundingCurrency === 'EUR' ? 'EUR' : 'DZD';
                                const oldBuyUsdtMode: 'with_dzd' | 'with_eur' = mode === 'buy_eur' ? 'with_dzd' : (oldPurchaseFundingCurrency === 'EUR' ? 'with_eur' : 'with_dzd');
                                const oldMode: 'buy_usdt' | 'buy_eur' = mode === 'buy_eur' ? 'buy_eur' : 'buy_usdt';
                                const oldQuantity = roundM(Number(oldMain.quantity || 0));
                                const oldPrice = Number(oldMain.price || 0);
                                const oldTotalCost = Math.round(oldQuantity * oldPrice);
                                const oldEurSpent = oldPurchaseFundingCurrency === 'EUR' ? roundM(Number(oldMain.purchaseAmountEur || oldMain.eurSpentForConversion || 0)) : 0;
                                const oldBuyDelta = computeBuyReadModelDelta({
                                    mainTxId,
                                    operationId: `legacy:edit:usdt_txs:${mainTxId}:${editMutationSeq}:old`,
                                    timestamp: Number(oldMain.timestamp || timestamp),
                                    buyUsdtMode: oldBuyUsdtMode,
                                    mode: oldMode,
                                    quantity: oldQuantity,
                                    totalCost: oldTotalCost,
                                    eurSpentForConversion: oldEurSpent,
                                    currency: oldCurrency,
                                    clientPaymentStatus: oldClientPaymentStatus,
                                    linkedClientId: oldLinkedClientId,
                                    linkedClientDzdId: oldLinkedClientDzdId,
                                    shouldLinkCashToDzdClient: oldShouldLinkCashToDzdClient,
                                });
                                return combineReadModelDeltas(invertReadModelDelta(oldBuyDelta), newBuyDelta);
                            })();
                        await commitLegacyWithReadModelDeltas({
                            userDocRef,
                            batch,
                            deltas: readModelDelta ? [readModelDelta] : [],
                        });
            closeForm();
            if (linkedClientId !== 'none') {
                setTimeout(() => {
                    setSelectedClientId(linkedClientId);
                    setView('dzd');
                }, 100);
            }
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de l’achat.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const executeSell = async (acknowledgedFingerprint?: string) => {
        if (!formValidation.isValid || isSaving)
            return;
        setIsSaving(true);
        try {
            const sellCurrency: PortfolioCurrency = mode === 'sell_eur' ? 'EUR' : 'USDT';
            const clientTxType = sellCurrency === 'EUR' ? 'Vente EUR' : 'Vente USDT';
            const sellAssetStats = getPortfolioAssetStats(sellCurrency);
            const isUsdtSettledInEur = sellCurrency === 'USDT' && sellSettlementCurrency === 'EUR';
            // FIX-10 (Q2 reversal): preserve up to 2 decimals (see handleBuy comment).
            const quantity = roundM(parseAndEvaluate(sellAmount));
            const inputSellPrice = parseAndEvaluate(sellPrice);
            const eurToDzdRateAtSale = isUsdtSettledInEur
                ? Number(portfolioStats.eur.avgBuy || 0)
                : parseAndEvaluate(sellEurToDzdRate);
            const avg = sellAssetStats.avgBuy;
            const totalInput = parseAndEvaluate(sellTotal);
            let saleValueEur = 0;
            let saleValueDzd = 0;
            let sell = inputSellPrice;
            if (isUsdtSettledInEur) {
                saleValueEur = isTotalManual && totalInput > 0 ? totalInput : quantity * inputSellPrice;
                saleValueDzd = saleValueEur * eurToDzdRateAtSale;
                sell = inputSellPrice * eurToDzdRateAtSale;
            }
            else {
                saleValueDzd = isTotalManual && totalInput > 0 ? totalInput : quantity * inputSellPrice;
                sell = inputSellPrice;
            }
            const totalRevenue = Math.round(saleValueDzd);
            const profit = Number((saleValueDzd - (avg * quantity)).toFixed(2));
            const liveSnapshot = smartQuoteRef?.current;
            const validSnapshot = liveSnapshot
                && liveSnapshot.currency === sellCurrency
                && !isUsdtSettledInEur
                && (liveSnapshot.clientId ?? 'none') === linkedClientId
                ? liveSnapshot
                : null;
            const currentRiskFingerprint = validSnapshot ? pricingRiskFingerprint(validSnapshot) : '';
            const riskAcknowledged = !!validSnapshot && acknowledgedFingerprint === currentRiskFingerprint;
            if (validSnapshot?.creditRisk.requiresAcknowledgement && !riskAcknowledged) {
                setPendingCreditRisk(validSnapshot);
                return;
            }
            const pricingSnapshot = validSnapshot ? stripUndefinedDeep({
                ...validSnapshot,
                creditRisk: {
                    ...validSnapshot.creditRisk,
                    acknowledged: validSnapshot.creditRisk.requiresAcknowledgement ? riskAcknowledged : false,
                    ...(riskAcknowledged ? { acknowledgedAt: Date.now() } : {}),
                },
            }) : null;
            const { date, time, timestamp } = now();
            const shouldLinkSettlementToDzdClient = !isUsdtSettledInEur && (clientPaymentStatus === 'cash' || clientPaymentStatus === 'baridi') && linkedClientDzdId !== 'none';
            const batch = db.batch();
            const settlementMetadata: any = isUsdtSettledInEur
                ? {
                    settlementCurrency: 'EUR',
                    sellPriceEur: inputSellPrice,
                    saleValueEur,
                    eurToDzdRateAtSale
                }
                : {
                    settlementCurrency: 'DZD',
                    sellPriceEur: fieldValueDelete(),
                    saleValueEur: fieldValueDelete(),
                    eurToDzdRateAtSale: fieldValueDelete()
                };
            const settlementMetadataForCreate: any = isUsdtSettledInEur
                ? {
                    settlementCurrency: 'EUR',
                    sellPriceEur: inputSellPrice,
                    saleValueEur,
                    eurToDzdRateAtSale
                }
                : { settlementCurrency: 'DZD' };
            const createLinkedEurSettlementTx = (parentTxId: string) => {
                if (!isUsdtSettledInEur || saleValueEur <= 0 || eurToDzdRateAtSale <= 0)
                    return;
                batch.set(userDocRef.collection('usdt_txs').doc(), {
                    timestamp: timestamp + 1,
                    type: 'buy',
                    currency: 'EUR',
                    quantity: roundM(saleValueEur),
                    price: eurToDzdRateAtSale,
                    total: totalRevenue,
                    date,
                    time,
                    notes: `Encaissement EUR - Vente de ${formatNumber(quantity, { min: 0, max: 2 })} USDT`,
                    linkedTxId: parentTxId
                });
            };
            const clientSaleNote = isUsdtSettledInEur
                ? `Vente de ${formatNumber(quantity, { min: 0, max: 2 })} USDT @ ${inputSellPrice.toFixed(4)} EUR (${formatNumber(saleValueEur, { min: 0, max: 2 })} EUR x ${eurToDzdRateAtSale.toFixed(2)} DZD)`
                : `Vente de ${formatNumber(quantity, { min: 0, max: 2 })} ${sellCurrency} @ ${sell.toFixed(2)}`;
            const treasurySaleNote = isUsdtSettledInEur
                ? ''
                : `Vente ${formatNumber(quantity, { min: 0, max: 2 })} ${sellCurrency}`;
            let committedSellTxId = editingTx?.id || '';
            if (editingTx) {
                const mainSellUpdate: any = {
                    quantity, sell, total: totalRevenue, profit, notes: notes.trim(),
                    tags: txTags.length > 0 ? txTags : fieldValueDelete(),
                    price: fieldValueDelete(),
                    purchaseFundingCurrency: fieldValueDelete(),
                    purchaseAmountEur: fieldValueDelete(),
                    eurToDzdRateAtPurchase: fieldValueDelete(),
                    eurPerUsdtAtPurchase: fieldValueDelete(),
                    currency: sellCurrency, linkedClientId, clientPaymentStatus: clientPaymentStatus,
                    creditDueDate: clientPaymentStatus === 'credit' && !isUsdtSettledInEur ? creditDueDate : fieldValueDelete(),
                    ...settlementMetadata
                };
                if (pricingSnapshot) {
                    mainSellUpdate.spSnapshot = pricingSnapshot;
                    mainSellUpdate.spOpeningPrice = pricingSnapshot.openingPrice;
                    mainSellUpdate.spTargetPrice = pricingSnapshot.targetPrice;
                    mainSellUpdate.spMinPrice = pricingSnapshot.minimumAllowedPrice;
                    mainSellUpdate.spMarketStatus = pricingSnapshot.marketStatus;
                    mainSellUpdate.spSegment = pricingSnapshot.segment;
                    mainSellUpdate.spScore = pricingSnapshot.score ?? fieldValueDelete();
                }
                if (shouldLinkSettlementToDzdClient) {
                    mainSellUpdate.linkedClientDzdId = linkedClientDzdId;
                }
                else {
                    mainSellUpdate.linkedClientDzdId = fieldValueDelete();
                }
                batch.update(userDocRef.collection('usdt_txs').doc(editingTx.id), mainSellUpdate);
                const qsClient = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', editingTx.id).get();
                qsClient.forEach(d => batch.delete(d.ref));
                const qsTreasury = await userDocRef.collection('treasury_txs').where('linkedTxId', '==', editingTx.id).get();
                qsTreasury.forEach(d => batch.delete(d.ref));
                const qsLinkedUsdt = await userDocRef.collection('usdt_txs').where('linkedTxId', '==', editingTx.id).get();
                qsLinkedUsdt.forEach(d => batch.delete(d.ref));
                createLinkedEurSettlementTx(editingTx.id);
                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: -totalRevenue,
                        type: clientTxType, notes: clientSaleNote,
                        linkedTxId: editingTx.id,
                        linkRole: 'primary',
                        paymentMethod: isUsdtSettledInEur ? paymentMethodByStatus['cash'] : paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: isUsdtSettledInEur ? false : affectsClientBalance(clientPaymentStatus),
                        ...(clientPaymentStatus === 'credit' && !isUsdtSettledInEur ? { creditDueDate } : {}),
                    });
                }
                if (shouldLinkSettlementToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: -totalRevenue,
                        type: 'Paiement Effectué', notes: appendOriginalClientToNote(`Paiement DZD lié à vente de ${formatNumber(quantity, { min: 0, max: 2 })} ${sellCurrency}`, linkedClientId),
                        linkedTxId: editingTx.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: true
                    });
                }
                if (!isUsdtSettledInEur && clientPaymentStatus !== 'credit' && !shouldLinkSettlementToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Ajout', source, amount: totalRevenue,
                        notes: treasurySaleNote, linkedTxId: editingTx.id
                    });
                }
                setAlert('✅ Transaction mise à jour.');
            }
            else {
                const ref = userDocRef.collection('usdt_txs').doc();
                committedSellTxId = ref.id;
                const mainSellCreate: any = {
                    timestamp, type: 'sell', quantity, sell, total: totalRevenue, profit,
                    date, time, notes: notes.trim(), currency: sellCurrency,
                    ...(txTags.length > 0 ? { tags: txTags } : {}),
                    linkedClientId, clientPaymentStatus: clientPaymentStatus,
                    ...(clientPaymentStatus === 'credit' && !isUsdtSettledInEur ? { creditDueDate } : {}),
                    ...settlementMetadataForCreate
                };
                // Smart-pricing snapshot: what the engine suggested for THIS deal.
                // sell vs spTargetPrice = negotiation loss (never blocks the sale).
                if (pricingSnapshot) {
                    mainSellCreate.spSnapshot = pricingSnapshot;
                    mainSellCreate.spOpeningPrice = pricingSnapshot.openingPrice;
                    mainSellCreate.spTargetPrice = pricingSnapshot.targetPrice;
                    mainSellCreate.spMinPrice = pricingSnapshot.minimumAllowedPrice;
                    mainSellCreate.spMarketStatus = pricingSnapshot.marketStatus;
                    mainSellCreate.spSegment = pricingSnapshot.segment;
                    if (pricingSnapshot.score !== null) mainSellCreate.spScore = pricingSnapshot.score;
                }
                if (shouldLinkSettlementToDzdClient) {
                    mainSellCreate.linkedClientDzdId = linkedClientDzdId;
                }
                batch.set(ref, mainSellCreate);
                createLinkedEurSettlementTx(ref.id);
                if (!isUsdtSettledInEur && clientPaymentStatus !== 'credit' && !shouldLinkSettlementToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Ajout', source, amount: totalRevenue,
                        notes: treasurySaleNote, linkedTxId: ref.id
                    });
                }
                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: -totalRevenue,
                        type: clientTxType, notes: clientSaleNote,
                        linkedTxId: ref.id,
                        linkRole: 'primary',
                        paymentMethod: isUsdtSettledInEur ? paymentMethodByStatus['cash'] : paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: isUsdtSettledInEur ? false : affectsClientBalance(clientPaymentStatus),
                        ...(clientPaymentStatus === 'credit' && !isUsdtSettledInEur ? { creditDueDate } : {}),
                    });
                }
                if (shouldLinkSettlementToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: -totalRevenue,
                        type: 'Paiement Effectué', notes: appendOriginalClientToNote(`Paiement DZD lié à vente de ${formatNumber(quantity, { min: 0, max: 2 })} ${sellCurrency}`, linkedClientId),
                        linkedTxId: ref.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: true
                    });
                }
                setAlert('✅ Transaction ajoutée.');
            }
            if (!isUsdtSettledInEur && clientPaymentStatus !== 'credit' && !shouldLinkSettlementToDzdClient) {
                const wallet = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                recordTreasuryShadow({
                    operationId: `shadow:portfolio-sell:${editingTx?.id || `${timestamp}:${sellCurrency}`}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'portfolio_sale_cash',
                    wallet,
                    amountDzd: totalRevenue,
                    currency: sellCurrency,
                }, [{ type: 'Ajout', source: wallet, amount: totalRevenue }]);
            }
            const portfolioWarnings = editingTx
                ? ['Legacy update replaces existing Portfolio rows; V2 uses an immutable future reversal and is not active yet.']
                : [];
            if (isUsdtSettledInEur) {
                recordPortfolioShadow({
                    operationId: `shadow:portfolio-exchange-usdt-to-eur:${editingTx?.id || `${timestamp}:USDT`}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'portfolio_exchange_usdt_to_eur',
                    fromCurrency: 'USDT',
                    toCurrency: 'EUR',
                    quantityOut: quantity,
                    quantityIn: saleValueEur,
                    fromInventoryBefore: getPortfolioInventory('USDT'),
                    exchangeValueDzd: saleValueDzd,
                    fromQuotedValueDzd: quantity * sell,
                    toQuotedValueDzd: saleValueEur * eurToDzdRateAtSale,
                }, {
                    quantityDeltas: { USDT: -quantity, EUR: saleValueEur },
                    costBasisDeltasDzd: { USDT: -getPortfolioRemovalCost('USDT', quantity), EUR: totalRevenue },
                    warnings: portfolioWarnings,
                });
            }
            else if (clientPaymentStatus === 'credit' || shouldLinkSettlementToDzdClient) {
                recordPortfolioShadow({
                    operationId: `shadow:portfolio-sell-credit:${editingTx?.id || `${timestamp}:${sellCurrency}`}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'portfolio_sale_credit',
                    currency: sellCurrency,
                    quantity,
                    inventoryBefore: getPortfolioInventory(sellCurrency),
                    clientId: shouldLinkSettlementToDzdClient ? linkedClientDzdId : linkedClientId,
                    proceedsDzd: totalRevenue,
                }, {
                    quantityDeltas: { [sellCurrency]: -quantity },
                    costBasisDeltasDzd: { [sellCurrency]: -getPortfolioRemovalCost(sellCurrency, quantity) },
                    clientReceivableDzd: totalRevenue,
                    realizedTradingProfitDzd: profit,
                    warnings: portfolioWarnings,
                });
            }
            else {
                const wallet = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                recordPortfolioShadow({
                    operationId: `shadow:portfolio-sell-cash:${editingTx?.id || `${timestamp}:${sellCurrency}`}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'portfolio_sale_cash',
                    currency: sellCurrency,
                    quantity,
                    inventoryBefore: getPortfolioInventory(sellCurrency),
                    wallet,
                    proceedsDzd: totalRevenue,
                }, {
                    quantityDeltas: { [sellCurrency]: -quantity },
                    costBasisDeltasDzd: { [sellCurrency]: -getPortfolioRemovalCost(sellCurrency, quantity) },
                    cashDeltasDzd: { [wallet]: totalRevenue },
                    realizedTradingProfitDzd: profit,
                    warnings: portfolioWarnings,
                });
            }
            if (!editingTx && !isUsdtSettledInEur && (clientPaymentStatus === 'credit' || shouldLinkSettlementToDzdClient)) {
                const clientId = shouldLinkSettlementToDzdClient ? linkedClientDzdId : linkedClientId;
                if (clientId !== 'none') {
                    recordClientShadow({
                        operationId: `shadow:client-credit-sale:${editingTx?.id || `${timestamp}:${sellCurrency}`}`,
                        actorUid: userDocRef.id,
                        effectiveAt: timestamp,
                        kind: 'client_credit_sale',
                        clientId,
                        amountDzd: totalRevenue,
                        positionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, clientId, timestamp),
                        revenueAccount: 'income.portfolio_sale',
                    }, { clientDeltas: { [clientId]: -totalRevenue } });
                }
            }
            const editMutationSeq = editingTx ? timestamp : 0;
                        const newSellOperationId = `legacy:edit:usdt_txs:${committedSellTxId}:${editMutationSeq}:new`;
                        // PAM baseline rule: exclude the target tx so the old tx is never
                        // projected twice (old + replacement) inside economics.
                        const sellExcludeTxIds = [committedSellTxId];
                        const newSellDelta = computeSellReadModelDelta({
                            committedSellTxId,
                            operationId: newSellOperationId,
                            timestamp,
                            sellCurrency,
                            quantity,
                            sell,
                            totalRevenue,
                            profit,
                            notes,
                            isUsdtSettledInEur,
                            saleValueEur,
                            saleValueDzd,
                            linkedClientId,
                            clientPaymentStatus,
                            creditDueDate,
                            shouldLinkSettlementToDzdClient,
                            linkedClientDzdId,
                            excludeTxIds: editingTx ? sellExcludeTxIds : undefined,
                        });
                        const readModelDelta = !editingTx
                            ? newSellDelta
                            : await (async () => {
                                // Read legacy sell tx + linked rows for OLD delta
                                const legacyResult = await readUsdtTxLegacy(committedSellTxId, userDocRef);
                                if (!legacyResult.main) {
                                    console.error('Legacy sell tx not found for edit:', committedSellTxId);
                                    return newSellDelta; // fallback to new only
                                }
                                const oldMain = legacyResult.main as any;
                                const oldIsUsdtSettledInEur = oldMain.settlementCurrency === 'EUR';

                                // Extract linked client metadata from actual linked rows
                                const linkedClientRows = legacyResult.linkedRows.filter(r => r.collection === 'dzd_client_txs');
                                const linkedClientRow = linkedClientRows[0]?.data as any;
                                const oldLinkedClientId = (oldMain.linkedClientId || linkedClientRow?.clientId || 'none') as string;
                                const oldLinkedClientDzdId = (oldMain.linkedClientDzdId || linkedClientRow?.linkedClientDzdId || 'none') as string;
                                const oldClientPaymentStatus = (oldMain.clientPaymentStatus || linkedClientRow?.paymentMethod || 'cash') as 'cash' | 'baridi' | 'credit';
                                const oldShouldLinkSettlementToDzdClient = !oldIsUsdtSettledInEur && (oldClientPaymentStatus === 'cash' || oldClientPaymentStatus === 'baridi') && oldLinkedClientDzdId !== 'none';

                                const oldSellCurrency = (oldMain.currency === 'EUR' ? 'EUR' : 'USDT') as 'USDT' | 'EUR';
                                const oldQuantity = roundM(Number(oldMain.quantity || 0));
                                const oldSell = Number(oldMain.sell || oldMain.price || 0);
                                const oldTotalRevenue = Math.round(Number(oldMain.total || 0));
                                const oldProfit = Number(oldMain.profit || 0);
                                const oldSaleValueEur = roundM(Number(oldMain.saleValueEur || 0));
                                const oldSaleValueDzd = Math.round(Number(oldMain.saleValueDzd || 0));

                                const oldSellDelta = computeSellReadModelDelta({
                                    committedSellTxId,
                                    operationId: `legacy:edit:usdt_txs:${committedSellTxId}:${editMutationSeq}:old`,
                                    timestamp: Number(oldMain.timestamp || timestamp),
                                    sellCurrency: oldSellCurrency,
                                    quantity: oldQuantity,
                                    sell: oldSell,
                                    totalRevenue: oldTotalRevenue,
                                    profit: oldProfit,
                                    notes: String(oldMain.notes ?? ''),
                                    isUsdtSettledInEur: oldIsUsdtSettledInEur,
                                    saleValueEur: oldSaleValueEur,
                                    saleValueDzd: oldSaleValueDzd,
                                    linkedClientId: oldLinkedClientId,
                                    clientPaymentStatus: oldClientPaymentStatus,
                                    creditDueDate: oldMain.creditDueDate ? Number(oldMain.creditDueDate) : undefined,
                                    shouldLinkSettlementToDzdClient: oldShouldLinkSettlementToDzdClient,
                                    linkedClientDzdId: oldLinkedClientDzdId,
                                    excludeTxIds: sellExcludeTxIds,
                                });

                                return combineReadModelDeltas(invertReadModelDelta(oldSellDelta), newSellDelta);
                            })();
                        await commitLegacyWithReadModelDeltas({
                            userDocRef,
                            batch,
                            deltas: readModelDelta ? [readModelDelta] : [],
                        });
            closeForm();
            if (linkedClientId !== 'none') {
                setTimeout(() => {
                    setSelectedClientId(linkedClientId);
                    setView('dzd');
                }, 100);
            }
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de la vente.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleSell = () => executeSell();
    const confirmCreditRisk = async () => {
        const fingerprint = pendingCreditRisk ? pricingRiskFingerprint(pendingCreditRisk) : undefined;
        setPendingCreditRisk(null);
        await executeSell(fingerprint);
    };
    const cancelCreditRisk = () => setPendingCreditRisk(null);
    const handleGlobalAdjustment = async () => {
        const amountNum = parseAndEvaluate(adjustmentAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setAlert('⚠️ Montant invalide.');
            return;
        }
        const epsilon = 0.005;
        // When editing an existing subtract adjustment on the same wallet, restore
        // its old effect before checking affordability — otherwise the balance
        // already reflects the old withdrawal and a valid same-or-larger edit gets
        // wrongly rejected. Mirrors the compensation pattern used for investor and
        // personal withdrawal edits.
        const oldSubtractAmountOnWallet = (wallet: 'Caisse' | 'BaridiMob') =>
            editingTreasuryTx
                && (editingTreasuryTx.type === 'Retrait' || editingTreasuryTx.type === 'Adjustment (-)')
                && editingTreasuryTx.source === wallet
                ? Number(editingTreasuryTx.amount || 0)
                : 0;
        if (adjustmentTab === 'subtract') {
            if (adjustmentAsset === 'USDT' && amountNum > (portfolioStats.usdt.available + epsilon)) {
                setAlert('⚠️ Solde USDT insuffisant.');
                return;
            }
            if (adjustmentAsset === 'EUR' && amountNum > (portfolioStats.eur.available + epsilon)) {
                setAlert('⚠️ Solde EUR insuffisant.');
                return;
            }
            if (adjustmentAsset === 'DZD-Caisse' && amountNum > (treasuryStats.caisse + oldSubtractAmountOnWallet('Caisse') + epsilon)) {
                setAlert('⚠️ Solde Caisse insuffisant.');
                return;
            }
            if (adjustmentAsset === 'DZD-Baridi' && amountNum > (treasuryStats.baridi + oldSubtractAmountOnWallet('BaridiMob') + epsilon)) {
                setAlert('⚠️ Solde BaridiMob insuffisant.');
                return;
            }
        }
        if (isSaving)
            return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            const stamp = now();
            const readModelDeltas: ReadModelDelta[] = [];
            if (adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR') {
                const type = adjustmentTab === 'add' ? 'Ajout Manuel' : 'Retrait Manuel';
                const priceNum = parseAndEvaluate(adjustmentPrice);
                const txData: any = {
                    timestamp: stamp.timestamp, type, currency: adjustmentAsset,
                    quantity: roundM(amountNum), date: stamp.date, time: stamp.time,
                    notes: adjustmentNote || 'Ajustement Manuel'
                };
                if (priceNum > 0) {
                    txData.price = priceNum;
                    txData.total = Number((amountNum * priceNum).toFixed(2));
                }
                const txRef = userDocRef.collection('usdt_txs').doc();
                batch.set(txRef, txData);
                readModelDeltas.push(mustPrepareWriterReadModelDelta('portfolio.manual-adjustment', {
                    operationId: `legacy:portfolio.manual-adjustment:${txRef.id}`,
                    effectiveAt: stamp.timestamp,
                    payload: { type: 'global_portfolio_adjustment', txId: txRef.id, asset: adjustmentAsset, amount: amountNum, price: priceNum, direction: adjustmentTab },
                    affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'financial_summary'],
                    portfolio: {
                        [adjustmentAsset]: {
                            quantityDelta: adjustmentTab === 'add' ? roundM(amountNum) : -roundM(amountNum),
                            costBasisDeltaDzd: adjustmentTab === 'add'
                                ? Number((amountNum * Math.max(0, priceNum)).toFixed(2))
                                : -getPortfolioRemovalCost(adjustmentAsset, roundM(amountNum)),
                        },
                    },
                    recentOperation: {
                        operationId: `legacy:portfolio.manual-adjustment:${txRef.id}`,
                        source: 'legacy',
                        type: `Ajustement ${adjustmentAsset}`,
                        effectiveAt: stamp.timestamp,
                    },
                }));
            }
            else {
                const type = adjustmentTab === 'add' ? 'Ajout' : 'Retrait';
                const source = adjustmentAsset === 'DZD-Caisse' ? 'Caisse' : 'BaridiMob';
                const note = adjustmentNote || 'Ajustement Trésorerie';
                const clientTxType = adjustmentTab === 'add' ? 'Règlement Reçu' : 'Paiement Effectué';
                const clientAmount = adjustmentTab === 'add' ? amountNum : -amountNum;
                if (editingTreasuryTx) {
                    const linkedAdjustmentClientTx = clientTransactionsDzd.find((tx) => tx.linkedTxId === editingTreasuryTx.id && tx.origin === 'adjustment');
                    const linkedTimestamp = editingTreasuryTx.timestamp || stamp.timestamp;
                    const linkedDate = editingTreasuryTx.date || stamp.date;
                    const linkedTime = editingTreasuryTx.time || stamp.time;
                    batch.update(userDocRef.collection('treasury_txs').doc(editingTreasuryTx.id), {
                        type, source, amount: amountNum, notes: note
                    });
                    if (linkedAdjustmentClientTx && adjustmentClientId) {
                        batch.update(userDocRef.collection('dzd_client_txs').doc(linkedAdjustmentClientTx.id), {
                            clientId: adjustmentClientId,
                            timestamp: linkedTimestamp,
                            date: linkedDate,
                            time: linkedTime,
                            montant: clientAmount,
                            type: clientTxType,
                            notes: `${note} (${source})`
                        });
                    }
                    else if (linkedAdjustmentClientTx) {
                        batch.delete(userDocRef.collection('dzd_client_txs').doc(linkedAdjustmentClientTx.id));
                    }
                    else if (adjustmentClientId) {
                        batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                            clientId: adjustmentClientId, timestamp: linkedTimestamp,
                            date: linkedDate, time: linkedTime, montant: clientAmount,
                            type: clientTxType, notes: `${note} (${source})`,
                            linkedTxId: editingTreasuryTx.id, origin: 'adjustment'
                        });
                    }
                }
                else {
                    const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
                    batch.set(treasuryTxRef, { timestamp: stamp.timestamp, date: stamp.date, time: stamp.time, type, source, amount: amountNum, notes: note });
                    readModelDeltas.push(mustPrepareWriterReadModelDelta('treasury.adjustment', {
                        operationId: `legacy:treasury.adjustment:${treasuryTxRef.id}`,
                        effectiveAt: stamp.timestamp,
                        payload: { type: 'global_treasury_adjustment', txId: treasuryTxRef.id, source, amount: amountNum, direction: adjustmentTab },
                        affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
                        wallets: { [source]: adjustmentTab === 'add' ? amountNum : -amountNum },
                        recentOperation: {
                            operationId: `legacy:treasury.adjustment:${treasuryTxRef.id}`,
                            source: 'legacy',
                            type: 'Ajustement trésorerie',
                            effectiveAt: stamp.timestamp,
                        },
                    }));
                    if (adjustmentClientId) {
                        const client = clientsDzd.find(c => c.id === adjustmentClientId);
                        if (client) {
                            const clientTxRef = userDocRef.collection('dzd_client_txs').doc();
                            batch.set(clientTxRef, {
                                clientId: adjustmentClientId, timestamp: stamp.timestamp,
                                date: stamp.date, time: stamp.time, montant: clientAmount,
                                type: clientTxType, notes: `${note} (${source})`,
                                linkedTxId: treasuryTxRef.id, origin: 'adjustment'
                            });
                            const beforeBalance = clientPositionFromLegacyRows(clientTransactionsDzd, adjustmentClientId, stamp.timestamp).balanceDzd;
                            readModelDeltas.push(mustPrepareWriterReadModelDelta('clients.initial-adjustment-remise', {
                                operationId: `legacy:clients.initial-adjustment-remise:${clientTxRef.id}`,
                                effectiveAt: stamp.timestamp,
                                payload: { type: 'linked_treasury_client_adjustment', txId: clientTxRef.id, treasuryTxId: treasuryTxRef.id, clientId: adjustmentClientId, amount: clientAmount },
                                affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                                clients: transitionClientBalanceDelta(beforeBalance, beforeBalance + clientAmount),
                                recentOperation: {
                                    operationId: `legacy:clients.initial-adjustment-remise:${clientTxRef.id}`,
                                    source: 'legacy',
                                    type: clientTxType,
                                    effectiveAt: stamp.timestamp,
                                },
                            }));
                        }
                    }
                }
            }
            if (adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') {
                const wallet = adjustmentAsset === 'DZD-Caisse' ? 'Caisse' : 'BaridiMob';
                const kind = adjustmentTab === 'add' ? 'treasury_adjustment_in' : 'treasury_adjustment_out';
                recordTreasuryShadow({
                    operationId: `shadow:treasury-adjustment:${editingTreasuryTx?.id || stamp.timestamp}`,
                    actorUid: userDocRef.id,
                    effectiveAt: stamp.timestamp,
                    kind,
                    wallet,
                    amountDzd: amountNum,
                }, [{ type: adjustmentTab === 'add' ? 'Ajout' : 'Retrait', source: wallet, amount: amountNum }]);
                if (!editingTreasuryTx && adjustmentClientId) {
                    const clientAmount = adjustmentTab === 'add' ? amountNum : -amountNum;
                    recordClientShadow({
                        operationId: `shadow:client-linked-cash-adjustment:${adjustmentClientId}:${stamp.timestamp}`,
                        actorUid: userDocRef.id,
                        effectiveAt: stamp.timestamp,
                        kind: adjustmentTab === 'add' ? 'client_cash_receipt' : 'client_cash_payout',
                        clientId: adjustmentClientId,
                        amountDzd: amountNum,
                        positionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, adjustmentClientId, stamp.timestamp),
                        wallet,
                    }, {
                        clientDeltas: { [adjustmentClientId]: clientAmount },
                        cashDeltasDzd: { [wallet]: adjustmentTab === 'add' ? amountNum : -amountNum },
                    });
                }
            }
            else if (adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR') {
                const currency = adjustmentAsset;
                const quantity = roundM(amountNum);
                const price = parseAndEvaluate(adjustmentPrice);
                const valueDzd = roundM(quantity * price);
                const isAddition = adjustmentTab === 'add';
                recordPortfolioShadow(isAddition ? {
                    operationId: `shadow:portfolio-adjustment:${stamp.timestamp}:${currency}`,
                    actorUid: userDocRef.id,
                    effectiveAt: stamp.timestamp,
                    kind: 'portfolio_manual_add',
                    currency,
                    quantity,
                    inventoryBefore: getPortfolioInventory(currency),
                    valueDzd,
                } : {
                    operationId: `shadow:portfolio-adjustment:${stamp.timestamp}:${currency}`,
                    actorUid: userDocRef.id,
                    effectiveAt: stamp.timestamp,
                    kind: 'portfolio_manual_remove',
                    currency,
                    quantity,
                    inventoryBefore: getPortfolioInventory(currency),
                }, {
                    quantityDeltas: { [currency]: isAddition ? quantity : -quantity },
                    costBasisDeltasDzd: { [currency]: isAddition ? valueDzd : -getPortfolioRemovalCost(currency, quantity) },
                    ...(isAddition && price <= 0 ? { warnings: ['Legacy manual addition has no DZD value and cannot become a balanced V2 posting.'] } : {}),
                });
            }
            if (editingTreasuryTx) {
                const editMutationSeq = stamp.timestamp;
                const oldSource = (editingTreasuryTx.source || (editingTreasuryTx as any).asset || 'Caisse') as 'Caisse' | 'BaridiMob';
                const oldAmount = Number(editingTreasuryTx.amount || 0);
                const oldIsAdd = editingTreasuryTx.type === 'Ajout' || editingTreasuryTx.type === 'Adjustment (+)';
                const oldClientTx = clientTransactionsDzd.find((tx) => tx.linkedTxId === editingTreasuryTx.id && tx.origin === 'adjustment');
                const oldClientId = adjustmentClientId || (oldClientTx ? oldClientTx.clientId : '');
                const oldTreasuryDelta = mustPrepareWriterReadModelDelta('treasury.adjustment', {
                    operationId: `legacy:edit:treasury_txs:${editingTreasuryTx.id}:${editMutationSeq}:old`,
                    effectiveAt: editingTreasuryTx.timestamp || stamp.timestamp,
                    payload: { type: 'global_treasury_adjustment', txId: editingTreasuryTx.id, source: oldSource, amount: oldAmount, direction: oldIsAdd ? 'add' : 'subtract', editInverse: true },
                    affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
                    wallets: { [oldSource]: oldIsAdd ? oldAmount : -oldAmount },
                    recentOperation: { operationId: `legacy:edit:treasury_txs:${editingTreasuryTx.id}:${editMutationSeq}:old`, source: 'legacy', type: 'Ajustement trésorerie', effectiveAt: editingTreasuryTx.timestamp || stamp.timestamp },
                });
                const newSource = adjustmentAsset === 'DZD-Caisse' ? 'Caisse' : 'BaridiMob';
                const newIsAdd = adjustmentTab === 'add';
                const newTreasuryDelta = mustPrepareWriterReadModelDelta('treasury.adjustment', {
                    operationId: `legacy:edit:treasury_txs:${editingTreasuryTx.id}:${editMutationSeq}:new`,
                    effectiveAt: stamp.timestamp,
                    payload: { type: 'global_treasury_adjustment', txId: editingTreasuryTx.id, source: newSource, amount: amountNum, direction: newIsAdd ? 'add' : 'subtract' },
                    affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
                    wallets: { [newSource]: newIsAdd ? amountNum : -amountNum },
                    recentOperation: { operationId: `legacy:edit:treasury_txs:${editingTreasuryTx.id}:${editMutationSeq}:new`, source: 'legacy', type: 'Ajustement trésorerie', effectiveAt: stamp.timestamp },
                });
                readModelDeltas.push(combineReadModelDeltas(invertReadModelDelta(oldTreasuryDelta), newTreasuryDelta));
                if (oldClientId && (oldClientTx || adjustmentClientId)) {
                    const oldClientAmount = oldIsAdd ? oldAmount : -oldAmount;
                    const beforeBalanceOld = clientPositionFromLegacyRows(clientTransactionsDzd, oldClientId, editingTreasuryTx.timestamp || stamp.timestamp).balanceDzd;
                    const oldClientDelta = mustPrepareWriterReadModelDelta('clients.initial-adjustment-remise', {
                        operationId: `legacy:edit:clients:${editingTreasuryTx.id}:${editMutationSeq}:old`,
                        effectiveAt: editingTreasuryTx.timestamp || stamp.timestamp,
                        payload: { type: 'linked_treasury_client_adjustment', txId: editingTreasuryTx.id, clientId: oldClientId, amount: oldClientAmount, editInverse: true },
                        affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                        clients: transitionClientBalanceDelta(beforeBalanceOld, beforeBalanceOld + oldClientAmount),
                        recentOperation: { operationId: `legacy:edit:clients:${editingTreasuryTx.id}:${editMutationSeq}:old`, source: 'legacy', type: oldIsAdd ? 'Règlement Reçu' : 'Paiement Effectué', effectiveAt: editingTreasuryTx.timestamp || stamp.timestamp },
                    });
                    const newClientAmount = newIsAdd ? amountNum : -amountNum;
                    const beforeBalanceNew = clientPositionFromLegacyRows(clientTransactionsDzd, oldClientId, stamp.timestamp).balanceDzd;
                    const newClientDelta = mustPrepareWriterReadModelDelta('clients.initial-adjustment-remise', {
                        operationId: `legacy:edit:clients:${editingTreasuryTx.id}:${editMutationSeq}:new`,
                        effectiveAt: stamp.timestamp,
                        payload: { type: 'linked_treasury_client_adjustment', txId: editingTreasuryTx.id, clientId: oldClientId, amount: newClientAmount },
                        affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                        clients: transitionClientBalanceDelta(beforeBalanceNew, beforeBalanceNew + newClientAmount),
                        recentOperation: { operationId: `legacy:edit:clients:${editingTreasuryTx.id}:${editMutationSeq}:new`, source: 'legacy', type: newIsAdd ? 'Règlement Reçu' : 'Paiement Effectué', effectiveAt: stamp.timestamp },
                    });
                    readModelDeltas.push(combineReadModelDeltas(invertReadModelDelta(oldClientDelta), newClientDelta));
                }
            }
            await commitLegacyWithReadModelDeltas({ userDocRef, batch, deltas: readModelDeltas });
            setAlert('✅ Ajustement enregistré.');
            setIsAdjustmentModalOpen(false);
            if (adjustmentClientId) {
                setTimeout(() => {
                    setSelectedClientId(adjustmentClientId);
                    setView('dzd');
                }, 100);
            }
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de l’ajustement.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeleteTx = async (txId: string, type: 'usdt_tx' | 'client_tx' | 'treasury_tx' | 'asset_tx') => {
        setIsSaving(true);
        try {
            const buildOldDelta = async (resolvedType: 'usdt_tx' | 'client_tx' | 'treasury_tx' | 'asset_tx', resolvedTxId: string, mainData: any, linkedData: any[]): Promise<ReadModelDelta | null> => {
                if (!mainData) return null;
                const opId = `legacy:delete-build:${resolvedType === 'usdt_tx' ? 'usdt_txs' : resolvedType === 'client_tx' ? 'dzd_client_txs' : resolvedType === 'asset_tx' ? 'actifTransactions' : 'treasury_txs'}:${resolvedTxId}`;
                const ts = Number(mainData.timestamp || Date.now());
                // ---- USDT/EUR buy/sell root (also the resolved target for any
                // linked client/treasury/portfolio child rows) ----
                if (resolvedType === 'usdt_tx') {
                    if (mainData.type === 'buy') {
                        return computeBuyReadModelDelta({
                            mainTxId: resolvedTxId,
                            operationId: opId,
                            timestamp: ts,
                            buyUsdtMode: mainData.purchaseFundingCurrency === 'EUR' ? 'with_eur' : 'with_dzd',
                            mode: mainData.currency === 'EUR' ? 'buy_eur' : 'buy_usdt',
                            quantity: roundM(Number(mainData.quantity || 0)),
                            totalCost: roundM(Number(mainData.total || (Number(mainData.quantity || 0) * Number(mainData.price || 0)))),
                            eurSpentForConversion: roundM(Number(mainData.eurSpentForConversion || mainData.purchaseAmountEur || 0)),
                            currency: (mainData.currency === 'EUR' ? 'EUR' : 'USDT') as 'USDT' | 'EUR',
                            clientPaymentStatus: (mainData.clientPaymentStatus || (mainData.paymentMethod === 'Caisse' ? 'cash' : (mainData.paymentMethod === 'BaridiMob' ? 'baridi' : 'credit'))) as 'cash' | 'baridi' | 'credit',
                            linkedClientId: mainData.linkedClientId || 'none',
                            linkedClientDzdId: mainData.linkedClientDzdId || 'none',
                            shouldLinkCashToDzdClient: !!(mainData.linkedClientDzdId && mainData.linkedClientDzdId !== 'none' && (mainData.clientPaymentStatus === 'cash' || mainData.clientPaymentStatus === 'baridi' || (!mainData.clientPaymentStatus && (mainData.paymentMethod === 'Caisse' || mainData.paymentMethod === 'BaridiMob')))),
                        });
                    }
                    if (mainData.type === 'sell') {
                        const sellCurrency = (mainData.currency === 'EUR' ? 'EUR' : 'USDT') as 'USDT' | 'EUR';
                        const isUsdtSettledInEur = sellCurrency === 'USDT' && mainData.settlementCurrency === 'EUR';
                        const quantity = roundM(Number(mainData.quantity || 0));
                        const sell = roundM(Number(mainData.sell || mainData.price || 0));
                        const totalRevenue = roundM(Number(mainData.total || mainData.totalRevenue || (quantity * sell)));
                        const profit = roundM(Number(mainData.profit || 0));
                        return computeSellReadModelDelta({
                            committedSellTxId: resolvedTxId,
                            operationId: opId,
                            timestamp: ts,
                            sellCurrency,
                            quantity,
                            sell,
                            totalRevenue,
                            profit,
                            notes: String(mainData.notes ?? ''),
                            isUsdtSettledInEur,
                            saleValueEur: roundM(Number(mainData.saleValueEur || (isUsdtSettledInEur ? totalRevenue : 0))),
                            saleValueDzd: roundM(Number(mainData.saleValueDzd || (!isUsdtSettledInEur ? totalRevenue : 0))),
                            linkedClientId: mainData.linkedClientId || 'none',
                            clientPaymentStatus: (mainData.clientPaymentStatus || 'cash') as 'cash' | 'baridi' | 'credit',
                            creditDueDate: mainData.creditDueDate ? Number(mainData.creditDueDate) : undefined,
                            shouldLinkSettlementToDzdClient: !!(mainData.linkedClientDzdId && mainData.linkedClientDzdId !== 'none' && !isUsdtSettledInEur && (mainData.clientPaymentStatus === 'cash' || mainData.clientPaymentStatus === 'baridi')),
                            linkedClientDzdId: mainData.linkedClientDzdId || 'none',
                            excludeTxIds: [resolvedTxId],
                        });
                    }
                    // Manual portfolio correction row (Ajout Manuel / Retrait Manuel)
                    if (mainData.type === 'Ajout Manuel' || mainData.type === 'Retrait Manuel') {
                        const currency = (mainData.currency === 'EUR' ? 'EUR' : 'USDT') as 'USDT' | 'EUR';
                        const quantity = Math.abs(roundM(Number(mainData.quantity || 0)));
                        const isAdd = mainData.type === 'Ajout Manuel';
                        const total = Number(mainData.total || 0);
                        const costBasis = isAdd
                            ? Number(total > 0 ? total : roundM(quantity * Number(mainData.price || getPortfolioRemovalCost(currency, quantity) / Math.max(quantity, 0.0001))))
                            : -getPortfolioRemovalCost(currency, quantity);
                        return mustPrepareWriterReadModelDelta('portfolio.manual-adjustment', {
                            operationId: opId,
                            effectiveAt: ts,
                            payload: { type: 'global_portfolio_adjustment', txId: resolvedTxId, asset: currency, amount: quantity, direction: isAdd ? 'add' : 'subtract' },
                            affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'financial_summary'],
                            portfolio: { [currency]: { quantityDelta: isAdd ? quantity : -quantity, costBasisDeltaDzd: isAdd ? costBasis : costBasis } },
                            recentOperation: { operationId: opId, source: 'legacy', type: mainData.type, effectiveAt: ts },
                        });
                    }
                }
                // ---- Treasury roots ----
                if (resolvedType === 'treasury_tx') {
                    // Personal expense / advance root (origin=personal_expense):
                    // invert the stored profit/capital split + wallet + pending advance.
                    if (mainData.origin === 'personal_expense') {
                        const wallet = ((mainData.expenseWallet || mainData.source || 'Caisse') as 'Caisse' | 'BaridiMob' | 'USDT' | 'EUR');
                        const amountDzd = Number(mainData.amountDzd || mainData.amount || 0);
                        const isAdvance = mainData.advanceState === 'pending';
                        const amountNum = (mainData.originalAmount && Number(mainData.originalAmount) > 0)
                            ? Number(mainData.originalAmount)
                            : (mainData.expenseCurrency && mainData.conversionRateToDzd
                                ? roundM(amountDzd / Number(mainData.conversionRateToDzd))
                                : amountDzd);
                        const avgBuy = wallet === 'USDT' ? portfolioStats.usdt.avgBuy : portfolioStats.eur.avgBuy;
                        return mustPrepareWriterReadModelDelta('investors.personal-expenses', {
                            operationId: opId,
                            effectiveAt: ts,
                            payload: { type: isAdvance ? 'manager_personal_advance' : 'manager_personal_expense', treasuryTxId: resolvedTxId, wallet, originalAmount: amountNum, amountDzd, deleteInverse: true },
                            affectedSummaries: ['dashboard_summary', 'investors_summary', 'treasury_summary', 'portfolio_summary', 'financial_summary'],
                            wallets: isCashWallet(wallet as FinancialWallet) ? { [wallet as 'Caisse' | 'BaridiMob']: -amountDzd } : undefined,
                            portfolio: isAssetWallet(wallet as FinancialWallet) ? { [wallet as 'USDT' | 'EUR']: { quantityDelta: -amountNum, costBasisDeltaDzd: -roundM(Number(avgBuy || 0) * amountNum) } } : undefined,
                            managerPendingAdvancesDelta: isAdvance ? amountDzd : 0,
                            investors: isAdvance ? {} : { managerPersonalExpensesDelta: amountDzd, managerActualOwnerCapitalDelta: -amountDzd },
                            recentOperation: { operationId: opId, source: 'legacy', type: isAdvance ? 'Avance personnelle' : 'Dépense personnelle', effectiveAt: ts },
                        });
                    }
                    // Project delivery expense root
                    if (mainData.origin === 'delivery_expense') {
                        const wallet = ((mainData.expenseWallet || mainData.source || 'Caisse') as FinancialWallet);
                        const amountDzd = Number(mainData.amountDzd || mainData.amount || 0);
                        const amountNum = (mainData.originalAmount && Number(mainData.originalAmount) > 0)
                            ? Number(mainData.originalAmount)
                            : (mainData.expenseCurrency && mainData.conversionRateToDzd
                                ? roundM(amountDzd / Number(mainData.conversionRateToDzd))
                                : amountDzd);
                        const allocation = allocateProfitDeltaAtTimestamp({
                            investors,
                            investorTransactions,
                            treasuryTransactions,
                            personalExpenses,
                            managerFeePercentage,
                            managerFeeHistory,
                            projectProfitDzd: -amountDzd,
                            timestamp: ts,
                        });
                        return mustPrepareWriterReadModelDelta('project.delivery-expense', {
                            operationId: opId,
                            effectiveAt: ts,
                            payload: { type: 'project_delivery_expense', txId: resolvedTxId, wallet, originalAmount: amountNum, amountDzd, allocation, deleteInverse: true },
                            affectedSummaries: ['dashboard_summary', 'treasury_summary', 'portfolio_summary', 'investors_summary', 'financial_summary'],
                            wallets: isCashWallet(wallet) ? { [wallet]: -amountDzd } : undefined,
                            portfolio: isAssetWallet(wallet) ? { [wallet]: { quantityDelta: -amountNum, costBasisDeltaDzd: -getPortfolioRemovalCost(wallet, amountNum) } } : undefined,
                            deliveryExpensesDelta: amountDzd,
                            investors: {
                                externalInvestorProfitsDelta: allocation.externalInvestorProfitsDeltaDzd,
                                investorLiabilityDelta: allocation.investorLiabilityDeltaDzd,
                                managerTradingOwnerProfitDelta: allocation.managerProfitDeltaDzd,
                                managerActualOwnerCapitalDelta: allocation.managerProfitDeltaDzd,
                                globalNetProfitDelta: allocation.projectProfitDzd,
                            },
                            dashboardDaily: periodProfitDeltas(ts, 0, allocation.managerProfitDeltaDzd),
                            recentOperation: { operationId: opId, source: 'legacy', type: 'Frais du projet', effectiveAt: ts },
                        });
                    }
                    // Internal wallet transfer root
                    if (mainData.destination && (mainData.destination === 'Caisse' || mainData.destination === 'BaridiMob') && mainData.source) {
                        const walletDeltas: Record<string, number> = {};
                        walletDeltas[mainData.source as 'Caisse' | 'BaridiMob'] = -Math.abs(Number(mainData.amount || 0));
                        walletDeltas[mainData.destination as 'Caisse' | 'BaridiMob'] = Math.abs(Number(mainData.amount || 0));
                        return mustPrepareWriterReadModelDelta('treasury.transfer', {
                            operationId: opId,
                            effectiveAt: ts,
                            payload: { type: 'treasury_transfer', txId: resolvedTxId, from: mainData.source, to: mainData.destination, amount: Math.abs(Number(mainData.amount || 0)) },
                            affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
                            wallets: walletDeltas,
                            recentOperation: { operationId: opId, source: 'legacy', type: 'Transfert interne', effectiveAt: ts },
                        });
                    }
                    // Plain DZD adjustment / balance correction root
                    if (mainData.source && (mainData.type === 'Ajout' || mainData.type === 'Retrait' || mainData.type === 'Adjustment (+)' || mainData.type === 'Adjustment (-)' || mainData.origin === 'balance_edit')) {
                        const source = (mainData.source === 'BaridiMob' ? 'BaridiMob' : 'Caisse') as 'Caisse' | 'BaridiMob';
                        const amount = Math.abs(Number(mainData.amount || 0));
                        const isAdd = mainData.type === 'Ajout' || mainData.type === 'Adjustment (+)';
                        const linkedAdjustmentRow = linkedData.find((d) => d?.origin === 'adjustment');
                        return mustPrepareWriterReadModelDelta('treasury.adjustment', {
                            operationId: opId,
                            effectiveAt: ts,
                            payload: { type: 'treasury_adjustment', txId: resolvedTxId, source, amount, direction: isAdd ? 'add' : 'subtract' },
                            affectedSummaries: ['dashboard_summary', 'treasury_summary', 'clients_summary', 'financial_summary'],
                            wallets: { [source]: isAdd ? amount : -amount },
                            clients: linkedAdjustmentRow?.clientId ? clientBalanceTransition(linkedAdjustmentRow.clientId, Number(linkedAdjustmentRow.montant || 0), ts) : undefined,
                            recentOperation: { operationId: opId, source: 'legacy', type: isAdd ? 'Ajout' : 'Retrait', effectiveAt: ts },
                        });
                    }
                }
                // ---- Standalone client settlement / remise ----
                if (resolvedType === 'client_tx') {
                    if (mainData.type === 'Remise solde' || mainData.type === 'Ajustement solde') {
                        return mustPrepareWriterReadModelDelta('clients.initial-adjustment-remise', {
                            operationId: opId,
                            effectiveAt: ts,
                            payload: { type: 'client_zero_out_balance', clientId: mainData.clientId, txId: resolvedTxId, balance: Number(String(mainData.notes ?? '').match(/-?\d+(\.\d+)?/)?.[0] || 0), montant: Number(mainData.montant || 0) },
                            affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                            clients: clientBalanceTransition(mainData.clientId, -Number(mainData.montant || 0), ts),
                            recentOperation: { operationId: opId, source: 'legacy', type: String(mainData.type), effectiveAt: ts },
                        });
                    }
                    if (!mainData.linkedTxId) {
                        const isOutflow = Number(mainData.montant || 0) < 0;
                        const amount = Math.abs(Number(mainData.montant || 0));
                        return mustPrepareWriterReadModelDelta('clients.settlement', {
                            operationId: opId,
                            effectiveAt: ts,
                            payload: { type: isOutflow ? 'settlement_out' : 'settlement_in', clientId: mainData.clientId, txId: resolvedTxId, amount, paymentMethod: mainData.paymentMethod },
                            affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                            clients: clientBalanceTransition(mainData.clientId, isOutflow ? amount : -amount, ts),
                            recentOperation: { operationId: opId, source: 'legacy', type: String(mainData.type), effectiveAt: ts },
                        });
                    }
                }
                // ---- Manual asset transaction root ----
                if (resolvedType === 'asset_tx') {
                    const amount = Number(mainData.amount || 0);
                    const paymentMethod = String(mainData.paymentMethod || 'cash');
                    const isCashOrBaridi = paymentMethod === 'cash' || paymentMethod === 'baridi';
                    const isInflow = mainData.type === 'payment_received';
                    const absoluteAmount = Math.abs(amount);
                    const srcWallet = paymentMethod === 'baridi' ? 'BaridiMob' : 'Caisse';
                    const beforeBalance = assetClientBalances.get(`${mainData.actifId}_${mainData.clientId}`) || 0;
                    const afterBalance = beforeBalance + amount;
                    const balanceDelta = serviceBalanceDelta(beforeBalance, afterBalance);
                    return mustPrepareWriterReadModelDelta('services.manual-assets', {
                        operationId: opId,
                        effectiveAt: ts,
                        payload: { type: 'manual_asset_transaction', txId: resolvedTxId, data: { actifId: mainData.actifId, clientId: mainData.clientId, amount, type: mainData.type, paymentMethod }, deleteInverse: true },
                        affectedSummaries: ['dashboard_summary', 'services_summary', 'treasury_summary', 'financial_summary'],
                        wallets: (isInflow || mainData.type === 'payment_made') && isCashOrBaridi
                            ? { Caisse: srcWallet === 'Caisse' ? (isInflow ? absoluteAmount : -absoluteAmount) : 0, BaridiMob: srcWallet === 'BaridiMob' ? (isInflow ? absoluteAmount : -absoluteAmount) : 0 }
                            : { Caisse: 0, BaridiMob: 0 },
                        services: {
                            ...balanceDelta,
                            cashReceivedDelta: isInflow ? absoluteAmount : 0,
                            manualServiceRevenueDelta: (mainData.type === 'service' || mainData.type === 'invoice') ? absoluteAmount : 0,
                            serviceRevenueDelta: (mainData.type === 'service' || mainData.type === 'invoice') ? absoluteAmount : 0,
                        },
                        recentOperation: { operationId: opId, source: 'legacy', type: String(mainData.type), effectiveAt: ts },
                    });
                }
                console.error('[delete-integrity] No old-delta builder matched', { resolvedType, resolvedTxId, mainType: mainData.type, origin: mainData.origin });
                return null;
            };
            const result = await applyTransactionDelete(txId, type, userDocRef, buildOldDelta);
            if (result.success)
                setAlert('✅ Transaction supprimée.');
            else
                setAlert(`❌ ${result.error || 'Erreur lors de la suppression.'}`);
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de la suppression.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const openAdjustmentModal = (type: 'add' | 'subtract' = 'add', txToEdit: TreasuryTx | null = null) => {
        setAdjustmentTab(type);
        setEditingTreasuryTx(txToEdit);
        setAdjustmentPrice('');
        if (txToEdit) {
            const linkedAdjustmentClientTx = clientTransactionsDzd.find((tx) => tx.linkedTxId === txToEdit.id && tx.origin === 'adjustment');
            setAdjustmentAmount(txToEdit.amount.toString());
            setAdjustmentAsset(txToEdit.source === 'Caisse' ? 'DZD-Caisse' : 'DZD-Baridi');
            setAdjustmentNote(txToEdit.notes || '');
            setAdjustmentClientId(linkedAdjustmentClientTx?.clientId || '');
        }
        else {
            setAdjustmentAmount('');
            setAdjustmentNote('');
            setAdjustmentAsset('DZD-Caisse');
            setAdjustmentClientId('');
        }
        setIsAdjustmentModalOpen(true);
    };
    const openDeliveryExpenseModal = () => {
        const today = new Date();
        const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        setDeliveryExpenseAmount('');
        setDeliveryExpenseMethod('Caisse');
        setDeliveryExpenseDate(isoToday);
        setDeliveryExpenseNote('');
        setIsDeliveryExpenseModalOpen(true);
    };
    const closeDeliveryExpenseModal = () => {
        setIsDeliveryExpenseModalOpen(false);
    };
    const handleSaveDeliveryExpense = async () => {
        const amountNum = roundM(parseAndEvaluate(deliveryExpenseAmount));
        if (isNaN(amountNum) || amountNum <= 0) {
            setAlert('⚠️ Montant invalide.');
            return;
        }
        if (isAssetWallet(deliveryExpenseMethod)) {
            const rate = deliveryExpenseMethod === 'USDT' ? projectExpenseRates.usdtPma : projectExpenseRates.eurPma;
            if (rate <= 0) {
                setAlert(`⚠️ PMA ${deliveryExpenseMethod} indisponible.`);
                return;
            }
        }
        const epsilon = 0.005;
        const availableBalance = deliveryExpenseMethod === 'Caisse'
            ? treasuryStats.caisse
            : deliveryExpenseMethod === 'BaridiMob'
                ? treasuryStats.baridi
                : deliveryExpenseMethod === 'USDT'
                    ? Number(portfolioStats.usdt.available || 0)
                    : Number(portfolioStats.eur.available || 0);
        if (amountNum > availableBalance + epsilon) {
            setAlert(`⚠️ Solde ${deliveryExpenseMethod} insuffisant.`);
            return;
        }
        const preview = computeProjectExpensePreview({
            wallet: deliveryExpenseMethod,
            amount: amountNum,
            rates: projectExpenseRates,
        });
        if (isSaving)
            return;
        setIsSaving(true);
        try {
            let timestamp = Date.now();
            let dateStr = '';
            let timeStr = '';
            if (deliveryExpenseDate) {
                const [y, m, d] = deliveryExpenseDate.split('-').map(Number);
                if (y && m && d) {
                    const picked = new Date();
                    const isToday = picked.getFullYear() === y &&
                        picked.getMonth() + 1 === m &&
                        picked.getDate() === d;
                    if (isToday) {
                        const nowStamp = now();
                        timestamp = nowStamp.timestamp;
                        dateStr = nowStamp.date;
                        timeStr = nowStamp.time;
                    }
                    else {
                        const customDate = new Date(y, m - 1, d, 12, 0, 0);
                        timestamp = customDate.getTime();
                        dateStr = customDate.toLocaleDateString('fr-FR');
                        timeStr = customDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    }
                }
            }
            if (!dateStr) {
                const nowStamp = now();
                timestamp = nowStamp.timestamp;
                dateStr = nowStamp.date;
                timeStr = nowStamp.time;
            }
            const expenseRef = userDocRef.collection('treasury_txs').doc();
            const batch = db.batch();
            batch.set(expenseRef, {
                timestamp,
                date: dateStr,
                time: timeStr,
                type: 'Retrait',
                ...(isCashWallet(deliveryExpenseMethod) ? { source: deliveryExpenseMethod } : {}),
                amount: preview.amountDzd,
                notes: deliveryExpenseNote.trim() || 'Frais du projet',
                origin: 'delivery_expense',
                expenseWallet: deliveryExpenseMethod,
                expenseCurrency: preview.currency,
                originalAmount: amountNum,
                conversionRateToDzd: preview.rateToDzd,
                amountDzd: preview.amountDzd,
            });
            if (isAssetWallet(deliveryExpenseMethod)) {
                batch.set(userDocRef.collection('usdt_txs').doc(), {
                    timestamp,
                    date: dateStr,
                    time: timeStr,
                    type: 'Retrait Manuel',
                    currency: deliveryExpenseMethod,
                    quantity: amountNum,
                    price: preview.rateToDzd,
                    total: preview.amountDzd,
                    notes: deliveryExpenseNote.trim() || 'Frais du projet',
                    linkedTxId: expenseRef.id,
                    linkedProjectExpenseTxId: expenseRef.id,
                    origin: 'delivery_expense',
                });
            }
            if (isCashWallet(deliveryExpenseMethod)) {
                recordTreasuryShadow({
                    operationId: `shadow:project-expense:${expenseRef.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'project_expense_cash',
                    wallet: deliveryExpenseMethod,
                    amountDzd: preview.amountDzd,
                }, [{ type: 'Retrait', source: deliveryExpenseMethod, amount: preview.amountDzd }]);
            }
            else if (isAssetWallet(deliveryExpenseMethod)) {
                const currency = deliveryExpenseMethod;
                recordPortfolioShadow({
                    operationId: `shadow:project-expense-asset:${expenseRef.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: timestamp,
                    kind: 'portfolio_project_expense_asset',
                    currency,
                    quantity: amountNum,
                    inventoryBefore: getPortfolioInventory(currency),
                }, {
                    quantityDeltas: { [currency]: -amountNum },
                    costBasisDeltasDzd: { [currency]: -getPortfolioRemovalCost(currency, amountNum) },
                });
            }
            const allocation = allocateProfitDeltaAtTimestamp({
                investors,
                investorTransactions,
                treasuryTransactions,
                personalExpenses,
                managerFeePercentage,
                managerFeeHistory,
                projectProfitDzd: -preview.amountDzd,
                timestamp,
            });
            const readModelDelta = mustPrepareWriterReadModelDelta('project.delivery-expense', {
                operationId: `legacy:project.delivery-expense:${expenseRef.id}`,
                effectiveAt: timestamp,
                payload: {
                    type: 'project_delivery_expense',
                    txId: expenseRef.id,
                    wallet: deliveryExpenseMethod,
                    originalAmount: amountNum,
                    amountDzd: preview.amountDzd,
                    allocation,
                },
                affectedSummaries: ['dashboard_summary', 'treasury_summary', 'portfolio_summary', 'investors_summary', 'financial_summary'],
                wallets: isCashWallet(deliveryExpenseMethod) ? { [deliveryExpenseMethod]: -preview.amountDzd } : undefined,
                portfolio: isAssetWallet(deliveryExpenseMethod)
                    ? { [deliveryExpenseMethod]: { quantityDelta: -amountNum, costBasisDeltaDzd: -getPortfolioRemovalCost(deliveryExpenseMethod, amountNum) } }
                    : undefined,
                deliveryExpensesDelta: preview.amountDzd,
                investors: {
                    externalInvestorProfitsDelta: allocation.externalInvestorProfitsDeltaDzd,
                    investorLiabilityDelta: allocation.investorLiabilityDeltaDzd,
                    managerTradingOwnerProfitDelta: allocation.managerProfitDeltaDzd,
                    managerActualOwnerCapitalDelta: allocation.managerProfitDeltaDzd,
                    globalNetProfitDelta: allocation.projectProfitDzd,
                },
                dashboardDaily: periodProfitDeltas(timestamp, 0, allocation.managerProfitDeltaDzd),
                recentOperation: {
                    operationId: `legacy:project.delivery-expense:${expenseRef.id}`,
                    source: 'legacy',
                    type: 'Frais du projet',
                    effectiveAt: timestamp,
                },
            });
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: [readModelDelta],
            });
            setAlert('✅ Frais du projet enregistrés.');
            setIsDeliveryExpenseModalOpen(false);
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de l’enregistrement.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const [txToDelete, setTxToDelete] = useState<Tx | TreasuryTx | null>(null);
    // Transfer State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferAmount, setTransferAmount] = useState('');
    const [transferFromClientId, setTransferFromClientId] = useState('');
    const [transferToClientId, setTransferToClientId] = useState('');
    const [transferNotes, setTransferNotes] = useState('');
    const [editingTransferTx, setEditingTransferTx] = useState<ClientTransactionDzd | null>(null);
    // Transfer Balance Logic
    const getClientBalance = (clientId: string): number => {
        return clientTransactionsDzd
            .filter(tx => tx.clientId === clientId && tx.affectsBalance !== false)
            .reduce((acc, tx) => acc + tx.montant, 0);
    };
    const transferFromBalance = useMemo(() => {
        if (!transferFromClientId)
            return 0;
        return getClientBalance(transferFromClientId);
    }, [transferFromClientId, clientTransactionsDzd]);
    const transferToBalance = useMemo(() => {
        if (!transferToClientId)
            return 0;
        return getClientBalance(transferToClientId);
    }, [transferToClientId, clientTransactionsDzd]);
    const findTransferCounterpart = (tx: ClientTransactionDzd) => {
        if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant')
            return null;
        const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
        const counterpartAmount = -tx.montant;
        const candidates = clientTransactionsDzd.filter((candidate) => candidate.id !== tx.id
            && candidate.clientId !== tx.clientId
            && candidate.type === counterpartType
            && candidate.date === tx.date
            && candidate.time === tx.time
            && Math.abs(candidate.montant - counterpartAmount) <= 0.01
            && Math.abs(candidate.timestamp - tx.timestamp) <= 1);
        if (candidates.length === 0)
            return null;
        return [...candidates].sort((left, right) => Math.abs(left.timestamp - tx.timestamp) - Math.abs(right.timestamp - tx.timestamp))[0];
    };
    const resetTransferForm = () => {
        setEditingTransferTx(null);
        setTransferAmount('');
        setTransferFromClientId('');
        setTransferToClientId('');
        setTransferNotes('');
    };
    const closeTransferModal = () => {
        setIsTransferModalOpen(false);
        resetTransferForm();
    };
    const openTransferModal = (txToEdit: ClientTransactionDzd | null = null) => {
        if (!txToEdit) {
            resetTransferForm();
            setIsTransferModalOpen(true);
            return;
        }
        const counterpart = findTransferCounterpart(txToEdit);
        if (!counterpart) {
            setAlert('⚠️ Impossible de retrouver le transfert lié.');
            return;
        }
        const outgoingTx = txToEdit.type === 'Transfert Sortant' ? txToEdit : counterpart;
        const incomingTx = outgoingTx.id === txToEdit.id ? counterpart : txToEdit;
        setEditingTransferTx(outgoingTx);
        setTransferFromClientId(outgoingTx.clientId);
        setTransferToClientId(incomingTx.clientId);
        setTransferAmount(Math.abs(outgoingTx.montant).toString());
        setTransferNotes(outgoingTx.notes || incomingTx.notes || '');
        setIsTransferModalOpen(true);
    };
    const handleSaveTransfer = async () => {
        if (isSaving)
            return;
        const amt = parseAndEvaluate(transferAmount);
        if (amt <= 0 || !transferFromClientId || !transferToClientId || transferFromClientId === transferToClientId) {
            setAlert('⚠️ Paramètres de transfert invalides.');
            return;
        }
        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();
            const note = transferNotes.trim();
            const outgoingTransferRef = userDocRef.collection('dzd_client_txs').doc();
            const incomingTransferRef = userDocRef.collection('dzd_client_txs').doc();
            // Source (De) advances money -> Credit (+amt)
            batch.set(outgoingTransferRef, {
                clientId: transferFromClientId, timestamp, date, time, montant: amt,
                type: 'Transfert Sortant', notes: note,
                paymentMethod: 'Crédit'
            });
            // Destination (À) receives benefit -> Debit (-amt)
            batch.set(incomingTransferRef, {
                clientId: transferToClientId, timestamp: timestamp + 1, date, time, montant: -amt,
                type: 'Transfert Entrant', notes: note,
                paymentMethod: 'Crédit', linkedTxId: outgoingTransferRef.id
            });
            recordClientShadow({
                operationId: `shadow:client-advance-transfer:${transferFromClientId}:${transferToClientId}:${timestamp}`,
                actorUid: userDocRef.id,
                effectiveAt: timestamp,
                kind: 'client_advance_transfer',
                fromClientId: transferFromClientId,
                toClientId: transferToClientId,
                amountDzd: amt,
                fromPositionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, transferFromClientId, timestamp),
                toPositionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, transferToClientId, timestamp),
            }, { clientDeltas: { [transferFromClientId]: -amt, [transferToClientId]: amt }, clientAdvanceDzd: 0 });
            const fromBefore = clientPositionFromLegacyRows(clientTransactionsDzd, transferFromClientId, timestamp).balanceDzd;
            const toBefore = clientPositionFromLegacyRows(clientTransactionsDzd, transferToClientId, timestamp).balanceDzd;
            const clientsDelta = combineClientPositionDeltas([
                transitionClientBalanceDelta(fromBefore, fromBefore + amt),
                transitionClientBalanceDelta(toBefore, toBefore - amt),
            ]);
            const readModelDelta = mustPrepareWriterReadModelDelta('clients.transfer', {
                operationId: `legacy:clients.transfer:${outgoingTransferRef.id}`,
                effectiveAt: timestamp,
                payload: { type: 'client_transfer', fromClientId: transferFromClientId, toClientId: transferToClientId, amount: amt, outgoingId: outgoingTransferRef.id, incomingId: incomingTransferRef.id },
                affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                clients: clientsDelta,
                recentOperation: {
                    operationId: `legacy:clients.transfer:${outgoingTransferRef.id}`,
                    source: 'legacy',
                    type: 'Transfert client',
                    effectiveAt: timestamp,
                },
            });
            await commitLegacyWithReadModelDeltas({ userDocRef, batch, deltas: [readModelDelta] });
            setAlert('✅ Transfert réussi.');
            setIsTransferModalOpen(false);
            setTransferAmount('');
            setTransferFromClientId('');
            setTransferToClientId('');
            setTransferNotes('');
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors du transfert.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleSaveTransferWithEditing = async () => {
        if (isSaving)
            return;
        const amt = parseAndEvaluate(transferAmount);
        if (amt <= 0 || !transferFromClientId || !transferToClientId || transferFromClientId === transferToClientId) {
            setAlert('⚠️ Paramètres de transfert invalides.');
            return;
        }
        if (!editingTransferTx) {
            await handleSaveTransfer();
            return;
        }
        setIsSaving(true);
        try {
            const counterpart = findTransferCounterpart(editingTransferTx);
            if (!counterpart) {
                setAlert('⚠️ Impossible de retrouver le transfert lié.');
                return;
            }
            const { date, time, timestamp } = now();
            const batch = db.batch();
            const note = transferNotes.trim();
            batch.update(userDocRef.collection('dzd_client_txs').doc(editingTransferTx.id), {
                clientId: transferFromClientId,
                timestamp,
                date,
                time,
                montant: amt,
                type: 'Transfert Sortant',
                notes: note,
                paymentMethod: 'Crédit'
            });
            batch.update(userDocRef.collection('dzd_client_txs').doc(counterpart.id), {
                clientId: transferToClientId,
                timestamp: timestamp + 1,
                date,
                time,
                montant: -amt,
                type: 'Transfert Entrant',
                notes: note,
                paymentMethod: 'Crédit',
                linkedTxId: editingTransferTx.id
            });
            const editMutationSeq = timestamp;
            const oldAmt = Math.abs(Number(editingTransferTx.montant || 0));
            const oldFromClientDelta = clientBalanceTransition(editingTransferTx.clientId, oldAmt, timestamp);
            const oldToClientDelta = clientBalanceTransition(counterpart.clientId, -oldAmt, timestamp);
            const oldTransferDelta = mustPrepareWriterReadModelDelta('clients.transfer', {
                operationId: `legacy:edit:clients.transfer:${editingTransferTx.id}:${editMutationSeq}:old`,
                effectiveAt: editingTransferTx.timestamp || timestamp,
                payload: { type: 'client_transfer', fromClientId: editingTransferTx.clientId, toClientId: counterpart.clientId, amount: oldAmt, editInverse: true },
                affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                clients: combineClientPositionDeltas([oldFromClientDelta, oldToClientDelta]),
                recentOperation: { operationId: `legacy:edit:clients.transfer:${editingTransferTx.id}:${editMutationSeq}:old`, source: 'legacy', type: 'Transfert client', effectiveAt: editingTransferTx.timestamp || timestamp },
            });
            const newFromClientDelta = clientBalanceTransition(transferFromClientId, amt, timestamp);
            const newToClientDelta = clientBalanceTransition(transferToClientId, -amt, timestamp);
            const newTransferDelta = mustPrepareWriterReadModelDelta('clients.transfer', {
                operationId: `legacy:edit:clients.transfer:${editingTransferTx.id}:${editMutationSeq}:new`,
                effectiveAt: timestamp,
                payload: { type: 'client_transfer', fromClientId: transferFromClientId, toClientId: transferToClientId, amount: amt },
                affectedSummaries: ['dashboard_summary', 'clients_summary', 'financial_summary'],
                clients: combineClientPositionDeltas([newFromClientDelta, newToClientDelta]),
                recentOperation: { operationId: `legacy:edit:clients.transfer:${editingTransferTx.id}:${editMutationSeq}:new`, source: 'legacy', type: 'Transfert client', effectiveAt: timestamp },
            });
            await commitLegacyWithReadModelDeltas({ userDocRef, batch, deltas: [combineReadModelDeltas(invertReadModelDelta(oldTransferDelta), newTransferDelta)] });
            setAlert('✅ Transfert mis à jour.');
            closeTransferModal();
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors du transfert.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleConfirmDeleteTx = async () => {
        if (!txToDelete)
            return;
        if ((txToDelete as any).currency) {
            const parentUsdtId = (txToDelete as any).linkedTxId;
            await handleDeleteTx(parentUsdtId || txToDelete.id, 'usdt_tx');
        }
        else {
            await handleDeleteTx(txToDelete.id, 'treasury_tx');
        }
        setTxToDelete(null);
    };
    const handleApplyLock24hToRecentBuys = async () => {
        const nowMs = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const twoDaysMs = 48 * 60 * 60 * 1000;
        const toUpdate = transactions.filter(tx =>
            tx.type === 'buy' &&
            tx.currency === 'USDT' &&
            !tx.lockedUntil &&
            (nowMs - tx.timestamp) <= twoDaysMs
        );
        if (toUpdate.length === 0) {
            setAlert('ℹ️ Aucune transaction récente à verrouiller.');
            return;
        }
        if (isSaving) return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            for (const tx of toUpdate) {
                batch.update(userDocRef.collection('usdt_txs').doc(tx.id), {
                    lockedUntil: tx.timestamp + oneDayMs
                });
            }
            await batch.commit();
            setAlert(`✅ ${toUpdate.length} achat(s) marqué(s) comme bloqués 24h.`);
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors du verrouillage.');
        } finally {
            setIsSaving(false);
        }
    };
    return {
        isSaving, setIsSaving, mode, setMode, editingTx, setEditingTx, isTotalManual, setIsTotalManual,
        buyUsdtAmount, setBuyUsdtAmount, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal,
        buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal,
        sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal,
        sellSettlementCurrency, setSellSettlementCurrency, sellEurToDzdRate, setSellEurToDzdRate,
        buyRestriction, setBuyRestriction,
        realPurchaseTime, setRealPurchaseTime,
        buyUsdtMode, setBuyUsdtMode, buyEurForUsdtAmount, setBuyEurForUsdtAmount,
        eurDzdPrice, setEurDzdPrice, eurUsdtRate, setEurUsdtRate,
        linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, clientPaymentStatus, setClientPaymentStatus,
        creditDueDate, setCreditDueDate, pendingCreditRisk, confirmCreditRisk, cancelCreditRisk,
        notes, setNotes, txTags, setTxTags, profitPercent, setProfitPercent,
        isAdjustmentModalOpen, setIsAdjustmentModalOpen, adjustmentTab, setAdjustmentTab,
        adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount,
        adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote,
        adjustmentClientId, setAdjustmentClientId, editingTreasuryTx, setEditingTreasuryTx,
        usdtFromEurCalc, formValidation, openForm, closeForm, handleBuy, handleSell,
        handleGlobalAdjustment, handleDeleteTx, openAdjustmentModal,
        isDeliveryExpenseModalOpen, setIsDeliveryExpenseModalOpen,
        deliveryExpenseAmount, setDeliveryExpenseAmount,
        deliveryExpenseMethod, setDeliveryExpenseMethod,
        deliveryExpenseDate, setDeliveryExpenseDate,
        deliveryExpenseNote, setDeliveryExpenseNote,
        deliveryExpensePreview,
        openDeliveryExpenseModal, closeDeliveryExpenseModal, handleSaveDeliveryExpense,
        txToDelete, setTxToDelete, handleConfirmDeleteTx,
        isTransferModalOpen, setIsTransferModalOpen, transferAmount, setTransferAmount,
        transferFromClientId, setTransferFromClientId, transferToClientId, setTransferToClientId,
        transferNotes, setTransferNotes, editingTransferTx, openTransferModal, closeTransferModal, handleSaveTransfer: handleSaveTransferWithEditing,
        transferFromBalance, transferToBalance,
        handleApplyLock24hToRecentBuys
    };
}
