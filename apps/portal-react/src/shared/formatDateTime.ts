const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const LONG_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `HH:mm`, matching the Angular `date: 'HH:mm'` pipe. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `EEE d MMM y, HH:mm` */
export function formatLongWhen(iso: string): string {
  const date = new Date(iso);
  return (
    `${SHORT_WEEKDAYS[date.getDay()]} ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ` +
    `${date.getFullYear()}, ${formatTime(iso)}`
  );
}

/** `EEE d MMM, HH:mm` — the year-less form used in the cancel dialog. */
export function formatShortWhen(iso: string): string {
  const date = new Date(iso);
  return (
    `${SHORT_WEEKDAYS[date.getDay()]} ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}, ` +
    formatTime(iso)
  );
}

/** Groups slots by the literal date prefix of the ISO string, as the Angular picker did. */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * `EEEE d MMMM` from a `YYYY-MM-DD` key. Parsed field by field because
 * `new Date('2099-01-05')` is UTC midnight, which shifts the heading a day
 * behind in negative offsets.
 */
export function formatDayHeading(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${LONG_WEEKDAYS[date.getDay()]} ${date.getDate()} ${LONG_MONTHS[date.getMonth()]}`;
}
