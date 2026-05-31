import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { SectionHeading } from '../ui/SectionHeading';
import { HeroKpiCard } from '../ui/HeroKpiCard';
import { EmptyState } from '../ui/EmptyState';
import { Tabs } from '../ui/Tabs';
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
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { ArrowDownIcon } from '../icons/ArrowDownIcon';
import { ArrowUpIcon } from '../icons/ArrowUpIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { formatNumber, getRelativeFrDateLabel } from '../../pages/shared/pageFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { normalizeLedgerLabel } from '../../utils/financialUx';
type ClientDetailsViewProps = {
    selectedClientId: string;
    selectedClient: ClientDzd;
    selectedClientBalance: number;
    groupedHistory: Record<string, ClientTransactionDzd[]>;
    setSelectedClientId: (id: string | null) => void;
    getClientFullName: (client: ClientDzd) => string;
    handleTouchStart: (client: ClientDzd) => void;
    openClientModal: (client: ClientDzd | null) => void;
    copiedValue: string | null;
    handleCopy: (text: string) => void;
    transactions: Tx[];
    handleEditClientTx: (tx: ClientTransactionDzd) => void;
    handleDeleteClientTxClick: (tx: ClientTransactionDzd) => void;
    openClientTxModal: (tx: ClientTransactionDzd | null, presetType?: string, selectedClientId?: string) => void;
    handleExportClientReport: (clientId: string, month: number, year: number) => void;
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
function ContactRow({ label, value, copiedValue, onCopy, isPhone }: ContactRowProps) {
    if (!value)
        return null;
    const isCopied = copiedValue === value;
    return (<div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-neutral-500">{label}</p>
        <p dir="ltr" className="text-base font-semibold truncate select-all leading-snug mt-0.5">{value}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isPhone && (<a href={`https://wa.me/${formatWaNumber(value)}`} target="_blank" rel="noopener noreferrer" className="flex h-[40px] w-[40px] items-center justify-center rounded-button bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors" aria-label="WhatsApp">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.054 23.5l5.782-1.519A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.877 9.877 0 01-5.031-1.375l-.361-.214-3.737.981 1.001-3.648-.235-.374A9.855 9.855 0 012.1 12c0-5.467 4.433-9.9 9.9-9.9 5.467 0 9.9 4.433 9.9 9.9s-4.433 9.9-9.9 9.9z"/>
            </svg>
          </a>)}
        <Button onClick={() => onCopy(value)} variant="icon" size="icon" className={`rounded-button ${isCopied ? 'bg-success-bg text-financial-profit' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`} aria-label={`Copier ${label}`}>
          {isCopied ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
        </Button>
      </div>
    </div>);
}
export function ClientDetailsView({ selectedClientId, selectedClient, selectedClientBalance, groupedHistory, setSelectedClientId, getClientFullName, handleTouchStart, openClientModal, copiedValue, handleCopy, transactions, handleEditClientTx, handleDeleteClientTxClick, openClientTxModal, handleExportClientReport }: ClientDetailsViewProps) {
    const { t } = useLanguage();
    const INITIAL_VISIBLE_TRANSACTIONS = 120;
    const LOAD_MORE_TRANSACTIONS = 120;
    const [visibleTransactionCount, setVisibleTransactionCount] = useState(INITIAL_VISIBLE_TRANSACTIONS);
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
    const dates = Object.keys(groupedHistory);
    const linkedTransactionsById = useMemo(() => new Map(transactions.map((tx) => [tx.id, tx])), [transactions]);
    const exportCurrentMonthReport = () => {
        const now = new Date();
        handleExportClientReport(selectedClientId, now.getMonth(), now.getFullYear());
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
    const clientStats = useMemo(() => {
        const allTxs = Object.values(groupedHistory).flat();
        let totalReceived = 0;
        let totalPaid = 0;
        let lastTs = 0;
        let firstTs = Infinity;
        const nowMs = Date.now();
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        let monthCount = 0;
        for (const tx of allTxs) {
            const amount = Math.abs(Number(tx.montant || 0));
            if (tx.type === 'Règlement Reçu') totalReceived += amount;
            else if (tx.type === 'Paiement Effectué') totalPaid += amount;
            if (tx.timestamp > lastTs) lastTs = tx.timestamp;
            if (tx.timestamp < firstTs) firstTs = tx.timestamp;
            if (tx.timestamp >= monthStart && tx.timestamp <= nowMs) monthCount++;
        }
        return {
            totalReceived,
            totalPaid,
            txCount: allTxs.length,
            monthCount,
            lastDate: lastTs > 0 ? new Date(lastTs).toLocaleDateString('fr-FR') : null,
            firstDate: firstTs < Infinity ? new Date(firstTs).toLocaleDateString('fr-FR') : null,
            daysSinceLast: lastTs > 0 ? Math.floor((nowMs - lastTs) / 86_400_000) : null,
        };
    }, [groupedHistory]);
    // Debt aging: FIFO attribution — oldest unpaid debt first
    const debtAging = useMemo(() => {
        if (selectedClientBalance >= -0.01) return null; // no debt
        const allTxs = Object.values(groupedHistory).flat()
            .sort((a, b) => a.timestamp - b.timestamp); // oldest first
        // Build debt queue using FIFO
        const queue: Array<{ amount: number; timestamp: number }> = [];
        for (const tx of allTxs) {
            const m = Number(tx.montant || 0);
            if (tx.affectsBalance === false) continue;
            if (m < 0) {
                queue.push({ amount: Math.abs(m), timestamp: tx.timestamp });
            } else if (m > 0) {
                let remaining = m;
                while (remaining > 0.005 && queue.length > 0) {
                    if (remaining >= queue[0].amount) {
                        remaining -= queue[0].amount;
                        queue.shift();
                    } else {
                        queue[0].amount -= remaining;
                        remaining = 0;
                    }
                }
            }
        }
        const now = Date.now();
        // Group by age buckets
        const buckets = { week: 0, month: 0, twoMonth: 0, old: 0 };
        for (const item of queue) {
            const days = (now - item.timestamp) / 86_400_000;
            if (days <= 7) buckets.week += item.amount;
            else if (days <= 30) buckets.month += item.amount;
            else if (days <= 60) buckets.twoMonth += item.amount;
            else buckets.old += item.amount;
        }
        const oldest = queue.length > 0 ? queue[0] : null;
        const oldestDays = oldest ? Math.floor((now - oldest.timestamp) / 86_400_000) : 0;
        // Use queue sum for total (consistent with buckets)
        const queueTotal = Math.round(
            (buckets.week + buckets.month + buckets.twoMonth + buckets.old) * 100
        ) / 100;
        return { buckets, oldest, oldestDays, total: queueTotal || Math.abs(selectedClientBalance) };
    }, [groupedHistory, selectedClientBalance]);

    const balanceStatusLabel = selectedClientBalance > 0.01
        ? 'Avance'
        : selectedClientBalance < -0.01
            ? 'Dette'
            : 'Solde Nul';
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
        const msg = `📋 Rappel de solde\n\nClient : ${name}\nMontant dû : ${fmt(amount)} DZD\nDate : ${today}\n\nMerci de régulariser votre solde.`;
        if (selectedClient.phone) {
            const digits = selectedClient.phone.replace(/\D/g, '');
            const intl = digits.startsWith('0') ? '213' + digits.slice(1) : digits;
            window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
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
          <Button onClick={() => handleTouchStart(selectedClient)} variant="icon" size="icon" className="rounded-full hover:bg-neutral-100" aria-label="Partager">
            <ShareIcon className="w-5 h-5"/>
          </Button>
          <Button onClick={() => openClientModal(selectedClient)} variant="icon" size="icon" className="rounded-full hover:bg-neutral-100" aria-label="Modifier le client">
            <PencilIcon className="w-5 h-5"/>
          </Button>
          <Button onClick={exportCurrentMonthReport} variant="primary" size="sm" className="ms-1">
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
              <p className="text-sm font-bold text-warning">Seuil de crédit dépassé ({pct}%)</p>
              <p className="mt-0.5 text-xs text-warning/70">
                Dette : <span dir="ltr" className="font-semibold">{Math.round(debt).toLocaleString('fr-FR')} DZD</span>
                {' '}/ Limite : <span dir="ltr" className="font-semibold">{Math.round(limit).toLocaleString('fr-FR')} DZD</span>
              </p>
            </div>
          </div>
        );
      })()}

      <HeroKpiCard accent="sky" icon={<WalletIcon className="w-5 h-5"/>} primaryLabel={t('common.balance') as string} primaryValue={selectedClientBalance} primaryCurrency="DZD" primarySemantic="auto" secondary={[
            {
                label: 'Statut',
                value: 0,
                display: (<span className={`text-lg font-semibold ${balanceStatusColor}`}>
                {balanceStatusLabel}
              </span>),
            },
            { label: 'Operations', value: totalTransactionCount, currency: null, semantic: 'plain' }
        ]}/>

      <Card>
        <CardHeader className="p-4 pb-3">
          <SectionHeading icon={<WalletIcon className="w-4 h-4"/>}>Actions</SectionHeading>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => openClientTxModal(null, 'Règlement Reçu', selectedClientId)} variant="primary" size="md" className="w-full font-bold">
              <ArrowDownIcon className="w-4 h-4"/>
              {t('transactions.paymentReceived')}
            </Button>
            <Button onClick={() => openClientTxModal(null, 'Paiement Effectué', selectedClientId)} variant="tab" size="md" className="w-full font-bold">
              <ArrowUpIcon className="w-4 h-4"/>
              {t('transactions.paymentMade')}
            </Button>
          </div>
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
                {hasPhone ? 'Envoyer rappel WhatsApp' : 'Copier rappel de solde'}
                {' '}— {Math.round(Math.abs(selectedClientBalance)).toLocaleString('fr-FR')} DZD
              </span>
            </button>
          )}
        </CardContent>
      </Card>

      <Tabs tabs={[
            { id: 'overview', label: 'Apercu' },
            { id: 'history', label: 'Historique', badge: totalTransactionCount }
        ]} activeTab={activeTab} onChange={(id) => setActiveTab(id as 'overview' | 'history')} variant="underline"/>

      {activeTab === 'overview' && (<div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <SectionHeading icon={<InfoIcon className="w-4 h-4"/>}>Informations</SectionHeading>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-neutral-100">
              {hasContactInfo ? (<>
                  <ContactRow label={t('transactions.phone') as string} value={selectedClient.phone || ''} copiedValue={copiedValue} onCopy={handleCopy} isPhone/>
                  <ContactRow label="RedotPay ID" value={selectedClient.redotpayId || ''} copiedValue={copiedValue} onCopy={handleCopy}/>
                  <ContactRow label="Binance Email" value={selectedClient.binanceEmail || ''} copiedValue={copiedValue} onCopy={handleCopy}/>
                </>) : (<EmptyState icon={<InfoIcon className="w-5 h-5"/>} title="Aucune information de contact" subtitle="Modifiez le client pour ajouter telephone, email ou RedotPay ID."/>)}
            </CardContent>
          </Card>

          {selectedClient.notes && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <SectionHeading icon={<InfoIcon className="w-4 h-4"/>}>Notes privées</SectionHeading>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-1">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-700">{selectedClient.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Debt Aging card — only when client has debt */}
          {debtAging && (
            <Card>
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <SectionHeading icon={<AlertTriangleIcon className="w-4 h-4"/>}>
                    Vieillissement de la dette
                  </SectionHeading>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">
                    {debtAging.oldestDays}j max
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {/* Age buckets */}
                {([
                  { label: '0 – 7 jours', amount: debtAging.buckets.week, cls: 'bg-success-bg border-success/30 text-financial-profit' },
                  { label: '8 – 30 jours', amount: debtAging.buckets.month, cls: 'bg-warning-bg border-warning/30 text-warning' },
                  { label: '31 – 60 jours', amount: debtAging.buckets.twoMonth, cls: 'bg-danger-bg/50 border-danger/20 text-financial-loss' },
                  { label: '+ de 60 jours', amount: debtAging.buckets.old, cls: 'bg-danger-bg border-danger/30 text-financial-loss font-extrabold' },
                ] as const).filter(b => b.amount > 0.005).map((b) => (
                  <div key={b.label} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${b.cls}`}>
                    <span className="text-xs font-semibold">{b.label}</span>
                    <span dir="ltr" className="text-sm font-bold tabular-nums">
                      {Math.round(b.amount).toLocaleString('fr-FR')} DZD
                    </span>
                  </div>
                ))}
                {/* Total + urgency */}
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2 mt-1">
                  <span className="text-xs font-bold text-neutral-500 uppercase">Total dette</span>
                  <span dir="ltr" className="text-base font-extrabold tabular-nums text-financial-loss">
                    {Math.round(debtAging.total).toLocaleString('fr-FR')} DZD
                  </span>
                </div>
                {debtAging.oldestDays > 30 && (
                  <p className="text-[10px] text-danger font-semibold text-center mt-1">
                    ⚠️ Partie du solde impayée depuis {debtAging.oldestDays} jours
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {clientStats.txCount > 0 && (
            <Card>
              <CardHeader className="p-4 pb-3">
                <SectionHeading icon={<FileSpreadsheetIcon className="w-4 h-4"/>}>Résumé financier</SectionHeading>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-neutral-100">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-neutral-500">Total reçu</span>
                  <CurrencyAmount value={clientStats.totalReceived} currency="DZD" semantic="profit" size="md" decimals={0}/>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-neutral-500">Total payé</span>
                  <CurrencyAmount value={clientStats.totalPaid} currency="DZD" semantic="loss" size="md" decimals={0}/>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-neutral-500">Ce mois</span>
                  <span className="text-sm font-semibold text-neutral-800">
                    <span className="tabular-nums">{clientStats.monthCount}</span> op{clientStats.monthCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {clientStats.firstDate && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm text-neutral-500">Client depuis</span>
                    <span className="text-sm font-semibold text-neutral-800" dir="ltr">{clientStats.firstDate}</span>
                  </div>
                )}
                {clientStats.daysSinceLast !== null && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm text-neutral-500">Dernière op.</span>
                    <span className={`text-sm font-semibold ${clientStats.daysSinceLast > 30 ? 'text-financial-loss' : 'text-neutral-800'}`}>
                      {clientStats.daysSinceLast === 0 ? "Aujourd'hui" : `${clientStats.daysSinceLast}j`}
                    </span>
                  </div>
                )}
                {selectedClient.creditLimit && selectedClient.creditLimit > 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm text-neutral-500">Seuil de crédit</span>
                    <CurrencyAmount value={selectedClient.creditLimit} currency="DZD" semantic="plain" size="md" decimals={0}/>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>)}

      {activeTab === 'history' && (<Card>
          <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
            <SectionHeading icon={<FileSpreadsheetIcon className="w-4 h-4"/>}>
              {t('transactions.recentTransactions')}
            </SectionHeading>
            <span className="text-sm text-neutral-500">{totalTransactionCount} operations</span>
          </CardHeader>
          <CardContent className="p-0">
            {dates.length > 0 ? (<div className="pb-2">
                {visibleDateGroups.map(([date, txsForDate]) => (<div key={date}>
                    <div className="sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase bg-surface/95 text-neutral-500 backdrop-blur-sm">
                      {getRelativeFrDateLabel(date)} <span className="font-normal normal-case opacity-70 ms-1">({date})</span>
                    </div>

                    <div className="divide-y divide-neutral-100">
                      {txsForDate.map((tx) => {
                        const linkedUsdtTx = tx.linkedTxId ? (linkedTransactionsById.get(tx.linkedTxId) || null) : null;
                        const isCredit = tx.montant > 0;
                        let typeLabel = tx.type;
                        let calcDetails = '';
                        if (linkedUsdtTx?.type === 'buy') {
                            typeLabel = `${t('transactions.buy')} ${linkedUsdtTx.currency}`;
                            calcDetails = `${formatNumber(linkedUsdtTx.quantity, { min: 0, max: 2 })} x ${formatNumber(linkedUsdtTx.price || 0, { min: 2, max: 2 })}`;
                        }
                        else if (linkedUsdtTx?.type === 'sell') {
                            typeLabel = `${t('transactions.sell')} ${linkedUsdtTx.currency}`;
                            calcDetails = `${formatNumber(linkedUsdtTx.quantity, { min: 0, max: 2 })} x ${formatNumber(linkedUsdtTx.sell || 0, { min: 2, max: 2 })}`;
                        }
                        typeLabel = normalizeLedgerLabel(typeLabel);
                        return (<SwipeableListItem key={tx.id} onEdit={() => handleEditClientTx(tx)} onDelete={() => handleDeleteClientTxClick(tx)}>
                            <div className="flex items-center gap-3 w-full px-4 py-3 bg-surface" 
                            // Technical exception: content-visibility keeps long client histories responsive.
                            style={{ contentVisibility: 'auto', containIntrinsicSize: '76px' }}>
                              <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-neutral-100 text-neutral-600">
                                {isCredit ? <ArrowDownIcon className="w-5 h-5"/> : <ArrowUpIcon className="w-5 h-5"/>}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-base font-semibold truncate leading-tight">{typeLabel}</p>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                  {tx.time}
                                  {calcDetails && (<span dir="ltr" className="ms-2 font-mono opacity-70">{calcDetails}</span>)}
                                </p>
                                {tx.notes && (<p className="text-xs italic mt-0.5 truncate text-financial-debt">
                                    {tx.notes}
                                  </p>)}
                              </div>

                              <div className="text-end shrink-0">
                                <CurrencyAmount value={tx.montant} currency="DZD" semantic="auto" size="lg" showSign/>
                              </div>
                            </div>
                          </SwipeableListItem>);
                    })}
                    </div>
                  </div>))}
                {hiddenTransactionCount > 0 && (<div className="px-4 pt-4 pb-3">
                    <Button onClick={() => setVisibleTransactionCount((prev) => prev + LOAD_MORE_TRANSACTIONS)} variant="outline" className="w-full rounded-xl px-4 py-3 font-semibold bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
                      Afficher plus ({Math.min(hiddenTransactionCount, LOAD_MORE_TRANSACTIONS)})
                    </Button>
                    <p className="mt-2 text-center text-xs text-neutral-500">
                      {totalTransactionCount - hiddenTransactionCount} / {totalTransactionCount}
                    </p>
                  </div>)}
              </div>) : (<EmptyState icon={<FileSpreadsheetIcon className="w-5 h-5"/>} title={t('transactions.noTransactions') as string}/>)}
          </CardContent>
        </Card>)}
    </div>);
}
