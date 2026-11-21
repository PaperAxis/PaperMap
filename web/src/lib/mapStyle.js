import { API_BASE } from './api.js';

// Self-hosted tile sunucusu (web nginx /tiles/ -> tileserver-gl)
const TILES = `${API_BASE}/tiles`;

// Yukseklik (DEM) kutucuklari: web nginx /terrain/ -> AWS Terrarium (Mapzen) acik
// veri seti. nginx istekleri sunucudan yapar ve diskte onbellege alir; tarayici
// dis bir servise hic baglanmaz (kullanicinin baktigi bolge disari sizmaz).
const TERRAIN = `${API_BASE}/terrain`;

// Uydu goruntusu kutucuklari: web nginx /satellite/ -> Esri World Imagery.
// DEM gibi sunucu uzerinden gecer ve onbellege alinir (bkz. web/nginx.conf).
const SATELLITE = `${API_BASE}/satellite`;
// Turkiye sehirlerinde goruntu z19'a kadar var; otesi buyutulerek gosterilir.
const SATELLITE_MAXZOOM = 19;

// build-turkey-tiles.sh icindeki TILE_MAXZOOM ile ayni olmali.
// z16 tilelar client tarafinda z17+ icin buyutulerek (overzoom) gosterilir.
const SOURCE_MAXZOOM = 16;

// Terrarium veri setinin Turkiye icin anlamli en yuksek zoom'u (~5 m/piksel).
const DEM_MAXZOOM = 15;

// Turkiye ve cevresi — DEM ve vektor kaynaklari bu alanin disini istemez.
const TURKEY_BOUNDS = [25.0, 35.0, 45.5, 42.6];

// Kullanicinin yakinlasabilecegi en yuksek zoom (web, Android, iOS ayni).
// z16 verisi z22'ye kadar buyutulur; stil cizgi/yazi boyutlarini z20'ye kadar buyutur.
export const MAP_MAX_ZOOM = 22;

// 3D arazi icin web'in kullandigi raster-dem kaynaginin adi (map.setTerrain).
export const TERRAIN_SOURCE = 'terrain-dem';

// Kullanicinin secebilecegi harita stilleri. "auto" uygulama temasini izler.
export const MAP_STYLES = [
  { id: 'auto', label: 'Otomatik', hint: 'Temaya uyar' },
  { id: 'light', label: 'Açık', hint: 'Sade, aydınlık' },
  { id: 'dark', label: 'Koyu', hint: 'Gece için' },
  { id: 'terrain', label: 'Arazi', hint: 'Dağlar, orman' },
  { id: 'night', label: 'Gece', hint: 'Gece navigasyonu: göz yormayan, yollar öne çıkar' },
  { id: 'satellite', label: 'Uydu', hint: 'Uydu görüntüsü' },
];
export const DEFAULT_MAP_STYLE = 'auto';

// Cizilebilen stil varyantlari ("auto" bunlardan birine cozulur). Native
// uygulamalara her biri apps/shared/map-style-<varyant>.json olarak aktarilir.
export const STYLE_VARIANTS = ['light', 'dark', 'terrain', 'night', 'satellite'];

// Secilen stil + uygulama temasi -> cizilecek stil varyanti.
export function resolveMapStyle(styleId, appTheme) {
  if (STYLE_VARIANTS.includes(styleId)) return styleId;
  return appTheme === 'dark' ? 'dark' : 'light';
}

// Acik/koyu tema renk paletleri — harita gorunumu tema ile birlikte degisir.
// Zengin OpenMapTiles semasi: arazi, POI, havalimani, sinirlar vb.
const PALETTES = {
  light: {
    background: '#eef0f2',
    water: '#a9c9e8',
    waterInt: '#c2d8ec',
    waterLine: '#93b8de',
    wood: '#cfe0c8',
    grass: '#dde8d4',
    farmland: '#e9ead1',
    sand: '#f2ecd4',
    rock: '#e2e0dc',
    wetland: '#d3e2d8',
    ice: '#e9f0f4',
    park: '#d6e8ce',
    landuse: '#e7e7ea',
    industrial: '#e8e6ea',
    commercial: '#efe8e2',
    hospital: '#f0dede',
    school: '#eeeadb',
    cemetery: '#dbe4d6',
    military: '#ecdfdf',
    quarry: '#e3e0dc',
    zoo: '#dfe9d2',
    parking: '#e4e4e8',
    pitch: '#cfe6cf',
    aeroway: '#e2e0e6',
    aerowayLine: '#cfcdd6',
    pier: '#f4f4f6',
    // Binalar: z13-14 duz, z14+ 3B. Yukseklik arttikca ton hafif koyulasir.
    building: '#dddee2',
    buildingLine: '#cccdd3',
    building3dLow: '#e3e3e8',
    building3dMid: '#d6d8e0',
    building3dHigh: '#c3c8d6',
    // Arazi golgelendirme (hillshade)
    hillShadow: '#3d4456',
    hillHighlight: '#ffffff',
    hillAccent: '#5b6274',
    // Yollar
    motorway: '#ffd39a',
    motorwayCasing: '#e8b26b',
    trunk: '#ffe2b0',
    trunkCasing: '#e7c48c',
    roadMajor: '#ffffff',
    roadCasing: '#d6d8df',
    roadMinor: '#ffffff',
    roadMinorCasing: '#dcdee4',
    roadService: '#f6f6f8',
    bridgeCasing: '#b9bcc6',
    tunnel: '#f3f3f6',
    tunnelCasing: '#cfd1d8',
    oneway: '#9ea3ae',
    path: '#c6b9a6',
    track: '#cdbfa8',
    rail: '#b9bbc3',
    railHatch: '#ffffff',
    transit: '#7c6fd6',
    ferry: '#6f9fd3',
    aerialway: '#7b7f8a',
    boundary: '#9aa0aa',
    boundaryDistrict: '#c2b4c6',
    text: '#4a4f57',
    roadText: '#5a5f68',
    placeText: '#20242a',
    waterText: '#3f73a6',
    parkText: '#4f7f4f',
    poiText: '#6a6f78',
    textHalo: '#ffffff',
    peak: '#7a6a52',
    poiFood: '#d98a3d',
    poiShop: '#c264a8',
    poiTransit: '#4f80d6',
    poiHealth: '#e0625f',
    poiPark: '#5aa864',
    poiEdu: '#c9a13c',
    poiCulture: '#8c6bd1',
    poiWorship: '#7a8794',
    poiLodging: '#3fa0a8',
    poiMoney: '#4b9b7a',
    poiCar: '#6b7385',
    poiGeneric: '#8a90a0',
    // Gokyuzu / sis (yalniz web; 3D gorunumde ufuk cizgisi)
    sky: '#9cc4ec',
    horizon: '#e6eef7',
    fog: '#eef0f2',
  },
  dark: {
    background: '#10131c',
    water: '#0f1d2f',
    waterInt: '#14263c',
    waterLine: '#1a2d45',
    wood: '#14211b',
    grass: '#16241c',
    farmland: '#1a2119',
    sand: '#26261d',
    rock: '#1d1f26',
    wetland: '#132420',
    ice: '#1a2430',
    park: '#152219',
    landuse: '#181b25',
    industrial: '#1a1a24',
    commercial: '#211c1f',
    hospital: '#2a1a1e',
    school: '#25231a',
    cemetery: '#16211a',
    military: '#261b1d',
    quarry: '#1f1f24',
    zoo: '#17231a',
    parking: '#1c1e28',
    pitch: '#16281c',
    aeroway: '#1d1f2a',
    aerowayLine: '#33364a',
    pier: '#1c1f2a',
    building: '#1f2330',
    buildingLine: '#2a2f3e',
    building3dLow: '#222736',
    building3dMid: '#2a3042',
    building3dHigh: '#353d54',
    hillShadow: '#000000',
    hillHighlight: '#3a4256',
    hillAccent: '#05070c',
    motorway: '#6b5233',
    motorwayCasing: '#2a2218',
    trunk: '#5a4a35',
    trunkCasing: '#241f19',
    roadMajor: '#3b4150',
    roadCasing: '#1a1e28',
    roadMinor: '#2f3442',
    roadMinorCasing: '#191c25',
    roadService: '#262a36',
    bridgeCasing: '#0b0d13',
    tunnel: '#1f2330',
    tunnelCasing: '#161922',
    oneway: '#5d6475',
    path: '#4a4436',
    track: '#4a4234',
    rail: '#3a3f4d',
    railHatch: '#1a1e28',
    transit: '#7a6ed0',
    ferry: '#3e6a9a',
    aerialway: '#6b7285',
    boundary: '#3b4150',
    boundaryDistrict: '#3a3346',
    text: '#aab2c0',
    roadText: '#9aa2b2',
    placeText: '#dfe4ec',
    waterText: '#6f9cc9',
    parkText: '#6f9f74',
    poiText: '#98a0b0',
    textHalo: '#0b0e15',
    peak: '#9a8f78',
    poiFood: '#d98a3d',
    poiShop: '#c264a8',
    poiTransit: '#6f9be0',
    poiHealth: '#e0625f',
    poiPark: '#5aa864',
    poiEdu: '#cfa63f',
    poiCulture: '#9d82e0',
    poiWorship: '#8794a3',
    poiLodging: '#4fb2ba',
    poiMoney: '#5aae8b',
    poiCar: '#7c8598',
    poiGeneric: '#7f889c',
    sky: '#0b1424',
    horizon: '#1b2638',
    fog: '#10131c',
  },
};

// Arazi (topografik) stili: kagit tonlu zemin, doygun dogal renkler, belirgin
// dag golgeleri ve sicak tonlu kabartma.
PALETTES.terrain = {
  ...PALETTES.light,
  background: '#f3efe4',
  landuse: '#ebe6da',
  water: '#94c0e6',
  waterInt: '#b6d3ec',
  waterLine: '#7eaedb',
  wood: '#b3d19f',
  grass: '#d0e4bb',
  farmland: '#ebe5c2',
  sand: '#efdfb4',
  rock: '#d9d0c2',
  wetland: '#c3dccb',
  park: '#c4dfb2',
  hillShadow: '#4a3d2e',
  hillHighlight: '#fffbef',
  hillAccent: '#6b5843',
  peak: '#6b4f2a',
  parkText: '#3e6e35',
  fog: '#f3efe4',
  horizon: '#eef2f0',
};

// Gece navigasyonu: cok koyu, dusuk parlaklikli zemin; yollar kehribar / gri
// tonlarla belirgin, etiketler yumusak. Karanlikta gozu kamastirmaz.
PALETTES.night = {
  ...PALETTES.dark,
  background: '#07090e',
  landuse: '#0b0e15',
  industrial: '#0c0e15',
  commercial: '#0e0d12',
  hospital: '#140c0f',
  school: '#100f0b',
  parking: '#0d0f16',
  wood: '#0a120d',
  grass: '#0b130e',
  farmland: '#0c110c',
  park: '#0b140e',
  pitch: '#0b150e',
  sand: '#13130e',
  rock: '#0f1014',
  water: '#08121f',
  waterInt: '#0b1726',
  waterLine: '#0f1d30',
  building: '#11141d',
  buildingLine: '#171b27',
  building3dLow: '#131722',
  building3dMid: '#181d2b',
  building3dHigh: '#202739',
  motorway: '#e8a33d',
  motorwayCasing: '#3a2508',
  trunk: '#c98b38',
  trunkCasing: '#2e1f0b',
  roadMajor: '#6b7488',
  roadCasing: '#07090e',
  roadMinor: '#3d4456',
  roadMinorCasing: '#07090e',
  roadService: '#2a303e',
  bridgeCasing: '#000000',
  tunnel: '#161a24',
  tunnelCasing: '#0c0f16',
  oneway: '#8a93a6',
  rail: '#2a2f3c',
  railHatch: '#07090e',
  boundary: '#2f3546',
  boundaryDistrict: '#2a2536',
  text: '#8f98aa',
  roadText: '#c3cad8',
  placeText: '#d2d8e3',
  waterText: '#4f7aa6',
  parkText: '#4f7f57',
  poiText: '#7b8496',
  textHalo: '#05070b',
  hillShadow: '#000000',
  hillHighlight: '#1c2230',
  hillAccent: '#000000',
  sky: '#05080f',
  horizon: '#0f1624',
  fog: '#07090e',
};

// Gece stilinde surucuyu oyalayan ayrintilar cizilmez.
const NIGHT_DROP = new Set(['housenumber', 'poi-label-all', 'path', 'track', 'aerialway', 'landuse-parking']);

// Uydu (hibrit) stili: goruntu ustunde beyaz etiketler, koyu hale, yari saydam
// yollar. Zemin dolgulari cizilmez; renkleri goruntu verir.
PALETTES.satellite = {
  ...PALETTES.dark,
  background: '#1f2a22',
  motorway: '#ffd27a',
  trunk: '#ffe2a6',
  roadMajor: '#ffffff',
  roadMinor: '#f2f2f2',
  roadService: '#e6e6e6',
  rail: '#e0e0e0',
  railHatch: '#5a5a5a',
  transit: '#b9a8ff',
  ferry: '#bfe0ff',
  boundary: '#f5f5f5',
  boundaryDistrict: '#e6d9f2',
  oneway: '#ffffff',
  text: '#ffffff',
  roadText: '#ffffff',
  placeText: '#ffffff',
  waterText: '#cfe8ff',
  parkText: '#dff5d6',
  poiText: '#ffffff',
  textHalo: 'rgba(0, 0, 0, 0.78)',
  peak: '#ffe9c4',
  sky: '#8fb8e0',
  horizon: '#d6e3ef',
  fog: '#c9d6e2',
};

// Uydu stilinde cizilen katmanlar (geri kalani goruntunun ustunu kapatirdi).
const SATELLITE_KEEP = new Set([
  'background', 'road-ground', 'road-bridge', 'rail', 'transit', 'ferry', 'aerialway',
  'boundary', 'boundary-district', 'poi', 'road-oneway',
]);

const FONT = ['Noto Sans Regular'];
const OMT = { source: 'openmaptiles' };

const label = (p) => ({
  'text-color': p.text,
  'text-halo-color': p.textHalo,
  'text-halo-width': 1.3,
});

const fill = (id, sourceLayer, filter, paint, extra = {}) => ({
  id,
  type: 'fill',
  ...OMT,
  'source-layer': sourceLayer,
  ...(filter ? { filter } : {}),
  ...extra,
  paint,
});

// ---------------------------------------------------------------------------
// Yollar
// ---------------------------------------------------------------------------

const ROAD_CLASSES = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'busway', 'raceway',
];

// Ust ustte binen yollarda buyuk yol ustte cizilsin (line-sort-key).
const ROAD_RANK = [
  'match', ['get', 'class'],
  'motorway', 9, 'trunk', 8, 'primary', 7, 'secondary', 6, 'tertiary', 5,
  'minor', 3, 'busway', 3, 'service', 2, 'raceway', 2,
  1,
];

// Sinif bazli yol genisligi (px). Rampalar bir kademe incedir.
const ROAD_WIDTH_STOPS = {
  //         z5    z8   z10   z12   z14   z16   z18   z20
  motorway: [0.8, 1.6, 2.6, 4.0, 6.5, 11, 22, 48],
  trunk: [0.6, 1.3, 2.2, 3.6, 6.0, 10, 20, 44],
  primary: [0.4, 1.0, 1.8, 3.2, 5.5, 9, 18, 40],
  secondary: [0, 0.6, 1.3, 2.6, 4.6, 8, 16, 36],
  tertiary: [0, 0, 1.0, 2.0, 4.0, 7, 14, 32],
  minor: [0, 0, 0, 1.0, 2.6, 5, 11, 26],
  service: [0, 0, 0, 0.5, 1.4, 3, 7, 16],
};
const ROAD_ZOOMS = [5, 8, 10, 12, 14, 16, 18, 20];

function roadWidth(extra = 0, extraHigh = extra) {
  const stops = [];
  ROAD_ZOOMS.forEach((z, i) => {
    const pick = (cls) => ROAD_WIDTH_STOPS[cls][i];
    const add = z >= 16 ? extraHigh : extra;
    const base = [
      'match', ['get', 'class'],
      'motorway', pick('motorway'),
      'trunk', pick('trunk'),
      'primary', pick('primary'),
      'secondary', pick('secondary'),
      'tertiary', pick('tertiary'),
      ['minor', 'busway', 'raceway'], pick('minor'),
      pick('service'),
    ];
    const ramp = ['case', ['==', ['get', 'ramp'], 1], ['*', base, 0.65], base];
    stops.push(z, add ? ['case', ['>', base, 0], ['+', ramp, add], 0] : ramp);
  });
  return ['interpolate', ['exponential', 1.4], ['zoom'], ...stops];
}

const roadColor = (p) => [
  'match', ['get', 'class'],
  'motorway', p.motorway,
  'trunk', p.trunk,
  ['primary', 'secondary'], p.roadMajor,
  ['tertiary', 'minor', 'busway', 'raceway'], p.roadMinor,
  p.roadService,
];

const roadCasingColor = (p) => [
  'match', ['get', 'class'],
  'motorway', p.motorwayCasing,
  'trunk', p.trunkCasing,
  ['primary', 'secondary'], p.roadCasing,
  p.roadMinorCasing,
];

const roadFilter = (brunnel) => {
  const f = ['all', ['in', ['get', 'class'], ['literal', ROAD_CLASSES]]];
  if (brunnel === 'bridge') f.push(['==', ['get', 'brunnel'], 'bridge']);
  else if (brunnel === 'tunnel') f.push(['==', ['get', 'brunnel'], 'tunnel']);
  else f.push(['!', ['in', ['coalesce', ['get', 'brunnel'], ''], ['literal', ['bridge', 'tunnel']]]]);
  return f;
};

// Tunel (soluk, kesikli kenar) → zemin → kopru (koyu kenar, ustte) sirasi.
function roadLayers(p) {
  const layout = {
    'line-cap': 'round',
    'line-join': 'round',
    'line-sort-key': ROAD_RANK,
  };
  const set = (brunnel) => {
    const isTunnel = brunnel === 'tunnel';
    const isBridge = brunnel === 'bridge';
    return [
      {
        id: `road-${brunnel}-casing`,
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: roadFilter(brunnel),
        layout: isTunnel ? { ...layout, 'line-cap': 'butt' } : layout,
        paint: {
          'line-color': isBridge ? p.bridgeCasing : isTunnel ? p.tunnelCasing : roadCasingColor(p),
          'line-width': roadWidth(isBridge ? 2 : 1, isBridge ? 4 : 2.4),
          ...(isTunnel ? { 'line-dasharray': [0.6, 0.4] } : {}),
        },
      },
      {
        id: `road-${brunnel}`,
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: roadFilter(brunnel),
        layout,
        paint: {
          'line-color': isTunnel ? p.tunnel : roadColor(p),
          'line-width': roadWidth(),
          ...(isTunnel ? { 'line-opacity': 0.75 } : {}),
        },
      },
    ];
  };
  return { tunnel: set('tunnel'), ground: set('ground'), bridge: set('bridge') };
}

// ---------------------------------------------------------------------------
// POI
// ---------------------------------------------------------------------------

// POI kategorisini renge esler (ikon yerine renkli nokta; sprite gerekmez)
const poiColor = (p) => [
  'match',
  ['get', 'class'],
  ['restaurant', 'fast_food', 'cafe', 'bar', 'food', 'pub', 'ice_cream', 'bakery', 'beer'], p.poiFood,
  ['shop', 'grocery', 'clothing_store', 'convenience', 'supermarket', 'mall', 'jewelry', 'shoe', 'furniture', 'hardware', 'books', 'gift', 'florist', 'alcohol_shop', 'butcher', 'hairdresser', 'laundry'], p.poiShop,
  ['bus', 'railway', 'aerodrome', 'airport', 'ferry_terminal', 'aerialway', 'harbor', 'entrance'], p.poiTransit,
  ['hospital', 'pharmacy', 'doctors', 'clinic', 'dentist', 'veterinary'], p.poiHealth,
  ['park', 'garden', 'pitch', 'stadium', 'playground', 'campsite', 'golf', 'swimming', 'sports'], p.poiPark,
  ['school', 'college', 'university', 'library', 'kindergarten'], p.poiEdu,
  ['museum', 'art_gallery', 'theatre', 'cinema', 'attraction', 'monument', 'castle', 'music', 'zoo', 'information'], p.poiCulture,
  ['place_of_worship'], p.poiWorship,
  ['lodging'], p.poiLodging,
  ['bank', 'atm', 'post', 'town_hall', 'police', 'fire_station'], p.poiMoney,
  ['fuel', 'parking', 'car', 'bicycle', 'bicycle_rental', 'charging_station'], p.poiCar,
  p.poiGeneric,
];

// POI nokta + ad katmanlari. Kisiye odaklaninca harita z16'ya gider; o andan
// itibaren cevredeki tum mekanlarin adi gosterilir. z15'te yalniz onemli
// (rank'i dusuk) mekanlarin adi yazar. Cakismada onemli mekan once yerlesir.
const POI_ALL_FROM = 16;
const poiLayers = (p) => {
  const ranked = (max) => ['<=', ['coalesce', ['get', 'rank'], 999], max];
  const dot = {
    id: 'poi',
    type: 'circle',
    ...OMT,
    'source-layer': 'poi',
    minzoom: 15,
    paint: {
      'circle-color': poiColor(p),
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 2.4, 18, 4.5, 20, 6.5],
      'circle-stroke-color': p.textHalo,
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 15, 1, 18, 1.6],
      // 3D gorunumde noktalar yere yatik (haritaya yapisik) durur
      'circle-pitch-alignment': 'map',
    },
  };
  const name = (id, minzoom, maxzoom, filter) => ({
    id,
    type: 'symbol',
    ...OMT,
    'source-layer': 'poi',
    minzoom,
    ...(maxzoom ? { maxzoom } : {}),
    ...(filter ? { filter } : {}),
    layout: {
      'text-field': ['get', 'name'],
      'text-font': FONT,
      'text-size': ['interpolate', ['linear'], ['zoom'], 15, 10, 18, 11.5, 20, 13],
      'text-anchor': 'top',
      'text-offset': [0, 0.6],
      'text-max-width': 8,
      'text-padding': 1,
      'text-optional': true,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 999],
    },
    paint: {
      // Ad rengi kategoriye gore hafifce tonlanir; nokta ile eslesir
      'text-color': ['interpolate', ['linear'], 0.55, 0, p.poiText, 1, poiColor(p)],
      'text-halo-color': p.textHalo,
      'text-halo-width': 1.2,
    },
  });
  return [
    dot,
    name('poi-label', 15, POI_ALL_FROM, ranked(16)),
    name('poi-label-all', POI_ALL_FROM),
  ];
};

// ---------------------------------------------------------------------------
// Stil
// ---------------------------------------------------------------------------

/**
 * MapLibre stili uretir.
 *
 * @param {'light'|'dark'|'terrain'|'satellite'} theme  Stil varyanti
 *   (bkz. resolveMapStyle). Native uygulamalar 'light' / 'dark' kullanir.
 * @param {object}  [opts]
 * @param {boolean} [opts.web=false]  Yalniz MapLibre GL JS'in destekledigi
 *   eklentiler: gokyuzu/sis ve 3D arazi icin ayri raster-dem kaynagi. Native
 *   uygulamalara aktarilan JSON'da (export-map-styles.mjs) kapali kalir.
 */
export function buildMapStyle(theme, opts = {}) {
  const variant = PALETTES[theme] ? theme : 'light';
  const p = PALETTES[variant];
  const isDark = variant === 'dark' || variant === 'night';
  const roads = roadLayers(p);
  // Kabartma golgesi vurgusu [z5, z11, z14, z16]
  const hill =
    variant === 'terrain' ? [0.75, 0.7, 0.5, 0.25]
      : variant === 'night' ? [0.35, 0.3, 0.15, 0.05]
        : isDark ? [0.55, 0.5, 0.3, 0.12]
          : [0.5, 0.45, 0.3, 0.12];

  const demSource = {
    type: 'raster-dem',
    tiles: [`${TERRAIN}/{z}/{x}/{y}.png`],
    encoding: 'terrarium',
    tileSize: 256,
    minzoom: 0,
    maxzoom: DEM_MAXZOOM,
    bounds: TURKEY_BOUNDS,
    attribution: 'Elevation: Mapzen Terrain Tiles (AWS Open Data)',
  };

  const style = {
    version: 8,
    glyphs: `${TILES}/fonts/{fontstack}/{range}.pbf`,
    // 3B binalarin yan yuzlerini golgelendiren isik
    light: {
      anchor: 'viewport',
      color: '#ffffff',
      intensity: isDark ? 0.25 : 0.4,
      position: [1.3, 200, 35],
    },
    sources: {
      openmaptiles: {
        type: 'vector',
        // tileserver-gl, planetiler mbtiles'ina otomatik config'de "v3" adini verir
        tiles: [`${TILES}/data/v3/{z}/{x}/{y}.pbf`],
        minzoom: 0,
        maxzoom: SOURCE_MAXZOOM,
        attribution: '© OpenMapTiles © OpenStreetMap katkıcıları',
      },
      ...(variant === 'satellite'
        ? {
            satellite: {
              type: 'raster',
              tiles: [`${SATELLITE}/{z}/{x}/{y}.jpg`],
              tileSize: 256,
              minzoom: 0,
              maxzoom: SATELLITE_MAXZOOM,
              attribution: 'Görüntü: Esri, Maxar, Earthstar Geographics',
            },
          }
        : {}),
      // Arazi golgesi (hillshade). 3D arazi web'de ayri kaynak kullanir.
      hillshade: demSource,
      ...(opts.web ? { [TERRAIN_SOURCE]: { ...demSource } } : {}),
    },
    ...(opts.web
      ? {
          sky: {
            'sky-color': p.sky,
            'horizon-color': p.horizon,
            'fog-color': p.fog,
            'sky-horizon-blend': 0.6,
            'horizon-fog-blend': 0.7,
            'fog-ground-blend': ['interpolate', ['linear'], ['zoom'], 8, 0.85, 14, 0.95, 18, 1],
            'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 10, 0.3, 14, 0],
          },
        }
      : {}),
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.background } },

      // ---- Arazi ortusu (landcover) ----
      fill('landcover-wood', 'landcover', ['==', 'class', 'wood'], {
        'fill-color': p.wood,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 12, 0.7],
      }),
      fill('landcover-grass', 'landcover', ['in', 'class', 'grass', 'park'], {
        'fill-color': p.grass,
        'fill-opacity': 0.6,
      }),
      fill('landcover-farmland', 'landcover', ['==', 'class', 'farmland'], {
        'fill-color': p.farmland,
        'fill-opacity': 0.55,
      }),
      fill('landcover-sand', 'landcover', ['==', 'class', 'sand'], { 'fill-color': p.sand }),
      fill('landcover-rock', 'landcover', ['==', 'class', 'rock'], {
        'fill-color': p.rock,
        'fill-opacity': 0.8,
      }),
      fill('landcover-wetland', 'landcover', ['==', 'class', 'wetland'], {
        'fill-color': p.wetland,
        'fill-opacity': 0.6,
      }),
      fill('landcover-ice', 'landcover', ['==', 'class', 'ice'], { 'fill-color': p.ice }),

      // ---- Arazi kullanimi (landuse) ----
      fill('landuse-residential', 'landuse', ['in', 'class', 'residential', 'suburb', 'neighbourhood', 'quarter'], {
        'fill-color': p.landuse,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 12, 1],
      }),
      fill('landuse-industrial', 'landuse', ['in', 'class', 'industrial', 'railway', 'garages', 'brownfield'], {
        'fill-color': p.industrial,
      }),
      fill('landuse-commercial', 'landuse', ['in', 'class', 'commercial', 'retail'], {
        'fill-color': p.commercial,
      }),
      fill('landuse-hospital', 'landuse', ['==', 'class', 'hospital'], { 'fill-color': p.hospital }),
      fill('landuse-school', 'landuse', ['in', 'class', 'school', 'university', 'college', 'kindergarten', 'library'], {
        'fill-color': p.school,
      }),
      fill('landuse-cemetery', 'landuse', ['==', 'class', 'cemetery'], { 'fill-color': p.cemetery }),
      fill('landuse-military', 'landuse', ['==', 'class', 'military'], { 'fill-color': p.military }),
      fill('landuse-quarry', 'landuse', ['in', 'class', 'quarry', 'dam'], { 'fill-color': p.quarry }),
      fill('landuse-zoo', 'landuse', ['in', 'class', 'zoo', 'theme_park'], { 'fill-color': p.zoo }),
      fill('landuse-parking', 'landuse', ['==', 'class', 'parking'], { 'fill-color': p.parking }, { minzoom: 14 }),
      fill('landuse-pitch', 'landuse', ['in', 'class', 'stadium', 'pitch', 'playground', 'garden', 'track'], {
        'fill-color': p.pitch,
        'fill-opacity': 0.7,
      }),

      // ---- Park ----
      fill('park', 'park', null, { 'fill-color': p.park, 'fill-opacity': 0.5 }),

      // ---- Arazi kabartmasi (hillshade) ----
      // Daglar ve vadiler golgelenir; yakinlastikca yumusar ki sehir detayi bogulmasin.
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'hillshade',
        maxzoom: 17,
        paint: {
          'hillshade-shadow-color': p.hillShadow,
          'hillshade-highlight-color': p.hillHighlight,
          'hillshade-accent-color': p.hillAccent,
          'hillshade-illumination-anchor': 'map',
          'hillshade-exaggeration': [
            'interpolate', ['linear'], ['zoom'],
            5, hill[0],
            11, hill[1],
            14, hill[2],
            16, hill[3],
            17, 0,
          ],
        },
      },

      // ---- Su ----
      fill('water', 'water', null, {
        'fill-color': ['case', ['==', ['get', 'intermittent'], 1], p.waterInt, p.water],
      }),
      {
        id: 'water-shore',
        type: 'line',
        ...OMT,
        'source-layer': 'water',
        minzoom: 11,
        paint: {
          'line-color': p.waterLine,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 16, 1.2, 20, 2],
        },
      },
      {
        id: 'waterway',
        type: 'line',
        ...OMT,
        'source-layer': 'waterway',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.water,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            8, ['match', ['get', 'class'], 'river', 1, 0.3],
            13, ['match', ['get', 'class'], 'river', 3, ['stream', 'canal'], 1.2, 0.8],
            18, ['match', ['get', 'class'], 'river', 12, ['stream', 'canal'], 4, 2.5],
            20, ['match', ['get', 'class'], 'river', 24, ['stream', 'canal'], 8, 5],
          ],
        },
      },
      {
        id: 'waterway-intermittent',
        type: 'line',
        ...OMT,
        'source-layer': 'waterway',
        filter: ['==', 'intermittent', 1],
        minzoom: 12,
        paint: {
          'line-color': p.background,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 18, 2],
          'line-dasharray': [2, 3],
        },
      },

      // ---- Havalimani zemini ----
      fill('aeroway-fill', 'aeroway', ['in', 'class', 'aerodrome', 'apron', 'heliport'], {
        'fill-color': p.aeroway,
      }, { minzoom: 11 }),

      // ---- Iskele ----
      fill('pier', 'transportation', ['all', ['==', '$type', 'Polygon'], ['==', 'class', 'pier']], {
        'fill-color': p.pier,
      }, { minzoom: 13 }),
      {
        id: 'pier-line',
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: ['all', ['==', '$type', 'LineString'], ['==', 'class', 'pier']],
        minzoom: 13,
        paint: {
          'line-color': p.pier,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 6, 20, 12],
        },
      },

      // ---- Binalar (uzak zoom: duz) ----
      fill('building', 'building', null, {
        'fill-color': p.building,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.5, 1],
      }, { minzoom: 13, maxzoom: 14.5 }),
      {
        id: 'building-outline',
        type: 'line',
        ...OMT,
        'source-layer': 'building',
        minzoom: 13.5,
        maxzoom: 14.5,
        paint: { 'line-color': p.buildingLine, 'line-width': 0.4 },
      },

      // ---- Havalimani pistleri ----
      {
        id: 'aeroway-line',
        type: 'line',
        ...OMT,
        'source-layer': 'aeroway',
        filter: ['in', 'class', 'runway', 'taxiway'],
        minzoom: 11,
        paint: {
          'line-color': p.aerowayLine,
          'line-width': [
            'interpolate', ['exponential', 1.5], ['zoom'],
            11, ['match', ['get', 'class'], 'runway', 2, 0.6],
            16, ['match', ['get', 'class'], 'runway', 30, 8],
            20, ['match', ['get', 'class'], 'runway', 120, 32],
          ],
        },
      },

      // ---- Tuneller (zeminin altinda) ----
      ...roads.tunnel,

      // ---- Patika / tali yollar ----
      {
        id: 'path',
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: ['all', ['in', 'class', 'path', 'footway', 'pedestrian', 'steps', 'bridleway', 'cycleway'], ['!=', 'brunnel', 'tunnel']],
        minzoom: 14,
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': p.path,
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 18, 2.4, 20, 4],
          'line-dasharray': [2, 2],
        },
      },
      {
        id: 'track',
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: ['==', 'class', 'track'],
        minzoom: 13,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.track,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 2, 20, 3.5],
          'line-dasharray': [4, 2],
        },
      },

      // ---- Yollar (zemin) ----
      ...roads.ground,

      // ---- Demiryolu: gri cizgi + beyaz traversler (z13+) ----
      {
        id: 'rail',
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: ['all', ['==', 'class', 'rail'], ['!=', 'brunnel', 'tunnel']],
        minzoom: 8,
        paint: {
          'line-color': p.rail,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 13, 1.6, 16, 3, 20, 6],
        },
      },
      {
        id: 'rail-hatch',
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: ['all', ['==', 'class', 'rail'], ['!=', 'brunnel', 'tunnel']],
        minzoom: 13,
        paint: {
          'line-color': p.railHatch,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 16, 1.8, 20, 3.5],
          'line-dasharray': [0.3, 3],
        },
      },
      // Metro, hafif rayli, tramvay (tunel olanlar da soluk gosterilir)
      {
        id: 'transit',
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: ['==', 'class', 'transit'],
        minzoom: 11,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.transit,
          'line-opacity': ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 0.85],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 1.8, 18, 4, 20, 7],
        },
      },
      {
        id: 'ferry',
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: ['==', 'class', 'ferry'],
        minzoom: 8,
        paint: {
          'line-color': p.ferry,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 1.4, 20, 3],
          'line-dasharray': [3, 2],
        },
      },
      {
        id: 'aerialway',
        type: 'line',
        ...OMT,
        'source-layer': 'transportation',
        filter: ['==', 'class', 'aerialway'],
        minzoom: 12,
        paint: {
          'line-color': p.aerialway,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 18, 2],
        },
      },

      // ---- Kopruler (zeminin ustunde) ----
      ...roads.bridge,

      // ---- Idari sinirlar ----
      {
        id: 'boundary-district',
        type: 'line',
        ...OMT,
        'source-layer': 'boundary',
        filter: ['all', ['==', 'admin_level', 6], ['!=', 'maritime', 1]],
        minzoom: 8,
        paint: {
          'line-color': p.boundaryDistrict,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 1.2],
          'line-dasharray': [2, 3],
        },
      },
      {
        id: 'boundary',
        type: 'line',
        ...OMT,
        'source-layer': 'boundary',
        filter: ['all', ['<=', 'admin_level', 4], ['!=', 'maritime', 1]],
        paint: {
          'line-color': p.boundary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 10, 2],
          'line-dasharray': [3, 2],
        },
      },

      // ---- 3B binalar ----
      // OSM'deki yukseklik / kat sayisi (render_height) kullanilir; bilinmiyorsa
      // planetiler tahmini bir deger yazar. Egik bakista (pitch) binalar yukselir,
      // tepeden bakista duz bina tabani gibi gorunur. Yakinlasirken yavasca buyur.
      {
        id: 'building-3d',
        type: 'fill-extrusion',
        ...OMT,
        'source-layer': 'building',
        minzoom: 14,
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 0],
            0, p.building3dLow,
            25, p.building3dMid,
            90, p.building3dHigh,
          ],
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            14, 0,
            15.5, ['coalesce', ['get', 'render_height'], 6],
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            14, 0,
            15.5, ['coalesce', ['get', 'render_min_height'], 0],
          ],
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 15, 0.92],
          'fill-extrusion-vertical-gradient': true,
        },
      },

      // ---- Etiketler ----
      {
        id: 'waterway-label',
        type: 'symbol',
        ...OMT,
        'source-layer': 'waterway',
        filter: ['has', 'name'],
        minzoom: 12,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 350,
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 18, 13],
          'text-letter-spacing': 0.08,
        },
        paint: {
          'text-color': p.waterText,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.1,
        },
      },
      // Tek yonlu yol oklari
      {
        id: 'road-oneway',
        type: 'symbol',
        ...OMT,
        'source-layer': 'transportation',
        filter: ['all', ['in', ['coalesce', ['get', 'oneway'], 0], ['literal', [1, -1]]], ['in', ['get', 'class'], ['literal', ROAD_CLASSES]]],
        minzoom: 16,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 90,
          'text-field': ['case', ['==', ['get', 'oneway'], -1], '‹', '›'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 16, 12, 20, 20],
          'text-keep-upright': false,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-rotation-alignment': 'map',
          'text-pitch-alignment': 'map',
        },
        paint: { 'text-color': p.oneway },
      },
      {
        id: 'road-label',
        type: 'symbol',
        ...OMT,
        'source-layer': 'transportation_name',
        minzoom: 13,
        filter: ['has', 'name'],
        layout: {
          'symbol-placement': 'line',
          // Buyuk yolun adi once yerlesir (kucuk anahtar = once)
          'symbol-sort-key': ['-', 10, ROAD_RANK],
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            13, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 11.5, 10.5],
            18, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 14, 13],
            20, 16,
          ],
          'text-pitch-alignment': 'viewport',
        },
        paint: { ...label(p), 'text-color': p.roadText },
      },
      // Otoyol / devlet yolu numaralari (O-4, D-100, E80 ...)
      {
        id: 'road-ref',
        type: 'symbol',
        ...OMT,
        'source-layer': 'transportation_name',
        filter: ['all', ['has', 'ref'], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]]],
        minzoom: 7,
        maxzoom: 15,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 400,
          'text-field': ['get', 'ref'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 14, 11],
          'text-rotation-alignment': 'viewport',
          'text-letter-spacing': 0.05,
        },
        paint: {
          'text-color': ['match', ['get', 'class'], 'motorway', p.motorwayCasing, p.roadText],
          'text-halo-color': p.textHalo,
          'text-halo-width': 2,
        },
      },
      {
        id: 'housenumber',
        type: 'symbol',
        ...OMT,
        'source-layer': 'housenumber',
        minzoom: 17,
        layout: {
          'text-field': ['get', 'housenumber'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 17, 9.5, 20, 13],
        },
        paint: {
          'text-color': p.poiText,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1,
        },
      },
      // POI: z15-16 yalniz onemli yerler, z16+ tum yerler (nokta ve ad).
      ...poiLayers(p),
      {
        id: 'park-label',
        type: 'symbol',
        ...OMT,
        'source-layer': 'park',
        filter: ['has', 'name'],
        minzoom: 10,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 16, 13],
          'text-max-width': 8,
          'text-optional': true,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 999],
        },
        paint: {
          'text-color': p.parkText,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.2,
        },
      },
      {
        id: 'water-label',
        type: 'symbol',
        ...OMT,
        'source-layer': 'water_name',
        layout: {
          'text-field': ['get', 'name'],
          // tileserver-gl-light yalniz Noto Sans Regular sunar; olmayan fontstack 400 doner
          'text-font': FONT,
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            4, ['match', ['get', 'class'], ['sea', 'ocean'], 12, 9],
            8, ['match', ['get', 'class'], ['sea', 'ocean'], 16, 11],
            14, 14,
          ],
          'text-letter-spacing': ['match', ['get', 'class'], ['sea', 'ocean'], 0.25, 0.05],
          'text-max-width': 7,
        },
        paint: {
          'text-color': p.waterText,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.1,
        },
      },
      {
        id: 'mountain-peak',
        type: 'symbol',
        ...OMT,
        'source-layer': 'mountain_peak',
        minzoom: 9,
        filter: ['in', 'class', 'peak', 'volcano'],
        layout: {
          'text-field': [
            'case',
            ['has', 'ele'],
            ['concat', ['coalesce', ['get', 'name'], ''], '\n', ['get', 'ele'], ' m'],
            ['coalesce', ['get', 'name'], ''],
          ],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 14, 12],
          'text-max-width': 8,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 999],
        },
        paint: {
          'text-color': p.peak,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.2,
        },
      },
      {
        id: 'place-suburb',
        type: 'symbol',
        ...OMT,
        'source-layer': 'place',
        filter: ['in', 'class', 'suburb', 'neighbourhood', 'quarter'],
        minzoom: 12,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10.5, 16, 14],
          'text-max-width': 8,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.06,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 999],
        },
        paint: {
          'text-color': p.text,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.4,
        },
      },
      {
        id: 'place-village',
        type: 'symbol',
        ...OMT,
        'source-layer': 'place',
        filter: ['in', 'class', 'village', 'hamlet', 'isolated_dwelling'],
        minzoom: 10,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 14],
          'text-max-width': 8,
        },
        paint: {
          'text-color': p.placeText,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.4,
        },
      },
      {
        id: 'place-city',
        type: 'symbol',
        ...OMT,
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            4, ['match', ['get', 'class'], 'city', ['case', ['<=', ['coalesce', ['get', 'rank'], 99], 3], 14, 12], 10],
            12, ['match', ['get', 'class'], 'city', ['case', ['<=', ['coalesce', ['get', 'rank'], 99], 3], 22, 20], 15],
          ],
          'text-max-width': 8,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 999],
        },
        paint: {
          'text-color': p.placeText,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.6,
        },
      },
      {
        id: 'aerodrome-label',
        type: 'symbol',
        ...OMT,
        'source-layer': 'aerodrome_label',
        minzoom: 10,
        layout: {
          'text-field': ['case', ['has', 'iata'], ['concat', ['get', 'name'], ' (', ['get', 'iata'], ')'], ['get', 'name']],
          'text-font': FONT,
          'text-size': 11,
          'text-max-width': 9,
          'text-offset': [0, 0.8],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': p.poiTransit,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.3,
        },
      },
      {
        id: 'place-state',
        type: 'symbol',
        ...OMT,
        'source-layer': 'place',
        filter: ['in', 'class', 'state', 'province'],
        minzoom: 4,
        maxzoom: 8,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 7, 14],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.08,
          'text-max-width': 8,
        },
        paint: {
          'text-color': p.text,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.4,
        },
      },
      {
        id: 'country-label',
        type: 'symbol',
        ...OMT,
        'source-layer': 'place',
        filter: ['==', 'class', 'country'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 18],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
          'text-max-width': 8,
        },
        paint: {
          'text-color': p.placeText,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.8,
        },
      },
    ],
  };
  if (variant === 'satellite') toSatellite(style);
  if (variant === 'night') toNight(style);
  return style;
}

// Gece navigasyonu: dikkat dagitan katmanlari atar, yol adlarini buyutur.
function toNight(style) {
  style.layers = style.layers.filter((l) => !NIGHT_DROP.has(l.id));
  const roadLabel = style.layers.find((l) => l.id === 'road-label');
  if (roadLabel) {
    roadLabel.layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 13, 12, 18, 15, 20, 18];
  }
}

// Standart stili uydu (hibrit) stiline donusturur: goruntu katmani zeminin
// hemen ustune girer, dolgular atilir, yollar yari saydam olur.
function toSatellite(style) {
  const keep = (l) => l.type === 'symbol' || SATELLITE_KEEP.has(l.id);
  const layers = style.layers.filter(keep).map((l) => {
    if (l.type !== 'line' || !l.id.startsWith('road-')) return l;
    return {
      ...l,
      paint: {
        ...l.paint,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.35, 12, 0.5, 16, 0.6, 19, 0.35],
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5, 0.6, 10, 1.2, 14, 2.4, 18, 6, 20, 10],
      },
    };
  });
  layers.splice(1, 0, {
    id: 'satellite',
    type: 'raster',
    source: 'satellite',
    paint: {
      'raster-fade-duration': 150,
      'raster-saturation': 0.05,
      'raster-contrast': 0.05,
    },
  });
  style.layers = layers;
  delete style.sources.hillshade;
  // Yer adlari goruntu ustunde okunsun diye biraz daha kalin hale
  for (const l of style.layers) {
    if (l.type === 'symbol' && l.paint && 'text-halo-width' in l.paint) {
      l.paint['text-halo-width'] = Math.max(l.paint['text-halo-width'], 1.6);
      l.paint['text-halo-blur'] = 0.4;
    }
    if (l.id === 'poi') l.paint['circle-stroke-color'] = '#ffffff';
  }
}
