import { PathPoint } from '../types/route';
import { classifyGradeRuns, GRADE_COLORS } from './grade';

export { GRADE_COLORS };

export interface ColoredSegment {
  coordinates: PathPoint[];
  color: string;
}

/**
 * Splits an elevation-annotated path into contiguous runs colored by grade,
 * so the rendered polyline can highlight climbs (orange/red) vs flat or
 * downhill stretches (green).
 */
export function colorSegmentsByGrade(path: PathPoint[]): ColoredSegment[] {
  if (path.length < 2) return [];

  const { points, runs } = classifyGradeRuns(path);
  if (runs.length === 0) {
    return [{ coordinates: path, color: '#EC4624' }];
  }

  return runs.map((run) => ({
    coordinates: points.slice(run.startIdx, run.endIdx + 1),
    color: run.color,
  }));
}
