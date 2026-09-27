# Auditoría de readiness — Personal Hub

Fecha de revisión: 2026-08-25
Última actualización: 2026-09-27

## 0. Estado a 2026-09-27

Desde esta revisión se cerró lo que era deuda interna del código **y** el aislamiento entre
cuentas, que era el P0 que quedaba. Las migraciones `017`, `018`, `019` y `020` ya están
aplicadas en Supabase y el resultado está comprobado con las dos cuentas reales.

### Aislamiento entre cuentas — cerrado

| Comprobación | Resultado |
|---|---|
| Lecturas cruzadas entre `admin` y `dada` | **Ninguna** en 11 tablas |
| Escritura en nombre del otro | **Rechazada por RLS** |
| Auto-promoción a admin / cambiar `enabled` | **Rechazada** (trigger) |
| `role` en `user_metadata` | **Descartado por la base** |
| Políticas `USING (true)` | **Ninguna** |

> Los dos scripts se ejecutan con las credenciales en variables de entorno, sin dejar
> ninguna en el repo: `scripts/verificar-aislamiento.mjs` y `scripts/verificar-escalada.mjs`.
> El segundo revierte con `service_role` cualquier cambio que se colara.

**Lo que queda pendiente ya no es de seguridad en el código**: backup/restauración, correo y
DNS (SPF/DKIM/DMARC), decidir si los buckets de Storage son públicos y probar la PWA en un
móvil físico.

### Deuda técnica cerrada

Resuelto en código (verificado con `npm test` = 35/35 y `npm run build` limpio):

| Hallazgo previo | Estado |
|---|---|
| `npm audit`: high en `nanoid` < 3.3.18 | **Resuelto** — 3.3.19, `0 vulnerabilities` |
| Sin workflow de CI | **Resuelto** — `.github/workflows/ci.yml`: test + build + audit + gate de secretos |
| Sin README operativo | **Resuelto** — `README.md` con migraciones, deploy, rollback y seguridad |
| `INEFFECTIVE_DYNAMIC_IMPORT` en el build | **Resuelto** — import estático; el catálogo de Open When se movió a `src/data/` |
| JS inicial ~447 KB sin comprimir | **Resuelto** — 263 kB (gzip 79), con Admin y Open When en chunks propios |
| CSS inicial ~518 KB sin comprimir | **Resuelto** — 141 kB (gzip 25), un CSS por página dentro de su chunk |
| Sin captura de errores ni Web Vitals | **Resuelto** — `src/services/telemetry.js`, opt-in y saneado |

Correcciones de seguridad aplicadas: `sql/017_enabled_autoritativo.sql` y
`sql/018_push_subscriptions.sql` **ya se ejecutaron** en la base de datos real.

**El aislamiento multiusuario por fin se comprobó con las dos cuentas reales**, y no salió
limpio: `dada` veía los estados de ánimo de `admin`. La causa era una policy permisiva extra
en `moods` que ninguna migración crea, así que se corrige en `sql/019_aislamiento_verificado.sql`
sin depender de su nombre. **Falta aplicar 019** y reejecutar `scripts/verificar-aislamiento.mjs`.

Los hallazgos P1/P2 sobre backups, correo/DNS, monitorización y dispositivos móviles reales
siguen **sin verificar**: requieren staging, un dominio y personas, no código.

## 1. Veredicto

**Estado: el aislamiento entre usuarios está comprobado y cerrado. Listo para las dos
cuentas que existen, pero no para público general.**

Lo que bloqueaba el lanzamiento era que nadie había comprobado si una cuenta podía ver o
tocar los datos de la otra. Eso ya se ha hecho con `admin@personalhub.com` y
`dada@personalhub.com`, y está cerrado: cero lecturas cruzadas, escrituras en nombre del
otro rechazadas y el modelo de roles verificado. Se encontraron y corrigieron dos fugas
reales por el camino (`moods` y `playlists`), ambas por políticas permisivas que nadie
había revisado.

El código local compila y los tests pasan. Sigue sin poder afirmarse que esté listo para
público general, pero ya no por seguridad en el código: falta probar la restauración de
backups, la entrega de correo/push, la configuración de DNS, la monitorización y el
comportamiento en dispositivos móviles reales. Eso requiere staging, un dominio y personas.

## 2. Arquitectura encontrada

- Frontend SPA vanilla JavaScript con Vite y routing basado en hash.
- Entrada: `personal-hub/index.html` → `personal-hub/src/main.js`.
- `Router` monta páginas directas o lazy-loaded, ejecuta guards y llama a `cleanup()` al cambiar de ruta.
- Estado global de usuario: Supabase Auth + `userStore`; preferencias locales con claves por usuario.
- Persistencia: Supabase para contenido, perfiles, ánimos, progreso, analítica y juegos; `localStorage` como espejo/fallback en varias áreas.
- Backend: funciones serverless en `api/` para usuarios, Cloudinary y Web Push.
- Datos y autorización: SQL monolítico `supabase-schema.sql` más migraciones incrementales en `sql/`.
- PWA: `public/manifest.json`, `public/sw.js` y `pwa.service.js`.
- Integraciones: Supabase, Cloudinary, Vercel Cron/Web Push, Google Fonts, jsDelivr/KaTeX, fuentes e imágenes externas.

## 3. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `npm test` | **35 tests pasados, 0 fallos** |
| `npm run build` | **Correcto, sin warnings** |
| `node --check` sobre APIs y servicios modificados | **Correcto** |
| `git diff --check` | **Correcto** |
| `npm audit --audit-level=high` | **Sin vulnerabilidades** |
| Recorrido de rutas diferidas en navegador | **Correcto**: Open When, Admin, Rincón, Canciones, Juegos, Calendario y Series cargan su chunk y su CSS |

El build emitía además un warning `INEFFECTIVE_DYNAMIC_IMPORT`: `notifications.service.js` se importaba de forma estática y dinámica, por lo que no se separaba en otro chunk. **Resuelto el 2026-09-27.**

## 4. Correcciones realizadas

- Cerrado el aislamiento de playlists con políticas basadas en `created_by`.
- Añadida `sql/016_aislamiento_playlists.sql` para aplicar la corrección en instalaciones existentes.
- Alineadas las políticas de playlists en `sql/008_Playlists.sql` y el esquema principal.
- Protegidos los inserts de actividad, visitas y eventos para que `user_id` coincida con `auth.uid()`.
- Protegida la creación de perfiles para impedir insertar `role = 'admin'` desde el cliente.
- Protegidos `profiles.role` y `profiles.enabled` con trigger; solo admin o `service_role` pueden modificarlos.
- Exigido correo confirmado para privilegios de administrador en frontend, APIs y SQL base.
- Corregido un `ReferenceError` en `sync.service.js` (`local` inexistente).
- Corregido el endpoint de push para que la desuscripción requiera sesión y no permita eliminar la suscripción de otro usuario por `endpoint`.
- Adaptado `/api/push?action=send` a `GET`/`POST` para Vercel Cron y añadido ventana `07:00–08:00` de `Europe/Madrid`.
- Configurado Vercel Cron diario a las 06:00 UTC, compatible con el plan Hobby; la hora local es 08:00 en verano y 07:00 en invierno.
- Corregido el cálculo de fecha del catálogo diario del push para usar `Europe/Madrid`.
- Sincronizado el estado `enabled` de Auth y `profiles` en `/api/users`.
- Añadidas cabeceras defensivas en `vercel.json`: `nosniff`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.
- Desactivado `trust` de KaTeX en el renderizado de contenido matemático.
- Añadidos gates estáticos para evitar regresiones en RLS, push y sincronización.

## 5. Hallazgos y riesgos

### P0 — bloqueadores

- **Aislamiento real probado el 2026-09-27: dos fugas encontradas.** Se entró de verdad con `admin@personalhub.com` y `dada@personalhub.com` y se comparó qué ve cada una con su propio token (`scripts/verificar-aislamiento.mjs`).
  1. **`moods`: RESUELTA.** `dada` leía 7 filas de `admin` siendo `is_admin() = false`. El `INSERT` sí estaba bloqueado, contraste que delata una **policy permisiva extra de solo SELECT** (las permisivas se combinan con OR). Corregida en `sql/019`, ya aplicada: la sonda vuelve a dar **63 filas propias, 0 ajenas**.
  2. **`playlists`: RESUELTA.** Tenia vivas `playlists_read_all`, `playlists_write_all`, `playlists_update_all` y `playlists_delete_all`, las cuatro con `USING (true)`: cualquier cuenta autenticada podía leer, modificar y borrar playlists ajenas. Comprobado con una sonda de escritura, no solo leyendo: `dada` conseguia crear una playlist a nombre de `admin`. La causa raíz era que **`sql/016` nunca se aplicó** a esta base de datos. Corregida en `sql/020`, ya aplicada: quedan solo las cuatro `_owner` y la sonda ahora la rechaza el RLS.
  3. **Modelo de roles: verificado.** `scripts/verificar-escalada.mjs` comprueba con la cuenta real que `dada` no puede: ponerse `role = 'admin'`, desactivarse a sí misma, tocar el `role` o el `enabled` de `admin`, modificar `content`, ni escribir `role` en su `user_metadata`. Las seis se rechazan. La de metadata es curiosa: `updateUser` no da error pero la base descarta la clave `role` en silencio.
  - El mismo patrón, más sutil, en telemetría: `activity_log_insert_all`, `analytics_visits_insert_all` y `analytics_events_insert_all` convivían con sus versiones `_own`. Por lo mismo, 020 las elimina.
  - Lección de método: **leer no detecta una policy `USING (true)` si la tabla está vacía.** Por eso la sonda del script escribe una fila de prueba en nombre del otro y la borra al instante; sin eso, playlists habría pasado la revisión con 0 filas de 0.
  - Segundo falso positivo, este en la consulta de auditoría: marcaba «REVISAR» en todo `UPDATE` con `with_check` nulo. En PostgreSQL, si una policy de UPDATE no define WITH CHECK, **se reutiliza el USING**: no es un agujero. Quedaba pendiente comprobarlo de otra forma, y se comprobó con las cuentas reales (`content` y `profiles` rechazan a `dada`).
- **Restauración de backup no probada.** No hay evidencia ejecutada de backup cifrado, retención ni restauración en staging.
- **Alta de push rota desde 018.** `sql/018_push_subscriptions.sql` concedió permisos a `authenticated` pero no a `service_role`, y `api/push.js` se autentica con `service_role`: hasta la service role recibía `permission denied for table push_subscriptions`. Se corrige en 019 con `GRANT ALL … TO service_role`.
- ~~**Dependencias con vulnerabilidad alta.**~~ **Resuelto** el 2026-09-27: `nanoid` subido a 3.3.19 y `npm audit --audit-level=high` sin resultados. El CI lo bloquea si vuelve a aparecer.
- ~~**Migraciones 017/018 sin aplicar.**~~ **Aplicadas** el 2026-09-27: `is_enabled()`, `is_admin()`, `profiles.enabled` y la tabla `push_subscriptions` existen en la base de datos real, y las dos cuentas están `enabled = true`.

### P1 — importantes

- **Migración SQL pendiente.** Aplicar `supabase-schema.sql` y después `sql/016_aislamiento_playlists.sql` en Supabase. Las filas históricas de playlists con `created_by IS NULL` deben reasignarse manualmente o permanecer inaccesibles.
- **Playlists compartidas ya no son compartidas.** Se adoptó aislamiento personal porque el diseño actual no tiene tabla de miembros. Si se necesita colaboración entre usuarios, crear una relación de miembros con permisos explícitos antes de reabrir acceso.
- **Storage público.** Los buckets `galeria`, `memes` y `audios` están configurados como públicos. Esto puede ser intencional para el producto, pero implica que cualquier URL conocida permite lectura. Si contienen datos privados, deben pasar a buckets privados con URLs firmadas.
- **CORS de push corregido, pero requiere despliegue.** La protección solo existe en el código hasta que se publique la función.
- **Correo y DNS no comprobados.** SPF, DKIM, DMARC, recuperación y confirmación de email requieren proveedor y dominio reales.

### P2 — deuda técnica

- ~~Bundle CSS principal de aproximadamente 518 KB sin comprimir.~~ **Resuelto** (2026-09-27): 141 kB / gzip 25 mediante un CSS por página cargado con su chunk.
- ~~Bundle inicial JavaScript de aproximadamente 447 KB sin comprimir.~~ **Resuelto** (2026-09-27): 263 kB / gzip 79 con Admin y Open When diferidos.
- ~~Import dinámico inefectivo de notificaciones.~~ **Resuelto** (2026-09-27): import estático y catálogo extraído a `src/data/openwhen.data.js`.
- Service Worker usa caché compleja de media y fallback offline, pero no se ha probado con desconexión real, Range requests y actualización entre versiones. **Sigue pendiente.** Fuera de la v10 ya no cachea `/api/*` ni peticiones autenticadas.
- ~~No hay workflow CI/CD en `.github/`.~~ **Resuelto** (2026-09-27): `.github/workflows/ci.yml`.
- ~~No existe README operativo completo en la raíz.~~ **Resuelto** (2026-09-27): `README.md`.
- ~~Sin captura de errores ni Web Vitals.~~ **Resuelto** (2026-09-27): `src/services/telemetry.js`, inactivo salvo que se defina `VITE_TELEMETRY_URL`.

### P3 — mejoras

- Añadir métricas de Web Vitals y captura de errores opcional.
- Añadir pruebas E2E responsive y de accesibilidad estructural.
- Reducir CSS global y dividir cargas de páginas pesadas.
- Completar runbooks independientes de despliegue, backup y recuperación.

## 6. Autenticación y autorización

- La sesión usa Supabase Auth con persistencia y auto-refresh.
- Los guards de router esperan la restauración inicial de sesión.
- Las rutas admin tienen guard frontend y las APIs validan el JWT en servidor.
- La clave `SUPABASE_SERVICE_ROLE_KEY` solo aparece en APIs serverless, no en `personal-hub/src`.
- El rol no se toma de `user_metadata.role`.
- El correo de administrador debe estar confirmado.
- Pendiente: probar registro, confirmación, recuperación, expiración, logout en varias pestañas y bloqueo de cuenta contra el proyecto Supabase real.

## 7. Autorización y aislamiento

Estado del código: **corregido estáticamente, no verificado operacionalmente**.

Debe ejecutarse en staging:

1. Crear usuario A y usuario B.
2. Intentar leer, insertar, modificar y borrar playlists cruzadas.
3. Repetir manipulando `user_id`, `created_by`, IDs de salas y payloads.
4. Verificar Storage por bucket y carpetas.
5. Probar RPCs de juegos, escucha conjunta y progreso con IDs ajenos.
6. Confirmar que un usuario deshabilitado no puede iniciar sesión ni reactivarse editando `profiles`.

## 8. PWA/mobile

Comprobado en código: manifest, scope `/`, `standalone`, icons, Service Worker, offline fallback y detección de instalación.

Pendiente de dispositivo real: instalación iOS/Android, safe areas, orientación, teclado, navegación atrás, push, rotación y actualización del Service Worker.

## 9. Backups y recuperación

No comprobado. Antes de release hay que definir y ejecutar:

- Backup cifrado de esquema, datos y Storage.
- Retención y rotación.
- RPO/RTO.
- Restauración completa en staging.
- Verificación de RLS, triggers, funciones y buckets tras restaurar.
- Procedimiento de emergencia y responsable.

No guardar dumps con datos personales en Git.

## 10. Tareas manuales obligatorias

1. ~~Aplicar `supabase-schema.sql`.~~ Hecho: el esquema ya existe en Supabase.
2. ~~Aplicar `sql/016_aislamiento_playlists.sql`.~~ **No se aplica**: es anterior a 017/018 y revertiría el endurecimiento de `role`/`enabled`. Lo que hacía ya está cubierto por `sql/020`, y el motivo está escrito en `sql/README.md`.
3. Revisar y reasignar playlists antiguas sin `created_by` (hoy la tabla está vacía, así que no hay ninguna).
4. Configurar y comprobar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, claves VAPID, `CRON_SECRET` y Cloudinary solo en sus entornos correctos.
5. Rotar cualquier secreto que haya estado expuesto fuera del gestor de secretos.
6. Configurar SPF, DKIM y DMARC del proveedor de correo.
7. Configurar monitorización, alertas y health checks.
8. Ejecutar las pruebas de aislamiento y restauración en staging.
9. Probar PWA en al menos un dispositivo Android y uno iOS.
10. Revisar legalmente privacidad, cookies, menores, analítica, licencias de música, imágenes, audios y vídeos.
11. ~~Actualizar `nanoid`/PostCSS hasta eliminar el resultado high de `npm audit`.~~ **Hecho** (2026-09-27); el CI lo vigila.

## 11. Bloqueadores de lanzamiento

- ~~Migraciones `sql/017` y `sql/018` pendientes de aplicar en Supabase.~~ **Resuelto** el 2026-09-27.
- ~~Falta de prueba real de aislamiento multiusuario.~~ **Resuelto** el 2026-09-27 con las dos cuentas reales, tras corregir dos fugas (`moods`, `playlists`) con `sql/019` y `sql/020`.
- Falta de prueba de backup/restauración.
- Falta de validación real de correo/DNS y monitorización.
- Falta de pruebas en dispositivos móviles reales.

Resuelto desde la revisión anterior: la vulnerabilidad high de `npm audit` (nanoid).

## 12. Archivos modificados durante la auditoría

Cambios propios de la auditoría: APIs de admin/push/users, autenticación, playlists, sync, SQL de seguridad, `vercel.json`, tests y documentación de Supabase.

También hay cambios concurrentes o previos en `personal-hub/index.html`, `personal-hub/src/pages/Admin.js`, `personal-hub/src/pages/Calendario.js`, `personal-hub/src/styles/calendario.css` y `personal-hub/src/utils/renderMath.js`. No se revirtieron ni se consideran validados funcionalmente más allá de que el build los incluye.
