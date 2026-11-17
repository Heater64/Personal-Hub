// ==========================================
// AVISOS DEL CICLO — ella registra, él se entera
//
// El aviso es seguimiento del admin (024/028), así que el texto no viaja en
// la petición: el servidor lee la fila que ella acaba de guardar. Aquí se
// comprueba que las tres piezas existen y siguen conectadas:
//   cliente (cycle.service) → notifications.service → /api/push → payload
// ==========================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = path => readFile(join(root, path), 'utf8');

test('cada guardado del ciclo pide su aviso al servidor', async () => {
  const service = await read('personal-hub/src/services/cycle.service.js');

  // Menstruación nueva o con fecha de fin: es el aviso que explica su semana.
  assert.match(service, /notifyAdminOfCycle\('cycle_period'\)/);
  // Un día con síntomas, flujo o nota.
  assert.match(service, /notifyAdminOfCycle\('cycle_log'\)/);
  // Y cuando activa o amplía lo que comparte.
  assert.match(service, /notifyAdminOfCycle\('cycle_share'\)/);

  // Un guardado que no cambia nada no debe sonar en su móvil.
  assert.match(
    service,
    /before\.flow !== payload\.flow[\s\S]{0,300}?if \(changed\) notifyAdminOfCycle/,
    'el aviso de un día solo sale si el registro cambió'
  );
  // Editar las notas de una menstruación ya guardada tampoco avisa.
  assert.match(service, /if \(!period\.id \|\| endsToday\) notifyAdminOfCycle/);
});

test('el cliente solo acepta las clases del ciclo que el servidor conoce', async () => {
  const notifications = await read('personal-hub/src/services/notifications.service.js');
  assert.match(notifications, /export function notifyAdminOfCycle/);
  assert.match(
    notifications,
    /\['cycle_period', 'cycle_log', 'cycle_share'\]/,
    'la lista blanca del cliente y los kinds del servidor deben coincidir'
  );
  assert.match(notifications, /adminCycle: true/, 'el interruptor viene activo por defecto');
  assert.match(notifications, /admin_cycle: settings\.adminCycle !== false/, 'se refleja en Supabase');
});

test('el servidor compone el texto leyendo la base, no el cuerpo', async () => {
  const push = await read('api/push.js');
  const handler = push.slice(
    push.indexOf('async function handleNotifyAdmin'),
    push.indexOf('async function lastMaldiaNote')
  );

  // Cada clase lee su tabla.
  assert.match(handler, /\.from\('cycle_periods'\)/);
  assert.match(handler, /\.from\('cycle_daily_logs'\)/);
  assert.match(handler, /\.from\('cycle_sharing'\)/);
  assert.match(handler, /adminCyclePeriodPayload\(period\)/);
  assert.match(handler, /adminCycleLogPayload\(log\)/);
  assert.match(handler, /adminCycleSharePayload\(sharing\)/);
  // Sin las tablas del ciclo (migración no aplicada) se salta, no se rompe.
  assert.match(handler, /missingTables\.has\(error\.code\)/);

  // Los textos hablan de lo que ella apuntó, con los síntomas en su nombre.
  assert.match(push, /export function adminCyclePeriodPayload/);
  assert.match(push, /export function adminCycleLogPayload/);
  assert.match(push, /'dolor-abdominal': 'Dolor abdominal'/);
  assert.match(push, /key\.startsWith\('custom:'\) \? key\.slice\(7\)/, 'los síntomas escritos por ella salen tal cual');
  // Y abre su vista de pareja, que es la única que él tiene.
  assert.match(push, /const ADMIN_CYCLE_DESTINATION = '\/menstruacion'/);
});

test('la migración del interruptor está en sql/ y documentada', async () => {
  const sql = await read('sql/028_avisos_ciclo.sql');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS admin_cycle BOOLEAN NOT NULL DEFAULT TRUE/);
  const readme = await read('sql/README.md');
  assert.match(readme, /028_avisos_ciclo\.sql/);
});
