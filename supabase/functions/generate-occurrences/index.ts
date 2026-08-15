// Rootah: daily rolling-horizon maintenance for recurring group run series.
// The actual generation logic lives in the SECURITY DEFINER SQL function
// generate_occurrences_for_series() (supabase/migrations/0029) — this just
// loops over every active series and calls it, so it stays a plain HTTP
// endpoint an external scheduler (cron-job.org) can hit daily, same
// free-tier pattern as group-run-lifecycle. The client also calls the same
// RPC directly right after creating a series, covering "first occurrence
// exists immediately" without needing this function.
//
// Deploy with:
//   supabase functions deploy generate-occurrences --no-verify-jwt
// Reuses the existing CRON_AUTH_HEADER secret (shared with group-run-lifecycle).

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

  const { data: series, error } = await supabase
    .from('recurring_series')
    .select('id')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to list active series:', error.message);
    return new Response('Internal error', { status: 500 });
  }

  let totalGenerated = 0;
  for (const s of series ?? []) {
    const { data: count, error: genError } = await supabase.rpc('generate_occurrences_for_series', {
      p_series_id: s.id,
    });
    if (genError) {
      console.error(`Failed to generate occurrences for series ${s.id}:`, genError.message);
      continue;
    }
    totalGenerated += count ?? 0;
  }

  return new Response(JSON.stringify({ ok: true, seriesChecked: series?.length ?? 0, generated: totalGenerated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
