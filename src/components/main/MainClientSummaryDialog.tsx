import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { ShareIcon } from '../icons/ShareIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { UserIcon } from '../icons/UserIcon';
import type { ClientTransactionDzd } from '../../types';

type MainClientSummaryDialogProps = Record<string, any>;

export function MainClientSummaryDialog({
    summaryClient,
    setSummaryClient,
    cardBase,
    isDark,
    t,
    subtleText,
    clientBalances,
    clientTransactionsDzd,
    transactions,
    setAlert,
    getClientFullName
}: MainClientSummaryDialogProps) {
    return (
            <Dialog isOpen={summaryClient !== null} onClose={() => setSummaryClient(null)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setSummaryClient(null)} isDark={isDark}>
                    <DialogTitle>{t('transactions.clientDetails')}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    {summaryClient && (() => {
                        const bal = clientBalances.get(summaryClient.id) || 0;
                        const lastTxs = clientTransactionsDzd
                            .filter(t => t.clientId === summaryClient.id)
                            .sort((a, b) => b.timestamp - a.timestamp)
                            .slice(0, 5);

                        const getTxDetails = (tx: ClientTransactionDzd) => {
                            let type: string = tx.type;
                            let details = '';
                            let method = tx.paymentMethod || '';

                            if (tx.linkedTxId && tx.linkRole !== 'dzd_receiver') {
                                const linked = transactions.find(t => t.id === tx.linkedTxId);
                                if (linked) {
                                    if (linked.type === 'sell') {
                                        type = t('transactions.sellUsdt');
                                        details = `${linked.quantity} USDT @ ${linked.sell} ${t('common.dinar')}`;
                                    } else if (linked.type === 'buy') {
                                        type = `${t('transactions.buy')} ${linked.currency}`;
                                        details = `${linked.quantity} ${linked.currency} @ ${linked.price} ${t('common.dinar')}`;
                                    }
                                }
                            } else if (tx.type.includes('Transfert')) {
                                details = tx.notes || '';
                            }

                            return { type, details, method, notes: tx.notes };
                        };

                        const handleShare = async () => {
                            const modalContent = document.querySelector('[data-client-summary]');
                            if (!modalContent) { setAlert('❌ ' + t('common.error')); return; }

                            try {
                                // Feedback that it started
                                // setAlert('⏳ ' + t('common.generatingImage')); 

                                // Wait a tiny bit to ensure rendering
                                await new Promise(resolve => setTimeout(resolve, 500));

                                const { toBlob } = await import('html-to-image');
                                const blob = await toBlob(modalContent as HTMLElement, {
                                    backgroundColor: isDark ? '#111827' : '#ffffff',
                                    style: {
                                        transform: 'scale(1)', // reset legacy transforms if any
                                    }
                                });

                                if (!blob) { setAlert('❌ ' + t('common.error')); return; }

                                const file = new File([blob], `releve_${summaryClient.phone || 'client'}.png`, { type: 'image/png' });

                                // Helper to check if sharing files is supported
                                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                    try {
                                        await navigator.share({
                                            files: [file],
                                            title: t('transactions.clientStatement'),
                                            text: `${t('transactions.statementOf')} ${getClientFullName(summaryClient)}`
                                        });
                                        // Success
                                    } catch (e: any) {
                                        console.error("Share failed", e);
                                        // Don't error alert if user just cancelled
                                        if (e.name !== 'AbortError') {
                                            setAlert('❌ ' + t('transactions.shareCancelled'));
                                        }
                                    }
                                } else {
                                    // Fallback: download image
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `releve_${summaryClient.phone || 'client'}.png`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                    setAlert('✅ ' + t('transactions.imageDownloaded'));
                                }
                            } catch (e: any) {
                                console.error(e);
                                setAlert('❌ ' + t('transactions.captureError') + (e.message ? `: ${e.message}` : ''));
                            }
                        };

                        return (
                            <div data-client-summary>
                                <div className="space-y-5">
                                    <div className={`text-center p-4 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <UnifiedTitle
                                            as="h3"
                                            isDark={isDark}
                                            variant="page"
                                            className="justify-center mb-1"
                                            icon={<UserIcon className="w-4 h-4" />}
                                        >
                                            {getClientFullName(summaryClient)}
                                        </UnifiedTitle>
                                        <p className={`text-sm ${subtleText} mb-3`}>{summaryClient.phone || t('transactions.noPhone')}</p>
                                        <div className="flex flex-col items-center justify-center">
                                            <span className={`text-xs uppercase tracking-wider font-semibold ${subtleText}`}>{t('transactions.currentBalance')}</span>
                                            <span className={`text-3xl font-bold ${bal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {bal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg text-gray-400">{t('common.dinar')}</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <UnifiedTitle
                                            as="h4"
                                            isDark={isDark}
                                            variant="compact"
                                            className="mb-3 uppercase opacity-80"
                                            icon={<RefreshCwIcon className="w-4 h-4" />}
                                        >
                                            {t('transactions.recentTransactions')}
                                        </UnifiedTitle>
                                        <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                            {lastTxs.length > 0 ? (
                                                <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                                    {lastTxs.map(tx => {
                                                        const { type, details, method } = getTxDetails(tx);
                                                        return (
                                                            <div key={tx.id} className={`p-3.5 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <div className="font-bold text-sm">{type}</div>
                                                                    <div className={`font-bold text-sm ${tx.montant > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {tx.montant > 0 ? '+' : ''}{tx.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-0.5 text-xs">
                                                                    {details && <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>{details}</div>}
                                                                    <div className={subtleText}>{tx.date} à {tx.time}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="p-6 text-center text-sm opacity-50">{t('transactions.noRecentTransactions')}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button onClick={() => setSummaryClient(null)} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}>{t('transactions.close')}</Button>
                                        <Button onClick={handleShare} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                                            <ShareIcon className="w-4 h-4" /> {t('transactions.send')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
    );
}

