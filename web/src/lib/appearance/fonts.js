/*
 * Copyright (c) 2026 PaperAxis. All rights reserved.
 * PaperMap font catalog. Ids and order match PaperApp
 * (src/lib/appearance/fonts.ts) so a stored choice means the same font in
 * every PaperAxis product. Brand fonts and the fonts PaperMap already
 * bundled are served from the app itself (src/fonts.js); the rest load
 * from Google Fonts only once someone picks them.
 */

const SANS_FALLBACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF_FALLBACK = "ui-serif, Georgia, 'Times New Roman', serif";
const MONO_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, monospace";

const INTER = `'Inter Variable', 'Inter', ${SANS_FALLBACK}`;
const MANROPE = `'Manrope Variable', 'Manrope', ${SANS_FALLBACK}`;
const JETBRAINS = `'JetBrains Mono Variable', 'JetBrains Mono', ${MONO_FALLBACK}`;

const FULL = [400, 500, 600, 700];
const RG_BD = [400, 700];

function fallbackFor(category) {
  if (category === 'serif') return SERIF_FALLBACK;
  if (category === 'mono') return MONO_FALLBACK;
  return SANS_FALLBACK;
}

// Loaded from Google Fonts on demand.
function g(id, label, category, family, weights) {
  return {
    id,
    label,
    category,
    google: { family, weights },
    stack: `'${family}', ${fallbackFor(category)}`,
  };
}

// Bundled with the app (works offline in the Android build).
function local(id, label, category, family, display) {
  return { id, label, category, stack: `'${family}', ${fallbackFor(category)}`, display };
}

export const FONTS = [
  local('lexend', 'Lexend (disleksi dostu)', 'okunabilirlik', 'Lexend'),
  local('atkinson', 'Atkinson Hyperlegible', 'okunabilirlik', 'Atkinson Hyperlegible'),
  { id: 'inter', label: 'Inter ve Manrope (varsayılan)', category: 'sans', stack: INTER, display: MANROPE },
  { id: 'sistem', label: 'Sistem', category: 'sans', stack: SANS_FALLBACK },
  local('roboto', 'Roboto', 'sans', 'Roboto'),
  g('open-sans', 'Open Sans', 'sans', 'Open Sans', FULL),
  g('lato', 'Lato', 'sans', 'Lato', RG_BD),
  g('montserrat', 'Montserrat', 'sans', 'Montserrat', FULL),
  local('poppins', 'Poppins', 'sans', 'Poppins'),
  local('nunito', 'Nunito', 'sans', 'Nunito'),
  g('work-sans', 'Work Sans', 'sans', 'Work Sans', FULL),
  g('rubik', 'Rubik', 'sans', 'Rubik', FULL),
  g('dm-sans', 'DM Sans', 'sans', 'DM Sans', FULL),
  { id: 'manrope', label: 'Manrope', category: 'sans', stack: MANROPE },
  g('mulish', 'Mulish', 'sans', 'Mulish', FULL),
  g('karla', 'Karla', 'sans', 'Karla', FULL),
  g('merriweather', 'Merriweather', 'serif', 'Merriweather', RG_BD),
  g('lora', 'Lora', 'serif', 'Lora', FULL),
  g('pt-serif', 'PT Serif', 'serif', 'PT Serif', RG_BD),
  g('roboto-slab', 'Roboto Slab', 'serif', 'Roboto Slab', FULL),
  g('bitter', 'Bitter', 'serif', 'Bitter', FULL),
  g('eb-garamond', 'EB Garamond', 'serif', 'EB Garamond', FULL),
  g('playfair', 'Playfair Display', 'serif', 'Playfair Display', FULL),
  { id: 'jetbrains-mono', label: 'JetBrains Mono', category: 'mono', stack: JETBRAINS },
  g('ibm-plex-mono', 'IBM Plex Mono', 'mono', 'IBM Plex Mono', FULL),
];

export const DEFAULT_FONT = 'inter';

export const FONT_CATEGORIES = [
  { key: 'okunabilirlik', label: 'Okunabilirlik' },
  { key: 'sans', label: 'Sans-serif' },
  { key: 'serif', label: 'Serif' },
  { key: 'mono', label: 'Monospace' },
];

const FONT_BY_ID = new Map(FONTS.map((f) => [f.id, f]));

// PaperMap's earlier ids: "default" was the system stack; the brand font replaces it.
const LEGACY_FONT_ALIASES = { '': DEFAULT_FONT, default: DEFAULT_FONT };

export function resolveFontId(value) {
  if (typeof value !== 'string') return DEFAULT_FONT;
  if (FONT_BY_ID.has(value)) return value;
  return LEGACY_FONT_ALIASES[value] ?? DEFAULT_FONT;
}

export function getFont(id) {
  return FONT_BY_ID.get(resolveFontId(id));
}

/** Google Fonts css2 URL for a font, or null when it ships with the app. */
export function googleFontsHref(font) {
  if (!font?.google) return null;
  const { family, weights } = font.google;
  return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weights.join(';')}&display=swap`;
}

/** The font as PaperMap's font variables (styles.css). */
export function fontStyle(id) {
  const f = getFont(id);
  return { '--font-family': f.stack, '--font-display': f.display ?? f.stack };
}
