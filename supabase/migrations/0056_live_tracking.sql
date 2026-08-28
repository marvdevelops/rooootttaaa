-- General live-location sharing for any recorded activity, not just races.
-- Mirrors the race live-position model (migration 0042): the current position
-- is denormalised onto the session row and overwritten in place during the
-- activity; spectators subscribe to UPDATE events on their one row via
-- Realtime; the public page reads through a security-definer RPC keyed on an
-- unguessable token, never a raw RLS select, so a link can only ever fetch the
-- single session it points at.

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  -- Unguessable, app-generated (see generateShareToken) — this token is the
  -- entire access control for the public page.
  share_token text not null unique,
  -- Optional: the planned route being followed, so the spectator page can draw
  -- the course line. Public routes are already readable via existing RLS.
  route_id uuid references public.routes (id) on delete set null,
  activity_type text not null default 'run',
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Lazy expiry: the lookup RPC filters on this, so a stale session simply
  -- stops resolving. Hard deletion / ping purge can come later via the same
  -- external scheduler that drives group-run-lifecycle (no pg_cron on the
  -- free tier).
  expires_at timestamptz not null default now() + interval '12 hours',
  -- Denormalised live position, overwritten in place during the activity.
  last_lat double precision,
  last_lng double precision,
  last_distance_meters real,
  last_elapsed_seconds integer,
  last_pace_seconds_per_km real,
  last_updated_at timestamptz
);

-- One active session per athlete at a time is the expected shape; this makes
-- "do I already have a live session?" cheap.
create index live_sessions_athlete_active_idx
  on public.live_sessions (athlete_id)
  where status = 'active';

alter table public.live_sessions enable row level security;

-- Athletes manage only their own sessions. There is deliberately no public
-- select policy — token reads go through get_live_session() below.
create policy "live_sessions_select_own"
  on public.live_sessions for select
  using (athlete_id = auth.uid());

create policy "live_sessions_insert_own"
  on public.live_sessions for insert
  with check (athlete_id = auth.uid());

create policy "live_sessions_update_own"
  on public.live_sessions for update
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

-- Spectators subscribe to UPDATE events on their one session row via Realtime.
alter publication supabase_realtime add table public.live_sessions;

-- Public position lookup by token. An RPC rather than an RLS select so a
-- viewer can only fetch the single row their link points at, and only while
-- it is live and unexpired.
create function public.get_live_session(token text)
returns table (
  session_id uuid,
  athlete_username text,
  athlete_avatar_url text,
  activity_type text,
  route_id uuid,
  status text,
  last_lat double precision,
  last_lng double precision,
  last_distance_meters real,
  last_elapsed_seconds integer,
  last_pace_seconds_per_km real,
  last_updated_at timestamptz,
  started_at timestamptz,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select s.id, p.username, p.avatar_url, s.activity_type, s.route_id, s.status,
         s.last_lat, s.last_lng, s.last_distance_meters, s.last_elapsed_seconds,
         s.last_pace_seconds_per_km, s.last_updated_at, s.started_at, s.expires_at
  from public.live_sessions s
  join public.profiles p on p.id = s.athlete_id
  where s.share_token = token
    and s.status <> 'ended'
    and s.expires_at > now();
$$;

grant execute on function public.get_live_session(text) to anon, authenticated;
