-- Race distance categories (Option A from the design discussion): a
-- multi-distance event (e.g. "Milo Marathon 2026" with 5K/10K/21K/42K) is
-- still just several independent group_runs races — each keeps its own
-- route, RSVPs, live tracking, and finish detection exactly as today. The
-- only new concept is a shared grouping key so the browse screens can show
-- them as one event with distance options instead of four unrelated cards.
--
-- event_group_id is the group_run_id of whichever category was created
-- first — every sibling category (including that first one, self-
-- referencing) points at the same value. No separate "events" table.
alter table public.race_details
  add column event_group_id uuid references public.group_runs(id) on delete set null;

create index race_details_event_group_id_idx on public.race_details (event_group_id) where event_group_id is not null;
