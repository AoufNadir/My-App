import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { DatePicker } from '../ui/DatePicker';
import { Label } from '../ui/Label';
import { SectionHeading } from '../ui/SectionHeading';
import { HeroKpiCard } from '../ui/HeroKpiCard';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { ClientDzd, ClientTransactionDzd, Tx } from '../../types';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { ShareIcon } from '../icons/ShareIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { CopyIcon } from '../icons/CopyIcon';
import { CheckIcon } from '../icons/CheckIcon';
import { UserIcon } from '../icons/UserIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { formatDzd, formatNumber, getRelativeFrDateLabel } from '../../pages/shared/pageFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import type { ClientReportDateRange, ClientReportRequest } from '../../hooks/useReportExports';
import { TransactionDisplayList } from '../transactions/TransactionDisplayList';
import type { DisplayTx } from '../transactions/transactionsTypes';
import { getClientOperationLabel, getClientTransferDetails, getManualClientNote, getPortfolioOperationLabel } from '../../utils/transactionTerminology';
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
    handleExportClientReport: (clientId: string, range: ClientReportRequest, year?: number) => void;
};
type ContactRowProps = {
    label: string;
    value: string;
    copiedValue: string | null;
    onCopy: (value: string) => void;
    isPhone?: boolean;
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
function ContactRow({ label, value, copiedValue, onCopy, isPhone }: ContactRowProps) {
    const { t } = useLanguage();
    if (!value)
        return null;
    const isCopied = copiedValue === value;
    return (<div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-neutral-500">{label}</p>
        <p dir="ltr" className="text-base font-semibold truncate select-all leading-snug mt-0.5">{value}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isPhone && (<button type="button" onClick={() => openWhatsAppMessenger(value)} className="flex h-[40px] w-[40px] items-center justify-center rounded-button bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors" aria-label="WhatsApp Messenger" title="WhatsApp Messenger">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.054 23.5l5.782-1.519A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.877 9.877 0 01-5.031-1.375l-.361-.214-3.737.981 1.001-3.648-.235-.374A9.855 9.855 0 012.1 12c0-5.467 4.433-9.9 9.9-9.9 5.467 0 9.9 4.433 9.9 9.9s-4.433 9.9-9.9 9.9z"/>
            </svg>
          </button>)}
        <Button onClick={() => onCopy(value)} variant="icon" size="icon" className={`rounded-button ${isCopied ? 'bg-success-bg text-financial-profit' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`} aria-label={`${t('common.copy')} ${label}`}>
          {isCopied ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
        </Button>
      </div>
    </div>);
}
export function ClientDetailsView({ selectedClientId, selectedClient, selectedClientBalance, groupedHistory, clientTransactionsDzd, clientsDzd, setSelectedClientId, getClientFullName, handleTouchStart, openClientModal, copiedValue, handleCopy, transactions, profitByTxId, handleEditClientTx, handleDeleteClientTxClick, openClientTxModal, openClientToClientTransferModal, handleExportClientReport }: ClientDetailsViewProps) {
    const { t } = useLanguage();
    const INITIAL_VISIBLE_TRANSACTIONS = 60;
    const LOAD_MORE_TRANSACTIONS = 60;
    const [visibleTransactionCount, setVisibleTransactionCount] = useState(INITIAL_VISIBLE_TRANSACTIONS);
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportDateError, setReportDateError] = useState('');
    const dates = Object.keys(groupedHistory);
    const linkedTransactionsById = useMemo(() => new Map(transactions.map((tx) => [tx.id, tx])), [transactions]);
    const clientsById = useMemo(() => new Map(clientsDzd.map((client) => [client.id, client])), [clientsDzd]);
    const parseDateBoundary = (value: string, endOfDay: boolean): number | null => {
        if (!value) return null;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return null;
        const date = new Date(year, month - 1, day);
        date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
        return date.getTime();
    };
    const toInputDate = (date: Date): string => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };
    const setCurrentMonthRange = () => {
        const now = new Date();
        setReportStartDate(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
        setReportEndDate(toInputDate(now));
        setReportDateError('');
    };
    const setCurrentYearRange = () => {
        const now = new Date();
        setReportStartDate(`${now.getFullYear()}-01-01`);
        setReportEndDate(toInputDate(now));
        setReportDateError('');
    };
    const setAllHistoryRange = () => {
        const firstTimestamp = clientTransactionsDzd
            .filter((tx) => tx.clientId === selectedClientId && Number.isFinite(Number(tx.timestamp)))
            .reduce<number | null>((first, tx) => first === null ? tx.timestamp : Math.min(first, tx.timestamp), null);
        if (firstTimestamp === null) {
            setReportStartDate('');
            setReportEndDate('');
            setReportDateError('Aucune opération trouvée pour ce client.');
            return;
        }
        setReportStartDate(toInputDate(new Date(firstTimestamp)));
        setReportEndDate(toInputDate(new Date()));
        setReportDateError('');
    };
    const openReportDialog = () => {
        setCurrentMonthRange();
        setReportDateError('');
        setIsReportDialogOpen(true);
    };
    const handleCreateReport = () => {
        const startTs = parseDateBoundary(reportStartDate, false);
        const endTs = parseDateBoundary(reportEndDate, true);
        if (startTs === null || endTs === null) {
            setReportDateError('Veuillez sélectionner les deux dates.');
            return;
        }
        if (startTs > endTs) {
            setReportDateError('La date de début doit être avant la date de fin.');
            return;
        }
        const range: ClientReportDateRange = { startTs, endTs };
        handleExportClientReport(selectedClientId, range);
        setIsReportDialogOpen(false);
    };
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
    const hasContactInfo = Boolean(selectedClient.phone || selectedClient.redotpayId || selectedClient.binanceEmail);
    const hasDebt = selectedClientBalance < -0.01;
    const hasPhone = Boolean(selectedClient.phone);

    const handleSendReminder = () => {
        const name = getClientFullName(selectedClient);
        const amount = Math.abs(selectedClientBalance);
        const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
        const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        const msg = `📋 ${t('clients.reminderTitle')}\n\n${t('clients.clientWord')} : ${name}\n${t('clients.amountDue')} : ${fmt(amount)} DZD\n${t('common.dateWord')} : ${today}\n\n${t('clients.reminderFooter')}`;
        if (selectedClient.phone) {
            openWhatsAppMessenger(selectedClient.phone, msg);
        } else if (typeof navigator.share === 'function') {
            navigator.share({ text: msg }).catch(() => {});
        } else {
            navigator.clipboard.writeText(msg);
        }
    };
    return (<div className="anim-page-in space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button onClick={() => setSelectedClientId(null)} variant="icon" size="icon" className="rounded-full text-neutral-600 hover:bg-neutral-100">
            <ChevronLeftIcon className="w-6 h-6"/>
          </Button>
          <div className="flex-grow min-w-0">
            <h2 className="flex items-center gap-2 text-base font-bold text-neutral-900 truncate min-w-0">
              <UserIcon className="w-4 h-4 shrink-0 text-primary"/>
              <span className="truncate">{getClientFullName(selectedClient)}</span>
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button onClick={() => handleTouchStart(selectedClient)} variant="icon" size="icon" className="rounded-full hover:bg-neutral-100" aria-label={t('clients.share')}>
            <ShareIcon className="w-5 h-5"/>
          </Button>
          <Button onClick={() => openClientModal(selectedClient)} variant="icon" size="icon" className="rounded-full hover:bg-neutral-100" aria-label={t('transactions.editClient')}>
            <PencilIcon className="w-5 h-5"/>
          </Button>
          <Button onClick={openReportDialog} variant="primary" size="sm" className="ms-1">
            <FileSpreadsheetIcon className="w-4 h-4"/>
            PDF
          </Button>
        </div>
      </div>

      {(() => {
        const limit = selectedClient.creditLimit;
        if (!limit || limit <= 0 || selectedClientBalance >= 0) return null;
        const debt = Math.abs(selectedClientBalance);
        if (debt <= limit) return null;
        const pct = Math.round((debt / limit) * 100);
        return (
          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-bg px-4 py-3">
            <AlertTriangleIcon className="h-5 w-5 shrink-0 text-warning mt-0.5"/>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-warning">{t('clients.creditLimitExceeded')} ({pct}%)</p>
              <p className="mt-0.5 text-xs text-warning/70">
                {t('finance.debt')} : <span dir="ltr" className="font-semibold">{Math.round(debt).toLocaleString('fr-FR')} DZD</span>
                {' '}/ {t('clients.limitWord')} : <span dir="ltr" className="font-semibold">{Math.round(limit).toLocaleString('fr-FR')} DZD</span>
              </p>
            </div>
          </div>
        );
      })()}

      <HeroKpiCard accent="sky" icon={<WalletIcon className="w-5 h-5"/>} primaryLabel={t('common.balance') as string} primaryValue={selectedClientBalance} primaryCurrency="DZD" primarySemantic="auto" secondary={[
            {
                label: t('clients.status') as string,
                value: 0,
                display: (<span className={`text-lg font-semibold ${balanceStatusColor}`}>
                {balanceStatusLabel}
              </span>),
            },
            { label: t('reports.operations') as string, value: totalTransactionCount, currency: null, semantic: 'plain' }
        ]}/>

      <Card>
        <CardHeader className="p-4 pb-3">
          <SectionHeading icon={<InfoIcon className="w-4 h-4"/>}>{t('clients.dossier')}</SectionHeading>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-neutral-100">
          {hasContactInfo && (
            <>
              <ContactRow label={t('transactions.phone') as string} value={selectedClient.phone || ''} copiedValue={copiedValue} onCopy={handleCopy} isPhone/>
              <ContactRow label="RedotPay ID" value={selectedClient.redotpayId || ''} copiedValue={copiedValue} onCopy={handleCopy}/>
              <ContactRow label="Binance Email" value={selectedClient.binanceEmail || ''} copiedValue={copiedValue} onCopy={handleCopy}/>
            </>
          )}
          {selectedClient.notes && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold uppercase text-neutral-500">{t('clients.privateNotes')}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{selectedClient.notes}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-neutral-500">{t('reports.operations')}</span>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums" dir="ltr">{clientStats.txCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-neutral-500">{t('clients.lastOperation')}</span>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums" dir="ltr">{clientStats.lastDate || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-neutral-500">{t('clients.firstOperation')}</span>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums" dir="ltr">{clientStats.firstDate || '—'}</span>
          </div>
          {selectedClient.creditLimit && selectedClient.creditLimit > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-neutral-500">{t('clients.creditLimit')}</span>
              <CurrencyAmount value={selectedClient.creditLimit} currency="DZD" semantic="plain" size="md" decimals={0}/>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-3">
          <SectionHeading icon={<WalletIcon className="w-4 h-4"/>}>{t('clients.actions')}</SectionHeading>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => openClientTxModal(null, 'Règlement Reçu', selectedClientId)} variant="primary" size="md" className="w-full font-bold">
              <ArrowDownLeftIcon className="w-4 h-4"/>
              {t('clients.actionCollect')}
            </Button>
            <Button onClick={() => openClientTxModal(null, 'Paiement Effectué', selectedClientId)} variant="tab" size="md" className="w-full font-bold">
              <ArrowUpRightIcon className="w-4 h-4"/>
              {t('clients.actionPay')}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => openClientToClientTransferModal(selectedClient)}
            data-testid="client-transfer-button"
            className="inline-flex min-h-button-md w-full min-w-0 items-center justify-center gap-2 rounded-button bg-neutral-100 px-4 py-2.5 text-sm font-bold leading-tight text-neutral-700 transition-colors hover:bg-neutral-200 active:scale-[0.98] active:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
          >
            <UsersIcon className="w-4 h-4"/>
            <span>{t('clients.actionTransfer')}</span>
          </button>
          {hasDebt && (
            <button
              type="button"
              onClick={handleSendReminder}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 py-3 text-sm font-bold text-[#25D366] transition-colors hover:bg-[#25D366]/20 active:scale-[0.99]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.054 23.5l5.782-1.519A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.877 9.877 0 01-5.031-1.375l-.361-.214-3.737.981 1.001-3.648-.235-.374A9.855 9.855 0 012.1 12c0-5.467 4.433-9.9 9.9-9.9 5.467 0 9.9 4.433 9.9 9.9s-4.433 9.9-9.9 9.9z"/>
              </svg>
              <span>
                {hasPhone ? t('clients.actionWhatsAppReminder') : t('clients.actionCopyReminder')}
              </span>
            </button>
          )}
        </CardContent>
      </Card>

      <Card>
          <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
            <SectionHeading icon={<FileSpreadsheetIcon className="w-4 h-4"/>}>
              {t('clients.history')}
            </SectionHeading>
            <span className="text-sm text-neutral-500">{totalTransactionCount} {t('transactions.operationsWord')}</span>
          </CardHeader>
          <CardContent className="p-0">
            {dates.length > 0 ? (<div className="pb-2">
                <TransactionDisplayList
                  dateGroups={visibleDisplayDateGroups}
                  t={t}
                  getRelativeDateLabel={getRelativeFrDateLabel}
                  onEditDisplayTx={(displayTx) => handleEditClientTx((displayTx.actionRawTx || displayTx.rawTx) as ClientTransactionDzd)}
                  onDeleteDisplayTx={(displayTx) => handleDeleteClientTxClick((displayTx.actionRawTx || displayTx.rawTx) as ClientTransactionDzd)}
                  onOpenDisplayTx={(displayTx) => handleEditClientTx((displayTx.actionRawTx || displayTx.rawTx) as ClientTransactionDzd)}
                  formatDzdAmount={(value) => formatDzd(value, { min: 2, max: 2 })}
                  profitByTxId={profitByTxId}
                />
                {hiddenTransactionCount > 0 && (<div className="px-4 pt-4 pb-3">
                    <Button onClick={() => setVisibleTransactionCount((prev) => prev + LOAD_MORE_TRANSACTIONS)} variant="outline" className="w-full rounded-xl px-4 py-3 font-semibold bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
                      {t('transactions.showMore')} ({Math.min(hiddenTransactionCount, LOAD_MORE_TRANSACTIONS)})
                    </Button>
                    <p className="mt-2 text-center text-xs text-neutral-500">
                      {totalTransactionCount - hiddenTransactionCount} / {totalTransactionCount}
                    </p>
                  </div>)}
              </div>) : (<EmptyState icon={<FileSpreadsheetIcon className="w-5 h-5"/>} title={t('transactions.noTransactions') as string}/>)}
          </CardContent>
        </Card>
      <Modal isOpen={isReportDialogOpen} onClose={() => setIsReportDialogOpen(false)} className="max-w-md bg-surface">
        <ModalHeader onClose={() => setIsReportDialogOpen(false)} className="border-b border-border px-4 py-3 sm:px-5">
          <ModalTitle className="text-base sm:text-lg">Créer rapport client</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={setCurrentMonthRange} variant="outline" className="rounded-lg px-3 py-2 text-sm font-bold">
              Mois courant
            </Button>
            <Button onClick={setCurrentYearRange} variant="outline" className="rounded-lg px-3 py-2 text-sm font-bold">
              Année courante
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Date début</Label>
              <DatePicker value={reportStartDate} onChange={(value) => { setReportStartDate(value); setReportDateError(''); }} className="mt-1"/>
            </div>
            <div>
              <Label>Date fin</Label>
              <DatePicker value={reportEndDate} onChange={(value) => { setReportEndDate(value); setReportDateError(''); }} className="mt-1"/>
            </div>
          </div>
          {reportDateError && <p className="text-sm font-semibold text-danger">{reportDateError}</p>}
        </ModalContent>
        <ModalFooter className="border-t border-border px-4 py-3 sm:px-5">
          <Button onClick={setAllHistoryRange} variant="outline" className="w-full">
            Tout l'historique
          </Button>
          <Button onClick={handleCreateReport} className="w-full bg-primary text-white hover:bg-primary-dark">Créer PDF</Button>
        </ModalFooter>
      </Modal>
    </div>);
}
