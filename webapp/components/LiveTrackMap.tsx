'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import { RouteSegment } from '../lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const DEFAULT_CENTER: [number, number] = [121.774, 12.8797];
const SOURCE_ID = 'race-route-line';
const LAYER_ID = 'race-route-line-layer';
const TRAIL_SOURCE_ID = 'race-traveled-trail';
const TRAIL_LAYER_ID = 'race-traveled-trail-layer';

interface Props {
  segments: RouteSegment[];
  liveLat: number | null;
  liveLng: number | null;
}

/** Read-only route line + a single live-position marker that moves as liveLat/liveLng update — the public race spectator map, deliberately simpler than the builder's RoutePathMap (no waypoints, no interactivity beyond pan/zoom). */
export default function LiveTrackMap({ segments, liveLat, liveLng }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const liveMarker = useRef<mapboxgl.Marker | null>(null);
  const loaded = useRef(false);
  const hasFitted = useRef(false);
  const hasFocusedRunner = useRef(false);
  // Solid coral breadcrumb trail of where the runner has actually been —
  // without this, a single jumping marker with a multi-second easeTo
  // between sparse updates reads as cutting straight lines off the road,
  // which is what made the live map look like it was "drawing a different
  // route." Accumulated client-side (not persisted), since every update
  // already lands here via Realtime.
  const trail = useRef<[number, number][]>([]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: DEFAULT_CENTER,
      zoom: 5,
      projection: 'mercator',
    });
    map.current = m;

    const el = document.createElement('div');
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.background = '#E84B2A';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,.4)';
    liveMarker.current = new mapboxgl.Marker({ element: el });

    m.on('load', () => {
      m.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#8C8078', 'line-width': 4, 'line-dasharray': [2, 2] },
      });
      m.addSource(TRAIL_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: TRAIL_LAYER_ID,
        type: 'line',
        source: TRAIL_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#E84B2A', 'line-width': 5 },
      });
      loaded.current = true;
    });

    return () => {
      m.remove();
      map.current = null;
      loaded.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    const source = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const coordinates = segments.flatMap((seg) => seg.path.map((p) => [p.longitude, p.latitude]));
    source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });

    if (coordinates.length > 0 && !hasFitted.current) {
      const bounds = coordinates.reduce(
        (b, c) => b.extend(c as [number, number]),
        new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]),
      );
      m.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 400 });
      hasFitted.current = true;
    }
  }, [segments]);

  useEffect(() => {
    const m = map.current;
    if (!m || liveLat === null || liveLng === null || !liveMarker.current) return;
    liveMarker.current.setLngLat([liveLng, liveLat]);
    if (!liveMarker.current.getElement().isConnected) liveMarker.current.addTo(m);
    if (!loaded.current) return;

    const last = trail.current[trail.current.length - 1];
    if (!last || last[0] !== liveLng || last[1] !== liveLat) {
      trail.current.push([liveLng, liveLat]);
      const trailSource = m.getSource(TRAIL_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      trailSource?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: trail.current } });
    }

    if (!hasFocusedRunner.current) {
      // First live fix — zoom in tight on the runner rather than staying at
      // the whole-route fitBounds level (which can be quite far out for a
      // long course). The route line is still drawn underneath, just mostly
      // out of frame, same as it would be on a phone's live-tracking view.
      hasFocusedRunner.current = true;
      m.easeTo({ center: [liveLng, liveLat], zoom: 16, duration: 800 });
    } else {
      // Later updates just re-center — don't fight a viewer who's zoomed
      // out themselves to see how the runner sits against the route.
      m.easeTo({ center: [liveLng, liveLat], duration: 600 });
    }
  }, [liveLat, liveLng]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
