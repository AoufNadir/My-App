import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { ClientDzd, ClientTransactionDzd, Tx } from '../../types';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { ShareIcon } from '../icons/ShareIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { CopyIcon } from '../icons/CopyIcon';
import { CheckIcon } from '../icons/CheckIcon';
import { UserIcon } from '../icons/UserIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { ArrowDownIcon } from '../icons/ArrowDownIcon';
import { ArrowUpIcon } from '../icons/ArrowUpIcon';
import { formatDzd, formatNumber, getRelativeFrDateLabel } from '../../pages/shared/pageFormat';

type ClientDetailsViewProps = {
  selectedClientId: string;
  selectedClient: ClientDzd;
  selectedClientBalance: number;
  groupedHistory: Record<string, ClientTransactionDzd[]>;
  cardBase: string;
  isDark: boolean;
  subtleText: string;
  setSelectedClientId: (id: string | null) => void;
  getClientFullName: (client: ClientDzd) => string;
  handleTouchStart: (client: ClientDzd) => void;
  openClientModal: (client: ClientDzd | null) => void;
  copiedValue: string | null;
  handleCopy: (text: string) => void;
  transactions: Tx[];
  handleEditClientTx: (tx: ClientTransactionDzd) => void;
  handleDeleteClientTxClick: (tx: ClientTransactionDzd) => void;
};

type ClientCopyRowProps = {
  label: string;
  value: string;
  copiedValue: string | null;
  isDark: boolean;
  subtleText: string;
  onCopy: (value: string) => void;
};

function ClientCopyRow({
  label,
  value,
  copiedValue,
  isDark,
  subtleText,
  onCopy
}: ClientCopyRowProps) {
  if (!value) return null;
  const isCopied = copiedValue === value;

  return (
    <div className={`flex items-center justify-between p-2 rounded-lg mb-1 last:mb-0 ${isDark ? 'bg-[#111827]' : 'bg-gray-50'}`}>
      <div className="flex flex-col overflow-hidden">
        <span className={`text-[10px] uppercase ${subtleText}`}>{label}</span>
        <span className="text-sm font-medium truncate select-all leading-tight">{value}</span>
      </div>
      <Button
        onClick={() => onCopy(value)}
        className={`ml-2 p-1.5 rounded-md shrink-0 transition-colors ${isCopied ? 'bg-green-500/10 text-green-500' : (isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white border text-gray-500 hover:bg-gray-100')}`}
      >
        {isCopied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}

export function ClientDetailsView({
  selectedClientId,
  selectedClient,
  selectedClientBalance,
  groupedHistory,
  cardBase,
  isDark,
  subtleText,
  setSelectedClientId,
  getClientFullName,
  handleTouchStart,
  openClientModal,
  copiedValue,
  handleCopy,
  transactions,
  handleEditClientTx,
  handleDeleteClientTxClick
}: ClientDetailsViewProps) {
  const dates = Object.keys(groupedHistory);

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
      <div className="flex items-center gap-2 mb-4">
        <Button onClick={() => setSelectedClientId(null)} className={`p-2 rounded-full ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>
          <ChevronLeftIcon className="w-6 h-6" />
        </Button>
        <div className="flex-grow min-w-0">
          <UnifiedTitle
            as="h2"
            isDark={isDark}
            variant="page"
            className="truncate min-w-0"
            icon={<UserIcon className="w-4 h-4" />}
          >
            <span className="truncate">{getClientFullName(selectedClient)}</span>
          </UnifiedTitle>
          <p className={`text-sm ${subtleText}`}>
            Solde:{' '}
            <span className={`font-bold ${selectedClientBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatDzd(selectedClientBalance, { min: 2, max: 2 })}
            </span>
          </p>
        </div>
        <Button onClick={() => handleTouchStart(selectedClient)} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} aria-label="Partager">
          <ShareIcon className="w-5 h-5" />
        </Button>
        <Button onClick={() => openClientModal(selectedClient)} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} aria-label="Modifier le client">
          <PencilIcon className="w-5 h-5" />
        </Button>
      </div>

      {(selectedClient.phone || selectedClient.redotpayId || selectedClient.binanceEmail) && (
        <Card className={`${cardBase} mb-4`}>
          <CardContent className="p-3">
            <ClientCopyRow
              label="Telephone"
              value={selectedClient.phone || ''}
              copiedValue={copiedValue}
              isDark={isDark}
              subtleText={subtleText}
              onCopy={handleCopy}
            />
            <ClientCopyRow
              label="RedotPay ID"
              value={selectedClient.redotpayId || ''}
              copiedValue={copiedValue}
              isDark={isDark}
              subtleText={subtleText}
              onCopy={handleCopy}
            />
            <ClientCopyRow
              label="Binance Email"
              value={selectedClient.binanceEmail || ''}
              copiedValue={copiedValue}
              isDark={isDark}
              subtleText={subtleText}
              onCopy={handleCopy}
            />
          </CardContent>
        </Card>
      )}

      <Card className={cardBase}>
        <CardHeader className="p-4">
          <UnifiedTitle
            as="h2"
            isDark={isDark}
            variant="section"
            icon={<FileSpreadsheetIcon className="w-4 h-4" />}
          >
            Historique du Client
          </UnifiedTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dates.length > 0 ? (
            <div className="pb-4">
              {dates.map((date) => (
                <div key={date}>
                  <div className={`sticky top-0 z-10 px-4 py-2 text-xs font-bold uppercase tracking-wider ${isDark ? 'bg-[#111827]/95 text-gray-400 backdrop-blur-sm' : 'bg-gray-50/95 text-gray-500 backdrop-blur-sm'}`}>
                    {getRelativeFrDateLabel(date)} <span className="font-normal normal-case opacity-70 ml-1">({date})</span>
                  </div>

                  <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                    {groupedHistory[date].map((tx) => {
                      const linkedUsdtTx = tx.linkedTxId ? transactions.find((t) => t.id === tx.linkedTxId) : null;
                      const isCredit = tx.montant > 0;

                      let typeLabel = tx.type;
                      let calcDetails = '';

                      if (linkedUsdtTx?.type === 'buy') {
                        typeLabel = `Achat ${linkedUsdtTx.currency}`;
                        calcDetails = `${formatNumber(linkedUsdtTx.quantity, { min: 2, max: 2 })} x ${formatNumber(linkedUsdtTx.price || 0, { min: 2, max: 2 })}`;
                      } else if (linkedUsdtTx?.type === 'sell') {
                        typeLabel = `Vente ${linkedUsdtTx.currency}`;
                        calcDetails = `${formatNumber(linkedUsdtTx.quantity, { min: 2, max: 2 })} x ${formatNumber(linkedUsdtTx.sell || 0, { min: 2, max: 2 })}`;
                      }

                      return (
                        <SwipeableListItem
                          key={tx.id}
                          onEdit={() => handleEditClientTx(tx)}
                          onDelete={() => handleDeleteClientTxClick(tx)}
                        >
                          <div className={`flex items-start gap-3 w-full py-3 px-4 ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>
                            <div className="flex-shrink-0 pt-1">
                              <div className={`p-2 rounded-full ${isCredit ? (isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-600') : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-600')}`}>
                                {isCredit ? <ArrowDownIcon className="w-5 h-5" /> : <ArrowUpIcon className="w-5 h-5" />}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0 flex justify-between items-start">
                              <div className="flex flex-col min-w-0 mr-2">
                                <span className="font-bold text-sm truncate leading-tight mb-0.5">{typeLabel}</span>
                                {tx.notes && (
                                  <span className={`text-xs font-medium italic break-words mb-0.5 ${isDark ? 'text-amber-200/80' : 'text-amber-800/80'}`}>
                                    {tx.notes}
                                  </span>
                                )}
                                <span className={`text-xs ${subtleText}`}>{tx.time}</span>
                              </div>

                              <div className="flex flex-col items-end flex-shrink-0">
                                <span className={`font-bold text-sm leading-tight mb-1 ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                                  {tx.montant > 0 ? '+' : ''}{formatDzd(tx.montant, { min: 2, max: 2 })}
                                </span>
                                <span className={`text-[11px] ${subtleText} font-mono tracking-tight`}>
                                  {calcDetails}
                                </span>
                              </div>
                            </div>
                          </div>
                        </SwipeableListItem>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-center py-8 ${subtleText}`}>Aucune transaction pour ce client.</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
