# Carpeta `sql/` — Schema de Supabase por dominios

El schema está dividido en archivos numerados por dominio, en lugar de un
único `supabase-schema.sql` gigante. Así cada cambio es pequeño, revisable y
se puede subir solo el archivo afectado desde el SQL Editor de Supabase.

Todos los archivos son **idempotentes**: se pueden re-ejecutar sin romper nada
(`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS` antes de cada
`CREATE POLICY`, `DO $$ ... EXCEPTION`).

---

## Orden de ejecución

Los archivos **dependen entre sí** — ejecútalos en orden numérico.

| # | Archivo | Contenido | Efecto |
|---|---------|-----------|---------|
| 000 | `000_Reglas.sql` | Permisos base, helper `is_admin()`, limpieza de `user_profiles` | ⚠️ borra `user_profiles` **solo si está vacía** |
| 001 | `001_Usuarios.sql` | Tabla `profiles`, triggers de perfil y anti-escalación | crea tabla |
| 002 | `002_Contenido.sql` | Tabla `content` + datos iniciales | crea tabla + 12 filas base |
| 003 | `003_Moods.sql` | Estados de ánimo diarios (Sentimientos) | crea tabla |
| 004 | `004_Actividad.sql` | `activity_log`, `analytics_visits`, `analytics_events`, `admin_actions` | crea tablas |
| 005 | `005_Progreso.sql` | Progreso por usuario (`user_progress`) | crea tabla |
| 006 | `006_Storage.sql` | Buckets públicos + políticas de Storage | crea buckets |
| 007 | `007_Juegos.sql` | Multijugador: salas, invitaciones, RPCs | crea tablas + funciones |
| 008 | `008_Playlists.sql` | Playlists de música | crea tabla |
| 009 | `009_avatares_invitaciones.sql` | Avatares e invitaciones por token | migraciones |
| 010 | `010_revanchas.sql` | Solicitudes de revancha | migraciones |
| 011 | `011_limpieza_partidas.sql` | Limpieza de partidas caducadas | migraciones |
| 012 | `012_juegos_online.sql` | Estado online de los juegos | migraciones |
| 013 | `013_escuchar_juntos.sql` | Sesiones de escuchar juntos | migraciones |
| 014 | `014_carrera_online.sql` | Carrera online | migraciones |
| 015 | `015_borrado_usuarios.sql` | Policies de borrado (admin) | policies |
| 016 | `016_aislamiento_playlists.sql` | Aislamiento real de playlists entre usuarios | policies |
| **017** | `017_enabled_autoritativo.sql` | **`enabled` como fuente de verdad en servidor** | 🔴 seguridad |
| **018** | `018_push_subscriptions.sql` | **Suscripciones de push en tabla propia con RLS** | 🔴 seguridad |
| **019** | `019_aislamiento_verificado.sql` | **Aislamiento comprobado con las dos cuentas reales** | 🔴 seguridad |
| **020** | `020_policies_permisivas.sql` | **Cierra las políticas `USING (true)` que dejó 016 sin aplicarse** | 🔴 seguridad |

---

## Aplicar sobre una base que YA tiene datos

**No ejecutes `000` a ciegas sobre producción.** Es el único archivo con
efecto destructivo (`DROP TABLE … CASCADE`), y solo actúa si `user_profiles`
existe **y está vacía**: si tiene filas, avisa con un `WARNING` y no hace
nada. Aun así, en una base viva lo razonable es **omitir 000–016** (ya están
aplicados) y subir solo lo nuevo:

1. `017_enabled_autoritativo.sql` — no toca datos, solo funciones,
   políticas y un `UPDATE` que marca `enabled = false` donde el admin ya
   lo había puesto a `false` en el panel. Es reversible con
   `UPDATE public.profiles SET enabled = true`.
2. `018_push_subscriptions.sql` — **copia antes de borrar**: hace una copia
   del JSON original en `push_subscriptions_legacy_backup` y solo elimina la
   fila de `content` si el número de suscripciones copiadas coincide con el
   original. Si algo no cuadra, deja la fila antigua intacta.
3. `019_aislamiento_verificado.sql` — corrige lo que se detectó al entrar de
   verdad con las dos cuentas. No toca datos: borra las políticas sobrantes
   de `moods` (había una permisiva que anulaba el aislamiento), recrea las
   cuatro correctas y devuelve a `service_role` el permiso sobre
   `push_subscriptions`, sin el cual `api/push.js` no podía funcionar. Al
   final trae una consulta de auditoría de solo lectura: **pégale el
   resultado** para revisar el resto de políticas a mano.
4. `020_policies_permisivas.sql` — resultado de esa auditoría. `playlists`
   seguía con `read_all`, `write_all`, `update_all` y `delete_all`
   permisivas (`USING (true)`), heredadas de `sql/016`, **que nunca se
   aplicó a esta base de datos**. Cualquier cuenta autenticada podía
   leer, modificar y borrar playlists ajenas. También elimina las
   políticas `*_insert_all` de telemetría, que anulaban las `*_insert_own`.
   **No apliques 016**: es anterior a 017/018 y revertiría el
   endurecimiento de `role` y `enabled`. 020 es quirúrgica, solo toca
   políticas.

### Orden recomendado para producción

```
017  →  despliegar el código (api/, public/sw.js, src/)
     →  018
```

El código nuevo funciona **antes y después** de 018: `api/push.js` usa la
tabla nueva si existe y, si no, cae al almacenamiento anterior. Por eso el
orden del código y el del SQL es intercambiable sin dejar a nadie sin
notificaciones.

### Verificar después de aplicar

```sql
-- 017: no debe devolver filas (metadata y profiles ya coinciden)
SELECT p.email, p.enabled
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
 WHERE u.raw_user_meta_data ->> 'enabled' = 'false'
   AND COALESCE(p.enabled, true);

-- 018: la fuga está cerrada si no devuelve nada
SELECT id FROM public.content WHERE id = 'push_subscriptions';

-- 018: sin suscripciones huérfanas
SELECT p.id, p.user_id
  FROM public.push_subscriptions p
  LEFT JOIN auth.users u ON u.id = p.user_id
 WHERE u.id IS NULL;
```

---

## Cómo usar

- **Base de datos nueva (vacía):** ejecutar 000 → 018 en orden.
- **Base existente:** subir solo los archivos desde el último aplicado.
- **Cambio puntual:** subir solo el archivo del dominio afectado.
- **Cambio nuevo:** añadirlo como `NNN_Nombre.sql` en su dominio, o extender
  el archivo de ese dominio si no necesita un orden nuevo.

---

## Dónde vive cada fuente de verdad

| Dato | Fuente de verdad | Por qué |
|------|------------------|---------|
| Rol (`admin`/`user`) | `profiles.role` | `user_metadata.role` lo edita el usuario; `prevent_role_escalation` bloquea el cambio desde el cliente |
| Cuenta habilitada | `profiles.enabled` | `user_metadata.enabled` es autoeditable; `is_enabled()` es lo que consultan las RLS |
| Emails de admin | `auth.users.email` verificado | Inmutable en el JWT; espejo en `ADMIN_EMAILS` (api/_admin.js, auth.service.js) y en `is_admin()` |
| Contenido de la app | `content` (JSONB por `id`) | Admin escribe, autenticados leen |
| Datos por usuario | Tablas con `user_id` + RLS | `moods`, `user_progress`, `playlists`, `push_subscriptions` |
| Suscripciones push | `push_subscriptions` | Antes en `content` (legible por cualquier autenticado) |

---

## `supabase-schema.sql` (raíz)

Es el **monolítico histórico**. Se conserva como referencia de qué tenía el
esquema en la migración inicial, pero **no es la fuente**: cualquier cambio
nuevo va en `sql/`. Si lo aplicas después de haber aplicado `sql/`, revierte
policies que las migraciones posteriores ya habían corregido (por ejemplo
`content_read_all USING (true)` sin `is_enabled()`, o la policy de borrado
de `user_progress` sin `USING`).
