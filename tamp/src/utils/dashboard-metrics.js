import { shiftStatsDay, statsDay } from './stats-metrics.js';

const shortDate = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC', day: 'numeric', month: 'short'
});

export function dailyCounts(today, length, rows, field) {
  const days = Array.from({ length }, (_, index) => {
    const date = shiftStatsDay(today, index + 1 - length);
    return { date, label: shortDate.format(new Date(`${date}T00:00:00Z`)), count: 0 };
  });
  const counts = new Map(days.map(day => [day.date, day]));
  for (const row of rows) {
    const day = counts.get(statsDay(row[field]));
    if (day) day.count++;
  }
  return days;
}

/** Keep today's last check-in for each person, including multi-selection. */
export function latestDailyMoods(rows, today) {
  const latest = new Map();
  for (const row of rows) {
    if (statsDay(row.date) !== today) continue;
    const current = latest.get(row.user_id);
    if (!current || (row.created_at || '') > (current.created_at || '')) latest.set(row.user_id, row);
  }
  return [...latest.values()];
}

/** A seeded record can be replaced by an unpublished draft in the managed catalog. */
export function publishedLetterIds(seed, custom) {
  const byId = new Map([...seed, ...custom].filter(letter => letter?.id).map(letter => [letter.id, letter]));
  return new Set([...byId].filter(([, letter]) => letter.status !== 'pronto').map(([id]) => id));
}

function calendarDaysBetween(target, today) {
  return Math.round((Date.parse(target) - Date.parse(today)) / 86400000);
}

/** One-off dates retain their original day. Annual dates follow the next occurrence. */
export function dashboardDates(config, today, fixedDates) {
  const candidates = fixedDates.map(({ id, label, icon }) => ({
    date: config[id],
    title: config.titles?.[id] || label,
    recurring: config.recurring?.[id] ?? id !== 'hubStart',
    icon,
    id
  }));
  for (const event of Array.isArray(config.events) ? config.events : []) {
    if (!event?.date) continue;
    candidates.push({ date: event.date, title: event.title || 'Fecha especial', icon: '📅', recurring: !!event.recurring });
  }
  const year = Number(today.slice(0, 4));
  return candidates.flatMap(event => {
    const original = statsDay(event.date);
    if (!original) return [];
    let date = original;
    if (event.recurring && date < today) {
      const monthDay = original.slice(5);
      const targetYear = `${year}-${monthDay}` < today ? year + 1 : year;
      // Date.UTC applies the same rollover as the shared events calendar.
      const [month, day] = monthDay.split('-').map(Number);
      date = new Date(Date.UTC(targetYear, month - 1, day)).toISOString().slice(0, 10);
    }
    return [{ ...event, date, days: calendarDaysBetween(date, today), original }];
  });
}
