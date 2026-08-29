-- "N watching" on the live page and in the recording screen, mirroring the
-- race live_view_count. Best-effort tally — no per-viewer dedup (no account
-- on the spectator side), same as races.

alter table public.live_sessions add column if not exists view_count integer not null default 0;

create or replace function public.increment_live_session_view(token text)
returns integer
language sql security definer set search_path = public as $$
  update public.live_sessions
  set view_count = view_count + 1
  where share_token = token
  returning view_count;
$$;
grant execute on function public.increment_live_session_view(text) to anon, authenticated;

-- Add view_count to the lookup so the initial page load has it without a
-- second round trip.
drop function if exists public.get_live_session(text);
create or replace function public.get_live_session(token text)
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
  expires_at timestamptz,
  view_count integer
)
language sql
security definer
set search_path = public
as $$
  select s.id, p.username, p.avatar_url, s.activity_type, s.route_id, s.status,
         s.last_lat, s.last_lng, s.last_distance_meters, s.last_elapsed_seconds,
         s.last_pace_seconds_per_km, s.last_updated_at, s.started_at, s.expires_at,
         s.view_count
  from public.live_sessions s
  join public.profiles p on p.id = s.athlete_id
  where s.share_token = token
    and (
      (s.status <> 'ended' and s.expires_at > now())
      or (s.status = 'ended' and s.ended_at > now() - interval '24 hours')
    );
$$;
grant execute on function public.get_live_session(text) to anon, authenticated;
