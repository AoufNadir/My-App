/**
 * Opening a client's WhatsApp chat. WhatsApp links carry text only: a picture can be sent from a
 * web app only through the phone's share sheet.
 */

/** Algerian 0XXXXXXXXX becomes 213XXXXXXXXX; other numbers keep their digits. */
export function formatWaNumber(phone: string): string {
    // V25-5 (owner): foreign numbers too. « +44 … » and « 0044 … » are kept as they are (without + / 00); an Algerian
    // number « 0555 12 34 56 » (0 then 9 digits) gets 213; a longer number written with a 0 in place of « + » keeps its
    // country code (0447… → 447…). A number already starting with a country code is kept.
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (trimmed.startsWith('+')) return digits;
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.startsWith('0') && digits.length === 10) return '213' + digits.slice(1);
    if (digits.startsWith('0') && digits.length > 10) return digits.slice(1);
    if (digits.length === 9 && /^[5-7]/.test(digits)) return '213' + digits;
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
    const query = [phone && `phone=${phone}`, text && `text=${encodeURIComponent(text)}`].filter(Boolean).join('&');
    if (isAndroidDevice()) {
        return `intent://send?${query}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    }
    return `whatsapp://send?${query}`;
}
/** `intlNumber` empty: WhatsApp asks which contact the text goes to. */
function openWhatsApp(intlNumber: string, text?: string): void {
    if (isAndroidDevice() || isAppleMobileDevice()) {
        window.location.href = buildWhatsAppMessengerUrl(intlNumber, text);
        return;
    }

    window.open(buildWhatsAppWebUrl(intlNumber, text), '_blank', 'noopener');
}
/** The client's chat in the WhatsApp app on a phone, WhatsApp Web elsewhere. */
export function openWhatsAppMessenger(phone: string, text?: string): void {
    const intl = formatWaNumber(phone);
    if (!intl) return;
    openWhatsApp(intl, text);
}
/** The text ready in WhatsApp, for a client who has no phone number saved: the sender picks the contact. */
export function openWhatsAppChooser(text: string): void {
    openWhatsApp('', text);
}
