import { toDateInputValue } from './dateInput';

// The period shortcuts of the operations date filter (V9-7): the days each one means, as date fields hold them.

export type DatePresetId = 'today' | 'last7' | 'thisMonth' | 'lastMonth' | 'thisYear';
export const DATE_PRESET_IDS: ReadonlyArray<DatePresetId> = ['today', 'last7', 'thisMonth', 'lastMonth', 'thisYear'];

export function datePresetRange(id: DatePresetId, now: Date): { start: string; end: string } {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (id) {
        case 'today':
            return { start: toDateInputValue(today), end: toDateInputValue(today) };
        case 'last7':
            return { start: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), end: toDateInputValue(today) };
        case 'thisMonth':
            return { start: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)), end: toDateInputValue(today) };
        case 'lastMonth':
            return { start: toDateInputValue(new Date(today.getFullYear(), today.getMonth() - 1, 1)), end: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 0)) };
        case 'thisYear':
            return { start: toDateInputValue(new Date(today.getFullYear(), 0, 1)), end: toDateInputValue(today) };
    }
}

/** The shortcut the two dates are on, if any (it is lit). */
export function activeDatePreset(start: string, end: string, now: Date): DatePresetId | null {
    return DATE_PRESET_IDS.find((id) => {
        const range = datePresetRange(id, now);
        return range.start === start && range.end === end;
    }) ?? null;
}
