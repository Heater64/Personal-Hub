import { spainMsOnDate } from '../utils/format.js';
import { shiftStatsDay, statsDay } from '../utils/stats-metrics.js';

const PAGE_SIZE = 1000;
const SOURCES = {
  visits: {
    table: 'analytics_visits',
    fields: 'id,user_id,page,timestamp',
    column: 'timestamp',
    defaultLimit: 15000
  },
  moods: {
    table: 'moods',
    fields: 'id,user_id,date,mood,label,emoji,score,created_at',
    column: 'date',
    defaultLimit: 5000
  },
  activity: {
    table: 'activity_log',
    fields: 'id,user_id,action,details,timestamp',
    column: 'timestamp',
    defaultLimit: 5000
  }
};

function isDay(key) {
  return typeof key === 'string' && statsDay(key) === key && key !== '';
}

function rangeBounds(column, from, through) {
  if ((from != null && !isDay(from)) || (through != null && !isDay(through)) ||
    (from && through && from > through)) {
    throw new RangeError('El rango de fechas del panel no es válido.');
  }
  if (column === 'date') return { from, to: through ? shiftStatsDay(through, 1) : null };
  const midnight = key => new Date(spainMsOnDate(key, 0)).toISOString();
  return {
    from: from ? midnight(from) : null,
    to: through ? midnight(shiftStatsDay(through, 1)) : null
  };
}

/**
 * Lee el historial con un cursor estable (fecha o instante + id).
 * Si entran visitas nuevas mientras se carga, las páginas siguientes no
 * cambian de posición. Pedir una fila de más permite detectar el recorte.
 */
export async function readAdminHistory(client, kind, {
  from, through, userId, limit, signal, localRows = []
} = {}) {
  const { table, fields, column, defaultLimit } = SOURCES[kind];
  const max = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : defaultLimit;
  const bounds = rangeBounds(column, from, through);
  const timestamp = column === 'timestamp';
  if (signal?.aborted) throw new DOMException('La lectura se canceló.', 'AbortError');

  if (!client) {
    const rows = (Array.isArray(localRows) ? localRows : []).filter(row => {
      const value = row?.[column];
      if (!value || (userId && row.user_id !== userId)) return false;
      const day = statsDay(value);
      return day && (!from || day >= from) && (!through || day <= through);
    }).sort((a, b) => timestamp
      ? Date.parse(b.timestamp) - Date.parse(a.timestamp)
      : b.date.localeCompare(a.date));
    return { rows: rows.slice(0, max), source: 'local', truncated: rows.length > max };
  }

  const rows = [];
  let cursor = null;
  while (rows.length <= max) {
    let query = client.from(table).select(fields)
      .order(column, { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(Math.min(PAGE_SIZE, max + 1 - rows.length));
    if (timestamp) query = query.not(column, 'is', null);
    if (bounds.from) query = query.gte(column, bounds.from);
    if (bounds.to) query = query.lt(column, bounds.to);
    if (userId) query = query.eq('user_id', userId);
    if (cursor) {
      const value = cursor[column];
      query = query.or(`${column}.lt.${value},and(${column}.eq.${value},id.lt.${cursor.id})`);
    }
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    cursor = data[data.length - 1];
  }

  const selected = rows.slice(0, max);
  if (!timestamp) {
    selected.sort((a, b) => b.date.localeCompare(a.date) ||
      (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  }
  return { rows: selected, source: 'supabase', truncated: rows.length > max };
}
