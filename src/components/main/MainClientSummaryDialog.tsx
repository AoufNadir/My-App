import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ShareIcon } from '../icons/ShareIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildClientSummary } from '../../utils/clientSummary';
import { openWhatsAppMessenger } from '../../utils/whatsapp';
import { ClientSummarySheet, clientSummaryMessage, CLIENT_SUMMARY_WORDS } from '../clients/ClientSummarySheet';
import { ReportLanguagePicker, ReportPreview, ReportPrintHolder, useReportLanguage } from '../reports/ReportDialogParts';
import { clientReportLanguageKey } from '../reports/reportLanguage';
import { renderSheetImage, shareOrDownloadFile } from '../reports/reportPdf';
type MainClientSummaryDialogProps = Record<string, any>;
export function MainClientSummaryDialog({ summaryClient, setSummaryClient, t, clientBalances, clientTransactionsDzd, reportClientRows, clientsDzd, transactions, setAlert, getClientFullName }: MainClientSummaryDialogProps) {
    const { lang } = useLanguage();
    // V4-4: the picture the client receives, in the client's own report language, on the shared
    // report sheet. It is made as soon as the window opens, so « Partager » opens the phone's share
    // sheet at once (a share started long after the tap is refused by the browser).
    const clientName = summaryClient ? getClientFullName(summaryClient) : '';
    const [now] = useState(() => Date.now());
    const [reportLang, setReportLang] = useReportLanguage(clientReportLanguageKey(summaryClient?.id || ''), lang);
    const summary = useMemo(() => (summaryClient ? buildClientSummary({ clientId: summaryClient.id, clientRows: reportClientRows ?? clientTransactionsDzd, transactions, now }) : null), [summaryClient, reportClientRows, clientTransactionsDzd, transactions, now]);
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
