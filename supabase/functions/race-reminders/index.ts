// Rootah: race reminder ticker — notifies joined runners 5, 2, and 1 day(s)
// before race day (in the race's own timezone, not the runner's device).
//
// Same "external free scheduler" pattern as group-run-lifecycle (see that
// function's header) rather than pg_cron — run this hourly, it's cheap
// (no-op unless a race is actually within a reminder window) and each
// reminder is sent at most once per RSVP, tracked via the
// reminder_5d_sent_at / reminder_2d_sent_at / reminder_1d_sent_at columns
// added in 0047_race_organizer_branding_and_reminders.sql.
//
// Deploy with:
//   supabase functions deploy race-reminders --no-verify-jwt
// Uses the same CRON_AUTH_HEADER secret as group-run-lifecycle — set it
// once and both functions share it:
//   supabase secrets set CRON_AUTH_HEADER=<your-random-string>
//
// Point the scheduler at:
//   https://<project-ref>.supabase.co/functions/v1/race-reminders

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CRON_AUTH = Deno.env.get('CRON_AUTH_HEADER')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const MILESTONES: { days: number; column: 'reminder_5d_sent_at' | 'reminder_2d_sent_at' | 'reminder_1d_sent_at' }[] = [
  { days: 5, column: 'reminder_5d_sent_at' },
  { days: 2, column: 'reminder_2d_sent_at' },
  { days: 1, column: 'reminder_1d_sent_at' },
];

interface RaceRow {
  group_run_id: string;
  race_date: string; // YYYY-MM-DD
  race_timezone: string;
  group_runs: { title: string } | { title: string }[] | null;
}

/** "Today" in the race's own timezone, as YYYY-MM-DD — en-CA gives that format directly. */
function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

function daysUntil(raceDate: string, timezone: string): number {
  const today = todayInTimezone(timezone);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(`${raceDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / msPerDay);
}

async function sendPush(userId: string, title: string, body: string, data: Record<string, unknown>) {
  const { data: tokens } = await supabase.from('push_tokens').select('id, token').eq('user_id', userId);
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({ to: t.token, sound: 'default', title, body, data }));
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) console.error('Expo push send failed:', res.status, await res.text());
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== CRON_AUTH) return new Response('Unauthorized', { status: 401 });

  const { data: races, error: racesError } = await supabase
    .from('race_details')
    .select('group_run_id, race_date, race_timezone, group_runs(title)')
    .gte('race_date', todayInTimezone('UTC')); // cheap prefilter — exact per-timezone math happens below

  if (racesError) {
    console.error('Failed to load races:', racesError.message);
    return new Response('Internal error', { status: 500 });
  }

  let sent = 0;

  for (const race of (races ?? []) as unknown as RaceRow[]) {
    const daysAway = daysUntil(race.race_date, race.race_timezone);
    const milestone = MILESTONES.find((m) => m.days === daysAway);
    if (!milestone) continue;

    const runTitle = Array.isArray(race.group_runs) ? race.group_runs[0]?.title : race.group_runs?.title;
    if (!runTitle) continue;

    const { data: rsvps, error: rsvpsError } = await supabase
      .from('group_run_rsvps')
      .select('id, user_id')
      .eq('group_run_id', race.group_run_id)
      .eq('status', 'approved')
      .is(milestone.column, null);

    if (rsvpsError) {
      console.error(`Failed to load RSVPs for race ${race.group_run_id}:`, rsvpsError.message);
      continue;
    }

    for (const rsvp of rsvps ?? []) {
      const body =
        daysAway === 1
          ? `"${runTitle}" is tomorrow — get ready!`
          : `"${runTitle}" is in ${daysAway} days.`;

      await supabase.from('notifications').insert({
        recipient_id: rsvp.user_id,
        actor_id: null,
        type: 'race_reminder',
        title: 'Race reminder',
        body,
        data: { type: 'race_reminder', run_id: race.group_run_id, days_away: daysAway },
      });
      await sendPush(rsvp.user_id, 'Race reminder', body, { type: 'race_reminder', run_id: race.group_run_id });
      await supabase.from('group_run_rsvps').update({ [milestone.column]: new Date().toISOString() }).eq('id', rsvp.id);
      sent += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
