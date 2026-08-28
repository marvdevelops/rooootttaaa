-- Rootah's official account (f9808b4f-125a-4841-bf5e-b244d9f6cf1f — see
-- OFFICIAL_ACCOUNT_ID in App.tsx/scripts/createRace.ts, already the sole
-- account allowed to create races) can now edit or delete any content
-- regardless of who owns it — an admin/moderation override, not a general
-- "anyone can edit anyone's content" rule. Covers the main content types:
-- routes, group runs, run clubs, comments, and reviews.

create or replace function public.is_official_account(uid uuid)
returns boolean
language sql
stable
as $$
  select uid = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f'::uuid;
$$;

-- routes
drop policy if exists "users can update their own routes" on public.routes;
create policy "users can update their own routes"
  on public.routes for update
  using (owner_id = auth.uid() or public.is_official_account(auth.uid()));

drop policy if exists "users can delete their own routes" on public.routes;
create policy "users can delete their own routes"
  on public.routes for delete
  using (owner_id = auth.uid() or public.is_official_account(auth.uid()));

-- group_runs
drop policy if exists "hosts can update their own group runs" on public.group_runs;
create policy "hosts can update their own group runs"
  on public.group_runs for update
  using (host_id = auth.uid() or public.is_official_account(auth.uid()));

drop policy if exists "hosts can cancel their own group runs" on public.group_runs;
create policy "hosts can cancel their own group runs"
  on public.group_runs for delete
  using (host_id = auth.uid() or public.is_official_account(auth.uid()));

-- run_clubs
drop policy if exists "clubs updatable by admins" on public.run_clubs;
create policy "clubs updatable by admins"
  on public.run_clubs for update
  using (public.is_club_admin(id, auth.uid()) or public.is_official_account(auth.uid()));

drop policy if exists "clubs deletable by owner" on public.run_clubs;
create policy "clubs deletable by owner"
  on public.run_clubs for delete
  using (public.is_club_owner(id, auth.uid()) or public.is_official_account(auth.uid()));

-- group_run_comments (moderation: remove any comment, not just your own)
drop policy if exists "authors can delete their own comments" on public.group_run_comments;
create policy "authors can delete their own comments"
  on public.group_run_comments for delete
  using (author_id = auth.uid() or public.is_official_account(auth.uid()));

-- route_reviews (moderation: remove any review)
drop policy if exists "reviews delete own" on public.route_reviews;
create policy "reviews delete own"
  on public.route_reviews for delete using (auth.uid() = user_id or public.is_official_account(auth.uid()));
