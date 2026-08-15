-- Rootah T4: route reviews. Adapted from claude-tasks/T4-route-reviews.md:
-- users -> profiles. Reconciliation extends reconcile_completion_counters()
-- from 0023 into one combined function (still needs external scheduling —
-- no pg_cron on the free tier, see 0023's note).

create table if not exists public.route_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  completion_id uuid references public.route_completions(id) on delete set null,
  group_run_id uuid references public.group_runs(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  body text check (char_length(body) <= 200),
  source text not null check (source in ('solo', 'group_run')),
  created_at timestamptz not null default now(),
  unique (user_id, route_id)
);

create index if not exists route_reviews_route_idx on public.route_reviews(route_id);
create index if not exists route_reviews_user_idx on public.route_reviews(user_id);

alter table public.routes
  add column if not exists review_count integer not null default 0,
  add column if not exists rating_sum integer not null default 0;

create or replace function public.sync_route_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.routes
    set review_count = review_count + 1,
        rating_sum = rating_sum + new.rating
    where id = new.route_id;
  elsif TG_OP = 'DELETE' then
    update public.routes
    set review_count = greatest(review_count - 1, 0),
        rating_sum = greatest(rating_sum - old.rating, 0)
    where id = old.route_id;
  elsif TG_OP = 'UPDATE' then
    update public.routes
    set rating_sum = rating_sum - old.rating + new.rating
    where id = new.route_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_review_change on public.route_reviews;
create trigger on_review_change
  after insert or update or delete on public.route_reviews
  for each row execute function public.sync_route_rating();

-- Supersedes 0023's version: also reconciles review_count/rating_sum.
create or replace function public.reconcile_completion_counters()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.routes r set completion_count = coalesce((
    select count(*) from public.route_completions where route_id = r.id
  ), 0);

  update public.routes r set
    review_count = coalesce((select count(*) from public.route_reviews where route_id = r.id), 0),
    rating_sum = coalesce((select sum(rating)::int from public.route_reviews where route_id = r.id), 0);
end;
$$;

alter table public.route_reviews enable row level security;

drop policy if exists "reviews readable by all" on public.route_reviews;
create policy "reviews readable by all"
  on public.route_reviews for select using (true);

drop policy if exists "reviews insert own" on public.route_reviews;
create policy "reviews insert own"
  on public.route_reviews for insert with check (auth.uid() = user_id);

drop policy if exists "reviews update own" on public.route_reviews;
create policy "reviews update own"
  on public.route_reviews for update using (auth.uid() = user_id);

drop policy if exists "reviews delete own" on public.route_reviews;
create policy "reviews delete own"
  on public.route_reviews for delete using (auth.uid() = user_id);
