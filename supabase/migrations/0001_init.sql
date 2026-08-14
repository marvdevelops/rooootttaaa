-- Rootah Phase 2: accounts + route storage
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query -> paste -> Run).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  bio text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'runner') || '_' || substr(replace(new.id::text, '-', ''), 1, 6)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- routes
-- ─────────────────────────────────────────────────────────────
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  activity_type text not null default 'run' check (activity_type in ('run', 'bike', 'walk', 'other')),
  waypoints jsonb not null,
  segments jsonb not null,
  distance_km numeric not null default 0,
  elevation_gain_m numeric not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists routes_owner_id_idx on public.routes(owner_id);

alter table public.routes enable row level security;

create policy "public routes are viewable by everyone, private routes by their owner"
  on public.routes for select
  using (is_public = true or owner_id = auth.uid());

create policy "users can insert their own routes"
  on public.routes for insert
  with check (owner_id = auth.uid());

create policy "users can update their own routes"
  on public.routes for update
  using (owner_id = auth.uid());

create policy "users can delete their own routes"
  on public.routes for delete
  using (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- route_saves / route_likes
-- ─────────────────────────────────────────────────────────────
create table if not exists public.route_saves (
  route_id uuid not null references public.routes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (route_id, user_id)
);

create index if not exists route_saves_route_id_idx on public.route_saves(route_id);

alter table public.route_saves enable row level security;

create policy "save counts are viewable by everyone"
  on public.route_saves for select
  using (true);

create policy "users can save routes for themselves"
  on public.route_saves for insert
  with check (user_id = auth.uid());

create policy "users can remove their own saves"
  on public.route_saves for delete
  using (user_id = auth.uid());

create table if not exists public.route_likes (
  route_id uuid not null references public.routes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (route_id, user_id)
);

create index if not exists route_likes_route_id_idx on public.route_likes(route_id);

alter table public.route_likes enable row level security;

create policy "like counts are viewable by everyone"
  on public.route_likes for select
  using (true);

create policy "users can like routes for themselves"
  on public.route_likes for insert
  with check (user_id = auth.uid());

create policy "users can remove their own likes"
  on public.route_likes for delete
  using (user_id = auth.uid());
