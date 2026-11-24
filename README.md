# Personal Hub 🧸🤍

SPA privada para dos personas: sorpresas diarias, biblioteca emocional, juegos, fotos y push.
Vite + Supabase (Auth/Postgres/Storage) + funciones serverless de Vercel.

---

## 1. Estructura

```
tamp/          Frontend (Vite). index.html → src/main.js
  public/              manifest.json, sw.js, offline.html, games/ (25 HTML sueltos)
  src/pages/           18 pantallas; las pesadas se cargan con import() diferido
  src/components/      shell, sidebar, bottom-nav, lightbox, page-header
  src/services/        supabase, auth, db, theme, notifications, pwa, gifts…
  src/data/            catálogos sin UI (Open When, calendario…)
  src/styles/          main.css (compartido) + un CSS por página
api/                   Funciones serverless Vercel: users, push, cloudinary, cron
sql/                   Migraciones incrementales — FUENTE DE VERDAD del esquema
supabase-schema.sql    Instantánea HISTÓRICA. No la ejecutes para actualizar.
tests/                 Tests de contrato (node --test), sin dependencias
vercel.json            Cabeceras de seguridad + cron diario de push
```

### Navegación y mundos

Las cuatro pestañas siguen siendo **Inicio · Rincón · Sentimientos · Perfil**, igual para las dos
cuentas. Los módulos no se duplican en pestañas nuevas: dentro de Rincón y de Sentimientos las
tarjetas se agrupan por **mundos** (Recuerdos, Sentimientos, Planes, Entretenimiento, Bienestar, Vida
cotidiana y Creatividad) con la etiqueta compartida `.mundo` de `src/styles/ui.css`.

El mapa módulo → mundo vive en `src/data/mundos.data.js` y es lo único que hay que tocar para mover
una tarjeta de sitio. Un mundo sin tarjetas no se pinta, y un módulo sin mundo asignado cae en «Más»
en vez de desaparecer. `tests/mundos.test.js` fija las tres cosas (y que no se cree ninguna ruta
`/mundos`).

**Piezas compartidas de pantalla** (Fase 3):

- **Cabecera**: `renderPageHeader({ title, subtitle, actions, back, className })` en
  `src/components/PageHeader.js` es el único patrón (título, subtítulo opcional, acciones y volver
  cuando toca). La usan Calendario, OpenWhen, OsitosWorld, Razones, la subcabecera de Rincón y
  Curiosidades; no queda marcado copiado a mano.
- **Estados**: `src/components/states.js` exporta `emptyStateHTML()` (mensaje claro + acción cuando
  tiene sentido) y `skeletonHTML()` / `skeletonCardsHTML()` (carga con filas o tarjetas). Se usan en
  el calendario mientras llega el catálogo, en el historial de Sentimientos y en la búsqueda de
  Curiosidades sin resultados. El brillo del skeleton se apaga con `prefers-reduced-motion`.
- **Transiciones**: el router añade `.route-enter` al montar la página (solo entrada, sin retrasar la
  navegación) y no la añade si el sistema pide movimiento reducido; el CSS además anula la animación
  en ese caso.
- **Búsqueda global**: `src/components/GlobalSearch.js` sobre la hoja compartida, con índice en
  `src/data/search.data.js` (las 11 tarjetas de los hubs + rutas reales, filtradas por rol). Se abre
  con **Ctrl/⌘ + K**, con el botón flotante en móvil y con la entrada del menú lateral: no hay pestaña
  ni ruta `/buscar`. Teclado completo (↑/↓, Enter, Escape), estado inicial con sugerencias y «sin
  resultados» explícito. `tests/fase3.test.js` fija que solo encuentre módulos reales.

**Datos de la fase Pro (Fase 5)**, todo sobre lo que ya existía y **sin migraciones**:

- `src/utils/pro-insights.js` reúne los cálculos puros que comparten varias pantallas: récords de los
  minijuegos (leídos de su `localStorage`), mejor racha y tira de 14 días de ánimo, razón del día
  (elegida por fecha, igual para las dos cuentas) y «un año hoy» a partir de la fecha que ya lleva la
  URL de cada foto.
- `src/services/pro.service.js` guarda la **watchlist compartida** en la fila `series_watchlist` de
  la tabla `content` que ya existe (el mismo patrón que la presencia y los catálogos). No hay tabla ni
  política nueva: las dos cuentas leen y escriben la misma lista y cada entrada recuerda quién la
  añadió.
- Los **widgets nuevos** (razón del día, Open When pendiente y racha) siguen el patrón de siempre:
  `widgets.service.js` escribe el paquete en Preferences y pide el repintado; en nativo,
  `ProWidgetProvider` delega en `WidgetRenderer.renderProText()` y comparten dos layouts
  (`widget_pro_rect`, `widget_pro_compact`). La hoja de widgets usa el paquete guardado y, si todavía
  no existe (siempre en el navegador), un ejemplo neutro (`PREVIEW_SAMPLES`), para que ninguna
  miniatura quede en blanco.
- `tests/fase5.test.js` fija los cálculos y los contratos de pantalla y de los seis receptores
  nativos. La suite queda en **363 tests**.

### Arranque y rendimiento

El bundle inicial lleva solo lo que se ve al entrar: tokens, base, componentes compartidos,
navegación, reproductor y visor. Cada pantalla importa su propia hoja de estilos y se monta con
`lazy()` (Login es la excepción: es la primera pantalla con la sesión cerrada). KaTeX tampoco viaja
en `index.html`: lo pide el calendario la primera vez que se abre (`loadKatex()` en
`src/utils/renderMath.js`). Medido al cerrar la fase 4: **253,72 kB de JS (gzip 79,81)** y **91,36 kB
de CSS (gzip 17,44)**, frente a 427,32 / 223,83 antes. Al cerrar la fase 5, con las tarjetas nuevas
en `ui.css`: **253,48 kB de JS (gzip 79,77)** y **94,58 kB de CSS (gzip 17,97)**.
`tests/fase4.test.js` impide que una hoja o una pantalla vuelvan al arranque sin querer.

## 2. Puesta en marcha

```bash
npm install
cp .env.example .env      # plantilla en la raíz; rellena VITE_* (ver §3)
npm run dev               # http://127.0.0.1:5175
npm run build             # genera tamp/dist
npm run preview           # sirve el build
npm test                  # tests de contrato (prepush)
npm run lint              # ESLint mínimo
```

Contribuir / PRs: ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

`npm run dev` = `npx vite tamp`, y `npm run build` = `npx vite build tamp`.
Para cambiar de puerto: `npx vite tamp --port 5178 --strictPort`.

> Nota: el script histórico `FIX-SUPABASE.sql` está archivado en [`docs/archive/FIX-SUPABASE.sql`](docs/archive/FIX-SUPABASE.sql). Usa `sql/` como fuente de verdad (ver §4).

## 3. Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `VITE_SUPABASE_URL` | cliente (`.env` y `tamp/.env`) | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | cliente | clave anon, con RLS activa |
| `VITE_CLOUDINARY_CLOUD_NAME` | `tamp/.env` | subida de multimedia |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | `tamp/.env` | preset **unsigned** |
| `SUPABASE_SERVICE_ROLE_KEY` | solo servidor | `api/*`. **Nunca** en el cliente |
| `VAPID_PUBLIC_KEY` | servidor | debe coincidir con el literal en `notifications.service.js` y `public/sw.js` |
| `VAPID_PRIVATE_KEY` | solo servidor | firma de los push |
| `VAPID_SUBJECT` | solo servidor | `mailto:` del remitente |
| `CRON_SECRET` | solo servidor | cabecera `Authorization` del cron |

Reglas: `VITE_*` acaba compilado en el bundle — nunca pongas un secreto ahí.
Las claves de servicio solo en Vercel (Settings → Environment Variables), nunca en un `.env` commiteado.

## 4. Migraciones de Supabase

**`sql/` es la fuente de verdad.** Se aplican en orden numérico en el SQL Editor.
`supabase-schema.sql` está congelado como referencia; no lo uses para actualizar una base existente.

El detalle de cada migración (peligrosidad, qué toca, cómo revertir) está en **[`sql/README.md`](sql/README.md)**.

### Orden recomendado para una base ya en producción

Las 017/018 son el endurecimiento de seguridad (RLS autoritativa + tabla de push). Son idempotentes:

1. **`017_enabled_autoritativo.sql`** — `profiles.enabled` pasa a ser la fuente de verdad de "puede entrar";
   protege `raw_user_meta_data` frente a auto-edición; cierra la fuga de suscripciones push.
2. **Despliega el código.** Funciona antes y después: `api/push.js` cae al almacenamiento
   legacy si la tabla nueva todavía no existe (`42P01`).
3. **`018_push_subscriptions.sql`** — mueve las suscripciones fuera de `content`. Solo borra
   la fila antigua si el recuento coincide; si no, avisa y la conserva.

### Recordatorios programados (022)

**`022_push_reminders.sql`** crea `push_reminders` (qué se envía, cuándo y cada cuánto) y
`push_logs` (qué llegó y a quién). El admin los escribe desde el panel, pero los manda el
**servidor**: llegan aunque nadie tenga la app abierta.

El reloj periódico es un paso aparte porque necesita la URL de producción y el `CRON_SECRET`:
se activa con Supabase `pg_cron` y está detallado en [`SUPABASE-SETUP.md`](SUPABASE-SETUP.md) §4.
Sin él, el cron diario de Vercel vacía igualmente los recordatorios vencidos (a su hora, no al minuto).

### Preferencias de avisos (023)

**`023_notification_prefs.sql`** lleva al servidor lo que antes solo sabía el navegador: qué tipos de
aviso quiere cada persona y en qué horas no quiere que suene. Un aviso enviado por el servidor
—el saludo diario y, sobre todo, un recordatorio— respeta desde entonces esos ajustes; un
recordatorio que caiga dentro del silencio se **aplaza** al fin del silencio en vez de perderse.
Sin la tabla aplicada, la app funciona igual (el cliente cae a `localStorage` y el servidor, sin
fila, entrega como antes).

`041_notification_prefs_delete_owner.sql` limita el borrado de esa fila a su dueño; el admin ya no
puede eliminar las preferencias de la otra cuenta.

`042_tmdb_rate_limit.sql` hace que el límite de búsquedas se comparta de forma atómica entre las
instancias de la API serverless; hay que aplicarla antes de publicar esa actualización de TMDB.

### Avisos del admin (024)

La app separa dos públicos. **Ella recibe contenido** (cartas nuevas de Open When, novedades del
calendario, los avisos que él escribe a mano) y el acuse de su propio ánimo. **El admin recibe
seguimiento**, y es él quien decide cuánto: cada clase tiene su interruptor en Perfil →
Notificaciones (solo visibles en su cuenta).

| Aviso | Cuándo suena | Interruptor |
|---|---|---|
| Registra su ánimo | cada vez que marca cómo está hoy | `admin_mood` |
| Mal día | si la puntuación es ≤ 2 (`enfadada`, `preocupada`, `triste`) | `admin_mood` |
| Cambia de ánimo | un estado nuevo que sustituye al de antes | `admin_mood_changes` |
| Nota de Mal Día | cuando deja una nota escrita para él | `admin_notes` |
| Técnicos | un envío falló o un dispositivo caducó | `admin_health` |

Dos decisiones que evitan que el teléfono suene de más: una **corrección rápida** (dentro de la
ventana de 5 min de `mood.store`) no avisa salvo que aterrice en un mal día, y un mal día lleva
`tag` propio para que un «Bien» posterior no lo reemplace sin que llegue a verse. El texto lo
compone el **servidor** a partir de la base de datos (el ánimo de hoy, la última nota) — el cuerpo
de la petición solo elige la clase. El silencio nocturno no descarta estos avisos: el service
worker los muestra sin sonido y quedan ahí, porque el evento ya ocurrió.

`sql/024_admin_alerts.sql` añade las columnas a `notification_prefs` con `TRUE` por defecto. Sin
aplicarla, la API entrega igual pero el admin no puede apagar ninguna clase.

Cada aviso abre la vista exacta, no el panel a secas: `/admin?section=moods` para el ánimo,
`?section=contenido&sub=maldia` para las notas y `?section=recordatorios` para los técnicos. El panel
lee ese `?section=` al montar —igual que el Rincón con `?tab=`— y **el servidor solo acepta
secciones que existan**: la lista vive en `api/push.js` y un test exige que coincida con la del menú,
así que añadir una sección y olvidarla en el servidor rompe los tests en vez de dejar un enlace
muerto.

### Entrega: «enviado» no es «entregado» (025)

Web Push **no tiene recibo**. Que FCM o Mozilla acepten un envío solo significa que lo aceptaron: el
móvil puede estar apagado, sin datos o con la app congelada. Por eso el historial separa tres cosas y
no las mezcla:

| Estado | Qué significa | Quién lo sabe |
|---|---|---|
| Enviado | el push service aceptó el envío | el servidor |
| Fallido | lo rechazó (410/404 = suscripción caducada) | el servidor |
| Entregado al dispositivo | el service worker lo recibió y confirmó | el dispositivo |

La confirmación es un token —`delivery_id`, un UUID distinto por dispositivo y envío— que viaja en
el payload; al recibirlo el service worker lo devuelve a `/api/push?action=ack` y esa fila pasa a
tener `delivered_at`. Que al móvil le llegue no marca el portátil: cada fila espera su propio acuse.

El historial se escribe **antes** de enviar, con el envío aún en `queued`. No es un adorno: el acuse
llega en cuanto el aviso se muestra, así que una fila creada después del envío no existiría todavía
cuando el dispositivo confirma, y la confirmación se perdería en silencio. Si el proceso muere a
mitad, la fila se queda en `queued`, que es la verdad — no se sabe si llegó a salir.

`sql/025_push_log_delivery.sql` añade las dos columnas y un `CHECK` (`NOT VALID`, para no reventar
por una fila antigua). Sin ella el envío funciona igual y el acuse responde 503 con la instrucción.

Lo que **no** dice ninguna columna es «visto»: un acuse prueba que el aviso llegó a un dispositivo y
se mostró, no que se haya leído. `seen_at` no existe a propósito.

### Instalación desde cero

```bash
# 1. sql/000_Reglas.sql … 016, en orden
# 2. sql/017_enabled_autoritativo.sql
# 3. sql/018_push_subscriptions.sql
# 4. sql/019 a sql/025 (aislamiento verificado, políticas permisivas, realtime,
#    recordatorios, preferencias de avisos, avisos del admin y acuse de entrega)
```

`000_Reglas.sql` avisa y se detiene si `user_profiles` tiene filas en lugar de borrarlas en cascada.

### Verificar que quedó bien

```sql
-- enabled manda: no debe haber Policies con USING (true) en estas tablas
select tablename, policyname from pg_policies
 where schemaname='public' and tablename in ('content','moods','user_progress','playlists')
 order by tablename;

-- La función autoritativa existe y es SECURITY DEFINER
select proname, prosecdef from pg_proc where proname in ('is_enabled','is_admin');

-- Las suscripciones ya no viven en content
select count(*) from push_subscriptions;
select count(*) from content where id = 'push_subscriptions';

-- Los recordatorios (022) existen, con RLS activa
select relname, relrowsecurity from pg_class where relname in ('push_reminders','push_logs');
```

## 5. Despliegue

Vercel detecta el repo y `api/` como funciones serverless. El build es `npx vite build tamp`
y la salida `tamp/dist`.

1. `git push` a la rama de producción → Vercel despliega.
2. Si tocaste SQL, aplica las migraciones **antes** de desplegar el código que las exige
   (o usa el orden 017 → código → 018 de §4).
3. Comprueba en `/api/users` que responde 401 sin token, no 500.

### Rollback

- **Código:** Vercel → Deployments → promoting el anterior. Los chunks con hash cambiado
  dejan de existir, pero el service worker sirve la copia en caché y vuelve al fresco en línea.
- **SQL:** las 017/018 son reversibles a mano (el propio archivo documenta el `DROP`).
  Antes de revertir `018`, copia `push_subscriptions` a `content` de nuevo.

## 6. Seguridad: qué protege cada capa

| Capa | Guarantee |
|---|---|
| `profiles.enabled` | Única fuente de verdad. Trigger impide que el cliente lo cambie |
| `is_enabled()` | `SECURITY DEFINER`; RLS de moods, progreso, playlists, content, analítica |
| `protect_user_metadata()` | Bloquea editar `enabled`/`role` en `auth.users.raw_user_meta_data` |
| `api/_admin.js` | El rol sale de `profiles`, no del token ni de metadata |
| `api/push.js` | Exige sesión **y** `enabled`; el envío diario exige admin |
| `push_subscriptions` | `REVOKE` a `anon`, sin INSERT/UPDATE desde el cliente |
| `push_reminders` | Solo el admin lee; escribir exige su sesión en `/api/push?action=reminders` |
| `notification_prefs` | RLS de dueño (`user_id = auth.uid()`): nadie puede apagarle los avisos a otro. Incluye los del admin (024) |
| `public/sw.js` | No cachea `/api/*` ni peticiones con `Authorization` |
| `Content-Security-Policy` | Cierra orígenes de script, conexiones (solo el propio y Supabase), plugins y enmarcado. `tests/security-headers.test.js` la vigila |
| `Permissions-Policy` | Cámara y micro cerrados; **geolocalización permitida al propio origen** (`geolocation=(self)`), sin la cual la distancia y el mapa no funcionan en producción |

Detalles y consultas de comprobación: [`sql/README.md`](sql/README.md) y
[`SUPABASE-SETUP.md`](SUPABASE-SETUP.md).

## 7. Rendimiento

El bundle se divide por página: `main.css` solo carga lo transversal (tokens, reset, ui, nav) y
cada pantalla diferida importa su propio CSS desde su módulo JS. Vite lo empaqueta en el mismo
chunk, así que abrir una sección descarga su estilo y su código juntos.

| | Antes | Ahora |
|---|---|---|
| JS inicial | ~392 kB (gzip 114) | **~261 kB (gzip 79)** |
| CSS inicial | ~426 kB (gzip 65) | **~141 kB (gzip 25)** |

Los tests `prepush.test.js` bloquean una regresión: si alguien vuelve a meter un CSS de página
en `main.css`, o enruta una página pesada sin `lazy()`, CI falla.

## 8. Tests

```bash
npm test
```

Tests de contrato sobre el código fuente (no requieren red ni navegador): RLS y migraciones,
policies, la API de push, la programación de los recordatorios (incluidos los dos cambios de
hora), el catálogo del calendario, la coherencia de temas/paletas, y el code-splitting. No
sustituyen a las pruebas manuales de §9.

## 9. Pendiente antes de abrirla a más gente

- [ ] Aplicar 017 a 022 en Supabase (requiere el SQL Editor).
- [ ] Programar `pg_cron` para los recordatorios y comprobar que el trabajo late (SUPABASE-SETUP §4).
- [ ] Probar en dos dispositivos que un ajuste de notificaciones se sincroniza (023) y que un recordatorio en horario de silencio se aplaza.
- [ ] Probar aislamiento real con dos cuentas (leer/escribir/borrar cruzados, manipular `user_id`).
- [ ] Probar PWA en un Android y un iOS reales: instalación, safe areas, push, actualización del SW.
- [ ] Backup cifrado + restauración probada en staging. RPO/RTO definidos.
- [ ] SPF, DKIM y DMARC del proveedor de correo.
- [ ] **Multimedia privado (fase 2 de [`docs/2026-11-19-plan-umbra.md`](docs/2026-11-19-plan-umbra.md)).**
  Estado: **código hecho y verificado en local; `sql/030_media_privado.sql` escrito pero NO aplicado.**
  Los buckets `galeria`, `memes`, `audios` y `avatars` siguen **públicos** en el proyecto real, así que
  hoy la app se comporta igual que antes.

  Lo que ya está:
  - `tamp/src/services/media.service.js`: URL pública → ruta, firma por lote, caché con
    caducidad, renovación antes de expirar, deduplicación (una firma por objeto, no por render) y paso
    directo para Cloudinary.
  - Galería, memes, audios, avatares, lightbox, fondos de Juntos y portada de Inicio piden su URL con
    `mediaUrl()`; la galería firma antes de pintar.
  - Degradación: si firmar falla o el objeto ya no existe, se usa la URL original y la vista no se
    rompe; `installMediaFallback()` reintenta una vez los `img/video/audio` rotos.
  - Las subidas firman lo recién subido antes de devolverlo, y la migración recrea la política de
    escritura tal como estaba (admin en galería/memes/audios, dueño o admin en avatares), sin
    escritura anónima. Ese camino con el bucket ya privatizado todavía no se ha probado.
  - `tests/media-private.test.js` (26 tests): firma, renovación, fallo, objeto inexistente, respaldo y
    forma del SQL.
  - Verificado en local: `npm test` **309/309 en verde** (26 de ellos nuevos de esta fase; la misma
    suite sigue verde hoy con 310/310 por pruebas que se siguen añadiendo en local), `npm run build`
    correcto, `eslint` sin errores en lo tocado y comprobación en navegador contra los buckets tal como
    están hoy (una sola firma por foto, degradación correcta y **cero violaciones de CSP**, solo el 401
    esperado sin sesión).

  Orden obligatorio (aún pendiente):
  1. Desplegar este código con los buckets **todavía públicos**: no cambia nada visible.
  2. Aplicar [`sql/030_media_privado.sql`](sql/030_media_privado.sql) — **este y ningún otro** — en el
     SQL Editor de Supabase. Es idempotente y no borra, mueve ni reescribe objetos: solo pone los
     cuatro buckets en privado y deja la lectura a sesiones `authenticated`.
     Ojo: en `sql/` ya existe `030_inicializar_pareja_actual.sql` (trabajo local del usuario). Comparten
     prefijo, pero el de esta fase es exactamente `030_media_privado.sql`.
  3. Verificar con las dos cuentas: una URL pública sin sesión debe dar 400/403; galería, memes, audios
     y avatares deben seguir viéndose (con favoritos y lightbox); y subir una foto y un avatar debe
     seguir funcionando. Si algo va mal, el bloque de rollback comentado al final de `030` devuelve los
     buckets a públicos sin tocar datos.
  **Nada de ese paso 3 está comprobado por mí**: no hay sesión iniciada ni buckets privatizados en esta
  verificación, así que el resultado en el proyecto real (y en producción) sigue sin confirmar.

El detalle vive en [`docs/audit-readiness.md`](docs/audit-readiness.md).
