import { fontStack } from './fonts.js';
import { resolveTheme } from './themes.js';
import { ICON_STYLE_IDS } from './iconStyles.js';

const THEME_KEY = 'papermap_theme';
const FONT_KEY = 'papermap_font';
const ICON_KEY = 'papermap_icons';

// Tema, font ve ikon stilini <html> uzerine uygular, secimi onbellege alir
export function applyAppearance(themeId, fontId, iconStyle) {
  const theme = resolveTheme(themeId);
  const icons = ICON_STYLE_IDS.includes(iconStyle) ? iconStyle : 'normal';
  const root = document.documentElement;

  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  root.style.setProperty('--font-family', fontStack(fontId));
  root.setAttribute('data-theme', theme.base);
  root.setAttribute('data-icons', icons);

  try {
    localStorage.setItem(THEME_KEY, themeId || '');
    localStorage.setItem(FONT_KEY, fontId || '');
    localStorage.setItem(ICON_KEY, icons);
  } catch {
    /* localStorage erisilemezse onbellek atlanir */
  }
}

// Acilista (kullanici verisi gelmeden) onbellekten uygular — flash'i onler
export function applyCachedAppearance() {
  applyAppearance(
    localStorage.getItem(THEME_KEY) || '',
    localStorage.getItem(FONT_KEY) || '',
    localStorage.getItem(ICON_KEY) || 'normal',
  );
}
