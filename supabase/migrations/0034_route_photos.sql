-- T5: Route photo gallery. "Trail condition reports," not Instagram —
-- see T5-route-photos.md's design principle.

-- ─────────────────────────────────────────────────────────────
-- route_photos
-- ─────────────────────────────────────────────────────────────
alter table public.routes add column if not exists photo_count integer not null default 0;

create table if not exists public.route_photos (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completion_id uuid references public.route_completions(id) on delete set null,
  storage_path text not null,
  thumbnail_path text,
  caption text check (char_length(caption) <= 150),
  taken_at date,
  is_visible boolean not null default true,
  reported_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists route_photos_route_idx on public.route_photos(route_id, created_at desc) where is_visible = true;
create index if not exists route_photos_user_idx on public.route_photos(user_id, created_at desc);

create or replace function public.sync_photo_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.is_visible then
    update public.routes set photo_count = photo_count + 1 where id = NEW.route_id;
  elsif TG_OP = 'DELETE' and OLD.is_visible then
    update public.routes set photo_count = greatest(photo_count - 1, 0) where id = OLD.route_id;
  elsif TG_OP = 'UPDATE' and OLD.is_visible != NEW.is_visible then
    update public.routes set photo_count = photo_count + (NEW.is_visible::int - OLD.is_visible::int)
    where id = NEW.route_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists on_photo_change on public.route_photos;
create trigger on_photo_change
  after insert or update or delete on public.route_photos
  for each row execute function public.sync_photo_count();

alter table public.route_photos enable row level security;

drop policy if exists "photos readable if visible or own" on public.route_photos;
create policy "photos readable if visible or own"
  on public.route_photos for select
  using (is_visible = true or user_id = auth.uid());

drop policy if exists "photos insertable by self" on public.route_photos;
create policy "photos insertable by self"
  on public.route_photos for insert
  with check (user_id = auth.uid());

drop policy if exists "photos deletable by owner" on public.route_photos;
create policy "photos deletable by owner"
  on public.route_photos for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Storage bucket — public read, like the existing `avatars` bucket
-- (simpler than the spec's signed-URL approach; photos aren't sensitive
-- once a user chooses to upload them, and this keeps the gallery grid a
-- single query with no extra signing round-trip per photo).
-- Path convention: {routeId}/{userId}/{photoId}[_thumb].jpg
-- ─────────────────────────────────────────────────────────────
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

drop policy if exists "users can delete their own route photos" on storage.objects;
create policy "users can delete their own route photos"
  on storage.objects for delete
  using (bucket_id = 'route-photos' and (storage.foldername(name))[2] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────
-- Moderation: extend the existing reports table + auto-hide at 3 reports
-- ─────────────────────────────────────────────────────────────
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('route', 'profile', 'comment', 'group_run', 'route_photo'));

create or replace function public.auto_hide_reported_photos()
returns trigger as $$
declare
  report_count integer;
begin
  if NEW.target_type != 'route_photo' then
    return NEW;
  end if;

  select count(distinct reporter_id) into report_count
  from public.reports
  where target_type = 'route_photo' and target_id = NEW.target_id;

  if report_count >= 3 then
    update public.route_photos set is_visible = false where id = NEW.target_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_photo_reported on public.reports;
create trigger on_photo_reported
  after insert on public.reports
  for each row execute function public.auto_hide_reported_photos();
