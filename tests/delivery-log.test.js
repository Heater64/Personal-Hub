/* ==========================================
   Tests de contrato — Destinos de los avisos y registro de entrega (025)

   Dos promesas que se comprueban aquí:

   1. Un aviso abre EL SITIO correcto. El panel tiene secciones y el servidor
      solo acepta las que existen: `?section=` lo escribe un aviso, así que una
      vista inventada no debe llegar al panel ni a la barra del navegador.

   2. «Enviado» no es «entregado». El historial separa lo que el push service
      aceptó de lo que el DISPOSITIVO confirmó, y el panel no puede decir
      «entregado» sin esa confirmación: Web Push no tiene recibo, y «visto» no
      lo sabe nadie.

   Capas: la lógica pura de api/push.js (destinos y payloads), la migración
   025, y que las piezas sigan en su sitio en la API, el service worker, el
   panel y la propia lista de secciones (con paridad cliente/servidor).
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isAllowedNotificationPath,
  cleanReminderInput,
  adminMoodPayload,
  adminNotePayload,
  adminHealthPayload
} from '../api/push.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = (...parts) => path.join(ROOT, ...parts);
const hub = (...parts) => projectPath('personal-hub', ...parts);

const readApi = () => readFile(projectPath('api', 'push.js'), 'utf8');
const readAdmin = () => readFile(hub('src', 'pages', 'Admin.js'), 'utf8');

/** Ids de un bloque del tipo `const NOMBRE = [ { id: 'x' }, { id: 'y' } ];` */
function idsDelBloque(source, marcador) {
  const start = source.indexOf(marcador);
  assert.notEqual(start, -1, `no se encontró ${marcador}`);
  const end = source.indexOf('];', start);
  assert.notEqual(end, -1, `${marcador} no cierra`);
  return [...source.slice(start, end).matchAll(/\bid:\s*'([a-z]+)'/g)].map(m => m[1]);
}

/** Cadenas de un array literal de la API: `const NOMBRE = ['a', 'b'];` */
function cadenasDelArray(source, nombre) {
  const start = source.indexOf(`const ${nombre} = [`);
  assert.notEqual(start, -1, `no se encontró ${nombre}`);
  const end = source.indexOf('];', start);
  return [...source.slice(start, end).matchAll(/'([a-z]+)'/g)].map(m => m[1]);
}

// ==========================================
// 1 · EL SERVIDOR SOLO ACEPTA DESTINOS QUE EXISTEN
// ==========================================

test('una ruta interna normal sigue valiendo como destino', () => {
  // La regla de siempre no cambia: el admin elige a dónde lleva un
  // recordatorio y cualquier ruta de la app vale.
  for (const ruta of ['/', '/calendario', '/sentimientos?day=3', '/openwhen', '/maldia']) {
    assert.equal(isAllowedNotificationPath(ruta), true, `${ruta} debería valer`);
  }
  // La ruta de la app con hash, tal como la escribe el panel.
  assert.equal(isAllowedNotificationPath('/calendario?day=3'), true);
});

test('el panel abre la sección que le pide el aviso', () => {
  assert.equal(isAllowedNotificationPath('/admin'), true, 'el panel sin query abre su sección por defecto');
  assert.equal(isAllowedNotificationPath('/admin?section=moods'), true);
  assert.equal(isAllowedNotificationPath('/admin?section=recordatorios'), true);
  assert.equal(isAllowedNotificationPath('/admin?section=contenido&sub=maldia'), true);
  assert.equal(isAllowedNotificationPath('/admin?section=contenido'), true, 'sin sub, la subsección por defecto');
});

test('una sección inventada no pasa', () => {
  assert.equal(isAllowedNotificationPath('/admin?section=inventada'), false);
  assert.equal(isAllowedNotificationPath('/admin?section='), false);
  // `sub` solo existe dentro de Contenido, y solo con sus valores.
  assert.equal(isAllowedNotificationPath('/admin?section=contenido&sub=inventada'), false);
  assert.equal(isAllowedNotificationPath('/admin?section=moods&sub=maldia'), false);
  // Una sección con basura pegada tampoco.
  assert.equal(isAllowedNotificationPath('/admin?section=moods%00x'), false);
});

test('un destino fuera de la app nunca pasa', () => {
  for (const url of ['https://ejemplo.com', 'http://ejemplo.com', '//ejemplo.com',
    'javascript:alert(1)', 'data:text/html,x', 'admin?section=moods', '']) {
    assert.equal(isAllowedNotificationPath(url), false, `${url} no es una ruta interna`);
  }
  assert.equal(isAllowedNotificationPath(null), false);
  assert.equal(isAllowedNotificationPath(undefined), false);
});

test('el panel de recordatorios usa la comprobación nueva', () => {
  // Con la comprobación vieja (`startsWith('/')`) una sección inventada se
  // guardaba y quedaba un enlace que no abría nada.
  return readApi().then(pushApi => {
    assert.match(pushApi, /if \(!isAllowedNotificationPath\(targetUrl\)\)/);
    assert.doesNotMatch(pushApi, /if \(!targetUrl\.startsWith\('\/'\) \|\| targetUrl\.startsWith\('\/\/'\)\)/);
    // El caso que ya estaba cubierto sigue cubierto.
    assert.equal(cleanReminderInput({
      title: 'x', body: 'y', targetUrl: '/calendario', scheduledAt: '2026-10-20T18:00:00.000Z'
    }).ok, true);
    assert.equal(cleanReminderInput({
      title: 'x', body: 'y', targetUrl: '/admin?section=inventada', scheduledAt: '2026-10-20T18:00:00.000Z'
    }).ok, false);
    assert.equal(cleanReminderInput({
      title: 'x', body: 'y', targetUrl: '/admin?section=moods', scheduledAt: '2026-10-20T18:00:00.000Z'
    }).ok, true);
  });
});

test('cada aviso del admin abre su sitio', () => {
  const mood = adminMoodPayload({ label: 'Triste', emoji: '🥺', score: 2 }, 'mood');
  const cambio = adminMoodPayload({ label: 'Bien', emoji: '😊', score: 4 }, 'mood_change');
  const nota = adminNotePayload('hola');
  const salud = adminHealthPayload({ failed: 1, removed: 0 });

  assert.equal(mood.url, '/admin?section=moods', 'el ánimo se lee en Ánimo');
  assert.equal(cambio.url, mood.url);
  assert.equal(nota.url, '/admin?section=contenido&sub=maldia', 'las notas viven en Contenido → Mal Día');
  assert.equal(salud.url, '/admin?section=recordatorios', 'el historial de envíos vive en Recordatorios');

  // Y la invariante que importa: todo destino que el servidor construye tiene
  // que ser un destino que el servidor acepta.
  for (const alerta of [mood, cambio, nota, salud]) {
    assert.equal(isAllowedNotificationPath(alerta.url), true, `${alerta.url} debe ser un destino válido`);
  }
});

// ==========================================
// 2 · PARIDAD DE LAS SECCIONES (CLIENTE ↔ SERVIDOR)
// ==========================================

test('las secciones del panel y las del servidor son las mismas', async () => {
  const admin = await readAdmin();
  const pushApi = await readApi();

  const seccionesCliente = idsDelBloque(admin, 'const NAV_GROUPS = [');
  const subsCliente = idsDelBloque(admin, 'const CONTENT_SUBS = [');
  const seccionesServidor = cadenasDelArray(pushApi, 'ADMIN_SECTION_IDS');
  const subsServidor = cadenasDelArray(pushApi, 'ADMIN_CONTENT_SUB_IDS');

  assert.ok(seccionesCliente.length >= 8, `secciones leídas del panel: ${seccionesCliente}`);
  assert.deepEqual([...seccionesServidor].sort(), [...seccionesCliente].sort(),
    'una sección nueva del menú debe añadirse también a la lista del servidor');
  assert.deepEqual([...subsServidor].sort(), [...subsCliente].sort(),
    'las subsecciones de Contenido deben coincidir en los dos lados');
});

test('la lista del panel sale del menú, no de una copia', async () => {
  const admin = await readAdmin();
  // Si alguien escribiera la lista a mano, añadir una sección al menú dejaría
  // el deep-link apuntando a una sección que ya no existe.
  assert.match(admin, /export const ADMIN_SECTION_IDS = SECTIONS\.map\(s => s\.id\);/);
  assert.match(admin, /export const ADMIN_CONTENT_SUB_IDS = CONTENT_SUBS\.map\(s => s\.id\);/);
});

// ==========================================
// 3 · EL PANEL ABRE ESA SECCIÓN
// ==========================================

test('el panel lee ?section= al montar y valida contra sus ids', async () => {
  const admin = await readAdmin();
  const link = admin.slice(admin.indexOf('function applyDeepLink'), admin.indexOf('renderDbStatus();'));

  assert.match(link, /router\?\.currentRoute\?\.query/);
  assert.match(link, /if \(ADMIN_SECTION_IDS\.includes\(section\)\) S\.section = section;/);
  assert.match(link, /S\.section === 'contenido' && ADMIN_CONTENT_SUB_IDS\.includes\(sub\)/);
  // Un id desconocido NO cambia nada: manda el defecto del panel.
  assert.doesNotMatch(link, /S\.section = section;(\s*\/\/)?\s*\n\s*}\s*else/);
  // Se aplica ANTES de cargar, o el deep link no serviría de nada.
  const init = admin.indexOf('renderDbStatus();');
  const initBlock = admin.slice(init, admin.indexOf('return page;'));
  assert.ok(initBlock.indexOf('applyDeepLink();') < initBlock.indexOf('loadSection(S.section);'),
    'el deep link se resuelve antes de cargar la sección');
});

// ==========================================
// 4 · LA MIGRACIÓN 025
// ==========================================

test('la 025 añade el token y la confirmación, sin tocar datos', async () => {
  const file = projectPath('sql', '025_push_log_delivery.sql');
  assert.equal(existsSync(file), true, 'falta sql/025_push_log_delivery.sql');
  const sql = await readFile(file, 'utf8');

  assert.match(sql, /ADD COLUMN IF NOT EXISTS delivery_id TEXT/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_push_logs_delivery/);
  // El CHECK llega como NOT VALID: no reventar por una fila antigua, pero
  // cerrar la puerta a estados inventados desde ahora.
  assert.match(sql, /CHECK \(status IN \('queued', 'sent', 'failed', 'skipped'\)\) NOT VALID/);
  assert.match(sql, /EXCEPTION\s*\n\s*WHEN duplicate_object THEN NULL;/);

  const sinComentario = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(sinComentario, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sinComentario, /\bDELETE\s+FROM\b/i);
});

// ==========================================
// 5 · EL ACUSE: DEL DISPOSITIVO AL SERVIDOR
// ==========================================

test('el token viaja en el payload y es distinto por dispositivo', async () => {
  const pushApi = await readApi();
  const payload = pushApi.slice(pushApi.indexOf('function reminderPayload'), pushApi.indexOf('/**\n * Envía un recordatorio'));
  assert.match(payload, /\{ delivery: deliveryId \}/);

  const reminder = pushApi.slice(pushApi.indexOf('async function deliverReminder'), pushApi.indexOf('/**\n * Preferencias por usuario'));
  // Un token por endpoint, generado ANTES de enviar: si se generara después,
  // el payload ya habría salido sin él y el acuse no tendría a qué referirse.
  assert.match(reminder, /for \(const sub of subscriptions\) deliveries\.set\(sub\.endpoint, randomUUID\(\)\);/);
  assert.match(reminder, /\(sub\) => reminderPayload\(reminder, deliveries\.get\(sub\.endpoint\)\)/);
  assert.match(reminder, /delivery_id: deliveries\.get\(sub\.endpoint\)/);
  // El envío acepta un payload por destinatario, sin romper el caso de cadena.
  assert.match(pushApi, /const payloadFor = typeof payload === 'function' \? payload : \(\) => payload;/);
  assert.match(pushApi, /payloadFor\(sub\)/);
});

test('la fila del historial existe ANTES de que el aviso salga', async () => {
  const pushApi = await readApi();
  const reminder = pushApi.slice(pushApi.indexOf('async function deliverReminder'), pushApi.indexOf('/**\n * Preferencias por usuario'));

  // El acuse llega en cuanto el push se muestra. Si la fila se escribiera
  // después del envío —como hacía la primera versión de esto— el acuse no
  // encontraría nada que marcar y la confirmación se perdería SIEMPRE, sin
  // ningún error visible. Por eso se registra primero, en 'queued'.
  const iLog = reminder.indexOf('await logReminderPush([');
  const iSend = reminder.indexOf('await deliverPush(');
  assert.notEqual(iLog, -1, 'debe registrar el historial');
  assert.notEqual(iSend, -1, 'debe enviar');
  assert.ok(iLog < iSend, 'se registra antes de enviar');
  assert.match(reminder, /status: 'queued'/);
  // El registro de después existe SOLO como camino antiguo, y solo si el
  // previo falló: es la red de seguridad, no el camino normal.
  assert.match(reminder, /if \(!registroPrevio\) await logReminderPush\(entries, \{ allowLegacy: true \}\);/);
  assert.match(reminder, /registroPrevio\s*\n?\s*\? settleDelivery\(deliveries\.get\(sub\.endpoint\), failure\)/);
});

test('el código se puede desplegar antes de aplicar la 025', async () => {
  const pushApi = await readApi();
  const log = pushApi.slice(pushApi.indexOf('async function logReminderPush'), pushApi.indexOf('async function deliverReminder'));

  // Desplegar antes del SQL no puede vaciar el historial: sin la columna del
  // token se registra sin él, que es como se hacía antes de esta migración.
  assert.match(log, /if \(allowLegacy && error\.code === '42703'\)/);
  assert.match(log, /delete copia\.delivery_id;/);
  assert.match(log, /const \{ error: retryError \} = await supabase\.from\(LOGS_TABLE\)\.insert\(sinToken\);/);
  // Y devuelve si escribió, porque el registro previo al envío solo sirve si
  // de verdad quedó guardado (si no, el acuse no tendría a qué referirse).
  assert.match(log, /if \(!error\) return true;/);
  assert.match(log, /if \(entries\.length === 0\) return true;/);

  // Lo mismo al leer el historial en el panel.
  assert.match(pushApi, /if \(logsError\?\.code === '42703'\) \{/);
  assert.match(pushApi, /\.select\('reminder_id, status, error, sent_at'\)/);
});

test('cada envío cierra SU fila con el resultado real', async () => {
  const pushApi = await readApi();
  const settle = pushApi.slice(pushApi.indexOf('async function settleDelivery'), pushApi.indexOf('/**\n * Preferencias por usuario'));

  assert.match(settle, /\.update\(\{\s*\n\s*status: failure \? 'failed' : 'sent',/);
  assert.match(settle, /\.eq\('delivery_id', deliveryId\)/);
  // Un fallo al escribir el resultado no puede tumbar el envío.
  assert.match(settle, /no se pudo cerrar el registro del envío/);
  // Y se espera al resultado de cada dispositivo antes de seguir.
  assert.match(pushApi, /if \(onResult\) await onResult\(sub, null\);/);
});

test('el acuse solo marca la fila de ese token, y una sola vez', async () => {
  const pushApi = await readApi();
  const ack = pushApi.slice(pushApi.indexOf('async function handleAck'), pushApi.indexOf('// ==========================================\n// NOTIFY ADMIN'));

  // Sin token con forma de UUID no se toca la base: es la única credencial.
  assert.match(pushApi, /const UUID_RE = \/\^\[0-9a-f\]\{8\}/);
  assert.match(ack, /if \(!UUID_RE\.test\(delivery\)\)/);
  assert.match(ack, /\.eq\('delivery_id', delivery\)/);
  // Idempotente: un segundo acuse del mismo dispositivo no cambia nada.
  assert.match(ack, /\.is\('delivered_at', null\)/);
  // Se marca la hora del servidor, no la que mande el cliente.
  assert.match(ack, /update\(\{ delivered_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.doesNotMatch(ack, /req\.body\?\.(delivered_at|at|timestamp)/);
  // Sin la 025 aplicada, 503 con la instrucción en vez de un 500 opaco.
  assert.match(pushApi, /function missingDeliveryColumns\(res, err\)/);
  assert.match(pushApi, /if \(missingDeliveryColumns\(res, err\) \|\| missingRemindersTable\(res, err\)\) return;/);
  // Y está enrutada como escritura.
  assert.match(pushApi, /case 'ack':\s*\n\s*return await handleAck\(req, res\);/);
});

test('el service worker confirma lo que recibe', async () => {
  const sw = await readFile(hub('public', 'sw.js'), 'utf8');
  assert.match(sw, /function ackDelivery\(deliveryId\)/);
  assert.match(sw, /fetch\('\/api\/push\?action=ack'/);
  assert.match(sw, /body: JSON\.stringify\(\{ delivery: deliveryId \}\)/);
  // Se confirma DESPUÉS de mostrar: si el aviso no llegó a pintarse, no se
  // puede afirmar que se entregó.
  assert.match(sw, /\}\)\(\)\.then\(\(\) => ackDelivery\(payload\.delivery\)\)/);
  // Un token ausente o no textual no dispara una petición inútil.
  assert.match(sw, /if \(typeof deliveryId !== 'string' \|\| !deliveryId\) return Promise\.resolve\(\);/);
});

// ==========================================
// 6 · EL HISTORIAL DICE LA VERDAD
// ==========================================

test('«enviado» no se lee como «entregado» en el panel', async () => {
  const admin = await readAdmin();
  const bloque = admin.slice(admin.indexOf('const DELIVERY_RESULT = {'), admin.indexOf('const deliveryResult ='));

  assert.ok(!/sent:\s*\(\)\s*=>\s*'entregado'/.test(bloque),
    'llamar «entregado» a un envío aceptado es una promesa que la base no puede cumplir');
  assert.match(bloque, /delivered: \(\) => 'entregado al dispositivo'/);
  assert.match(bloque, /sent: \(\) => 'enviado \(sin confirmación del dispositivo\)'/);
  // El estado transitorio también se explica en vez de salir en crudo.
  assert.match(bloque, /queued: \(\) => 'en curso \(sin resultado todavía\)'/);

  // «Entregado» exige la confirmación del dispositivo, no el estado del envío.
  assert.match(admin, /const deliveryResult = \(log\) => \(log\?\.delivered_at/);
  // Y el panel pide la columna nueva, o nunca sabría que hay confirmación.
  assert.match(await readApi(), /\.select\('reminder_id, status, error, sent_at, delivered_at'\)/);
});

test('el historial no promete «visto»', async () => {
  const sql = await readFile(projectPath('sql', '025_push_log_delivery.sql'), 'utf8');
  // Ninguna COLUMNA así: el comentario que explica por qué no existe sí lo
  // menciona, y eso es justo lo que queremos que se lea.
  const definiciones = sql.split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(definiciones, /seen_at|read_at/i);
  const admin = await readAdmin();
  assert.doesNotMatch(admin, /'visto'|'leído'|'leido'/);
});

// ==========================================
// 7 · DOCUMENTACIÓN
// ==========================================

test('la 025 y los destinos quedan documentados', async () => {
  const sqlReadme = await readFile(projectPath('sql', 'README.md'), 'utf8');
  assert.ok(sqlReadme.includes('025_push_log_delivery.sql'), 'sql/README.md debe listar la 025');

  const readme = await readFile(projectPath('README.md'), 'utf8');
  assert.ok(readme.includes('025_push_log_delivery.sql'), 'el README debe mencionar la 025');
  assert.ok(/entregado al dispositivo/i.test(readme), 'el README debe explicar los tres estados');

  const setup = await readFile(projectPath('SUPABASE-SETUP.md'), 'utf8');
  assert.ok(setup.includes('025_push_log_delivery.sql'), 'SUPABASE-SETUP.md debe listar la 025');
});
