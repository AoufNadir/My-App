// A date field holds a local day (yyyy-mm-dd). toISOString() and new Date('yyyy-mm-dd') work in UTC,
// so in Algeria (UTC+1) the start of a period came back one day early when the filter was reopened.

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** Local day of a date, as a date field expects it (yyyy-mm-dd). */
export function toDateInputValue(date: Date): string {
    return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

/** Midnight, local time, of the day a date field holds (yyyy-mm-dd). */
export function fromDateInputValue(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/** dd/mm/yyyy in local time, like the dates the app saves with each operation. */
export function formatDayLabel(date: Date): string {
    return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()}`;
}
