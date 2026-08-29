-- Group runs / club events can be public (discoverable by anyone, shareable
-- link works) or club-only (visible only to members of the owning club, the
-- host, people already RSVP'd, and the official account). Club-only requires
-- the event to belong to a club.

alter table public.group_runs
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'club'));

alter table public.group_runs
  drop constraint if exists group_runs_club_visibility_chk;
alter table public.group_runs
  add constraint group_runs_club_visibility_chk
  check (visibility = 'public' or club_id is not null);

alter table public.recurring_series
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'club'));

-- ---------- read policy ----------
-- Supersedes 0025's "public can read upcoming and archived runs, owners always".
drop policy if exists "public can read upcoming and archived runs, owners always" on public.group_runs;
drop policy if exists "group runs are viewable by everyone" on public.group_runs;
create policy "group runs visible by visibility and membership"
  on public.group_runs for select
  using (
    (visibility = 'public' and status in ('scheduled', 'active', 'archived'))
    or host_id = auth.uid()
    or public.is_approved_participant(id, auth.uid())
    or (club_id is not null and public.is_active_club_member(club_id, auth.uid()))
    or public.is_official_account(auth.uid())
  );

-- ---------- series -> occurrence inheritance ----------
-- The occurrence generator (0029) inserts group_runs without setting
-- visibility; a club-only series should produce club-only occurrences.
create or replace function public.set_group_run_visibility_from_series()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.series_id is not null then
    select visibility into new.visibility
    from public.recurring_series where id = new.series_id;
    if new.visibility is null then
      new.visibility := 'public';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists group_run_visibility_from_series on public.group_runs;
create trigger group_run_visibility_from_series
  before insert on public.group_runs
  for each row execute function public.set_group_run_visibility_from_series();
