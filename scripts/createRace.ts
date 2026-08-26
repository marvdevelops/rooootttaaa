/**
 * Creates a race — a group_run with category='race' plus its race_details
 * row — under the official Rootah account. Races are Rootah-official-only
 * for now (see docs/race-mode-plan.md), so this is a one-off script rather
 * than an in-app admin flow.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/createRace.ts <race-config.json>
 *
 * Example race-config.json:
 * {
 *   "routeId": "uuid-of-an-existing-route",
 *   "title": "Bataan Death March Commemorative Run",
 *   "description": "...",
 *   "scheduledAt": "2026-09-01T21:00:00+08:00",
 *   "raceDate": "2026-09-01",
 *   "raceTimezone": "Asia/Manila",
 *   "city": "Mariveles",
 *   "maxParticipants": null,
 *   "organizerName": "Milo Philippines",
 *   "organizerLogoUrl": "https://…",
 *   "eventLogoUrl": "https://…",
 *   "eventBannerUrl": "https://…",
 *   "brandPrimaryColor": "#E84B2A",
 *   "brandAccentColor": "#1A1614"
 * }
 *
 * Uses the service-role key (bypasses RLS) so it can insert as the official
 * account without needing that account's password — same pattern as
 * scripts/bulkImportGpx.ts.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OFFICIAL_ACCOUNT_ID = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f'; // "Rootah" official profile

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface RaceConfig {
  routeId: string;
  title: string;
  description?: string;
  scheduledAt: string;
  raceDate: string;
  raceTimezone?: string;
  city?: string | null;
  maxParticipants?: number | null;
  organizerLogoUrl?: string | null;
  organizerName?: string | null;
  eventBannerUrl?: string | null;
  eventLogoUrl?: string | null;
  brandPrimaryColor?: string;
  brandAccentColor?: string;
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error('Usage: npx tsx --env-file=.env scripts/createRace.ts <race-config.json>');
    process.exit(1);
  }

  const config: RaceConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const { data: run, error: runError } = await supabase
    .from('group_runs')
    .insert({
      route_id: config.routeId,
      host_id: OFFICIAL_ACCOUNT_ID,
      title: config.title,
      description: config.description ?? '',
      scheduled_at: config.scheduledAt,
      city: config.city ?? null,
      max_participants: config.maxParticipants ?? null,
      category: 'race',
    })
    .select('id')
    .single();

  if (runError || !run) {
    console.error('Failed to create race group_run:', runError?.message);
    process.exit(1);
  }

  const { error: detailsError } = await supabase.from('race_details').insert({
    group_run_id: run.id,
    race_date: config.raceDate,
    race_timezone: config.raceTimezone ?? 'Asia/Manila',
    organizer_logo_url: config.organizerLogoUrl ?? null,
    organizer_name: config.organizerName ?? null,
    event_banner_url: config.eventBannerUrl ?? null,
    event_logo_url: config.eventLogoUrl ?? null,
    brand_primary_color: config.brandPrimaryColor ?? '#E84B2A',
    brand_accent_color: config.brandAccentColor ?? '#1A1614',
  });

  if (detailsError) {
    console.error('Race group_run created, but race_details failed:', detailsError.message);
    console.error(`group_run id: ${run.id} — fix race_details manually or re-run against it.`);
    process.exit(1);
  }

  console.log(`✓ Race created: "${config.title}" (${run.id})`);
  console.log(`  Unlocks ${config.raceDate} in ${config.raceTimezone ?? 'Asia/Manila'}`);
}

main();
