-- ─────────────────────────────────────────────────────────────
-- race-share-cards storage bucket
-- Path convention: {rsvpId}/{userId}.jpg — one card per race run, overwritten on re-generate.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('race-share-cards', 'race-share-cards', true)
on conflict (id) do nothing;

drop policy if exists "race share cards are publicly viewable" on storage.objects;
create policy "race share cards are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'race-share-cards');

drop policy if exists "users can upload their own race share cards" on storage.objects;
create policy "users can upload their own race share cards"
  on storage.objects for insert
  with check (bucket_id = 'race-share-cards' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "users can update their own race share cards" on storage.objects;
create policy "users can update their own race share cards"
  on storage.objects for update
  using (bucket_id = 'race-share-cards' and (storage.foldername(name))[2] = auth.uid()::text);
