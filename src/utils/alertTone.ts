export type AlertTone = 'success' | 'error' | 'warning' | 'info';
export function detectAlertTone(message: string): AlertTone {
    // The U1 unification put a category emoji at the start of every alert,
    // so emoji-first detection is the cheapest and most reliable signal.
    const trimmed = (message || '').trim();
    if (trimmed.startsWith('✅')) return 'success';
    if (trimmed.startsWith('❌')) return 'error';
    if (trimmed.startsWith('⚠️') || trimmed.startsWith('⚠')) return 'warning';
    // A closed month refuses the change: the user must read how to reopen it.
    if (trimmed.startsWith('🔒')) return 'warning';
    if (trimmed.startsWith('ℹ️') || trimmed.startsWith('ℹ')) return 'info';
    // Fallback: classify by accent-stripped keywords for any pre-emoji
    // messages still in the wild.
    const normalized = trimmed
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    const hasAny = (tokens: string[]) => tokens.some((token) => normalized.includes(token));
    const errorTokens = [
        'error', 'erreur', 'failed', 'echec', 'invalide', 'invalid',
        'impossible', 'introuvable', 'not found', 'insuffisant', 'insufficient',
        'orphan', 'orpheline'
    ];
    const successTokens = [
        'success', 'succes', 'reussi', 'reussie', 'operation reussie',
        'mis a jour', 'mise a jour', 'ajoute', 'ajoutee', 'supprime',
        'supprimee', 'transfert reussi', 'saved', 'updated', 'added',
        'deleted', 'enregistre', 'confirme'
    ];
    if (hasAny(errorTokens))
        return 'error';
    if (hasAny(successTokens))
        return 'success';
    return 'info';
}
/** The category emoji is replaced by the toast's own icon. */
export function stripAlertEmoji(message: string): string {
    return (message || '').trim().replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/u, '');
}
/**
 * How long a toast stays on screen, or null when it waits for the user to close it.
 * Errors and warnings need attention, so they stay. Short confirmations leave after
 * 4 seconds, longer ones get time to be read, and an undo gets at least 6 seconds.
 */
export function alertToastDurationMs(message: string, tone: AlertTone, hasAction: boolean): number | null {
    if (tone === 'error' || tone === 'warning')
        return null;
    const readingTime = Math.min(10_000, Math.max(4_000, 1_500 + stripAlertEmoji(message).length * 60));
    return hasAction ? Math.max(6_000, readingTime) : readingTime;
}
