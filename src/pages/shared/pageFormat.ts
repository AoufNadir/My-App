export const FR_LOCALE = 'fr-FR';

type DecimalOptions = {
  min?: number;
  max?: number;
};

export function formatNumber(value: number, options?: DecimalOptions): string {
  const min = options?.min ?? 2;
  const max = options?.max ?? min;
  const epsilon = 0.5 * Math.pow(10, -max);
  const safeValue = Number.isFinite(value) ? value : 0;
  const normalizedValue = (Object.is(safeValue, -0) || Math.abs(safeValue) < epsilon) ? 0 : safeValue;

  return normalizedValue.toLocaleString(FR_LOCALE, {
    minimumFractionDigits: min,
    maximumFractionDigits: max
  });
}

export function formatDzd(value: number, options?: DecimalOptions): string {
  return `${formatNumber(value, options)} DZD`;
}

export function getRelativeFrDateLabel(dateString: string): string {
  const parts = dateString.split('/');
  if (parts.length !== 3) return dateString;

  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = Number(parts[2]);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return dateString;
  }

  const txDate = new Date(year, month, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (txDate.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (txDate.toDateString() === yesterday.toDateString()) return 'Hier';

  return dateString;
}
