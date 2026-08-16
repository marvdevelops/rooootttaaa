import { supabase } from '../lib/supabase';
import { TrailDifficulty, TrailInfo, TrailSurface } from '../types/route';

interface TrailInfoRow {
  route_id: string;
  surface: TrailSurface | null;
  technical_difficulty: TrailDifficulty | null;
  has_water_crossing: boolean;
  has_stream: boolean;
  is_shaded: boolean;
  is_dog_friendly: boolean;
  requires_permit: boolean;
  condition_note: string | null;
  condition_updated_at: string | null;
}

export interface TrailInfoInput {
  surface: TrailSurface | null;
  technicalDifficulty: TrailDifficulty | null;
  hasWaterCrossing: boolean;
  hasStream: boolean;
  isShaded: boolean;
  isDogFriendly: boolean;
  requiresPermit: boolean;
  conditionNote: string | null;
}

function toTrailInfo(row: TrailInfoRow): TrailInfo {
  return {
    surface: row.surface,
    technicalDifficulty: row.technical_difficulty,
    hasWaterCrossing: row.has_water_crossing,
    hasStream: row.has_stream,
    isShaded: row.is_shaded,
    isDogFriendly: row.is_dog_friendly,
    requiresPermit: row.requires_permit,
    conditionNote: row.condition_note,
    conditionUpdatedAt: row.condition_updated_at ? new Date(row.condition_updated_at).getTime() : null,
  };
}

export async function getTrailInfo(routeId: string): Promise<TrailInfo | null> {
  const { data, error } = await supabase.from('route_trail_info').select('*').eq('route_id', routeId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTrailInfo(data as TrailInfoRow) : null;
}

/** Called right after a trail/hike route is created or updated — the trail step in the save flow is entirely optional, so this is skipped when the user has no trail fields set. */
export async function upsertTrailInfo(routeId: string, input: TrailInfoInput): Promise<void> {
  const { error } = await supabase.from('route_trail_info').upsert({
    route_id: routeId,
    surface: input.surface,
    technical_difficulty: input.technicalDifficulty,
    has_water_crossing: input.hasWaterCrossing,
    has_stream: input.hasStream,
    is_shaded: input.isShaded,
    is_dog_friendly: input.isDogFriendly,
    requires_permit: input.requiresPermit,
    condition_note: input.conditionNote,
  });
  if (error) throw new Error(error.message);
}

/** Route-detail "Update conditions" quick edit — creator-only, bumps condition_updated_at. */
export async function updateTrailCondition(routeId: string, conditionNote: string | null): Promise<void> {
  const { error } = await supabase
    .from('route_trail_info')
    .update({ condition_note: conditionNote, condition_updated_at: new Date().toISOString() })
    .eq('route_id', routeId);
  if (error) throw new Error(error.message);
}
