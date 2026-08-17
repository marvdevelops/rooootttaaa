-- T5: Flyby video — remote config so the free/Pro access policy can flip
-- without an app release.
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values ('flyby_access_mode', 'free_all')
on conflict (key) do nothing;

alter table public.app_config enable row level security;

drop policy if exists "app config publicly readable" on public.app_config;
create policy "app config publicly readable"
  on public.app_config for select
  using (true);

-- No client write policy — flip the flag manually via the SQL Editor or dashboard.
