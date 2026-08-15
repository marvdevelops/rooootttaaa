-- Rootah T4: route keyword search. PostGIS proximity search (Part B of
-- T4-strava-and-route-search.md) is skipped — routes.start_lat/start_lng
-- already exist as generated columns (0015_runs_near_you_radius.sql) and
-- the app already does client-side Haversine "near me" sorting for group
-- runs the same way; a dedicated PostGIS column isn't needed at this scale.

alter table public.routes
  add column if not exists search_vector tsvector
    generated always as (
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) stored;

create index if not exists routes_search_idx on public.routes using gin (search_vector);
