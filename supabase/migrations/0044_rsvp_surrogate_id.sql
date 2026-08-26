-- group_run_rsvps only had a composite primary key (group_run_id, user_id) —
-- fine for the original RSVP use case, but Race Mode's client code
-- (racesApi.ts, RecordingScreen's raceRsvpId, the live-tracking RPC) all
-- address a single RSVP row by one id. Add a surrogate key rather than
-- refactor everything to composite keys.
alter table public.group_run_rsvps add column id uuid not null default gen_random_uuid();
create unique index group_run_rsvps_id_idx on public.group_run_rsvps (id);
