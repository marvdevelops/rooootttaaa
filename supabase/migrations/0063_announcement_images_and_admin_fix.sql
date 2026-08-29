-- Two fixes for the announcements feature (0059):
--
-- 1. RLS: the write/delete policies inlined a raw club_memberships subquery,
--    which (a) doesn't honour the official-account moderation override the
--    rest of the schema has (0055) and (b) bypasses the is_club_admin()
--    SECURITY DEFINER helper every other club policy uses. Rebuild them on
--    the helper + is_official_account(), same as run_clubs' own policies.
--
-- 2. Club admins can attach up to 3 images to an update. Stored in the shared
--    public `route-photos` bucket under club-posts/{userId}/… (that bucket's
--    insert policy already gates on (storage.foldername(name))[2] = uid).

alter table public.club_posts
  add column if not exists image_paths text[] not null default '{}';

alter table public.club_posts
  drop constraint if exists club_posts_image_paths_max;
alter table public.club_posts
  add constraint club_posts_image_paths_max
  check (coalesce(array_length(image_paths, 1), 0) <= 3);

-- ---------- club_posts policies ----------
drop policy if exists "club_posts_write_admin" on public.club_posts;
create policy "club_posts_write_admin" on public.club_posts for insert
  with check (
    author_id = auth.uid()
    and (
      public.is_club_admin(club_id, auth.uid())
      or public.is_official_account(auth.uid())
    )
  );

drop policy if exists "club_posts_delete_admin" on public.club_posts;
create policy "club_posts_delete_admin" on public.club_posts for delete
  using (
    public.is_club_admin(club_id, auth.uid())
    or public.is_official_account(auth.uid())
  );

-- ---------- group_run_posts policies ----------
drop policy if exists "group_run_posts_write_host" on public.group_run_posts;
create policy "group_run_posts_write_host" on public.group_run_posts for insert
  with check (
    author_id = auth.uid()
    and (
      exists (
        select 1 from public.group_runs g
        where g.id = group_run_posts.group_run_id and g.host_id = auth.uid()
      )
      or public.is_official_account(auth.uid())
    )
  );

drop policy if exists "group_run_posts_delete_host" on public.group_run_posts;
create policy "group_run_posts_delete_host" on public.group_run_posts for delete
  using (
    exists (
      select 1 from public.group_runs g
      where g.id = group_run_posts.group_run_id and g.host_id = auth.uid()
    )
    or public.is_official_account(auth.uid())
  );
