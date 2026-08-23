import type { Metadata } from 'next';
import { createClient } from '../../../lib/supabase/server';
import RunDetailClient from './RunDetailClient';

interface RunMeta {
  title: string;
  description: string;
  scheduled_at: string;
  city: string | null;
  routes: { name: string; distance_km: number } | { name: string; distance_km: number }[] | null;
}

async function fetchRunMeta(id: string): Promise<RunMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('group_runs')
    .select('title, description, scheduled_at, city, routes(name, distance_km)')
    .eq('id', id)
    .maybeSingle();
  return data as unknown as RunMeta | null;
}

export async function generateMetadata({ params }: PageProps<'/runs/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const run = await fetchRunMeta(id);
  if (!run) return { title: 'Group run not found' };

  const route = Array.isArray(run.routes) ? run.routes[0] : run.routes;
  // Server rendering has no request-local timezone to go by (Railway's container
  // clock is UTC, ~8h off), so pin to Manila — where the userbase actually is —
  // rather than silently drifting off the event's real local start time.
  const when = new Date(run.scheduled_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
  const title = `${run.title} — ${when}`;
  const description =
    run.description?.trim() ||
    `Join this group run${route ? ` on ${route.name} (${route.distance_km.toFixed(1)}km)` : ''}${run.city ? ` in ${run.city}` : ''} — ${when} on Rootah.`;
  const url = `https://app.rootah.com/runs/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Rootah`, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title: `${title} | Rootah`, description },
  };
}

export default async function RunDetailPage({ params }: PageProps<'/runs/[id]'>) {
  const { id } = await params;
  return <RunDetailClient id={id} />;
}
