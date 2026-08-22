import { PathPoint } from '../lib/types';

interface Props {
  profile: PathPoint[];
  height?: number;
}

/** Compact elevation trace for the Discover route panel — a sparkline, not the full chart on the route detail page. */
export default function ElevationSparkline({ profile, height = 44 }: Props) {
  const elevations = profile.map((p) => p.elevation ?? 0);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = max - min || 1;
  const width = 360;

  const points = elevations
    .map((e, i) => {
      const x = (i / (elevations.length - 1)) * width;
      const y = height - ((e - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const fillPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={fillPoints} fill="var(--sheet-bg)" stroke="none" />
      <polyline points={points} fill="none" stroke="var(--coral)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
