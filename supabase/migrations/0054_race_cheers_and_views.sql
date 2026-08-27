-- Live-tracking view count — incremented once per page load from the
-- public /live/[token] page, via a token-gated RPC (never a raw table
-- update from an anonymous client).
alter table public.group_run_rsvps add column live_view_count integer not null default 0;

create function public.increment_race_view(token text)
returns integer
language plpgsql security definer as $$
declare
  new_count integer;
begin
  update public.group_run_rsvps
  set live_view_count = live_view_count + 1
  where live_share_token = token
  returning live_view_count into new_count;
  return new_count;
end;
$$;
grant execute on function public.increment_race_view(text) to anon, authenticated;

-- Recreate get_race_live_position to also return the view count, so the
-- page's initial load doesn't need a second round trip just for that.
drop function if exists public.get_race_live_position(text);
create function public.get_race_live_position(token text)
returns table (
  rsvp_id uuid, race_title text, route_id uuid, athlete_username text, athlete_avatar_url text,
  status text, last_lat double precision, last_lng double precision, last_distance_meters real,
  last_pace_seconds_per_km real, last_updated_at timestamptz, started_at timestamptz, finish_time_seconds integer,
  live_view_count integer
)
language sql security definer as $$
  select rsvp.id, g.title, g.route_id, p.username, p.avatar_url, rsvp.status, rsvp.last_lat, rsvp.last_lng,
         rsvp.last_distance_meters, rsvp.last_pace_seconds_per_km, rsvp.last_updated_at,
         rsvp.started_at, rsvp.finish_time_seconds, rsvp.live_view_count
  from public.group_run_rsvps rsvp
  join public.group_runs g on g.id = rsvp.group_run_id
  join public.profiles p on p.id = rsvp.user_id
  where rsvp.live_share_token = token;
$$;
grant execute on function public.get_race_live_position(text) to anon, authenticated;

-- Quick cheer messages — a spectator on the live page taps one of a fixed
-- set of messages, the runner gets a push notification. No account needed
-- to send one (same anonymous-spectator model as viewing), so this can
-- only be written through the RPC below, never a raw insert — the message
-- itself is also constrained server-side to the same fixed set the RPC
-- accepts, not free text, to keep this from becoming an open messaging
-- channel to a stranger's phone.
create table public.race_cheers (
  id uuid primary key default gen_random_uuid(),
  rsvp_id uuid not null references public.group_run_rsvps(id) on delete cascade,
  message text not null check (message in ('Let''s go! 🔥', 'Don''t give up! 💪', 'You got this! 🙌', 'Congratulations! 🎉')),
  created_at timestamptz not null default now()
);
create index race_cheers_rsvp_idx on public.race_cheers (rsvp_id, created_at desc);

alter table public.race_cheers enable row level security;
-- The runner can read cheers sent to their own races (e.g. a "cheers
-- received" count in-app later); no direct insert policy — only the
-- security-definer RPC below writes rows.
create policy "runners can read their own race cheers" on public.race_cheers
  for select using (
    exists (select 1 from public.group_run_rsvps rsvp where rsvp.id = rsvp_id and rsvp.user_id = auth.uid())
  );

create function public.send_race_cheer(token text, cheer_message text)
returns void
language plpgsql security definer as $$
declare
  target_rsvp_id uuid;
begin
  select id into target_rsvp_id from public.group_run_rsvps where live_share_token = token;
  if target_rsvp_id is null then
    raise exception 'Invalid share token' using errcode = 'P0001';
  end if;
  insert into public.race_cheers (rsvp_id, message) values (target_rsvp_id, cheer_message);
end;
$$;
grant execute on function public.send_race_cheer(text, text) to anon, authenticated;

alter publication supabase_realtime add table public.race_cheers;

-- Reuses the existing generic notify_push_webhook() trigger function from
-- 0018_push_notification_webhooks.sql (forwards TG_TABLE_NAME + the new
-- row to send-push-notification, which now has a race_cheers branch).
create trigger send_push_notification_on_race_cheer
  after insert on public.race_cheers
  for each row
  execute function public.notify_push_webhook();
