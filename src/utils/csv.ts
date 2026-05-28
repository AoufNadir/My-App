/**
 * Minimal RFC 4180-ish CSV parser. Handles:
 *   - quoted fields (double-quote escaping)
 *   - commas / semicolons / tabs as separators (auto-detected)
 *   - CRLF or LF line endings
 *   - empty trailing lines
 *
 * Returns an array of arrays (raw rows). Use `parseCsvWithHeader` if the
 * first row is a header.
 */
export function parseCsv(text: string, separator?: string): string[][] {
    if (!text)
        return [];
    const sep = separator ?? detectSeparator(text);
    const rows: string[][] = [];
    let row: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];
        if (inQuotes) {
            if (c === '"') {
                if (next === '"') {
                    cur += '"';
                    i++;
                }
                else
                    inQuotes = false;
            }
            else {
                cur += c;
            }
            continue;
        }
        if (c === '"') {
            inQuotes = true;
            continue;
        }
        if (c === sep) {
            row.push(cur);
            cur = '';
            continue;
        }
        if (c === '\r') {
            continue;
        }
        if (c === '\n') {
            row.push(cur);
            rows.push(row);
            row = [];
            cur = '';
            continue;
        }
        cur += c;
    }
    if (cur.length > 0 || row.length > 0) {
        row.push(cur);
        rows.push(row);
    }
    return rows.filter(r => !(r.length === 1 && r[0] === ''));
}
function detectSeparator(text: string): string {
    const sample = text.slice(0, 4096);
    const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
    let inQuotes = false;
    for (const c of sample) {
        if (c === '"')
            inQuotes = !inQuotes;
        else if (!inQuotes && c in counts)
            counts[c]++;
    }
    return (Object.keys(counts) as Array<keyof typeof counts>).reduce((best, k) => (counts[k] > counts[best] ? k : best), ',' as keyof typeof counts);
}
export interface ParsedCsv {
    headers: string[];
    rows: Record<string, string>[];
}
export function parseCsvWithHeader(text: string, separator?: string): ParsedCsv {
    const raw = parseCsv(text, separator);
    if (raw.length === 0)
        return { headers: [], rows: [] };
    const headers = raw[0].map(h => h.trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < raw.length; i++) {
        const cells = raw[i];
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
            obj[h] = (cells[idx] ?? '').trim();
        });
        rows.push(obj);
    }
    return { headers, rows };
}
