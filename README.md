# Personal Hub 🧸🤍

SPA privada para dos personas: sorpresas diarias, biblioteca emocional, juegos, fotos y push.
Vite + Supabase (Auth/Postgres/Storage) + funciones serverless de Vercel.

---

## 1. Estructura

```
personal-hub/          Frontend (Vite). index.html → src/main.js
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

## 2. Puesta en marcha

```bash
npm install
cp .env.example .env      # plantilla en la raíz; rellena VITE_* (ver §3)
npm run dev               # http://localhost:5173
npm run build             # genera personal-hub/dist
npm run preview           # sirve el build
npm test                  # tests de contrato (prepush)
npm run lint              # ESLint mínimo
```

Contribuir / PRs: ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

`npm run dev` = `npx vite personal-hub`, y `npm run build` = `npx vite build personal-hub`.
Para cambiar de puerto: `npx vite personal-hub --port 5178 --strictPort`.

> Nota: el script histórico `FIX-SUPABASE.sql` está archivado en [`docs/archive/FIX-SUPABASE.sql`](docs/archive/FIX-SUPABASE.sql). Usa `sql/` como fuente de verdad (ver §4).

## 3. Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `VITE_SUPABASE_URL` | cliente (`.env` y `personal-hub/.env`) | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | cliente | clave anon, con RLS activa |
| `VITE_CLOUDINARY_CLOUD_NAME` | `personal-hub/.env` | subida de multimedia |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | `personal-hub/.env` | preset **unsigned** |
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

Vercel detecta el repo y `api/` como funciones serverless. El build es `npx vite build personal-hub`
y la salida `personal-hub/dist`.

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
- [ ] Confirmar si los buckets `galeria`, `memes` y `audios` deben ser públicos.

El detalle vive en [`docs/audit-readiness.md`](docs/audit-readiness.md).
