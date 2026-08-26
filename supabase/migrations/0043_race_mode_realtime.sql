-- Live spectator page subscribes to UPDATE events on group_run_rsvps
-- (last_lat/last_lng etc.) via Realtime.
alter publication supabase_realtime add table public.group_run_rsvps;
