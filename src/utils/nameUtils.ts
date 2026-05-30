/**
 * Utilities for Algerian name handling:
 * - Surname ordering (NOM Prénom → Prénom NOM)
 * - Phonetic search normalization for French-Arabic transliterations
 */

/**
 * Reorder name if it starts with an ALL-CAPS surname token.
 * "BENALI Mohamed" → "Mohamed BENALI"
 * "Mohamed BENALI" → "Mohamed BENALI" (idempotent)
 * "Mohamed benali" → unchanged (can't detect order)
 */
export function reorderClientName(fullName: string): string {
    if (!fullName) return fullName;
    const tokens = fullName.trim().split(/\s+/);
    if (tokens.length < 2) return fullName;

    // A surname token = only uppercase latin letters, length > 2
    const isSurnameToken = (t: string) => t.length > 2 && /^[A-ZÀÂÇÉÈÊËÎÏÔÙÛÜŸÆŒ-]+$/.test(t);

    const surnames = tokens.filter(isSurnameToken);
    const givenParts = tokens.filter(t => !isSurnameToken(t));

    // Only reorder when we clearly have both parts
    if (surnames.length === 0 || givenParts.length === 0) return fullName;

    return [...givenParts, ...surnames].join(' ');
}

/**
 * Strip diacritics from a string.
 */
function removeDiacritics(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Convert a name to its consonant skeleton for phonetic comparison.
 * Handles common French-Arabic transliteration variants:
 *   Mohamed / Mouhamed / Mohammed / Muhammad → "mhmd"
 *   Aissa / Issa → "ss"
 *   Djamel / Jamal → "jml"
 *   Karim / Kerim → "krm"
 *   Abdellah / Abdalla → "bdl"
 */
function toSkeleton(s: string): string {
    return removeDiacritics(s)
        .toLowerCase()
        .replace(/dj/g, 'j')        // Djamel → Jamel
        .replace(/ph/g, 'f')        // rare but possible
        .replace(/[aeiouàâèéêëîïôùûü]/g, '') // strip all vowels
        .replace(/(.)\1+/g, '$1');  // deduplicate: mm→m, hh→h, ss→s
}

/**
 * Build the set of normalized forms for a name token (for haystack matching).
 * Returns raw + skeleton + with/without leading vowel.
 */
function nameForms(name: string): string[] {
    const raw = removeDiacritics(name).toLowerCase();
    const forms = new Set<string>([raw]);

    // Also try without leading vowel: "aissa" → "issa"
    if (/^[aeiou]/.test(raw)) forms.add(raw.slice(1));

    // ou → u substitution (Mouhamed → Muhamed for raw matching)
    forms.add(raw.replace(/ou/g, 'u'));

    return Array.from(forms);
}

/**
 * Check if a search query matches a client name using:
 * 1. Raw substring match (case/diacritic insensitive)
 * 2. Phonetic / skeleton match for longer queries (≥3 consonants)
 *
 * Covers: Mohamed ↔ Mouhamed ↔ Mohammed ↔ Muhammad
 *         Aissa ↔ Issa, Djamel ↔ Jamal, Karim ↔ Kerim
 */
export function nameMatchesQuery(fullName: string, query: string): boolean {
    if (!query) return true;
    const q = query.trim();
    if (!q) return true;

    const qRaw = removeDiacritics(q).toLowerCase();

    // 1 — raw substring search across all name forms
    const hayForms = nameForms(fullName);
    if (hayForms.some(f => f.includes(qRaw))) return true;

    // 2 — skeleton match (phonetic) for queries with ≥3 consonants
    const qSkel = toSkeleton(q);
    if (qSkel.length >= 3) {
        const nameSkel = toSkeleton(fullName);
        if (nameSkel.includes(qSkel)) return true;
        // Also allow query to be contained in name skeleton partially
        // (user typed beginning: "moham" → "mhm" ⊂ "mhmd")
        if (qSkel.length >= 3 && nameSkel.startsWith(qSkel)) return true;
    }

    return false;
}
