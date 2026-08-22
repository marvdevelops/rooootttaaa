import { buildElevationProfile, ChartPoint } from '../lib/elevationProfile';
import { PathPoint } from '../lib/types';

interface Props {
  path: PathPoint[];
  width?: number;
  height?: number;
}

function toXY(point: ChartPoint, totalKm: number, min: number, max: number, width: number, height: number, padding: number) {
  const range = max - min || 1;
  const x = padding + (totalKm === 0 ? 0 : (point.km / totalKm) * (width - padding * 2));
  const y = padding + (1 - (point.elevation - min) / range) * (height - padding * 2);
  return [x, y] as const;
}

/**
 * Elevation-vs-distance line chart, colored by grade like the mobile app's
 * ElevationProfileChart — green for flat, orange for a moderate climb, red
 * for a steep one — plus a matching color bar underneath so the uphill/flat
 * transitions are visible even at a glance.
 */
export default function ElevationChart({ path, width = 320, height = 100 }: Props) {
  const profile = buildElevationProfile(path);
  if (profile.points.length < 2) return null;

  const padding = 8;
  const { minElevation, maxElevation, totalKm } = profile;

  // Map each chart point to a color by locating which grade segment it falls
  // in, then group consecutive same-color points into single polylines so
  // color transitions render as sharp boundaries, not a gradient blur.
  const polylines: { color: string; points: string }[] = [];
  let segIdx = 0;
  for (let i = 1; i < profile.points.length; i++) {
    while (segIdx < profile.segments.length - 1 && profile.points[i].km > profile.segments[segIdx].endKm) segIdx++;
    const color = profile.segments[segIdx]?.color ?? '#e84b2a';
    const [ax, ay] = toXY(profile.points[i - 1], totalKm, minElevation, maxElevation, width, height, padding);
    const [bx, by] = toXY(profile.points[i], totalKm, minElevation, maxElevation, width, height, padding);
    const last = polylines[polylines.length - 1];
    if (last && last.color === color) {
      last.points += ` ${bx.toFixed(1)},${by.toFixed(1)}`;
    } else {
      polylines.push({ color, points: `${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}` });
    }
  }

  return (
    <div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={width}
            y1={padding + (height - padding * 2) * f}
            y2={padding + (height - padding * 2) * f}
            stroke="var(--mist)"
            strokeWidth={1}
            strokeOpacity={0.25}
          />
        ))}
        {polylines.map((piece, i) => (
          <polyline key={i} points={piece.points} fill="none" stroke={piece.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>

      {profile.segments.length > 1 && (
        <div style={{ display: 'flex', height: 8, borderRadius: 5, overflow: 'hidden', marginTop: 8, gap: 1 }}>
          {profile.segments.map((seg, i) => (
            <div key={i} style={{ flexGrow: Math.max(seg.endKm - seg.startKm, 0.01), background: seg.color }} title={`+${Math.round(seg.gainM)}m / -${Math.round(seg.lossM)}m`} />
          ))}
        </div>
      )}
    </div>
  );
}
