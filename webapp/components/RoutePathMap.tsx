'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import { RouteSegment, Waypoint } from '../lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const DEFAULT_CENTER: [number, number] = [121.774, 12.8797];

interface Props {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  interactive?: boolean;
  onMapClick?: (lngLat: { lat: number; lng: number }) => void;
}

const SOURCE_ID = 'route-line';
const LAYER_ID = 'route-line-layer';

export default function RoutePathMap({ waypoints, segments, interactive = true, onMapClick }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  // isStyleLoaded()/once('load') race — if 'load' already fired by the time
  // the geometry effect below subscribes, once() never calls back (it only
  // listens for *future* emissions). This ref is the single source of truth
  // for "is it safe to touch the source/layer yet", set once by the 'load'
  // handler and checked everywhere else instead.
  const loaded = useRef(false);
  const applyGeometryRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: DEFAULT_CENTER,
      zoom: 5,
      interactive,
    });
    map.current = m;

    m.on('load', () => {
      m.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#E84B2A', 'line-width': 4 },
      });
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
  }, [waypoints, segments]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
}
