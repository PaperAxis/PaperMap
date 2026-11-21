import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { configureMapSources } from './mapStyle.js';

// Harita verisinin nereden okunacagi derleme aninda belirlenir:
//   VITE_TILES_PMTILES  ör. https://tiles.paperaxis.com/planet.pmtiles
//   VITE_GLYPHS_URL     (istege bagli) fontlar; bos ise PMTiles adresinin /fonts'u
// Ikisi de bossa VDS'teki tileserver (/tiles) kullanilir.
// MapLibre GL JS pmtiles:// adresini kendisi okuyamaz; protokolu pmtiles paketi
// saglar (dosyadan yalniz gereken kutucugu HTTP Range ile ister).
const pmtiles = import.meta.env.VITE_TILES_PMTILES || '';
const glyphs = import.meta.env.VITE_GLYPHS_URL || '';

if (pmtiles) {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
}
configureMapSources({ pmtiles, glyphs });
