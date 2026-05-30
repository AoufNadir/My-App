import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { ClientDzd, ClientTransactionDzd, Investor, TreasuryTx, Tx } from '../types';
import { formatNumber } from '../pages/shared/pageFormat';
import type { TransactionFilterMode } from '../components/transactions/transactionsTypes';
type DateRange = {
    start: Date | null;
    end: Date | null;
};
type Translator = (key: string) => unknown;
export type GlobalSearchResult = {
    id: string;
    kind: 'client';
    title: string;
    subtitle: string;
    clientId: string;
    timestamp: number;
} | {
    id: string;
    kind: 'investor';
    title: string;
    subtitle: string;
    investorId: string;
    timestamp: number;
} | {
    id: string;
    kind: 'transaction';
    title: string;
    subtitle: string;
    timestamp: number;
};
type UseGlobalSearchArgs = {
    clientTransactionsDzd: ClientTransactionDzd[];
    clientsDzd: ClientDzd[];
    getClientFullName: (client: ClientDzd) => string;
    setDateRange: (range: DateRange) => void;
    setFilterMode: (mode: TransactionFilterMode) => void;
    setSelectedClientId: (clientId: string | null) => void;
    setView: (view: string) => void;
    t: Translator;
    transactions: Tx[];
    treasuryTransactions: TreasuryTx[];
    investors?: ReadonlyArray<Investor>;
    setSelectedInvestorId?: (id: string | null) => void;
};
function toText(value: unknown, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}
export function useGlobalSearch({ clientTransactionsDzd, clientsDzd, getClientFullName, setDateRange, setFilterMode, setSelectedClientId, setView, t, transactions, treasuryTransactions, investors = [], setSelectedInvestorId }: UseGlobalSearchArgs) {
    const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const deferredGlobalSearchQuery = useDeferredValue(globalSearchQuery);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                void import('../components/main/MainDialogs');
                setIsGlobalSearchOpen(true);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
    const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
        const query = deferredGlobalSearchQuery.trim().toLowerCase();
        if (!query)
            return [];
        const latestClientActivity = new Map<string, number>();
        for (const tx of clientTransactionsDzd) {
            const previousTimestamp = latestClientActivity.get(tx.clientId) || 0;
            if (tx.timestamp > previousTimestamp) {
                latestClientActivity.set(tx.clientId, tx.timestamp);
            }
        }
        const clientNameById = new Map<string, string>();
        for (const client of clientsDzd) {
            clientNameById.set(client.id, getClientFullName(client));
        }
        const linkedClientByTxId = new Map<string, {
            clientId: string;
            isSecondary: boolean;
            timestamp: number;
        }>();
        for (const tx of clientTransactionsDzd) {
            if (!tx.linkedTxId || !tx.clientId)
                continue;
            const isSecondary = tx.linkRole === 'dzd_receiver';
            const existing = linkedClientByTxId.get(tx.linkedTxId);
            if (!existing ||
                (existing.isSecondary && !isSecondary) ||
                (existing.isSecondary === isSecondary && tx.timestamp > existing.timestamp)) {
                linkedClientByTxId.set(tx.linkedTxId, {
                    clientId: tx.clientId,
                    isSecondary,
                    timestamp: tx.timestamp
                });
            }
        }
        const clientResults: GlobalSearchResult[] = clientsDzd
            .filter((client) => {
            const haystack = [
                getClientFullName(client),
                client.phone || '',
                client.redotpayId || '',
                client.binanceEmail || ''
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        })
            .map((client) => ({
            id: `search_client_${client.id}`,
            kind: 'client' as const,
            title: getClientFullName(client),
            subtitle: [client.phone, client.redotpayId, client.binanceEmail].filter(Boolean).join(' - '),
            clientId: client.id,
            timestamp: latestClientActivity.get(client.id) || 0
        }));

        const investorResults: GlobalSearchResult[] = (investors ?? [])
            .filter((inv) => inv.name.toLowerCase().includes(query))
            .map((inv) => ({
                id: `search_investor_${inv.id}`,
                kind: 'investor' as const,
                title: inv.name,
                subtitle: [
                    inv.isManager ? 'Gérant' : 'Investisseur',
                    inv.isActive ? 'Actif' : 'Inactif',
                    `Capital: ${Number(inv.capitalInvested || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD`,
                ].join(' · '),
                investorId: inv.id,
                timestamp: new Date(inv.entryDate || 0).getTime(),
            }));
        const txResults: GlobalSearchResult[] = [];
        for (const tx of transactions) {
            const linkedClientId = tx.id ? linkedClientByTxId.get(tx.id)?.clientId : undefined;
            const linkedClientName = linkedClientId ? clientNameById.get(linkedClientId) || '' : '';
            const haystack = [
                tx.type,
                tx.currency,
                tx.notes || '',
                tx.date,
                tx.time,
                linkedClientName
            ].join(' ').toLowerCase();
            if (!haystack.includes(query))
                continue;
            const amountLabel = tx.currency === 'USDT'
                ? `${formatNumber(Number(tx.quantity || 0), { min: 0, max: 2 })} USDT`
                : `${formatNumber(Number(tx.quantity || 0), { min: 0, max: 2 })} EUR`;
            txResults.push({
                id: `search_usdt_${tx.id}`,
                kind: 'transaction',
                title: `${tx.type === 'buy' ? toText(t('transactions.buy'), tx.type) : tx.type === 'sell' ? toText(t('transactions.sell'), tx.type) : tx.type} ${tx.currency} - ${amountLabel}`,
                subtitle: [linkedClientName, `${tx.date} ${tx.time}`, tx.notes || ''].filter(Boolean).join(' - '),
                timestamp: tx.timestamp
            });
        }
        for (const tx of clientTransactionsDzd) {
            const clientName = clientNameById.get(tx.clientId) || toText(t('portfolio.unknownClient'), 'Client');
            const haystack = [
                tx.type,
                tx.notes || '',
                tx.date,
                tx.time,
                tx.paymentMethod || '',
                clientName
            ].join(' ').toLowerCase();
            if (!haystack.includes(query))
                continue;
            txResults.push({
                id: `search_client_tx_${tx.id}`,
                kind: 'transaction',
                title: `${tx.type} - ${(tx.montant > 0 ? '+' : '')}${Number(tx.montant || 0).toFixed(2)} DZD`,
                subtitle: `${clientName} - ${tx.date} ${tx.time}`,
                timestamp: tx.timestamp
            });
        }
        for (const tx of treasuryTransactions) {
            const haystack = [
                tx.type,
                tx.notes || '',
                tx.date,
                tx.time,
                tx.source || '',
                tx.destination || ''
            ].join(' ').toLowerCase();
            if (!haystack.includes(query))
                continue;
            const sourceLabel = tx.destination
                ? `${tx.source || ''} -> ${tx.destination || ''}`.trim()
                : tx.source || '';
            txResults.push({
                id: `search_treasury_${tx.id}`,
                kind: 'transaction',
                title: `${tx.type} - ${Number(tx.amount || 0).toFixed(2)} DZD`,
                subtitle: [sourceLabel, `${tx.date} ${tx.time}`, tx.notes || ''].filter(Boolean).join(' - '),
                timestamp: tx.timestamp
            });
        }
        return [...investorResults, ...clientResults, ...txResults]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 24);
    }, [clientTransactionsDzd, clientsDzd, deferredGlobalSearchQuery, getClientFullName, t, transactions, treasuryTransactions, investors]);
    const closeGlobalSearch = () => {
        setIsGlobalSearchOpen(false);
        setGlobalSearchQuery('');
    };
    const handleOpenGlobalSearch = () => {
        void import('../components/main/MainDialogs');
        setIsGlobalSearchOpen(true);
    };
    const handleSelectGlobalSearchResult = (result: GlobalSearchResult) => {
        if (result.kind === 'client') {
            setSelectedClientId(result.clientId);
            startTransition(() => setView('dzd'));
            closeGlobalSearch();
            return;
        }
        if (result.kind === 'investor') {
            setSelectedInvestorId?.(result.investorId);
            startTransition(() => setView('investors'));
            closeGlobalSearch();
            return;
        }
        const dayStart = new Date(result.timestamp);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(result.timestamp);
        dayEnd.setHours(23, 59, 59, 999);
        startTransition(() => {
            setView('transactions');
            setFilterMode('all');
            setDateRange({ start: dayStart, end: dayEnd });
        });
        closeGlobalSearch();
    };
    return {
        closeGlobalSearch,
        globalSearchQuery,
        globalSearchResults,
        handleOpenGlobalSearch,
        handleSelectGlobalSearchResult,
        isGlobalSearchOpen,
        setGlobalSearchQuery,
        setIsGlobalSearchOpen
    };
}
