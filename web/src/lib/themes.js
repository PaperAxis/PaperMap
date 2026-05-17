// 10 aksan rengi (acik ton + koyu ton)
const ACCENTS = [
  { key: 'emerald', name: 'Zümrüt', light: '#10b981', dark: '#047857' },
  { key: 'teal', name: 'Deniz', light: '#14b8a6', dark: '#0f766e' },
  { key: 'blue', name: 'Mavi', light: '#3b82f6', dark: '#1d4ed8' },
  { key: 'indigo', name: 'Çivit', light: '#6366f1', dark: '#4338ca' },
  { key: 'violet', name: 'Mor', light: '#8b5cf6', dark: '#6d28d9' },
  { key: 'fuchsia', name: 'Fuşya', light: '#d946ef', dark: '#a21caf' },
  { key: 'pink', name: 'Pembe', light: '#ec4899', dark: '#be185d' },
  { key: 'rose', name: 'Gül', light: '#f43f5e', dark: '#be123c' },
  { key: 'orange', name: 'Turuncu', light: '#f97316', dark: '#c2410c' },
  { key: 'amber', name: 'Kehribar', light: '#f59e0b', dark: '#b45309' },
];

// --- Kategori bazli CSS degisken ureticileri ---
function light(a) {
  return {
    '--bg': '#eef1f5',
    '--card': '#ffffff',
    '--input-bg': '#ffffff',
    '--text': '#0f172a',
    '--muted': '#64748b',
    '--border': '#e2e8f0',
    '--accent': a.light,
    '--accent-dark': a.dark,
    '--shadow': 'rgba(15,23,42,0.08)',
  };
}

function dark(a) {
  return {
    '--bg': '#0f1420',
    '--card': '#1b2230',
    '--input-bg': '#10151f',
    '--text': '#e6e9ef',
    '--muted': '#94a3b8',
    '--border': '#2c3647',
    '--accent': a.light,
    '--accent-dark': a.dark,
    '--shadow': 'rgba(0,0,0,0.5)',
  };
}

function lightGradient(a) {
  return {
    ...light(a),
    '--bg': `linear-gradient(160deg,#ffffff 0%,color-mix(in srgb,${a.light} 24%,#ffffff) 100%)`,
  };
}

function darkGradient(a) {
  return {
    ...dark(a),
    '--bg': `linear-gradient(160deg,#0a0e16 0%,color-mix(in srgb,${a.light} 34%,#0a0e16) 100%)`,
  };
}

// Erisilebilirlik: yuksek kontrast (saf siyah/beyaz, belirgin kenarlar)
function lightAccess(a) {
  return {
    '--bg': '#ffffff',
    '--card': '#ffffff',
    '--input-bg': '#ffffff',
    '--text': '#000000',
    '--muted': '#1f2937',
    '--border': '#334155',
    '--accent': a.dark,
    '--accent-dark': a.dark,
    '--shadow': 'rgba(0,0,0,0.3)',
  };
}

function darkAccess(a) {
  return {
    '--bg': '#000000',
    '--card': '#0c0c0c',
    '--input-bg': '#000000',
    '--text': '#ffffff',
    '--muted': '#d4d4d4',
    '--border': '#a3a3a3',
    '--accent': a.light,
    '--accent-dark': a.light,
    '--shadow': 'rgba(0,0,0,0.8)',
  };
}

const CATEGORIES = [
  { key: 'light', name: 'Aydınlık', base: 'light', build: light },
  { key: 'dark', name: 'Karanlık', base: 'dark', build: dark },
  { key: 'light-gradient', name: 'Aydınlık Gradyan', base: 'light', build: lightGradient },
  { key: 'dark-gradient', name: 'Karanlık Gradyan', base: 'dark', build: darkGradient },
  { key: 'light-access', name: 'Aydınlık Erişilebilir', base: 'light', build: lightAccess },
  { key: 'dark-access', name: 'Karanlık Erişilebilir', base: 'dark', build: darkAccess },
];

export const THEMES = {};

// 6 kategori × 10 aksan = 60 tema
export const THEME_CATEGORIES = CATEGORIES.map((cat) => {
  const themes = ACCENTS.map((a) => {
    const vars = cat.build(a);
    const theme = {
      id: `${cat.key}-${a.key}`,
      name: `${cat.name} · ${a.name}`,
      categoryKey: cat.key,
      base: cat.base,
      accent: a.light,
      swatchBg: vars['--bg'],
      vars,
    };
    THEMES[theme.id] = theme;
    return theme;
  });
  return { key: cat.key, name: cat.name, themes };
});

export const DEFAULT_THEME_ID = 'light-emerald';

// Eski degerler (light/dark/system) icin geriye donuk takma adlar
THEMES.light = THEMES['light-emerald'];
THEMES.dark = THEMES['dark-emerald'];
THEMES.system = THEMES['light-emerald'];

export function resolveTheme(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME_ID];
}
