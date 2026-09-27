-- ============================================================
-- 020 · POLÍTICAS PERMISIVAS QUE SOBRARON — CORRECCIÓN
-- ============================================================
-- Fecha: 2026-09-27
-- Origen: la auditoría de políticas de 019 (consulta de solo lectura).
--
-- CONTEXTO IMPORTANTE
-- 019 ya está aplicada y el aislamiento de `moods` está cerrado y
-- comprobado: entrando con las dos cuentas reales, `dada` ya solo ve
-- sus 63 estados de ánimo y ninguno de `admin`.
--
-- La misma auditoría destapó el resto. En `playlists` siguen vivas
-- cuatro políticas PERMISIVAS que ninguna migración actual crea:
--
--   playlists_read_all    SELECT  USING (true)   <-- leer TODAS
--   playlists_write_all   INSERT  (with check)   <-- crear en nombre de otro
--   playlists_update_all  UPDATE  USING (true)   <-- modificar CUALQUIERA
--   playlists_delete_all  DELETE  USING (true)   <-- borrar CUALQUIERA
--
-- Es decir: cualquier cuenta autenticada puede leer, tocar y borrar
-- playlists ajenas. Ahora mismo la tabla está vacía (0 filas), así que
-- no se ha filtrado nada, pero el aislamiento real ya no existe.
--
-- Y el mismo patrón, más sutil, en telemetría: `activity_log_insert_all`,
-- `analytics_visits_insert_all` y `analytics_events_insert_all` siguen
-- conviviendo con sus versiones `_own`. Al combinarse con OR, la
-- permisiva anula la restrictiva y se puede escribir actividad en
-- nombre de otro usuario.
--
-- ¿POR QUÉ SIGUEN AHÍ? Porque `sql/016_aislamiento_playlists.sql`
-- nunca se aplicó a esta base de datos: es la migración que hace esos
-- DROP. 008 y 004 también los hacen, pero nunca los crean, así que
-- vienen del `supabase-schema.sql` histórico con el que se creó el
-- esquema.
--
-- POR QUÉ NO SE APLICA 016 Y YA
-- 016 es anterior a 017/018 y redefine `profiles_update_policy` y
-- `prevent_role_escalation` con versiones MÁS VIEJAS. Aplicarla ahora
-- sería tirar por tierra el endurecimiento de 017. Por eso esta
-- migración es quirúrgica: solo toca lo que sobra.
--
-- Idempotente y sin tocar datos: solo políticas.
-- ============================================================


-- ==========================================
-- 1 · AISLAR POR TABLA, SIN DEPENDER DEL NOMBRE
-- ==========================================
-- Se lee pg_policies en el momento de ejecutarse y se elimina todo lo
-- que no esté en la lista blanca. Así no depende de acordarse del
-- nombre de la política sobrante, que es justo lo que falló con 016.
--
-- Las listas blancas están completas a propósito: incluyen las
-- políticas de LECTURA PARA EL ADMIN que ya existían y funcionan
-- (`*_select_admin`). Olvidar una de esas rompería el panel de admin,
-- que se quedaría sin poder leer la actividad.

DO $$
DECLARE
  r     record;
  sobra text;
  spec  jsonb := '[
    {
      "tabla": "playlists",
      "permitidas": ["playlists_select_owner", "playlists_insert_owner",
                     "playlists_update_owner", "playlists_delete_owner"]
    },
    {
      "tabla": "activity_log",
      "permitidas": ["activity_log_insert_own", "activity_log_select_admin"]
    },
    {
      "tabla": "analytics_visits",
      "permitidas": ["analytics_visits_insert_own", "analytics_visits_select_admin"]
    },
    {
      "tabla": "analytics_events",
      "permitidas": ["analytics_events_insert_own", "analytics_events_select_admin"]
    }
  ]';
  s     jsonb;
BEGIN
  FOR s IN SELECT * FROM jsonb_array_elements(spec) LOOP
    FOR r IN
      SELECT policyname
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename   = s ->> 'tabla'
         AND policyname NOT IN (
              SELECT jsonb_array_elements_text(s -> 'permitidas')
            )
    LOOP
      sobra := r.policyname;
      EXECUTE format('DROP POLICY %I ON public.%I', sobra, s ->> 'tabla');
      RAISE NOTICE '%: eliminada la politica permisiva "%"', s ->> 'tabla', sobra;
    END LOOP;
  END LOOP;
END $$;


-- ==========================================
-- 2 · ASEGURAR QUE QUEDAN LAS CORRECTAS
-- ==========================================
-- DROP + CREATE: la única forma de cambiar una policy en Postgres, y
-- además deja el resultado igual aunque la migración se re-ejecute.
-- Mismo texto que 017, para que 020 y 017 no se contradigan.

-- PLAYLISTS: personales. Si algún día se quieren compartir, hace falta
-- una tabla de miembros con permisos explícitos, como avisa 016.
DROP POLICY IF EXISTS "playlists_select_owner" ON public.playlists;
CREATE POLICY "playlists_select_owner" ON public.playlists FOR SELECT
  USING (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "playlists_insert_owner" ON public.playlists;
CREATE POLICY "playlists_insert_owner" ON public.playlists FOR INSERT
  WITH CHECK (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "playlists_update_owner" ON public.playlists;
CREATE POLICY "playlists_update_owner" ON public.playlists FOR UPDATE
  USING (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()))
  WITH CHECK (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "playlists_delete_owner" ON public.playlists;
CREATE POLICY "playlists_delete_owner" ON public.playlists FOR DELETE
  USING (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()));

-- TELEMETRÍA: cada quien escribe su propia actividad, solo el admin lee.
-- user_id es TEXT en estas tres tablas, de ahí el auth.uid()::text.
DROP POLICY IF EXISTS "activity_log_insert_own" ON public.activity_log;
CREATE POLICY "activity_log_insert_own" ON public.activity_log FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid()::text);

DROP POLICY IF EXISTS "analytics_visits_insert_own" ON public.analytics_visits;
CREATE POLICY "analytics_visits_insert_own" ON public.analytics_visits FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid()::text);

DROP POLICY IF EXISTS "analytics_events_insert_own" ON public.analytics_events;
CREATE POLICY "analytics_events_insert_own" ON public.analytics_events FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid()::text);


-- ==========================================
-- 3 · AUDITORÍA CORREGIDA — solo lectura
-- ==========================================
-- IMPORTANTE: la consulta de 019 tenía un fallo. Para INSERT y UPDATE lo
-- que decide si dejan pasar es WITH CHECK, no USING, y pg_policies guarda
-- eso en `with_check`, no en `qual`. Por eso salía null y no se podía
-- juzgar esas políticas. Esta versión muestra las dos columnas.
--
-- CORRECCIÓN posterior: la primera versión de esta consulta marcaba
-- "REVISAR" en todo UPDATE con `with_check` nulo, y eso era un falso
-- positivo. En PostgreSQL, si una policy de UPDATE no define WITH CHECK,
-- se reutiliza el USING: no es un agujero, es el comportamiento normal.
-- Aquí se juzga USING cuando with_check es null.
--
-- Pégale el resultado al terminar.

SELECT
  tablename,
  policyname,
  cmd,
  qual                     AS using_expr,
  with_check               AS check_expr,
  CASE
    -- INSERT: solo existe WITH CHECK, y es el que manda.
    WHEN cmd = 'INSERT'
         AND (with_check IS NULL OR with_check !~ 'auth\.uid\(\)|is_admin\(\)|is_enabled\(\)')
      THEN 'REVISAR: insert sin comprobar dueno'
    -- UPDATE: si hay WITH CHECK se juzga ese; si no, se hereda el USING.
    WHEN cmd = 'UPDATE' AND with_check IS NOT NULL
         AND with_check !~ 'auth\.uid\(\)|is_admin\(\)|is_enabled\(\)'
      THEN 'REVISAR: update sin comprobar dueno'
    WHEN cmd = 'SELECT' AND qual IS NOT NULL
         AND qual !~ 'auth\.uid\(\)|is_admin\(\)|is_enabled\(\)'
      THEN 'REVISAR: select sin mirar al dueno'
    WHEN cmd = 'SELECT' AND qual IS NULL
      THEN 'ok: tabla sin lectura directa'
    WHEN cmd = 'INSERT' THEN 'ok: comprueba dueno'
    WHEN cmd = 'UPDATE' AND with_check IS NULL THEN 'ok: hereda el USING'
    WHEN qual ~ 'auth\.uid\(\)' OR qual ~ 'is_admin\(\)' THEN 'ok: mira al dueno'
    WHEN qual ~ 'is_enabled\(\)' THEN 'ok: solo exige cuenta activa'
    ELSE 'ok'
  END                      AS veredicto
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, cmd, policyname;
