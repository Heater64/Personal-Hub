-- ============================================================
-- 047 · SERIES — LA PAREJA PUEDE LEER EL TOP 5 DEL OTRO
-- ============================================================
-- La pantalla «Top 5» enseña el ranking de las dos cuentas y los gustos en
-- común. El ranking vive en user_progress ('series_podio') y la RLS solo
-- permitía leer la fila propia (o al admin todas). La usuaria no podía leer
-- el ranking del admin.
--
-- Esta migración abre solo lectura del Top 5 entre pareja, reutilizando la
-- función is_tamp_partner de la 033. El progreso completo (episodios vistos,
-- valoraciones e historial) sigue siendo privado para la cuenta propietaria.
-- Insert/update/delete siguen siendo exclusivamente del propietario (y del
-- admin, como hasta ahora): nadie puede modificar el ranking del otro.
--
-- Idempotente: DROP + CREATE, igual que las migraciones anteriores.
-- No toca datos.
-- ============================================================

DROP POLICY IF EXISTS "user_progress_select_own" ON public.user_progress;
CREATE POLICY "user_progress_select_own" ON public.user_progress FOR SELECT
  USING (
    public.is_enabled()
    AND (
      user_id::uuid = auth.uid()
      OR public.is_admin()
      OR (
        type = 'series_podio'
        AND public.is_tamp_partner(user_id::uuid)
      )
    )
  );

-- Comprobación de solo lectura (ejecutar con ambas cuentas):
--   SELECT user_id, type FROM public.user_progress
--    WHERE type = 'series_podio';
-- La usuaria debe ver su fila y la del admin; el admin, las dos.
