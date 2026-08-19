import { buildElevationProfile } from '../lib/elevationProfile';
import { PathPoint } from '../lib/types';

interface Props {
  path: PathPoint[];
  width?: number;
  height?: number;
}

/** Simple SVG elevation-vs-distance line chart — mirrors mobile's ElevationProfileChart without the grade-color segments. */
export default function ElevationChart({ path, width = 320, height = 100 }: Props) {
  const profile = buildElevationProfile(path);
  if (profile.points.length < 2) return null;

  const totalKm = profile.points[profile.points.length - 1].km;
  const range = Math.max(profile.maxElevation - profile.minElevation, 1);
  const padding = 8;

  const toXY = (p: { km: number; elevation: number }): [number, number] => {
    const x = padding + (totalKm === 0 ? 0 : (p.km / totalKm) * (width - padding * 2));
    const y = padding + (1 - (p.elevation - profile.minElevation) / range) * (height - padding * 2);
    return [x, y];
  };

  const linePoints = profile.points.map(toXY);
  const pathD = linePoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${linePoints[linePoints.length - 1][0].toFixed(1)},${height - padding} L${padding},${height - padding} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      <path d={areaD} fill="var(--coral)" opacity={0.12} />
      <path d={pathD} fill="none" stroke="var(--coral)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
