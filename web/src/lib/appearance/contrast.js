// WCAG 2.x contrast helpers, ported from PaperApp (src/lib/appearance/contrast.ts).
const TEXT_MIN = 4.5;
const UI_MIN = 3;
function hexToRgb(hex) {
  let v = hex.trim().replace(/^#/, "");
  if (v.length === 3) v = v.replace(/./g, (c) => c + c);
  if (!/^[0-9a-fA-F]{6}$/.test(v)) throw new Error(`not a hex color: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
function hslToRgb([h, s, l]) {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n) => Math.round(255 * (ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)];
}
function rgbToHsl([r, g, b]) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
}
function parseHslVar(v) {
  const [h, s, l] = v.split(/\s+/).map((x) => parseFloat(x));
  return [h, s, l];
}
function formatHslVar([h, s, l]) {
  const r = (n) => Math.round(n * 10) / 10;
  return `${r((h % 360 + 360) % 360)} ${r(s)}% ${r(l)}%`;
}
function linearize(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance([r, g, b]) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}
function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function mix(fg, bg, alpha) {
  return [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha)));
}
export {
  TEXT_MIN,
  UI_MIN,
  contrastRatio,
  formatHslVar,
  hexToRgb,
  hslToRgb,
  luminance,
  mix,
  parseHslVar,
  rgbToHex,
  rgbToHsl
};
