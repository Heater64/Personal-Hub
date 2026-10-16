/* ==========================================
   Tests de contrato — Recordatorios programados (022)

   Dos capas, como el resto de la suite:
     1. La lógica que decide CUÁNDO se envía, importada de api/push.js y
        probada con fechas reales (incluidos los dos cambios de hora
        españoles del 2026).
     2. Que las piezas siguen en su sitio: tabla con RLS de admin, la API
        protegida por admin/cron y el panel con su sección.
   Sin red, sin base de datos y sin navegador.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nextRunFor, dueReminders, cleanReminderInput } from '../api/push.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = (...parts) => path.join(ROOT, ...parts);
const hub = (...parts) => projectPath('personal-hub', ...parts);

// ==========================================
// 1 · CUÁNDO SE ENVÍA
// ==========================================

test('un recordatorio de una sola vez no se repite', () => {
  assert.equal(nextRunFor('2026-10-24T17:00:00.000Z', 'once'), null);
  // Cualquier valor que no sea una recurrencia conocida tampoco se repite.
  assert.equal(nextRunFor('2026-10-24T17:00:00.000Z', 'monthly'), null);
  assert.equal(nextRunFor('2026-10-24T17:00:00.000Z', undefined), null);
});

test('el diario mantiene la hora local cuando el reloj atrasa (octubre)', () => {
  // Sábado 24/10/2026, 19:00 en Madrid (CEST, +2) = 17:00 UTC.
  // El domingo 25 a las 03:00 el reloj vuelve a las 02:00 (CET, +1).
  // La siguiente ejecución debe ser a las 19:00 locales = 18:00 UTC,
  // NO 24 h después (17:00 UTC = 18:00 locales).
  const next = nextRunFor('2026-10-24T17:00:00.000Z', 'daily', new Date('2026-10-24T17:00:00.000Z'));
  assert.equal(next, '2026-10-25T18:00:00.000Z');
});

test('el semanal mantiene la hora local cuando el reloj atrasa', () => {
  const next = nextRunFor('2026-10-24T17:00:00.000Z', 'weekly', new Date('2026-10-24T17:00:00.000Z'));
  assert.equal(next, '2026-10-31T18:00:00.000Z');
});

test('el diario mantiene la hora local cuando el reloj adelanta (marzo)', () => {
  // Sábado 28/03/2026, 19:00 en Madrid (CET, +1) = 18:00 UTC.
  // El domingo 29 a las 02:00 el reloj salta a las 03:00 (CEST, +2).
  const next = nextRunFor('2026-03-28T18:00:00.000Z', 'daily', new Date('2026-03-28T18:00:00.000Z'));
  assert.equal(next, '2026-03-29T17:00:00.000Z');
});

test('un diario parado varios días salta al siguiente que toca, no a los perdidos', () => {
  // El programador estuvo caído del 24 al 27. No se envían los tres avisos
  // atrasados: se envía el de hoy y sigue desde ahí.
  const now = new Date('2026-10-27T10:00:00.000Z');
  const next = nextRunFor('2026-10-24T17:00:00.000Z', 'daily', now);
  assert.equal(next, '2026-10-27T18:00:00.000Z');
  assert.ok(new Date(next).getTime() > now.getTime());
});

test('fechas inválidas no programan nada en vez de lanzar', () => {
  assert.equal(nextRunFor('no-es-una-fecha', 'daily'), null);
  assert.equal(nextRunFor(null, 'daily'), null);
});

test('dueReminders deja fuera los apagados y los que aún no tocan', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');
  const rows = [
    { id: 'a', active: true, next_run_at: '2026-10-20T11:59:00.000Z' },  // vencido
    { id: 'b', active: true, next_run_at: '2026-10-20T12:00:00.000Z' },  // justo ahora
    { id: 'c', active: true, next_run_at: '2026-10-20T13:00:00.000Z' },  // futuro
    { id: 'd', active: false, next_run_at: '2026-10-19T11:00:00.000Z' }, // apagado
    { id: 'e', active: true, next_run_at: 'basura' }                     // sin fecha
  ];
  assert.deepEqual(dueReminders(rows, now).map(r => r.id), ['a', 'b']);
  assert.deepEqual(dueReminders([], now), []);
  assert.deepEqual(dueReminders(null, now), []);
});

// ==========================================
// 2 · QUÉ SE PUEDE GUARDAR
// ==========================================

test('cleanReminderInput normaliza un recordatorio válido', () => {
  const result = cleanReminderInput({
    title: '  Cita en el médico  ',
    body: '  No se te olvide  ',
    targetUrl: '/calendario',
    recurrence: 'weekly',
    scheduledAt: '2026-10-20T17:00:00.000Z'
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    title: 'Cita en el médico',
    body: 'No se te olvide',
    targetUrl: '/calendario',
    recurrence: 'weekly',
    scheduledAt: '2026-10-20T17:00:00.000Z'
  });
});

test('cleanReminderInput rechaza lo que no debe llegar a un push', () => {
  const base = { title: 't', body: 'b', scheduledAt: '2026-10-20T17:00:00.000Z' };

  // El destino no puede sacar al usuario del hub: una notificación del
  // sistema que abre otro dominio es phishing con nuestra marca.
  assert.equal(cleanReminderInput({ ...base, targetUrl: 'https://ejemplo.com' }).ok, false);
  assert.equal(cleanReminderInput({ ...base, targetUrl: '//ejemplo.com' }).ok, false);
  // Sin destino se asume el inicio.
  assert.equal(cleanReminderInput(base).value.targetUrl, '/');

  assert.equal(cleanReminderInput({ ...base, title: '   ' }).ok, false);
  assert.equal(cleanReminderInput({ ...base, title: 'x'.repeat(101) }).ok, false);
  assert.equal(cleanReminderInput({ ...base, body: '' }).ok, false);
  assert.equal(cleanReminderInput({ ...base, body: 'x'.repeat(501) }).ok, false);
  assert.equal(cleanReminderInput({ ...base, scheduledAt: 'ayer' }).ok, false);
  assert.equal(cleanReminderInput({ ...base, scheduledAt: undefined }).ok, false);

  // Una recurrencia desconocida no rompe: cae a 'once'.
  assert.equal(cleanReminderInput({ ...base, recurrence: 'monthly' }).value.recurrence, 'once');
});

// ==========================================
// 3 · LAS PIEZAS SIGUEN EN SU SITIO
// ==========================================

test('la migración 022 crea las tablas con RLS de admin y permisos de la API', async () => {
  const file = projectPath('sql', '022_push_reminders.sql');
  assert.equal(existsSync(file), true, 'falta sql/022_push_reminders.sql');
  const sql = await readFile(file, 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.push_reminders/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.push_logs/);
  for (const table of ['push_reminders', 'push_logs']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`REVOKE ALL ON public\\.${table} FROM anon`));
    assert.match(sql, new RegExp(`GRANT ALL ON public\\.${table} TO service_role`));
  }
  // Solo el admin lee: la política usa la función autoritativa, no el rol
  // del token ni un USING (true).
  assert.match(sql, /USING \(public\.is_enabled\(\) AND public\.is_admin\(\)\)/);
  assert.doesNotMatch(sql, /USING \(true\)/);
  // El cliente no escribe recordatorios: los dispara el servidor.
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE)[^\n]*TO authenticated/);

  // Como 019: una migración de esquema no puede destruir datos.
  const sinComentario = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(sinComentario, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sinComentario, /\bTRUNCATE\b/i);
  assert.doesNotMatch(sinComentario, /\bDELETE\s+FROM\b/i);
});

test('la API expone los recordatorios solo a admin o al cron', async () => {
  const pushApi = await readFile(projectPath('api', 'push.js'), 'utf8');

  // Acciones nuevas, enrutadas.
  assert.match(pushApi, /case 'reminders':/);
  assert.match(pushApi, /case 'run-reminders':/);
  // La escritura exige sesión de admin (rol en profiles + enabled + correo).
  assert.match(pushApi, /async function requireAdmin\(req, res\)/);
  assert.match(pushApi, /async function isAdminUser\(user\)/);
  assert.match(pushApi, /profile\?\.role === 'admin'/);
  assert.match(pushApi, /enabled !== false/);
  assert.match(pushApi, /email_confirmed_at/);

  // El envío periódico acepta el CRON_SECRET y, sin secreto configurado,
  // cierra en lugar de quedar abierto.
  assert.match(pushApi, /function cronSecretMatches\(req\)/);
  assert.match(pushApi, /if \(!expected\) return false;/);
  assert.match(pushApi, /process\.env\.CRON_SECRET/);

  // El cron diario vacía también los recordatorios vencidos, así que no se
  // quedan muertos si pg_cron no está configurado.
  const send = pushApi.slice(pushApi.indexOf('async function handleSend'));
  assert.match(send, /await runDueReminders\(\)/);
  // Y va ANTES de la ventana horaria del saludo diario: la hora de un
  // recordatorio la elige el admin, no el reloj.
  assert.ok(send.indexOf('runDueReminders()') < send.indexOf('hourInSpain()'),
    'los recordatorios deben procesarse antes del recorte por hora');

  // Se reprograma antes de enviar: dos ejecuciones solapadas no duplican.
  const runner = pushApi.slice(pushApi.indexOf('async function runDueReminders'), pushApi.indexOf('// RUN REMINDERS'));
  assert.ok(runner.indexOf('.from(REMINDERS_TABLE)') < runner.indexOf('deliverReminder(reminder'),
    'el recordatorio se reprograma antes de enviarse');
  assert.match(runner, /\{ active: false, updated_at: stamp \}/, 'los de una sola vez se apagan al enviarse');

  // A una cuenta deshabilitada no se le manda nada.
  assert.match(pushApi, /async function excludeDisabledUsers\(subscriptions\)/);
  assert.match(runner, /excludeDisabledUsers\(all\)/);
});

test('el servicio de recordatorios del cliente no guarda secretos', async () => {
  const service = await readFile(hub('src', 'services', 'reminders.service.js'), 'utf8');

  assert.match(service, /\/api\/push\?action=reminders/);
  assert.match(service, /const \{ data: \{ session \} \} = await supabase\.auth\.getSession\(\)/);
  // En `vite dev` /api/push devuelve el index.html con 200: hay que exigir
  // JSON, o el panel muestra «no hay recordatorios» en vez del motivo real.
  assert.match(service, /const contentType = res\.headers\.get\('content-type'\) \|\| '';/);
  assert.match(service, /if \(!contentType\.includes\('application\/json'\)\)/);
  assert.match(service, /en local \(npm run dev\) esa ruta no existe/);
  assert.match(service, /Authorization: `Bearer \$\{session\.access_token\}`/);
  // Ni claves de servicio ni de VAPID en el cliente.
  assert.doesNotMatch(service, /SERVICE_ROLE|VAPID_PRIVATE|CRON_SECRET/);
  // Las reglas viven en el servidor: aquí no se vuelven a validar.
  assert.doesNotMatch(service, /100\)|500\)/);
});

test('el panel tiene su sección de recordatorios y no duplica la fecha', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

  assert.match(admin, /id: 'recordatorios',\s+icon: UI\.calendar, label: 'Recordatorios'/);
  assert.match(admin, /recordatorios: loadRecordatorios,/);
  assert.match(admin, /recordatorios: {2}.*Avisos programados/);
  assert.match(admin, /async function loadRecordatorios\(\)/);
  // La conversión local↔UTC la hace el servicio: el panel no la reimplementa.
  assert.match(admin, /from '\.\.\/services\/reminders\.service\.js'/);
  assert.doesNotMatch(admin, /getTimezoneOffset/);

  const css = await readFile(hub('src', 'styles', 'admin.css'), 'utf8');
  for (const clase of ['.rem-item', '.rem-actions', '.rem-badge.is-on', '.rem-badge.is-off']) {
    assert.ok(css.includes(clase), `admin.css debe estilizar ${clase}`);
  }
});

test('las dos tablas nuevas quedan documentadas en sql/README.md', async () => {
  const readme = await readFile(projectPath('sql', 'README.md'), 'utf8');
  assert.ok(readme.includes('022_push_reminders.sql'), 'el README de sql/ debe listar la 022');
});
