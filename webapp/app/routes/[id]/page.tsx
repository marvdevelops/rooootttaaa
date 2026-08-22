import type { Metadata } from 'next';
import { createClient } from '../../../lib/supabase/server';
import RouteDetailClient from './RouteDetailClient';

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

interface RouteMeta {
  name: string;
  description: string | null;
  activity_type: string;
  distance_km: number;
  elevation_gain_m: number;
  city: string | null;
}

async function fetchRouteMeta(id: string): Promise<RouteMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('routes')
    .select('name, description, activity_type, distance_km, elevation_gain_m, city')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle();
  return data as RouteMeta | null;
}

export async function generateMetadata({ params }: PageProps<'/routes/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const route = await fetchRouteMeta(id);
  if (!route) return { title: 'Route not found' };

  const activity = ACTIVITY_LABEL[route.activity_type] ?? route.activity_type;
  const title = `${route.name} — ${route.distance_km.toFixed(1)}km ${activity}${route.city ? ` in ${route.city}` : ''}`;
  const description =
    route.description?.trim() ||
    `A ${route.distance_km.toFixed(1)}km ${activity.toLowerCase()} route${route.city ? ` in ${route.city}` : ''} with ${Math.round(route.elevation_gain_m)}m of elevation gain, shared on Rootah.`;
  const url = `https://app.rootah.com/routes/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Rootah`, description, url, type: 'article' },
    twitter: { card: 'summary', title: `${title} | Rootah`, description },
  };
}

export default async function RouteDetailPage({ params }: PageProps<'/routes/[id]'>) {
  const { id } = await params;
  const route = await fetchRouteMeta(id);

  const jsonLd = route
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Discover', item: 'https://app.rootah.com/' },
          { '@type': 'ListItem', position: 2, name: route.name, item: `https://app.rootah.com/routes/${id}` },
        ],
      }
    : null;

  return (
    <>
      {jsonLd && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <RouteDetailClient id={id} />
    </>
  );
}
