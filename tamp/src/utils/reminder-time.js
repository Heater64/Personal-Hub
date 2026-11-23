const TIME_ZONE = 'Europe/Madrid';

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23'
});

function partsAt(value) {
  return Object.fromEntries(dateTimeFormatter.formatToParts(value)
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]));
}

function wallClockMatches(value, expected) {
  const actual = partsAt(new Date(value));
  return ['year', 'month', 'day', 'hour', 'minute'].every(key => actual[key] === expected[key]);
}

function formatParts(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

/** Converts a datetime-local value interpreted as Spain peninsular wall time. */
export function localInputToIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) throw new Error('Indica una fecha y hora válidas');
  const [, year, month, day, hour, minute] = match.map(Number);
  const expected = { year, month, day, hour, minute };
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(wallTime);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59) {
    throw new Error('Indica una fecha y hora válidas');
  }

  // Look around the target wall time for offsets on either side of DST. If
  // the clock jumps over this local time there is no candidate and we reject it.
  const offsets = new Set();
  for (let delta = -36; delta <= 36; delta += 6) {
    const probe = wallTime + delta * 60 * 60 * 1000;
    const parts = partsAt(new Date(probe));
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    offsets.add(representedAsUtc - Math.floor(probe / 1000) * 1000);
  }
  const candidates = [...offsets]
    .map(offset => wallTime - offset)
    .filter(candidate => wallClockMatches(candidate, expected))
    .sort((a, b) => a - b);
  if (!candidates.length) throw new Error('Esa hora no existe por el cambio horario. Elige otra hora.');
  // During the autumn clock change the same wall time occurs twice; choose the
  // first occurrence so the saved reminder has a deterministic time.
  return new Date(candidates[0]).toISOString();
}

/** Formats an ISO instant as a datetime-local value in Spain peninsular time. */
export function isoToLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatParts(partsAt(date));
}

/** Formats a reminder timestamp in Spain peninsular time. */
export function formatReminderDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no válida';
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}
