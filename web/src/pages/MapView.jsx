import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api, getToken } from '../lib/api.js';
import { createSocket } from '../lib/socket.js';
import { watchPosition } from '../lib/geo.js';
import { timeAgo } from '../lib/time.js';
import { useAuth } from '../lib/auth.jsx';
import PeerList from '../components/PeerList.jsx';

// [lng, lat] — MapLibre koordinat sirasi
const TURKEY_CENTER = [35.0, 39.0];

// Temaya gore OpenFreeMap vektor stilleri (acik kaynak, API anahtarsiz)
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

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
  const { user, setUser, logout } = useAuth();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const appliedThemeRef = useRef(null);
  const socketRef = useRef(null);
  const peerMarkersRef = useRef({});
  const ownMarkerRef = useRef(null);

  const [peers, setPeers] = useState({});
  const [myPos, setMyPos] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [mapTheme, setMapTheme] = useState(currentMapTheme());

  // Harita kurulumu (attribution gizli)
  useEffect(() => {
    const theme = currentMapTheme();
    appliedThemeRef.current = theme;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[theme],
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

  // Tema degisimini izle (acik/koyu/sistem)
  useEffect(() => {
    const observer = new MutationObserver(() => setMapTheme(currentMapTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // Harita stilini temaya gore degistir (isaretciler stil degisiminde korunur)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedThemeRef.current === mapTheme) return;
    appliedThemeRef.current = mapTheme;
    map.setStyle(STYLES[mapTheme]);
  }, [mapTheme]);

  // Socket baglantisi
  useEffect(() => {
    const socket = createSocket(getToken());
    socketRef.current = socket;

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
        socketRef.current?.emit('location:update', pos);
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
      const el = avatarElement(user.displayName, user.avatarColor);
      ownMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([myPos.lng, myPos.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML('<b>Sen</b>'))
        .addTo(map);
      map.flyTo({ center: [myPos.lng, myPos.lat], zoom: 15 });
    } else {
      ownMarkerRef.current.setLngLat([myPos.lng, myPos.lat]);
      setAvatar(ownMarkerRef.current.getElement(), user.displayName, user.avatarColor);
    }
  }, [myPos, user.displayName, user.avatarColor]);

  // Peer isaretcilerini state ile esitle
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
        const el = avatarElement(p.displayName, p.avatarColor);
        markers[p.userId] = new maplibregl.Marker({ element: el })
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
    if (marker && !marker.getPopup().isOpen()) {
      marker.togglePopup();
    }
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
        <button type="button" className="peer-count" onClick={() => setPanelOpen((v) => !v)}>
          👥 {peerList.length}
        </button>
        <button type="button" className="link-btn" onClick={logout}>
          Çıkış
        </button>
      </div>

      {geoError && <div className="geo-banner">{geoError}</div>}

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
    </div>
  );
}
