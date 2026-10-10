import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { ListRow } from '../cards/ListRow';
import { SectionCard } from '../cards/SectionCard';
import { ShareIcon } from '../icons/ShareIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import type { ClientDzd, ClientTransactionDzd } from '../../types';
import { getClientOperationLabel, getClientTransferDetails, getManualClientNote } from '../../utils/transactionTerminology';
import { buildClientSummary } from '../../utils/clientSummary';
import { openWhatsAppMessenger } from '../../utils/whatsapp';
import { ClientSummarySheet, clientSummaryMessage, CLIENT_SUMMARY_WORDS } from '../clients/ClientSummarySheet';
import { ReportLanguagePicker, ReportPreview, ReportPrintHolder, useReportLanguage } from '../reports/ReportDialogParts';
import { renderSheetImage, shareOrDownloadFile } from '../reports/reportPdf';
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
    const text = (key: string, values: Record<string, string | number> = {}) => Object.entries(values)
        .reduce((result, [name, value]) => result.split(`{${name}}`).join(String(value)), String(t(key)));
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
    const balanceTitle = text(currentBalance < 0
        ? 'clientSummary.owes'
        : currentBalance > 0
            ? 'clientSummary.credit'
            : 'clientSummary.settled');
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
    // V4-4: the picture the client receives, in the client's own report language, on the shared
    // report sheet. It is made as soon as the window opens, so « Partager » opens the phone's share
    // sheet at once (a share started long after the tap is refused by the browser).
    const clientName = summaryClient ? getClientFullName(summaryClient) : '';
    const [now] = useState(() => Date.now());
    const [reportLang, setReportLang] = useReportLanguage(`client_report_lang_${summaryClient?.id || ''}`, lang);
    const summary = useMemo(() => (summaryClient ? buildClientSummary({ clientId: summaryClient.id, clientRows: clientTransactionsDzd, transactions, now }) : null), [summaryClient, clientTransactionsDzd, transactions, now]);
    const imageHolder = useRef<HTMLDivElement | null>(null);
    const [image, setImage] = useState<{ blob: Blob; key: string } | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const imageKey = `${summaryClient?.id || ''}:${reportLang}`;
    useEffect(() => {
        if (!summary)
            return;
        let cancelled = false;
        // After the window has painted: the capture holds the page for a moment.
        const timer = window.setTimeout(async () => {
            const sheet = imageHolder.current?.firstElementChild;
            if (!(sheet instanceof HTMLElement))
                return;
            try {
                const blob = await renderSheetImage(sheet);
                if (!cancelled)
                    setImage({ blob, key: imageKey });
            }
            catch (error) {
                console.warn('Client summary picture could not be prepared:', error);
            }
        }, 150);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [summary, imageKey]);
    const readyImage = image && image.key === imageKey ? image.blob : null;
    // V6-1: the window shows the very picture that will be sent, in the language that will be sent.
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!readyImage) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(readyImage);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [readyImage]);
    const fileName = `ProDigital_${(summaryClient?.id || 'client').replace(/[^A-Za-z0-9]/g, '').slice(-6)}_${new Date(now).toISOString().slice(0, 10)}.png`;
    const shareTitle = `${CLIENT_SUMMARY_WORDS[reportLang].title} · ${clientName}`;
    const handleShareImage = async () => {
        if (!summaryClient || isSharing)
            return;
        setIsSharing(true);
        try {
            let blob = readyImage;
            if (!blob) {
                const sheet = imageHolder.current?.firstElementChild;
                if (!(sheet instanceof HTMLElement))
                    return;
                blob = await renderSheetImage(sheet);
                setImage({ blob, key: imageKey });
            }
            const outcome = await shareOrDownloadFile(blob, fileName, shareTitle, 'image/png');
            if (outcome === 'downloaded')
                setAlert('✅ Image téléchargée.');
            else if (outcome === 'needsTap')
                setAlert(t('clients.activityReportReady') as string);
        }
        catch (error) {
            console.error(error);
            setAlert('❌ Génération de l’image impossible. Veuillez réessayer.');
        }
        finally {
            setIsSharing(false);
        }
    };
    // A WhatsApp link carries text only: the client's chat opens on the same summary as a message.
    const handleWhatsApp = () => {
        if (summaryClient?.phone && summary)
            openWhatsAppMessenger(summaryClient.phone, clientSummaryMessage(summary, reportLang, clientName));
    };
    const close = () => setSummaryClient(null);
    const balanceTextClass = currentBalance < 0 ? 'text-financial-loss' : currentBalance > 0 ? 'text-financial-profit' : 'text-neutral-500';
    return (<Modal isOpen={summaryClient !== null} onClose={close} className="max-w-md bg-surface text-neutral-900">
      <ModalHeader onClose={close}>
        <ModalTitle className="text-base sm:text-lg">{t('transactions.clientDetails')}</ModalTitle>
      </ModalHeader>

      <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
        {summaryClient && (<>
            {summary && (<ReportPrintHolder holderRef={imageHolder}>
                <ClientSummarySheet summary={summary} lang={reportLang} clientName={clientName}/>
              </ReportPrintHolder>)}

            <div className="space-y-3">
              <ReportLanguagePicker value={reportLang} onChange={setReportLang}/>
              <ReportPreview label={t('clients.activityReportPreview') as string}>
                {previewUrl
                    ? (<img src={previewUrl} alt={shareTitle} className="mx-auto block w-full max-w-[420px] rounded-md bg-white shadow-card"/>)
                    : (<p role="status" className="py-12 text-center text-sm text-neutral-500">{t('clientSummary.preparing')}</p>)}
              </ReportPreview>
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
      <ModalFooter className="flex-wrap">
        <Button type="button" variant="outline" onClick={close}>{t('common.close')}</Button>
        {summaryClient?.phone && (<Button type="button" variant="outline" onClick={handleWhatsApp} disabled={!summary} className="gap-2 text-[#128C7E]">
            WhatsApp
          </Button>)}
        <Button type="button" variant="primary" onClick={handleShareImage} disabled={isSharing || !summaryClient} className="order-first min-w-full gap-2">
          <ShareIcon aria-hidden="true" className="h-4 w-4"/>
          {isSharing ? t('clientSummary.preparing') : `${t('clientSummary.shareImage')} · ${reportLang === 'ar' ? 'ع' : 'FR'}`}
        </Button>
      </ModalFooter>
    </Modal>);
}
