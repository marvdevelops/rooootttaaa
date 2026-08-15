-- Lets club admins/owners upload a club logo, reusing the existing public
-- `avatars` bucket under a `clubs/{clubId}/` path (mirrors the per-user
-- `{userId}/` convention already used for profile avatars).

drop policy if exists "club admins can upload club avatar" on storage.objects;
create policy "club admins can upload club avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and exists (
      select 1 from public.club_memberships m
      where m.club_id::text = (storage.foldername(name))[2]
        and m.user_id = auth.uid()
        and m.status = 'active' and m.role in ('admin', 'owner')
    )
  );

drop policy if exists "club admins can update club avatar" on storage.objects;
create policy "club admins can update club avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and exists (
      select 1 from public.club_memberships m
      where m.club_id::text = (storage.foldername(name))[2]
        and m.user_id = auth.uid()
        and m.status = 'active' and m.role in ('admin', 'owner')
    )
  );
