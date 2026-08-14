-- Rootah: fixes "infinite recursion detected in policy for relation
-- group_runs" introduced by 0019. group_run_rsvps' select/update policies
-- queried group_runs (to check host_id), while group_runs' own select
-- policy (0010) queries group_run_rsvps right back — each policy evaluation
-- re-triggers the other, forever.
--
-- Fix: a SECURITY DEFINER helper bypasses RLS on the inner lookup (table
-- owners bypass their own RLS by default), breaking the cycle.

create or replace function public.is_run_host(p_group_run_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_runs g
    where g.id = p_group_run_id and g.host_id = p_user_id
  );
$$;

drop policy if exists "approved rsvps public, others visible to host and requester" on public.group_run_rsvps;
create policy "approved rsvps public, others visible to host and requester"
  on public.group_run_rsvps for select
  using (
    status = 'approved'
    or user_id = auth.uid()
    or public.is_run_host(group_run_id, auth.uid())
  );

drop policy if exists "hosts can update rsvp status for their own runs" on public.group_run_rsvps;
create policy "hosts can update rsvp status for their own runs"
  on public.group_run_rsvps for update
  using (public.is_run_host(group_run_id, auth.uid()))
  with check (public.is_run_host(group_run_id, auth.uid()));

-- Same fix applied to group_runs' own select policy (0010), which read
-- group_run_rsvps directly — now goes through a helper too, and only counts
-- an approved request as "I can see this archived run I attended" (a
-- pending/declined request to an archived run shouldn't grant visibility).
create or replace function public.is_approved_participant(p_group_run_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_run_rsvps r
    where r.group_run_id = p_group_run_id and r.user_id = p_user_id and r.status = 'approved'
  );
$$;

drop policy if exists "public can read upcoming runs, owners can read their archived runs" on public.group_runs;
create policy "public can read upcoming runs, owners can read their archived runs"
  on public.group_runs for select
  using (
    status in ('scheduled', 'active')
    or host_id = auth.uid()
    or public.is_approved_participant(id, auth.uid())
  );
