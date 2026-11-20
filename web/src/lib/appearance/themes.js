/*
 * Copyright (c) 2026 PaperAxis. All rights reserved.
 * PaperMap theme catalog, ported from PaperApp (src/lib/appearance/themes.ts).
 * 152 themes: two PaperAxis brand themes and 25 hues x 6 categories. Every
 * generated palette is measured by harden(): text tones reach 4.5:1, form
 * borders and focus 3:1. Theme ids match PaperApp and PaperBudget.
 */
import {
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
} from "./contrast.js";
const HUES = [
  [0, "Kırmızı", "kirmizi"],
  [18, "Mercan", "mercan"],
  [32, "Turuncu", "turuncu"],
  [44, "Kehribar", "kehribar"],
  [52, "Altın", "altin"],
  [64, "Limon", "limon"],
  [80, "Fıstık", "fistik"],
  [100, "Çimen", "cimen"],
  [130, "Yeşil", "yesil"],
  [150, "Zümrüt", "zumrut"],
  [165, "Nane", "nane"],
  [178, "Turkuaz", "turkuaz"],
  [190, "Camgöbeği", "camgobegi"],
  [202, "Gökyüzü", "gokyuzu"],
  [214, "Okyanus", "okyanus"],
  [226, "Mavi", "mavi"],
  [240, "Kobalt", "kobalt"],
  [252, "Çivit", "civit"],
  [264, "Menekşe", "menekse"],
  [276, "Mor", "mor"],
  [290, "Erik", "erik"],
  [304, "Orkide", "orkide"],
  [320, "Fuşya", "fusya"],
  [334, "Gül", "gul"],
  [348, "Kiraz", "kiraz"]
];
const CATEGORY_META = {
  paperaxis: { prefix: "paperaxis", label: "PaperAxis" },
  light: { prefix: "light", label: "Aydınlık" },
  dark: { prefix: "dark", label: "Karanlık" },
  "light-grad": { prefix: "light-grad", label: "Aydınlık Gradyan" },
  "dark-grad": { prefix: "dark-grad", label: "Karanlık Gradyan" },
  // Koyu erişilebilir "a11y" önekini korur (eski tema id'leri bozulmasın).
  "a11y-light": { prefix: "a11y-light", label: "Erişilebilir Aydınlık" },
  "a11y-dark": { prefix: "a11y", label: "Erişilebilir Karanlık" }
};
function hsl(h, s, l) {
  const hh = Math.round((h % 360 + 360) % 360 * 100) / 100;
  return `${hh} ${Math.round(s * 10) / 10}% ${Math.round(l * 10) / 10}%`;
}
const rot = (h, d) => ((h + d) % 360 + 360) % 360;
function hslToHex(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n) => {
    const c = ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function hslStrToHex(s) {
  const [h, sat, lig] = s.split(" ");
  return hslToHex(parseFloat(h), parseFloat(sat), parseFloat(lig));
}
const LIGHT_STYLES = [
  ["Klasik", null, 34, 97, true, 0.8, 1, 70, 43],
  ["Pastel", null, 56, 94, false, 0.95, 0.86, 56, 55],
  ["Papirüs", 38, 44, 95, false, 0.9, 1.02, 54, 40],
  ["Mono", null, 7, 96, true, 0.7, 1.05, 80, 45],
  ["Canlı", null, 50, 95, true, 1.15, 1.05, 88, 44],
  ["Buz", 205, 26, 98, true, 0.7, 0.95, 58, 48],
  ["Krem", 44, 30, 96, false, 0.8, 0.98, 52, 42],
  ["Mineral", null, 22, 93, false, 0.85, 1.12, 46, 40],
  ["Sade", null, 12, 98, true, 0.55, 0.82, 64, 46],
  ["Sıcak Kum", 28, 40, 95, false, 0.95, 1, 60, 44],
  ["Toprak", 32, 30, 92, false, 0.9, 1.14, 44, 38],
  ["Tebeşir", null, 16, 96, false, 0.65, 0.84, 50, 48],
  ["Lavanta", 270, 30, 96, false, 0.85, 0.95, 52, 52],
  ["Çiğ", null, 44, 96, true, 1, 0.9, 62, 50],
  ["İnci", null, 10, 99, true, 0.5, 0.9, 66, 44],
  ["Limonata", 54, 48, 96, false, 1.05, 0.95, 72, 46],
  ["Vitray", null, 62, 92, false, 1.25, 1.05, 86, 46],
  ["Bulut", 215, 14, 97, true, 0.6, 0.9, 54, 52],
  ["Keten", 40, 18, 95, false, 0.75, 1, 48, 40],
  ["Bal", 42, 54, 94, false, 0.95, 1.05, 64, 42],
  ["Ferah", null, 38, 97, true, 0.8, 0.88, 58, 46],
  ["Mermer", null, 8, 97, true, 0.6, 1.1, 60, 42],
  ["Şeftali", 20, 46, 95, false, 0.95, 0.95, 60, 50],
  ["Gül Kurusu", 350, 28, 95, false, 0.85, 1.02, 52, 46],
  ["Kuvars", 304, 24, 97, false, 0.8, 0.92, 56, 50]
];
function buildLight(h, st) {
  const [, bh0, bgS, bgL, surfPure, chroma, con, bSat, bLit] = st;
  const bh = bh0 ?? h;
  return {
    bg: hsl(bh, bgS, bgL),
    surface: surfPure ? hsl(0, 0, 100) : hsl(bh, bgS * 0.5, Math.min(bgL + 2.5, 99.5)),
    surface2: hsl(bh, bgS * 0.92, Math.max(bgL - 5, 85)),
    border: hsl(bh, Math.min(bgS * 0.85 * chroma, 44), Math.max(bgL - 12 * con, 68)),
    muted: hsl(h, 18, 46 - 9 * con),
    fg: hsl(h, 28, 20 - 9 * con),
    brand: hsl(h, bSat, bLit),
    brandFg: bLit < 58 ? hsl(0, 0, 100) : hsl(h, 55, 12),
    danger: "2 72% 47%",
    warn: "33 84% 41%",
    ok: "146 54% 35%"
  };
}
const DARK_STYLES = [
  ["Gece", null, 22, 8, 0.9, 1, 64, 60],
  ["OLED", null, 0, 0, 0.8, 1, 84, 64],
  ["Alacakaranlık", null, 30, 14, 1, 1.05, 60, 66],
  ["Neon", null, 44, 6, 1.3, 1, 100, 64],
  ["Arduvaz", null, 9, 12, 0.8, 1, 56, 64],
  ["Orman Gecesi", null, 40, 7, 0.95, 1.05, 58, 58],
  ["Şarap", 350, 34, 9, 0.95, 1.05, 60, 58],
  ["Füme", null, 6, 14, 0.7, 1, 52, 62],
  ["Mürekkep", 224, 32, 9, 0.9, 1, 62, 62],
  ["Kömür", null, 4, 9, 0.8, 1.1, 70, 64],
  ["Gece Mavisi", 220, 42, 11, 1, 1, 66, 64],
  ["Bordo", 356, 32, 10, 0.95, 1.05, 58, 56],
  ["Antrasit", null, 10, 16, 0.75, 0.95, 54, 64],
  ["Espresso", 28, 34, 9, 0.95, 1.05, 56, 56],
  ["Derin Gece", null, 26, 9, 0.9, 1, 64, 60],
  ["Galaksi", 262, 36, 8, 1.05, 1, 74, 66],
  ["Zift", null, 14, 5, 0.85, 1.05, 66, 60],
  ["Pus", null, 16, 18, 0.7, 0.9, 52, 66],
  ["Volkan", 12, 42, 7, 1.15, 1.05, 88, 58],
  ["Derin Deniz", 200, 42, 9, 1, 1, 64, 60],
  ["Yosun", 158, 34, 8, 0.95, 1, 58, 58],
  ["Gölge", null, 12, 11, 0.8, 1, 58, 62],
  ["Yakut", 348, 40, 8, 1.05, 1.05, 82, 60],
  ["Lacivert", 232, 46, 10, 1, 1, 68, 64],
  ["Obsidyen", null, 20, 4, 0.9, 1.1, 72, 62]
];
function buildDark(h, st) {
  const [, bh0, bgS, bgL, chroma, con, bSat, bLit] = st;
  const bh = bh0 ?? h;
  const lift = bgL < 4 ? 6 : 4;
  return {
    bg: hsl(bh, bgS, bgL),
    surface: hsl(bh, bgS * 0.92, bgL + lift),
    surface2: hsl(bh, bgS * 0.85, bgL + lift + 5),
    border: hsl(bh, bgS * 0.7 * chroma, bgL + 18),
    muted: hsl(h, 14, 60 + 5 * con),
    fg: hsl(h, 18, 95),
    brand: hsl(h, bSat, bLit),
    brandFg: bLit > 52 ? hsl(h, 55, 9) : hsl(0, 0, 100),
    danger: "0 74% 62%",
    warn: "40 88% 60%",
    ok: "150 56% 52%"
  };
}
function lightGrad(h, i) {
  const A = [135, 158, 118, 182, 100, 146, 128, 168];
  const OFF = [34, 52, 150, 26, 90, 44, 18, 66];
  const a = A[i % 8];
  const off = OFF[i % 8];
  const s1 = hsl(rot(h, -14), 64, 93);
  const s2 = hsl(rot(h, off), 58, 84);
  const c1 = `hsl(${s1})`;
  const c2 = `hsl(${s2})`;
  if (i % 5 === 3) {
    const pos = [
      ["28%", "18%"],
      ["72%", "16%"],
      ["40%", "30%"]
    ][i % 3];
    return { css: `radial-gradient(circle at ${pos[0]} ${pos[1]}, ${c1}, ${c2})`, stops: [s1, s2] };
  }
  if (i % 3 === 1) {
    const sm = hsl(h, 56, 89);
    return { css: `linear-gradient(${a}deg, ${c1}, hsl(${sm}), ${c2})`, stops: [s1, sm, s2] };
  }
  return { css: `linear-gradient(${a}deg, ${c1}, ${c2})`, stops: [s1, s2] };
}
function darkGrad(h, i) {
  const A = [160, 140, 182, 125, 150, 168, 135, 200];
  const OFF = [44, 150, 28, 90, 60, 22, 120, 52];
  const a = A[i % 8];
  const off = OFF[i % 8];
  const s1 = hsl(rot(h, -16), 44, 9);
  const s2 = hsl(rot(h, off), 46, 15);
  const c1 = `hsl(${s1})`;
  const c2 = `hsl(${s2})`;
  if (i % 5 === 2) {
    const pos = [
      ["70%", "16%"],
      ["26%", "20%"],
      ["50%", "12%"]
    ][i % 3];
    return { css: `radial-gradient(circle at ${pos[0]} ${pos[1]}, ${c2}, ${c1})`, stops: [s2, s1] };
  }
  if (i % 3 === 2) {
    const sm = hsl(h, 42, 7);
    return { css: `linear-gradient(${a}deg, ${c1}, hsl(${sm}), ${c2})`, stops: [s1, sm, s2] };
  }
  return { css: `linear-gradient(${a}deg, ${c1}, ${c2})`, stops: [s1, s2] };
}
const A11Y_DARK = [
  {
    label: "Yüksek Kontrast",
    scheme: "dark",
    vars: (h) => ({
      bg: hsl(0, 0, 4),
      surface: hsl(0, 0, 9),
      surface2: hsl(0, 0, 14),
      border: hsl(0, 0, 72),
      muted: hsl(0, 0, 84),
      fg: hsl(0, 0, 100),
      brand: hsl(h, 100, 64),
      brandFg: hsl(0, 0, 0),
      danger: "0 100% 66%",
      warn: "45 100% 60%",
      ok: "135 85% 58%"
    })
  },
  {
    label: "Kömür Kontrast",
    scheme: "dark",
    vars: (h) => ({
      bg: hsl(h, 12, 9),
      surface: hsl(h, 11, 13),
      surface2: hsl(h, 10, 18),
      border: hsl(h, 10, 66),
      muted: hsl(h, 8, 80),
      fg: hsl(0, 0, 99),
      brand: hsl(h, 92, 66),
      brandFg: hsl(0, 0, 4),
      danger: "2 96% 68%",
      warn: "44 100% 62%",
      ok: "140 82% 58%"
    })
  },
  {
    label: "Sıcak Kontrast",
    scheme: "dark",
    vars: (h) => ({
      bg: hsl(28, 42, 7),
      surface: hsl(28, 36, 11),
      surface2: hsl(28, 30, 16),
      border: hsl(34, 32, 64),
      muted: hsl(38, 28, 82),
      fg: hsl(40, 44, 97),
      brand: hsl(h, 96, 66),
      brandFg: hsl(28, 40, 6),
      danger: "4 96% 68%",
      warn: "44 100% 62%",
      ok: "138 84% 58%"
    })
  },
  {
    label: "Gece Mavisi Kontrast",
    scheme: "dark",
    vars: (h) => ({
      bg: hsl(224, 48, 6),
      surface: hsl(224, 40, 10),
      surface2: hsl(224, 34, 15),
      border: hsl(224, 30, 66),
      muted: hsl(224, 22, 82),
      fg: hsl(0, 0, 100),
      brand: hsl(h, 96, 68),
      brandFg: hsl(224, 40, 5),
      danger: "2 100% 68%",
      warn: "45 100% 62%",
      ok: "138 86% 60%"
    })
  },
  {
    label: "Orman Kontrast",
    scheme: "dark",
    vars: (h) => ({
      bg: hsl(150, 44, 6),
      surface: hsl(150, 36, 10),
      surface2: hsl(150, 30, 15),
      border: hsl(150, 26, 64),
      muted: hsl(150, 20, 82),
      fg: hsl(0, 0, 100),
      brand: hsl(h, 94, 66),
      brandFg: hsl(150, 38, 5),
      danger: "2 100% 68%",
      warn: "45 100% 62%",
      ok: "130 90% 58%"
    })
  },
  {
    label: "Mor Kontrast",
    scheme: "dark",
    vars: (h) => ({
      bg: hsl(276, 42, 7),
      surface: hsl(276, 34, 11),
      surface2: hsl(276, 28, 16),
      border: hsl(276, 24, 66),
      muted: hsl(276, 18, 83),
      fg: hsl(0, 0, 100),
      brand: hsl(h, 96, 68),
      brandFg: hsl(276, 36, 6),
      danger: "2 100% 68%",
      warn: "45 100% 62%",
      ok: "138 86% 60%"
    })
  }
];
const A11Y_LIGHT = [
  {
    label: "Yüksek Kontrast",
    scheme: "light",
    vars: (h) => ({
      bg: hsl(0, 0, 100),
      surface: hsl(0, 0, 100),
      surface2: hsl(0, 0, 93),
      border: hsl(0, 0, 22),
      muted: hsl(0, 0, 26),
      fg: hsl(0, 0, 0),
      brand: hsl(h, 95, 30),
      brandFg: hsl(0, 0, 100),
      danger: "0 95% 36%",
      warn: "30 100% 28%",
      ok: "140 95% 24%"
    })
  },
  {
    label: "Sepya Kontrast",
    scheme: "light",
    vars: (h) => ({
      bg: hsl(40, 56, 95),
      surface: hsl(42, 60, 98),
      surface2: hsl(38, 44, 89),
      border: hsl(30, 30, 26),
      muted: hsl(28, 26, 30),
      fg: hsl(26, 40, 8),
      brand: hsl(h, 92, 28),
      brandFg: hsl(40, 56, 98),
      danger: "0 92% 34%",
      warn: "28 100% 26%",
      ok: "140 92% 22%"
    })
  },
  {
    label: "Kağıt Kontrast",
    scheme: "light",
    vars: (h) => ({
      bg: hsl(40, 22, 97),
      surface: hsl(40, 16, 99.5),
      surface2: hsl(40, 20, 91),
      border: hsl(34, 24, 27),
      muted: hsl(32, 22, 31),
      fg: hsl(30, 30, 8),
      brand: hsl(h, 90, 30),
      brandFg: hsl(40, 22, 99),
      danger: "0 92% 34%",
      warn: "30 100% 27%",
      ok: "140 92% 23%"
    })
  },
  {
    label: "Buz Kontrast",
    scheme: "light",
    vars: (h) => ({
      bg: hsl(205, 30, 98),
      surface: hsl(205, 20, 99.5),
      surface2: hsl(205, 26, 92),
      border: hsl(210, 30, 24),
      muted: hsl(208, 26, 28),
      fg: hsl(212, 36, 8),
      brand: hsl(h, 92, 30),
      brandFg: hsl(205, 30, 99),
      danger: "0 92% 34%",
      warn: "28 100% 26%",
      ok: "140 92% 22%"
    })
  }
];
const TINT_ALPHA = 0.1;
const rgbOf = (v) => hslToRgb(parseHslVar(v));
function nudge(value, dir, passes) {
  const [h, s0, l0] = parseHslVar(value);
  let s = s0;
  let l = l0;
  let out = formatHslVar([h, s, l]);
  for (let i = 0; i < 220 && !passes(rgbOf(out)); i++) {
    l = Math.min(100, Math.max(0, l + dir * 0.5));
    out = formatHslVar([h, s, l]);
    if (l === 0 || l === 100) {
      s = Math.max(0, s - 5);
    }
  }
  return out;
}
function themeGrounds(t) {
  const v = t.vars;
  return [v.bg, v.surface, v.surface2, ...t.bgStops].map(rgbOf);
}
function bandGrounds(t) {
  return [t.vars.bg, t.vars.surface, ...t.bgStops].map(rgbOf);
}
function textPasses(grounds, bands) {
  return (c) => grounds.every((g) => contrastRatio(c, g) >= TEXT_MIN) && bands.every((g) => contrastRatio(c, mix(c, g, TINT_ALPHA)) >= TEXT_MIN);
}
function harden(vars, scheme, bgStops, given = {}) {
  const dir = scheme === "light" ? -1 : 1;
  const probe = { vars: { ...vars, inputBorder: "", brandHover: "", dangerFg: "" }, bgStops };
  const grounds = themeGrounds(probe);
  const text = textPasses(grounds, bandGrounds(probe));
  const [bh] = parseHslVar(vars.brand);
  const fgLum = luminance(rgbOf(vars.brandFg));
  const brandFg = scheme === "light" ? fgLum > 0.8 ? vars.brandFg : "0 0% 100%" : fgLum < 0.02 ? vars.brandFg : formatHslVar([bh, 55, 9]);
  const onBrand = rgbOf(brandFg);
  const dangerFg = given.dangerFg ?? (scheme === "light" ? "0 0% 100%" : formatHslVar([bh, 30, 8]));
  const onDanger = rgbOf(dangerFg);
  const fg = nudge(vars.fg, dir, text);
  const muted = nudge(vars.muted, dir, text);
  const brand = nudge(vars.brand, dir, (c) => text(c) && contrastRatio(c, onBrand) >= TEXT_MIN);
  const danger = nudge(vars.danger, dir, (c) => text(c) && contrastRatio(c, onDanger) >= TEXT_MIN);
  const warn = nudge(vars.warn, dir, text);
  const ok = nudge(vars.ok, dir, text);
  const [h, s, l] = parseHslVar(brand);
  const brandHover = nudge(
    given.brandHover ?? formatHslVar([h, s, Math.min(100, Math.max(0, l + dir * 8))]),
    dir,
    (c) => contrastRatio(c, onBrand) >= TEXT_MIN
  );
  const inputBorder = nudge(
    given.inputBorder ?? vars.border,
    dir,
    (c) => grounds.every((g) => contrastRatio(c, g) >= UI_MIN)
  );
  return { ...vars, fg, muted, brand, brandFg, danger, warn, ok, brandHover, inputBorder, dangerFg };
}
function hexVar(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const r = (n) => Math.round(n * 100) / 100;
  return `${r(h)} ${r(s)}% ${r(l)}%`;
}
const PAPERAXIS_THEMES = [
  {
    id: "paperaxis",
    label: "PaperAxis Aydınlık",
    scheme: "light",
    hex: {
      bg: "#F5F3EE",
      // Paper White
      surface: "#FFFFFF",
      // raised
      surface2: "#E6E4DE",
      // Soft Gray
      border: "#C9C6BD",
      // border-strong, decorative
      muted: "#666963",
      // Graphite
      fg: "#171918",
      // Pure Ink
      brand: "#315BDB",
      // Axis Blue
      brandFg: "#FFFFFF",
      danger: "#B3261E",
      warn: "#8A5300",
      ok: "#4F6A44",
      inputBorder: "#7E817A",
      brandHover: "#2649B8",
      dangerFg: "#FFFFFF"
    }
  },
  {
    id: "paperaxis-koyu",
    label: "PaperAxis Koyu",
    scheme: "dark",
    hex: {
      bg: "#171918",
      // Pure Ink
      surface: "#232625",
      // ink-surface
      surface2: "#2D3130",
      border: "#3A3E3C",
      // ink-border, decorative
      muted: "#9A9D96",
      // graphite-light
      fg: "#F5F3EE",
      brand: "#7A9BF0",
      // Blue Light
      brandFg: "#171918",
      danger: "#F0736B",
      warn: "#E8B44A",
      ok: "#A5B99A",
      inputBorder: "#7E817A",
      brandHover: "#8EA9F3",
      dangerFg: "#171918"
    }
  }
];
function makeBrandTheme(def) {
  const raw = Object.fromEntries(Object.entries(def.hex).map(([k, v]) => [k, hexVar(v)]));
  const vars = harden(raw, def.scheme, [], {
    inputBorder: raw.inputBorder,
    brandHover: raw.brandHover,
    dangerFg: raw.dangerFg
  });
  return {
    id: def.id,
    label: def.label,
    category: "paperaxis",
    scheme: def.scheme,
    vars,
    appBg: `hsl(${vars.bg})`,
    bgStops: [],
    metaColor: def.hex.bg
  };
}
function makeTheme(h, name, slug, category, idx) {
  let label;
  let scheme;
  let vars;
  let appBg;
  let bgStops = [];
  if (category === "light") {
    const st = LIGHT_STYLES[idx];
    vars = buildLight(h, st);
    scheme = "light";
    label = `${name} ${st[0]}`;
    appBg = `hsl(${vars.bg})`;
  } else if (category === "dark") {
    const st = DARK_STYLES[idx];
    vars = buildDark(h, st);
    scheme = "dark";
    label = `${name} ${st[0]}`;
    appBg = `hsl(${vars.bg})`;
  } else if (category === "light-grad") {
    const st = LIGHT_STYLES[idx];
    vars = buildLight(h, st);
    scheme = "light";
    label = `${name} ${st[0]} Gradyan`;
    ({ css: appBg, stops: bgStops } = lightGrad(h, idx));
  } else if (category === "dark-grad") {
    const st = DARK_STYLES[idx];
    vars = buildDark(h, st);
    scheme = "dark";
    label = `${name} ${st[0]} Gradyan`;
    ({ css: appBg, stops: bgStops } = darkGrad(h, idx));
  } else if (category === "a11y-light") {
    const r = A11Y_LIGHT[idx % A11Y_LIGHT.length];
    vars = r.vars(h);
    scheme = "light";
    label = `${name} ${r.label}`;
    appBg = `hsl(${vars.bg})`;
  } else {
    const r = A11Y_DARK[idx % A11Y_DARK.length];
    vars = r.vars(h);
    scheme = "dark";
    label = `${name} ${r.label}`;
    appBg = `hsl(${vars.bg})`;
  }
  return {
    id: `${CATEGORY_META[category].prefix}-${slug}`,
    label,
    category,
    scheme,
    vars: harden(vars, scheme, bgStops),
    appBg,
    bgStops,
    metaColor: hslStrToHex(vars.bg)
  };
}
const CATEGORY_ORDER = [
  "light",
  "dark",
  "light-grad",
  "dark-grad",
  "a11y-light",
  "a11y-dark"
];
const ALL_THEMES = [
  ...PAPERAXIS_THEMES.map(makeBrandTheme),
  ...CATEGORY_ORDER.flatMap((cat) => HUES.map(([h, name, slug], idx) => makeTheme(h, name, slug, cat, idx)))
];
const BRAND_THEME_ID = "paperaxis";
const DEFAULT_THEME = BRAND_THEME_ID;
const THEME_BY_ID = new Map(ALL_THEMES.map((t) => [t.id, t]));
function getTheme(id) {
  return THEME_BY_ID.get(id);
}
function themesByCategory() {
  return {
    paperaxis: ALL_THEMES.filter((t) => t.category === "paperaxis"),
    light: ALL_THEMES.filter((t) => t.category === "light"),
    dark: ALL_THEMES.filter((t) => t.category === "dark"),
    "light-grad": ALL_THEMES.filter((t) => t.category === "light-grad"),
    "dark-grad": ALL_THEMES.filter((t) => t.category === "dark-grad"),
    "a11y-light": ALL_THEMES.filter((t) => t.category === "a11y-light"),
    "a11y-dark": ALL_THEMES.filter((t) => t.category === "a11y-dark")
  };
}
const CATEGORY_LABELS = {
  paperaxis: "PaperAxis",
  light: "Aydınlık",
  dark: "Karanlık",
  "light-grad": "Aydınlık gradyan",
  "dark-grad": "Karanlık gradyan",
  "a11y-light": "Erişilebilir aydınlık",
  "a11y-dark": "Erişilebilir karanlık"
};
function themeHex(v) {
  return rgbToHex(rgbOf(v));
}
const THEME_IDS = new Set(ALL_THEMES.map((t) => t.id));
// PaperMap'in eski 60 temasi (6 kategori x 10 aksan) ve light/dark/system
// degerleri en yakin katalog temasina eslenir; kayitli secim kaybolmaz.
const LEGACY_ACCENTS = {
  emerald: "zumrut",
  teal: "turkuaz",
  blue: "mavi",
  indigo: "civit",
  violet: "menekse",
  fuchsia: "fusya",
  pink: "gul",
  rose: "kiraz",
  orange: "turuncu",
  amber: "kehribar"
};
const LEGACY_CATEGORIES = {
  light: "light",
  dark: "dark",
  "light-gradient": "light-grad",
  "dark-gradient": "dark-grad",
  "light-access": "a11y-light",
  "dark-access": "a11y"
};
const LEGACY_THEME_ALIASES = {
  "": "paperaxis",
  light: "paperaxis",
  system: "paperaxis",
  dark: "paperaxis-koyu"
};
for (const [oldCat, newPrefix] of Object.entries(LEGACY_CATEGORIES)) {
  for (const [oldAccent, slug] of Object.entries(LEGACY_ACCENTS)) {
    LEGACY_THEME_ALIASES[`${oldCat}-${oldAccent}`] = `${newPrefix}-${slug}`;
  }
}
function isTheme(value) {
  return typeof value === "string" && THEME_IDS.has(value);
}
function normalizeTheme(value) {
  if (typeof value !== "string") return null;
  if (THEME_IDS.has(value)) return value;
  if (value in LEGACY_THEME_ALIASES) return LEGACY_THEME_ALIASES[value];
  return null;
}
/** Kayitli ya da eski bir kimligi gecerli katalog kimligine cevirir. */
function resolveThemeId(value) {
  return normalizeTheme(value) ?? DEFAULT_THEME;
}
const c = (v) => `hsl(${v})`;
/**
 * Temayi PaperMap'in CSS degiskenlerine cevirir (styles.css). Degerler
 * olculmus HSL ucluleridir; <html> uzerine satir ici yazilir.
 */
function themeStyle(id) {
  const t = getTheme(resolveThemeId(id));
  const v = t.vars;
  return {
    "--app-bg": t.appBg,
    "--bg": c(v.bg),
    "--card": c(v.surface),
    "--surface-2": c(v.surface2),
    "--input-bg": t.scheme === "light" ? c(v.surface) : c(v.bg),
    "--text": c(v.fg),
    "--muted": c(v.muted),
    "--border": c(v.border),
    "--input-border": c(v.inputBorder),
    "--accent": c(v.brand),
    "--accent-hover": c(v.brandHover),
    "--on-accent": c(v.brandFg),
    "--danger": c(v.danger),
    "--on-danger": c(v.dangerFg),
    "--warn": c(v.warn),
    "--ok": c(v.ok)
  };
}
export {
  ALL_THEMES,
  BRAND_THEME_ID,
  CATEGORY_LABELS,
  DEFAULT_THEME,
  bandGrounds,
  getTheme,
  harden,
  isTheme,
  normalizeTheme,
  resolveThemeId,
  themeGrounds,
  themeHex,
  themeStyle,
  themesByCategory
};
