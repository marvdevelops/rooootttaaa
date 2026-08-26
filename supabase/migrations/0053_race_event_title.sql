-- Shared display name for a multi-distance event, distinct from each
-- category's own group_runs.title (which becomes just the distance label,
-- e.g. "10K") — needed so the browse screens can show one card per event
-- ("Milo Marathon 2026") instead of one card per distance category, which
-- is what made the current grouping-by-event_group_id alone feel broken:
-- there was no single name to group under, only N different titles.
alter table public.race_details add column event_title text;

-- Backfill: for existing single-category races, the event title is just
-- whatever the race's own title already was.
update public.race_details rd
set event_title = g.title
from public.group_runs g
where g.id = rd.group_run_id and rd.event_title is null;
