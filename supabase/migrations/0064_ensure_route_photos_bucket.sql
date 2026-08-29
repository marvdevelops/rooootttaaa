-- "Bucket not found" when club admins attach images (and, by the same cause,
-- in-run photo uploads): the `route-photos` bucket from 0034 is missing on
-- this project. Recreate it and its policies idempotently.

insert into storage.buckets (id, name, public)
values ('route-photos', 'route-photos', true)
on conflict (id) do nothing;

drop policy if exists "route photos publicly viewable" on storage.objects;
create policy "route photos publicly viewable"
  on storage.objects for select
  using (bucket_id = 'route-photos');

drop policy if exists "users can upload their own route photos" on storage.objects;
create policy "users can upload their own route photos"
  on storage.objects for insert
  with check (bucket_id = 'route-photos' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "users can update their own route photos" on storage.objects;
create policy "users can update their own route photos"
  on storage.objects for update
  using (bucket_id = 'route-photos' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "users can delete their own route photos" on storage.objects;
create policy "users can delete their own route photos"
  on storage.objects for delete
  using (bucket_id = 'route-photos' and (storage.foldername(name))[2] = auth.uid()::text);
