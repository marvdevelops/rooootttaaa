import { haversineDistance } from './distance';
import { PathPoint } from './types';

export const GRADE_COLORS = {
  flat: '#2ecc71',
  climbModerate: '#f39c12',
  climbSteep: '#e74c3c',
} as const;

const MODERATE_GRADE_PCT = 3;
const STEEP_GRADE_PCT = 7;
const SMOOTHING_WINDOW_POINTS = 3; // each side
const MIN_RUN_METERS = 120; // shorter runs get absorbed into a neighbor

export interface GradeRun {
  startIdx: number;
  endIdx: number;
  color: string;
}

function gradeColor(grade: number): string {
  if (grade > STEEP_GRADE_PCT) return GRADE_COLORS.climbSteep;
  if (grade > MODERATE_GRADE_PCT) return GRADE_COLORS.climbModerate;
  return GRADE_COLORS.flat;
}

/** Simple moving average over elevation, to keep single noisy samples from flipping the grade classification back and forth. */
function smoothElevations(elevations: number[]): number[] {
  return elevations.map((_, i) => {
    const lo = Math.max(0, i - SMOOTHING_WINDOW_POINTS);
    const hi = Math.min(elevations.length - 1, i + SMOOTHING_WINDOW_POINTS);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += elevations[j];
    return sum / (hi - lo + 1);
  });
}

/**
 * Classifies an elevation-annotated path into contiguous grade-colored runs
 * (flat vs moderate/steep climb), smoothing the elevation signal first and
 * merging any short runs into a neighbor so the result reads as a handful of
 * clean climb/flat stretches rather than a speckle of single-point flips.
 * Indices refer to positions in `path` filtered down to points with a
 * defined elevation (same filtering the caller must apply when consuming
 * startIdx/endIdx).
 */
export function classifyGradeRuns(path: PathPoint[]): { points: PathPoint[]; runs: GradeRun[] } {
  const points = path.filter((p): p is PathPoint & { elevation: number } => typeof p.elevation === 'number');
  if (points.length < 2) return { points, runs: [] };

  const smoothed = smoothElevations(points.map((p) => p.elevation as number));
  const edgeDistances: number[] = [];
  const edgeColors: string[] = [];

  for (let i = 1; i < points.length; i++) {
    const distance = haversineDistance(points[i - 1], points[i]);
    edgeDistances.push(distance);
    const grade = distance === 0 ? 0 : ((smoothed[i] - smoothed[i - 1]) / distance) * 100;
    edgeColors.push(gradeColor(grade));
  }

  let runs: (GradeRun & { lengthM: number })[] = [];
  let runStart = 0;
  for (let i = 1; i <= edgeColors.length; i++) {
    if (i === edgeColors.length || edgeColors[i] !== edgeColors[runStart]) {
      const lengthM = edgeDistances.slice(runStart, i).reduce((a, b) => a + b, 0);
      runs.push({ startIdx: runStart, endIdx: i, color: edgeColors[runStart], lengthM });
      runStart = i;
    }
  }

  let mergedSomething = true;
  while (mergedSomething && runs.length > 1) {
    mergedSomething = false;
    const shortIdx = runs.findIndex((r) => r.lengthM < MIN_RUN_METERS);
    if (shortIdx === -1) break;

    const prev = runs[shortIdx - 1];
    const next = runs[shortIdx + 1];
    const target = !prev ? next : !next ? prev : prev.lengthM >= next.lengthM ? prev : next;
    const targetIdx = target === prev ? shortIdx - 1 : shortIdx + 1;

    const short = runs[shortIdx];
    const mergedRun = {
      startIdx: Math.min(short.startIdx, target.startIdx),
      endIdx: Math.max(short.endIdx, target.endIdx),
      color: target.color,
      lengthM: short.lengthM + target.lengthM,
    };

    const [lo, hi] = [Math.min(shortIdx, targetIdx), Math.max(shortIdx, targetIdx)];
    runs.splice(lo, hi - lo + 1, mergedRun);
    mergedSomething = true;
  }

  return { points, runs: runs.map(({ startIdx, endIdx, color }) => ({ startIdx, endIdx, color })) };
}
