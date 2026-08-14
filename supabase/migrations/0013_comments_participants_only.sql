-- Rootah: restrict group run comments to the host and RSVP'd participants —
-- previously readable by anyone. Run this after 0012_group_run_lifecycle_functions.sql.

drop policy if exists "comments are viewable by everyone" on public.group_run_comments;
create policy "only the host and rsvp'd participants can read comments"
  on public.group_run_comments for select
  using (
    exists (
      select 1 from public.group_runs g
      where g.id = group_run_comments.group_run_id
        and (
          g.host_id = auth.uid()
          or exists (
            select 1 from public.group_run_rsvps r
            where r.group_run_id = g.id and r.user_id = auth.uid()
          )
        )
    )
  );
