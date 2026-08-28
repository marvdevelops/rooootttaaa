import { Camera } from '@rnmapbox/maps';
import React from 'react';
import { haversineDistance } from './distance';
import { PathPoint } from '../types/route';

export interface FlybyCameraPoint {
  latitude: number;
  longitude: number;
  elevation: number;
}

/**
 * Resamples to a fixed point count, evenly spaced by real-world distance
 * along the route rather than by index in the source array. The routed path
 * from Mapbox Directions has uneven point density (many points clustered at
 * turns/intersections, few on long straight stretches) — index-based
 * downsampling carried that unevenness into the animation, since
 * animateFlybyCamera advances one "step" per point per unit time: dense
 * clusters played back slowly (looked like a pause) and sparse stretches
 * played back fast. Distance-based resampling makes each step cover the same
 * ground, so the camera moves at a constant speed end to end.
 */
export function sampleFlybyPoints(path: PathPoint[], targetCount = 100): FlybyCameraPoint[] {
  const withElevation = path.map((p) => ({ latitude: p.latitude, longitude: p.longitude, elevation: p.elevation ?? 0 }));
  if (withElevation.length < 2) return withElevation;

  const cumulative: number[] = [0];
  for (let i = 1; i < withElevation.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineDistance(withElevation[i - 1], withElevation[i]));
  }
  const totalDistance = cumulative[cumulative.length - 1];
  if (totalDistance === 0) return withElevation.slice(0, targetCount);

  let segIndex = 0;
  return Array.from({ length: targetCount }, (_, i) => {
    const targetDist = (totalDistance * i) / (targetCount - 1);
    while (segIndex < cumulative.length - 2 && cumulative[segIndex + 1] < targetDist) segIndex++;
    const segStart = cumulative[segIndex];
    const segEnd = cumulative[segIndex + 1];
    const t = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;
    const a = withElevation[segIndex];
    const b = withElevation[segIndex + 1];
    return {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
      elevation: a.elevation + (b.elevation - a.elevation) * t,
    };
  });
}

export function getBearing(from: FlybyCameraPoint, to: FlybyCameraPoint): number {
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Shortest signed angular distance from `a` to `b`, in degrees, in (-180, 180]. */
function angleDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

export interface AnimateFlybyCameraOptions {
  points: FlybyCameraPoint[];
  cameraRef: React.RefObject<Camera | null>;
  durationMs?: number;
  pitch?: number;
  zoomLevel?: number;
  /**
   * Time constant (seconds) for how quickly the camera's heading eases
   * toward the route's direction of travel — smaller catches up faster,
   * larger drifts/lags more. Exponential easing rather than a hard
   * max-degrees-per-second clamp, so there's no "clamped, then suddenly
   * released" pop once a turn ends.
   */
  headingSmoothingSec?: number;
  /** Called if the animation is cancelled mid-flight (e.g. user backs out of the flyby screen). */
  isCancelled?: () => boolean;
  /** Fired every animation frame (~60fps) with the interpolated position — drives the runner marker so it moves continuously instead of jumping between waypoints. */
  onFrame?: (coordinate: [number, number], bearing: number) => void;
}

/**
 * Locks the camera to the runner marker as it moves along the route — a
 * fixed pitch/zoom chase cam, not an independent cinematic shot. Earlier
 * versions had the camera do its own thing (opening pull-back, grade-
 * responsive pitch swings) which read as "a lot of camera movement" rather
 * than simply following the object; this keeps pitch and zoom constant and
 * only ever changes heading, smoothed, to track the direction of travel.
 *
 * Two layers keep the rotation smooth rather than jerky:
 *
 * 1. The *target* heading itself is continuous, not stepped. A raw
 *    per-segment bearing (the direction from point i to i+1) jumps
 *    discretely at every one of the ~100 resampled points — turning that
 *    directly into a camera target made rotation look like a series of
 *    little snaps even with rate limiting on top. `pointHeadings` instead
 *    gives each point a bearing averaged from its incoming and outgoing
 *    segments, and the per-frame target is a circular interpolation between
 *    the current and next point's heading (by `localT`), so the target path
 *    itself is a smooth curve.
 * 2. The camera's actual heading eases toward that target with exponential
 *    smoothing (`headingSmoothingSec`) instead of a hard max-degrees/sec
 *    clamp — a clamp holds heading pinned at the limit through a sharp turn
 *    and then releases abruptly once the turn ends, which reads as a pop;
 *    exponential easing decelerates into agreement with the target
 *    continuously, so there's no release-snap on either sharp or gentle
 *    turns.
 *
 * Drives the camera directly (setCamera with animationDuration: 0, i.e. an
 * instant position set) from a requestAnimationFrame loop that interpolates
 * between waypoints every frame, so motion is one continuous flight rather
 * than a chain of discrete flyTo/linearTo animations stitched together.
 */
export async function animateFlybyCamera({
  points,
  cameraRef,
  durationMs = 22_000,
  pitch = 58,
  zoomLevel = 16.2,
  headingSmoothingSec = 0.35,
  isCancelled,
  onFrame,
}: AnimateFlybyCameraOptions): Promise<void> {
  if (points.length < 2) return;

  const segmentCount = points.length - 1;

  // Per-segment bearing (direction of travel along segment i -> i+1).
  const segmentBearings = points.slice(1).map((curr, i) => getBearing(points[i], curr));

  // Per-point heading: blend of the segment arriving at this point and the
  // segment leaving it, so the target curve has no hard corners at sample
  // boundaries. Endpoints just take their one available segment.
  const pointHeadings = points.map((_, i) => {
    if (i === 0) return segmentBearings[0];
    if (i === points.length - 1) return segmentBearings[segmentBearings.length - 1];
    const into = segmentBearings[i - 1];
    const out = segmentBearings[i];
    return (into + angleDelta(into, out) / 2 + 360) % 360;
  });

  await new Promise<void>((resolve) => {
    const startedAt = Date.now();
    let lastFrameAt = startedAt;
    let currentHeading = pointHeadings[0];

    const tick = () => {
      if (isCancelled?.()) {
        resolve();
        return;
      }

      const now = Date.now();
      const dtSec = Math.max(0, (now - lastFrameAt) / 1000);
      lastFrameAt = now;

      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / durationMs);
      const segFloat = t * segmentCount;
      const segIndex = Math.min(segmentCount - 1, Math.floor(segFloat));
      const localT = segFloat - segIndex;

      const prev = points[segIndex];
      const curr = points[segIndex + 1];

      const lat = prev.latitude + (curr.latitude - prev.latitude) * localT;
      const lng = prev.longitude + (curr.longitude - prev.longitude) * localT;

      // Smooth, continuous target heading — circular interpolation between
      // this point's and the next point's heading, not a stepped per-segment value.
      const headingFrom = pointHeadings[segIndex];
      const headingTo = pointHeadings[segIndex + 1];
      const targetHeading = (headingFrom + angleDelta(headingFrom, headingTo) * localT + 360) % 360;

      // Exponentially ease currentHeading toward targetHeading — continuous
      // deceleration into agreement, no clamp-then-release pop.
      const alpha = 1 - Math.exp(-dtSec / headingSmoothingSec);
      currentHeading = (currentHeading + angleDelta(currentHeading, targetHeading) * alpha + 360) % 360;

      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel,
        pitch,
        heading: currentHeading,
        animationDuration: 0,
        animationMode: 'none',
      });
      onFrame?.([lng, lat], currentHeading);

      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}
