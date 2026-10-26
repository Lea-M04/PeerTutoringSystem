const localDateTimeFormatter = (timeZone) => new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partsInTimeZone(instant, timeZone) {
  return Object.fromEntries(localDateTimeFormatter(timeZone).formatToParts(instant)
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]));
}

function localPartsAsUtc(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function sameMinute(left, right) {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute;
}

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function localDateTimeToUtcIso(value, timeZone = browserTimeZone()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) throw new RangeError('Enter a valid local date and time.');

  const [, year, month, day, hour, minute] = match.map(Number);
  const local = { year, month, day, hour, minute };
  const wallTimeAsUtc = localPartsAsUtc(local);
  const check = new Date(wallTimeAsUtc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day
    || check.getUTCHours() !== hour || check.getUTCMinutes() !== minute) {
    throw new RangeError('Enter a valid local date and time.');
  }

  const offsets = new Set();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = new Date(wallTimeAsUtc + hours * 60 * 60 * 1000);
    const zonedSample = partsInTimeZone(sample, timeZone);
    offsets.add(localPartsAsUtc(zonedSample) - sample.getTime());
  }

  const candidates = [...offsets]
    .map((offset) => wallTimeAsUtc - offset)
    .filter((candidate) => sameMinute(partsInTimeZone(new Date(candidate), timeZone), local))
    .sort((left, right) => left - right);

  if (candidates.length === 0) {
    throw new RangeError('That local time does not exist because the clock moves forward. Choose another time.');
  }

  // During a fall-back transition, the same wall time occurs twice. Choose the earlier instant consistently.
  return new Date(candidates[0]).toISOString();
}

export function utcIsoToLocalDateTime(value, timeZone = browserTimeZone()) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  const parts = partsInTimeZone(instant, timeZone);
  const pad = (number) => String(number).padStart(2, '0');
  return `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatLocalDateTime(value, timeZone = browserTimeZone()) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(instant);
}
