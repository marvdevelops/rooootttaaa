-- Rootah: elevation profile + city for discovery filters
-- Run this once in the Supabase SQL Editor, after 0001_init.sql and 0002_social_and_groups.sql.

alter table public.routes add column if not exists elevation_profile jsonb not null default '[]'::jsonb;
alter table public.routes add column if not exists city text;

create index if not exists routes_city_idx on public.routes(city);
create index if not exists routes_distance_km_idx on public.routes(distance_km);
create index if not exists routes_elevation_gain_m_idx on public.routes(elevation_gain_m);
