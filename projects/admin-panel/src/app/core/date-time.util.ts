const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon, Jul 14, 2026 · 8:00 AM" — matches the mock event data's display format. */
export function formatDateFull(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()];
  const month = MONTHS[date.getMonth()];
  const hours24 = date.getHours();
  const hours = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  return `${weekday}, ${month} ${date.getDate()}, ${date.getFullYear()} · ${hours}:${minutes} ${ampm}`;
}

/** "Jul 14" — matches the mock event data's short date format. */
export function formatDateShort(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** Value shape expected by `<input type="datetime-local">`. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Best-effort parse of the display format back into a Date, for pre-filling the picker on edit. */
export function parseDisplayDateTime(display: string): Date {
  const withoutWeekday = display.replace(/^[A-Za-z]+,\s*/, '');
  const cleaned = withoutWeekday.replace('·', ' ');
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const datePart = withoutWeekday.split('·')[0].trim();
  const fallback = new Date(datePart);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}
