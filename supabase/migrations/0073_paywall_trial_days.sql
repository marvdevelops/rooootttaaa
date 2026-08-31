-- RevenueCat's introPrice metadata can lag behind what Apple's own purchase
-- sheet shows (e.g. sheet says "2-week free trial" while the SDK still reports
-- 1 week from a stale product cache). This override lets us set the trial
-- length shown in the Rootah paywall from SQL, no app release:
--   '0'  -> trust whatever the store reports (default)
--   '14' -> force the paywall copy to say "2 weeks"
-- It only affects display; the real trial is always whatever Apple charges.

-- Idempotent recreation of app_config (0036) in case it isn't present.
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop policy if exists "app config publicly readable" on public.app_config;
create policy "app config publicly readable"
  on public.app_config for select
  using (true);

insert into public.app_config (key, value) values ('paywall_trial_days', '0')
on conflict (key) do nothing;
