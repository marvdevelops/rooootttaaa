-- T5: Top Routes. A plain (non-materialized) view rather than the
-- materialized-view-plus-pg_cron approach in the spec — this project is on
-- Supabase's free tier, which doesn't include pg_cron (see 0011/0012's
-- Edge-Function-plus-external-scheduler workaround for group run lifecycle).
-- Route volume is small enough at this stage that computing the score live
-- on every read is cheap, and it sidesteps needing another scheduled job.

create or replace view public.top_routes as
select
  r.*,
  coalesce(r.rating_sum::float / nullif(r.review_count, 0), 0) as avg_rating,
  round(
    (r.completion_count * 0.40)
    + (r.review_count * 0.30)
    + (coalesce(r.rating_sum::float / nullif(r.review_count, 0), 0) * 4 * 0.20)
    + (coalesce((select count(*) from public.route_saves s where s.route_id = r.id), 0) * 0.10)
  , 2) as score
from public.routes r
where r.is_public = true
  and r.review_count >= 3
  and r.completion_count >= 2;

grant select on public.top_routes to anon, authenticated;
