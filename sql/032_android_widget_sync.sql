-- Credenciales revocables para el launcher. Solo la API puede leerlas.
create table if not exists public.widget_installations (
  installation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  previous_token_hash text,
  previous_valid_until timestamptz,
  messaging_token text,
  expires_at timestamptz not null,
  primary key (installation_id, user_id)
);

alter table public.widget_installations enable row level security;
revoke all on public.widget_installations from anon, authenticated;
grant select, insert, update, delete on public.widget_installations to service_role;
create index if not exists widget_installations_previous_token_idx
  on public.widget_installations (previous_token_hash) where previous_token_hash is not null;
create index if not exists widget_installations_user_idx on public.widget_installations (user_id);

-- Estas concesiones también son necesarias para el GPS directo de Android y
-- el mapa. Las políticas de 029 siguen limitando lectura y escritura por pareja.
grant select on public.couple_members to authenticated, service_role;
grant select, insert, update on public.couple_locations to authenticated;
grant select on public.couple_locations to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.couple_locations;
  end if;
exception when duplicate_object then null;
end $$;

-- La consulta periódica funciona sin pg_net. Con Supabase Vault + pg_net,
-- las escrituras también despiertan los widgets con un FCM sin datos privados.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net no disponible. Los widgets usarán sincronización periódica.';
end $$;

create or replace function public.notify_android_widgets()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  recipients uuid[];
  endpoint text;
  webhook_secret text;
begin
  case tg_table_name
    when 'couple_locations' then
      select array_agg(user_id) into recipients from public.couple_members
      where couple_id = (current_row->>'couple_id')::uuid;
      if recipients is null then return null; end if;
    when 'moods' then
      select array_agg(member.user_id) into recipients
      from public.couple_members as member
      join public.couple_members as author using (couple_id)
      where author.user_id = (current_row->>'user_id')::uuid;
      recipients := coalesce(recipients, array[(current_row->>'user_id')::uuid]);
    when 'content' then
      if current_row->>'id' not in ('hub_dates', 'series', 'gifts', 'openwhen_letters', 'razones') then
        return null;
      end if;
    when 'user_progress' then
      if current_row->>'type' <> 'series_progress' then return null; end if;
      recipients := array[(current_row->>'user_id')::uuid];
    when 'analytics_visits' then
      if current_row->>'page' not like '/openwhen/leido/%'
        or current_row->>'user_id' !~ '^[a-f0-9-]{36}$' then return null; end if;
      recipients := array[(current_row->>'user_id')::uuid];
    when 'cycle_settings', 'cycle_periods' then
      recipients := array[(current_row->>'user_id')::uuid];
    when 'profiles' then
      select array_agg(member.user_id) into recipients
      from public.couple_members as member
      join public.couple_members as author using (couple_id)
      where author.user_id = (current_row->>'id')::uuid;
      recipients := coalesce(recipients, array[(current_row->>'id')::uuid]);
    else return null;
  end case;

  if not exists (
    select 1 from public.widget_installations i
    where i.messaging_token is not null and i.expires_at > now()
      and (recipients is null or i.user_id = any(recipients))
  ) then return null; end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return null; end if;

  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'android_widget_webhook_url' limit 1;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'android_widget_webhook_secret' limit 1;
  if endpoint is null or endpoint not like 'https://%' or webhook_secret is null or webhook_secret = '' then
    return null;
  end if;

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('userIds', recipients),
    timeout_milliseconds := 8000
  );
  return null;
exception when others then
  -- La entrega del aviso nunca impide guardar la actualización original.
  raise log 'No se pudo encolar sincronización de widgets: %', sqlstate;
  return null;
end;
$$;

revoke all on function public.notify_android_widgets() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'couple_locations', 'moods', 'content', 'user_progress', 'analytics_visits',
    'cycle_settings', 'cycle_periods', 'profiles'
  ] loop
    if to_regclass('public.' || table_name) is null then continue; end if;
    execute format('drop trigger if exists android_widget_changed on public.%I', table_name);
    execute format(
      'create trigger android_widget_changed after insert or update or delete on public.%I
       for each row execute function public.notify_android_widgets()', table_name
    );
  end loop;
end $$;
