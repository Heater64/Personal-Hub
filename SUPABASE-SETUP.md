# Supabase — Setup completo (SQL + variables)

El esquema se aplica desde la carpeta **`sql/`**, archivo por archivo, en orden
numérico (ver `sql/README.md`). `supabase-schema.sql` es el monolítico
histórico: úsalo solo para una base vacía de verdad, no para actualizar una
que ya tiene `sql/` aplicado.
Si notas fallos tipo "RLS / row-level security" al guardar contenido, significa que este esquema
NO se ha aplicado aún en tu proyecto de Supabase: las políticas no existen y la tabla queda
en modo denegar-todo.

---

## 1. Aplicar el esquema (hacerlo UNA vez)

1. Abre [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **SQL Editor**.
2. Ejecuta los archivos de `sql/` en orden: `000` → `023`. Cada uno es
   **idempotente**: puedes volver a ejecutarlo sin romper nada
   (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`).
3. Para una base que ya está en marcha, sube **solo los que falten**
   (los últimos son `017` a `023`; ver `sql/README.md`).

### Qué crea

| Tipo | Elementos |
|------|-----------|
| Tablas | `content`, `moods`, `activity_log`, `profiles`, `user_progress`, `analytics_visits`, `analytics_events`, `admin_actions`, `game_rooms`, `game_invitations`, `game_room_players`, `playlists` (playlists personales aisladas por propietario) |
| Funciones | `is_admin()`, `handle_new_user()`, `prevent_role_escalation()`, `get_game_invite_targets()`, `create_game_invitation()`, `respond_game_invitation()`, `cancel_game_room()`, `get_game_player_state()`, `submit_battleship_move()`, `submit_game_move()`, `request_game_rematch()`, `game_has_line()` |
| Triggers | `on_auth_user_created` (crea perfil al registrarse), `profiles_prevent_role_change` (anti-escalada de rol) |
| Buckets | `avatars`, `galeria`, `memes`, `audios` (+ políticas RLS: lectura pública, escritura admin/carpeta propia) |
| Realtime | `content`, `game_rooms`, `game_invitations` añadidos a la publicación `supabase_realtime` |
| Seeds | `razones`, `canciones`, `noticias`, `gifts`, `maldia_frases`, `maldia_mensajes`, `changelog`, `series`, `rincon_covers`, `audios`, `openwhen_letters` |

### Verificación rápida (SQL Editor)

```sql
-- 1. Tablas creadas
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 2. Funciones creadas
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY proname;

-- 3. Políticas RLS activas (debe haber varias, no solo las por defecto)
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- 4. Buckets de storage
SELECT id, name, public FROM storage.buckets ORDER BY id;

-- 5. Realtime habilitado
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;

-- 6. El admin existe y tiene rol admin (ajusta el email si cambiaste el admin)
SELECT id, email, role, enabled FROM public.profiles WHERE role = 'admin';
```

> La primera vez que el admin (u otro usuario) inicia sesión, el trigger `on_auth_user_created`
> crea su fila en `profiles`. El email `admin@personalhub.com` se marca como `admin` automáticamente, pero solo una cuenta con correo confirmado puede ejercer privilegios.

### Migraciones de seguridad obligatorias

Después del esquema base, ejecuta `sql/016` a `sql/018` en orden:

**`sql/016_aislamiento_playlists.sql`**

- elimina las políticas `USING (true)` de playlists;
- impide que un usuario lea, modifique o borre playlists de otro;
- impide insertar actividad y analítica atribuidas a otro `user_id`;
- protege `profiles.role` y `profiles.enabled` frente a cambios del propio usuario.

Las playlists históricas con `created_by IS NULL` no se reasignan automáticamente. Debe hacerlo un administrador de forma explícita tras identificar al propietario real.

**`sql/017_enabled_autoritativo.sql`**

- `profiles.enabled` pasa a ser la **única** fuente de verdad: el login, las
  rutas protegidas, las APIs y las RLS consultan `public.is_enabled()`.
- Impide que un usuario se auto-habilite o se auto-asigne el rol `admin`
  editando su propio `user_metadata` (antes solo se protegía `profiles`).
- Un administrador deshabilitado pierde el acceso en el acto, aunque tenga
  la sesión abierta.
- Cierra las cuentas que el panel ya tenía marcadas como deshabilitadas.

**`sql/018_push_subscriptions.sql`**

- Saca las suscripciones de push de la fila global de `content` —que era
  legible por **cualquier** usuario autenticado, con su endpoint y claves de
  cifrado— a una tabla `push_subscriptions` con RLS por usuario.
- Copia los datos existentes y solo borra la fila antigua cuando el recuento
  coincide. Hay copia de seguridad en `push_subscriptions_legacy_backup`.

**`sql/022_push_reminders.sql`**

- Crea `push_reminders` (título, mensaje, destino, cuándo y cada cuánto) y
  `push_logs` (qué se envió y a quién).
- RLS de solo lectura para el **admin**; el cliente no escribe: el alta, la
  edición y el borrado pasan por `/api/push?action=reminders`, que valida la
  sesión en servidor con `service_role`.
- No toca datos existentes. El disparador periódico es el paso siguiente (§4).

**`sql/023_notification_prefs.sql`**

- Crea `notification_prefs`: los cuatro tipos de aviso (diario, cartas, ánimo
  y recordatorios) y el horario de silencio, **por persona**.
- RLS de dueño: cada uno lee y escribe solo su fila (`user_id = auth.uid()`),
  y solo con la cuenta habilitada. El admin las lee para poder explicar por
  qué no llegó algo, pero no las escribe. La API sí (con `service_role`).
- Antes, el horario de silencio y los interruptores vivían solo en el
  navegador: un aviso enviado por el servidor —el push diario o un
  recordatorio de 022— llegaba igual a quien había apagado esa categoría y
  a las 3 de la mañana a quien tenía silencio nocturno. Con esta tabla, el
  servidor lo respeta.

  Comportamiento que cambia: un recordatorio que caiga dentro del silencio
  **se aplaza** al fin del silencio en vez de perderse, y el saludo diario
  no se envía a quien tenga el recordatorio diario apagado (o el silencio
  cubriendo esa hora).

**`sql/024_admin_alerts.sql`**

- Añade cuatro columnas a `notification_prefs` (`admin_mood`,
  `admin_mood_changes`, `admin_notes`, `admin_health`), todas con `TRUE` por
  defecto: el seguimiento completo, que es lo que el admin ha pedido.
- Son los distintos avisos que recibe **él**, no ella: que ella registre su
  ánimo, que lo cambie el mismo día, que deje una nota en Mal Día, y los
  avisos técnicos (envíos fallidos, dispositivos caducados).
- No toca datos ni reescribe RLS: las políticas de 023 son por fila, así que
  cubren las columnas nuevas. El admin escribe sus interruptores y nadie
  puede apagárselos.

  Sin esta migración la API sigue funcionando (la lectura de esas columnas
  falla y el reparto entrega), pero **no se puede apagar** ninguna de las
  cuatro clases: se reciben todas.

**`sql/025_push_log_delivery.sql`**

- Añade `delivery_id` (token único por dispositivo y envío) y `delivered_at`
  a `push_logs`, más un `CHECK` de los estados como `NOT VALID` (no revienta
  por una fila antigua, pero cierra la puerta a estados inventados).
- Separa tres cosas: **enviado** (el push service aceptó el envío), **fallido**
  (lo rechazó) y **entregado al dispositivo** (el service worker mandó su acuse
  con el token que viajó en el payload).
- La fila se escribe **antes** de enviar, en `queued`: el acuse llega en cuanto
  el aviso se muestra, y una fila creada después no existiría todavía cuando el
  dispositivo confirma. `queued` es un estado transitorio; si se queda ahí, la
  ejecución murió a mitad y no se sabe si llegó a salir.
- Web Push no tiene recibo: sin esta migración el historial solo puede decir
  «enviado». El acuse devuelve **503** con la instrucción, no un 500 opaco.
- No promete «visto» en ningún caso. Un acuse prueba que el aviso llegó y se
  mostró; que se haya leído no lo sabe nadie (`seen_at` no existe a propósito).

---

## 2. Variables de entorno

### Local — ya en `.env`
- `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT`
- `CRON_SECRET` ✅ recién añadido (sin él, el push diario devuelve 500 "Cron secret not configured")

### Vercel (Project → Settings → Environment Variables) — añade las mismas
Además de las de arriba, **copia `CRON_SECRET` a Vercel** con el mismo valor: el cron
`/api/push?action=send` (vercel.json) se ejecuta una vez al día a las 06:00 UTC, compatible con Vercel Hobby. El endpoint acepta las 07:00/08:00 de Europe/Madrid para cubrir el cambio horario.

---

## 3. Comprobación funcional (navegador)

Tras aplicar el esquema:
1. **Inicia sesión con el admin** → escribe cualquier contenido (razón, canción, regalo, audio) →
   debe guardar en Supabase sin errores de RLS.
2. **El otro usuario** debe ver los cambios al instante (Realtime) o en ≤25 s (polling).
3. **Perfil**: subir avatar (bucket `avatars`).
4. **Multijugador** (Juegos): invitar al otro usuario, aceptar, jugar, revancha — todo por RPC.
5. **Recordatorios** (panel → Recordatorios): programa uno para un par de
   minutos después y comprueba que llega con la app **cerrada**. Enviarlo a
   mano desde la lista tiene que llegar al instante; los envíos quedan
   listados con su resultado (entregado, no enviado o el código de error).
6. **Preferencias (023)**: en Perfil apaga «Recordatorios» y programa uno
   desde el panel: no debe llegar y el historial tiene que decir «no enviado
   (avisos apagados)». Con el silencio activo a esa hora, se aplaza al fin
   del silencio en vez de perderse.

---

## 4. Programar los recordatorios (Supabase pg_cron)

`022` crea las tablas, pero **no** el reloj que las dispara. El cron de
Vercel solo corre **una vez al día** (límite de Vercel Hobby), así que un
recordatorio «a las 19:00» necesita un disparador propio. Lo más simple sin
salir de Supabase es `pg_cron` + `pg_net`: Supabase llama a la función de
Vercel cada minuto, y esa función es la misma que ya envía los push.

### 4.1 Guarda los dos secretos en Vault

SQL Editor → Database → Vault (o directamente en el SQL Editor):

```sql
-- La URL de producción del hub (ruta completa, sin barra final).
select vault.create_secret('https://TU-PROYECTO.vercel.app/api/push?action=run-reminders', 'push_cron_url');

-- El MISMO valor que tengas en CRON_SECRET en Vercel.
select vault.create_secret('PEGA_AQUI_TU_CRON_SECRET', 'push_cron_secret');
```

Si ya existían, usa `vault.update_secret` en vez de `create_secret`.

### 4.2 Activa las extensiones y programa el trabajo

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

```sql
select cron.schedule(
  'personal-hub-push-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
```

Para cambiarlo: `select cron.unschedule('personal-hub-push-reminders');` y volver a programarlo.

### 4.3 Comprobar que late

```sql
-- Estado del trabajo programado
select jobid, schedule, active from cron.job where jobname = 'personal-hub-push-reminders';

-- Últimas ejecuciones y sus códigos de respuesta HTTP
select status, return_message, start_time
  from cron.job_run_details
 order by start_time desc
 limit 10;

-- Qué se envió de verdad (esto lo rellena la API)
select r.title, l.status, l.error, l.sent_at
  from public.push_logs l
  left join public.push_reminders r on r.id = l.reminder_id
 order by l.sent_at desc
 limit 20;
```

Un 500 con `"Cron secret not configured"` significa que falta `CRON_SECRET`
en Vercel; un 403, que el valor de Vault no coincide con el de Vercel; un 503,
que falta aplicar `022`.

> Sin este paso los recordatorios **no se pierden**: el cron diario de Vercel
> los vacía al pasar por `/api/push?action=send`. Lo que no habría es avisos a
> la hora exacta, y los de una sola vez llegarían en el siguiente paso del
> cron diario.

Si algo falla tras esto, captura el mensaje exacto del error: casi siempre será
"column/policy missing" y el fix será SQL concreto que puedo generarte.
