import { API_BASE } from './api.js';

// Self-hosted tile sunucusu (web nginx /tiles/ -> tileserver-gl)
const TILES = `${API_BASE}/tiles`;

// Acik/koyu tema renk paletleri — harita gorunumu tema ile birlikte degisir
const PALETTES = {
  light: {
    background: '#eef0f2',
    water: '#a9c9e8',
    wood: '#cfe0c8',
    grass: '#dde8d4',
    landuse: '#e7e7ea',
    building: '#dddee2',
    roadMajor: '#ffffff',
    roadMinor: '#f3f3f5',
    rail: '#d3d4d9',
    boundary: '#9aa0aa',
    text: '#4a4f57',
    placeText: '#272b31',
    textHalo: '#ffffff',
  },
  dark: {
    background: '#10131c',
    water: '#0f1d2f',
    wood: '#14211b',
    grass: '#16241c',
    landuse: '#181b25',
    building: '#1f2330',
    roadMajor: '#3b4150',
    roadMinor: '#2a2e3a',
    rail: '#2a2e3a',
    boundary: '#3b4150',
    text: '#aab2c0',
    placeText: '#d8dde5',
    textHalo: '#0b0e15',
  },
};

const label = (p) => ({
  'text-color': p.text,
  'text-halo-color': p.textHalo,
  'text-halo-width': 1.3,
});

export function buildMapStyle(theme) {
  const p = PALETTES[theme === 'dark' ? 'dark' : 'light'];
  return {
    version: 8,
    glyphs: `${TILES}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      openmaptiles: {
        type: 'vector',
        // tileserver-gl, planetiler mbtiles'ina otomatik config'de "v3" adini verir
        tiles: [`${TILES}/data/v3/{z}/{x}/{y}.pbf`],
        minzoom: 0,
        maxzoom: 14,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.background } },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['in', 'class', 'residential', 'suburb', 'industrial'],
        paint: { 'fill-color': p.landuse },
      },
      {
        id: 'wood',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['==', 'class', 'wood'],
        paint: { 'fill-color': p.wood, 'fill-opacity': 0.65 },
      },
      {
        id: 'grass',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['in', 'class', 'grass', 'park'],
        paint: { 'fill-color': p.grass, 'fill-opacity': 0.65 },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': p.grass, 'fill-opacity': 0.5 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': p.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': p.water, 'line-width': 1 },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        paint: { 'fill-color': p.building },
      },
      {
        id: 'rail',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['==', 'class', 'rail'],
        minzoom: 10,
        paint: { 'line-color': p.rail, 'line-width': 1 },
      },
      {
        id: 'road-casing',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.background,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.2, 16, 11],
        },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'secondary', 'tertiary', 'minor', 'service'],
        minzoom: 11,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.roadMinor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 18, 6],
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.roadMajor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 16, 7],
        },
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['<=', 'admin_level', 4],
        paint: {
          'line-color': p.boundary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 10, 1.8],
          'line-dasharray': [3, 2],
        },
      },
      {
        id: 'road-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 13,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: label(p),
      },
      {
        id: 'water-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: label(p),
      },
      {
        id: 'place-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town', 'village'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            ['match', ['get', 'class'], 'city', 12, 'town', 10, 9],
            12,
            ['match', ['get', 'class'], 'city', 20, 'town', 15, 12],
          ],
        },
        paint: {
          'text-color': p.placeText,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.6,
        },
      },
    ],
  };
}
