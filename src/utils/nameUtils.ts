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
 * Build the set of normalized forms for a name (for haystack matching).
 * Generates multiple transliteration equivalents so any variant of a query
 * can find any variant of a stored name.
 */
function nameForms(name: string): string[] {
    const raw = removeDiacritics(name).toLowerCase();
    const forms = new Set<string>([raw]);

    // ou → o  ← KEY FIX: "mouhamed" → "mohamed", so "moh" matches ✓
    forms.add(raw.replace(/ou/g, 'o'));

    // ou → u  (Mouhamed → Muhamed)
    forms.add(raw.replace(/ou/g, 'u'));

    // Remove leading vowel: "aissa" → "issa"
    if (/^[aeiou]/.test(raw)) {
        const noLeading = raw.slice(1);
        forms.add(noLeading);
        forms.add(noLeading.replace(/ou/g, 'o'));
    }

    // dj → j (Djamel → Jamel)
    const djNorm = raw.replace(/dj/g, 'j');
    forms.add(djNorm);
    forms.add(djNorm.replace(/ou/g, 'o'));

    return Array.from(forms);
}

/**
 * Check if a search query matches a client name using:
 * 1. Raw + transliteration variant substring match
 * 2. Phonetic skeleton match (≥2 consonants)
 *
 * Covers: "moh" → Mouhamed / Mohamed ✓
 *         Mohamed ↔ Mouhamed ↔ Mohammed ↔ Muhammad ✓
 *         Aissa ↔ Issa ✓  Djamel ↔ Jamal ✓  Karim ↔ Kerim ✓
 */
export function nameMatchesQuery(fullName: string, query: string): boolean {
    if (!query) return true;
    const q = query.trim();
    if (!q) return true;

    const qRaw = removeDiacritics(q).toLowerCase();

    // Also generate query variants so "moh" finds "mouhamed" AND "mohamed"
    const qForms = new Set<string>([qRaw]);
    qForms.add(qRaw.replace(/ou/g, 'o'));
    qForms.add(qRaw.replace(/ou/g, 'u'));
    if (/^[aeiou]/.test(qRaw)) qForms.add(qRaw.slice(1));

    // 1 — cross-product: any query form found in any name form
    const hayForms = nameForms(fullName);
    for (const qf of qForms) {
        if (hayForms.some(nf => nf.includes(qf))) return true;
    }

    // 2 — skeleton match for queries with ≥2 consonants
    const qSkel = toSkeleton(q);
    if (qSkel.length >= 2) {
        const nameSkel = toSkeleton(fullName);
        if (nameSkel.includes(qSkel)) return true;
        if (nameSkel.startsWith(qSkel)) return true;
    }

    return false;
}
