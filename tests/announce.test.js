/* ==========================================
   Tests de contrato — Contenido nuevo y dirección de los avisos

   Tres cosas que tienen que cumplirse siempre:

   1. Cuando el admin publica contenido, ella recibe un push con el texto y
      el destino correctos (la dirección admin → ella).
   2. Su actividad (ánimo, notas) va SOLO al admin: nunca se le devuelve a
      ella como si fuera seguimiento.
   3. Cada interruptor apaga lo que dice apagar, también el «Recordatorio
      diario» sobre el saludo matinal y el horario de silencio en el servidor.

   Capas: las funciones puras de api/push.js, el cableado de la API, el
   guardado del panel (db.service), el service worker y el servicio cliente.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { announcePayload, ANNOUNCE_KINDS, isAllowedNotificationPath } from '../api/push.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = (...parts) => path.join(ROOT, ...parts);
const hub = (...parts) => projectPath('personal-hub', ...parts);

const readApi = () => readFile(projectPath('api', 'push.js'), 'utf8');
const readClient = () => readFile(hub('src', 'services', 'announce.service.js'), 'utf8');
const readDb = () => readFile(hub('src', 'services', 'db.service.js'), 'utf8');

// ==========================================
// 1 · EL TEXTO DEL AVISO
// ==========================================

test('una carta nueva se anuncia en singular y varias en plural', () => {
  const una = announcePayload('openwhen', { count: 1 });
  assert.equal(una.title, 'Nueva carta en Open When 💌');
  assert.equal(una.url, '/openwhen');
  assert.match(una.body, /una carta/);

  const tres = announcePayload('openwhen', { count: 3 });
  assert.equal(tres.title, '3 cartas nuevas en Open When 💌');
  assert.match(tres.body, /cartas/);
});

test('una sorpresa del calendario enlaza al calendario', () => {
  const una = announcePayload('calendar', { count: 1 });
  assert.equal(una.title, 'Hay una sorpresa nueva 🎁');
  assert.equal(una.url, '/calendario');

  const dos = announcePayload('calendar', { count: 2 });
  assert.match(dos.body, /2 regalos nuevos/);
});

test('una razón nueva se anuncia y enlaza a Razones', () => {
  const una = announcePayload('reason');
  assert.equal(una.title, 'Razón nueva 💛');
  assert.equal(una.url, '/razones');
  assert.match(announcePayload('reason', { count: 4 }).title, /4 razones nuevas/);
});

test('el contenido genérico lleva el nombre de la sección', () => {
  const alert = announcePayload('content', { section: '  Canciones  ', url: '/canciones' });
  assert.equal(alert.title, 'Contenido nuevo: Canciones');
  assert.equal(alert.url, '/canciones');
});

test('el destino de un aviso genérico no puede salir de la app', () => {
  // La lista blanca es la misma que la de los recordatorios: sin ella, un
  // aviso podría abrir otro dominio con la marca del hub (phishing).
  assert.equal(announcePayload('content', { url: 'https://evil.example' }).url, '/');
  assert.equal(announcePayload('content', { url: '//evil.example' }).url, '/');
  assert.equal(announcePayload('content', { section: 'Series', url: '/admin?section=inventada' }).url, '/');
  assert.equal(isAllowedNotificationPath('/series'), true);
});

test('la sección se recorta y pierde los caracteres de control', () => {
  const alert = announcePayload('content', { section: `Canciones\u0000\n${'x'.repeat(80)}` });
  assert.ok(alert.title.length <= 'Contenido nuevo: '.length + 40);
  assert.ok(!alert.title.includes('\u0000'));
  assert.ok(!alert.title.includes('\n'));
});

test('un recuento inválido no rompe el texto', () => {
  for (const count of [0, -3, 'muchas', null, undefined, NaN]) {
    assert.match(announcePayload('reason', { count }).title, /Razón nueva|razones nuevas/);
  }
});

// ==========================================
// 2 · LA API: SOLO EL ADMIN, SOLO HACIA ELLA
// ==========================================

test('la API expone announce y exige admin', async () => {
  const api = await readApi();
  assert.match(api, /case 'announce':\s*\n\s*return await handleAnnounce\(req, res\);/);
  assert.match(api, /ANNOUNCE_KINDS = \['openwhen', 'calendar', 'reason', 'content'\]/);

  const handler = api.slice(
    api.indexOf('async function handleAnnounce'),
    api.indexOf('async function lastMaldiaNote')
  );
  assert.match(handler, /const admin = await requireAdmin\(req, res\);/);
  assert.match(handler, /if \(!admin\) return;/);
  // El tipo viene de una lista cerrada; el texto, del servidor.
  assert.match(handler, /ANNOUNCE_KINDS\.includes\(req\.body\?\.kind\)/);
  assert.match(handler, /announcePayload\(kind, \{/);
  assert.doesNotMatch(handler, /req\.body\?\.title|req\.body\?\.body/);
});

test('el aviso de contenido no se manda a los admins', async () => {
  const api = await readApi();
  const handler = api.slice(
    api.indexOf('async function handleAnnounce'),
    api.indexOf('async function lastMaldiaNote')
  );
  // Los admins ya han visto el contenido al publicarlo.
  assert.match(handler, /const recipients = all\.filter\(sub => !adminIds\.has\(String\(sub\.userId\)\)\);/);
  // Y las cuentas deshabilitadas tampoco lo reciben.
  assert.match(handler, /await excludeDisabledUsers\(await getSubscriptions\(\)\)/);
});

test('cada contenido se gobierna con su interruptor y respeta el silencio', async () => {
  const api = await readApi();
  const handler = api.slice(
    api.indexOf('async function handleAnnounce'),
    api.indexOf('async function lastMaldiaNote')
  );
  const prefs = api.slice(
    api.indexOf('const ANNOUNCE_PREF'),
    api.indexOf('function cleanSection')
  );

  assert.match(prefs, /openwhen: 'letters'/);
  assert.match(prefs, /calendar: 'daily'/);
  assert.match(prefs, /reason: 'daily'/);
  assert.match(prefs, /content: 'daily'/);
  assert.match(handler, /splitRecipients\(recipients, prefsById, now, ANNOUNCE_PREF\[kind\]\)/);
  // En silencio no suena: se dice cuándo termina, en vez de fingir que salió.
  assert.match(handler, /quiet: quiet\.length/);
  assert.match(handler, /until: deferUntilFor\(quiet, prefsById, now\)/);
});

test('el cliente pide el aviso con su sesión y nunca rompe el guardado', async () => {
  const client = await readClient();
  assert.match(client, /fetch\('\/api\/push\?action=announce'/);
  assert.match(client, /Authorization': `Bearer \$\{session\.access_token\}`/);
  assert.match(client, /if \(!session\?\.access_token\) return false;/);
  assert.match(client, /catch \(err\)/);
  assert.doesNotMatch(client, /SERVICE_ROLE|CRON_SECRET|VAPID_PRIVATE/);
});

// ==========================================
// 3 · EL PANEL AVISA SOLO CUANDO AÑADE
// ==========================================

test('guardar contenido avisa solo si el recuento sube', async () => {
  const db = await readDb();
  assert.match(db, /import \{ announcePublished \} from '\.\/announce\.service\.js';/);
  assert.match(db, /const added = countOf\(data\) - countOf\(prev\);/);
  assert.match(db, /if \(added > 0\) \{/);
  // Sin lectura previa no se anuncia nada: es la diferencia entre «nuevo» y
  // «el catálogo entero la primera vez que se guarda».
  assert.match(db, /prev !== null/);
  // Fire-and-forget: el guardado ya está hecho.
  assert.match(db, /announcePublished\(announce\.kind, \{[\s\S]*?\}\)\.catch\(\(\) => \{\}\);/);
});

test('cada sección del panel tiene su tipo de aviso y su destino', async () => {
  const db = await readDb();
  const map = db.slice(db.indexOf('const CONTENT_ANNOUNCE'), db.indexOf('async function saveContent'));

  for (const [id, kind] of [
    ['openwhen_letters', 'openwhen'],
    ['gifts', 'calendar'],
    ['razones', 'reason'],
    ['canciones', 'content'],
    ['series', 'content'],
    ['audios', 'content'],
    ['maldia_frases', 'content'],
    ['noticias', 'content']
  ]) {
    assert.match(map, new RegExp(`${id}:\\s*\\{ kind: '${kind}'`), `falta ${id} → ${kind}`);
  }
  // Todos los tipos del mapa existen en la lista cerrada del servidor.
  for (const kind of [...new Set([...map.matchAll(/kind: '([a-z]+)'/g)].map(m => m[1]))]) {
    assert.ok(ANNOUNCE_KINDS.includes(kind), `tipo desconocido en el panel: ${kind}`);
  }
});

// ==========================================
// 4 · EL INTERRUPTOR DIARIO Y EL SILENCIO EN EL SERVIDOR
// ==========================================

test('el saludo matinal obedece al interruptor «Recordatorio diario»', async () => {
  const app = await readFile(hub('src', 'components', 'App.js'), 'utf8');
  const sw = await readFile(hub('public', 'sw.js'), 'utf8');

  // App abierta: el aviso local se salta si el tipo está apagado.
  assert.match(app, /if \(getNotifSettings\(\)\.daily\) \{[\s\S]{0,400}?showDailyNotification\(greeting/);
  // App cerrada (periodicsync): el SW recibe el interruptor y lo comprueba.
  assert.match(sw, /if \(state\.daily === false\) return;/);
  const service = await readFile(hub('src', 'services', 'notifications.service.js'), 'utf8');
  assert.match(service, /daily: getNotifSettings\(\)\.daily !== false,/);
});

test('sin fila de preferencias, el servidor recibe igualmente el silencio', async () => {
  const service = await readFile(hub('src', 'services', 'notifications.service.js'), 'utf8');
  // Antes solo se subía si había ajustes locales guardados: una cuenta que
  // nunca tocó nada dejaba al servidor sin saber su 23:00–08:00.
  assert.match(service, /if \(!data\) \{[\s\S]{0,400}?await pushNotifPrefs\(getNotifSettings\(\)\);/);
  assert.doesNotMatch(service, /hasLocalNotifSettings/);
});

test('su actividad sigue yendo solo al admin', async () => {
  const api = await readApi();
  const notifyAdmin = api.slice(
    api.indexOf('async function handleNotifyAdmin'),
    api.indexOf('async function handleAnnounce')
  );
  // El servidor rechaza el aviso si quien lo pide es admin (no se avisa a sí
  // mismo) y elige destinatarios solo entre role='admin'.
  assert.match(notifyAdmin, /profile\?\.role === 'admin'\) \{\s*\n\s*return res\.status\(200\)\.json\(\{ success: true, sent: 0, skipped: true, reason: 'Admin event' \}\)/);
  assert.match(notifyAdmin, /\.select\('id, enabled'\)\s*\n\s*\.eq\('role', 'admin'\)/);
  assert.match(notifyAdmin, /adminSubscriptions = allSubscriptions\.filter\(s => adminIdSet\.has\(s\.userId\)\)/);
});
