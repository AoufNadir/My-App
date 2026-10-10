import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import { EmptyState } from '../ui/EmptyState';
import { AlertCard } from '../cards';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { ClientDzd, ClientTransactionDzd, Tx } from '../../types';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { ShareIcon } from '../icons/ShareIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { CopyIcon } from '../icons/CopyIcon';
import { CheckIcon } from '../icons/CheckIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { formatDzd, formatLongDate, formatNumber, getRelativeFrDateLabel } from '../../pages/shared/pageFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { TransactionDisplayList } from '../transactions/TransactionDisplayList';
import type { DisplayTx } from '../transactions/transactionsTypes';
import { getClientOperationLabel, getClientTransferDetails, getManualClientNote, getPortfolioOperationLabel } from '../../utils/transactionTerminology';
import { getNameInitials } from '../../utils/nameUtils';
import { readClientWallets } from '../../utils/clientWallets';
// Loaded on the first tap on « Rapport d’activité » or « PDF »: the clients page stays as light as before.
const ClientActivityReportDialog = lazy(() => import('./ClientActivityReportDialog').then((module) => ({ default: module.ClientActivityReportDialog })));
type ClientDetailsViewProps = {
    selectedClientId: string;
    selectedClient: ClientDzd;
    selectedClientBalance: number;
    groupedHistory: Record<string, ClientTransactionDzd[]>;
    clientTransactionsDzd: ClientTransactionDzd[];
    clientsDzd: ClientDzd[];
    setSelectedClientId: (id: string | null) => void;
    getClientFullName: (client: ClientDzd) => string;
    handleTouchStart: (client: ClientDzd) => void;
    openClientModal: (client: ClientDzd | null) => void;
    copiedValue: string | null;
    handleCopy: (text: string) => void;
    transactions: Tx[];
    profitByTxId?: Record<string, { derivedProfit: number }>;
    handleEditClientTx: (tx: ClientTransactionDzd) => void;
    handleDeleteClientTxClick: (tx: ClientTransactionDzd) => void;
    openClientTxModal: (tx: ClientTransactionDzd | null, presetType?: string, selectedClientId?: string) => void;
    openClientToClientTransferModal: (sourceClient: ClientDzd) => void;
};
type ContactRowProps = {
    label: string;
    value: string;
    copiedValue: string | null;
    onCopy: (value: string) => void;
    isPhone?: boolean;
    /** A wallet address: shown whole on two lines at most (it is checked by eye before a transfer), not cut with an ellipsis. */
    isAddress?: boolean;
};
function formatWaNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length >= 9) return '213' + digits.slice(1);
    return digits;
}
function getUserAgent(): string {
    return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}
function isAndroidDevice(): boolean {
    return /Android/i.test(getUserAgent());
}
function isAppleMobileDevice(): boolean {
    return /iPhone|iPad|iPod/i.test(getUserAgent());
}
function buildWhatsAppWebUrl(phone: string, text?: string): string {
    const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${phone}${encodedText}`;
}
function buildWhatsAppMessengerUrl(phone: string, text?: string): string {
    const query = `phone=${phone}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
    if (isAndroidDevice()) {
        return `intent://send?${query}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    }
    return `whatsapp://send?${query}`;
}
function openWhatsAppMessenger(phone: string, text?: string): void {
    const intl = formatWaNumber(phone);
    if (!intl) return;

    if (isAndroidDevice() || isAppleMobileDevice()) {
        window.location.href = buildWhatsAppMessengerUrl(intl, text);
        return;
    }

    window.open(buildWhatsAppWebUrl(intl, text), '_blank', 'noopener');
}
function findClientTransferCounterpart(tx: ClientTransactionDzd, allClientTxs: ClientTransactionDzd[]) {
    if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant')
        return null;
    if (tx.linkedTxId) {
        const linked = allClientTxs.find((candidate) => candidate.id === tx.linkedTxId);
        if (linked)
            return linked;
    }
    const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
    const counterpartAmount = -Number(tx.montant || 0);
    return allClientTxs
        .filter((candidate) => candidate.id !== tx.id
        && candidate.clientId !== tx.clientId
        && candidate.type === counterpartType
        && candidate.date === tx.date
        && candidate.time === tx.time
        && Math.abs(Number(candidate.montant || 0) - counterpartAmount) <= 0.01
        && Math.abs(Number(candidate.timestamp || 0) - Number(tx.timestamp || 0)) <= 2000)
        .sort((left, right) => Math.abs(Number(left.timestamp || 0) - Number(tx.timestamp || 0))
        - Math.abs(Number(right.timestamp || 0) - Number(tx.timestamp || 0)))[0] || null;
}
function withoutGeneratedRelation(note: string, relationDetail: string, relationClientName: string) {
    if (!note || !relationDetail)
        return note;
    const generatedParts = new Set([
        relationDetail,
        relationClientName ? `Client: ${relationClientName}` : '',
        relationClientName ? `العميل: ${relationClientName}` : '',
        relationClientName ? `عند ${relationClientName}` : '',
    ].filter(Boolean));
    return note
        .split(/\s+-\s+/)
        .map((part) => part.trim())
        .filter((part) => part && !generatedParts.has(part))
        .join(' - ');
}
/** WhatsApp's own glyph, in its green. */
function WhatsAppGlyph({ className = 'h-5 w-5' }: { className?: string }) {
    return (<svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.054 23.5l5.782-1.519A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.877 9.877 0 01-5.031-1.375l-.361-.214-3.737.981 1.001-3.648-.235-.374A9.855 9.855 0 012.1 12c0-5.467 4.433-9.9 9.9-9.9 5.467 0 9.9 4.433 9.9 9.9s-4.433 9.9-9.9 9.9z"/>
    </svg>);
}
function ContactRow({ label, value, copiedValue, onCopy, isPhone, isAddress }: ContactRowProps) {
    const { t } = useLanguage();
    if (!value)
        return null;
    const isCopied = copiedValue === value;
    return (<div className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-neutral-500">{label}</p>
        <p dir="ltr" className={`mt-0.5 leading-snug text-neutral-900 select-all rtl:text-end ${isAddress ? 'break-all font-mono text-[13px] font-medium' : 'truncate text-[15px] font-semibold'}`}>{value}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {isPhone && (<button type="button" onClick={() => openWhatsAppMessenger(value)} className="flex h-touch w-touch items-center justify-center rounded-button bg-[#25D366]/10 text-[#25D366] transition-colors hover:bg-[#25D366]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="WhatsApp" title="WhatsApp">
            <WhatsAppGlyph />
          </button>)}
        <button type="button" onClick={() => onCopy(value)} className={`flex h-touch w-touch items-center justify-center rounded-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isCopied ? 'bg-financial-profit-bg text-financial-profit' : 'bg-surface-muted text-neutral-600 hover:text-neutral-900'}`} aria-label={`${t('common.copy')} ${label}`}>
          {isCopied ? <CheckIcon aria-hidden="true" className="h-4 w-4"/> : <CopyIcon aria-hidden="true" className="h-4 w-4"/>}
        </button>
      </div>
    </div>);
}
export function ClientDetailsView({ selectedClientId, selectedClient, selectedClientBalance, groupedHistory, clientTransactionsDzd, clientsDzd, setSelectedClientId, getClientFullName, handleTouchStart, openClientModal, copiedValue, handleCopy, transactions, profitByTxId, handleEditClientTx, handleDeleteClientTxClick, openClientTxModal, openClientToClientTransferModal }: ClientDetailsViewProps) {
    const { t, lang } = useLanguage();
    const INITIAL_VISIBLE_TRANSACTIONS = 60;
    const LOAD_MORE_TRANSACTIONS = 60;
    const [visibleTransactionCount, setVisibleTransactionCount] = useState(INITIAL_VISIBLE_TRANSACTIONS);
    const [isActivityReportOpen, setIsActivityReportOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'history' | 'dossier'>('history');
    const dates = Object.keys(groupedHistory);
    const linkedTransactionsById = useMemo(() => new Map(transactions.map((tx) => [tx.id, tx])), [transactions]);
    const clientsById = useMemo(() => new Map(clientsDzd.map((client) => [client.id, client])), [clientsDzd]);
    useEffect(() => {
        setVisibleTransactionCount(INITIAL_VISIBLE_TRANSACTIONS);
    }, [groupedHistory]);
    const { visibleDateGroups, hiddenTransactionCount, totalTransactionCount } = useMemo(() => {
        let remaining = visibleTransactionCount;
        let hidden = 0;
        let total = 0;
        const visibleGroups: Array<[string, ClientTransactionDzd[]]> = [];
        for (const date of dates) {
            const txs = groupedHistory[date] || [];
            total += txs.length;
            if (remaining <= 0) {
                hidden += txs.length;
                continue;
            }
            if (txs.length <= remaining) {
                visibleGroups.push([date, txs]);
                remaining -= txs.length;
                continue;
            }
            visibleGroups.push([date, txs.slice(0, remaining)]);
            hidden += txs.length - remaining;
            remaining = 0;
        }
        return { visibleDateGroups: visibleGroups, hiddenTransactionCount: hidden, totalTransactionCount: total };
    }, [dates, groupedHistory, visibleTransactionCount]);
    const visibleDisplayDateGroups = useMemo<Array<[string, DisplayTx[]]>>(() => {
        return visibleDateGroups.map(([date, txsForDate]) => [
            date,
            txsForDate.map((tx): DisplayTx => {
                const linkedUsdtTx = tx.linkedTxId ? (linkedTransactionsById.get(tx.linkedTxId) || null) : null;
                const isCredit = tx.montant > 0;
                const isTransfer = tx.type === 'Transfert Entrant' || tx.type === 'Transfert Sortant';
                const transferCounterpart = isTransfer ? findClientTransferCounterpart(tx, clientTransactionsDzd) : null;
                const counterpartClient = transferCounterpart ? clientsById.get(transferCounterpart.clientId) : undefined;
                const counterpartName = counterpartClient ? getClientFullName(counterpartClient) : '';
                const isLinkedPortfolioTx = Boolean(linkedUsdtTx && (linkedUsdtTx.type === 'buy' || linkedUsdtTx.type === 'sell'));
                const icon = isTransfer
                    ? <UsersIcon className="w-5 h-5"/>
                    : isCredit
                        ? <ArrowDownLeftIcon className="w-5 h-5"/>
                        : <ArrowUpRightIcon className="w-5 h-5"/>;
                const iconNode = (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-neutral-100 text-neutral-600">
                        {icon}
                    </div>
                );

                if (linkedUsdtTx && isLinkedPortfolioTx) {
                    const isBuy = linkedUsdtTx.type === 'buy';
                    const manualNote = getManualClientNote(tx.notes);
                    const linkedClientRows = tx.linkedTxId
                        ? clientTransactionsDzd.filter((candidate) => candidate.linkedTxId === tx.linkedTxId)
                        : [];
                    const primaryClientRow = (linkedUsdtTx.linkedClientId
                        ? linkedClientRows.find((candidate) => candidate.clientId === linkedUsdtTx.linkedClientId)
                        : undefined)
                        || linkedClientRows.find((candidate) => candidate.linkRole === 'primary')
                        || linkedClientRows.find((candidate) => candidate.id !== tx.id && candidate.linkRole !== 'dzd_receiver');
                    const receiverClientRow = (linkedUsdtTx.linkedClientDzdId
                        ? linkedClientRows.find((candidate) => candidate.clientId === linkedUsdtTx.linkedClientDzdId)
                        : undefined)
                        || linkedClientRows.find((candidate) => candidate.linkRole === 'dzd_receiver');
                    const currentRowIsReceiver = tx.linkRole === 'dzd_receiver'
                        || Boolean(linkedUsdtTx.linkedClientDzdId && tx.clientId === linkedUsdtTx.linkedClientDzdId)
                        || receiverClientRow?.id === tx.id;
                    const originalClient = currentRowIsReceiver
                        ? (linkedUsdtTx.linkedClientId
                            ? clientsById.get(linkedUsdtTx.linkedClientId)
                            : (primaryClientRow ? clientsById.get(primaryClientRow.clientId) : undefined))
                        : undefined;
                    const receiverClient = !currentRowIsReceiver
                        ? (linkedUsdtTx.linkedClientDzdId
                            ? clientsById.get(linkedUsdtTx.linkedClientDzdId)
                            : (receiverClientRow ? clientsById.get(receiverClientRow.clientId) : undefined))
                        : undefined;
                    const relationClientName = originalClient
                        ? getClientFullName(originalClient)
                        : receiverClient
                            ? getClientFullName(receiverClient)
                            : '';
                    const relationDetail = originalClient
                        ? String(t('transactions.originalClient')).replace('{client}', relationClientName)
                        : receiverClient
                            ? String(t('transactions.settlementAt')).replace('{client}', relationClientName)
                            : '';
                    const details = [
                        relationDetail,
                        withoutGeneratedRelation(manualNote, relationDetail, relationClientName)
                    ].filter(Boolean).join(' - ');
                    const amountLabel = currentRowIsReceiver
                        ? formatDzd(Math.abs(Number(tx.montant || 0)), { min: 2, max: 2 })
                        : `${formatNumber(Number(linkedUsdtTx.quantity || 0), { min: 0, max: 2 })} ${linkedUsdtTx.currency}`;
                    const amountColor = currentRowIsReceiver
                        ? 'text-primary'
                        : (isBuy ? 'text-financial-profit' : 'text-financial-loss');
                    return {
                        id: `client_linked_${tx.id}`,
                        originalId: tx.id,
                        timestamp: tx.timestamp,
                        date: tx.date,
                        time: tx.time,
                        typeLabel: getPortfolioOperationLabel(linkedUsdtTx.type, linkedUsdtTx.currency, t as (key: string) => string),
                        amountLabel,
                        amountColor,
                        icon: iconNode,
                        details,
                        contextLabel: relationDetail || undefined,
                        category: 'crypto',
                        rawTx: linkedUsdtTx,
                        actionRawTx: tx,
                        sourceType: 'usdt_tx',
                    };
                }

                return {
                    id: `client_${tx.id}`,
                    originalId: tx.id,
                    timestamp: tx.timestamp,
                    date: tx.date,
                    time: tx.time,
                    typeLabel: getClientOperationLabel(tx.type, t as (key: string) => string),
                    amountLabel: formatDzd(Math.abs(Number(tx.montant || 0)), { min: 2, max: 2 }),
                    amountColor: isTransfer ? 'text-primary' : (isCredit ? 'text-financial-profit' : 'text-financial-loss'),
                    icon: iconNode,
                    details: isTransfer
                        ? getClientTransferDetails(tx, counterpartName, t as (key: string) => string)
                        : getManualClientNote(tx.notes),
                    category: 'client',
                    rawTx: tx,
                    actionRawTx: tx,
                    sourceType: 'client_tx',
                };
            }),
        ]);
    }, [clientTransactionsDzd, clientsById, getClientFullName, linkedTransactionsById, t, visibleDateGroups]);
    const clientStats = useMemo(() => {
        const allTxs = Object.values(groupedHistory).flat();
        let lastTs = 0;
        let firstTs = Infinity;
        for (const tx of allTxs) {
            if (tx.timestamp > lastTs) lastTs = tx.timestamp;
            if (tx.timestamp < firstTs) firstTs = tx.timestamp;
        }
        return {
            txCount: allTxs.length,
            lastDate: lastTs > 0 ? new Date(lastTs).toLocaleDateString('fr-FR') : null,
            firstDate: firstTs < Infinity ? new Date(firstTs).toLocaleDateString('fr-FR') : null,
        };
    }, [groupedHistory]);
    const balanceStatusLabel = selectedClientBalance > 0.01
        ? t('finance.advance')
        : selectedClientBalance < -0.01
            ? t('finance.debt')
            : t('clients.zeroBalance');
    const balanceStatusColor = selectedClientBalance > 0.01
        ? 'text-financial-profit'
        : selectedClientBalance < -0.01
            ? 'text-financial-debt'
            : 'text-neutral-500';
    const wallets = readClientWallets(selectedClient);
    const hasContactInfo = Boolean(selectedClient.phone || selectedClient.redotpayId || selectedClient.binanceEmail || wallets.length > 0);
    const hasDebt = selectedClientBalance < -0.01;
    const hasPhone = Boolean(selectedClient.phone);

    const handleSendReminder = () => {
        const name = getClientFullName(selectedClient);
        const amount = Math.abs(selectedClientBalance);
        const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
        const today = formatLongDate(new Date(), lang, t);
        const msg = `📋 ${t('clients.reminderTitle')}\n\n${t('clients.clientWord')} : ${name}\n${t('clients.amountDue')} : ${fmt(amount)} DZD\n${t('common.dateWord')} : ${today}\n\n${t('clients.reminderFooter')}`;
        if (selectedClient.phone) {
            openWhatsAppMessenger(selectedClient.phone, msg);
        } else if (typeof navigator.share === 'function') {
            navigator.share({ text: msg }).catch(() => {});
        } else {
            navigator.clipboard.writeText(msg);
        }
    };
    const clientName = getClientFullName(selectedClient);
    const statusPillClass = selectedClientBalance > 0.01
        ? 'bg-financial-profit-bg text-financial-profit'
        : selectedClientBalance < -0.01
            ? 'bg-financial-debt-bg text-financial-debt'
            : 'bg-surface-muted text-neutral-600';
    const quickActions = [
        { id: 'collect', label: t('clients.actionCollect') as string, icon: <ArrowDownLeftIcon className="h-5 w-5"/>, tone: 'bg-financial-profit-bg text-financial-profit', onClick: () => openClientTxModal(null, 'Règlement Reçu', selectedClientId) },
        { id: 'pay', label: t('clients.actionPay') as string, icon: <ArrowUpRightIcon className="h-5 w-5"/>, tone: 'bg-financial-loss-bg text-financial-loss', onClick: () => openClientTxModal(null, 'Paiement Effectué', selectedClientId) },
        { id: 'transfer', label: t('clients.actionTransfer') as string, icon: <UsersIcon className="h-5 w-5"/>, tone: 'bg-primary/10 text-primary dark:text-primary-light', onClick: () => openClientToClientTransferModal(selectedClient), testId: 'client-transfer-button' },
        ...(hasDebt ? [{ id: 'remind', label: (hasPhone ? t('clients.actionWhatsAppReminder') : t('clients.actionCopyReminder')) as string, icon: <WhatsAppGlyph />, tone: 'bg-[#25D366]/10 text-[#25D366]', onClick: handleSendReminder }] : []),
    ];
    const creditLimitAlert = (() => {
        const limit = selectedClient.creditLimit;
        if (!limit || limit <= 0 || selectedClientBalance >= 0) return null;
        const debt = Math.abs(selectedClientBalance);
        if (debt <= limit) return null;
        const pct = Math.round((debt / limit) * 100);
        return (<AlertCard tone="warning" title={`${t('clients.creditLimitExceeded')} (${pct}%)`} detail={<>
            {t('finance.debt')} : <span dir="ltr" className="font-semibold">{Math.round(debt).toLocaleString('fr-FR')} DZD</span>
            {' '}/ {t('clients.limitWord')} : <span dir="ltr" className="font-semibold">{Math.round(limit).toLocaleString('fr-FR')} DZD</span>
          </>}/>);
    })();
    const iconButtonClass = 'flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-surface-muted hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
    return (<div className="anim-page-in flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setSelectedClientId(null)} aria-label={t('common.back')} className={`-ms-2 ${iconButtonClass}`}>
          <ChevronLeftIcon aria-hidden="true" className="h-6 w-6 rtl:-scale-x-100"/>
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-neutral-900">{clientName}</h2>
        <button type="button" onClick={() => handleTouchStart(selectedClient)} className={iconButtonClass} aria-label={t('clients.share')} title={t('clients.share')}>
          <ShareIcon aria-hidden="true" className="h-5 w-5"/>
        </button>
        <button type="button" onClick={() => openClientModal(selectedClient)} className={iconButtonClass} aria-label={t('transactions.editClient')} title={t('transactions.editClient')}>
          <PencilIcon aria-hidden="true" className="h-5 w-5"/>
        </button>
        <Button onClick={() => setIsActivityReportOpen(true)} variant="primary" size="sm" className="ms-1 shrink-0">
          <FileSpreadsheetIcon className="h-4 w-4"/>
          PDF
        </Button>
      </div>

      {/* Balance and the actions used every day, before anything else */}
      <section aria-label={t('common.balance') as string} className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-base font-bold text-neutral-600">
            {getNameInitials(clientName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-neutral-500">{t('common.balance')}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusPillClass}`}>{balanceStatusLabel}</span>
            </div>
            <CurrencyAmount value={selectedClientBalance} currency="DZD" semantic="plain" size="hero" decimals={0} className={`mt-0.5 block ${balanceStatusColor}`}/>
          </div>
        </div>
        <div role="group" aria-label={t('clients.quickActions') as string} className={`mt-4 grid gap-2 ${quickActions.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {quickActions.map((action) => (<button key={action.id} type="button" onClick={action.onClick} data-testid={'testId' in action ? action.testId : undefined} className="flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-button border border-border bg-surface px-1 py-2 text-center text-xs font-semibold leading-tight text-neutral-800 transition-colors hover:bg-surface-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-full ${action.tone}`}>{action.icon}</span>
              <span className="max-w-full">{action.label}</span>
            </button>))}
        </div>
        <button type="button" onClick={() => setIsActivityReportOpen(true)} data-testid="client-activity-report-button" className="mt-2 flex min-h-touch w-full items-center gap-3 rounded-button border border-border bg-surface px-3 py-2 text-start transition-colors hover:bg-surface-muted active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-primary-light">
            <FileSpreadsheetIcon className="h-5 w-5"/>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-900">{t('clients.activityReport')}</span>
            <span className="block truncate text-xs text-neutral-500">{t('clients.activityReportHint')}</span>
          </span>
          <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>
        </button>
      </section>

      {creditLimitAlert}

      <Tabs variant="pills" tabs={[
            { id: 'history', label: t('clients.history') as string, badge: formatNumber(totalTransactionCount, { min: 0, max: 0 }) },
            { id: 'dossier', label: t('clients.dossier') as string },
        ]} activeTab={activeTab} onChange={(id) => setActiveTab(id === 'dossier' ? 'dossier' : 'history')}/>

      <div role="tabpanel" aria-label={t('clients.history') as string} hidden={activeTab !== 'history'} className="overflow-hidden rounded-card border border-border bg-surface">
        {dates.length > 0 ? (<div className="pb-2">
            <TransactionDisplayList
              dateGroups={visibleDisplayDateGroups}
              t={t}
              getRelativeDateLabel={(date) => getRelativeFrDateLabel(date, t)}
              onEditDisplayTx={(displayTx) => handleEditClientTx((displayTx.actionRawTx || displayTx.rawTx) as ClientTransactionDzd)}
              onDeleteDisplayTx={(displayTx) => handleDeleteClientTxClick((displayTx.actionRawTx || displayTx.rawTx) as ClientTransactionDzd)}
              onOpenDisplayTx={(displayTx) => handleEditClientTx((displayTx.actionRawTx || displayTx.rawTx) as ClientTransactionDzd)}
              formatDzdAmount={(value) => formatDzd(value, { min: 2, max: 2 })}
              profitByTxId={profitByTxId}
            />
            {hiddenTransactionCount > 0 && (<div className="px-4 pb-3 pt-4">
                <Button onClick={() => setVisibleTransactionCount((prev) => prev + LOAD_MORE_TRANSACTIONS)} variant="outline" className="w-full font-semibold">
                  {t('transactions.showMore')} ({Math.min(hiddenTransactionCount, LOAD_MORE_TRANSACTIONS)})
                </Button>
                <p className="mt-2 text-center text-xs text-neutral-500" dir="ltr">
                  {totalTransactionCount - hiddenTransactionCount} / {totalTransactionCount}
                </p>
              </div>)}
          </div>) : (<EmptyState icon={<FileSpreadsheetIcon className="h-5 w-5"/>} title={t('transactions.noTransactions') as string}/>)}
      </div>

      <div role="tabpanel" aria-label={t('clients.dossier') as string} hidden={activeTab !== 'dossier'} className="overflow-hidden rounded-card border border-border bg-surface">
        {hasContactInfo && (<>
            <ContactRow label={t('transactions.phone') as string} value={selectedClient.phone || ''} copiedValue={copiedValue} onCopy={handleCopy} isPhone/>
            <ContactRow label="RedotPay ID" value={selectedClient.redotpayId || ''} copiedValue={copiedValue} onCopy={handleCopy}/>
            <ContactRow label="Binance Email" value={selectedClient.binanceEmail || ''} copiedValue={copiedValue} onCopy={handleCopy}/>
            {wallets.map(({ network, address }) => (<Fragment key={network}>
                <ContactRow label={`${t('clients.walletAddressLabel')} ${network}`} value={address} copiedValue={copiedValue} onCopy={handleCopy} isAddress/>
              </Fragment>))}
          </>)}
        {selectedClient.notes && (<div className="border-t border-border px-4 py-3 first:border-t-0">
            <p className="text-xs font-semibold text-neutral-500">{t('clients.privateNotes')}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{selectedClient.notes}</p>
          </div>)}
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0">
          <span className="text-sm text-neutral-500">{t('reports.operations')}</span>
          <span className="text-sm font-semibold text-neutral-900 tabular-nums" dir="ltr">{clientStats.txCount}</span>
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-sm text-neutral-500">{t('clients.lastOperation')}</span>
          <span className="text-sm font-semibold text-neutral-900 tabular-nums" dir="ltr">{clientStats.lastDate || '—'}</span>
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-sm text-neutral-500">{t('clients.firstOperation')}</span>
          <span className="text-sm font-semibold text-neutral-900 tabular-nums" dir="ltr">{clientStats.firstDate || '—'}</span>
        </div>
        {selectedClient.creditLimit && selectedClient.creditLimit > 0 && (<div className="flex min-h-12 items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="text-sm text-neutral-500">{t('clients.creditLimit')}</span>
            <CurrencyAmount value={selectedClient.creditLimit} currency="DZD" semantic="plain" size="md" decimals={0}/>
          </div>)}
      </div>

      {isActivityReportOpen && (<Suspense fallback={null}>
          <ClientActivityReportDialog onClose={() => setIsActivityReportOpen(false)} clientId={selectedClientId} clientName={clientName} clientRows={clientTransactionsDzd} transactions={transactions}/>
        </Suspense>)}

    </div>);
}
