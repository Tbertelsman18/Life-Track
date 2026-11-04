// Date helpers. Every date in the app is stored as a "date key" string
// like "2026-11-04" (year-month-day, in your local time zone).

const pad = (n) => String(n).padStart(2, '0');

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
// Weekdays in Monday-first order (0 = Sunday ... 6 = Saturday)
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toKey(new Date());
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(key, n) {
  const d = fromKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toKey(d);
}

export function weekday(key) {
  return fromKey(key).getDay();
}

// Monday of the week containing this date
export function startOfWeek(key) {
  const wd = weekday(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(key) {
  return key.slice(0, 8) + '01';
}

export function daysInMonth(key) {
  const d = fromKey(key);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

// The 6x7 grid of dates shown in a month calendar (Monday first)
export function monthGrid(key) {
  const first = startOfWeek(startOfMonth(key));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function sameMonth(a, b) {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function formatLong(key) {
  const d = fromKey(key);
  return `${DAY_NAMES_LONG[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function formatShort(key) {
  const d = fromKey(key);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function formatMonthYear(key) {
  const d = fromKey(key);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatWeekRange(key) {
  const start = startOfWeek(key);
  const end = addDays(start, 6);
  const s = fromKey(start), e = fromKey(end);
  const sm = MONTH_NAMES[s.getMonth()].slice(0, 3);
  const em = MONTH_NAMES[e.getMonth()].slice(0, 3);
  return sm === em
    ? `${sm} ${s.getDate()} – ${e.getDate()}`
    : `${sm} ${s.getDate()} – ${em} ${e.getDate()}`;
}
