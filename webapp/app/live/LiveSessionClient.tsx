'use client';

import { useEffect, useRef, useState } from 'react';
import ElevationChart from '../../components/ElevationChart';
import LiveTrackMap from '../../components/LiveTrackMap';
import { createClient } from '../../lib/supabase/client';
import { activityLabel, getLiveSession, incrementLiveSessionView, LiveSession } from '../../lib/liveSessionsApi';
import { getRoute } from '../../lib/routesApi';
import { RouteSegment } from '../../lib/types';

interface Props {
  token: string;
  initial: LiveSession;
}

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '--:--';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDuration(totalSeconds: number | null): string {
  if (!totalSeconds) return '0:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatStaleness(updatedAt: number | null): string {
  if (!updatedAt) return 'no updates yet';
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function LiveSessionClient({ token, initial }: Props) {
  const [session, setSession] = useState(initial);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [views, setViews] = useState(initial.viewCount);
  const [, forceTick] = useState(0);

  // Count this view once.
  const countedRef = useRef(false);
  useEffect(() => {
    if (countedRef.current) return;
    countedRef.current = true;
    incrementLiveSessionView(token).then((n) => {
      if (typeof n === 'number') setViews(n);
    });
  }, [token]);

  // Optional course line — only if the session was following a public route.
  useEffect(() => {
    if (!session.routeId) return;
    getRoute(session.routeId)
      .then((r) => setSegments(r?.segments ?? []))
      .catch(() => {});
  }, [session.routeId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-session-${session.sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${session.sessionId}` },
        () => {
          getLiveSession(token)
            .then((s) => { if (s) { setSession(s); setViews(s.viewCount); } })
            .catch(() => {});
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.sessionId, token]);

  // Keep the "updated Xs ago" line counting up between position updates.
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => clearInterval(interval);
  }, []);

  // The lookup RPC already filters out expired sessions, so an 'ended' status
  // is the only end-state the client can land in from a live start.
  const ended = session.status === 'ended';
  const fullPath = segments.flatMap((seg) => seg.path);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'var(--cream, #F2EDE5)' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <LiveTrackMap segments={segments} liveLat={session.lastLat} liveLng={session.lastLng} />
      </div>

      <div style={overlayCardStyle}>
        <span style={eyebrowStyle}>
          {ended
            ? `${activityLabel(session.activityType)} finished`
            : `🔴 Live ${activityLabel(session.activityType)}`}
        </span>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 2px' }}>{session.athleteUsername}</h1>
        <p style={{ fontSize: 12, color: 'var(--mist, #B0A898)', margin: '0 0 14px', display: 'flex', gap: 10 }}>
          <span>{ended ? 'This link is no longer live.' : `Updated ${formatStaleness(session.lastUpdatedAt)}`}</span>
          {views > 0 && (
            <span>· {views} {views === 1 ? 'person' : 'people'} watching</span>
          )}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={statTileStyle}>
            <div style={statValueStyle}>
              {session.lastDistanceMeters ? (session.lastDistanceMeters / 1000).toFixed(1) : '0.0'} km
            </div>
            <div style={statLabelStyle}>Distance</div>
          </div>
          <div style={statTileStyle}>
            <div style={statValueStyle}>{formatDuration(session.lastElapsedSeconds)}</div>
            <div style={statLabelStyle}>Time</div>
          </div>
          <div style={statTileStyle}>
            <div style={statValueStyle}>{formatPace(session.lastPaceSecondsPerKm)}</div>
            <div style={statLabelStyle}>Pace /km</div>
          </div>
        </div>

        {fullPath.length > 1 && (
          <div style={{ marginTop: 14 }}>
            <span style={elevationLabelStyle}>ELEVATION</span>
            <ElevationChart path={fullPath} height={70} />
          </div>
        )}

        {ended && (
          <a href="https://rootah.com/#download" style={ctaStyle}>
            Track your own runs on Rootah
          </a>
        )}
      </div>
    </div>
  );
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  color: 'var(--coral, #E84B2A)',
  textTransform: 'uppercase',
};

const elevationLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: 'var(--stone, #8C8078)',
  display: 'block',
  marginBottom: 4,
};

const overlayCardStyle: React.CSSProperties = {
  position: 'absolute',
  left: 16,
  right: 16,
  bottom: 16,
  maxWidth: 420,
  margin: '0 auto',
  background: 'var(--panel, #fff)',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 8px 24px rgba(0,0,0,.18)',
};

const statTileStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--cream, #F2EDE5)',
  borderRadius: 14,
  padding: '12px 16px',
};

const statValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: 'var(--ink, #1A1614)',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--stone, #8C8078)',
  textTransform: 'uppercase',
  marginTop: 2,
};

const ctaStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 16,
  textAlign: 'center',
  padding: '12px 20px',
  borderRadius: 999,
  background: 'var(--coral, #E84B2A)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  textDecoration: 'none',
};
