/* ==========================================
   Tests de contrato — Preferencias de avisos en el servidor (023)

   Lo que se prueba aquí es la promesa central del cambio: que un aviso
   disparado por el SERVIDOR respete lo que la persona ha configurado en su
   perfil (tipo apagado y horario de silencio), y que cuando el silencio
   bloquea todo el envío, la ocurrencia se APLAZA en vez de perderse.

   Capas: la lógica de ventana horaria y reparto de destinatarios (funciones
   puras de api/push.js), y que las piezas sigan en su sitio en la migración,
   la API, el servicio del cliente y el panel.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inQuietHours, splitRecipients, deferUntilFor } from '../api/push.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = (...parts) => path.join(ROOT, ...parts);
const hub = (...parts) => projectPath('personal-hub', ...parts);

const sub = (userId) => ({ userId, endpoint: `https://push.example/${userId}`, keys: {} });
const prefs = (patch = {}) => ({
  daily: true, letters: true, moods: true, reminders: true,
  quietFrom: '23:00', quietTo: '08:00', ...patch
});

// ==========================================
// 1 · VENTANA DE SILENCIO
// ==========================================

test('el silencio nocturno se mide en hora de Madrid, no en UTC', () => {
  // 23:30 en Madrid en invierno (CET, +1) = 22:30 UTC.
  assert.equal(inQuietHours(new Date('2026-01-15T22:30:00.000Z'), '23:00', '08:00'), true);
  // 23:30 en Madrid en verano (CEST, +2) = 21:30 UTC.
  assert.equal(inQuietHours(new Date('2026-07-15T21:30:00.000Z'), '23:00', '08:00'), true);
  // Y 12:00 UTC = 13:00 en Madrid: fuera del silencio en las dos estaciones.
  assert.equal(inQuietHours(new Date('2026-01-15T12:00:00.000Z'), '23:00', '08:00'), false);
  assert.equal(inQuietHours(new Date('2026-07-15T12:00:00.000Z'), '23:00', '08:00'), false);
});

test('una franja que cruza medianoche cubre las dos orillas', () => {
  // 00:30 en Madrid: entró por la noche.
  assert.equal(inQuietHours(new Date('2026-01-15T23:30:00.000Z'), '23:00', '08:00'), true);
  // 07:59 en Madrid: sigue dentro.
  assert.equal(inQuietHours(new Date('2026-01-16T06:59:00.000Z'), '23:00', '08:00'), true);
  // 08:00 en Madrid: el final es EXCLUSIVO, ya puede sonar.
  assert.equal(inQuietHours(new Date('2026-01-16T07:00:00.000Z'), '23:00', '08:00'), false);
  // 22:59: todavía no empieza.
  assert.equal(inQuietHours(new Date('2026-01-15T21:59:00.000Z'), '23:00', '08:00'), false);
});

test('una franja diurna se mide igual', () => {
  assert.equal(inQuietHours(new Date('2026-01-15T13:00:00.000Z'), '14:00', '16:00'), true);
  assert.equal(inQuietHours(new Date('2026-01-15T15:00:00.000Z'), '14:00', '16:00'), false);
  assert.equal(inQuietHours(new Date('2026-01-15T12:00:00.000Z'), '14:00', '16:00'), false);
});

test('una franja inválida no silencia nada', () => {
  const noon = new Date('2026-01-15T12:00:00.000Z');
  // Vacía (desde === hasta) = sin silencio, igual que en el cliente.
  assert.equal(inQuietHours(noon, '08:00', '08:00'), false);
  // Basura o valores ausentes: no se puede afirmar que esté en silencio.
  assert.equal(inQuietHours(noon, '25:99', '08:00'), false);
  assert.equal(inQuietHours(noon, '23:00', '8:00'), false);
  assert.equal(inQuietHours(noon, null, undefined), false);
});

// ==========================================
// 2 · A QUIÉN LE LLEGA
// ==========================================

test('sin preferencias guardadas se entrega a todo el mundo', () => {
  const subs = [sub('a'), sub('b')];
  const { allowed, quiet, off } = splitRecipients(subs, new Map(), new Date(), 'reminders');
  assert.equal(allowed.length, 2);
  assert.equal(quiet.length + off.length, 0);
  // Y un mapa vacío es lo que devuelve una lectura que falla: un fallo de
  // lectura nunca puede dejar a alguien sin avisos.
  assert.equal(splitRecipients(subs, null, new Date(), 'reminders').allowed.length, 2);
});

test('el tipo apagado y el silencio se separan, que no es lo mismo', () => {
  const subs = [sub('ella'), sub('otro')];
  const now = new Date('2026-01-15T22:30:00.000Z'); // 23:30 en Madrid
  const prefsById = new Map([
    ['ella', prefs()],                            // en silencio a esta hora
    ['otro', prefs({ reminders: false })]         // los tiene apagados
  ]);

  const { allowed, quiet, off } = splitRecipients(subs, prefsById, now, 'reminders');
  assert.deepEqual(allowed, []);
  assert.deepEqual(quiet.map(s => s.userId), ['ella']);
  assert.deepEqual(off.map(s => s.userId), ['otro']);
});

test('cada tipo de aviso mira su propio interruptor', () => {
  const subs = [sub('ella')];
  const prefsById = new Map([['ella', prefs({ daily: false, reminders: true })]]);
  const noon = new Date('2026-01-15T12:00:00.000Z');

  const comoRecordatorio = splitRecipients(subs, prefsById, noon, 'reminders');
  assert.deepEqual(comoRecordatorio.allowed.map(s => s.userId), ['ella']);

  const comoDiario = splitRecipients(subs, prefsById, noon, 'daily');
  assert.deepEqual(comoDiario.off.map(s => s.userId), ['ella']);
});

// ==========================================
// 3 · APLAZAR EN VEZ DE PERDER
// ==========================================

test('el aplazamiento apunta al final del silencio vigente', () => {
  // 07:00 en Madrid: el silencio 23:00→08:00 acaba hoy a las 08:00 (07:00 UTC).
  const now = new Date('2026-01-16T06:00:00.000Z');
  const prefsById = new Map([['ella', prefs()]]);
  assert.equal(deferUntilFor([sub('ella')], prefsById, now), '2026-01-16T07:00:00.000Z');
});

test('si el silencio empezó antes de medianoche, espera al día siguiente', () => {
  // 23:30 en Madrid: las 08:00 de hoy ya pasaron, así que termina mañana.
  const now = new Date('2026-01-16T22:30:00.000Z');
  const prefsById = new Map([['ella', prefs()]]);
  assert.equal(deferUntilFor([sub('ella')], prefsById, now), '2026-01-17T07:00:00.000Z');
});

test('se espera a que nadie esté en silencio (el fin más tardío)', () => {
  const now = new Date('2026-01-16T06:00:00.000Z');
  const prefsById = new Map([
    ['a', prefs({ quietTo: '08:00' })], // acaba a las 08:00 (07:00 UTC)
    ['b', prefs({ quietTo: '09:00' })]  // acaba a las 09:00 (08:00 UTC)
  ]);
  assert.equal(deferUntilFor([sub('a'), sub('b')], prefsById, now), '2026-01-16T08:00:00.000Z');
});

test('sin ventana calculable no se aplaza nada', () => {
  assert.equal(deferUntilFor([sub('a')], new Map([['a', prefs({ quietTo: 'basura' })]]), new Date()), null);
  assert.equal(deferUntilFor([], new Map(), new Date()), null);
});

// ==========================================
// 4 · LAS PIEZAS SIGUEN EN SU SITIO
// ==========================================

test('la migración 023 guarda las preferencias con RLS de dueño', async () => {
  const file = projectPath('sql', '023_notification_prefs.sql');
  assert.equal(existsSync(file), true, 'falta sql/023_notification_prefs.sql');
  const sql = await readFile(file, 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notification_prefs/);
  assert.match(sql, /ALTER TABLE public\.notification_prefs ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.notification_prefs FROM anon/);
  assert.match(sql, /GRANT ALL ON public\.notification_prefs TO service_role/);

  // Cada política ata la fila a quien la escribe: sin esto, cualquiera podría
  // apagarle los avisos a la otra persona.
  for (const accion of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    assert.match(sql, new RegExp(`CREATE POLICY "notification_prefs_\\w+_own"[^;]*FOR ${accion}`, 's'),
      `falta la política de ${accion}`);
  }
  assert.match(sql, /user_id = auth\.uid\(\)/);
  assert.match(sql, /public\.is_enabled\(\)/);
  assert.doesNotMatch(sql, /USING \(true\)/);

  // Las horas se guardan como 'HH:MM' y el CHECK impide basura: una hora
  // inválida dejaría el silencio sin efecto o silenciaría sin querer.
  assert.match(sql, /quiet_from ~ '\^\(\[01\]\[0-9\]\|2\[0-3\]\):\[0-5\]\[0-9\]\$'/);
  assert.match(sql, /quiet_to ~ '\^\(\[01\]\[0-9\]\|2\[0-3\]\):\[0-5\]\[0-9\]\$'/);

  const sinComentario = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(sinComentario, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sinComentario, /\bDELETE\s+FROM\b/i);
});

test('el servidor filtra por preferencias y aplaza sin gastar la ocurrencia', async () => {
  const pushApi = await readFile(projectPath('api', 'push.js'), 'utf8');

  assert.match(pushApi, /const PREFS_TABLE = 'notification_prefs';/);
  assert.match(pushApi, /async function loadPrefsByIds\(userIds\)/);
  // Un fallo de lectura devuelve mapa vacío = se entrega (fail open).
  const loader = pushApi.slice(pushApi.indexOf('async function loadPrefsByIds'), pushApi.indexOf('async function runDueReminders'));
  assert.match(loader, /if \(userIds\.length === 0\) return prefsById;/);
  assert.match(loader, /if \(error\) return prefsById;/);

  // El recordatorio y el saludo diario miran su tipo correspondiente.
  assert.match(pushApi, /splitRecipients\(subscriptions, prefsById, now, 'reminders'\)/);
  assert.match(pushApi, /splitRecipients\(allSubscriptions, prefsById, new Date\(\), 'daily'\)/);

  // El aplazamiento va ANTES de reprogramar: si se gastara el turno, un
  // recordatorio de una sola vez que caiga de noche no llegaría nunca.
  const runner = pushApi.slice(pushApi.indexOf('async function runDueReminders'), pushApi.indexOf('// RUN REMINDERS'));
  const iDefer = runner.indexOf('summary.deferred++');
  const iConsume = runner.indexOf("{ active: false, updated_at: stamp }");
  assert.notEqual(iDefer, -1, 'debe existir la rama de aplazamiento');
  assert.ok(iDefer < iConsume, 'se aplaza antes de consumir la ocurrencia');
  assert.match(runner, /const until = deferUntilFor\(quiet, prefsById, now\);/);
  assert.match(runner, /Date\.parse\(until\) > now\.getTime\(\)/, 'no se aplaza a un momento ya pasado');

  // Lo que no se envía también se registra, con su motivo.
  assert.match(pushApi, /\{ sub, reason: 'quiet_hours' \}/);
  assert.match(pushApi, /\{ sub, reason: 'prefs_off' \}/);
  assert.match(pushApi, /status: 'skipped'/);
});

test('la limpieza de caducados no da de baja a quien está en silencio', async () => {
  const pushApi = await readFile(projectPath('api', 'push.js'), 'utf8');
  const send = pushApi.slice(pushApi.indexOf('async function handleSend'));

  // saveSubscriptions borra lo que no esté en la lista: si se le pasara solo
  // la lista de destinatarios de hoy, cada mañana daría de baja a los demás.
  assert.match(send, /await saveSubscriptions\(allSubscriptions\.filter\(sub => !expiredEndpoints\.includes\(sub\.endpoint\)\)\)/);
  assert.doesNotMatch(send, /saveSubscriptions\(validSubscriptions\)/);
  assert.match(send, /const filtered = off\.length \+ \(isAdmin \? 0 : quiet\.length\);/);
});

test('el cliente sube sus ajustes y los une por marca de tiempo', async () => {
  const service = await readFile(hub('src', 'services', 'notifications.service.js'), 'utf8');

  // El tipo nuevo existe y viene activo por defecto.
  assert.match(service, /reminders: true,/);
  assert.match(service, /export async function syncNotifPrefs\(\)/);
  // Sin await: el ajuste local manda al instante y la subida va por detrás.
  assert.match(service, /setUserPref\(NOTIF_SETTINGS_KEY, JSON\.stringify\(next\)\);\s*\n\s*(\/\/[^\n]*\n\s*)*pushNotifPrefs\(next\);/);
  assert.match(service, /from\('notification_prefs'\)\s*\.upsert\(/);
  assert.match(service, /\{ onConflict: 'user_id' \}/);
  // Last-write-wins: la marca local decide si se adopta lo del servidor.
  assert.match(service, /if \(remoteAt > \(Number\(local\.updatedAt\) \|\| 0\)\)/);
  // Subir los ajustes nunca puede romper el ajuste local.
  assert.match(service, /no se pudieron subir los ajustes/);
  // Sin secretos en el cliente.
  assert.doesNotMatch(service, /SERVICE_ROLE|CRON_SECRET|VAPID_PRIVATE/);

  // Y se sincroniza al entrar, ANTES de pasarle el silencio al service worker.
  const app = await readFile(hub('src', 'components', 'App.js'), 'utf8');
  assert.match(app, /syncNotifPrefs\(\)\.finally\(\(\) => syncReminderState\(\)\)/);
});

test('el perfil ofrece el interruptor de recordatorios', async () => {
  const profile = await readFile(hub('src', 'pages', 'Profile.js'), 'utf8');
  assert.match(profile, /id="notifReminders"/);
  assert.match(profile, /\$\{s\.reminders \? 'checked' : ''\}/);
  assert.match(profile, /setNotifSettings\(\{ reminders: e\.target\.checked \}\)/);
  // El texto del silencio tiene que decir la verdad de lo que hace ahora.
  assert.match(profile, /Los recordatorios que caigan ahí esperan a que termine el silencio/);
});

test('el silencio se mide igual en el cliente y en el servidor', async () => {
  const service = await readFile(hub('src', 'services', 'notifications.service.js'), 'utf8');
  const pushApi = await readFile(projectPath('api', 'push.js'), 'utf8');

  // Las dos partes comparten literalmente la comparación de fronteras. Si
  // divergieran, la persona vería un aviso que su perfil dice que no debe
  // sonar —o se perdería uno que sí esperaba— sin ninguna pista de por qué.
  for (const expresion of ['minutes >= from && minutes < to', 'minutes >= from || minutes < to']) {
    assert.ok(service.includes(expresion), `el cliente debe usar "${expresion}"`);
    assert.ok(pushApi.includes(expresion), `la API debe usar "${expresion}"`);
  }
  // Y las dos tratan una franja vacía como «sin silencio».
  assert.match(service, /from === to\) return false;/);
  assert.match(pushApi, /from === to\) return false;/);
});

test('el panel distingue \"no enviado\" de \"falló\"', async () => {
  const admin = await readFile(hub('src', 'pages', 'Admin.js'), 'utf8');
  assert.match(admin, /skipped: log => `no enviado \(/);
  assert.match(admin, /quiet_hours' \? 'horario de silencio' : 'avisos apagados'/);
  assert.match(admin, /const deliveryResult = \(log\) =>/);
});

test('la 023 queda documentada', async () => {
  const sqlReadme = await readFile(projectPath('sql', 'README.md'), 'utf8');
  assert.ok(sqlReadme.includes('023_notification_prefs.sql'), 'sql/README.md debe listar la 023');

  const setup = await readFile(projectPath('SUPABASE-SETUP.md'), 'utf8');
  assert.ok(setup.includes('023_notification_prefs.sql'), 'SUPABASE-SETUP.md debe listar la 023');

  const readme = await readFile(projectPath('README.md'), 'utf8');
  assert.ok(readme.includes('023_notification_prefs.sql'), 'el README debe mencionar la 023');
});
