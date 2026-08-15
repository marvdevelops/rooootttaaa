import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicGroupRun } from '@/lib/getGroupRun';
import { buildStaticMapUrl } from '@/lib/staticMap';
import { PathPoint, RouteSegment, Waypoint } from '@/lib/types';
import OpenInAppButton from './OpenInAppButton';

interface Props {
  params: Promise<{ id: string }>;
}

function fullPath(waypoints: Waypoint[], segments: RouteSegment[]) {
  if (waypoints.length === 0) return [];
  const points: PathPoint[] = [waypoints[0]];
  for (const segment of segments) {
    points.push(...segment.path.slice(1));
  }
  return points;
}

function formatDayDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const run = await getPublicGroupRun(id);
  if (!run) return { title: 'Group run not found — Rootah' };

  const mapUrl =
    run.routeWaypoints && run.routeSegments
      ? (buildStaticMapUrl(fullPath(run.routeWaypoints, run.routeSegments), run.routeWaypoints, { width: 1200, height: 630 }) ?? undefined)
      : undefined;

  const date = new Date(run.scheduledAt);
  const title = `${run.title} — Rootah Group Run`;
  const statParts = [
    `${formatDayDate(date)} at ${formatTime(date)}`,
    run.routeDistanceKm != null ? `${run.routeDistanceKm.toFixed(1)}km` : null,
    `${run.rsvpCount} joining`,
    `Organised by @${run.hostUsername}`,
  ].filter(Boolean);
  const description = statParts.join(' · ');
  const path = `/runs/${id}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: run.status === 'archived' ? { index: false } : undefined,
    openGraph: {
      type: 'website',
      url: path,
      title,
      description,
      images: mapUrl ? [{ url: mapUrl, width: 1200, height: 630, alt: `Map preview of ${run.routeName ?? run.title}` }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: mapUrl ? [mapUrl] : undefined,
    },
    other: {
      'al:ios:url': `rootah://runs/${id}`,
      'al:android:url': `rootah://runs/${id}`,
    },
  };
}

export default async function GroupRunPage({ params }: Props) {
  const { id } = await params;
  const run = await getPublicGroupRun(id);
  if (!run) notFound();

  const isPast = run.status === 'archived';
  const date = new Date(run.scheduledAt);
  const mapUrl =
    run.routeWaypoints && run.routeSegments
      ? buildStaticMapUrl(fullPath(run.routeWaypoints, run.routeSegments), run.routeWaypoints, { width: 1280, height: 1280 })
      : null;

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'var(--map-bg)' }}>
        {mapUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external, dynamically-sized Mapbox image filling the viewport
          <img
            src={mapUrl}
            alt={run.routeName ? `Map of ${run.routeName}` : 'Route map'}
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

      <div style={{ position: 'relative', padding: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <Link
          href="/"
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
        {isPast && (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              background: 'var(--sand)',
              border: '2px solid var(--ink)',
              borderRadius: 8,
              padding: '6px 10px',
              height: 'fit-content',
            }}
          >
            PAST RUN
          </span>
        )}
      </div>

      <div style={{ position: 'relative', marginTop: '40vh', minHeight: '60vh' }}>
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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{run.title}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            {formatDayDate(date)} · {formatTime(date)}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Organised by @{run.hostUsername}</p>

          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            {run.city && <StatCard label="LOCATION" value={run.city} />}
            {run.routeDistanceKm != null && <StatCard label="DISTANCE" value={`${run.routeDistanceKm.toFixed(1)} km`} bg="var(--aqua)" />}
            <StatCard label="GOING" value={String(run.rsvpCount)} bg="var(--amber)" />
          </div>

          {!!run.description && (
            <p style={{ marginTop: 16, fontSize: 15, lineHeight: 1.5 }}>{run.description}</p>
          )}

          {run.participants.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Who&apos;s joining</p>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {run.participants.slice(0, 8).map((p, i) => (
                  <div
                    key={p.username}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      border: '2px solid var(--ink)',
                      background: 'var(--cream)',
                      marginLeft: i === 0 ? 0 : -10,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: 12,
                    }}
                  >
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small external avatar
                      <img src={p.avatarUrl} alt={p.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      p.username.slice(0, 1).toUpperCase()
                    )}
                  </div>
                ))}
                {run.rsvpCount > 8 && (
                  <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--muted)' }}>+{run.rsvpCount - 8} more</span>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 22 }}>
            {isPast ? (
              <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>This run has already taken place.</p>
            ) : (
              <OpenInAppButton runId={run.id} label="JOIN THIS RUN — OPEN ROOTAH" />
            )}
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--muted-light)', textAlign: 'center' }}>
            Don&apos;t have Rootah yet? <Link href="/#download" style={{ color: 'var(--rust)', textDecoration: 'underline' }}>Download the app</Link>.
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
