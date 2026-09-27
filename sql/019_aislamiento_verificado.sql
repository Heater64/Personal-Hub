-- ============================================================
-- 019 · AISLAMIENTO REAL ENTRE CUENTAS — CORRECCION
-- ============================================================
-- Fecha: 2026-09-27
-- Motivo: verificacion con las dos cuentas reales (admin@personalhub.com
-- y dada@personalhub.com). Resultado: dada leia 7 filas de estados de
-- animo de admin, y el endpoint de push no podia ni leer su tabla.
--
-- IMPORTANTE: esto corrige DOS cosas distintas y solo lo que se ha
-- podido PROBAR con las cuentas reales. No toca ninguna otra tabla,
-- a proposito: en content y activity_log existen politicas de lectura
-- para el panel de admin cuyos nombres no conocemos desde el codigo,
-- y borrarlas sin saberlo dejaria el panel a ciegas.
--
-- Es idempotente: se puede re-ejecutar sin romper nada.
-- No borra ni modifica ningun dato del usuario.
-- ============================================================


-- ==========================================
-- 1 · MOODS — la fuga probada
-- ==========================================
-- Sintoma medido: con el JWT de dada, SELECT * FROM moods devolvia 70
-- filas (63 suyas + 7 de admin), siendo is_admin() = false.
--
-- Curioso: el INSERT SI estaba bloqueado ("new row violates row-level
-- security policy"). Ese contraste es la firma de una politica
-- PERMISIVA ADICIONAL de solo SELECT que sobrevive a 017, porque en
-- PostgreSQL varias politicas permisivas de la misma tabla se combinan
-- con OR: por restrictiva que sea moods_select_policy, si hay otra que
-- dice USING (true), todo el mundo lo ve todo.
--
-- Ningun fichero de sql/ crea una quinta politica, de modo que no
-- podemos borrarla por nombre. La solucion es no depender del nombre:
-- se borran TODAS las politicas de la tabla y se recrean las cuatro
-- previstas, leyéndolas de pg_policies en el momento de ejecutarse.
--
-- Antes de esto, conviene mirar el NOTICE de arriba: dira el nombre
-- exacto de la politica sobrante que se estaba comiendo el isolamento.

DO $$
DECLARE
  r          record;
  sobra      text;
BEGIN
  FOR r IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename   = 'moods'
       AND policyname NOT IN (
             'moods_select_policy',
             'moods_insert_policy',
             'moods_update_policy',
             'moods_delete_policy'
           )
  LOOP
    sobra := r.policyname;
    EXECUTE format('DROP POLICY %I ON public.moods', sobra);
    RAISE NOTICE 'moods: eliminada la politica sobrante "%" (dejaba ver los estados de animo de los demas)', sobra;
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE 'moods: no habia politicas sobrantes; el aislamiento dependia solo de las cuatro previstas';
  END IF;
END $$;

-- Las cuatro politicas correctas, con el mismo texto que ya usan 003 y 017.
-- is_enabled() se mantiene: una cuenta desactivada no lee ni escribe.
DROP POLICY IF EXISTS "moods_select_policy" ON public.moods;
CREATE POLICY "moods_select_policy" ON public.moods FOR SELECT
  USING (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "moods_insert_policy" ON public.moods;
CREATE POLICY "moods_insert_policy" ON public.moods FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "moods_update_policy" ON public.moods;
CREATE POLICY "moods_update_policy" ON public.moods FOR UPDATE
  USING (public.is_enabled() AND user_id::uuid = auth.uid())
  WITH CHECK (public.is_enabled() AND user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "moods_delete_policy" ON public.moods;
CREATE POLICY "moods_delete_policy" ON public.moods FOR DELETE
  USING (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()));


-- ==========================================
-- 2 · PUSH_SUBSCRIPTIONS — el endpoint roto
-- ==========================================
-- Sintoma medido: hasta la service_role recibia
-- "permission denied for table push_subscriptions".
--
-- 018 creo la tabla y concedio SELECT, DELETE a authenticated, pero
-- no concedio nada a service_role. Y api/push.js, que es quien guarda
-- y borra las suscripciones, se autentica CON service_role. Es decir:
-- el alta de suscripciones push estaba rota desde que se aplico 018.
--
-- service_role tiene BYPASSRLS, asi que aqui no hay problema de
-- Aislamiento: el aislamiento lo aporta el endpoint, que valida la
-- sesion en servidor antes de tocar nada.

GRANT ALL ON public.push_subscriptions TO service_role;


-- ==========================================
-- 3 · AUDITORIA — solo lectura, no cambia nada
-- ==========================================
-- Ejecuta esto AL FINAL y pega el resultado. Lista cada politica con su
-- expresion, que es lo unico que falta para revisar a mano el resto de
-- tablas: si alguna USING no menciona auth.uid() ni is_admin() en una
-- tabla con user_id, es una fuga mas como la de moods.
--
-- Para content esta tabla es legitima: su contenido es comun y
-- content_read_all = USING (is_enabled()) es lo correcto.

SELECT
  tablename,
  policyname,
  cmd,
  permissive,
  qual                                                        AS using_expr,
  CASE
    WHEN qual IS NULL THEN NULL
    WHEN qual ~ 'auth\.uid\(\)' OR qual ~ 'is_admin\(\)' THEN 'ok: mira al dueno'
    WHEN tablename = 'content' AND qual ~ 'is_enabled\(\)' THEN 'ok: contenido comun'
    ELSE 'REVISAR: no mira al dueno'
  END                                                          AS veredicto
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, cmd, policyname;
