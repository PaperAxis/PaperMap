import { fontStack } from './fonts.js';
import { resolveTheme } from './themes.js';

const THEME_KEY = 'papermap_theme';
const FONT_KEY = 'papermap_font';

// Tema (CSS degiskenleri) ve fontu <html> uzerine uygular, secimi onbellege alir
export function applyAppearance(themeId, fontId) {
  const theme = resolveTheme(themeId);
  const root = document.documentElement;

  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  root.style.setProperty('--font-family', fontStack(fontId));
  // Harita ve color-scheme icin acik/koyu taban
  root.setAttribute('data-theme', theme.base);

  try {
    localStorage.setItem(THEME_KEY, themeId || '');
    localStorage.setItem(FONT_KEY, fontId || '');
  } catch {
    /* localStorage erisilemezse onbellek atlanir */
  }
}

// Acilista (kullanici verisi gelmeden) onbellekten uygular — flash'i onler
export function applyCachedAppearance() {
  applyAppearance(
    localStorage.getItem(THEME_KEY) || '',
    localStorage.getItem(FONT_KEY) || '',
  );
}
