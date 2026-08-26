-- Real bug found while building distance categories: race_details never
-- had an UPDATE policy at all (only select + insert, from 0042) — every
-- edit to race branding (organizer name/logo, banner, race day) via
-- updateGroupRun in ScheduleGroupRunModal's edit flow has been silently
-- no-oping since it was built, same class of bug as 0050's
-- group_run_rsvps gap. Mirrors the insert policy's official-account-only
-- restriction.
create policy "only the official account updates race details"
  on public.race_details for update
  using (
    exists (
      select 1 from public.group_runs g
      where g.id = group_run_id and g.host_id = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f'
    )
  )
  with check (
    exists (
      select 1 from public.group_runs g
      where g.id = group_run_id and g.host_id = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f'
    )
  );
