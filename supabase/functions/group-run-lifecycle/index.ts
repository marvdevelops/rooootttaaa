// Rootah: group run lifecycle ticker (scheduled -> active -> archived).
//
// This replaces pg_cron (Supabase Pro only) with a plain HTTP endpoint that
// an external free scheduler (e.g. cron-job.org) hits on a schedule. Same
// two UPDATE statements the pg_cron migration would have run.
//
// Deploy with:
//   supabase functions deploy group-run-lifecycle --no-verify-jwt
//
// Then set the shared secret (must match what's configured in the external
// scheduler as the Authorization header value):
//   supabase secrets set CRON_AUTH_HEADER=<your-random-string>
//
// Point the scheduler at:
//   https://<project-ref>.supabase.co/functions/v1/group-run-lifecycle
// Hourly is enough — it covers both the "activate today" and "archive
// yesterday's+" jobs every run, so there's no need for two separate schedules.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CRON_AUTH = Deno.env.get('CRON_AUTH_HEADER')!;

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== CRON_AUTH) {
    return new Response('Unauthorized', { status: 401 });
  }

  const nowIso = new Date().toISOString();

  // Activate today's runs (PH time) — mirrors the hourly pg_cron job.
  const { data: activated, error: activateError } = await supabase.rpc('activate_todays_group_runs');

  if (activateError) {
    console.error('Failed to activate group runs:', activateError.message);
    return new Response('Internal error', { status: 500 });
  }

  // Archive runs scheduled more than a day ago — mirrors the daily pg_cron job.
  const { data: archived, error: archiveError } = await supabase.rpc('archive_past_group_runs');

  if (archiveError) {
    console.error('Failed to archive group runs:', archiveError.message);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(
    JSON.stringify({ ok: true, ranAt: nowIso, activated: activated ?? 0, archived: archived ?? 0 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
