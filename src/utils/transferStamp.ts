/**
 * V13-6 (audit): the date and time typed in the client-to-client transfer window, as stored on the rows
 * (`date` dd/mm/yyyy, `time` HH:MM, `timestamp`). Nothing typed, or a date that cannot be read: null (keep the old one).
 */
export function transferStamp(dateText: string, timeText: string): { date: string; time: string; timestamp: number } | null {
    const date = (dateText || '').trim();
    const time = (timeText || '').trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    const parts = iso ? [iso[1], iso[2], iso[3]] : fr ? [fr[3], fr[2], fr[1]] : null;
    if (!parts) return null;
    const hm = /^(\d{1,2}):(\d{2})/.exec(time);
    const day = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), hm ? Number(hm[1]) : 0, hm ? Number(hm[2]) : 0).getTime();
    if (!Number.isFinite(day)) return null;
    return { date: `${parts[2]}/${parts[1]}/${parts[0]}`, time: hm ? `${hm[1].padStart(2, '0')}:${hm[2]}` : time, timestamp: day };
}
