import Link from 'next/link';
import { CloudRoute } from '../lib/types';

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'RUN',
  trail_run: 'TRAIL RUN',
  hike: 'HIKE',
  bike: 'BIKE',
  walk: 'WALK',
  other: 'OTHER',
};

interface Props {
  route: CloudRoute;
  active: boolean;
  onClick: () => void;
}

export default function RouteListCard({ route, active, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        textAlign: 'left',
        padding: 14,
        borderRadius: 'var(--radius-md)',
        background: active ? 'var(--sheet-bg)' : 'var(--surface)',
        boxShadow: 'var(--elevation-subtle)',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{route.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--stone)', fontWeight: 500 }}>{route.distanceKm.toFixed(1)} km</span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 6,
            background: 'rgba(0,0,0,.06)',
            color: 'var(--ink)',
          }}
        >
          {ACTIVITY_LABEL[route.activityType] ?? route.activityType.toUpperCase()}
        </span>
        {route.city && <span style={{ fontSize: 12, color: 'var(--mist)' }}>{route.city}</span>}
      </div>
      {active && (
        <Link
          href={`/routes/${route.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 12, fontWeight: 700, color: 'var(--coral)', marginTop: 2 }}
        >
          View details →
        </Link>
      )}
    </div>
  );
}
