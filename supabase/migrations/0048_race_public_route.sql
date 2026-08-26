-- Public race route lookup by live-tracking token — same access-control
-- pattern as get_race_live_position (security definer, token-gated, never
-- a raw table select). Needed because the underlying routes table's RLS
-- ("public routes are viewable by everyone, private routes by their owner")
-- would otherwise hide the course from an anonymous /live/[token] visitor
-- if the organizer happened to build the race against a route they'd
-- marked private — a race is inherently a public event once someone has
-- the share link, regardless of the route's own visibility flag.
create function public.get_race_route(token text)
returns table (
  route_id uuid,
  name text,
  distance_km numeric,
  elevation_gain_m numeric,
  segments jsonb
)
language sql security definer as $$
  select r.id, r.name, r.distance_km, r.elevation_gain_m, r.segments
  from public.group_run_rsvps rsvp
  join public.group_runs g on g.id = rsvp.group_run_id
  join public.routes r on r.id = g.route_id
  where rsvp.live_share_token = token;
$$;
grant execute on function public.get_race_route(text) to anon, authenticated;
