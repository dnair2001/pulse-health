/**
 * Byte-for-byte ports of the four Angular `date` pipe formats used by the portal templates,
 * rendered in the `en-US` locale (the app never registers another `LOCALE_ID`) and in local time.
 */

const ABBREVIATED_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WIDE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ABBREVIATED_MONTHS = [
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

const WIDE_MONTHS = [
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

const DATE_ONLY_REGEX = /^(\d{4}(-\d{1,2}(-\d{1,2})?)?)$/;

const ISO8601_DATE_REGEX =
  /^(\d{4,})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Angular's `y` getter pads with `negWrap`, so non-positive proleptic years wrap to their BC
 * equivalent (year 0 renders as `1`) instead of gaining a minus sign.
 */
function formatYear(year: number): string {
  return String(year <= 0 ? -year + 1 : year);
}

/**
 * Mirrors Angular's `toDate`. The important part is that bare `YYYY-MM-DD` keys become local
 * midnight rather than the UTC midnight `new Date('2024-05-01')` would produce.
 */
export function parseDate(value: Date | string | number): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(value);
  }

  const trimmed = value.trim();

  if (DATE_ONLY_REGEX.test(trimmed)) {
    const [year, month = 1, day = 1] = trimmed.split('-').map(Number);
    return createLocalDate(year, month - 1, day);
  }

  const match = ISO8601_DATE_REGEX.exec(trimmed);
  if (match) {
    return isoStringToDate(match);
  }

  return new Date(trimmed);
}

/**
 * Angular's `createDate`. Seeding from epoch and calling `setFullYear` keeps two-digit years such
 * as `0001` out of the 1900s, which the `new Date(year, month, day)` constructor would remap.
 */
function createLocalDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(0, 0, 0);
  return date;
}

function isoStringToDate(match: RegExpExecArray): Date {
  const date = new Date(0);
  let tzHour = 0;
  let tzMin = 0;

  const dateSetter = match[8] ? date.setUTCFullYear : date.setFullYear;
  const timeSetter = match[8] ? date.setUTCHours : date.setHours;

  if (match[9]) {
    tzHour = Number(match[9] + match[10]);
    tzMin = Number(match[9] + match[11]);
  }

  dateSetter.call(date, Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const hours = Number(match[4] || 0) - tzHour;
  const minutes = Number(match[5] || 0) - tzMin;
  const seconds = Number(match[6] || 0);
  const milliseconds = Math.floor(parseFloat(`0.${match[7] || 0}`) * 1000);
  timeSetter.call(date, hours, minutes, seconds, milliseconds);

  return date;
}

/** Angular `date: 'HH:mm'` — e.g. `09:30`. */
export function formatTimeOfDay(value: Date | string | number): string {
  const date = parseDate(value);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Angular `date: 'EEE d MMM y, HH:mm'` — e.g. `Wed 1 May 2024, 09:30`. */
export function formatFullDateTime(value: Date | string | number): string {
  const date = parseDate(value);
  return (
    `${ABBREVIATED_DAYS[date.getDay()]} ${date.getDate()} ` +
    `${ABBREVIATED_MONTHS[date.getMonth()]} ${formatYear(date.getFullYear())}, ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}

/** Angular `date: 'EEE d MMM, HH:mm'` — e.g. `Wed 1 May, 09:30`. */
export function formatShortDateTime(value: Date | string | number): string {
  const date = parseDate(value);
  return (
    `${ABBREVIATED_DAYS[date.getDay()]} ${date.getDate()} ` +
    `${ABBREVIATED_MONTHS[date.getMonth()]}, ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}

/** Angular `date: 'EEEE d MMMM'` — e.g. `Wednesday 1 May`. */
export function formatWeekdayDate(value: Date | string | number): string {
  const date = parseDate(value);
  return `${WIDE_DAYS[date.getDay()]} ${date.getDate()} ${WIDE_MONTHS[date.getMonth()]}`;
}

/**
 * Heading for a slot-picker day group, whose key is the `YYYY-MM-DD` prefix of a slot's
 * `startsAt`. Angular renders it with the same `EEEE d MMMM` format.
 */
export function formatDayGroupHeading(dayKey: string): string {
  return formatWeekdayDate(dayKey);
}
