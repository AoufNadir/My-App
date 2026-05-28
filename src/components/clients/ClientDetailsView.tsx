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
};
function ContactRow({ label, value, copiedValue, onCopy }: ContactRowProps) {
    if (!value)
        return null;
    const isCopied = copiedValue === value;
    return (<div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-neutral-500">{label}</p>
        <p dir="ltr" className="text-base font-semibold truncate select-all leading-snug mt-0.5">{value}</p>
      </div>
      <Button onClick={() => onCopy(value)} className={`shrink-0 p-2 rounded-lg transition-colors ${isCopied ? 'bg-success-bg text-financial-profit' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`} aria-label={`Copier ${label}`}>
        {isCopied ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
      </Button>
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
    return (<div className="anim-page-in space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button onClick={() => setSelectedClientId(null)} variant="ghost" className="p-2 rounded-full text-neutral-600 hover:bg-neutral-100">
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
          <Button onClick={() => handleTouchStart(selectedClient)} variant="ghost" className="p-2 rounded-full hover:bg-neutral-100" aria-label="Partager">
            <ShareIcon className="w-5 h-5"/>
          </Button>
          <Button onClick={() => openClientModal(selectedClient)} variant="ghost" className="p-2 rounded-full hover:bg-neutral-100" aria-label="Modifier le client">
            <PencilIcon className="w-5 h-5"/>
          </Button>
          <Button onClick={exportCurrentMonthReport} className="ms-1 px-3 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm flex items-center gap-2">
            <FileSpreadsheetIcon className="w-4 h-4"/>
            PDF
          </Button>
        </div>
      </div>

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
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => openClientTxModal(null, 'Règlement Reçu', selectedClientId)} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-sm transition-transform bg-primary hover:bg-primary-dark active:scale-95">
              <ArrowDownIcon className="w-4 h-4"/>
              {t('transactions.paymentReceived')}
            </Button>
            <Button onClick={() => openClientTxModal(null, 'Paiement Effectué', selectedClientId)} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-neutral-700 transition-transform bg-neutral-100 hover:bg-neutral-200 active:scale-95">
              <ArrowUpIcon className="w-4 h-4"/>
              {t('transactions.paymentMade')}
            </Button>
          </div>
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
                  <ContactRow label={t('transactions.phone') as string} value={selectedClient.phone || ''} copiedValue={copiedValue} onCopy={handleCopy}/>
                  <ContactRow label="RedotPay ID" value={selectedClient.redotpayId || ''} copiedValue={copiedValue} onCopy={handleCopy}/>
                  <ContactRow label="Binance Email" value={selectedClient.binanceEmail || ''} copiedValue={copiedValue} onCopy={handleCopy}/>
                </>) : (<EmptyState icon={<InfoIcon className="w-5 h-5"/>} title="Aucune information de contact" subtitle="Modifiez le client pour ajouter telephone, email ou RedotPay ID."/>)}
            </CardContent>
          </Card>
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
