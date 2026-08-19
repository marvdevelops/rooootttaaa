'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import { CloudRoute } from '../lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Philippines centroid, zoomed out enough to see the whole archipelago —
// same fallback view as the mobile app's MapScreen.
const DEFAULT_CENTER: [number, number] = [121.774, 12.8797];
const DEFAULT_ZOOM = 5;

interface Props {
  routes: CloudRoute[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function DiscoverMap({ routes, selectedId, onSelect }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;

    const currentIds = new Set(routes.map((r) => r.id));
    for (const [id, marker] of markers.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }

    for (const route of routes) {
      const start = route.waypoints[0];
      if (!start) continue;

      let marker = markers.current.get(route.id);
      if (!marker) {
        const el = document.createElement('button');
        el.setAttribute('aria-label', route.name);
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        el.style.cursor = 'pointer';
        el.style.padding = '0';
        el.addEventListener('click', () => onSelect(route.id));

        marker = new mapboxgl.Marker({ element: el }).setLngLat([start.longitude, start.latitude]).addTo(map.current!);
        markers.current.set(route.id, marker);
      }

      const el = marker.getElement();
      el.style.background = route.id === selectedId ? 'var(--coral)' : 'var(--teal)';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, selectedId]);

  useEffect(() => {
    if (!selectedId || !map.current) return;
    const route = routes.find((r) => r.id === selectedId);
    const start = route?.waypoints[0];
    if (start) {
      map.current.flyTo({ center: [start.longitude, start.latitude], zoom: 13, duration: 600 });
    }
  }, [selectedId, routes]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
}
