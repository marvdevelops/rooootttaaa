-- Rootah: switch "runs near you" from an exact city-string match to a real
-- geographic radius search. Run this after 0014_max_participants.sql.

-- routes: derive the route's starting coordinates from its first waypoint.
-- `generated always as` is safe here since jsonb extraction is immutable.
alter table public.routes
  add column if not exists start_lat double precision
    generated always as (((waypoints->0->>'latitude'))::double precision) stored,
  add column if not exists start_lng double precision
    generated always as (((waypoints->0->>'longitude'))::double precision) stored;

create index if not exists routes_start_lat_lng_idx on public.routes(start_lat, start_lng);

-- group_runs: copied from the route at creation time (a run happens where
-- its route is), same pattern as the existing city copy.
alter table public.group_runs
  add column if not exists start_lat double precision,
  add column if not exists start_lng double precision;

create index if not exists group_runs_start_lat_lng_idx on public.group_runs(start_lat, start_lng)
  where status in ('scheduled', 'active');

-- Supersedes the 0010 version of this trigger function — same trigger,
-- now also copies coordinates alongside city.
create or replace function public.set_group_run_city()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select city, start_lat, start_lng
    into new.city, new.start_lat, new.start_lng
    from public.routes where id = new.route_id;
  return new;
end;
$$;

-- Backfill existing runs that predate this column.
update public.group_runs gr
set start_lat = r.start_lat, start_lng = r.start_lng
from public.routes r
where r.id = gr.route_id and gr.start_lat is null;

-- Haversine distance search, upcoming runs only. Returns just id +
-- distance so the app can join back to the full row shape it already knows
-- how to map (GROUP_RUN_SELECT), preserving distance order.
create or replace function public.nearby_group_runs(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision default 50,
  result_limit integer default 20
)
returns table(id uuid, distance_km double precision)
language sql
stable
as $$
  select d.id, d.distance_km from (
    select gr.id,
      6371 * acos(
        least(1, greatest(-1,
          cos(radians(user_lat)) * cos(radians(gr.start_lat)) * cos(radians(gr.start_lng) - radians(user_lng))
          + sin(radians(user_lat)) * sin(radians(gr.start_lat))
        ))
      ) as distance_km
    from public.group_runs gr
    where gr.status in ('scheduled', 'active')
      and gr.start_lat is not null
      and gr.start_lng is not null
  ) d
  where d.distance_km <= radius_km
  order by d.distance_km asc
  limit result_limit;
$$;

grant execute on function public.nearby_group_runs(double precision, double precision, double precision, integer)
  to authenticated, anon;
