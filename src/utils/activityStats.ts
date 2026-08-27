import { ActivityType } from '../types/route';

/** Rides show average speed (km/h); every foot-based activity shows pace (min/km) — same split Strava uses. */
export function usesSpeed(activityType: ActivityType): boolean {
  return activityType === 'bike';
}

export function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm || !isFinite(secondsPerKm)) return '--:--';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatSpeed(speedKmh: number | null): string {
  if (!speedKmh || !isFinite(speedKmh)) return '--';
  return speedKmh.toFixed(1);
}

/** The single pace-or-speed stat tile's value + label, picked for the activity type — the one thing callers actually need instead of importing usesSpeed/formatPace/formatSpeed separately and getting the branch wrong. */
export function paceOrSpeedStat(
  activityType: ActivityType,
  paceSecondsPerKm: number | null,
  speedKmh: number | null,
): { value: string; label: string } {
  return usesSpeed(activityType)
    ? { value: formatSpeed(speedKmh), label: 'KM/H AVG' }
    : { value: formatPace(paceSecondsPerKm), label: '/KM PACE' };
}
