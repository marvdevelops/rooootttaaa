import { Waypoint } from '../lib/types';

interface Props {
  waypoints: Waypoint[];
  className?: string;
}

/** Flat SVG trace of a route's waypoints — a lightweight stand-in for a real map tile thumbnail. */
export default function RouteThumb({ waypoints, className = 'mymaps-thumb' }: Props) {
  if (waypoints.length < 2) {
    return <div className={className} />;
  }

  const lats = waypoints.map((w) => w.latitude);
  const lngs = waypoints.map((w) => w.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;
  const pad = 14;
  const w = 220;
  const h = 118;

  const toXY = (wp: Waypoint) => [
    pad + ((wp.longitude - minLng) / lngRange) * (w - pad * 2),
    h - pad - ((wp.latitude - minLat) / latRange) * (h - pad * 2),
  ];

  const points = waypoints.map(toXY).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [startX, startY] = toXY(waypoints[0]);

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <polyline points={points} fill="none" stroke="var(--coral)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={startX} cy={startY} r={4} fill="var(--sage)" stroke="white" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
