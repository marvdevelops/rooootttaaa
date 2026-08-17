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
 */
export async function animateFlybyCamera({
  points,
  cameraRef,
  durationMs = 14_000,
  pitchDefault = 55,
  isCancelled,
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

  const segmentDuration = durationMs / points.length;
  for (let i = 1; i < points.length; i++) {
    if (isCancelled?.()) return;
    const prev = points[i - 1];
    const curr = points[i];

    const elevDiff = curr.elevation - prev.elevation;
    const distM = Math.max(1, haversineDistance(prev, curr));
    const gradePct = (elevDiff / distM) * 100;
    const pitch = Math.min(75, Math.max(40, pitchDefault + gradePct * 0.8));
    const bearing = getBearing(prev, curr);

    cameraRef.current?.setCamera({
      centerCoordinate: [curr.longitude, curr.latitude],
      zoomLevel: 15.5,
      pitch,
      heading: bearing,
      animationDuration: segmentDuration,
      animationMode: 'flyTo',
    });
    await sleep(segmentDuration);
  }
}
