/**
 * Opening a client's WhatsApp chat. WhatsApp links carry text only: a picture can be sent from a
 * web app only through the phone's share sheet.
 */

/** Algerian 0XXXXXXXXX becomes 213XXXXXXXXX; other numbers keep their digits. */
export function formatWaNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length >= 9) return '213' + digits.slice(1);
    return digits;
}
function getUserAgent(): string {
    return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}
function isAndroidDevice(): boolean {
    return /Android/i.test(getUserAgent());
}
function isAppleMobileDevice(): boolean {
    return /iPhone|iPad|iPod/i.test(getUserAgent());
}
export function buildWhatsAppWebUrl(phone: string, text?: string): string {
    const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${phone}${encodedText}`;
}
function buildWhatsAppMessengerUrl(phone: string, text?: string): string {
    const query = `phone=${phone}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
    if (isAndroidDevice()) {
        return `intent://send?${query}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    }
    return `whatsapp://send?${query}`;
}
/** The client's chat in the WhatsApp app on a phone, WhatsApp Web elsewhere. */
export function openWhatsAppMessenger(phone: string, text?: string): void {
    const intl = formatWaNumber(phone);
    if (!intl) return;

    if (isAndroidDevice() || isAppleMobileDevice()) {
        window.location.href = buildWhatsAppMessengerUrl(intl, text);
        return;
    }

    window.open(buildWhatsAppWebUrl(intl, text), '_blank', 'noopener');
}
