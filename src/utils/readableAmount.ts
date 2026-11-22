// V23-1 (owner): a big number typed in a field is shown back readable under it ("500 000 · 500 ألف"), so an extra or
// a missing zero is seen before saving. Display only.
const fmt = (v: number, max = 2) => v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: max }).replace(/ /g, ' ');

export function amountInWords(value: number, lang: 'fr' | 'ar'): string | null {
    const abs = Math.abs(value);
    if (!Number.isFinite(value) || abs < 1000) return null;
    const scales = lang === 'ar'
        ? [{ n: 1e9, one: 'مليار' }, { n: 1e6, one: 'مليون' }, { n: 1e3, one: 'ألف' }]
        : [{ n: 1e9, one: 'milliard', many: 'milliards' }, { n: 1e6, one: 'million', many: 'millions' }, { n: 1e3, one: 'mille', many: 'mille' }];
    const scale = scales.find((s) => abs >= s.n)!;
    const count = Math.round((abs / scale.n) * 100) / 100;
    const word = lang === 'ar' ? scale.one : (count >= 2 ? (scale as unknown as { many: string }).many : scale.one);
    return `${value < 0 ? '−' : ''}${fmt(count)} ${word}`;
}

/** "500 000 · 500 mille", or null for a small number (nothing to add). */
export function readableAmount(value: number, lang: 'fr' | 'ar'): string | null {
    const words = amountInWords(value, lang);
    return words ? `${fmt(value)} · ${words}` : null;
}
