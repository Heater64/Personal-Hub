# Auditoría de readiness — Personal Hub

Fecha de revisión: 2026-08-25

## 1. Veredicto

**Estado: no listo para usuarios reales sin tareas externas pendientes.**

El código local compila y los tests disponibles pasan. No se puede afirmar todavía que el producto esté listo para público general porque no se han podido comprobar con servicios reales y datos de staging el aislamiento entre dos usuarios, la restauración de backups, la entrega de correo/push, la configuración de DNS, la monitorización ni el comportamiento en dispositivos móviles reales.

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
| `npm test` | **8 tests pasados, 0 fallos** |
| `npm run build` | **Correcto** |
| `node --check` sobre APIs y servicios modificados | **Correcto** |
| `git diff --check` | **Correcto** |
| `npm audit --audit-level=high` | **Falla: 1 vulnerabilidad high en `nanoid` 3.3.16** |
| Preview HTML fuente/dist | **No válido como prueba de app: el servidor seguro devuelve 404 para módulos Vite y deja el splash** |

El build emite además un warning `INEFFECTIVE_DYNAMIC_IMPORT`: `notifications.service.js` se importa de forma estática y dinámica, por lo que no se separa en otro chunk.

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

- **Aislamiento real no probado en staging.** El repositorio contiene políticas endurecidas, pero no se ha podido crear dos usuarios reales ni manipular IDs/payloads desde dos sesiones. Debe probarse contra Supabase antes de release.
- **Restauración de backup no probada.** No hay evidencia ejecutada de backup cifrado, retención ni restauración en staging.
- **Dependencias con vulnerabilidad alta.** `npm audit --audit-level=high` reporta `nanoid < 3.3.18`, dependencia de desarrollo transitiva de PostCSS. Actualizar con `npm audit fix`/upgrade compatible y repetir build/test antes de publicar.

### P1 — importantes

- **Migración SQL pendiente.** Aplicar `supabase-schema.sql` y después `sql/016_aislamiento_playlists.sql` en Supabase. Las filas históricas de playlists con `created_by IS NULL` deben reasignarse manualmente o permanecer inaccesibles.
- **Playlists compartidas ya no son compartidas.** Se adoptó aislamiento personal porque el diseño actual no tiene tabla de miembros. Si se necesita colaboración entre usuarios, crear una relación de miembros con permisos explícitos antes de reabrir acceso.
- **Storage público.** Los buckets `galeria`, `memes` y `audios` están configurados como públicos. Esto puede ser intencional para el producto, pero implica que cualquier URL conocida permite lectura. Si contienen datos privados, deben pasar a buckets privados con URLs firmadas.
- **CORS de push corregido, pero requiere despliegue.** La protección solo existe en el código hasta que se publique la función.
- **Correo y DNS no comprobados.** SPF, DKIM, DMARC, recuperación y confirmación de email requieren proveedor y dominio reales.

### P2 — deuda técnica

- Bundle CSS principal de aproximadamente 518 KB sin comprimir.
- Bundle inicial JavaScript de aproximadamente 447 KB sin comprimir.
- Import dinámico inefectivo de notificaciones.
- Service Worker usa caché compleja de media y fallback offline, pero no se ha probado con desconexión real, Range requests y actualización entre versiones.
- No hay workflow CI/CD en `.github/` ni scripts separados para E2E, typecheck, lint, staging isolation, backups u operations.
- No existe README operativo completo en la raíz.

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

1. Aplicar `supabase-schema.sql`.
2. Aplicar `sql/016_aislamiento_playlists.sql`.
3. Revisar y reasignar playlists antiguas sin `created_by`.
4. Configurar y comprobar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, claves VAPID, `CRON_SECRET` y Cloudinary solo en sus entornos correctos.
5. Rotar cualquier secreto que haya estado expuesto fuera del gestor de secretos.
6. Configurar SPF, DKIM y DMARC del proveedor de correo.
7. Configurar monitorización, alertas y health checks.
8. Ejecutar las pruebas de aislamiento y restauración en staging.
9. Probar PWA en al menos un dispositivo Android y uno iOS.
10. Revisar legalmente privacidad, cookies, menores, analítica, licencias de música, imágenes, audios y vídeos.
11. Actualizar `nanoid`/PostCSS hasta eliminar el resultado high de `npm audit`.

## 11. Bloqueadores de lanzamiento

- Vulnerabilidad high de `npm audit` sin resolver.
- Falta de prueba real de aislamiento multiusuario.
- Falta de prueba de backup/restauración.
- Falta de validación real de correo/DNS y monitorización.
- Falta de pruebas en dispositivos móviles reales.
- Migración de Supabase pendiente de aplicar.

## 12. Archivos modificados durante la auditoría

Cambios propios de la auditoría: APIs de admin/push/users, autenticación, playlists, sync, SQL de seguridad, `vercel.json`, tests y documentación de Supabase.

También hay cambios concurrentes o previos en `personal-hub/index.html`, `personal-hub/src/pages/Admin.js`, `personal-hub/src/pages/Calendario.js`, `personal-hub/src/styles/calendario.css` y `personal-hub/src/utils/renderMath.js`. No se revirtieron ni se consideran validados funcionalmente más allá de que el build los incluye.
