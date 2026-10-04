import React, { useMemo, useRef, useState } from 'react';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { ListRow } from '../cards/ListRow';
import { SectionCard } from '../cards/SectionCard';
import { ShareIcon } from '../icons/ShareIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import type { ClientDzd, ClientTransactionDzd } from '../../types';
import { getClientOperationLabel, getClientTransferDetails, getManualClientNote } from '../../utils/transactionTerminology';
type MainClientSummaryDialogProps = Record<string, any>;
const CLIENT_SUMMARY_VISIBLE_TX_LIMIT = 5;
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
function nameInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => Array.from(part)[0] ?? '').join('').toUpperCase();
}
export function MainClientSummaryDialog({ summaryClient, setSummaryClient, t, clientBalances, clientTransactionsDzd, clientsDzd, transactions, setAlert, getClientFullName }: MainClientSummaryDialogProps) {
    const { lang } = useLanguage();
    const isArabic = lang === 'ar';
    const text = (key: string, values: Record<string, string | number> = {}) => Object.entries(values)
        .reduce((result, [name, value]) => result.split(`{${name}}`).join(String(value)), String(t(key)));
    const [isSharing, setIsSharing] = useState(false);
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
    const visibleTxs: ClientTransactionDzd[] = selectedClientTxs.slice(0, CLIENT_SUMMARY_VISIBLE_TX_LIMIT);
    const clientsById = useMemo(() => new Map((clientsDzd || []).map((client: ClientDzd) => [client.id, client])), [clientsDzd]);
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
    const balanceTitle = text(currentBalance < 0
        ? 'clientSummary.owes'
        : currentBalance > 0
            ? 'clientSummary.credit'
            : 'clientSummary.settled');
    const balanceHint = text(currentBalance < 0
        ? 'clientSummary.hintOwes'
        : currentBalance > 0
            ? 'clientSummary.hintCredit'
            : 'clientSummary.hintSettled');
    const clientRows: ClientRow[] = useMemo(() => {
        return visibleTxs.map((tx: ClientTransactionDzd) => {
            const linked = tx.linkedTxId ? transactions.find((row: any) => row.id === tx.linkedTxId) : null;
            const label = linked
                ? `${t(linked.type === 'sell' ? 'ledger.sell' : 'ledger.buy')} ${linked.currency}`
                : getClientOperationLabel(tx.type, t as (key: string) => string);
            let details = '';
            if (linked) {
                const price = linked.type === 'sell' ? (linked.sell || 0) : (linked.price || 0);
                details = `${formatAmount(linked.quantity)} ${linked.currency} @ ${formatAmount(price)} DZD`;
            }
            else if (tx.type === 'Transfert Entrant' || tx.type === 'Transfert Sortant') {
                const counterpart = findClientTransferCounterpart(tx, clientTransactionsDzd);
                const counterpartClient = counterpart ? clientsById.get(counterpart.clientId) : undefined;
                const counterpartName = counterpartClient ? getClientFullName(counterpartClient) : '';
                details = getClientTransferDetails(tx, counterpartName, t as (key: string) => string);
            }
            else {
                details = getManualClientNote(tx.notes);
            }
            return { tx, label, details };
        });
    }, [clientTransactionsDzd, clientsById, getClientFullName, t, visibleTxs, transactions]);
    const handleShareImage = async () => {
        if (!summaryClient || isSharing)
            return;
        const exportNode = exportCardRef.current;
        if (!exportNode) {
            setAlert('❌ Image introuvable.');
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
                setAlert('❌ Génération de l’image impossible. Veuillez réessayer.');
                return;
            }
            const shareText = text('clientSummary.shareText', { name: getClientFullName(summaryClient), count: CLIENT_SUMMARY_VISIBLE_TX_LIMIT });
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
                setAlert('✅ Image téléchargée.');
            }
        }
        catch (error: any) {
            console.error(error);
            setAlert(`❌ Erreur de capture : ${error?.message || ''}`);
        }
        finally {
            setIsSharing(false);
        }
    };
    const close = () => setSummaryClient(null);
    // Image partagée avec le client : même contenu, dans la langue de l'application.
    // L'espacement des lettres casse l'écriture arabe : majuscules espacées en français seulement.
    const kicker = isArabic ? 'text-xs font-black' : 'text-xs font-black uppercase tracking-[0.14em]';
    const kickerTight = isArabic ? 'text-xs font-black' : 'text-xs font-black uppercase tracking-[0.12em]';
    const clientName = summaryClient ? getClientFullName(summaryClient) : '';
    const balanceTextClass = currentBalance < 0 ? 'text-financial-loss' : currentBalance > 0 ? 'text-financial-profit' : 'text-neutral-500';
    return (<Modal isOpen={summaryClient !== null} onClose={close} className="max-w-md bg-surface text-neutral-900">
      <ModalHeader onClose={close}>
        <ModalTitle className="text-base sm:text-lg">{t('transactions.clientDetails')}</ModalTitle>
      </ModalHeader>

      <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
        {summaryClient && (<>
            {/* Technical export positioning only: the card is rendered off-screen at a fixed capture width. */}
            <div style={{ position: 'fixed', left: '-20000px', top: 0, width: exportCardWidth, pointerEvents: 'none' }}>
              <div ref={exportCardRef} dir={isArabic ? 'rtl' : 'ltr'} lang={lang} className={`box-border rounded-md border border-border bg-surface p-7 text-neutral-900 shadow-card ${isArabic ? 'font-arabic' : 'font-latin'}`}>
                <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src="/logo.png" alt="Pro Digital" className="h-12 w-12 shrink-0 rounded-md border border-border bg-surface object-cover shadow-card"/>
                    <div className="min-w-0">
                      <div className="text-[18px] font-black leading-tight text-neutral-900">Pro Digital</div>
                      <div className={`mt-1 text-primary ${kicker}`}>{t('transactions.clientStatement')}</div>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-md border border-border bg-surface-muted px-4 py-3 text-end">
                    <div className={`text-neutral-500 ${kickerTight}`}>{t('clientSummary.exportImage')}</div>
                    <div className="mt-1 text-sm font-bold text-neutral-700" dir="ltr">{new Date().toLocaleString('fr-FR')}</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className={`text-secondary ${kicker}`}>{t('clientSummary.account')}</div>
                  <div className="mt-1 text-[34px] font-black leading-tight text-neutral-900">{clientName}</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-500">
                    {summaryClient.phone ? <bdi dir="ltr">{summaryClient.phone}</bdi> : t('clientSummary.noPhone')}
                  </div>
                </div>

                <div className={`mt-5 rounded-md border px-5 py-4 ${balanceExportPanelClass}`}>
                  <div className={`text-neutral-500 ${kickerTight}`}>{t('clientSummary.accountState')}</div>
                  <div className="mt-2 text-2xl font-black text-neutral-900">{balanceTitle}</div>
                  <div className={`mt-3 text-[60px] font-black leading-none ${balanceExportAmountClass}`} dir="ltr">{balanceAmountDisplay}</div>
                  <div className="mt-3 text-[16px] font-semibold text-neutral-500">{balanceHint}</div>
                </div>

                <div className="mt-5 overflow-hidden rounded-md border border-border bg-surface">
                  <div className={`border-b border-border bg-surface-muted px-4 py-3 text-primary ${kickerTight}`}>
                    {text('clientSummary.lastOperations', { count: CLIENT_SUMMARY_VISIBLE_TX_LIMIT })}
                  </div>
                  {clientRows.length > 0 ? clientRows.map(({ tx, label, details }) => (<div key={tx.id} className="border-b border-border px-4 py-3 last:border-b-0">
                      <div className="flex justify-between gap-3">
                        <div className="text-lg font-black text-neutral-900">{label}</div>
                        <div className={`text-[22px] font-black ${tx.montant >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`} dir="ltr">
                          {tx.montant >= 0 ? '+' : ''}{formatClientAmount(tx.montant)} DZD
                        </div>
                      </div>
                      {details ? (<div className="mt-1 text-sm font-semibold text-neutral-600"><bdi>{details}</bdi></div>) : null}
                      <div className="mt-1 text-[13px] font-semibold text-neutral-500"><bdi>{`${tx.date} · ${tx.time}`}</bdi></div>
                    </div>)) : (<div className="p-5 text-center font-semibold text-neutral-500">{t('clientSummary.noOperations')}</div>)}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs font-bold text-neutral-500">
                  <span>{t('clientSummary.generated')}</span>
                  <span>{t('clientSummary.footerTag')}</span>
                </div>
              </div>
            </div>

            <div data-client-summary className="space-y-3">
              <section aria-label={t('transactions.currentBalance') as string} className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-base font-bold text-neutral-600">
                    {nameInitials(clientName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-neutral-900">{clientName}</h3>
                    <p className="truncate text-xs text-neutral-500">
                      {summaryClient.phone ? <bdi dir="ltr">{summaryClient.phone}</bdi> : t('transactions.noPhone')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-[13px] font-semibold text-neutral-500">{t('transactions.currentBalance')}</p>
                  <CurrencyAmount value={currentBalance} currency="DZD" semantic="plain" size="hero" decimals={2} showSign className={`mt-0.5 block ${balanceColorClass === 'text-neutral-300' ? 'text-neutral-900' : balanceColorClass}`}/>
                  <p className={`mt-1 text-xs font-semibold ${balanceTextClass}`}>{balanceTitle}</p>
                </div>
              </section>

              <SectionCard title={t('transactions.recentTransactions')} actions={<span className="px-2 text-xs font-semibold text-neutral-500">{text('clientSummary.operationsCount', { count: selectedClientTxs.length })}</span>} flush>
                {clientRows.length > 0 ? clientRows.map(({ tx, label, details }) => (<React.Fragment key={tx.id}>
                    {/* Each line keeps its own reading order: « 900,00 USDT @ 249,00 DZD » stays whole in Arabic. */}
                    <ListRow title={label} subtitle={<>{details && <><bdi>{details}</bdi>{'\n'}</>}<bdi>{`${tx.date} · ${tx.time}`}</bdi></>} wrapSubtitle trailing={<CurrencyAmount value={tx.montant} currency="DZD" decimals={2} showSign semantic={tx.montant > 0 ? 'profit' : 'loss'} size="md" className="font-bold"/>}/>
                  </React.Fragment>)) : (<p className="px-4 pb-4 text-center text-sm text-neutral-500">{t('clientSummary.noOperations')}</p>)}
              </SectionCard>
            </div>
          </>)}
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={close}>{t('common.close')}</Button>
        <Button type="button" variant="primary" onClick={handleShareImage} disabled={isSharing || !summaryClient} className="gap-2">
          <ShareIcon aria-hidden="true" className="h-4 w-4"/>
          {isSharing ? t('clientSummary.preparing') : t('clientSummary.shareImage')}
        </Button>
      </ModalFooter>
    </Modal>);
}
