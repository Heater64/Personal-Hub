/* ==========================================
   Tests de contrato — Cambio de claves VAPID y suscripciones viejas

   El fallo real (17/10): se rotaron las claves VAPID del servidor, pero los
   navegadores conservaron la suscripción creada con la clave ANTERIOR.
   `pushManager.getSubscription()` la devuelve como si valiera, el cliente la
   vuelve a mandar al servidor y FCM responde 403 «the VAPID credentials ...
   do not correspond to the credentials used to create the subscriptions».
   Resultado: ningún aviso llegaba a ningún dispositivo y el servidor solo
   sumaba `failed`.

   Aquí se fijan las dos mitades de la solución:

   1. El cliente compara `subscription.options.applicationServerKey` con la
      clave actual y, si no coincide, la cancela y se suscribe de nuevo. Ese
      emparejamiento es lógica pura (`utils/push-key.js`) y se prueba con
      bytes reales de una curva P-256.
   2. El servidor reconoce ESE 403 (y no otro) como suscripción inservible:
      la retira de la base en vez de reintentarla cada día para siempre.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createECDH } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  subscriptionUsesKey,
  subscriptionKeyChanged,
  urlBase64ToUint8Array
} from '../personal-hub/src/utils/push-key.js';
import { isVapidMismatchError } from '../api/push.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFile(path.join(ROOT, ...parts), 'utf8');

/** Clave pública P-256 real, como las que genera `web-push`. */
function vapidKeyPair() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const raw = ecdh.getPublicKey();
  return { raw, base64: raw.toString('base64url') };
}

test('una suscripción creada con la clave actual se reconoce como válida', () => {
  const key = vapidKeyPair();
  const subscription = { options: { applicationServerKey: key.raw } };
  assert.equal(subscriptionUsesKey(subscription, key.base64), true);

  // El navegador puede devolver ArrayBuffer o Uint8Array según la versión.
  const asArrayBuffer = key.raw.buffer.slice(
    key.raw.byteOffset,
    key.raw.byteOffset + key.raw.byteLength
  );
  assert.equal(
    subscriptionUsesKey({ options: { applicationServerKey: asArrayBuffer } }, key.base64),
    true
  );
});

test('una suscripción creada con OTRA clave se detecta (el fallo de hoy)', () => {
  const vieja = vapidKeyPair();
  const nueva = vapidKeyPair();
  const subscription = { options: { applicationServerKey: vieja.raw } };
  assert.equal(subscriptionUsesKey(subscription, nueva.base64), false);
  assert.equal(subscriptionUsesKey(subscription, vieja.base64), true);
});test('sin applicationServerKey no se puede afirmar nada: no se renueva', () => {
  // Cancelar una suscripción válida por no poder comprobarla dejaría al
  // dispositivo sin avisos; y una clave esperada vacía borraría todas.
  const key = vapidKeyPair().base64;
  assert.equal(subscriptionUsesKey({ options: {} }, key), false);
  assert.equal(subscriptionKeyChanged({ options: {} }, key), false);
  assert.equal(subscriptionKeyChanged({}, key), false);
  assert.equal(subscriptionKeyChanged(null, key), false);
  assert.equal(subscriptionKeyChanged({ options: { applicationServerKey: new Uint8Array(65) } }, ''), false);
});

test('solo se renueva cuando la clave guardada es demostrablemente distinta', () => {
  const vieja = vapidKeyPair();
  const nueva = vapidKeyPair();
  const subscription = { options: { applicationServerKey: vieja.raw } };
  assert.equal(subscriptionKeyChanged(subscription, nueva.base64), true);
  assert.equal(subscriptionKeyChanged(subscription, vieja.base64), false);
});

test('urlBase64ToUint8Array decodifica sin depender del relleno', () => {
  const raw = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  const base64 = raw.toString('base64url');
  assert.deepEqual(Buffer.from(urlBase64ToUint8Array(base64)), raw);
  assert.deepEqual(Buffer.from(urlBase64ToUint8Array(base64.replace(/=+$/, ''))), raw);
});

test('el 403 de clave VAPID se reconoce, y los demás 403 no', () => {
  const mismatch = {
    statusCode: 403,
    body: 'the VAPID credentials in the authorization header do not correspond to the credentials used to create the subscriptions',
  };
  assert.equal(isVapidMismatchError(mismatch), true);
  assert.equal(
    isVapidMismatchError({ statusCode: 403, message: 'VAPID credentials do not correspond' }),
    true
  );
  // Un 403 por permisos, un 410 o un error de red NO son suscripciones viejas:
  // retirarlas por error dejaría sin avisos a dispositivos que sí funcionan.
  assert.equal(isVapidMismatchError({ statusCode: 403, body: 'Forbidden' }), false);
  assert.equal(isVapidMismatchError({ statusCode: 410, body: 'Gone' }), false);
  assert.equal(isVapidMismatchError({ statusCode: 401, body: 'VAPID credentials' }), false);
  assert.equal(isVapidMismatchError(new Error('socket hang up')), false);
  assert.equal(isVapidMismatchError(null), false);
});

test('el cliente renueva la suscripción vieja en vez de reutilizarla', async () => {
  const service = await read('personal-hub', 'src', 'services', 'notifications.service.js');  assert.match(service, /subscriptionKeyChanged\(subscription, VAPID_PUBLIC_KEY\)/);
  assert.match(service, /subscription\.unsubscribe\(\)/);
  // Las dos entradas al alta (activar y resincronizar al abrir la app) deben
  // pasar por la comprobación; si una la salta, ese dispositivo no se cura.
  assert.match(service, /export async function subscribeToPush\(\)[\s\S]{0,1200}subscriptionKeyChanged/);
  assert.match(service, /export async function resyncPushSubscription\(\)[\s\S]{0,700}subscriptionKeyChanged/);
  // Y la clave del cliente sigue siendo la única fuente (sin literales sueltos).
  assert.equal(
    (
      service.match(
        /BALzk9q-6CaVPmvMC0h4JIMQ582uOKAhX7AwwqefqLQzAeFxbLMhIaeazaZ8OqSQjFQJVIhwPis7zsJL2SrNY3A/g
      ) || []
    ).length,
    1
  );
});

test('el servidor retira las suscripciones con clave VAPID anterior en ambos envíos', async () => {
  const api = await read('api', 'push.js');
  assert.match(api, /export function isVapidMismatchError/);
  const checks = (api.match(/isVapidMismatchError\(err\)/g) || []).length;
  // deliverPush (recordatorios y avisos al admin) + el envío diario.
  assert.ok(
    checks >= 3,
    `esperaba la comprobación en los dos caminos de envío, encontré ${checks}`
  );
  assert.match(api, /stale: staleEndpoints\.length/);
});
