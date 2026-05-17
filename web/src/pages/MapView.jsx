import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, getToken } from '../lib/api.js';
import { createSocket } from '../lib/socket.js';
import { watchPosition } from '../lib/geo.js';
import { timeAgo } from '../lib/time.js';
import { useAuth } from '../lib/auth.jsx';
import PeerList from '../components/PeerList.jsx';

const TURKEY_CENTER = [39.0, 35.0];

// Temaya gore harita kutucuklari (CARTO basemaps)
const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
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

function avatarIcon(name, color) {
  const initial = escapeHtml((name || '?').trim().charAt(0).toUpperCase() || '?');
  return L.divIcon({
    className: 'map-avatar-wrap',
    html: `<div class="map-avatar" style="background:${color}">${initial}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

export default function MapView() {
  const { user, setUser, logout } = useAuth();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const socketRef = useRef(null);
  const peerMarkersRef = useRef({});
  const ownMarkerRef = useRef(null);

  const [peers, setPeers] = useState({});
  const [myPos, setMyPos] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [mapTheme, setMapTheme] = useState(currentMapTheme());

  // Harita kurulumu (attribution yazisi gizli)
  useEffect(() => {
    const map = L.map(containerRef.current, {
      attributionControl: false,
    }).setView(TURKEY_CENTER, 6);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
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

  // Harita kutucuklarini temaya gore degistir
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(TILES[mapTheme], {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);
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
    const icon = avatarIcon(user.displayName, user.avatarColor);
    if (!ownMarkerRef.current) {
      ownMarkerRef.current = L.marker([myPos.lat, myPos.lng], {
        icon,
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup('<b>Sen</b>');
      map.setView([myPos.lat, myPos.lng], 15);
    } else {
      ownMarkerRef.current.setLatLng([myPos.lat, myPos.lng]).setIcon(icon);
    }
  }, [myPos, user.displayName, user.avatarColor]);

  // Peer isaretcilerini state ile esitle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = peerMarkersRef.current;

    for (const id of Object.keys(markers)) {
      if (!peers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    }
    for (const p of Object.values(peers)) {
      const popup = `<b>${escapeHtml(p.displayName)}</b><br>${timeAgo(p.updatedAt)}`;
      const icon = avatarIcon(p.displayName, p.avatarColor || '#2563eb');
      if (markers[p.userId]) {
        markers[p.userId].setLatLng([p.lat, p.lng]).setIcon(icon).setPopupContent(popup);
      } else {
        markers[p.userId] = L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(popup);
      }
    }
  }, [peers]);

  function recenter() {
    if (mapRef.current && myPos) {
      mapRef.current.setView([myPos.lat, myPos.lng], 15);
    }
  }

  function focusPeer(p) {
    setPanelOpen(false);
    if (mapRef.current) {
      mapRef.current.setView([p.lat, p.lng], 16);
      peerMarkersRef.current[p.userId]?.openPopup();
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
