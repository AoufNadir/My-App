import { useMemo, useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SectionHeading } from '../ui/SectionHeading';
import { CurrencyAmount } from '../financial/CurrencyAmount';
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
function readTokenColor(tokenName: string): string | undefined {
    if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return undefined;
    }
    return window.getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim() || undefined;
}
function resolveClientOperationLabel(tx: ClientTransactionDzd, linkedTx?: any): string {
    const rawType = String(tx.type || '').toLowerCase();
    if (linkedTx) {
        if (linkedTx.type === 'sell')
            return `Vente ${linkedTx.currency}`;
        if (linkedTx.type === 'buy')
            return `Achat ${linkedTx.currency}`;
    }
    if (rawType.includes('transfert')) {
        return tx.montant >= 0 ? 'Transfert entrant' : 'Transfert sortant';
    }
    if (rawType.includes('ajustement'))
        return 'Ajustement solde';
    if (tx.montant >= 0)
        return 'Paiement recu';
    return 'Paiement effectue';
}
export function MainClientSummaryDialog({ summaryClient, setSummaryClient, t, clientBalances, clientTransactionsDzd, transactions, setAlert, getClientFullName, handleExportClientReport, reportMonth, reportYear }: MainClientSummaryDialogProps) {
    const [isSharing, setIsSharing] = useState(false);
    const [isOpeningPdf, setIsOpeningPdf] = useState(false);
    const exportCardRef = useRef<HTMLDivElement | null>(null);
    const isMobileUserAgent = typeof navigator !== 'undefined'
        && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
    const exportCardWidth = isMobileUserAgent ? 860 : 980;
    const selectedClientTxs: ClientTransactionDzd[] = useMemo(() => {
        if (!summaryClient)
            return [];
        return clientTransactionsDzd
            .filter((tx: ClientTransactionDzd) => tx.clientId === summaryClient.id)
            .sort((a: ClientTransactionDzd, b: ClientTransactionDzd) => b.timestamp - a.timestamp);
    }, [summaryClient, clientTransactionsDzd]);
    const visibleTxs: ClientTransactionDzd[] = useMemo(() => selectedClientTxs.slice(0, 3), [selectedClientTxs]);
    const currentBalance = summaryClient ? (clientBalances.get(summaryClient.id) || 0) : 0;
    const balanceColorClass = currentBalance < 0 ? 'text-financial-loss' : currentBalance > 0 ? 'text-financial-profit' : 'text-neutral-300';
    const balanceExportPanelClass = currentBalance < 0
        ? 'border-danger/40 bg-danger/20'
        : currentBalance > 0
            ? 'border-success/40 bg-success/20'
            : 'border-border bg-surface-muted';
    const balanceExportAmountClass = currentBalance < 0
        ? 'text-financial-loss'
        : currentBalance > 0
            ? 'text-financial-profit'
            : 'text-neutral-900';
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
                details = `${formatAmount(linked.quantity)} ${linked.currency} @ ${formatAmount(price)} DZD`;
            }
            else if (tx.notes) {
                details = tx.notes;
            }
            return { tx, label, details };
        });
    }, [visibleTxs, transactions]);
    const handleShareImage = async () => {
        if (!summaryClient || isSharing)
            return;
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
                    2.2, 2, 1.8, 1.5, 1.2, 1
                ])].filter((ratio) => ratio > 0).sort((a, b) => b - a);
            const exportCaptureBackground = readTokenColor('--color-surface');
            const captureBaseOptions = {
                cacheBust: true,
                width: nodeWidth,
                height: nodeHeight,
                ...(exportCaptureBackground ? { backgroundColor: exportCaptureBackground } : {}),
                // Technical export override: html-to-image needs these dimensions/styles to avoid clipped captures.
                style: { margin: '0', transform: 'none' }
            };
            let blob: Blob | null = null;
            for (const ratio of ratioCandidates) {
                try {
                    blob = await toBlob(exportNode, {
                        ...captureBaseOptions,
                        pixelRatio: ratio
                    });
                    if (blob)
                        break;
                }
                catch (captureError) {
                    console.warn(`Share image capture failed at ratio ${ratio}:`, captureError);
                }
            }
            if (!blob) {
                for (const ratio of ratioCandidates) {
                    try {
                        const dataUrl = await toPng(exportNode, {
                            ...captureBaseOptions,
                            pixelRatio: ratio
                        });
                        if (dataUrl) { blob = dataUrlToBlob(dataUrl); break; }
                    }
                    catch (captureError) {
                        console.warn(`Share PNG capture failed at ratio ${ratio}:`, captureError);
                    }
                }
            }
            if (!blob) {
                try {
                    const jpegDataUrl = await toJpeg(exportNode, {
                        ...captureBaseOptions,
                        pixelRatio: 1.6,
                        quality: 0.98
                    });
                    if (jpegDataUrl) blob = dataUrlToBlob(jpegDataUrl);
                }
                catch (captureError) {
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
            if (navigator.share && navigator.canShare && typeof File !== 'undefined') {
                try {
                    const file = new File([blob], baseName, { type: blob.type || 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: t('transactions.clientStatement'), text: shareText });
                        shared = true;
                    }
                }
                catch (error: any) {
                    if (error?.name !== 'AbortError') console.warn('Share with files failed:', error);
                }
            }
            if (!shared) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = baseName;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(url);
                setAlert('Image telechargee.');
            }
        }
        catch (error: any) {
            console.error(error);
            setAlert(`Erreur capture: ${error?.message || ''}`);
        }
        finally {
            setIsSharing(false);
        }
    };
    const handleOpenPdf = () => {
        if (!summaryClient || isOpeningPdf)
            return;
        if (typeof handleExportClientReport !== 'function') {
            setAlert("Erreur export PDF.");
            return;
        }
        setIsOpeningPdf(true);
        try {
            const targetMonth = typeof reportMonth === 'number' ? reportMonth : new Date().getMonth();
            const targetYear = typeof reportYear === 'number' ? reportYear : new Date().getFullYear();
            handleExportClientReport(summaryClient.id, targetMonth, targetYear);
        }
        finally {
            setIsOpeningPdf(false);
        }
    };
    return (<Modal isOpen={summaryClient !== null} onClose={() => setSummaryClient(null)} className="bg-surface max-w-md">
      <ModalHeader onClose={() => setSummaryClient(null)}>
        <ModalTitle>{t('transactions.clientDetails')}</ModalTitle>
      </ModalHeader>

      <ModalContent className="px-6 pb-6 space-y-4">
        {summaryClient && (<>
            {/* Technical export positioning only: the card is rendered off-screen at a fixed capture width. */}
            <div style={{ position: 'fixed', left: '-20000px', top: 0, width: exportCardWidth, pointerEvents: 'none' }}>
              <div ref={exportCardRef} className="box-border rounded-md border border-border bg-surface p-7 font-latin text-neutral-900 shadow-card">
                <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src="/logo.png" alt="Pro Digital" className="h-12 w-12 shrink-0 rounded-md border border-border bg-surface object-cover shadow-card"/>
                    <div className="min-w-0">
                      <div className="text-[18px] font-black leading-tight text-neutral-900">Pro Digital</div>
                      <div className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-primary">Releve Client</div>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-md border border-border bg-surface-muted px-4 py-3 text-end">
                    <div className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-500">Export image</div>
                    <div className="mt-1 text-sm font-bold text-neutral-700">{new Date().toLocaleString('fr-FR')}</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-secondary">Compte client</div>
                  <div className="mt-1 text-[34px] font-black leading-tight text-neutral-900">{getClientFullName(summaryClient)}</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-500">
                    {summaryClient.phone || 'Sans telephone'}
                  </div>
                </div>

                <div className={`mt-5 rounded-md border px-5 py-4 ${balanceExportPanelClass}`}>
                  <div className="text-xs font-black uppercase tracking-[0.12em] text-neutral-500">Etat du compte</div>
                  <div className="mt-2 text-2xl font-black text-neutral-900">{balanceTitle}</div>
                  <div className={`mt-3 text-[60px] font-black leading-none ${balanceExportAmountClass}`} dir="ltr">{balanceAmountDisplay}</div>
                  <div className="mt-3 text-[16px] font-semibold text-neutral-500">{balanceHint}</div>
                </div>

                <div className="mt-5 overflow-hidden rounded-md border border-border bg-surface">
                  <div className="border-b border-border bg-surface-muted px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-primary">
                    Dernieres operations (3)
                  </div>
                  {clientRows.length > 0 ? clientRows.map(({ tx, label, details }) => (<div key={tx.id} className="border-b border-border px-4 py-3 last:border-b-0">
                      <div className="flex justify-between gap-3">
                        <div className="text-lg font-black text-neutral-900">{label}</div>
                        <div className={`text-[22px] font-black ${tx.montant >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`} dir="ltr">
                          {tx.montant >= 0 ? '+' : ''}{formatClientAmount(tx.montant)} DZD
                        </div>
                      </div>
                      {details ? (<div className="mt-1 text-sm font-semibold text-neutral-600">{details}</div>) : null}
                      <div className="mt-1 text-[13px] font-semibold text-neutral-500">{tx.date} a {tx.time}</div>
                    </div>)) : (<div className="p-5 text-center font-semibold text-neutral-500">Aucune operation.</div>)}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs font-bold text-neutral-500">
                  <span>Pro Digital - Document genere automatiquement</span>
                  <span>Finance operations</span>
                </div>
              </div>
            </div>

            <div data-client-summary>
              <div className="space-y-5">
                <div className="text-center p-4 rounded-2xl bg-surface-muted">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <UserIcon className="w-4 h-4 shrink-0 text-primary"/>
                    <h3 className="text-base font-bold text-neutral-900">{getClientFullName(summaryClient)}</h3>
                  </div>

                  <p className="text-sm text-neutral-500 mb-2">
                    {summaryClient.phone || t('transactions.noPhone')}
                  </p>

                  <p className={`text-[12px] font-semibold mb-1 ${currentBalance < 0 ? 'text-financial-loss' : currentBalance > 0 ? 'text-financial-profit' : 'text-neutral-500'}`}>
                    {balanceTitle}
                  </p>

                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
                      {t('transactions.currentBalance')}
                    </span>
                    <div className={`text-4xl font-extrabold tabular-nums ${balanceColorClass}`} dir="ltr">
                      {currentBalance > 0 ? '+' : ''}{formatAmount(currentBalance)} <span className="text-lg text-neutral-400">{t('common.dinar')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <SectionHeading icon={<RefreshCwIcon className="w-4 h-4"/>}>
                      {t('transactions.recentTransactions')}
                    </SectionHeading>
                    <span className="text-[11px] text-neutral-500">{visibleTxs.length} operation(s)</span>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-border">
                    {clientRows.length > 0 ? (<div className="divide-y divide-border">
                        {clientRows.map(({ tx, label, details }) => (<div key={tx.id} className="p-3.5 bg-surface-muted">
                            <div className="flex justify-between items-start mb-1">
                              <div className="font-bold text-sm">{label}</div>
                              <div className={`font-bold text-sm ${tx.montant > 0 ? 'text-financial-profit' : 'text-financial-loss'}`} dir="ltr">
                                {tx.montant > 0 ? '+' : ''}{formatAmount(tx.montant)} DZD
                              </div>
                            </div>
                            <div className="space-y-0.5 text-xs">
                              {details && <div className="text-neutral-700">{details}</div>}
                              <div className="text-neutral-500">{tx.date} a {tx.time}</div>
                            </div>
                          </div>))}
                      </div>) : (<p className="p-6 text-center text-sm text-neutral-400">{t('transactions.noRecentTransactions')}</p>)}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={() => setSummaryClient(null)} className="flex-1 py-3 rounded-xl font-semibold bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
                    {t('transactions.close')}
                  </Button>
                  <Button onClick={handleShareImage} disabled={isSharing} className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
                    <ShareIcon className="w-4 h-4"/> {isSharing ? 'Preparation...' : 'Image'}
                  </Button>
                  <Button onClick={handleOpenPdf} disabled={isOpeningPdf} className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors">
                    <DownloadCloudIcon className="w-4 h-4"/> {isOpeningPdf ? 'Preparation...' : 'PDF'}
                  </Button>
                </div>
              </div>
            </div>
          </>)}
      </ModalContent>
    </Modal>);
}
