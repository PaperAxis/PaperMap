import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api, getToken } from '../lib/api.js';
import { createSocket } from '../lib/socket.js';
import { watchPosition } from '../lib/geo.js';
import { timeAgo } from '../lib/time.js';
import { useAuth } from '../lib/auth.jsx';
import { buildMapStyle } from '../lib/mapStyle.js';
import { geofencesToGeoJSON } from '../lib/geojson.js';
import PeerList from '../components/PeerList.jsx';
import GeofencePanel from '../components/GeofencePanel.jsx';

// [lng, lat] — MapLibre koordinat sirasi
const TURKEY_CENTER = [35.0, 39.0];

function currentMapTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function setAvatar(el, name, color) {
  el.style.background = color || '#2563eb';
  el.textContent = (name || '?').trim().charAt(0).toUpperCase() || '?';
}

function avatarElement(name, color) {
  const el = document.createElement('div');
  el.className = 'map-avatar';
  setAvatar(el, name, color);
  return el;
}

export default function MapView() {
  const { user, setUser } = useAuth();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const appliedThemeRef = useRef(null);
  const peerMarkersRef = useRef({});
  const ownMarkerRef = useRef(null);
  const geofencesRef = useRef([]);

  const [peers, setPeers] = useState({});
  const [myPos, setMyPos] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [mapTheme, setMapTheme] = useState(currentMapTheme());

  const [geofences, setGeofences] = useState([]);
  const [geofencePanelOpen, setGeofencePanelOpen] = useState(false);
  const [placingMode, setPlacingMode] = useState(false);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [gfName, setGfName] = useState('');
  const [gfRadius, setGfRadius] = useState(300);
  const [gfError, setGfError] = useState('');

  // Geofence katman/kaynaklarini stile ekler veya verisini gunceller
  function syncGeofenceLayers() {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const data = geofencesToGeoJSON(geofencesRef.current);
    if (map.getSource('geofences')) {
      map.getSource('geofences').setData(data);
      return;
    }
    map.addSource('geofences', { type: 'geojson', data });
    map.addLayer({
      id: 'geofence-fill',
      type: 'fill',
      source: 'geofences',
      paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.13 },
    });
    map.addLayer({
      id: 'geofence-line',
      type: 'line',
      source: 'geofences',
      paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 1] },
    });
  }

  // Harita kurulumu
  useEffect(() => {
    const theme = currentMapTheme();
    appliedThemeRef.current = theme;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(theme),
      center: TURKEY_CENTER,
      zoom: 5,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('style.load', syncGeofenceLayers);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Tema degisimini izle
  useEffect(() => {
    const observer = new MutationObserver(() => setMapTheme(currentMapTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // Harita stilini temaya gore degistir
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedThemeRef.current === mapTheme) return;
    appliedThemeRef.current = mapTheme;
    map.setStyle(buildMapStyle(mapTheme));
  }, [mapTheme]);

  // Geofence'leri yukle
  function loadGeofences() {
    api('/api/geofences')
      .then((d) => setGeofences(d.geofences))
      .catch(() => {});
  }
  useEffect(() => {
    loadGeofences();
  }, []);

  // Geofence verisi degisince haritayi guncelle
  useEffect(() => {
    geofencesRef.current = geofences;
    syncGeofenceLayers();
  }, [geofences]);

  // Alan yerlestirme modu — haritada tiklama
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placingMode) return undefined;
    function onClick(e) {
      setPendingPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      setGfName('');
      setGfRadius(300);
      setGfError('');
      setPlacingMode(false);
    }
    map.on('click', onClick);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', onClick);
      if (mapRef.current) map.getCanvas().style.cursor = '';
    };
  }, [placingMode]);

  // Socket baglantisi
  useEffect(() => {
    const socket = createSocket(getToken());
    socket.on('peers:snapshot', (list) => {
      setPeers(Object.fromEntries(list.map((p) => [p.userId, p])));
    });
    socket.on('peer:location', (p) => {
      setPeers((prev) => ({ ...prev, [p.userId]: p }));
    });
    socket.on('peer:offline', ({ userId }) => {
      setPeers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });
    socket.on('peers:changed', () => socket.emit('refresh'));
    return () => socket.close();
  }, []);

  // Konum izleme
  useEffect(() => {
    const stop = watchPosition(
      (pos) => {
        setGeoError('');
        setMyPos(pos);
        // Konum HTTP ile gonderilir — arka planda da calisir
        api('/api/location', { method: 'POST', body: pos }).catch(() => {});
      },
      (err) => {
        setGeoError(
          err?.code === 1
            ? 'Konum izni reddedildi. Haritada görünmek için izin verin.'
            : 'Konum alınamadı: ' + (err?.message || 'bilinmeyen hata'),
        );
      },
    );
    return stop;
  }, []);

  // Kendi konum isaretcisi
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !myPos) return;
    if (!ownMarkerRef.current) {
      ownMarkerRef.current = new maplibregl.Marker({
        element: avatarElement(user.displayName, user.avatarColor),
      })
        .setLngLat([myPos.lng, myPos.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML('<b>Sen</b>'))
        .addTo(map);
      map.flyTo({ center: [myPos.lng, myPos.lat], zoom: 15 });
    } else {
      ownMarkerRef.current.setLngLat([myPos.lng, myPos.lat]);
      setAvatar(ownMarkerRef.current.getElement(), user.displayName, user.avatarColor);
    }
  }, [myPos, user.displayName, user.avatarColor]);

  // Peer isaretcileri
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = peerMarkersRef.current;
    for (const id of Object.keys(markers)) {
      if (!peers[id]) {
        markers[id].remove();
        delete markers[id];
      }
    }
    for (const p of Object.values(peers)) {
      const html = `<b>${escapeHtml(p.displayName)}</b><br>${timeAgo(p.updatedAt)}`;
      if (markers[p.userId]) {
        markers[p.userId].setLngLat([p.lng, p.lat]);
        setAvatar(markers[p.userId].getElement(), p.displayName, p.avatarColor);
        markers[p.userId].getPopup().setHTML(html);
      } else {
        markers[p.userId] = new maplibregl.Marker({
          element: avatarElement(p.displayName, p.avatarColor),
        })
          .setLngLat([p.lng, p.lat])
          .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(html))
          .addTo(map);
      }
    }
  }, [peers]);

  function recenter() {
    if (mapRef.current && myPos) {
      mapRef.current.flyTo({ center: [myPos.lng, myPos.lat], zoom: 15 });
    }
  }

  function focusPeer(p) {
    setPanelOpen(false);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [p.lng, p.lat], zoom: 16 });
    const marker = peerMarkersRef.current[p.userId];
    if (marker && !marker.getPopup().isOpen()) marker.togglePopup();
  }

  async function toggleSharing() {
    try {
      const d = await api('/api/location/sharing', {
        method: 'PATCH',
        body: { enabled: !user.sharingEnabled },
      });
      setUser(d.user);
    } catch (err) {
      setGeoError(err.message);
    }
  }

  function startPlacing() {
    setGeofencePanelOpen(false);
    setPlacingMode(true);
  }

  async function createGeofence(e) {
    e.preventDefault();
    setGfError('');
    try {
      const d = await api('/api/geofences', {
        method: 'POST',
        body: {
          name: gfName,
          lat: pendingPoint.lat,
          lng: pendingPoint.lng,
          radius: Number(gfRadius),
        },
      });
      setGeofences((prev) => [d.geofence, ...prev]);
      setPendingPoint(null);
    } catch (err) {
      setGfError(err.message);
    }
  }

  const peerList = Object.values(peers);

  return (
    <div className="map-page">
      <div className="map-topbar">
        <button
          type="button"
          className={`share-toggle ${user.sharingEnabled ? 'on' : 'off'}`}
          onClick={toggleSharing}
        >
          {user.sharingEnabled ? '📍 Paylaşım açık' : '🚫 Paylaşım kapalı'}
        </button>
        <button
          type="button"
          className="peer-count"
          onClick={() => {
            setGeofencePanelOpen(false);
            setPanelOpen((v) => !v);
          }}
        >
          👥 {peerList.length}
        </button>
        <button
          type="button"
          className="peer-count"
          onClick={() => {
            setPanelOpen(false);
            setGeofencePanelOpen((v) => !v);
          }}
        >
          🚩 {geofences.length}
        </button>
      </div>

      {geoError && <div className="geo-banner">{geoError}</div>}
      {placingMode && (
        <div className="geo-banner">
          Alanın merkezi için haritada bir noktaya dokunun…{' '}
          <button type="button" className="link-btn" onClick={() => setPlacingMode(false)}>
            İptal
          </button>
        </div>
      )}

      <div ref={containerRef} className="map-canvas" />

      <button type="button" className="map-fab" onClick={recenter} title="Konumuma git">
        🎯
      </button>

      {panelOpen && (
        <div className="peer-panel">
          <div className="peer-panel-head">
            <strong>Haritadaki kişiler</strong>
            <button type="button" className="link-btn" onClick={() => setPanelOpen(false)}>
              Kapat
            </button>
          </div>
          <PeerList peers={peerList} onSelect={focusPeer} />
        </div>
      )}

      {geofencePanelOpen && (
        <GeofencePanel
          geofences={geofences}
          onClose={() => setGeofencePanelOpen(false)}
          onStartPlacing={startPlacing}
          onChanged={loadGeofences}
        />
      )}

      {pendingPoint && (
        <div className="modal-overlay">
          <form className="modal-card" onSubmit={createGeofence}>
            <h3>Yeni alan</h3>
            <div className="field">
              <label>Alan adı</label>
              <input
                value={gfName}
                onChange={(e) => setGfName(e.target.value)}
                placeholder="Örn. Ev, Okul"
                required
              />
            </div>
            <div className="field">
              <label>Yarıçap: {gfRadius} m</label>
              <input
                type="range"
                min="50"
                max="5000"
                step="50"
                value={gfRadius}
                onChange={(e) => setGfRadius(e.target.value)}
              />
            </div>
            {gfError && <div className="error">{gfError}</div>}
            <div className="row">
              <button
                type="button"
                className="secondary"
                onClick={() => setPendingPoint(null)}
              >
                Vazgeç
              </button>
              <button type="submit">Oluştur</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
