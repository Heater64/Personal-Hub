/* ==========================================
   Tests de contrato — Avisos del admin (024)

   Lo que se prueba aquí es la separación de públicos que pide el hub:
   ella recibe CONTENIDO, el admin recibe SEGUIMIENTO. Y lo que hace
   utilizable ese seguimiento: que distinga un mal día de un «Bien», que
   una corrección rápida no haga sonar su teléfono, y que el admin pueda
   apagar cada clase por separado desde sus propias preferencias.

   Capas: las funciones puras de api/push.js (payloads y umbrales), la
   migración 024, y que las piezas sigan en su sitio en la API, el service
   worker, el servicio del cliente, el store, la página y el perfil.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADMIN_BAD_SCORE,
  isBadDayMood,
  adminAlertPrefFor,
  adminMoodPayload,
  adminNotePayload,
  adminHealthPayload
} from '../api/push.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = (...parts) => path.join(ROOT, ...parts);
const hub = (...parts) => projectPath('personal-hub', ...parts);

const readApi = () => readFile(projectPath('api', 'push.js'), 'utf8');
const readService = () => readFile(hub('src', 'services', 'notifications.service.js'), 'utf8');

// ==========================================
// 1 · MAL DÍA: QUÉ LO ES Y QUÉ NO
// ==========================================

test('el umbral de mal día cubre los tres estados bajos del catálogo', () => {
  // Catálogo vigente (src/data/moods.data.js): enfadada 0, preocupada 1,
  // triste 2, carino 3, bien 4.
  assert.equal(ADMIN_BAD_SCORE, 2);
  for (const score of [0, 1, 2]) {
    assert.equal(isBadDayMood(score), true, `score ${score} debería pedir compañía`);
  }
  for (const score of [3, 4]) {
    assert.equal(isBadDayMood(score), false, `score ${score} no es un mal día`);
  }
});

test('un score que no es un número no se interpreta como mal día', () => {
  // Un dato corrupto («mal» en lugar de 2) no puede disparar una alarma de
  // emergencia: se trata como un ánimo cualquiera.
  assert.equal(isBadDayMood(undefined), false);
  assert.equal(isBadDayMood(null), false);
  assert.equal(isBadDayMood('mal'), false);
  assert.equal(isBadDayMood(NaN), false);
  // Pero el número en texto sí vale: la fila lo guarda como entero.
  assert.equal(isBadDayMood('1'), true);
});

// ==========================================
// 2 · TRES TEXTOS DISTINTOS PARA TRES COSAS DISTINTAS
// ==========================================

test('un ánimo normal avisa sin alarma', () => {
  const alert = adminMoodPayload({ label: 'Bien', emoji: '😊', score: 4 }, 'mood');
  assert.equal(alert.tag, 'admin-mood');
  assert.match(alert.title, /Bien/);
  assert.equal(alert.requireInteraction, undefined, 'un día bueno no se queda pegado en pantalla');
  // Enlace hondo a la sección donde se lee el ánimo (el detalle y la lista
  // blanca de destinos se prueban en tests/delivery-log.test.js).
  assert.equal(alert.url, '/admin?section=moods');
});

test('un mal día se avisa destacado y no se borra solo', () => {
  const bad = adminMoodPayload({ label: 'Triste', emoji: '🥺', score: 2 }, 'mood');
  const good = adminMoodPayload({ label: 'Bien', emoji: '😊', score: 4 }, 'mood');

  assert.match(bad.title, /Triste/);
  assert.match(bad.title, /acompañar/);
  assert.match(bad.body, /mal día/);
  assert.equal(bad.requireInteraction, true, 'debe quedarse hasta que se descarte');
  // Tag propio: si compartiera el de un ánimo normal, un «Bien» posterior lo
  // reemplazaría en el móvil y el admin no llegaría a ver que hubo un mal día.
  assert.notEqual(bad.tag, good.tag);
});

test('un cambio de ánimo dice que lo anterior ya no vale y cuál es el nuevo', () => {
  const cambio = adminMoodPayload({ label: 'Enfadada', emoji: '😡', score: 0 }, 'mood_change');
  assert.equal(cambio.tag, 'admin-mood', 'comparte tag con el aviso normal para reemplazarlo');
  assert.match(cambio.title, /ha cambiado/);
  assert.match(cambio.body, /ya no es su estado actual/);
  // El estado actual va escrito, no solo implícito en el título.
  assert.match(cambio.body, /«Enfadada»/);
});

test('una corrección rápida se anuncia con el estado nuevo', () => {
  const update = adminMoodPayload({ label: 'Preocupada', emoji: '🥺', score: 1 }, 'mood_update');
  assert.equal(update.tag, 'admin-mood');
  assert.match(update.title, /Preocupada/);
  assert.match(update.title, /actualizado/);
  assert.match(update.body, /«Preocupada»/);
  assert.equal(update.url, '/admin?section=moods');
});

test('el aviso normal también escribe el estado en el cuerpo', () => {
  const alert = adminMoodPayload({ label: 'Bien', emoji: '😊', score: 4 }, 'mood');
  assert.match(alert.body, /«Bien»/);
});

// ==========================================
// 3 · NOTA Y AVISO TÉCNICO
// ==========================================

test('la nota va recortada y sin saltos de línea', () => {
  const alert = adminNotePayload('Hola,\n\n  hoy ha sido un día raro   pero estoy mejor. ');
  assert.equal(alert.tag, 'admin-note');
  assert.equal(alert.body, 'Hola, hoy ha sido un día raro pero estoy mejor.');
  assert.equal(alert.requireInteraction, true);
});

test('una nota enorme se corta con puntos suspensivos', () => {
  const alert = adminNotePayload('a'.repeat(400));
  assert.equal(alert.body.length, 158); // 157 + '…'
  assert.ok(alert.body.endsWith('…'));
  assert.ok(!alert.body.includes('\n'));
});

test('sin texto, la nota sigue teniendo un mensaje legible', () => {
  assert.match(adminNotePayload('').body, /nota en Mal Día/);
  assert.match(adminNotePayload(null).body, /nota en Mal Día/);
});

test('el aviso técnico cuenta solo lo que falló', () => {
  const soloFallos = adminHealthPayload({ failed: 2, removed: 0, sent: 5 });
  assert.match(soloFallos.title, /técnico/i);
  assert.equal(soloFallos.body, '2 envíos fallidos. Revisa los recordatorios en el panel.');
  assert.equal(soloFallos.tag, 'admin-health');

  const soloBajas = adminHealthPayload({ failed: 0, removed: 1 });
  assert.equal(soloBajas.body, '1 dispositivo sin suscripción. Revisa los recordatorios en el panel.');

  const ambos = adminHealthPayload({ failed: 1, removed: 3 });
  assert.match(ambos.body, /^1 envío fallido · 3 dispositivos sin suscripción\./);
  assert.ok(!/0 /.test(ambos.body), 'un recuento a cero no se cuenta');
});

// ==========================================
// 4 · CADA CLASE MIRA SU INTERRUPTOR
// ==========================================

test('cada clase de aviso tiene su columna de preferencias', () => {
  assert.equal(adminAlertPrefFor('mood'), 'adminMood');
  assert.equal(adminAlertPrefFor('mood_update'), 'adminMood');
  assert.equal(adminAlertPrefFor('mood_change'), 'adminMoodChanges');
  assert.equal(adminAlertPrefFor('note'), 'adminNotes');
  assert.equal(adminAlertPrefFor('health'), 'adminHealth');
  assert.equal(adminAlertPrefFor('inventada'), null);
});

// ==========================================
// 5 · LA MIGRACIÓN 024
// ==========================================

test('la 024 añade las cuatro columnas, activas y de forma idempotente', async () => {
  const file = projectPath('sql', '024_admin_alerts.sql');
  assert.equal(existsSync(file), true, 'falta sql/024_admin_alerts.sql');
  const sql = await readFile(file, 'utf8');

  for (const columna of ['admin_mood', 'admin_mood_changes', 'admin_notes', 'admin_health']) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${columna} BOOLEAN NOT NULL DEFAULT TRUE`),
      `falta la columna ${columna}`);
  }
  // Reutiliza las políticas de 023 (son por fila): no reescribe RLS.
  assert.match(sql, /ALTER TABLE public\.notification_prefs/);
  assert.doesNotMatch(sql, /CREATE POLICY/);
  assert.doesNotMatch(sql, /USING \(true\)/);

  // Como el resto de migraciones: no borra datos.
  const sinComentario = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(sinComentario, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sinComentario, /\bDELETE\s+FROM\b/i);
});

// ==========================================
// 6 · EL SERVIDOR: CONTENIDO DE LA BASE, INTERRUPTOR DEL ADMIN
// ==========================================

test('el servidor lee el contenido de la base y no del cuerpo', async () => {
  const pushApi = await readApi();
  const handler = pushApi.slice(
    pushApi.indexOf('async function handleNotifyAdmin'),
    pushApi.indexOf('async function lastMaldiaNote')
  );

  // La clase viene del cliente, pero con lista blanca.
  assert.match(pushApi, /const ADMIN_ALERT_KINDS = \['mood', 'mood_update', 'mood_change', 'note', 'health'\];/);
  assert.match(handler, /ADMIN_ALERT_KINDS\.includes\(req\.body\?\.kind\) \? req\.body\.kind : 'mood'/);
  // El texto lo pone el servidor leyendo la fila del ánimo y la última nota.
  assert.match(handler, /adminMoodPayload\(mood, kind\)/);
  assert.match(handler, /lastMaldiaNote\(supabase, user\.id\)/);
  assert.match(pushApi, /\.eq\('type', MALDIA_NOTES_TYPE\)/);
  assert.doesNotMatch(handler, /req\.body\?\.(text|title|body)/, 'el aviso no repite lo que diga el cuerpo');
  // El admin no se avisa a sí mismo, y su propio aviso no lleva su contenido.
  assert.match(handler, /profile\?\.role === 'admin'\) \{\s*\n\s*return res\.status\(200\)\.json\(\{ success: true, sent: 0, skipped: true, reason: 'Admin event' \}\)/);
});

test('una corrección rápida también se envía, no se descarta', async () => {
  const pushApi = await readApi();
  const handler = pushApi.slice(
    pushApi.indexOf('async function handleNotifyAdmin'),
    pushApi.indexOf('async function lastMaldiaNote')
  );
  // Se pidió avisar de CADA estado, también de la corrección: si se
  // silenciara, el admin se quedaría con el ánimo viejo en la cabeza.
  assert.doesNotMatch(handler, /kind === 'mood_update' && !isBadDayMood/);
  assert.doesNotMatch(handler, /Routine update/);
  assert.match(handler, /alert = adminMoodPayload\(mood, kind\);/);
});

test('el aviso del admin respeta SUS preferencias, y el silencio no lo descarta', async () => {
  const pushApi = await readApi();
  const handler = pushApi.slice(
    pushApi.indexOf('async function handleNotifyAdmin'),
    pushApi.indexOf('async function lastMaldiaNote')
  );

  assert.match(handler, /splitRecipients\(\s*\n?\s*adminSubscriptions, prefsById, new Date\(\), adminAlertPrefFor\(kind\)\s*\n?\s*\)/);
  // La clase apagada se cuenta y se deja fuera.
  assert.match(handler, /const \{ allowed, quiet, off \} = splitRecipients/);
  assert.match(handler, /filtered: off\.length/);
  // El silencio, en cambio, se incluye: el evento ya ocurrió y el service
  // worker lo muestra en silencio. Descartarlo aquí lo perdería para siempre.
  assert.match(handler, /const recipients = \[\.\.\.allowed, \.\.\.quiet\];/);

  // Y las columnas nuevas se leen con el resto.
  const loader = pushApi.slice(pushApi.indexOf('async function loadPrefsByIds'), pushApi.indexOf('async function runDueReminders'));
  for (const columna of ['admin_mood', 'admin_mood_changes', 'admin_notes', 'admin_health']) {
    assert.match(loader, new RegExp(columna));
  }
  for (const clave of ['adminMood', 'adminMoodChanges', 'adminNotes', 'adminHealth']) {
    assert.match(loader, new RegExp(`${clave}: row\\.`));
  }
  // Un fallo de lectura sigue entregando (fail open), como el resto de 023.
  assert.match(loader, /if \(error\) return prefsById;/);
});

test('el aviso técnico sale de los fallos del envío, y nunca lo tumba', async () => {
  const pushApi = await readApi();
  const health = pushApi.slice(
    pushApi.indexOf('async function notifyAdminsOfHealth'),
    pushApi.indexOf('/** Envía el mismo payload a cada suscripción')
  );
  assert.ok(health.length > 200, 'no se pudo aislar notifyAdminsOfHealth');

  assert.match(health, /if \(failed === 0 && removed === 0\) return null;/);
  assert.match(health, /adminAlertPrefFor\('health'\)/);
  assert.match(health, /catch \(err\) \{/);
  assert.match(health, /console\.warn\('\[api\/push\] no se pudo avisar de los fallos:'/);

  // Se dispara desde los dos sitios que pueden fallar: el cron de
  // recordatorios y el saludo diario.
  assert.match(pushApi, /await notifyAdminsOfHealth\(summary\);/);
  assert.match(pushApi, /await notifyAdminsOfHealth\(\{ failed: results\.failed, removed: results\.removed \}\);/);
});

// ==========================================
// 7 · EL SERVICE WORKER SILENCIA TODOS LOS AVISOS DEL ADMIN
// ==========================================

test('el silencio del dispositivo cubre todos los tags del admin', async () => {
  const sw = await readFile(hub('public', 'sw.js'), 'utf8');
  // Antes solo miraba 'admin-mood': un aviso de nota o técnico habría sonado
  // en mitad del silencio nocturno que el admin sí configuró.
  assert.match(sw, /String\(payload\.tag \|\| ''\)\.startsWith\('admin-'\)/);
  assert.doesNotMatch(sw, /payload\.tag === 'admin-mood'/);
  assert.match(sw, /options\.silent = true;/);

  // Y los tags que produce el servidor son todos `admin-*`.
  const pushApi = await readApi();
  const tags = [...pushApi.matchAll(/tag: '(admin-[a-z-]+)'/g)].map(m => m[1]);
  assert.ok(tags.length >= 4, 'deberían existir los cuatro tags del admin');
  for (const tag of tags) {
    assert.ok(tag.startsWith('admin-'), `el tag "${tag}" debe entrar en la regla del service worker`);
  }
});

// ==========================================
// 8 · EL CLIENTE: ENVIAR LA CLASE Y RECORDAR EL INTERRUPTOR
// ==========================================

test('el cliente manda la clase del evento y no el texto', async () => {
  const service = await readService();
  assert.match(service, /export async function notifyAdmin\(kind = 'mood'\)/);
  assert.match(service, /body: JSON\.stringify\(\{ kind \}\)/);
  assert.match(service, /'Content-Type': 'application\/json'/);
  assert.match(service, /export function notifyAdminOfMood\(kind = 'mood'\)/);
  assert.match(service, /export function notifyAdminOfNote\(\)/);
  // Fire and forget hacia el servidor: un fallo no rompe lo que ella acaba de hacer.
  assert.match(service, /\[notif\] Could not notify admin/);
  assert.doesNotMatch(service, /SERVICE_ROLE|CRON_SECRET|VAPID_PRIVATE/);

  // Los interruptores del admin viajan al servidor con los suyos: se suben al
  // cambiarlos y se leen al entrar, como el resto de preferencias.
  const pares = [
    ['admin_mood', 'adminMood'],
    ['admin_mood_changes', 'adminMoodChanges'],
    ['admin_notes', 'adminNotes'],
    ['admin_health', 'adminHealth']
  ];
  const selector = service.slice(service.indexOf(".select('daily"), service.indexOf("updated_at')"));
  for (const [columna, clave] of pares) {
    assert.match(service, new RegExp(`${columna}: settings\\.${clave} !== false`), `${columna} debe subirse`);
    assert.match(service, new RegExp(`${clave}: data\\.${columna} !== false`), `${columna} debe adoptarse del servidor`);
    assert.ok(selector.includes(columna), `${columna} debe pedirse en el SELECT`);
  }
});

test('las claves del cliente y las columnas del servidor se llaman igual', async () => {
  const service = await readService();
  // Si una parte renombrara su clave, el interruptor del admin dejaría de
  // apagar nada y su teléfono sonaría igual: sin ninguna pista de por qué.
  for (const clave of ['adminMood', 'adminMoodChanges', 'adminNotes', 'adminHealth']) {
    assert.ok(service.includes(clave), `el cliente debe usar la clave ${clave}`);
    assert.ok(adminAlertPrefFor(
      { adminMood: 'mood', adminMoodChanges: 'mood_change', adminNotes: 'note', adminHealth: 'health' }[clave]
    ) === clave, `el servidor debe resolver ${clave}`);
  }
});

test('el store distingue registrarlo, corregirlo y cambiarlo', async () => {
  const store = await readFile(hub('src', 'stores', 'mood.store.js'), 'utf8');
  assert.match(store, /const hadStates = states\.length > 0;/);
  assert.match(store, /const adminKind = fresh \? 'mood_update' : \(hadStates \? 'mood_change' : 'mood'\);/);
  assert.match(store, /notifyAdminOfMood\(adminKind\)/);
});

test('la nota solo avisa si llegó al servidor', async () => {
  const maldia = await readFile(hub('src', 'pages', 'MalDia.js'), 'utf8');
  assert.match(maldia, /import \{ notifyAdminOfNote \} from '\.\.\/services\/notifications\.service\.js';/);
  // Avisar de una nota que se quedó en el dispositivo mandaría al admin a una
  // lista donde todavía no está.
  assert.match(maldia, /if \(synced\) notifyAdminOfNote\(\)\.catch\(/);
});

test('el perfil ofrece los cuatro interruptores, y solo al admin', async () => {
  const profile = await readFile(hub('src', 'pages', 'Profile.js'), 'utf8');
  assert.match(profile, /\$\{userStore\.isAdmin \? `/, 'la sección debe ser exclusiva del admin');

  for (const [id, clave] of [
    ['notifAdminMood', 'adminMood'],
    ['notifAdminMoodChanges', 'adminMoodChanges'],
    ['notifAdminNotes', 'adminNotes'],
    ['notifAdminHealth', 'adminHealth']
  ]) {
    assert.match(profile, new RegExp(`id="${id}"`), `falta el interruptor ${id}`);
    assert.match(profile, new RegExp(`\\$\\{s\\.${clave} \\? 'checked' : ''\\}`), `${id} debe venir de los ajustes`);
    assert.match(profile, new RegExp(`setNotifSettings\\(\\{ \\[key\\]: e\\.target\\.checked \\}\\)`));
  }
  // Los cuatro se enlazan desde una lista, no con cuatro copias del mismo código.
  assert.match(profile, /const ADMIN_TOGGLES = \[/);
  for (const clave of ['adminMood', 'adminMoodChanges', 'adminNotes', 'adminHealth']) {
    assert.ok(profile.includes(`'${clave}'`), `la lista de interruptores debe incluir ${clave}`);
  }
});

// ==========================================
// 9 · LA 024 QUEDA DOCUMENTADA
// ==========================================

test('la 024 queda documentada en las tres guías', async () => {
  const sqlReadme = await readFile(projectPath('sql', 'README.md'), 'utf8');
  assert.ok(sqlReadme.includes('024_admin_alerts.sql'), 'sql/README.md debe listar la 024');

  const readme = await readFile(projectPath('README.md'), 'utf8');
  assert.ok(readme.includes('024_admin_alerts.sql'), 'el README debe mencionar la 024');

  const setup = await readFile(projectPath('SUPABASE-SETUP.md'), 'utf8');
  assert.ok(setup.includes('024_admin_alerts.sql'), 'SUPABASE-SETUP.md debe listar la 024');
});
