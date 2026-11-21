import { DEFAULT_MAP_STYLE, MAP_STYLES, TERRAIN_SOURCE } from './mapStyle.js';

// 3B harita gorunumu: egik kamera (pitch), gercek arazi yuksekligi (terrain) ve
// 3B binalar. Tercih cihaz basina saklanir; varsayilan 3B'dir.

const PREF_KEY = 'papermap.map3d';
const STYLE_PREF_KEY = 'papermap.mapStyle';

// 3B'ye geciste kameranin egimi (derece). 0 = tepeden.
export const PITCH_3D = 50;
// Kullanicinin elle egebilecegi en yuksek aci (MapLibre siniri 85).
export const MAX_PITCH = 75;
// Arazi yukseklik carpani: Turkiye'nin daglik yapisi hafif vurgulanir.
const TERRAIN_EXAGGERATION = 1.3;

export function load3DPref() {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function save3DPref(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* gizli sekme vb. — tercih yalniz bu oturumda gecerli */
  }
}

// Secilen harita stili (Otomatik / Acik / Koyu / Arazi / Uydu), cihaz basina.
export function loadMapStylePref() {
  try {
    const v = localStorage.getItem(STYLE_PREF_KEY);
    return MAP_STYLES.some((s) => s.id === v) ? v : DEFAULT_MAP_STYLE;
  } catch {
    return DEFAULT_MAP_STYLE;
  }
}

export function saveMapStylePref(id) {
  try {
    localStorage.setItem(STYLE_PREF_KEY, id);
  } catch {
    /* tercih yalniz bu oturumda gecerli */
  }
}

// Arazi yuksekligini acar/kapatir. setStyle stilin terrain ayarini sildigi
// icin her 'style.load' sonrasinda yeniden cagrilmalidir.
export function applyTerrain(map, on) {
  if (!map || !map.getSource(TERRAIN_SOURCE)) return;
  try {
    map.setTerrain(on ? { source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION } : null);
  } catch {
    /* WebGL kisitli cihaz: 3B arazi olmadan devam */
  }
}

// Gorunumu 2B/3B arasinda yumusak gecisle degistirir.
export function set3D(map, on) {
  applyTerrain(map, on);
  if (on) {
    map.easeTo({ pitch: Math.max(map.getPitch(), PITCH_3D), duration: 700 });
  } else {
    map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
  }
}

// Navigasyon kontrolunun altinda duran "3D / 2D" dugmesi.
export class Map3DControl {
  constructor({ enabled, onToggle }) {
    this._enabled = enabled;
    this._onToggle = onToggle;
  }

  onAdd() {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'map-3d-toggle';
    btn.addEventListener('click', () => {
      this.setEnabled(!this._enabled);
      this._onToggle(this._enabled);
    });
    container.appendChild(btn);
    this._container = container;
    this._btn = btn;
    this._render();
    return container;
  }

  onRemove() {
    this._container?.remove();
    this._container = null;
    this._btn = null;
  }

  setEnabled(on) {
    this._enabled = on;
    this._render();
  }

  _render() {
    if (!this._btn) return;
    this._btn.textContent = this._enabled ? '3D' : '2D';
    this._btn.title = this._enabled ? '2B görünüme geç' : '3B görünüme geç';
    this._btn.setAttribute('aria-label', this._btn.title);
    this._btn.setAttribute('aria-pressed', String(this._enabled));
  }
}
