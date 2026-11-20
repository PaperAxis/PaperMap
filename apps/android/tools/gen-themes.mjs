// Copyright (c) 2026 PaperAxis. All rights reserved.
// Generates app/src/main/assets/themes.json from the web theme catalog so the
// Android app offers exactly the themes (ids, labels, measured colours) the
// web app does. Run from apps/android: node tools/gen-themes.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  ALL_THEMES,
  CATEGORY_LABELS,
  normalizeTheme,
  themeHex,
} from '../../../web/src/lib/appearance/themes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'app', 'src', 'main', 'assets');
const out = path.join(outDir, 'themes.json');

const KEYS = [
  'bg', 'surface', 'surface2', 'border', 'muted', 'fg', 'brand', 'brandFg',
  'danger', 'dangerFg', 'warn', 'ok', 'inputBorder', 'brandHover',
];

const themes = ALL_THEMES.map((t) => ({
  id: t.id,
  label: t.label,
  category: t.category,
  scheme: t.scheme,
  colors: Object.fromEntries(KEYS.map((k) => [k, themeHex(t.vars[k])])),
}));

// Old PaperMap ids (category-accent) still stored on some accounts.
const aliases = {};
const oldCats = ['light', 'dark', 'light-gradient', 'dark-gradient', 'light-access', 'dark-access'];
const oldAccents = ['emerald', 'teal', 'blue', 'indigo', 'violet', 'fuchsia', 'pink', 'rose', 'orange', 'amber'];
for (const c of oldCats) {
  for (const a of oldAccents) {
    const id = `${c}-${a}`;
    const n = normalizeTheme(id);
    if (n && n !== id) aliases[id] = n;
  }
}
aliases.light = normalizeTheme('light');
aliases.dark = normalizeTheme('dark');

const categories = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label }));

mkdirSync(outDir, { recursive: true });
writeFileSync(out, JSON.stringify({ categories, themes, aliases }) + '\n');
console.log(`${themes.length} themes -> ${out}`);
