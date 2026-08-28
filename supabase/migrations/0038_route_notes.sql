-- Notes are now a standalone entity, not a `note` field on a Waypoint —
-- a waypoint exists only to draw/route the line; a note is a separate pin
-- ({id, latitude, longitude, text}) that can sit anywhere along a route
-- without implying a routing point there.
alter table public.routes add column if not exists notes jsonb not null default '[]'::jsonb;
