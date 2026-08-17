import { Camera } from '@rnmapbox/maps';
import React from 'react';
import { PathPoint } from '../types/route';

export interface FlybyCameraPoint {
  latitude: number;
  longitude: number;
  elevation: number;
}

/** Downsamples to a fixed point count regardless of route length, so the animation duration stays constant. */
export function sampleFlybyPoints(path: PathPoint[], targetCount = 100): FlybyCameraPoint[] {
  const withElevation = path.map((p) => ({ latitude: p.latitude, longitude: p.longitude, elevation: p.elevation ?? 0 }));
  if (withElevation.length <= targetCount) return withElevation;
  const step = (withElevation.length - 1) / (targetCount - 1);
  return Array.from({ length: targetCount }, (_, i) => withElevation[Math.round(i * step)]);
}

export function getBearing(from: FlybyCameraPoint, to: FlybyCameraPoint): number {
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Shortest angular path between two headings, so interpolating through 359°→1° doesn't spin the long way round. */
function interpolateBearing(from: number, to: number, t: number): number {
  let delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

export interface AnimateFlybyCameraOptions {
  points: FlybyCameraPoint[];
  cameraRef: React.RefObject<Camera | null>;
  durationMs?: number;
  pitch?: number;
  zoomLevel?: number;
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
 * Drives the camera directly (setCamera with animationDuration: 0, i.e. an
 * instant position set) from a requestAnimationFrame loop that interpolates
 * between waypoints every frame, so motion is one continuous flight rather
 * than a chain of discrete flyTo/linearTo animations stitched together.
 */
export async function animateFlybyCamera({
  points,
  cameraRef,
  durationMs = 14_000,
  pitch = 58,
  zoomLevel = 16.2,
  isCancelled,
  onFrame,
}: AnimateFlybyCameraOptions): Promise<void> {
  if (points.length < 2) return;

  const segmentCount = points.length - 1;

  // Precompute per-segment bearing once, up front, rather than recomputing on every frame.
  const bearings = points.slice(1).map((curr, i) => getBearing(points[i], curr));

  await new Promise<void>((resolve) => {
    const startedAt = Date.now();

    const tick = () => {
      if (isCancelled?.()) {
        resolve();
        return;
      }

      const elapsed = Date.now() - startedAt;
      const t = Math.min(1, elapsed / durationMs);
      const segFloat = t * segmentCount;
      const segIndex = Math.min(segmentCount - 1, Math.floor(segFloat));
      const localT = segFloat - segIndex;

      const prev = points[segIndex];
      const curr = points[segIndex + 1];
      const bearing = bearings[segIndex];
      const prevBearing = bearings[Math.max(0, segIndex - 1)];

      const lat = prev.latitude + (curr.latitude - prev.latitude) * localT;
      const lng = prev.longitude + (curr.longitude - prev.longitude) * localT;
      // Blend heading from the previous segment's value at the start of this
      // one, so direction changes ease across the boundary instead of snapping.
      const heading = interpolateBearing(prevBearing, bearing, localT);

      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel,
        pitch,
        heading,
        animationDuration: 0,
        animationMode: 'none',
      });
      onFrame?.([lng, lat], heading);

      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}
