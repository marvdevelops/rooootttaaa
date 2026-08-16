import { ActivityType } from '../types/route';

const ACTIVITY_VERB: Record<ActivityType, string> = {
  run: 'run',
  trail_run: 'trail run',
  hike: 'hike',
  bike: 'ride',
  walk: 'walk',
  other: 'route',
};

/** Auto-fills the save-flow name field so saving never requires typing one — e.g. "Morning run in Marikina". */
export function generateRouteName(city: string | null, activityType: ActivityType, date = new Date()): string {
  const hour = date.getHours();
  const timeOfDay = hour < 11 ? 'Morning' : hour < 15 ? 'Midday' : hour < 19 ? 'Afternoon' : 'Evening';
  const verb = ACTIVITY_VERB[activityType] ?? 'route';
  return city ? `${timeOfDay} ${verb} in ${city}` : `${timeOfDay} ${verb}`;
}
