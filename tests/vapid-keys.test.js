import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createECDH } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Coherencia de las claves VAPID (regresión del incidente: «las notificaciones
 * no van»).
 *
 * Dos fallos distintos que solo se veían en producción y que estos tests
 * impiden volver a introducir:
 *
 *  1. Los dos literales de cliente (notifications.service.js y public/sw.js)
 *     desincronizados o con un carácter cambiado: la clave deja de ser un
 *     punto válido de la curva y `pushManager.subscribe()` la rechaza, así que
 *     no hay suscripciones y no hay nada a quien enviar (0 filas reales).
 *  2. `api/push.js` ejecutando `webpush.setVapidDetails` al importar sin
 *     proteger: una clave mal pegada en el entorno mataba la función entera y
 *     TODA la API respondía 500 FUNCTION_INVOCATION_FAILED.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = (...parts) => path.join(root, ...parts);
const read = (...parts) => readFileSync(projectPath(...parts), 'utf8');

const CLIENT_FILES = [
  ['personal-hub', 'src', 'services', 'notifications.service.js'],
  ['personal-hub', 'public', 'sw.js'],
];

function clientLiteral(parts) {
  const source = read(...parts);
  const match = source.match(/VAPID_PUBLIC_KEY\s*=\s*\n?\s*'([A-Za-z0-9_-]+)'/);
  return match ? match[1] : null;
}

test('los dos literales de clave pública del cliente coinciden y tienen formato', () => {
  const values = CLIENT_FILES.map(parts => clientLiteral(parts));
  const [service, sw] = values;
  assert.ok(service, 'notifications.service.js debe declarar VAPID_PUBLIC_KEY');
  assert.ok(sw, 'public/sw.js debe declarar VAPID_PUBLIC_KEY');
  assert.equal(service, sw, 'el service worker y el cliente deben usar la MISMA clave pública');

  for (const value of values) {
    // URL-safe Base64 sin "=" de relleno: lo que exige web-push.setVapidDetails.
    assert.match(value, /^[A-Za-z0-9_-]+$/, 'la clave pública debe ser URL-safe sin relleno');
    const buffer = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    assert.equal(buffer.length, 65, 'una clave pública P-256 decodifica a 65 bytes');
    // Una clave con un carácter copiado mal no es un punto de la curva: el
    // navegador la rechaza en pushManager.subscribe() y no hay suscripción.
    const ecdh = createECDH('prime256v1');
    assert.doesNotThrow(() => ecdh.setPublicKey(buffer), 'debe ser un punto válido de P-256');
  }
});

test('api/push.js no puede morir al importar por unas claves mal formadas', () => {
  const source = read('api', 'push.js');
  assert.match(
    source,
    /try\s*{\s*\n\s*webpush\.setVapidDetails\(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY\);/,
    'setVapidDetails tiene que ir dentro de try/catch: rompe la función entera si el par es inválido'
  );
  assert.match(
    source,
    /let vapidConfigError = null;/,
    'el error de configuración se guarda para poder responder un 500 legible'
  );
  // Cualquier envío pasa por la misma guardia con su mensaje claro.
  const guards = source.match(/requireVapid\(res\)/g) || [];
  assert.ok(guards.length >= 4, 'todas las acciones de envío usan requireVapid(res)');
  assert.match(source, /function requireVapid\(res\)/);
  assert.match(source, /VAPID keys not configured/);
});

test('el cliente no arrastra secretos de servidor', () => {
  const service = read('personal-hub', 'src', 'services', 'notifications.service.js');
  assert.doesNotMatch(service, /SERVICE_ROLE|VAPID_PRIVATE|CRON_SECRET/);
  const sw = read('personal-hub', 'public', 'sw.js');
  assert.doesNotMatch(sw, /SERVICE_ROLE|VAPID_PRIVATE|CRON_SECRET/);
});

test('.env.example documenta el par VAPID y CRON_SECRET con la plantilla vacía', () => {
  const template = read('.env.example');
  for (const name of [
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
    'CRON_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    assert.match(
      template,
      new RegExp(`^${name}=$`, 'm'),
      `.env.example debe listar ${name} sin valor (nunca un secreto real)`
    );
  }
  // Sin valores reales: el archivo es una plantilla, no un volcado de claves.
  assert.doesNotMatch(template, /[A-Za-z0-9_-]{40,}=/, 'la plantilla no lleva claves reales');
});

test('existe la comprobación manual de claves y está enlazada en package.json', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['check:push'], 'node scripts/check-push.js');
  assert.ok(
    pkg.scripts.test.includes('tests/vapid-keys.test.js'),
    'este archivo tiene que estar en la lista de npm test'
  );
  const script = read('scripts', 'check-push.js');
  assert.match(script, /createECDH/);
  assert.match(script, /process\.exit\(1\)/);
});
