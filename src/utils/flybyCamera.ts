import { Camera } from '@rnmapbox/maps';
import React from 'react';
import { PathPoint } from '../types/route';
import { haversineDistance } from './distance';

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AnimateFlybyCameraOptions {
  points: FlybyCameraPoint[];
  cameraRef: React.RefObject<Camera | null>;
  durationMs?: number;
  pitchDefault?: number;
  /** Called if the animation is cancelled mid-flight (e.g. user backs out of the flyby screen). */
  isCancelled?: () => boolean;
  /** Fired every animation frame (~60fps) with the interpolated position — drives the runner marker so it moves continuously instead of jumping between waypoints. */
  onFrame?: (coordinate: [number, number], bearing: number) => void;
}

function centerOf(points: FlybyCameraPoint[]): [number, number] {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

/**
 * Flies the camera along the route: an opening pull-back shot of the whole
 * route, then a low-altitude flight along it with elevation-responsive pitch
 * (steeper climbs tilt the camera further forward for a more dramatic shot).
 *
 * The along-route flight drives the camera directly (setCamera with
 * animationDuration: 0, i.e. an instant position set) from a
 * requestAnimationFrame loop that interpolates between waypoints every
 * frame. Chaining many short flyTo/linearTo calls — even linearTo — still
 * reads as segmented, because each call is its own discrete animation with
 * its own start/end; the only way to get one genuinely continuous flight is
 * to own the interpolation ourselves and just place the camera every frame.
 */
export async function animateFlybyCamera({
  points,
  cameraRef,
  durationMs = 14_000,
  pitchDefault = 55,
  isCancelled,
  onFrame,
}: AnimateFlybyCameraOptions): Promise<void> {
  if (points.length < 2) return;

  cameraRef.current?.setCamera({
    centerCoordinate: centerOf(points),
    zoomLevel: 11,
    pitch: 25,
    animationDuration: 1500,
    animationMode: 'flyTo',
  });
  await sleep(2300);
  if (isCancelled?.()) return;

  const segmentCount = points.length - 1;

  // Precompute per-segment bearing and pitch once, up front, rather than
  // recomputing on every frame.
  const segments = points.slice(1).map((curr, i) => {
    const prev = points[i];
    const elevDiff = curr.elevation - prev.elevation;
    const distM = Math.max(1, haversineDistance(prev, curr));
    const gradePct = (elevDiff / distM) * 100;
    return {
      pitch: Math.min(75, Math.max(40, pitchDefault + gradePct * 0.8)),
      bearing: getBearing(prev, curr),
    };
  });

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
      const seg = segments[segIndex];
      const prevSeg = segments[Math.max(0, segIndex - 1)];

      const lat = prev.latitude + (curr.latitude - prev.latitude) * localT;
      const lng = prev.longitude + (curr.longitude - prev.longitude) * localT;
      // Blend pitch/bearing from the previous segment's value at the start
      // of this one, so grade/direction changes ease across the boundary
      // instead of snapping.
      const pitch = prevSeg.pitch + (seg.pitch - prevSeg.pitch) * localT;
      const bearing = interpolateBearing(prevSeg.bearing, seg.bearing, localT);

      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: 15.5,
        pitch,
        heading: bearing,
        animationDuration: 0,
        animationMode: 'none',
      });
      onFrame?.([lng, lat], bearing);

      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}
