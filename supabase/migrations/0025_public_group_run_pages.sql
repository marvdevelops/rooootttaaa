-- Rootah T4: public group run web pages (rootah.com/runs/[id]) need
-- anonymous read access to archived runs too, so a shared link still shows
-- "this run has already taken place" instead of erroring. Archived runs
-- were previously only readable by the host/an approved participant —
-- harmless to open up since they're historical and were public while
-- scheduled/active anyway.

drop policy if exists "public can read upcoming runs, owners can read their archived runs" on public.group_runs;
create policy "public can read upcoming and archived runs, owners always"
  on public.group_runs for select
  using (
    status in ('scheduled', 'active', 'archived')
    or host_id = auth.uid()
    or public.is_approved_participant(id, auth.uid())
  );
