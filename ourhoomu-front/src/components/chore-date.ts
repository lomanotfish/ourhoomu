export type CalendarDate = { year: number; month: number; day: number };
export type CalendarMonth = Pick<CalendarDate, 'year' | 'month'>;

const thaiMonths = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseChoreDate(value: string): CalendarDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

export function calendarDays(year: number, month: number): (number | null)[] {
  const first = new Date(0);
  first.setUTCHours(12, 0, 0, 0);
  first.setUTCFullYear(year, month - 1, 1);
  const leading = first.getUTCDay();
  const days: (number | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth(year, month); day++) days.push(day);
  while (days.length % 7) days.push(null);
  return days;
}

export function moveMonth(year: number, month: number, offset: number): CalendarMonth {
  const index = Math.max(0, Math.min(9999 * 12 - 1, (year - 1) * 12 + month - 1 + offset));
  return { year: Math.floor(index / 12) + 1, month: (index % 12) + 1 };
}

export function toDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatThaiMonth(year: number, month: number): string {
  return `${thaiMonths[month - 1]} ${year + 543}`;
}

export function formatThaiDate(value: string): string {
  const date = parseChoreDate(value);
  return date ? `${date.day} ${formatThaiMonth(date.year, date.month)}` : value;
}
