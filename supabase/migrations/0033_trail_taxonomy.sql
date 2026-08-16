-- T5: Trail running & hiking taxonomy.

-- ─────────────────────────────────────────────────────────────
-- Activity type expansion: run | trail_run | hike | bike | walk | other
-- ─────────────────────────────────────────────────────────────
alter table public.routes drop constraint if exists routes_activity_type_check;
alter table public.routes add constraint routes_activity_type_check
  check (activity_type in ('run', 'trail_run', 'hike', 'bike', 'walk', 'other'));

alter table public.routes
  add column if not exists is_trail boolean
    generated always as (activity_type in ('trail_run', 'hike')) stored;

create index if not exists routes_is_trail_idx on public.routes(is_trail) where is_trail = true;

-- ─────────────────────────────────────────────────────────────
-- route_trail_info — optional per-route trail metadata
-- ─────────────────────────────────────────────────────────────
create table if not exists public.route_trail_info (
  route_id uuid primary key references public.routes(id) on delete cascade,

  surface text check (surface in ('paved', 'gravel', 'dirt', 'rock', 'mixed')),
  technical_difficulty text check (technical_difficulty in ('easy', 'moderate', 'hard', 'expert')),

  has_water_crossing boolean not null default false,
  has_stream boolean not null default false,
  is_shaded boolean not null default false,
  is_dog_friendly boolean not null default false,
  requires_permit boolean not null default false,

  condition_note text check (char_length(condition_note) <= 200),
  condition_updated_at timestamptz,

  updated_at timestamptz not null default now()
);

alter table public.route_trail_info enable row level security;

drop policy if exists "trail info readable with the route" on public.route_trail_info;
create policy "trail info readable with the route"
  on public.route_trail_info for select
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id and (r.is_public = true or r.owner_id = auth.uid())
    )
  );

drop policy if exists "trail info writable by route owner" on public.route_trail_info;
create policy "trail info writable by route owner"
  on public.route_trail_info for insert
  with check (exists (select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()));

drop policy if exists "trail info updatable by route owner" on public.route_trail_info;
create policy "trail info updatable by route owner"
  on public.route_trail_info for update
  using (exists (select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()));

drop policy if exists "trail info deletable by route owner" on public.route_trail_info;
create policy "trail info deletable by route owner"
  on public.route_trail_info for delete
  using (exists (select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()));
