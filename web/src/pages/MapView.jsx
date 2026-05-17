import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MapPin,
  MapPinOff,
  Users,
  Flag,
  LocateFixed,
  Siren,
  Bookmark,
  Play,
  Pause,
} from 'lucide-react';
import { api, getToken, API_BASE } from '../lib/api.js';
import { createSocket } from '../lib/socket.js';
import { watchPosition, openLocationSettings } from '../lib/geo.js';
import { getBattery, batteryLabel } from '../lib/battery.js';
import { timeAgo } from '../lib/time.js';
import { useAuth } from '../lib/auth.jsx';
import { buildMapStyle } from '../lib/mapStyle.js';
import { geofencesToGeoJSON, historyToGeoJSON } from '../lib/geojson.js';
import PeerList from '../components/PeerList.jsx';
import GeofencePanel from '../components/GeofencePanel.jsx';
import PlacesPanel, { PLACE_COLORS } from '../components/PlacesPanel.jsx';

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

function setAvatar(el, name, color, avatarPath) {
  if (avatarPath) {
    el.style.backgroundColor = '';
    el.style.backgroundImage = `url(${API_BASE}${avatarPath})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.style.backgroundColor = color || '#2563eb';
    el.textContent = (name || '?').trim().charAt(0).toUpperCase() || '?';
  }
}

function avatarElement(name, color, avatarPath) {
  const el = document.createElement('div');
  el.className = 'map-avatar';
  setAvatar(el, name, color, avatarPath);
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
  const historyRef = useRef([]);
  const placeMarkersRef = useRef({});
  const playbackMarkerRef = useRef(null);

  const [peers, setPeers] = useState({});
  const [myPos, setMyPos] = useState(null);
  const [myMeta, setMyMeta] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [locationSettingsNeeded, setLocationSettingsNeeded] = useState(false);
  const [notice, setNotice] = useState('');
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [, setShareTick] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mapTheme, setMapTheme] = useState(currentMapTheme());

  const [history, setHistory] = useState(null); // { userId, name, points }
  const [playIndex, setPlayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sosConfirm, setSosConfirm] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosAlert, setSosAlert] = useState(null); // gelen acil durum cagrisi
  const [geofences, setGeofences] = useState([]);
  const [geofencePanelOpen, setGeofencePanelOpen] = useState(false);
  const [placingMode, setPlacingMode] = useState(false);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [gfName, setGfName] = useState('');
  const [gfRadius, setGfRadius] = useState(300);
  const [gfError, setGfError] = useState('');

  const [places, setPlaces] = useState([]);
  const [placesPanelOpen, setPlacesPanelOpen] = useState(false);
  const [placingPlace, setPlacingPlace] = useState(false);
  const [pendingPlace, setPendingPlace] = useState(null);
  const [plName, setPlName] = useState('');
  const [plColor, setPlColor] = useState(PLACE_COLORS[0]);
  const [plError, setPlError] = useState('');

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

  // Konum gecmisi izini stile ekler veya verisini gunceller
  function syncHistoryLayers() {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const data = historyToGeoJSON(historyRef.current);
    if (map.getSource('history')) {
      map.getSource('history').setData(data);
      return;
    }
    map.addSource('history', { type: 'geojson', data });
    map.addLayer({
      id: 'history-line',
      type: 'line',
      source: 'history',
      filter: ['==', '$type', 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#f97316', 'line-width': 3, 'line-opacity': 0.85 },
    });
    map.addLayer({
      id: 'history-points',
      type: 'circle',
      source: 'history',
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': 4,
        'circle-color': '#f97316',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
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
    map.on('style.load', syncHistoryLayers);
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

  // Kayitli yerleri yukle
  function loadPlaces() {
    api('/api/places')
      .then((d) => setPlaces(d.places))
      .catch(() => {});
  }
  useEffect(() => {
    loadPlaces();
  }, []);

  // Geofence verisi degisince haritayi guncelle
  useEffect(() => {
    geofencesRef.current = geofences;
    syncGeofenceLayers();
  }, [geofences]);

  // Konum gecmisi degisince haritayi guncelle
  useEffect(() => {
    historyRef.current = history?.points || [];
    syncHistoryLayers();
  }, [history]);

  // Yeni gecmis acilinca oynatmayi sifirla
  useEffect(() => {
    setPlayIndex(0);
    setPlaying(false);
  }, [history]);

  // Oynatma isaretcisi — secili noktada
  useEffect(() => {
    const map = mapRef.current;
    const points = history?.points || [];
    if (!map || points.length === 0) {
      if (playbackMarkerRef.current) {
        playbackMarkerRef.current.remove();
        playbackMarkerRef.current = null;
      }
      return;
    }
    const p = points[Math.min(playIndex, points.length - 1)];
    if (!playbackMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'playback-dot';
      playbackMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
    } else {
      playbackMarkerRef.current.setLngLat([p.lng, p.lat]);
    }
  }, [history, playIndex]);

  // Oynatma — noktalar arasinda ilerle
  useEffect(() => {
    if (!playing) return undefined;
    const points = history?.points || [];
    if (points.length < 2) return undefined;
    const timer = setInterval(() => {
      setPlayIndex((i) => Math.min(i + 1, points.length - 1));
    }, 600);
    return () => clearInterval(timer);
  }, [playing, history]);

  // İz sonuna gelince oynatmayi durdur
  useEffect(() => {
    const points = history?.points || [];
    if (playing && points.length > 0 && playIndex >= points.length - 1) {
      setPlaying(false);
    }
  }, [playIndex, playing, history]);

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

  // Sureli paylasimda kalan sureyi periyodik tazele
  useEffect(() => {
    if (!user.sharingUntil) return undefined;
    const t = setInterval(() => setShareTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [user.sharingUntil]);

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
    socket.on('sos', (payload) => setSosAlert(payload));
    return () => socket.close();
  }, []);

  // Konum izleme
  useEffect(() => {
    const stop = watchPosition(
      async (pos) => {
        setGeoError('');
        setLocationSettingsNeeded(false);
        setMyPos(pos);
        const bat = await getBattery();
        // Konum HTTP ile gonderilir — arka planda da calisir
        api('/api/location', {
          method: 'POST',
          body: { ...pos, battery: bat?.level, charging: bat?.charging },
        })
          .then(() => {
            setMyMeta({
              updatedAt: new Date().toISOString(),
              battery: bat?.level ?? null,
              charging: bat?.charging ?? null,
            });
          })
          .catch(() => {});
      },
      (err) => {
        if (err?.code === 'NOT_AUTHORIZED') {
          setGeoError(
            'Arka planda konum paylaşımı için konum izni "Her zaman izin ver" ' +
              'olmalı. Ayarlardan seçin.',
          );
          setLocationSettingsNeeded(true);
        } else if (err?.code === 1) {
          setGeoError('Konum izni reddedildi. Haritada görünmek için izin verin.');
          setLocationSettingsNeeded(true);
        } else {
          setGeoError('Konum alınamadı: ' + (err?.message || 'bilinmeyen hata'));
        }
      },
    );
    return stop;
  }, []);

  // Kendi konum isaretcisi
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !myPos) return;
    let meta = '';
    if (myMeta) {
      const b = batteryLabel(myMeta.battery, myMeta.charging);
      meta = `${b ? `${b} · ` : ''}${timeAgo(myMeta.updatedAt)}`;
    }
    const popupHtml = `<b>Sen</b>${meta ? `<br>${meta}` : ''}`;
    if (!ownMarkerRef.current) {
      ownMarkerRef.current = new maplibregl.Marker({
        element: avatarElement(user.displayName, user.avatarColor, user.avatarPath),
      })
        .setLngLat([myPos.lng, myPos.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(popupHtml))
        .addTo(map);
      map.flyTo({ center: [myPos.lng, myPos.lat], zoom: 15 });
    } else {
      ownMarkerRef.current.setLngLat([myPos.lng, myPos.lat]);
      setAvatar(
        ownMarkerRef.current.getElement(),
        user.displayName,
        user.avatarColor,
        user.avatarPath,
      );
      ownMarkerRef.current.getPopup().setHTML(popupHtml);
    }
  }, [myPos, myMeta, user.displayName, user.avatarColor, user.avatarPath]);

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
      const meta = batteryLabel(p.battery, p.charging);
      const html = `<b>${escapeHtml(p.displayName)}</b><br>${
        meta ? `${meta} · ` : ''
      }${timeAgo(p.updatedAt)}`;
      if (markers[p.userId]) {
        markers[p.userId].setLngLat([p.lng, p.lat]);
        setAvatar(
          markers[p.userId].getElement(),
          p.displayName,
          p.avatarColor,
          p.avatarPath,
        );
        markers[p.userId].getPopup().setHTML(html);
      } else {
        markers[p.userId] = new maplibregl.Marker({
          element: avatarElement(p.displayName, p.avatarColor, p.avatarPath),
        })
          .setLngLat([p.lng, p.lat])
          .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(html))
          .addTo(map);
      }
    }
  }, [peers]);

  // Kayitli yer isaretcileri
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = placeMarkersRef.current;
    for (const id of Object.keys(markers)) {
      if (!places.find((p) => p.id === id)) {
        markers[id].remove();
        delete markers[id];
      }
    }
    for (const p of places) {
      const html = `<b>${escapeHtml(p.name)}</b>`;
      if (markers[p.id]) {
        markers[p.id].setLngLat([p.lng, p.lat]);
        markers[p.id].getElement().style.background = p.color;
        markers[p.id].getPopup().setHTML(html);
      } else {
        const el = document.createElement('div');
        el.className = 'map-place';
        el.style.background = p.color;
        markers[p.id] = new maplibregl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(html))
          .addTo(map);
      }
    }
  }, [places]);

  // Yer yerlestirme modu — haritada tiklama
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placingPlace) return undefined;
    function onClick(e) {
      setPendingPlace({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      setPlName('');
      setPlColor(PLACE_COLORS[0]);
      setPlError('');
      setPlacingPlace(false);
    }
    map.on('click', onClick);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', onClick);
      if (mapRef.current) map.getCanvas().style.cursor = '';
    };
  }, [placingPlace]);

  function recenter() {
    if (mapRef.current && myPos) {
      mapRef.current.flyTo({ center: [myPos.lng, myPos.lat], zoom: 15 });
    }
  }

  function startPlacingPlace() {
    setPlacesPanelOpen(false);
    setPlacingPlace(true);
  }

  function focusPlace(p) {
    setPlacesPanelOpen(false);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [p.lng, p.lat], zoom: 16 });
    const marker = placeMarkersRef.current[p.id];
    if (marker && !marker.getPopup().isOpen()) marker.togglePopup();
  }

  async function createPlace(e) {
    e.preventDefault();
    setPlError('');
    try {
      const d = await api('/api/places', {
        method: 'POST',
        body: {
          name: plName,
          lat: pendingPlace.lat,
          lng: pendingPlace.lng,
          color: plColor,
        },
      });
      setPlaces((prev) => [d.place, ...prev]);
      setPendingPlace(null);
    } catch (err) {
      setPlError(err.message);
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

  // Bir kisinin (ya da kendinin) son 30 gunluk konum gecmisini haritada goster
  async function showHistory(target) {
    setPanelOpen(false);
    setGeoError('');
    try {
      const d = await api(`/api/location/history/${target.userId}`);
      setHistory({ userId: target.userId, name: target.displayName, points: d.points });
      const map = mapRef.current;
      if (map && d.points.length > 0) {
        const bounds = new maplibregl.LngLatBounds(
          [d.points[0].lng, d.points[0].lat],
          [d.points[0].lng, d.points[0].lat],
        );
        for (const p of d.points) bounds.extend([p.lng, p.lat]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
      }
    } catch (err) {
      setGeoError(err.message);
    }
  }

  async function setSharing(enabled, durationMinutes) {
    try {
      const d = await api('/api/location/sharing', {
        method: 'PATCH',
        body: { enabled, durationMinutes: durationMinutes ?? undefined },
      });
      setUser(d.user);
      setShareMenuOpen(false);
    } catch (err) {
      setGeoError(err.message);
      setShareMenuOpen(false);
    }
  }

  function shareLabel() {
    if (!user.sharingEnabled) return 'Paylaşım kapalı';
    if (user.sharingUntil) {
      const ms = new Date(user.sharingUntil).getTime() - Date.now();
      if (ms > 0) {
        const mins = Math.round(ms / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `Paylaşım: ${h > 0 ? `${h}s ` : ''}${m}dk`;
      }
    }
    return 'Paylaşım açık';
  }

  async function sendSos() {
    setSosBusy(true);
    try {
      const d = await api('/api/sos', { method: 'POST' });
      setSosConfirm(false);
      setNotice(`Acil durum çağrısı ${d.notified} kişiye gönderildi.`);
    } catch (err) {
      setSosConfirm(false);
      setGeoError(err.message);
    } finally {
      setSosBusy(false);
    }
  }

  function focusSos() {
    const map = mapRef.current;
    if (map && sosAlert?.lat != null && sosAlert?.lng != null) {
      map.flyTo({ center: [sosAlert.lng, sosAlert.lat], zoom: 16 });
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
          onClick={() =>
            user.sharingEnabled ? setSharing(false) : setShareMenuOpen(true)
          }
        >
          {user.sharingEnabled ? <MapPin size={16} /> : <MapPinOff size={16} />}
          {shareLabel()}
        </button>
        <button
          type="button"
          className="peer-count"
          aria-label="Haritadaki kişiler"
          onClick={() => {
            setGeofencePanelOpen(false);
            setPlacesPanelOpen(false);
            setPanelOpen((v) => !v);
          }}
        >
          <Users size={16} />
          {peerList.length}
        </button>
        <button
          type="button"
          className="peer-count"
          aria-label="Alanlar"
          onClick={() => {
            setPanelOpen(false);
            setPlacesPanelOpen(false);
            setGeofencePanelOpen((v) => !v);
          }}
        >
          <Flag size={16} />
          {geofences.length}
        </button>
        <button
          type="button"
          className="peer-count"
          aria-label="Kayıtlı yerler"
          onClick={() => {
            setPanelOpen(false);
            setGeofencePanelOpen(false);
            setPlacesPanelOpen((v) => !v);
          }}
        >
          <Bookmark size={16} />
          {places.length}
        </button>
        <button
          type="button"
          className="sos-btn"
          onClick={() => setSosConfirm(true)}
          aria-label="Acil durum çağrısı"
        >
          <Siren size={16} />
          SOS
        </button>
      </div>

      {geoError && (
        <div className="geo-banner">
          {geoError}
          {locationSettingsNeeded && (
            <>
              {' '}
              <button type="button" className="link-btn" onClick={openLocationSettings}>
                Ayarları aç
              </button>
            </>
          )}
        </div>
      )}
      {notice && (
        <div className="geo-banner">
          {notice}{' '}
          <button type="button" className="link-btn" onClick={() => setNotice('')}>
            Kapat
          </button>
        </div>
      )}
      {sosAlert && (
        <div className="sos-banner">
          <Siren size={16} />
          <span>
            {sosAlert.displayName} acil durum bildirdi
            {sosAlert.message ? `: ${sosAlert.message}` : '.'}
          </span>
          {sosAlert.lat != null && (
            <button type="button" className="link-btn" onClick={focusSos}>
              Haritada gör
            </button>
          )}
          <button type="button" className="link-btn" onClick={() => setSosAlert(null)}>
            Kapat
          </button>
        </div>
      )}
      {history && (
        <div className="geo-banner">
          {history.name} · son 30 günlük konum geçmişi
          {history.points.length > 0
            ? ` (${history.points.length} nokta)`
            : ' — kayıt yok'}{' '}
          <button type="button" className="link-btn" onClick={() => setHistory(null)}>
            Kapat
          </button>
        </div>
      )}
      {placingMode && (
        <div className="geo-banner">
          Alanın merkezi için haritada bir noktaya dokunun…{' '}
          <button type="button" className="link-btn" onClick={() => setPlacingMode(false)}>
            İptal
          </button>
        </div>
      )}
      {placingPlace && (
        <div className="geo-banner">
          Yeni yer için haritada bir noktaya dokunun…{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => setPlacingPlace(false)}
          >
            İptal
          </button>
        </div>
      )}

      <div ref={containerRef} className="map-canvas" />

      <button
        type="button"
        className="map-fab"
        onClick={recenter}
        title="Konumuma git"
        aria-label="Konumuma git"
        style={history && history.points.length > 1 ? { bottom: 84 } : undefined}
      >
        <LocateFixed size={22} />
      </button>

      {history && history.points.length > 1 && (
        <div className="playback-bar">
          <button
            type="button"
            className="play-btn"
            aria-label={playing ? 'Duraklat' : 'Oynat'}
            onClick={() => {
              if (!playing && playIndex >= history.points.length - 1) {
                setPlayIndex(0);
              }
              setPlaying((p) => !p);
            }}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <input
            type="range"
            min="0"
            max={history.points.length - 1}
            value={Math.min(playIndex, history.points.length - 1)}
            onChange={(e) => {
              setPlaying(false);
              setPlayIndex(Number(e.target.value));
            }}
          />
          <span className="playback-time">
            {new Date(
              history.points[
                Math.min(playIndex, history.points.length - 1)
              ].recordedAt,
            ).toLocaleString('tr-TR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}

      {panelOpen && (
        <div className="peer-panel">
          <div className="peer-panel-head">
            <strong>Haritadaki kişiler</strong>
            <button type="button" className="link-btn" onClick={() => setPanelOpen(false)}>
              Kapat
            </button>
          </div>
          <button
            type="button"
            className="small secondary"
            style={{ marginBottom: 10 }}
            onClick={() =>
              showHistory({ userId: user.id, displayName: 'Senin' })
            }
          >
            Konum geçmişim
          </button>
          <PeerList peers={peerList} onSelect={focusPeer} onHistory={showHistory} />
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

      {placesPanelOpen && (
        <PlacesPanel
          places={places}
          onClose={() => setPlacesPanelOpen(false)}
          onStartPlacing={startPlacingPlace}
          onChanged={loadPlaces}
          onFocus={focusPlace}
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

      {shareMenuOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Konum paylaşımını aç</h3>
            <p className="muted">Ne kadar süreyle paylaşmak istersin?</p>
            <div className="share-options">
              <button type="button" onClick={() => setSharing(true, 60)}>
                1 saat
              </button>
              <button type="button" onClick={() => setSharing(true, 8 * 60)}>
                8 saat
              </button>
              <button type="button" onClick={() => setSharing(true, null)}>
                Süresiz
              </button>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => setShareMenuOpen(false)}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {pendingPlace && (
        <div className="modal-overlay">
          <form className="modal-card" onSubmit={createPlace}>
            <h3>Yeni yer</h3>
            <div className="field">
              <label>Yer adı</label>
              <input
                value={plName}
                onChange={(e) => setPlName(e.target.value)}
                placeholder="Örn. Ev, İş, Spor salonu"
                required
              />
            </div>
            <div className="field">
              <label>Renk</label>
              <div className="color-choices">
                {PLACE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Renk ${c}`}
                    className={`color-choice ${plColor === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setPlColor(c)}
                  />
                ))}
              </div>
            </div>
            {plError && <div className="error">{plError}</div>}
            <div className="row">
              <button
                type="button"
                className="secondary"
                onClick={() => setPendingPlace(null)}
              >
                Vazgeç
              </button>
              <button type="submit">Kaydet</button>
            </div>
          </form>
        </div>
      )}

      {sosConfirm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Acil durum çağrısı</h3>
            <p className="muted">
              Tüm arkadaşlarına ve aile üyelerine acil durum bildirimi ve son
              konumun gönderilecek. Onaylıyor musun?
            </p>
            <div className="row">
              <button
                type="button"
                className="secondary"
                disabled={sosBusy}
                onClick={() => setSosConfirm(false)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="danger"
                disabled={sosBusy}
                onClick={sendSos}
              >
                {sosBusy ? 'Gönderiliyor…' : 'Acil durum gönder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
