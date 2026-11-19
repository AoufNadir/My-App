// V17-4 (owner, 2026-11-19): the notes the app writes by itself on a sale or a purchase are French ("Vente de 250 USDT
// @ 261.00"). In an Arabic report they are shown in Arabic. Display only: the saved note never changes, and a note
// the owner wrote himself, or one this does not recognise, is shown as it is.

const NUM = String.raw`([\d\s  .,]+?)`;
const CUR = String.raw`([A-Z]{2,5})`;
const isolate = (text: string) => `⁦${text.trim()}⁩`;
const price = (raw: string) => {
    const n = Number(raw.replace(/[\s  ]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, ' ') : raw.trim();
};

const RULES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [new RegExp(`^Vente de ${NUM} ${CUR} @ ([\\d.,]+)$`), (m) => `بيع ${isolate(`${m[1]} ${m[2]}`)} بسعر ${isolate(price(m[3]))}`],
    [new RegExp(`^Vente(?: de)? ${NUM} ${CUR}$`), (m) => `بيع ${isolate(`${m[1]} ${m[2]}`)}`],
    [new RegExp(`^Achat de ${NUM} ${CUR} payé en ${NUM} ${CUR}$`), (m) => `شراء ${isolate(`${m[1]} ${m[2]}`)} دُفع بـ ${isolate(`${m[3]} ${m[4]}`)}`],
    [new RegExp(`^Achat(?: de)? ${NUM} ${CUR}$`), (m) => `شراء ${isolate(`${m[1]} ${m[2]}`)}`],
    [new RegExp(`^Vente ${CUR}$`), (m) => `بيع ${m[1]}`],
    [new RegExp(`^Achat ${CUR}$`), (m) => `شراء ${m[1]}`],
];

/** The note as the report shows it in this language. */
export function readableNote(note: string | null | undefined, lang: 'ar' | 'fr'): string {
    const text = String(note ?? '').trim();
    if (lang !== 'ar' || !text) return text;
    for (const [pattern, write] of RULES) {
        const m = text.match(pattern);
        if (m) return write(m);
    }
    return text;
}
