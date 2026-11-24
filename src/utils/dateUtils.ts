export const EGYPT_TIMEZONE = 'Africa/Cairo';

/**
 * Returns the YYYY-MM-DD string for a given Date in Egypt's timezone (Africa/Cairo).
 */
export function getEgyptDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: EGYPT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns a YYYY-MM-DD date string shifted by `offsetDays` relative to `baseDate` in Egypt time.
 */
export function getEgyptOffsetDateString(offsetDays: number, baseDate: Date = new Date()): string {
  const todayStr = getEgyptDateString(baseDate);
  const [year, month, day] = todayStr.split('-').map(Number);
  // Use UTC noon to avoid any DST edge shifting the calendar day
  const utcDate = new Date(Date.UTC(year, month - 1, day + offsetDays, 12, 0, 0));
  return getEgyptDateString(utcDate);
}

/**
 * Formats a YYYY-MM-DD content_date string in Arabic (Egypt locale & timezone).
 * Example: "الثلاثاء، ٢٤ نوفمبر ٢٠٢٦"
 */
export function formatArabicContentDate(
  dateStr: string,
  options: { includeWeekday?: boolean; compact?: boolean } = {}
): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr || 'تاريخ غير محدد';
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const safeDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const includeWeekday = options.includeWeekday ?? !options.compact;
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: EGYPT_TIMEZONE,
    weekday: includeWeekday ? 'long' : undefined,
    day: 'numeric',
    month: options.compact ? 'short' : 'long',
    year: 'numeric',
  }).format(safeDate);
}

/**
 * Formats a Date timestamp in Arabic with Egypt time (e.g. "١٠:٣٠ ص").
 */
export function formatArabicTimeEgypt(date: Date | null | undefined): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: EGYPT_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formats speaking duration in seconds into natural Arabic text.
 */
export function formatDurationArabic(durationSec?: number): string {
  if (!durationSec || durationSec <= 0) {
    return 'غير محددة';
  }
  const mins = Math.floor(durationSec / 60);
  const secs = Math.round(durationSec % 60);

  if (mins === 0) {
    return `${secs} ثانية`;
  }
  if (secs === 0) {
    return mins === 1 ? 'دقيقة واحدة' : `${mins} دقائق`;
  }
  const minLabel = mins === 1 ? 'دقيقة' : `${mins} دقائق`;
  return `${minLabel} و${secs} ثانية`;
}
