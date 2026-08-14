import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicRoute } from '@/lib/getRoute';
import { buildStaticMapUrl } from '@/lib/staticMap';
import { PathPoint } from '@/lib/types';
import OpenInAppButton from './OpenInAppButton';

interface Props {
  params: Promise<{ id: string }>;
}

const ACTIVITY_LABELS: Record<string, string> = {
  run: 'Run',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

function fullPath(route: { waypoints: { latitude: number; longitude: number }[]; segments: { path: PathPoint[] }[] }) {
  if (route.waypoints.length === 0) return [];
  const points = [route.waypoints[0]];
  for (const segment of route.segments) {
    points.push(...segment.path.slice(1));
  }
  return points;
}

function peakElevation(path: PathPoint[]): number | null {
  const elevations = path.map((p) => p.elevation).filter((e): e is number => typeof e === 'number');
  return elevations.length > 0 ? Math.max(...elevations) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const route = await getPublicRoute(id);
  if (!route) return { title: 'Route not found — Rootah' };

  const mapUrl = buildStaticMapUrl(fullPath(route), route.waypoints) ?? undefined;
  const activityLabel = ACTIVITY_LABELS[route.activityType] ?? 'Route';
  const title = `${route.name} — Rootah`;
  const stats = `${route.distanceKm.toFixed(2)} km · +${Math.round(route.elevationGainM)} m ${activityLabel.toLowerCase()}`;
  const description = route.description ? `${route.description} (${stats})` : `${stats} by ${route.ownerUsername} on Rootah.`;
  const path = `/routes/${id}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title,
      description,
      images: mapUrl ? [{ url: mapUrl, width: 1200, height: 630, alt: `Map preview of ${route.name}` }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: mapUrl ? [mapUrl] : undefined,
    },
  };
}

export default async function RoutePage({ params }: Props) {
  const { id } = await params;
  const route = await getPublicRoute(id);
  if (!route) notFound();

  const path = fullPath(route);
  const mapUrl = buildStaticMapUrl(path, route.waypoints, { width: 1280, height: 1280 });
  const chartPath = route.elevationProfile.length >= 2 ? route.elevationProfile : path;
  const peakM = peakElevation(chartPath);

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Full-bleed map background */}
      <div style={{ position: 'fixed', inset: 0, background: 'var(--map-bg)' }}>
        {mapUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external, dynamically-sized Mapbox image filling the viewport
          <img
            src={mapUrl}
            alt={`Map of ${route.name}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(34,42,42,0) 0%, rgba(34,42,42,0.05) 50%, rgba(34,42,42,0.55) 100%)',
          }}
        />
      </div>

      {/* Top bar */}
      <div style={{ position: 'relative', padding: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <Link
          href="/"
          className="icon-btn"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(226,218,194,0.85)',
            border: '3px solid var(--ink)',
            boxShadow: '3px 3px 0 var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="#222A2A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            background: 'var(--amber)',
            border: '2px solid var(--ink)',
            borderRadius: 8,
            padding: '6px 10px',
            height: 'fit-content',
          }}
        >
          {ACTIVITY_LABELS[route.activityType] ?? 'Route'}
        </span>
      </div>

      {/* Bottom details sheet, floating over the map */}
      <div style={{ position: 'relative', marginTop: '46vh', minHeight: '54vh' }}>
        <div
          style={{
            maxWidth: 640,
            margin: '0 auto',
            background: 'var(--sand)',
            border: '4px solid var(--ink)',
            borderRadius: '24px 24px 0 0',
            borderBottom: 'none',
            padding: '26px 22px 40px',
          }}
        >
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{route.name}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>by {route.ownerUsername}</p>

          {!!route.description && (
            <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>{route.description}</p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <StatCard label="DISTANCE" value={`${route.distanceKm.toFixed(2)} km`} />
            <StatCard label="GAIN" value={`+${Math.round(route.elevationGainM)} m`} bg="var(--aqua)" />
            {peakM !== null && <StatCard label="PEAK" value={`${Math.round(peakM)} m`} bg="var(--amber)" />}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <StatCard label="LIKES" value={String(route.likesCount)} />
            <StatCard label="SAVES" value={String(route.savesCount)} />
          </div>

          <div style={{ marginTop: 22 }}>
            <OpenInAppButton routeId={route.id} />
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--muted-light)', textAlign: 'center' }}>
            Open this route, save it, and follow it turn-by-turn in the Rootah app.
          </p>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, bg }: { label: string; value: string; bg?: string }) {
  return (
    <div
      style={{
        flex: '1 1 100px',
        background: bg ?? 'var(--cream)',
        border: '3px solid var(--ink)',
        borderRadius: 12,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 11, color: bg ? 'var(--ink)' : 'var(--muted)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginTop: 2 }}>{value}</div>
    </div>
  );
}
