// Kullanilabilir yazi tipleri. Disleksi/okunabilirlik dostu Lexend ve
// Atkinson Hyperlegible dahil.
export const FONTS = [
  {
    id: 'default',
    name: 'Varsayılan',
    stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  { id: 'lexend', name: 'Lexend', stack: "'Lexend', sans-serif" },
  {
    id: 'atkinson',
    name: 'Atkinson Hyperlegible',
    stack: "'Atkinson Hyperlegible', sans-serif",
  },
  { id: 'inter', name: 'Inter', stack: "'Inter', sans-serif" },
  { id: 'nunito', name: 'Nunito', stack: "'Nunito', sans-serif" },
  { id: 'roboto', name: 'Roboto', stack: "'Roboto', sans-serif" },
  { id: 'poppins', name: 'Poppins', stack: "'Poppins', sans-serif" },
];

const FONT_MAP = Object.fromEntries(FONTS.map((f) => [f.id, f]));

export function fontStack(id) {
  return (FONT_MAP[id] || FONT_MAP.default).stack;
}
