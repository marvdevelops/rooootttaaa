'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import { RouteNote, RouteSegment, Waypoint } from '../lib/types';
import MapStyleControls, { MapStyleMode } from './MapStyleControls';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const DEFAULT_CENTER: [number, number] = [121.774, 12.8797];
const DEM_SOURCE_ID = 'rootah-terrain-dem';
const TILT_PITCH = 60;

const STYLE_URLS: Record<MapStyleMode, string> = {
  standard: 'mapbox://styles/mapbox/light-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

interface Props {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  notes?: RouteNote[];
  interactive?: boolean;
  onMapClick?: (lngLat: { lat: number; lng: number }) => void;
}

const SOURCE_ID = 'route-line';
const LAYER_ID = 'route-line-layer';

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

export default function RoutePathMap({ waypoints, segments, notes = [], interactive = true, onMapClick }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const noteMarkers = useRef<mapboxgl.Marker[]>([]);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  // isStyleLoaded()/once('load') race — if 'load' already fired by the time
  // the geometry effect below subscribes, once() never calls back (it only
  // listens for *future* emissions). This ref is the single source of truth
  // for "is it safe to touch the source/layer yet", set once by the 'load'
  // handler and checked everywhere else instead.
  const loaded = useRef(false);
  const applyGeometryRef = useRef<() => void>(() => {});
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>('standard');
  const [is3D, setIs3D] = useState(false);
  const is3DRef = useRef(is3D);
  is3DRef.current = is3D;

  function setupRouteLayer(m: mapboxgl.Map) {
    if (!m.getSource(SOURCE_ID)) {
      m.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!m.getLayer(LAYER_ID)) {
      m.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#E84B2A', 'line-width': 4 },
      });
    }
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: STYLE_URLS.standard,
      center: DEFAULT_CENTER,
      zoom: 5,
      interactive,
      // Mercator, not the v3 default globe projection — routes never need a
      // globe view, and combining globe projection with terrain/pitch
      // changes is a known source of internal mapbox-gl promise rejections.
      projection: 'mercator',
    });
    map.current = m;

    m.on('load', () => {
      setupRouteLayer(m);
      loaded.current = true;
      applyGeometryRef.current();
    });

    if (onMapClickRef.current) {
      m.on('click', (e) => onMapClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    }

    return () => {
      m.remove();
      map.current = null;
      loaded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    m.setStyle(STYLE_URLS[mapStyleMode]);
    m.setProjection('mercator');
    m.once('style.load', () => {
      setupRouteLayer(m);
      applyGeometryRef.current();
      // Deferred a tick — calling setTerrain/easeTo synchronously inside
      // 'style.load' can fire before mapbox-gl's internal style managers
      // (projection/terrain) finish initializing for the new style,
      // throwing "Cannot read properties of undefined" from inside the library.
      requestAnimationFrame(() => applyTerrain(m, is3DRef.current));
    });
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
    const m = map.current;

    const applyGeometry = () => {
      if (!m) return;
      const source = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;

      const coordinates = segments.flatMap((seg) => seg.path.map((p) => [p.longitude, p.latitude]));
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      });

      markers.current.forEach((marker) => marker.remove());
      markers.current = waypoints.map((wp, i) => {
        const el = document.createElement('div');
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        el.style.background = i === 0 ? '#4BAB7A' : i === waypoints.length - 1 ? '#E84B2A' : '#4BABB8';
        return new mapboxgl.Marker({ element: el }).setLngLat([wp.longitude, wp.latitude]).addTo(m);
      });

      noteMarkers.current.forEach((marker) => marker.remove());
      noteMarkers.current = notes.map((note) => {
        const el = document.createElement('div');
        el.style.width = '22px';
        el.style.height = '22px';
        el.style.borderRadius = '50% 50% 50% 0';
        el.style.transform = 'rotate(-45deg)';
        el.style.background = '#E8923A';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,.35)';
        el.style.cursor = 'pointer';
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false }).setText(note.text || 'Note');
        return new mapboxgl.Marker({ element: el }).setLngLat([note.longitude, note.latitude]).setPopup(popup).addTo(m);
      });

      if (coordinates.length > 0) {
        const bounds = coordinates.reduce(
          (b, c) => b.extend(c as [number, number]),
          new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]),
        );
        m.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 400 });
      } else if (waypoints.length === 1) {
        m.flyTo({ center: [waypoints[0].longitude, waypoints[0].latitude], zoom: 15 });
      }
    };

    applyGeometryRef.current = applyGeometry;
    if (loaded.current) applyGeometry();
  }, [waypoints, segments, notes]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <MapStyleControls
        mapStyleMode={mapStyleMode}
        onChangeStyle={setMapStyleMode}
        is3D={is3D}
        onToggle3D={() => setIs3D((v) => !v)}
      />
    </div>
  );
}
