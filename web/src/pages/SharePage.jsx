import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api } from '../lib/api.js';
import { buildMapStyle } from '../lib/mapStyle.js';
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
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle('light'),
      center: TURKEY_CENTER,
      zoom: 5,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
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
            el.style.backgroundColor = d.avatarColor || '#2563eb';
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
