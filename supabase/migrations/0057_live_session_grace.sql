-- A shared /live link is usually opened well after the run — friends tap it
-- hours later. The original get_live_session() dropped a session the moment it
-- ended, so those links 404'd and social unfurls fell back to the site's
-- default card. Keep an ended session resolvable for 24h after it ends (and
-- until its 12h idle expiry while active) so the page can show the finished
-- state with final stats, and the share card stays branded.

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
    and (
      (s.status <> 'ended' and s.expires_at > now())
      or (s.status = 'ended' and s.ended_at > now() - interval '24 hours')
    );
$$;

grant execute on function public.get_live_session(text) to anon, authenticated;
