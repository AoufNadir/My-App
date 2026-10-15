import { useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { clientWhatsAppMessage } from '../../utils/clientWhatsApp';
import { formatWaNumber, openWhatsAppMessenger } from '../../utils/whatsapp';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { ReportLanguagePicker, useReportLanguage } from '../reports/ReportDialogParts';
import { CLIENT_DEFAULT_LANGUAGE, clientReportLanguageKey } from '../reports/reportLanguage';
import { Button } from '../ui/Button';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { OperationFooter } from '../ui/OperationFooter';

export type ClientWhatsAppDialogProps = {
    onClose: () => void;
    clientId: string;
    clientName: string;
    /** The client's balance, negative = the client owes us (as everywhere in the app) */
    balance: number;
    phone?: string;
    /** For tests and screenshots; the time the window opened otherwise */
    now?: Date;
};

/**
 * « Rappel WhatsApp » of the client page: the message as the client will read it, in Arabic or
 * French. The language is the client's remembered one (Arabic until chosen) and a change is
 * remembered for that client: the clients list, the report and the summary follow it.
 */
export function ClientWhatsAppDialog({ onClose, clientId, clientName, balance, phone, now: fixedNow }: ClientWhatsAppDialogProps) {
    const { t } = useLanguage();
    const [now] = useState(() => fixedNow ?? new Date());
    const [lang, setLang] = useReportLanguage(clientReportLanguageKey(clientId), CLIENT_DEFAULT_LANGUAGE);
    const message = useMemo(() => clientWhatsAppMessage({ name: clientName, balance, lang, now }), [clientName, balance, lang, now]);
    // A client without a usable number: the message is shared or copied instead.
    const canOpenChat = Boolean(phone && formatWaNumber(phone));

    const send = () => {
        if (phone && canOpenChat)
            openWhatsAppMessenger(phone, message);
        else if (typeof navigator.share === 'function')
            navigator.share({ text: message }).catch(() => { });
        else
            navigator.clipboard?.writeText(message).catch(() => { });
        onClose();
    };

    return (<Modal isOpen onClose={onClose} className="max-w-md bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{t('clients.whatsAppDialogTitle')}</ModalTitle>
        <p className="truncate text-[13px] text-neutral-500">{clientName}</p>
      </ModalHeader>
      <ModalContent className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <ReportLanguagePicker value={lang} onChange={setLang} label={t('clients.whatsAppLanguage') as string}/>
        <section aria-label={t('clients.whatsAppPreview') as string} className="flex flex-col gap-2">
          <p className="text-sm font-semibold leading-snug text-neutral-700">{t('clients.whatsAppPreview')}</p>
          <div dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} data-testid="whatsapp-message" className={`whitespace-pre-line rounded-card border border-[#25D366]/30 bg-[#25D366]/10 px-4 py-3 text-[15px] leading-relaxed text-neutral-900 ${lang === 'ar' ? 'font-arabic' : 'font-latin'}`}>{message}</div>
        </section>
      </ModalContent>
      <OperationFooter>
        <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
        <Button variant="success" onClick={send}>
          <WhatsAppIcon className="h-4 w-4 shrink-0"/>
          <span className="min-w-0 truncate">{canOpenChat ? t('clients.whatsAppOpen') : t('clients.whatsAppCopy')}</span>
        </Button>
      </OperationFooter>
    </Modal>);
}
