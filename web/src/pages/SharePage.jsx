import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api } from '../lib/api.js';
import { buildMapStyle, MAP_MAX_ZOOM, resolveMapStyle } from '../lib/mapStyle.js';
import {
  Map3DControl,
  MAX_PITCH,
  PITCH_3D,
  applyTerrain,
  load3DPref,
  loadMapStylePref,
  save3DPref,
  set3D,
} from '../lib/map3d.js';
import { timeAgo } from '../lib/time.js';

const TURKEY_CENTER = [35.0, 39.0];

// Hesapsiz herkese acik konum sayfasi — gecici baglanti ile erisilir.
export default function SharePage() {
  const { token } = useParams();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let is3D = load3DPref();
    const map = new maplibregl.Map({
      container: containerRef.current,
      // Paylasim sayfasi acik temadadir; ziyaretcinin sectigi stil (or. Uydu) korunur
      style: buildMapStyle(resolveMapStyle(loadMapStylePref(), 'light'), { web: true }),
      center: TURKEY_CENTER,
      zoom: 5,
      pitch: is3D ? PITCH_3D : 0,
      maxPitch: MAX_PITCH,
      maxZoom: MAP_MAX_ZOOM,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-right',
    );
    map.addControl(
      new Map3DControl({
        enabled: is3D,
        onToggle: (on) => {
          is3D = on;
          save3DPref(on);
          set3D(map, on);
        },
      }),
      'top-right',
    );
    map.on('style.load', () => applyTerrain(map, is3D));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let firstFix = true;

    async function load() {
      try {
        const d = await api(`/api/public/share/${token}`);
        if (!active) return;
        setData(d);
        setError('');
        const map = mapRef.current;
        if (map && d.location) {
          const lngLat = [d.location.lng, d.location.lat];
          if (!markerRef.current) {
            const el = document.createElement('div');
            el.className = 'map-avatar';
            el.style.backgroundColor = d.avatarColor || '#315bdb';
            el.textContent = (d.displayName || '?').trim().charAt(0).toUpperCase();
            markerRef.current = new maplibregl.Marker({ element: el })
              .setLngLat(lngLat)
              .addTo(map);
          } else {
            markerRef.current.setLngLat(lngLat);
          }
          if (firstFix) {
            map.flyTo({ center: lngLat, zoom: 15 });
            firstFix = false;
          }
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    }

    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);

  return (
    <div className="map-page">
      <div className="map-topbar">
        {error ? (
          <span>{error}</span>
        ) : data ? (
          <span>
            <strong>{data.displayName}</strong>
            {data.location
              ? ` · konum ${timeAgo(data.location.updatedAt)}`
              : ' · henüz konum yok'}
          </span>
        ) : (
          <span>Yükleniyor…</span>
        )}
      </div>
      <div ref={containerRef} className="map-canvas" />
    </div>
  );
}
