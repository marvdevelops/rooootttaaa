import { offlineManager } from '@rnmapbox/maps';
import { Waypoint } from '../types/route';

/**
 * Satellite tiles are far heavier than vector tiles — without this, tiles
 * stream in mid-capture and the video shows grey placeholder squares filling
 * in, which looks broken. Preloads the whole route corridor at flyby zoom
 * levels before the camera animation starts.
 */
export async function preloadFlybyTiles(
  routeId: string,
  waypoints: Waypoint[],
  styleUrl: string,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  if (waypoints.length === 0) return;

  const lats = waypoints.map((w) => w.latitude);
  const lngs = waypoints.map((w) => w.longitude);
  // Pad the bounds a bit so the camera's wide opening shot isn't left showing
  // unloaded tiles at the edges.
  const pad = 0.02;
  const ne: [number, number] = [Math.max(...lngs) + pad, Math.max(...lats) + pad];
  const sw: [number, number] = [Math.min(...lngs) - pad, Math.min(...lats) - pad];

  const packName = `flyby_${routeId}`;
  // Clear any stale pack from a previous attempt before starting a fresh one.
  await offlineManager.deletePack(packName).catch(() => {});

  await new Promise<void>((resolve, reject) => {
    offlineManager
      .createPack(
        {
          name: packName,
          styleURL: styleUrl,
          bounds: [ne, sw],
          minZoom: 11,
          maxZoom: 16,
        },
        (_pack, status) => {
          onProgress?.(status.percentage);
          if (status.percentage >= 100) resolve();
        },
        (_pack, err) => reject(new Error(err.message)),
      )
      .catch(reject);
  });
}

export async function deleteFlybyTiles(routeId: string): Promise<void> {
  await offlineManager.deletePack(`flyby_${routeId}`).catch(() => {});
}
