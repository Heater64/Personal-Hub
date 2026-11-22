/* ==========================================
   Tests de contrato — Endurecimiento de RLS (026)

   Lo que fija esta migración es fácil de deshacer sin darse cuenta: si
   alguien recrea el trigger solo para UPDATE, o vuelve a escribir las
   políticas de Storage con `TO public`, el agujero reaparece y ningún
   test de la app se entera (las dos cuentas del hub siguen entrando).

   Capas: el archivo SQL de la migración y que esté listado donde se
   busca cuando hay que aplicarlo.
   ========================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = (...parts) => path.join(ROOT, ...parts);

const migration = () => readFile(projectPath('sql', '026_rls_hardening.sql'), 'utf8');
const sharedDataMigration = () => readFile(projectPath('sql', '033_datos_compartidos_de_pareja.sql'), 'utf8');

test('033 limita los datos compartidos a las dos cuentas activas y sus roles', async () => {
  const sql = await sharedDataMigration();
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.is_tamp_partner\(p_user_id UUID\)/);
  assert.match(sql, /count\(\*\).*profiles.*enabled.*\) = 2/s);
  assert.match(sql, /me\.role = 'admin'.*partner\.role = 'user'/s);
  assert.match(sql, /me\.role = 'user'.*partner\.role = 'admin'/s);
  assert.match(sql, /user_id = auth\.uid\(\) OR public\.is_tamp_partner\(user_id\)/);
});

test('033 comparte la lectura, pero mantiene propios los cambios de ánimo y ciclo', async () => {
  const sql = await sharedDataMigration();
  assert.match(sql, /moods_delete_policy[\s\S]*?user_id = auth\.uid\(\)/);
  for (const table of ['cycle_settings', 'cycle_periods', 'cycle_daily_logs']) {
    assert.match(sql, new RegExp(`${table}_select_own[\\s\\S]*?is_tamp_partner\\(user_id\\)`));
  }
  const readme = await readFile(projectPath('sql', 'README.md'), 'utf8');
  assert.ok(readme.includes('033_datos_compartidos_de_pareja.sql'));
});

test('026 existe y está listada donde se busca antes de aplicarla', async () => {
  const sql = await migration();
  assert.ok(sql.length > 500, 'la migración está vacía');

  const readme = await readFile(projectPath('sql', 'README.md'), 'utf8');
  assert.ok(readme.includes('026_rls_hardening.sql'), 'sql/README.md debe listar la 026');

  const setup = await readFile(projectPath('SUPABASE-SETUP.md'), 'utf8');
  assert.ok(setup.includes('026_rls_hardening.sql'), 'SUPABASE-SETUP.md debe listar la 026');
});

test('el alta de perfil no puede saltarse la escalada de rol', async () => {
  const sql = await migration();

  // El trigger cubre INSERT y UPDATE: la rama de INSERT es justo la que
  // faltaba (un usuario sin fila podía crearse admin).
  assert.match(sql, /BEFORE INSERT OR UPDATE ON public\.profiles/);
  assert.match(sql, /IF TG_OP = 'INSERT' THEN/);
  assert.match(sql, /NEW\.role IS DISTINCT FROM 'user'/);
  assert.match(sql, /Solo los administradores pueden crear un perfil de administrador/);
  assert.match(sql, /Solo los administradores pueden crear un perfil deshabilitado/);

  // Y el UPDATE conserva las dos protecciones que ya existían.
  assert.match(sql, /Solo los administradores pueden cambiar role o enabled/);
  assert.match(sql, /No puedes eliminar tu propio rol de administrador/);
  assert.match(sql, /No puedes deshabilitar tu propia cuenta/);

  // SECURITY DEFINER sin search_path fijo es el patrón que el Advisor marca.
  assert.match(sql, /SECURITY DEFINER\nSET search_path TO 'public'/);
  assert.match(sql, /ALTER FUNCTION public\.handle_new_user\(\) SET search_path/);
});

test('las funciones internas dejan de ser RPC públicas', async () => {
  const sql = await migration();

  for (const fn of [
    'handle_new_user',
    'sync_profile_from_auth',
    'prevent_role_escalation',
    'protect_user_metadata',
    'prune_game_history',
    'backfill_inviter_avatars',
    'is_admin',
  ]) {
    assert.match(
      sql,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\(\\) FROM PUBLIC;`),
      `${fn} sigue siendo ejecutable por PUBLIC`
    );
  }

  // Las políticas las ejecuta la sesión: sin este GRANT, RLS revienta con
  // «permission denied for function is_admin».
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.is_admin\(\) TO authenticated, service_role;/
  );
});

test('TRUNCATE deja de estar al alcance del cliente', async () => {
  const sql = await migration();
  assert.match(
    sql,
    /REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;/
  );
});

test('Storage deja de listarse sin sesión', async () => {
  const sql = await migration();
  const buckets = ['avatars', 'galeria', 'memes', 'audios'];

  for (const bucket of buckets) {
    // La política vieja era `TO public` filtrando solo por bucket_id:
    // con la anon key se enumeraba todo el contenido.
    assert.match(
      sql,
      new RegExp(`DROP POLICY IF EXISTS ${bucket}_select_all ON storage\\.objects;`)
    );
    assert.match(
      sql,
      new RegExp(
        `CREATE POLICY ${bucket}_select_authenticated ON storage\\.objects\\s*\\n\\s*FOR SELECT TO authenticated\\s*\\n\\s*USING \\(public\\.is_enabled\\(\\) AND bucket_id = '${bucket}'\\);`
      )
    );
  }

  // Las políticas de escritura no se tocan: siguen exigiendo admin o ser
  // el dueño de la carpeta.
  assert.doesNotMatch(sql, /DROP POLICY IF EXISTS galeria_insert_admin/);
  assert.doesNotMatch(sql, /DROP POLICY IF EXISTS avatars_insert_own/);
});
