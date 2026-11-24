import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ShareIcon } from '../icons/ShareIcon';
import { buildClientSummary } from '../../utils/clientSummary';
import { formatWaNumber, openWhatsAppMessenger } from '../../utils/whatsapp';
import { copyImageToClipboard } from '../../utils/clipboardImage';
import { clientSummaryCover } from '../../utils/clientSummaryCover';
import { ClientSummarySheet, CLIENT_SUMMARY_WORDS } from '../clients/ClientSummarySheet';
import { ReportLanguagePicker, ReportPreview, ReportPrintHolder, useReportLanguage } from '../reports/ReportDialogParts';
import { CLIENT_DEFAULT_LANGUAGE, clientReportLanguageKey } from '../reports/reportLanguage';
import { renderSheetImage, shareOrDownloadFile } from '../reports/reportPdf';
type MainClientSummaryDialogProps = Record<string, any>;
export function MainClientSummaryDialog({ summaryClient, setSummaryClient, t, clientBalances, clientTransactionsDzd, reportClientRows, clientsDzd, transactions, setAlert, getClientFullName }: MainClientSummaryDialogProps) {
    // V4-4: the picture the client receives, in the client's own report language, on the shared
    // report sheet. It is made as soon as the window opens, so « Partager » opens the phone's share
    // sheet at once (a share started long after the tap is refused by the browser).
    const clientName = summaryClient ? getClientFullName(summaryClient) : '';
    const [now] = useState(() => Date.now());
    const [reportLang, setReportLang] = useReportLanguage(clientReportLanguageKey(summaryClient?.id || ''), CLIENT_DEFAULT_LANGUAGE);
    const summary = useMemo(() => (summaryClient ? buildClientSummary({ clientId: summaryClient.id, clientRows: reportClientRows ?? clientTransactionsDzd, transactions, now }) : null), [summaryClient, reportClientRows, clientTransactionsDzd, transactions, now]);
    const imageHolder = useRef<HTMLDivElement | null>(null);
    const [image, setImage] = useState<{ blob: Blob; key: string } | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    // V18 (performance): the picture is made again only when what it shows changes, not each time the app receives
    // data (before, every update restarted the capture and « Préparation… » could last).
    const summarySignature = useMemo(() => (summary ? JSON.stringify(summary) : ''), [summary]);
    const imageKey = `${summaryClient?.id || ''}:${reportLang}:${summarySignature}`;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageKey]);
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
    // V13-7: the picture is copied, then the client's own chat opens: long-press, Paste, Send. A web page cannot
    // attach a picture to one chosen chat by itself. If the copy is refused, the share sheet opens instead.
    const hasPhone = Boolean(summaryClient?.phone && formatWaNumber(String(summaryClient.phone)));
    const handleSendToClient = async () => {
        if (!summaryClient || !hasPhone || isSharing)
            return;
        if (!readyImage) {
            await handleShareImage();
            return;
        }
        if (await copyImageToClipboard(readyImage)) {
            setAlert(t('clientSummary.pasteInChat') as string);
            // V26-1: the chat opens with a short, ready message; the picture is pasted under it.
            const cover = summary ? clientSummaryCover({ lang: reportLang, name: clientName, balanceCents: summary.balanceCents, operationCount: summary.operationCount, date: new Date(now).toLocaleDateString('fr-FR') }) : undefined;
            openWhatsAppMessenger(summaryClient.phone, cover);
        }
        else
            await handleShareImage();
    };
    const sendLabel = reportLang === 'ar' ? `أرسل الكشف إلى ${clientName} على واتساب` : `Envoyer le relevé à ${clientName} sur WhatsApp`;
    const close = () => setSummaryClient(null);
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

          </>)}
      </ModalContent>
      <ModalFooter className="flex-wrap">
        {/* V26-1 (owner): one button. With a WhatsApp number: the picture goes to his chat with a ready message; without
            one, the phone's share sheet. « WhatsApp (texte) » and « Partager en image » are gone. */}
        <Button type="button" variant="primary" onClick={hasPhone ? handleSendToClient : handleShareImage} disabled={isSharing || !summaryClient} className={`order-first min-w-full gap-2 ${hasPhone ? '!bg-[#128C7E] hover:!bg-[#0f7a6e]' : ''}`}>
          {!hasPhone && <ShareIcon aria-hidden="true" className="h-4 w-4"/>}
          {isSharing ? t('clientSummary.preparing') : hasPhone ? sendLabel : t('clientSummary.shareImage')}
        </Button>
        <Button type="button" variant="outline" onClick={close} className="min-w-full">{t('common.close')}</Button>
      </ModalFooter>
    </Modal>);
}
