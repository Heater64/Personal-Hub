#!/usr/bin/env node
/**
 * Comprobación de las claves VAPID del hub.
 *
 *   npm run check:push
 *
 * Comprueba lo que una vez roto no se ve hasta que los push dejan de llegar:
 *
 *   1. Los dos literales del cliente (notifications.service.js y public/sw.js)
 *      son IDÉNTICOS y tienen formato URL-safe Base64 de 65 bytes.
 *   2. Esa clave pública es un punto válido de la curva P-256 (una copia con
 *      un carácter cambiado no lo es y `pushManager.subscribe()` la rechaza).
 *   3. Si existe `.env`: su `VAPID_PUBLIC_KEY` coincide con los literales y
 *      SÍ corresponde a su `VAPID_PRIVATE_KEY` (derivación ECDH), que es lo
 *      que firma los envíos. También avisa si falta `CRON_SECRET`.
 *
 * Sin `.env` (CI) solo se comprueba el cliente y sale con 0, para no romper
 * el pipeline por un dato que no existe ahí. Sale con 1 si algo no cuadra.
 *
 * Este script solo LEE: no imprime la clave privada ni ningún otro secreto.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createECDH } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_FILES = [
  path.join(root, 'personal-hub', 'src', 'services', 'notifications.service.js'),
  path.join(root, 'personal-hub', 'public', 'sw.js')
];
const ENV_FILE = path.join(root, '.env');

const problems = [];
const notes = [];
const ok = msg => console.log(`  ✓ ${msg}`);
const bad = msg => problems.push(msg);

const b64ToBuffer = value =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** ¿Es una clave pública URL-safe Base64 de 65 bytes y punto válido de la curva? */
function publicProblems(value, label) {
  const errors = [];
  if (typeof value !== 'string' || !value) {
    return [`${label}: falta la clave pública`];
  }
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    errors.push(
      `${label}: no es URL-safe Base64 (letras, dígitos, "-" y "_" nada más; sin "=" de relleno)`
    );
    return errors;
  }
  const buffer = b64ToBuffer(value);
  if (buffer.length !== 65) {
    errors.push(`${label}: decodifica a ${buffer.length} bytes, deberían ser 65`);
    return errors;
  }
  try {
    const ecdh = createECDH('prime256v1');
    ecdh.setPublicKey(buffer);
  } catch {
    errors.push(`${label}: no es un punto válido de la curva P-256 (clave copiada mal)`);
  }
  return errors;
}

console.log('Comprobación VAPID — cliente');

const literals = CLIENT_FILES.map(file => {
  const source = readFileSync(file, 'utf8');
  const match = source.match(/VAPID_PUBLIC_KEY\s*=\s*\n?\s*'([A-Za-z0-9_-]+)'/);
  return { file: path.relative(root, file).replace(/\\/g, '/'), value: match ? match[1] : null };
});

for (const { file, value } of literals) {
  const errors = publicProblems(value, file);
  if (errors.length) errors.forEach(bad);
  else ok(`${file}: clave pública válida (65 bytes, punto correcto de la curva)`);
}

if (literals[0].value && literals[1].value) {
  if (literals[0].value === literals[1].value) {
    ok('los dos literales del cliente son idénticos');
  } else {
    bad('los literales de notifications.service.js y public/sw.js NO coinciden');
  }
}

console.log('\nComprobación VAPID — .env');

if (!existsSync(ENV_FILE)) {
  notes.push('no hay .env local: se salta el par privado (correcto en CI)');
} else {
  const env = readFileSync(ENV_FILE, 'utf8');
  const get = name => {
    const match = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, 'm'));
    return match ? match[1].trim() : '';
  };

  const envPublic = get('VAPID_PUBLIC_KEY');
  if (!envPublic) {
    bad('.env: falta VAPID_PUBLIC_KEY');
  } else {
    const errors = publicProblems(envPublic, '.env VAPID_PUBLIC_KEY');
    errors.forEach(err => (err.includes('válida') || err.includes('URL-safe') ? bad(err) : null));
    if (!errors.length) ok('.env VAPID_PUBLIC_KEY: formato correcto');
    if (literals[0].value && literals[0].value !== envPublic) {
      bad('.env VAPID_PUBLIC_KEY no coincide con la clave pública del cliente');
    } else if (literals[0].value) {
      ok('.env VAPID_PUBLIC_KEY coincide con la clave del cliente');
    }
  }

  const envPrivate = get('VAPID_PRIVATE_KEY');
  if (!envPrivate) {
    bad('.env: falta VAPID_PRIVATE_KEY');
  } else {
    try {
      const ecdh = createECDH('prime256v1');
      ecdh.setPrivateKey(b64ToBuffer(envPrivate));
      const derived = ecdh
        .getPublicKey('base64', 'uncompressed')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      if (envPublic && derived !== envPublic) {
        bad(
          'la VAPID_PRIVATE_KEY NO corresponde a la VAPID_PUBLIC_KEY: los envíos se firmarían con una clave y se anunciarían con otra (el push service los rechaza)'
        );
      } else if (envPublic) {
        ok('la VAPID_PRIVATE_KEY corresponde a su VAPID_PUBLIC_KEY');
      }
    } catch {
      bad('.env VAPID_PRIVATE_KEY: no es una clave privada P-256 válida');
    }
  }

  if (!get('VAPID_SUBJECT')) {
    bad('.env: falta VAPID_SUBJECT');
  } else {
    ok('.env VAPID_SUBJECT presente');
  }
  if (!get('CRON_SECRET')) {
    bad('.env: falta CRON_SECRET (sin él el cron diario responde 500)');
  } else {
    ok('.env CRON_SECRET presente');
  }
}

for (const note of notes) console.log(`  · ${note}`);

if (problems.length) {
  console.error(`\n✗ ${problems.length} problema(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('\n✓ Claves VAPID coherentes entre cliente y servidor.');