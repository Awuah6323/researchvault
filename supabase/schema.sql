-- ResearchVault — Supabase schema
--
-- Run this ONCE in your Supabase project: Dashboard -> SQL Editor -> New query
-- -> paste all of it -> Run. It is safe to run again; every statement guards
-- against already existing.
--
-- What it creates:
--   public.vaults          one row per user, holding that user's library
--   Row Level Security     so a user can only ever touch their own row
--   handle_new_user()      creates the empty row when someone signs up
--   realtime publication   so other devices are notified the instant it changes
--
-- WHY ONE JSONB ROW instead of resources/notes/categories tables:
-- localStorage is the app's source of truth and the client already merges
-- concurrent edits itself (src/services/vaultMerge.js). The database's job here
-- is only to move an agreed-on snapshot between devices, so one row with an
-- integer version gives us an atomic compare-and-set — which is exactly what
-- the merge algorithm needs, and what a normalised schema would make harder.


-- ---------------------------------------------------------------- TABLE

create table if not exists public.vaults (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  vault      jsonb       not null default '{}'::jsonb,
  version    integer     not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.vaults is
  'One library snapshot per user. Metadata and notes only — PDF bytes stay on the device.';
comment on column public.vaults.version is
  'Monotonic. A write must name the version it read, so a stale write is rejected instead of overwriting a newer one.';

-- Guard against a runaway client. Vaults are metadata and notes; PDF blobs are
-- stripped client-side before upload, so 3 MB is generous.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vaults_size_limit'
  ) then
    alter table public.vaults
      add constraint vaults_size_limit
      check (octet_length(vault::text) <= 3 * 1024 * 1024);
  end if;
end $$;


-- ------------------------------------------------- ROW LEVEL SECURITY
--
-- This is the part that matters most. The anon key ships inside the app's
-- JavaScript, which is by design and safe ONLY because of these policies:
-- every statement is filtered to auth.uid(), the user id baked into the
-- caller's verified JWT. A client cannot ask for someone else's row, because
-- the filter is applied by Postgres and not by the client.
--
-- Without RLS enabled, that same anon key would read the whole table.

alter table public.vaults enable row level security;

drop policy if exists "Users read their own vault"   on public.vaults;
drop policy if exists "Users create their own vault" on public.vaults;
drop policy if exists "Users update their own vault" on public.vaults;

create policy "Users read their own vault"
  on public.vaults for select
  using (auth.uid() = user_id);

create policy "Users create their own vault"
  on public.vaults for insert
  with check (auth.uid() = user_id);

create policy "Users update their own vault"
  on public.vaults for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy on purpose: nothing in the app deletes a whole vault, and
-- omitting the policy means nothing can. Deleting the auth user cascades.


-- --------------------------------------------------- NEW USER TRIGGER
--
-- Gives every new account an empty vault row immediately, so the client never
-- has to handle "row might not exist yet" and can always use a plain UPDATE.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.vaults (user_id, vault, version)
  values (new.id, '{}'::jsonb, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this script ran.
insert into public.vaults (user_id, vault, version)
select id, '{}'::jsonb, 0 from auth.users
on conflict (user_id) do nothing;


-- ------------------------------------------------------------ REALTIME
--
-- Lets a device be notified the moment another device writes, instead of
-- polling. Realtime honours the RLS policies above, so a client is only ever
-- told about its own row.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'vaults'
  ) then
    alter publication supabase_realtime add table public.vaults;
  end if;
end $$;

-- Realtime sends the changed row; without this it would only send the primary
-- key, and the client could not read the new version number from the event.
alter table public.vaults replica identity full;


-- ------------------------------------------------------------ VERIFY
--
-- Run these after the script to confirm the security is actually on.
--
--   -- must return rowsecurity = true
--   select relname, relrowsecurity from pg_class where relname = 'vaults';
--
--   -- must return the three policies above
--   select policyname, cmd from pg_policies where tablename = 'vaults';
--
--   -- must return 0 rows: proves an unauthenticated caller sees nothing
--   set role anon;
--   select * from public.vaults;
--   reset role;


-- ------------------------------------------------ OPTIONAL HEALTH CHECK LOG
--
-- Optional persistent health-check log table.
-- Used if persistent recording of the 3x daily health check history is desired.

create table if not exists public.system_health_checks (
  id            bigint generated always as identity primary key,
  checked_at    timestamptz not null default now(),
  status        text not null check (status in ('ok', 'error')),
  duration_ms   integer,
  error_message text
);

alter table public.system_health_checks enable row level security;

-- Only service_role can write/read health checks by default.
-- Regular users / anon cannot access this table.
drop policy if exists "Service role full access to health checks" on public.system_health_checks;
create policy "Service role full access to health checks"
  on public.system_health_checks
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- ------------------------------------------------------ API RATE LIMIT STORE
--
-- Shared fixed-window counters for the functions in /api.
--
-- WHY THIS EXISTS: Vercel runs each function in isolated instances that scale
-- horizontally, so a counter held in one instance's memory is per-instance —
-- a caller spreading requests across warm instances gets a multiple of the
-- intended limit. Postgres is the one thing every instance already shares, so
-- one row per (bucket, identity, window) makes a single limit apply to all of
-- them without adding another service to the stack.
--
-- This table is written ONLY by the serverless functions, via the function
-- below, using the service_role key. It is never reachable from the browser.

create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now(),
  expires_at   timestamptz not null
);

-- Supports the garbage collector below. Rows are logically dead the moment
-- expires_at passes, but nothing reclaims them without this.
create index if not exists rate_limits_expires_at_idx
  on public.rate_limits (expires_at);

-- RLS on with NO policies: the default deny then applies to anon and
-- authenticated, so even someone holding the public anon key cannot read the
-- counters (which would leak usage patterns) or write them (which would let
-- them exhaust another user's limit).
alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from anon, authenticated;

-- One round trip: open the window or increment it, and report where the caller
-- now stands. `on conflict` makes this atomic, so two instances arriving at the
-- same instant cannot both read 4 and both write 5.
--
-- Resetting is lazy rather than scheduled: an expired row is reused as the
-- first hit of a new window, which is why a stale row can never grant a caller
-- a free pass.
create or replace function public.rv_rate_limit_hit(
  p_key            text,
  p_window_seconds integer
)
returns table (hits integer, reset_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.rate_limits as rl (key, count, window_start, expires_at)
  values (p_key, 1, now(), now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count        = case when rl.expires_at <= now() then 1   else rl.count + 1   end,
        window_start = case when rl.expires_at <= now() then now() else rl.window_start end,
        expires_at   = case when rl.expires_at <= now()
                            then now() + make_interval(secs => p_window_seconds)
                            else rl.expires_at end
  returning rl.count, rl.expires_at;
$$;

-- Reclaims expired rows. A per-minute limit mints a new key every minute for
-- every caller, so without this the table grows forever.
create or replace function public.rv_rate_limit_gc()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with gone as (
    delete from public.rate_limits where expires_at <= now() - interval '1 hour'
    returning 1
  )
  select count(*)::integer from gone;
$$;

-- security definer means these run as the owner, so EXECUTE is the whole
-- boundary: without this revoke, anyone holding the public anon key could
-- increment any key they liked and lock a named user out of the AI features.
revoke all on function public.rv_rate_limit_hit(text, integer) from public, anon, authenticated;
revoke all on function public.rv_rate_limit_gc() from public, anon, authenticated;

grant execute on function public.rv_rate_limit_hit(text, integer) to service_role;
grant execute on function public.rv_rate_limit_gc() to service_role;

-- /api calls rv_rate_limit_gc() occasionally so no scheduler is required. If
-- pg_cron is enabled, this is the deterministic version:
--
--   select cron.schedule('rv-rate-limit-gc', '17 * * * *', 'select public.rv_rate_limit_gc()');

