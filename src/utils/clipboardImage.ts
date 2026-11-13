/**
 * V13-7: the summary picture copied to the phone's clipboard, so it can be pasted in the client's WhatsApp chat
 * (a web page cannot attach a picture to one chosen chat by itself). False when the browser refuses: the caller
 * falls back to the share sheet.
 */
type ClipboardLike = { write?: (items: unknown[]) => Promise<void> };
type ItemCtor = new (items: Record<string, Blob | Promise<Blob>>) => unknown;
export async function copyImageToClipboard(blob: Blob, env: { clipboard?: ClipboardLike; ClipboardItem?: ItemCtor } = {
    clipboard: typeof navigator !== 'undefined' ? (navigator.clipboard as unknown as ClipboardLike) : undefined,
    ClipboardItem: typeof window !== 'undefined' ? (window as unknown as { ClipboardItem?: ItemCtor }).ClipboardItem : undefined,
}): Promise<boolean> {
    if (!env.clipboard?.write || !env.ClipboardItem) return false;
    try {
        await env.clipboard.write([new env.ClipboardItem({ 'image/png': blob })]);
        return true;
    }
    catch {
        return false;
    }
}
