/*
 * Copyright (c) 2026 PaperAxis. All rights reserved.
 * Applies the stored theme, font and icon style to <html>.
 */
import { getTheme, resolveThemeId, themeStyle } from './themes.js';
import { fontStyle, getFont, googleFontsHref, resolveFontId } from './fonts.js';
import { ICON_STYLE_IDS } from '../iconStyles.js';

const THEME_KEY = 'papermap_theme';
const FONT_KEY = 'papermap_font';
const ICON_KEY = 'papermap_icons';

function loadGoogleFont(fontId) {
  const href = googleFontsHref(getFont(fontId));
  if (!href || document.head.querySelector(`link[href="${href}"]`)) return;
  let link = document.getElementById('pa-font-link');
  if (!link) {
    link = document.createElement('link');
    link.id = 'pa-font-link';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = href;
}

function setThemeColor(color) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', color);
}

export function applyAppearance(themeId, fontId, iconStyle) {
  const theme = getTheme(resolveThemeId(themeId));
  const font = resolveFontId(fontId);
  const icons = ICON_STYLE_IDS.includes(iconStyle) ? iconStyle : 'normal';
  const root = document.documentElement;

  for (const [key, value] of Object.entries({ ...themeStyle(theme.id), ...fontStyle(font) })) {
    root.style.setProperty(key, value);
  }
  root.style.colorScheme = theme.scheme;
  // MapView reads data-theme to pick the light or dark map style.
  root.setAttribute('data-theme', theme.scheme);
  root.setAttribute('data-icons', icons);
  setThemeColor(theme.metaColor);
  loadGoogleFont(font);

  try {
    localStorage.setItem(THEME_KEY, themeId || '');
    localStorage.setItem(FONT_KEY, fontId || '');
    localStorage.setItem(ICON_KEY, icons);
  } catch {
    /* storage unavailable: the cache is skipped */
  }
}

// On start-up, before the user record arrives: avoids a flash of the default theme.
export function applyCachedAppearance() {
  let cached = ['', '', 'normal'];
  try {
    cached = [
      localStorage.getItem(THEME_KEY) || '',
      localStorage.getItem(FONT_KEY) || '',
      localStorage.getItem(ICON_KEY) || 'normal',
    ];
  } catch {
    /* storage unavailable */
  }
  applyAppearance(...cached);
}
