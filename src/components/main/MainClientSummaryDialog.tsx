import { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { ShareIcon } from '../icons/ShareIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { UserIcon } from '../icons/UserIcon';
import { DownloadCloudIcon } from '../icons/DownloadCloudIcon';
import type { ClientTransactionDzd } from '../../types';

type MainClientSummaryDialogProps = Record<string, any>;

type ClientRow = {
  tx: ClientTransactionDzd;
  label: string;
  details: string;
};

function formatAmount(value: number, digits = 2): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatClientAmount(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || 'image/png';
  const binary = atob(data || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function resolveClientOperationLabel(tx: ClientTransactionDzd, linkedTx?: any): string {
  const rawType = String(tx.type || '').toLowerCase();

  if (linkedTx) {
    if (linkedTx.type === 'sell') return `Vente ${linkedTx.currency}`;
    if (linkedTx.type === 'buy') return `Achat ${linkedTx.currency}`;
  }

  if (rawType.includes('transfert')) {
    return tx.montant >= 0 ? 'Transfert entrant' : 'Transfert sortant';
  }

  if (rawType.includes('ajustement')) return 'Ajustement solde';

  if (tx.montant >= 0) return 'Paiement recu';
  return 'Paiement effectue';
}

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
  getClientFullName,
  handleExportClientReport,
  reportMonth,
  reportYear
}: MainClientSummaryDialogProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);
  const exportCardRef = useRef<HTMLDivElement | null>(null);
  const isMobileUserAgent = typeof navigator !== 'undefined'
    && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
  const exportCardWidth = isMobileUserAgent ? 860 : 980;

  const selectedClientTxs: ClientTransactionDzd[] = useMemo(() => {
    if (!summaryClient) return [];
    return clientTransactionsDzd
      .filter((tx: ClientTransactionDzd) => tx.clientId === summaryClient.id)
      .sort((a: ClientTransactionDzd, b: ClientTransactionDzd) => b.timestamp - a.timestamp);
  }, [summaryClient, clientTransactionsDzd]);

  const visibleTxs: ClientTransactionDzd[] = useMemo(() => selectedClientTxs.slice(0, 3), [selectedClientTxs]);

  const currentBalance = summaryClient ? (clientBalances.get(summaryClient.id) || 0) : 0;
  const balanceColorHex = currentBalance < 0 ? '#ef4444' : currentBalance > 0 ? '#22c55e' : '#cbd5e1';
  const balanceColorClass = currentBalance < 0 ? 'text-red-500' : currentBalance > 0 ? 'text-green-500' : 'text-slate-300';
  const balanceAmountDisplay = `${currentBalance > 0 ? '+' : ''}${formatClientAmount(currentBalance)} DZD`;

  const balanceTitle = currentBalance < 0
    ? 'Client doit payer ce montant'
    : currentBalance > 0
      ? 'Client a un avoir (avance)'
      : 'Aucun montant en attente';

  const balanceHint = currentBalance < 0
    ? 'Solde negatif: paiement attendu du client.'
    : currentBalance > 0
      ? 'Solde positif: montant a rendre ou deduire.'
      : 'Compte equilibre.';

  const clientRows: ClientRow[] = useMemo(() => {
    return visibleTxs.map((tx: ClientTransactionDzd) => {
      const linked = tx.linkedTxId ? transactions.find((row: any) => row.id === tx.linkedTxId) : null;
      const label = resolveClientOperationLabel(tx, linked);
      let details = '';

      if (linked) {
        const price = linked.type === 'sell' ? (linked.sell || 0) : (linked.price || 0);
        details = `${formatAmount(linked.quantity)} ${linked.currency} @ ${formatAmount(price, 0)} DZD`;
      } else if (tx.notes) {
        details = tx.notes;
      }

      return { tx, label, details };
    });
  }, [visibleTxs, transactions]);

  const handleShareImage = async () => {
    if (!summaryClient || isSharing) return;

    const exportNode = exportCardRef.current;
    if (!exportNode) {
      setAlert('Erreur: image introuvable.');
      return;
    }

    try {
      setIsSharing(true);
      await new Promise((resolve) => setTimeout(resolve, 280));
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const { toBlob, toPng, toJpeg } = await import('html-to-image');
      const nodeWidth = exportNode.scrollWidth || exportNode.clientWidth || exportCardWidth;
      const nodeHeight = exportNode.scrollHeight || exportNode.clientHeight || 1400;
      const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
      const maxPixels = isMobile ? 16000000 : 28000000;
      const baseRatio = Math.min(3, Math.max(1.4, window.devicePixelRatio || 2));
      const safeRatio = Math.min(baseRatio, Math.sqrt(maxPixels / Math.max(1, nodeWidth * nodeHeight)));
      const ratioCandidates = [...new Set([
        Number(safeRatio.toFixed(2)),
        2.2,
        2,
        1.8,
        1.5,
        1.2,
        1
      ])].filter((ratio) => ratio > 0).sort((a, b) => b - a);

      let blob: Blob | null = null;
      for (const ratio of ratioCandidates) {
        try {
          blob = await toBlob(exportNode, {
            cacheBust: true,
            pixelRatio: ratio,
            backgroundColor: '#071226',
            width: nodeWidth,
            height: nodeHeight,
            style: { margin: '0', transform: 'none' }
          });
          if (blob) break;
        } catch (captureError) {
          console.warn(`Share image capture failed at ratio ${ratio}:`, captureError);
        }
      }

      if (!blob) {
        for (const ratio of ratioCandidates) {
          try {
            const dataUrl = await toPng(exportNode, {
              cacheBust: true,
              pixelRatio: ratio,
              backgroundColor: '#071226',
              width: nodeWidth,
              height: nodeHeight,
              style: { margin: '0', transform: 'none' }
            });
            if (dataUrl) {
              blob = dataUrlToBlob(dataUrl);
              break;
            }
          } catch (captureError) {
            console.warn(`Share PNG capture failed at ratio ${ratio}:`, captureError);
          }
        }
      }

      if (!blob) {
        try {
          const jpegDataUrl = await toJpeg(exportNode, {
            cacheBust: true,
            pixelRatio: 1.6,
            quality: 0.98,
            backgroundColor: '#071226',
            width: nodeWidth,
            height: nodeHeight,
            style: { margin: '0', transform: 'none' }
          });
          if (jpegDataUrl) {
            blob = dataUrlToBlob(jpegDataUrl);
          }
        } catch (captureError) {
          console.warn('Share JPEG capture failed:', captureError);
        }
      }

      if (!blob) {
        setAlert('Erreur: generation image impossible. Utilisez PDF.');
        return;
      }

      const shareText = `Releve client de ${getClientFullName(summaryClient)} (3 dernieres operations)`;
      const extension = blob.type.includes('jpeg') ? 'jpg' : 'png';
      const baseName = `releve_client_${summaryClient.id}_simple.${extension}`;

      let shared = false;
      if (
        navigator.share &&
        navigator.canShare &&
        typeof File !== 'undefined'
      ) {
        try {
          const file = new File([blob], baseName, { type: blob.type || 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: t('transactions.clientStatement'),
              text: shareText
            });
            shared = true;
          }
        } catch (error: any) {
          if (error?.name !== 'AbortError') {
            console.warn('Share with files failed:', error);
          }
        }
      }

      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = baseName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setAlert('Image telechargee.');
      }
    } catch (error: any) {
      console.error(error);
      setAlert(`Erreur capture: ${error?.message || ''}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleOpenPdf = () => {
    if (!summaryClient || isOpeningPdf) return;
    if (typeof handleExportClientReport !== 'function') {
      setAlert("Erreur export PDF.");
      return;
    }

    setIsOpeningPdf(true);
    try {
      const targetMonth = typeof reportMonth === 'number' ? reportMonth : new Date().getMonth();
      const targetYear = typeof reportYear === 'number' ? reportYear : new Date().getFullYear();
      handleExportClientReport(summaryClient.id, targetMonth, targetYear);
    } finally {
      setIsOpeningPdf(false);
    }
  };

  return (
    <Dialog isOpen={summaryClient !== null} onClose={() => setSummaryClient(null)} className={`${cardBase} max-w-md`}>
      <DialogHeader onClose={() => setSummaryClient(null)} isDark={isDark}>
        <DialogTitle>{t('transactions.clientDetails')}</DialogTitle>
      </DialogHeader>

      <DialogContent className="px-6 pb-6 space-y-4">
        {summaryClient && (
          <>
            <div style={{ position: 'fixed', left: '-20000px', top: 0, width: exportCardWidth, pointerEvents: 'none' }}>
              <div
                ref={exportCardRef}
                style={{
                  fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
                  background: '#071226',
                  color: '#dbeafe',
                  borderRadius: 20,
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  padding: 28,
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: '#93c5fd', fontWeight: 700 }}>Releve Client</div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>{getClientFullName(summaryClient)}</div>
                  </div>
                  <div style={{ textAlign: 'right', color: '#93c5fd', fontSize: 14 }}>
                    <div>3 dernieres operations</div>
                    <div style={{ marginTop: 2 }}>{new Date().toLocaleString('fr-FR')}</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 16,
                    border: `1px solid ${currentBalance < 0 ? 'rgba(239,68,68,.45)' : currentBalance > 0 ? 'rgba(34,197,94,.45)' : 'rgba(148,163,184,.35)'}`,
                    background: currentBalance < 0 ? 'rgba(127,29,29,.22)' : currentBalance > 0 ? 'rgba(6,78,59,.24)' : 'rgba(15,23,42,.7)',
                    borderRadius: 14,
                    padding: '16px 18px'
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#bfdbfe', textTransform: 'uppercase', letterSpacing: 0.5 }}>Etat du compte</div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#e2e8f0' }}>{balanceTitle}</div>
                  <div style={{ marginTop: 8, fontSize: 64, lineHeight: 1.02, fontWeight: 900, color: balanceColorHex }}>{balanceAmountDisplay}</div>
                  <div style={{ marginTop: 8, fontSize: 17, color: '#cbd5e1' }}>{balanceHint}</div>
                </div>

                <div style={{ marginTop: 18, border: '1px solid rgba(148,163,184,.35)', borderRadius: 12, overflow: 'hidden', background: 'rgba(15,23,42,.65)' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(148,163,184,.25)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: '#93c5fd', fontWeight: 700 }}>
                    Dernieres operations (3)
                  </div>

                  {clientRows.length > 0 ? clientRows.map(({ tx, label, details }) => (
                    <div key={tx.id} style={{ padding: '11px 12px', borderBottom: '1px solid rgba(148,163,184,.22)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 18 }}>{label}</div>
                        <div style={{ fontWeight: 900, color: tx.montant >= 0 ? '#22c55e' : '#ef4444', fontSize: 22 }}>
                          {tx.montant >= 0 ? '+' : ''}{formatClientAmount(tx.montant)} DZD
                        </div>
                      </div>
                      {details ? (
                        <div style={{ marginTop: 4, fontSize: 14, color: '#cbd5e1' }}>{details}</div>
                      ) : null}
                      <div style={{ marginTop: 4, fontSize: 13, color: '#94a3b8' }}>{tx.date} a {tx.time}</div>
                    </div>
                  )) : (
                    <div style={{ padding: 18, textAlign: 'center', color: '#94a3b8' }}>Aucune operation.</div>
                  )}
                </div>
              </div>
            </div>

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

                  <p className={`text-sm ${subtleText} mb-2`}>
                    {summaryClient.phone || t('transactions.noPhone')}
                  </p>

                  <p className={`text-[12px] font-semibold mb-1 ${currentBalance < 0 ? 'text-red-400' : currentBalance > 0 ? 'text-green-400' : subtleText}`}>
                    {balanceTitle}
                  </p>

                  <div className="flex flex-col items-center justify-center">
                    <span className={`text-xs uppercase tracking-wider font-semibold ${subtleText}`}>
                      {t('transactions.currentBalance')}
                    </span>
                    <span className={`text-4xl font-extrabold ${balanceColorClass}`}>
                      {currentBalance > 0 ? '+' : ''}{formatAmount(currentBalance)} <span className="text-lg text-gray-400">{t('common.dinar')}</span>
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[12px] font-semibold ${subtleText}`}>3 dernieres operations</span>
                    <span className={`text-[11px] ${subtleText}`}>{visibleTxs.length} operation(s)</span>
                  </div>

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
                    {clientRows.length > 0 ? (
                      <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                        {clientRows.map(({ tx, label, details }) => (
                          <div key={tx.id} className={`p-3.5 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                            <div className="flex justify-between items-start mb-1">
                              <div className="font-bold text-sm">{label}</div>
                              <div className={`font-bold text-sm ${tx.montant > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {tx.montant > 0 ? '+' : ''}{formatAmount(tx.montant)} DZD
                              </div>
                            </div>

                            <div className="space-y-0.5 text-xs">
                              {details && <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>{details}</div>}
                              <div className={subtleText}>{tx.date} a {tx.time}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="p-6 text-center text-sm opacity-50">{t('transactions.noRecentTransactions')}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={() => setSummaryClient(null)} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}>
                    {t('transactions.close')}
                  </Button>

                  <Button onClick={handleShareImage} disabled={isSharing} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                    <ShareIcon className="w-4 h-4" /> {isSharing ? 'Preparation...' : 'Image'}
                  </Button>

                  <Button onClick={handleOpenPdf} disabled={isOpeningPdf} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20">
                    <DownloadCloudIcon className="w-4 h-4" /> {isOpeningPdf ? 'Preparation...' : 'PDF'}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
