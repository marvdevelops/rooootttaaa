-- Rootah: subscription tier tracking for Rootah Pro (RevenueCat).
-- Run this once in the Supabase SQL Editor, after 0007_reports_and_blocks.sql.

alter table public.profiles
  add column if not exists tier text not null default 'free' check (tier in ('free', 'paid')),
  add column if not exists rc_customer_id text,
  add column if not exists tier_updated_at timestamptz;

create index if not exists profiles_tier_idx on public.profiles(tier);

-- No RLS policy changes needed — profiles already has a "users can update
-- their own profile" policy for authenticated requests, but tier is only
-- ever written by the RevenueCat webhook Edge Function, which runs with
-- the service role key and bypasses RLS entirely. Nothing client-side
-- writes to these columns.
