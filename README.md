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

### Instalación desde cero

```bash
# 1. sql/000_Reglas.sql … 016, en orden
# 2. sql/017_enabled_autoritativo.sql
# 3. sql/018_push_subscriptions.sql
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
policies, la API de push, el catálogo del calendario, la coherencia de temas/paletas, y el
code-splitting. No sustituyen a las pruebas manuales de §9.

## 9. Pendiente antes de abrirla a más gente

- [ ] Aplicar 017 y 018 en Supabase (requiere el SQL Editor).
- [ ] Probar aislamiento real con dos cuentas (leer/escribir/borrar cruzados, manipular `user_id`).
- [ ] Probar PWA en un Android y un iOS reales: instalación, safe areas, push, actualización del SW.
- [ ] Backup cifrado + restauración probada en staging. RPO/RTO definidos.
- [ ] SPF, DKIM y DMARC del proveedor de correo.
- [ ] Confirmar si los buckets `galeria`, `memes` y `audios` deben ser públicos.

El detalle vive en [`docs/audit-readiness.md`](docs/audit-readiness.md).
