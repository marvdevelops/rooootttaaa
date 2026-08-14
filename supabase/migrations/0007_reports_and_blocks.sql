-- Rootah: report content/users + block users (App Store 1.2 / Google Play UGC
-- policy — public UGC apps must offer in-app reporting and blocking).
-- Run this once in the Supabase SQL Editor, after 0006_account_deletion.sql.

-- ─────────────────────────────────────────────────────────────
-- reports
-- ─────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('route', 'profile', 'comment', 'group_run')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_target_idx on public.reports(target_type, target_id);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);

alter table public.reports enable row level security;

-- No select policy: reports are only readable via the Supabase dashboard
-- (service role), not by any client — reporters shouldn't see who else
-- reported what, and there's no in-app moderation UI yet.
drop policy if exists "users can file reports" on public.reports;
create policy "users can file reports"
  on public.reports for insert
  with check (reporter_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- blocks
-- ─────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_block check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_id_idx on public.blocks(blocked_id);

alter table public.blocks enable row level security;

drop policy if exists "users can view their own blocks" on public.blocks;
create policy "users can view their own blocks"
  on public.blocks for select
  using (blocker_id = auth.uid());

drop policy if exists "users can block others" on public.blocks;
create policy "users can block others"
  on public.blocks for insert
  with check (blocker_id = auth.uid());

drop policy if exists "users can unblock others" on public.blocks;
create policy "users can unblock others"
  on public.blocks for delete
  using (blocker_id = auth.uid());
