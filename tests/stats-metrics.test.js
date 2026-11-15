/* ==========================================
   Tests — métricas de estadísticas (stats-metrics.js)

   Fijan lo que es fácil de romper sin enterarse: que las visitas se agrupen
   en sesiones, que la última página de una sesión no valga 0 ms, que el mapa
   de calor ponga cada visita en su día y hora, y que las rachas cuenten bien
   (incluidos los casos de 0 y 1 día).
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
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
  uniqueDays,
  streaks,
  OPENWHEN_READ_PREFIX,
  isOpenWhenReadVisit,
  openWhenReadIds
} from '../personal-hub/src/utils/stats-metrics.js';

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
    visit('2026-05-04T08:15:00'),
    visit('2026-05-04T08:45:00'),
    visit('2026-05-10T23:30:00') // domingo
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
    visit('2026-05-04T03:00:00'),
    visit('2026-05-04T09:00:00'),
    visit('2026-05-04T16:00:00'),
    visit('2026-05-04T22:00:00'),
    visit('2026-05-04T23:00:00')
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
