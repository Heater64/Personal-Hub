import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findExposedSecrets, scanBuild } from '../scripts/check-build-secrets.js';

function jwt(payload) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.${'x'.repeat(24)}`;
}

test('permite la clave anon pública y detecta un JWT Supabase service_role', () => {
  const publicToken = jwt({ role: 'anon', iss: 'supabase' });
  const serviceToken = jwt({ role: 'service_role', iss: 'supabase' });

  assert.deepEqual(findExposedSecrets(`const anon = '${publicToken}';`), []);
  assert.ok(findExposedSecrets(`const key = '${serviceToken}';`).includes('Supabase service_role JWT'));
});

test('detecta claves privadas PEM y nombres de secretos backend', () => {
  assert.ok(findExposedSecrets('-----BEGIN PRIVATE KEY-----').includes('private key material'));
  assert.ok(findExposedSecrets('export const key = FCM_SERVICE_ACCOUNT;').includes('server secret identifier'));
});

test('no marca código del cliente sin material secreto', () => {
  assert.deepEqual(findExposedSecrets('export const MAP_TILE_URL = "https://tiles.example/{z}/{x}/{y}.png";'), []);
});

test('escanea los bundles JavaScript dentro de assets', t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'personal-hub-build-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, 'assets'));
  writeFileSync(path.join(directory, 'assets', 'app.js'), `const key = '${jwt({ role: 'service_role' })}';`);

  const result = scanBuild(directory);
  assert.equal(result.scanned, 1);
  assert.equal(result.problems[0]?.finding, 'Supabase service_role JWT');
});
