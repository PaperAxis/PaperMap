// Exports the web map styles (web/src/lib/mapStyle.js) as static MapLibre style
// JSON for the native apps, so web and native draw the same map.
//   node apps/scripts/export-map-styles.mjs [apiBase]
// Writes apps/shared/map-style-<variant>.json for every STYLE_VARIANTS entry
// (light, dark, terrain, night, satellite).
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const apiBase = (process.argv[2] || 'https://maps.paperaxis.com').replace(/\/$/, '');
const root = new URL('../../', import.meta.url);
const src = readFileSync(new URL('web/src/lib/mapStyle.js', root), 'utf8').replace(
  /^import \{ API_BASE \} from '\.\/api\.js';$/m,
  `const API_BASE = ${JSON.stringify(apiBase)};`,
);
if (!src.includes(`const API_BASE = ${JSON.stringify(apiBase)}`)) {
  throw new Error('mapStyle.js API_BASE import line not found');
}
const dir = mkdtempSync(join(tmpdir(), 'mapstyle-'));
try {
  const file = join(dir, 'mapStyle.mjs');
  writeFileSync(file, src);
  const { buildMapStyle, STYLE_VARIANTS } = await import(pathToFileURL(file).href);
  for (const theme of STYLE_VARIANTS) {
    const out = new URL(`apps/shared/map-style-${theme}.json`, root);
    writeFileSync(out, JSON.stringify(buildMapStyle(theme)) + '\n');
    console.log('written', out.pathname);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
