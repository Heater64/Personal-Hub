# Supabase — Setup completo (SQL + variables)

Todo el SQL que la web necesita está en **`supabase-schema.sql`** (único archivo SQL del proyecto).
Si notas fallos tipo "RLS / row-level security" al guardar contenido, significa que este esquema
NO se ha aplicado aún en tu proyecto de Supabase: las políticas no existen y la tabla queda
en modo denegar-todo.

---

## 1. Aplicar el esquema (hacerlo UNA vez)

1. Abre [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **SQL Editor**.
2. Pega **TODO** el contenido de `supabase-schema.sql`.
3. Ejecuta (`Run`). Es **idempotente**: puedes volver a ejecutarlo sin romper nada
   (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`).

### Qué crea

| Tipo | Elementos |
|------|-----------|
| Tablas | `content`, `moods`, `activity_log`, `profiles`, `user_progress`, `analytics_visits`, `analytics_events`, `admin_actions`, `game_rooms`, `game_invitations`, `game_room_players`, `playlists` (playlists de música compartidas de la pareja) |
| Funciones | `is_admin()`, `handle_new_user()`, `prevent_role_escalation()`, `get_game_invite_targets()`, `create_game_invitation()`, `respond_game_invitation()`, `cancel_game_room()`, `get_game_player_state()`, `submit_battleship_move()`, `submit_game_move()`, `request_game_rematch()`, `game_has_line()` |
| Triggers | `on_auth_user_created` (crea perfil al registrarse), `profiles_prevent_role_change` (anti-escalada de rol) |
| Buckets | `avatars`, `galeria`, `memes` (+ políticas RLS: lectura pública, escritura admin/carpeta propia) |
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
> crea su fila en `profiles`. El email `admin@personalhub.com` se marca como `admin` automáticamente.

---

## 2. Variables de entorno

### Local — ya en `.env`
- `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT`
- `CRON_SECRET` ✅ recién añadido (sin él, el push diario devuelve 500 "Cron secret not configured")

### Vercel (Project → Settings → Environment Variables) — añade las mismas
Además de las de arriba, **copia `CRON_SECRET` a Vercel** con el mismo valor: el cron
`/api/push?action=send` (vercel.json, 06:00) se autentica con ese secret.

---

## 3. Comprobación funcional (navegador)

Tras aplicar el esquema:
1. **Inicia sesión con el admin** → escribe cualquier contenido (razón, canción, regalo, audio) →
   debe guardar en Supabase sin errores de RLS.
2. **El otro usuario** debe ver los cambios al instante (Realtime) o en ≤25 s (polling).
3. **Perfil**: subir avatar (bucket `avatars`).
4. **Multijugador** (Juegos): invitar al otro usuario, aceptar, jugar, revancha — todo por RPC.

Si algo falla tras esto, captura el mensaje exacto del error: casi siempre será
"column/policy missing" y el fix será SQL concreto que puedo generarte.
