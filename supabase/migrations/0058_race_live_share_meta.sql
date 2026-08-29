-- The race live-tracking share card needs a race-branded design: the event
-- name, its logo if the organizer set one, and the race distance. Extend the
-- token-gated live-position RPC to return those alongside the runner's
-- position (all from tables already joined or a cheap extra join).

drop function if exists public.get_race_live_position(text);
create function public.get_race_live_position(token text)
returns table (
  rsvp_id uuid, race_title text, route_id uuid, athlete_username text, athlete_avatar_url text,
  status text, last_lat double precision, last_lng double precision, last_distance_meters real,
  last_pace_seconds_per_km real, last_updated_at timestamptz, started_at timestamptz, finish_time_seconds integer,
  live_view_count integer,
  race_distance_km numeric,
  event_logo_url text
)
language sql security definer as $$
  select rsvp.id, g.title, g.route_id, p.username, p.avatar_url, rsvp.status, rsvp.last_lat, rsvp.last_lng,
         rsvp.last_distance_meters, rsvp.last_pace_seconds_per_km, rsvp.last_updated_at,
         rsvp.started_at, rsvp.finish_time_seconds, rsvp.live_view_count,
         r.distance_km,
         coalesce(rd.event_logo_url, rd.organizer_logo_url)
  from public.group_run_rsvps rsvp
  join public.group_runs g on g.id = rsvp.group_run_id
  join public.profiles p on p.id = rsvp.user_id
  left join public.routes r on r.id = g.route_id
  left join public.race_details rd on rd.group_run_id = g.id
  where rsvp.live_share_token = token;
$$;
grant execute on function public.get_race_live_position(text) to anon, authenticated;
