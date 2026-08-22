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
  waypoints: { latitude: number; longitude: number }[] | null;
}

async function fetchRouteMeta(id: string): Promise<RouteMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('routes')
    .select('name, description, activity_type, distance_km, elevation_gain_m, city, waypoints')
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
    `A ${route.distance_km.toFixed(1)}km ${activity.toLowerCase()} route${route.city ? ` in ${route.city}` : ''} with ${Math.round(route.elevation_gain_m)}m of elevation gain. Free to view, save, and run on Rootah.`;
  const url = `https://app.rootah.com/routes/${id}`;
  const keywords = [
    `${activity.toLowerCase()} route${route.city ? ` ${route.city}` : ''}`,
    route.city ? `running routes in ${route.city}` : 'running routes near me',
    route.city ? `${route.city} running trails` : 'running trails near me',
    'route planner',
  ];

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Rootah`, description, url, type: 'article' },
    twitter: { card: 'summary', title: `${title} | Rootah`, description },
  };
}

export default async function RouteDetailPage({ params }: PageProps<'/routes/[id]'>) {
  const { id } = await params;
  const route = await fetchRouteMeta(id);
  const start = route?.waypoints?.[0];

  const breadcrumbJsonLd = route
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Discover', item: 'https://app.rootah.com/' },
          { '@type': 'ListItem', position: 2, name: route.name, item: `https://app.rootah.com/routes/${id}` },
        ],
      }
    : null;

  // A Place/geo block gives local-search and AI answer engines a concrete
  // location signal for "running routes near me"/"in {city}" style queries
  // — schema.org has no dedicated "running route" type, so Place plus a
  // geo point is the closest well-supported vocabulary for it.
  const placeJsonLd =
    route && start
      ? {
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: route.name,
          description: route.description?.trim() || undefined,
          address: route.city ? { '@type': 'PostalAddress', addressLocality: route.city, addressCountry: 'PH' } : undefined,
          geo: { '@type': 'GeoCoordinates', latitude: start.latitude, longitude: start.longitude },
        }
      : null;

  return (
    <>
      {breadcrumbJsonLd && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      )}
      {placeJsonLd && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }} />
      )}
      <RouteDetailClient id={id} />
    </>
  );
}
