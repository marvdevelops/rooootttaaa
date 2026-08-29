-- The official Rootah account manages clubs it doesn't hold a membership row
-- for (same moderation override as 0055). 0031's club-avatar storage policies
-- gate purely on club_memberships, so the official account gets an RLS error
-- uploading/replacing a club profile photo. Add the is_official_account branch.

drop policy if exists "club admins can upload club avatar" on storage.objects;
create policy "club admins can upload club avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and (
      public.is_official_account(auth.uid())
      or exists (
        select 1 from public.club_memberships m
        where m.club_id::text = (storage.foldername(name))[2]
          and m.user_id = auth.uid()
          and m.status = 'active' and m.role in ('admin', 'owner')
      )
    )
  );

drop policy if exists "club admins can update club avatar" on storage.objects;
create policy "club admins can update club avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and (
      public.is_official_account(auth.uid())
      or exists (
        select 1 from public.club_memberships m
        where m.club_id::text = (storage.foldername(name))[2]
          and m.user_id = auth.uid()
          and m.status = 'active' and m.role in ('admin', 'owner')
      )
    )
  );

drop policy if exists "club admins can delete club avatar" on storage.objects;
create policy "club admins can delete club avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and (
      public.is_official_account(auth.uid())
      or exists (
        select 1 from public.club_memberships m
        where m.club_id::text = (storage.foldername(name))[2]
          and m.user_id = auth.uid()
          and m.status = 'active' and m.role in ('admin', 'owner')
      )
    )
  );
