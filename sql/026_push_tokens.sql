-- ==========================================
-- 026 — Tokens de la app nativa (FCM)
--
-- Web Push y FCM son dos canales distintos y ninguno sustituye al otro:
--   · push_subscriptions  → navegador y PWA instalada (Web Push, VAPID)
--   · push_tokens         → app Android (FCM)
-- Un mismo usuario puede tener las dos cosas a la vez, y por eso son tablas
-- separadas: rotar una no toca la otra.
--
-- QUIÉN ESCRIBE: solo el servidor (service role), a través de
-- /api/push?action=token, que exige sesión y `profiles.enabled`. El cliente
-- no inserta ni actualiza nada aquí: el mismo criterio que en 018, para que
-- un token no se pueda mover de cuenta ni reactivar a mano.
-- QUIÉN LEE: el servidor para enviar, y el dueño sus propias filas (por si
-- quiere ver los dispositivos dados de alta).
--
-- Idempotente: se puede aplicar dos veces.
-- ==========================================

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- El token de FCM es único en todo el proyecto, no por usuario: si el
  -- mismo móvil cambia de cuenta, la fila se reasigna en vez de duplicarse.
  token text not null unique,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id) where enabled;

alter table public.push_tokens enable row level security;

-- anon no toca nada: ni lectura (los tokens son identificadores de envío).
revoke all on public.push_tokens from anon;
revoke insert, update on public.push_tokens from authenticated;
grant select, delete on public.push_tokens to authenticated;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select using (user_id = auth.uid());

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
  for delete using (user_id = auth.uid());

-- Comprobación rápida tras aplicar:
--   select relrowsecurity from pg_class where relname = 'push_tokens';  -- t
--   select count(*) from push_tokens;
