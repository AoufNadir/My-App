import { useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { parseCsvWithHeader, type ParsedCsv } from '../../utils/csv';
import { useLanguage } from '../../contexts/LanguageContext';
export interface CsvFieldSpec {
    /** Internal field name passed back to onConfirm (e.g. "fullName"). */
    key: string;
    /** Human-readable label shown in the column-mapping UI. */
    label: string;
    /** When true, the user must map a CSV column to this field. */
    required?: boolean;
    /** Heuristic header substrings used to auto-suggest a mapping. */
    aliases?: string[];
}
export interface CsvImportSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    fields: CsvFieldSpec[];
    /** Called with normalized rows (each row keyed by `field.key`). */
    onConfirm: (rows: Record<string, string>[]) => Promise<void> | void;
}
function autoMap(headers: string[], fields: CsvFieldSpec[]): Record<string, string> {
    const map: Record<string, string> = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());
    for (const field of fields) {
        const aliases = [field.key.toLowerCase(), field.label.toLowerCase(), ...(field.aliases || []).map(a => a.toLowerCase())];
        let bestIdx = -1;
        for (let i = 0; i < lowerHeaders.length; i++) {
            if (aliases.some(a => lowerHeaders[i].includes(a))) {
                bestIdx = i;
                break;
            }
        }
        if (bestIdx >= 0)
            map[field.key] = headers[bestIdx];
    }
    return map;
}
/**
 * Generic CSV import sheet. Steps:
 *   1. User picks a file (drag-drop or file input).
 *   2. Headers are auto-mapped against the field specs; user adjusts if needed.
 *   3. Preview shows the first 5 rows after mapping.
 *   4. On confirm, normalized rows (keyed by field.key) are handed to the caller.
 *
 * The sheet itself does no Firestore writes — the consumer is responsible
 * for deciding what to do with the rows. This keeps the import flow safe
 * and reusable across clients / transactions / etc.
 */
export function CsvImportSheet({ isOpen, onClose, title, fields, onConfirm }: CsvImportSheetProps) {
    const { t } = useLanguage();
    const [parsed, setParsed] = useState<ParsedCsv | null>(null);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const reset = () => {
        setParsed(null);
        setMapping({});
        setError(null);
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    const handleClose = () => {
        reset();
        onClose();
    };
    const handleFile = async (file: File) => {
        setError(null);
        try {
            const text = await file.text();
            const result = parseCsvWithHeader(text);
            if (result.headers.length === 0) {
                setError(t('clients.importEmptyFile') as string);
                return;
            }
            setParsed(result);
            setMapping(autoMap(result.headers, fields));
        }
        catch (e: any) {
            setError(e?.message || t('clients.importReadError') as string);
        }
    };
    const missingRequired = useMemo(() => fields.filter(f => f.required && !mapping[f.key]).map(f => f.label), [fields, mapping]);
    const previewRows = useMemo(() => {
        if (!parsed)
            return [];
        return parsed.rows.slice(0, 5).map(row => {
            const out: Record<string, string> = {};
            for (const field of fields) {
                const sourceHeader = mapping[field.key];
                out[field.key] = sourceHeader ? (row[sourceHeader] ?? '') : '';
            }
            return out;
        });
    }, [parsed, mapping, fields]);
    const handleConfirm = async () => {
        if (!parsed || missingRequired.length > 0)
            return;
        setBusy(true);
        try {
            const normalized = parsed.rows.map(row => {
                const out: Record<string, string> = {};
                for (const field of fields) {
                    const sourceHeader = mapping[field.key];
                    out[field.key] = sourceHeader ? (row[sourceHeader] ?? '') : '';
                }
                return out;
            });
            await onConfirm(normalized);
            reset();
            onClose();
        }
        catch (e: any) {
            setError(e?.message || t('clients.importFailed') as string);
        }
        finally {
            setBusy(false);
        }
    };
    return (<BottomSheet isOpen={isOpen} onClose={handleClose} title={title ?? t('clients.importCsv')}>
            <div className="px-5 py-4 space-y-4">
                {!parsed ? (<EmptyState title={t('clients.importPickTitle') as string} subtitle={t('clients.importPickHint') as string} action={<Button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm font-bold">
                                {t('clients.importPickButton')}
                            </Button>}/>) : (<>
                        <section>
                            <h3 className="text-sm font-semibold mb-2">{t('clients.importMapColumns')}</h3>
                            <ul className="space-y-2">
                                {fields.map(field => (<li key={field.key} className="flex items-center justify-between gap-3">
                                        <span className="text-sm">
                                            {field.label}
                                            {field.required && <span className="text-danger ms-1">*</span>}
                                        </span>
                                        <select value={mapping[field.key] || ''} onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))} className="min-h-10 max-w-[55%] rounded-button border border-border bg-surface px-2 text-sm text-neutral-900">
                                            <option value="">{t('clients.importIgnore')}</option>
                                            {parsed.headers.map(h => (<option key={h} value={h}>{h}</option>))}
                                        </select>
                                    </li>))}
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-sm font-semibold mb-2">{t('clients.importPreview')}</h3>
                            <div className="overflow-x-auto rounded-md border border-border">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-surface-muted">
                                            {fields.map(f => (<th key={f.key} className="px-2 py-1 text-start font-medium">{f.label}</th>))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewRows.map((row, i) => (<tr key={i} className="border-t border-border">
                                                {fields.map(f => (<td key={f.key} className="px-2 py-1 align-top">{row[f.key] || <span className="opacity-40">—</span>}</td>))}
                                            </tr>))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs mt-1 text-neutral-500">
                                {String(t('clients.importTotalRows')).replace('{count}', String(parsed.rows.length))}
                            </p>
                        </section>
                    </>)}

                {error && <p className="text-sm text-danger">{error}</p>}
                {missingRequired.length > 0 && parsed && (<p className="text-xs text-warning">
                        {String(t('clients.importMissing')).replace('{fields}', missingRequired.join(', '))}
                    </p>)}

                <div className="flex justify-end gap-2 pt-2">
                    {parsed && (<Button onClick={reset} variant="outline" className="px-4 py-2 text-sm font-medium">
                            {t('clients.importRestart')}
                        </Button>)}
                    {parsed && (<Button onClick={handleConfirm} disabled={missingRequired.length > 0 || busy} className="px-4 py-2 text-sm font-bold disabled:opacity-50">
                            {busy ? t('clients.importBusy') : t('clients.importConfirm')}
                        </Button>)}
                </div>

                <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
                void handleFile(file);
        }}/>
            </div>
        </BottomSheet>);
}
