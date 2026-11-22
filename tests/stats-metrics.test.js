/* ==========================================
   Tests — métricas de estadísticas (stats-metrics.js)

   Fijan lo que es fácil de romper sin enterarse: que las visitas se agrupen
   en sesiones, que la última página de una sesión no valga 0 ms, que el mapa
   de calor ponga cada visita en su día y hora, y que las rachas cuenten bien
   (incluidos los casos de 0 y 1 día).
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { readAdminHistory } from '../tamp/src/services/admin-analytics-read.js';
import {
  SESSION_GAP_MS,
  TAIL_MIN_MS,
  TAIL_MAX_MS,
  basePageOf,
  median,
  tailDurationMs,
  buildSessions,
  sectionUsage,
  userUsage,
  sessionSummary,
  hourlyHeatmap,
  dayParts,
  statsDay,
  shiftStatsDay,
  uniqueDays,
  streaks,
  OPENWHEN_READ_PREFIX,
  isOpenWhenReadVisit,
  openWhenReadIds
} from '../tamp/src/utils/stats-metrics.js';

const visit = (timestamp, page, user_id = 'u1') => ({ timestamp, page, user_id });

test('basePageOf reduce cualquier ruta a su sección raíz', () => {
  assert.equal(basePageOf('/canciones?v=x'), '/canciones');
  assert.equal(basePageOf('/juegos/online/1'), '/juegos');
  assert.equal(basePageOf('/'), '/');
  assert.equal(basePageOf(''), '/');
  assert.equal(basePageOf('/admin/'), '/admin');
});

test('median no se rompe con listas vacías o valores no numéricos', () => {
  assert.equal(median([]), 0);
  assert.equal(median([undefined, NaN, 'x']), 0);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 2]), 1.5);
  assert.equal(median([3, 1, 2]), 2);
});

test('la última página de una sesión nunca queda en 0 ms', () => {
  assert.equal(tailDurationMs([]), TAIL_MIN_MS);
  // Por debajo del mínimo, se sube al mínimo.
  assert.equal(tailDurationMs([1000]), TAIL_MIN_MS);
  // Por encima del máximo, se baja al máximo.
  assert.equal(tailDurationMs([20 * 60 * 1000]), TAIL_MAX_MS);
  // En medio, se queda con la mediana.
  assert.equal(tailDurationMs([90 * 1000]), 90 * 1000);
});

test('un hueco menor de 30 min sigue en la misma sesión', () => {
  const sessions = buildSessions([
    visit('2026-05-01T10:00:00Z', '/'),
    visit('2026-05-01T10:01:30Z', '/canciones'),
    visit('2026-05-01T10:03:00Z', '/galeria')
  ]);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].pages.length, 3);
  assert.equal(sessions[0].pages[0].ms, 90 * 1000);
  assert.equal(sessions[0].pages[1].ms, 90 * 1000);
  // La última recibe la estimación (mediana de los huecos), no 0.
  assert.equal(sessions[0].pages[2].ms, 90 * 1000);
});

test('un hueco mayor de 30 min abre una sesión nueva', () => {
  const sessions = buildSessions([
    visit('2026-05-01T10:00:00Z', '/'),
    visit('2026-05-01T11:00:00Z', '/canciones')
  ]);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].pages.length, 1);
  assert.equal(sessions[1].pages.length, 1);
  // Cada sesión de una sola visita dura el mínimo de lectura.
  assert.equal(sessions[0].pages[0].ms, TAIL_MIN_MS);
});

test('cada persona agrupa sus propias sesiones', () => {
  const sessions = buildSessions([
    visit('2026-05-01T10:00:00Z', '/', 'u1'),
    visit('2026-05-01T10:01:00Z', '/canciones', 'u1'),
    visit('2026-05-01T10:02:00Z', '/galeria', 'u2'),
    visit('2026-05-01T10:03:00Z', '/galeria', 'u2')
  ]);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions.map(s => s.userId).sort(), ['u1', 'u2']);
});

test('sin visitas no hay sesiones ni totales', () => {
  const sessions = buildSessions([]);
  assert.deepEqual(sessions, []);
  assert.deepEqual(sectionUsage(sessions), {});
  assert.deepEqual(userUsage(sessions), {});
  assert.deepEqual(sessionSummary(sessions), { sessions: 0, totalMs: 0, avgMs: 0 });
});

test('una sola visita produce una sesión con la estimación mínima', () => {
  const sessions = buildSessions([visit('2026-05-01T10:00:00Z', '/maldia')]);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].pages[0].ms, TAIL_MIN_MS);
  const usage = sectionUsage(sessions);
  assert.equal(usage['/maldia'].count, 1);
  assert.ok(usage['/maldia'].ms > 0, 'la sección no puede quedarse a 0 ms');
});

test('las fechas inválidas se ignoran en vez de crear sesiones fantasma', () => {
  const sessions = buildSessions([
    visit('no es una fecha', '/'),
    visit(undefined, '/'),
    visit('2026-05-01T10:00:00Z', '/')
  ]);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].pages.length, 1);
});

test('sectionUsage suma tiempo y visitas por sección', () => {
  const sessions = buildSessions([
    visit('2026-05-01T10:00:00Z', '/canciones'),
    visit('2026-05-01T10:02:00Z', '/canciones'),
    visit('2026-05-01T10:04:00Z', '/galeria')
  ]);
  const usage = sectionUsage(sessions);
  assert.equal(usage['/canciones'].count, 2);
  assert.equal(usage['/canciones'].ms, 4 * 60 * 1000);
  assert.equal(usage['/galeria'].count, 1);
  assert.equal(usage['/galeria'].ms, TAIL_MAX_MS, 'la última página se estima con tope de 2 min');
});

test('userUsage cuenta sesiones, visitas y última conexión', () => {
  const sessions = buildSessions([
    visit('2026-05-01T10:00:00Z', '/a', 'u1'),
    visit('2026-05-01T10:05:00Z', '/b', 'u1'),
    visit('2026-05-01T12:00:00Z', '/c', 'u1')
  ]);
  const usage = userUsage(sessions);
  assert.equal(usage.u1.sessions, 2);
  assert.equal(usage.u1.count, 3);
  assert.equal(usage.u1.lastTs, Date.parse('2026-05-01T12:00:00Z'));
  assert.ok(usage.u1.totalMs >= 2 * TAIL_MIN_MS);
});

test('sessionSummary calcula la duración media sin dividir por cero', () => {
  // Dos visitas con 4 min de hueco: la primera dura 4 min completos y la
  // última se estima en 2 min (tope), así que la sesión son 6 min.
  const sessions = buildSessions([
    visit('2026-05-01T10:00:00Z', '/'),
    visit('2026-05-01T10:04:00Z', '/')
  ]);
  const summary = sessionSummary(sessions);
  assert.equal(summary.sessions, 1);
  assert.equal(summary.avgMs, 6 * 60 * 1000);
  assert.equal(summary.totalMs, summary.avgMs);
  assert.equal(sessionSummary([]).avgMs, 0);
});

test('el mapa de calor coloca cada visita en su día (lunes = 0) y su hora', () => {
  // 2026-05-04 es lunes.
  const heat = hourlyHeatmap([
    visit('2026-05-04T06:15:00Z'),
    visit('2026-05-04T06:45:00Z'),
    visit('2026-05-10T21:30:00Z') // domingo a las 23 en Madrid
  ]);
  assert.equal(heat.total, 3);
  assert.equal(heat.matrix[0][8], 2, 'lunes a las 8');
  assert.equal(heat.matrix[6][23], 1, 'domingo a las 23');
  assert.equal(heat.peakHour, 8);
  assert.equal(heat.hours.reduce((a, b) => a + b, 0), 3);

  const empty = hourlyHeatmap([]);
  assert.equal(empty.peakHour, null);
  assert.equal(empty.total, 0);
});

test('dayParts reparte las 24 horas en cuatro franjas', () => {
  const heat = hourlyHeatmap([
    visit('2026-05-04T01:00:00Z'),
    visit('2026-05-04T07:00:00Z'),
    visit('2026-05-04T14:00:00Z'),
    visit('2026-05-04T20:00:00Z'),
    visit('2026-05-04T21:00:00Z')
  ]);
  const parts = dayParts(heat);
  assert.deepEqual(parts.map(p => p.count), [1, 1, 1, 2]);
  assert.equal(parts.reduce((sum, p) => sum + p.count, 0), heat.total);
});

test('uniqueDays normaliza ISO y fechas sueltas, y descarta basura', () => {
  const days = uniqueDays([
    '2026-05-01T23:30:00Z',
    '2026-05-02',
    '2026-05-02T08:00:00Z',
    '',
    'ayer',
    null
  ]);
  assert.ok(days.includes('2026-05-02'));
  assert.equal(new Set(days).size, days.length);
  assert.ok(days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)));
});

test('los días de las gráficas comparten el cambio de fecha de Madrid', () => {
  assert.equal(statsDay('2026-03-28T22:59:59Z'), '2026-03-28');
  assert.equal(statsDay('2026-03-28T23:00:00Z'), '2026-03-29');
  assert.equal(statsDay('2026-03-29T22:00:00Z'), '2026-03-30');
  assert.equal(statsDay('2026-03-29'), '2026-03-29');
  assert.equal(statsDay('2026-02-29'), '');
  assert.equal(shiftStatsDay('2026-03-29', 1), '2026-03-30');
  assert.equal(shiftStatsDay('2026-01-01', -1), '2025-12-31');

  const heat = hourlyHeatmap([
    visit('2026-03-29T00:59:59Z'),
    visit('2026-03-29T01:00:00Z'),
    visit('2026-03-29T22:00:00Z'),
    visit(null),
  ]);
  assert.equal(heat.matrix[6][1], 1);
  assert.equal(heat.matrix[6][2], 0); // en Madrid salta de las 01:59 a las 03:00
  assert.equal(heat.matrix[6][3], 1);
  assert.equal(heat.matrix[0][0], 1);
  assert.equal(heat.total, 3);
});

test('rachas: vacío, un solo día y días sueltos', () => {
  assert.deepEqual(streaks([], '2026-05-10'), { current: 0, longest: 0, last: null });

  const one = streaks(['2026-05-10'], '2026-05-10');
  assert.equal(one.current, 1);
  assert.equal(one.longest, 1);
  assert.equal(one.last, '2026-05-10');

  const sueltos = streaks(['2026-05-01', '2026-05-03', '2026-05-05'], '2026-05-10');
  assert.equal(sueltos.current, 0, 'una racha rota ya no está activa');
  assert.equal(sueltos.longest, 1);
});

test('rachas: consecutivas, activas y con el día de gracia', () => {
  const days = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-05', '2026-05-06'];
  const hoy = streaks(days, '2026-05-06');
  assert.equal(hoy.current, 2);
  assert.equal(hoy.longest, 3);

  // Si el último día es ayer, la racha sigue viva (hoy aún se puede completar).
  assert.equal(streaks(days, '2026-05-07').current, 2);
  // Dos días sin entrar la cortan.
  assert.equal(streaks(days, '2026-05-08').current, 0);
});

test('rachas: el cambio de mes y de año no rompe la cuenta', () => {
  const days = ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'];
  assert.equal(streaks(days, '2026-02-02').current, 4);
  assert.equal(streaks(days, '2026-02-02').longest, 4);

  const finDeAnio = ['2025-12-30', '2025-12-31', '2026-01-01'];
  assert.equal(streaks(finDeAnio, '2026-01-01').current, 3);
});

test('rachas: los registros futuros e inválidos no alteran los días actuales', () => {
  assert.deepEqual(streaks(['2026-09-01', '2026-09-02', '2026-09-03', 'hoy'], '2026-09-02'), {
    current: 2,
    longest: 2,
    last: '2026-09-02'
  });
});

test('las lecturas de Open When se cuentan aparte de las visitas de navegación', () => {
  const visits = [
    visit('2026-05-01T10:00:00Z', '/'),
    visit('2026-05-01T10:01:00Z', `${OPENWHEN_READ_PREFIX}carta-a`),
    visit('2026-05-01T10:02:00Z', `${OPENWHEN_READ_PREFIX}carta-a`),
    visit('2026-05-01T10:03:00Z', `${OPENWHEN_READ_PREFIX}carta-b?origen=push`),
    visit('2026-05-01T10:04:00Z', '/openwhen')
  ];
  assert.equal(isOpenWhenReadVisit(visits[1]), true);
  assert.equal(isOpenWhenReadVisit(visits[0]), false);
  assert.equal(isOpenWhenReadVisit(null), false);

  const read = openWhenReadIds(visits);
  assert.equal(read.size, 2, 'una carta abierta dos veces cuenta una sola vez');
  assert.ok(read.has('carta-a'));
  assert.ok(read.has('carta-b'));
  assert.equal(openWhenReadIds([]).size, 0);
  assert.equal(openWhenReadIds([visit('2026-05-01T10:00:00Z', OPENWHEN_READ_PREFIX)]).size, 0,
    'una marca sin id no inventa una carta');

  const nav = visits.filter(v => !isOpenWhenReadVisit(v));
  assert.equal(nav.length, 2);
  const sessions = buildSessions(nav);
  assert.equal(sessions[0].pages.length, 2, 'las marcas de lectura no crean páginas ni tiempos');
});

test('la constante de corte de sesión sigue siendo media hora', () => {
  assert.equal(SESSION_GAP_MS, 30 * 60 * 1000);
  assert.ok(TAIL_MIN_MS < TAIL_MAX_MS);
});

function analyticsClient(fetch) {
  return createClient('https://analytics.example.test', 'synthetic-only', {
    global: { fetch },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

test('el historial pagina por fecha e id aunque entren visitas y PostgREST recorte la respuesta', async () => {
  const timestamp = '2026-11-19T12:00:00+00:00';
  const idFor = number => `00000000-0000-4000-a000-${String(number).padStart(12, '0')}`;
  const rows = Array.from({ length: 1100 }, (_, i) => ({
    id: idFor(1100 - i), user_id: 'test-account', page: '/', timestamp
  }));
  const requested = [];
  const client = analyticsClient(async input => {
    const { pathname, searchParams } = new URL(input);
    assert.equal(pathname, '/rest/v1/analytics_visits');
    assert.equal(searchParams.get('order'), 'timestamp.desc.nullslast,id.desc');
    assert.equal(searchParams.get('user_id'), 'eq.test-account');
    const cursor = searchParams.get('or');
    requested.push(cursor);
    const valid = cursor ? rows.filter(row => row.id < cursor.match(/id\.lt\.([\da-f-]+)/)[1]) : rows;
    const result = valid.slice(0, Math.min(Number(searchParams.get('limit')), 500));
    if (!cursor) rows.unshift({ ...rows[0], id: idFor(1101) });
    return Response.json(result);
  });
  const result = await readAdminHistory(client, 'visits', { limit: 1000, userId: 'test-account' });
  assert.equal(result.rows.length, 1000);
  assert.equal(result.rows[0].id, idFor(1100));
  assert.equal(result.rows.at(-1).id, idFor(101));
  assert.equal(result.truncated, true);
  assert.equal(new Set(result.rows.map(row => row.id)).size, 1000);
  assert.deepEqual(requested, [
    null,
    `(timestamp.lt.${timestamp},and(timestamp.eq.${timestamp},id.lt.${idFor(601)}))`,
    `(timestamp.lt.${timestamp},and(timestamp.eq.${timestamp},id.lt.${idFor(101)}))`
  ]);
});

test('los filtros remotos usan medianoche en Madrid y distinguen ausencia, error y modo local', async () => {
  const from = '2026-03-29';
  const through = from;
  const params = [];
  const empty = analyticsClient(async input => {
    params.push(new URL(input).searchParams);
    return Response.json([]);
  });
  assert.deepEqual(await readAdminHistory(empty, 'visits', { from, through }), {
    rows: [], source: 'supabase', truncated: false
  });
  await readAdminHistory(empty, 'moods', { from, through });
  assert.equal(params[0].getAll('timestamp').join(','), 'not.is.null,gte.2026-03-28T23:00:00.000Z,lt.2026-03-29T22:00:00.000Z');
  assert.deepEqual(params[1].getAll('date'), ['gte.2026-03-29', 'lt.2026-03-30']);

  const forbidden = analyticsClient(async () =>
    Response.json({ message: 'Error remoto sintético', code: '42501' }, { status: 403 }));
  await assert.rejects(readAdminHistory(forbidden, 'visits'), { message: 'Error remoto sintético' });
  await assert.rejects(readAdminHistory(empty, 'visits', { from: '2026-02-30' }), RangeError);

  const localRows = [
    visit('2026-03-28T23:00:00Z', '/'),
    visit('2026-03-29T22:00:00Z', '/'), // al día siguiente en Madrid
    visit('2026-03-29T12:00:00Z', '/', 'another-user'),
    visit('2026-03-29T21:59:59Z', '/galeria')
  ];
  const local = await readAdminHistory(null, 'visits', { from, through, localRows, userId: 'u1', limit: 1 });
  assert.deepEqual(local, { rows: [localRows[3]], source: 'local', truncated: true });
});
