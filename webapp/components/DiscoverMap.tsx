'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import { CloudRoute } from '../lib/types';
import { MapStyleMode } from './MapStyleControls';
import MapTools from './MapTools';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Philippines centroid, zoomed out enough to see the whole archipelago —
// same fallback view as the mobile app's MapScreen.
const DEFAULT_CENTER: [number, number] = [121.774, 12.8797];
const DEFAULT_ZOOM = 5;
const DEM_SOURCE_ID = 'rootah-terrain-dem';
const TILT_PITCH = 60;

const STYLE_URLS: Record<MapStyleMode, string> = {
  standard: 'mapbox://styles/mapbox/light-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

interface Props {
  routes: CloudRoute[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function applyTerrain(map: mapboxgl.Map, is3D: boolean) {
  if (is3D) {
    if (!map.getSource(DEM_SOURCE_ID)) {
      map.addSource(DEM_SOURCE_ID, { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512 });
    }
    map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: 1.5 });
    map.setPitch(TILT_PITCH);
  } else {
    map.setTerrain(null);
    map.setPitch(0);
  }
}

export default function DiscoverMap({ routes, selectedId, onSelect }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>('standard');
  const [is3D, setIs3D] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: STYLE_URLS.standard,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      // Mercator, not the v3 default globe projection — routes never need a
      // globe view, and combining globe projection with terrain/pitch
      // changes is a known source of internal mapbox-gl promise rejections.
      projection: 'mercator',
    });
    // Keyboard panning/zooming isn't needed here and only risks swallowing
    // keystrokes meant for the search box above the map.
    map.current.keyboard.disable();

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.setStyle(STYLE_URLS[mapStyleMode]);
    m.setProjection('mercator');
    // Deferred a tick — calling setTerrain/easeTo synchronously inside
    // 'style.load' can fire before mapbox-gl's internal style managers
    // (projection/terrain) finish initializing for the new style, throwing
    // "Cannot read properties of undefined" from inside the library.
    m.once('style.load', () => requestAnimationFrame(() => applyTerrain(m, is3D)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyleMode]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (m.isStyleLoaded()) requestAnimationFrame(() => applyTerrain(m, is3D));
    else m.once('style.load', () => requestAnimationFrame(() => applyTerrain(m, is3D)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is3D]);

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

        const card = document.createElement('div');
        card.className = 'map-popup-card';
        const title = document.createElement('span');
        title.className = 'map-popup-title';
        title.textContent = route.name;
        const meta = document.createElement('span');
        meta.className = 'map-popup-meta';
        meta.textContent = `${route.distanceKm.toFixed(1)} km${route.city ? ` · ${route.city}` : ''}`;
        card.appendChild(title);
        card.appendChild(meta);

        const popup = new mapboxgl.Popup({ closeButton: false, offset: 14, maxWidth: '220px' }).setDOMContent(card);

        marker = new mapboxgl.Marker({ element: el }).setLngLat([start.longitude, start.latitude]).setPopup(popup).addTo(map.current!);
        markers.current.set(route.id, marker);
      }

      const el = marker.getElement();
      el.style.background = route.id === selectedId ? 'var(--coral)' : 'var(--amber)';
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

  function handleRecenter() {
    const m = map.current;
    if (!m) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => m.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13, duration: 600 }),
        () => m.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 600 }),
      );
    } else {
      m.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <MapTools
        onZoomIn={() => map.current?.zoomIn({ duration: 200 })}
        onZoomOut={() => map.current?.zoomOut({ duration: 200 })}
        onRecenter={handleRecenter}
        is3D={is3D}
        onToggle3D={() => setIs3D((v) => !v)}
        mapStyleMode={mapStyleMode}
        onChangeStyle={setMapStyleMode}
      />
    </div>
  );
}
