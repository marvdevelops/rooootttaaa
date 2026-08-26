'use client';

import { useEffect, useState } from 'react';
import ElevationChart from '../../../components/ElevationChart';
import LiveTrackMap from '../../../components/LiveTrackMap';
import { createClient } from '../../../lib/supabase/client';
import { getRaceLivePosition, getRaceRoute, RaceLivePosition, RaceRoute } from '../../../lib/racesApi';

interface Props {
  token: string;
  initial: RaceLivePosition;
}

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '--:--';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
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

export default function LiveMapClient({ token, initial }: Props) {
  const [position, setPosition] = useState(initial);
  const [route, setRoute] = useState<RaceRoute | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    // Token-gated RPC, not a raw routes select — the course must stay
    // visible to anyone with the live link even if the organizer built the
    // race against a route they'd otherwise marked private.
    getRaceRoute(token).then(setRoute).catch(() => {});
  }, [token]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`race-live-${position.rsvpId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_run_rsvps', filter: `id=eq.${position.rsvpId}` },
        () => {
          // Re-run the RPC rather than trusting the raw payload — keeps the
          // access pattern consistent (token-gated lookup only) even though
          // we already know the row id from the initial call.
          getRaceLivePosition(token).then((p) => p && setPosition(p)).catch(() => {});
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [position.rsvpId, token]);

  // Re-render every 15s so the "last updated Xs ago" staleness indicator
  // keeps counting up even without a new position update.
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => clearInterval(interval);
  }, []);

  const isFinished = position.finishTimeSeconds !== null;
  const fullPath = route?.segments.flatMap((seg) => seg.path) ?? [];

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'var(--cream, #F2EDE5)' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <LiveTrackMap segments={route?.segments ?? []} liveLat={position.lastLat} liveLng={position.lastLng} />
      </div>

      {isFinished ? (
        <div style={overlayCardStyle}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--coral, #E84B2A)', textTransform: 'uppercase' }}>
            🏁 Race finisher
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 2px' }}>{position.athleteUsername}</h1>
          <p style={{ fontSize: 13, color: 'var(--stone, #8C8078)', margin: 0 }}>
            {position.athleteUsername} finished {position.raceTitle}!
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={statTileStyle}>
              <div style={statValueStyle}>{position.lastDistanceMeters ? (position.lastDistanceMeters / 1000).toFixed(1) : '0.0'} km</div>
              <div style={statLabelStyle}>Distance</div>
            </div>
            <div style={statTileStyle}>
              <div style={statValueStyle}>{formatDuration(position.finishTimeSeconds ?? 0)}</div>
              <div style={statLabelStyle}>Finish time</div>
            </div>
            <div style={statTileStyle}>
              <div style={statValueStyle}>{formatPace(position.lastPaceSecondsPerKm)}</div>
              <div style={statLabelStyle}>Pace /km</div>
            </div>
          </div>
          {fullPath.length > 1 && (
            <div style={elevationWrapStyle}>
              <span style={elevationLabelStyle}>ELEVATION</span>
              <ElevationChart path={fullPath} height={70} />
            </div>
          )}
          <a href="https://rootah.com/#download" style={ctaStyle}>
            Follow more races on Rootah
          </a>
        </div>
      ) : (
        <div style={overlayCardStyle}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--coral, #E84B2A)', textTransform: 'uppercase' }}>
            {position.raceTitle}
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 2px' }}>{position.athleteUsername}</h1>
          <p style={{ fontSize: 12, color: 'var(--mist, #B0A898)', margin: '0 0 14px' }}>Updated {formatStaleness(position.lastUpdatedAt)}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={statTileStyle}>
              <div style={statValueStyle}>{position.lastDistanceMeters ? (position.lastDistanceMeters / 1000).toFixed(1) : '0.0'} km</div>
              <div style={statLabelStyle}>Distance</div>
            </div>
            <div style={statTileStyle}>
              <div style={statValueStyle}>{formatPace(position.lastPaceSecondsPerKm)}</div>
              <div style={statLabelStyle}>Pace /km</div>
            </div>
          </div>
          {fullPath.length > 1 && (
            <div style={elevationWrapStyle}>
              <span style={elevationLabelStyle}>ELEVATION</span>
              <ElevationChart path={fullPath} height={70} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const elevationWrapStyle: React.CSSProperties = {
  marginTop: 14,
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
