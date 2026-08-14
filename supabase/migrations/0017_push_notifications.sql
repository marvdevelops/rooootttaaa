-- Rootah: push notification schema — device tokens + per-type preferences.
-- Run this after 0016_host_autorsvp_and_join_cap.sql.
--
-- Adapted from the T3 push-notifications spec to Rootah's actual schema:
-- profiles (not users), route_likes/group_run_rsvps (not generic "likes"),
-- blocks(blocker_id, blocked_id) for the block guard.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "users can manage their own push tokens" on public.push_tokens;
create policy "users can manage their own push tokens"
  on public.push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No general SELECT policy for other users — a push token is only ever
-- read by the notification Edge Function, which runs with the service role
-- key and bypasses RLS entirely.

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  likes_enabled boolean not null default true,
  rsvps_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  replies_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "users can manage their own notification preferences" on public.notification_preferences;
create policy "users can manage their own notification preferences"
  on public.notification_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Auto-create a default preferences row whenever a new profile is created —
-- kept as its own trigger (rather than editing handle_new_user from
-- 0001_init.sql) so this migration is additive and independently reversible.
create or replace function public.create_default_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_notification_prefs on public.profiles;
create trigger on_profile_created_notification_prefs
  after insert on public.profiles
  for each row
  execute function public.create_default_notification_preferences();

-- Backfill for existing users who signed up before this migration.
insert into public.notification_preferences (user_id)
select id from public.profiles
on conflict do nothing;
