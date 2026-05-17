const THEME_KEY = 'papermap_theme';
const FONT_KEY = 'papermap_font';

function resolveTheme(theme) {
  if (theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'dark' ? 'dark' : 'light';
}

// Tema ve fontu <html> uzerine uygular, secimi onbellege alir
export function applyAppearance(theme = 'light', fontPref = 'default') {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolveTheme(theme));
  root.setAttribute('data-font', fontPref);
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(FONT_KEY, fontPref);
  } catch {
    /* localStorage erisilemezse onbellek atlanir */
  }
}

// Acilista (kullanici verisi gelmeden) onbellekten uygular — temadaki flash'i onler
export function applyCachedAppearance() {
  applyAppearance(
    localStorage.getItem(THEME_KEY) || 'light',
    localStorage.getItem(FONT_KEY) || 'default',
  );
}

// "system" temasi secildiyse isletim sistemi temasi degisimini dinler
export function watchSystemTheme(theme, onChange) {
  if (theme !== 'system' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
